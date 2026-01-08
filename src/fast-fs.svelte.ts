import { SvelteMap } from 'svelte/reactivity';

export type FS_Entry = FS_File | FS_Dir;

export interface FS_File {
	kind: 'file';
	handle: FileSystemFileHandle;
  parent: FS_Dir;
  blob: File;
  state?: {
    doc: string;
    cachedDoc: string;
  };
}

export interface FS_Dir {
	kind: 'dir';
	handle: FileSystemDirectoryHandle;
	map: SvelteMap<string, FS_Entry>;
  parent?: FS_Dir;
}

export class FS {
  live: boolean = $state(false);
	vfs: SvelteMap<string, File>;
	root: FS_Dir | undefined = $state();

	constructor() {
		this.vfs = new SvelteMap();
		this.root = undefined;
	}

	clear() {
		this.vfs = new SvelteMap();
		this.root = undefined;
    this.stop();
	}

  start() {
    this.live = true;
  }

  stop() {
    this.live = false;
  }

  // open file system
	async open(root: FileSystemDirectoryHandle) {
    this.stop();
		this.clear();
    this.root = await this.openDir(root);
    this.setVFS();
    this.start();
	}

  // constructing new files and directories
	async openDir(handle: FileSystemDirectoryHandle, parent?: FS_Dir): Promise<FS_Dir> {
		const newDir: FS_Dir = $state({
			handle,
			kind: 'dir',
			map: new SvelteMap(),
      parent
		});
    if (parent) parent.map.set(handle.name, newDir);

		for await (const [name, entry] of handle.entries()) {
      switch (entry.kind) {
        case 'directory':
          await this.openDir(entry, newDir);
          break;
        case 'file':
          await this.openFile(entry, newDir);
          break;
      }
		}
    return newDir;
	}

  async openFile(handle: FileSystemFileHandle, parent: FS_Dir): Promise<FS_File> {
    const newFile: FS_File = $state({
      handle,
      kind: 'file',
      blob: await handle.getFile(),
      parent
    });
    parent.map.set(handle.name, newFile);
    if (newFile.blob.type.startsWith("text")) {
      const txt = await newFile.blob.text();
      newFile.state = { doc: txt, cachedDoc: txt };
    }

    this.registerFile(newFile);
    return newFile;
  }

  // file management
  async createFile(dir: FS_Dir, fileName: string): Promise<FS_File | null> {
    if (dir.map.has(fileName)) return null;
    const handle = await dir.handle.getFileHandle(fileName, { create: true });
    return await this.openFile(handle, dir);
  }

  async createDir(dir: FS_Dir, dirName: string): Promise<FS_Dir | null> {
    if (dir.map.has(dirName)) return null;
    const handle = await dir.handle.getDirectoryHandle(dirName, { create: true });
    return await this.openDir(handle, dir);
  }

  async removeEntry(entry: FS_Entry, recursive = true): Promise<boolean> {
    if (!entry.parent) return false; // can't remove unmoored file or dir
    const parent = entry.parent;
    const name = entry.handle.name;
    await parent.handle.removeEntry(name, { recursive });
    switch (entry.kind) {
      case 'file': {
        this.deregisterFile(entry);
        return parent.map.delete(name);
      }
      case 'dir': return parent.map.delete(name);
    }
  }

  async moveFile(file: FS_File, target?: FS_Dir, newName?: string): Promise<FS_File | null> {
    if (!file.parent) return null; // can't move unmoored files
    target = target || file.parent;
    newName = newName || file.handle.name;
    const newFile = await this.createFile(target, newName);
    if (!newFile) return null;
    await this.copyIntoFile(newFile, file);
    await this.removeEntry(file);
    return newFile;
  }

  async moveFolder(dir: FS_Dir, target?: FS_Dir, newName?: string): Promise<FS_Dir | null> {
    if (!dir.parent) return null; // can't move unmoored dirs
    target = target || dir.parent;
    newName = newName || dir.handle.name;
    const newDir = await this.createDir(target, newName);
    if (!newDir) return null;
    for (const [name, entry] of dir.map.entries()) {
      switch (entry.kind) {
        case 'file': await this.moveFile(entry, newDir); break;
        case 'dir': await this.moveFolder(entry, newDir); break;
      }
    }
    await this.removeEntry(dir);
    return dir;
  }

  async saveFile(file: FS_File): Promise<void> {
    if (file.state) {
      const writable = await file.handle.createWritable({ keepExistingData: false });
      await writable.write(file.state.doc);
      await writable.close();
      file.state.cachedDoc = file.state.doc;
    } else {
      const writable = await file.handle.createWritable({ keepExistingData: false });
      await writable.write(await file.blob.arrayBuffer());
      await writable.close();
    }
    // recover saved blob
    file.blob = await file.handle.getFile();
    this.registerFile(file);
  }

  async copyIntoFile(target: FS_File, source: FS_File): Promise<void> {
    const writable = await target.handle.createWritable({ keepExistingData: false });
    await writable.write(await source.blob.arrayBuffer());
    await writable.close();
    target.blob = await target.handle.getFile(); // recover saved blob
    target.state = source.state ? {...source.state} : undefined; // copy cached state
    this.registerFile(target);
  }

  // pathing
  getPath(entry: FS_Entry, noRoot = false, noFileName = false) {
    let path = (!noFileName || entry.kind !== "file") ? "/" + entry.handle.name : "/";
    let dir = entry;
    while (dir.parent) {
      dir = dir.parent;
      if (!noRoot || dir.parent) path = "/" + dir.handle.name + path;
    }
    return path;
  }

  getRelativeURL(entry: FS_Entry) {
    return normalizePath(this.getPath(entry, true));
  }

  resolvePath(path: string, dir?: FS_Dir): FS_File | null {
    if (!dir) {
      if (!this.root) return null;
      dir = this.root;
    }

    const segments = path.split('/');
    if (segments.length === 0) return null;
    segments.shift()!; // we always shift the first segment

    for (const name of segments) {
      if (name === ".") continue;
      if (name === ".." && dir.parent) { dir = dir.parent; continue; }
      const next = dir.map.get(name);
      if (!next) return null;
      switch (next.kind) {
        case 'dir': dir = next; continue;
        case 'file': return next;
      }
    }

    return null;
  }

  fetch(path: string): File | null {
    return this.vfs.get(normalizePath(path)) || null;
  }

  // registering files in the file-map
  registerFile(file: FS_File): true {
    const path = this.getRelativeURL(file);
    this.vfs.set(path, file.blob);
    if (this.live) this.addToVFS([file]);
    return true;
  }

  // deregistering files in the file-map
  deregisterFile(file: FS_File): boolean {
    const path = this.getRelativeURL(file);
    const ret = this.vfs.delete(path);
    if (ret && this.live) this.removePathsFromVFS([path]);
    return ret;
  }

  // getters
  getSortedChildren(dir: FS_Dir): { dirs: FS_Dir[], files: FS_File[] } {
    const dirs: FS_Dir[] = [];
    const files: FS_File[] = [];

    for (const entry of dir.map.values()) {
      switch (entry.kind) {
        case 'dir': dirs.push(entry); break;
        case 'file': files.push(entry); break;
      }
    }
    dirs.sort((a, b) => a.handle.name.localeCompare(b.handle.name));
    files.sort((a, b) => a.handle.name.localeCompare(b.handle.name));
    return { dirs, files };
  }

  // vfs utils
  setVFS() {
    if (!navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({
      type: "SET_FILES",
      files: [...this.vfs.entries()]
    });
  }

  addToVFS(files: FS_File[]) {
    if (!navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({
      type: 'UPDATE_FILES',
      files: files.map((f) => [this.getRelativeURL(f), f.blob])
    });
  }

  removeFileFromVFS(file: FS_File) {
    this.removePathsFromVFS([this.getRelativeURL(file)]);
  }

  removePathsFromVFS(paths: string[]) {
    if (!navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({
      type: 'REMOVE_FILES',
      files: paths,
    });
  }

  // helpers
  equalEntry(a: FS_Entry, b: FS_Entry) {
    return this.getPath(a) === this.getPath(b);
  }
}

// helper functions
function normalizePath(rawPath: string) {
  let url = new URL("data:" + rawPath);
  return url.pathname;
}