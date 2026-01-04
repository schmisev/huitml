export interface LocalFile {
  kind: "file",
	parent: LocalFolder;
  doc?: {
    txt: string;
    lastTxt: string;
  }
	blob: Blob;
	handle: FileSystemFileHandle;
}

export interface LocalFolder {
  kind: "dir",
	handle: FileSystemDirectoryHandle;
	parent: undefined | LocalFolder;
	folders: { [name: string]: LocalFolder };
	files: { [name: string]: LocalFile };
}

export async function makeFile(
	handle: FileSystemFileHandle,
	parent: LocalFolder
): Promise<LocalFile> {
	const newFile: LocalFile = {
    kind: "file",
		parent,
		blob: new Blob(),
		handle,
	};

	const file = await handle.getFile();
	newFile.blob = file;
  if (isEditable(file)) {
    const doc = await file.text();
    newFile.doc = {
      txt: doc,
      lastTxt: doc
    }
  }
	return newFile;
}

export function isEditable(file: File): boolean {
	return file.type.startsWith('text');
}

export async function saveFile(file?: LocalFile) {
	if (!file) return;
	const writable = await file.handle.createWritable();
  if (file.doc !== undefined) {
    await writable.write(file.doc.txt);
    await writable.close();
    file.blob = await file.handle.getFile(); // update blob
    file.doc.lastTxt = file.doc.txt; // overwrite buffer
  } else {
    await writable.write(await file.blob.arrayBuffer());
    await writable.close();
  }
}

export async function createNewFile(
	inFolder: LocalFolder,
	fileName: string
): Promise<LocalFile | undefined> {
	if (fileName in inFolder.files) return undefined;
	const newFileHandle = await inFolder.handle.getFileHandle(fileName, {
		create: true
	});
	inFolder.files[newFileHandle.name] = await makeFile(newFileHandle, inFolder);
	return inFolder.files[fileName];
}

export async function createNewFolder(inFolder: LocalFolder, folderName: string): Promise<LocalFolder | undefined> {
	if (folderName in inFolder.folders) return;
	const newFolderHandle = await inFolder.handle.getDirectoryHandle(folderName, {
		create: true
	});
  const newFolder = await recursivelyBuildFS(newFolderHandle, inFolder);
  inFolder.folders[newFolderHandle.name] = newFolder;
  return newFolder;
}

export async function deleteEntry(entry: LocalFile | LocalFolder, recursive = true) {
	if (!entry.parent) return;
	const parent = entry.parent;
	const name = entry.handle.name;
	await parent.handle.removeEntry(name, { recursive });
	if (name in parent.folders) delete parent.folders[name];
	if (name in parent.files) delete parent.folders[name];
}

export async function moveFile(file: LocalFile, target?: LocalFolder, newName?: string): Promise<LocalFile | undefined> {
  if (!file.parent) return;
  target = target || file.parent;
  newName = newName || file.handle.name;

  // create new file
  const newFile = await createNewFile(target, newName);
  if (!newFile) return;

  // copy over file contents
  newFile.blob = file.blob;
  newFile.doc = file.doc;

  // "save" file contents to disc
  await saveFile(newFile);

  // delete old file
  await deleteEntry(file, true);

  return newFile;
}

// DO NOT USE THIS, THIS IS A WORKAROUND
export async function moveFolder(folder: LocalFolder, target?: LocalFolder, newName?: string): Promise<LocalFolder | undefined> {
  if (!folder.parent) return;
  target = target || folder.parent;
  newName = newName || folder.handle.name;

  // create new folder
  const newFolder = await createNewFolder(target, newName);
  if (!newFolder) return;

  // move files... very expensive
  for (const fileName in folder.files) {
    await moveFile(folder.files[fileName], newFolder);
  }
  for (const folderName in folder.folders) {
    await moveFolder(folder.folders[folderName], newFolder);
  }

  await deleteEntry(folder, true);
  return newFolder;
}

export async function recursivelyBuildFS(
	folder: FileSystemDirectoryHandle,
	parent: LocalFolder | undefined
): Promise<LocalFolder> {
	const localFolder: LocalFolder = {
    kind: "dir",
		parent,
		handle: folder,
		files: {},
		folders: {}
	};

	for await (const [name, handle] of folder.entries()) {
		switch (handle.kind) {
			case 'directory':
				localFolder.folders[handle.name] = await recursivelyBuildFS(handle, localFolder);
				break;
			case 'file':
				localFolder.files[handle.name] = await makeFile(handle, localFolder);
		}
	}

	return localFolder;
}

export function openPath(path: string, fs: LocalFolder): LocalFile | undefined {
	const dirNames = path.split('/');
	if (dirNames.length === 0) return;
	if (dirNames[0] === '') dirNames.shift()!;
	let dir = fs;
	for (const name of dirNames) {
		if (name in dir.files) return dir.files[name];
		else if (name === '..' && dir.parent) dir = dir.parent;
		else if (name in dir.folders) dir = dir.folders[name];
		else return;
	}
	return;
}

export function getPathToFile(file: LocalFile | LocalFolder, headless = true, rootless = true): string {
	let dir: LocalFile | LocalFolder = file;
	let path: string = headless ? '/' : '/' + file.handle.name;

	while (dir.parent) {
		dir = dir.parent;
		if (!rootless || dir.parent) path = '/' + dir.handle.name + path;
	}

	return path;
}


// vfs stuff
export function toVFS(fs: LocalFolder) {
	const vfs = new Map();
	recursivelyBuildVFS(vfs, '', fs);
	return vfs;
}

function recursivelyBuildVFS(vfs: Map<string, Blob>, currentPath: string, folder: LocalFolder) {
	for (const fileName in folder.files) {
		const f = folder.files[fileName];
		vfs.set(currentPath + '/' + fileName, f.blob);
	}
	for (const dirName in folder.folders) {
		recursivelyBuildVFS(vfs, currentPath + '/' + dirName, folder.folders[dirName]);
	}
}

export function setVFS(fs: LocalFolder) {
	const vfs = toVFS(fs);
	if (!navigator.serviceWorker.controller) return;
	navigator.serviceWorker.controller.postMessage({
		type: 'SET_FILES',
		files: [...vfs.entries()]
	});
}

export function updateVFS(singleFile: LocalFile) {
	if (!navigator.serviceWorker.controller) return;
	navigator.serviceWorker.controller.postMessage({
		type: 'UPDATE_FILES',
		files: [[getPathToFile(singleFile, false, true), singleFile.blob]]
	});
}
