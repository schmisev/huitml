<script lang="ts">
	import { html } from '@codemirror/lang-html';
	import { css } from '@codemirror/lang-css';
	import { javascript } from '@codemirror/lang-javascript';
	import { Pane, Splitpanes } from 'svelte-splitpanes';
	import CodeMirror from 'svelte-codemirror-editor';
	import isValidFilename from 'valid-filename';
	import {
		deleteEntry,
		getPathToFile,
		createNewFile,
		createNewFolder,
		openPath,
		recursivelyBuildFS,
		saveFile,
		toVFS,
		setVFS,
		type LocalFile,
		type LocalFolder
	} from '$lib/file-system';
	import Preview from '$lib/components/Preview.svelte';
	import { onMount } from 'svelte';
	import codeIcon from '$lib/images/code.svg';

	// loading
	async function loadFolder() {
		try {
			folder = await window.showDirectoryPicker();
			fs = await recursivelyBuildFS(folder, undefined);
			setVFS(fs);
		} catch (e) {
			return;
		}
	}

	async function reloadFolder(folder?: LocalFolder) {
		if (!folder) return;
		try {
			fs = await recursivelyBuildFS(folder.handle, folder.parent);
			setVFS(fs);
		} catch (e) {
			return;
		}
	}

	// tab manipulation
	function showFileInTab(file: LocalFile) {
		tab = file;
		selected = file;
	}

	function selectFolder(folder: LocalFolder) {
		selected = folder;
	}

	async function saveTab(tab?: LocalFile) {
		await saveFile(tab);
		reloadFolder(fs);
	}

	async function gotoFileInTab(path: string) {
		const base = document.baseURI;
		if (path.search(base) === 0) {
			if (!fs) return;
			const reducedPath = path.replace(base, '').replace('preview', '');
			const dir = openPath(reducedPath, fs);
			if (!dir) {
				if (tab) showFileInTab(tab);
				// window.open(path);
				return;
			}
			showFileInTab(dir);
		} else {
			window.open(path);
		}
	}

	// codemirror
	function pickLanguage(tab: LocalFile) {
		if (tab.blob.type.endsWith('css')) return css();
		if (tab.blob.type.endsWith('html')) return html();
		if (tab.blob.type.endsWith('javascript')) return javascript();
	}

  interface FileTemplate {
    ext: `.${string}`;
    doc: string;
  }

  const HTML_TEMPLATE: FileTemplate = {
    doc: 
`<html>
  <head>
    <title>Noch kein Titel</title>
  </head>
  <body>
    Hier könnte der Website-Inhalt stehen.
  </body>
</html>`,
    ext: ".html",
  }

  const CSS_TEMPLATE: FileTemplate = {
    doc: 
`div {
  background-color: lightblue;
  border: 2px solid red;
  padding: 0.5rem;
}
`,
    ext: ".css",
  }

  async function createFileFromTemplate(template: FileTemplate, entry?: LocalFolder | LocalFile) {
    if (!entry) return;
		if (entry.kind === 'file') entry = entry.parent;
    const pathToFolder = getPathToFile(entry, false, false);

		let fileName = prompt(`Es wird eine neue Datei im Ordner ${pathToFolder} erzeugt.\nGib den Dateinamen an: _________${template.ext}`);
    if (!fileName) return;
    if (!fileName.endsWith(template.ext)) fileName += template.ext;
		if (!isValidFilename(fileName)) return;
		const file = await createNewFile(entry, fileName);
		if (!file) return;

    file.doc = {
      txt: template.doc,
      lastTxt: template.doc
    }

    await saveFile(file);
		showFileInTab(file);
		reloadFolder(fs);
  }

	async function createFile(entry?: LocalFolder | LocalFile) {
		if (!entry) return;
		if (entry.kind === 'file') entry = entry.parent;

		const fileName = prompt('Gib den Dateinamen an!');
		if (!fileName || !isValidFilename(fileName)) return;
		const file = await createNewFile(entry, fileName);
		if (!file) return;
		showFileInTab(file);
		reloadFolder(fs);
	}

	async function createFolder(entry?: LocalFolder | LocalFile) {
		if (!entry) return;
		if (entry.kind === 'file') entry = entry.parent;

		const fileName = prompt('Gib den Ordnernamen an!');
		if (!fileName || !isValidFilename(fileName)) return;
		await createNewFolder(entry, fileName);
		reloadFolder(fs);
	}

	async function deleteEntryInEditor(entry: LocalFolder | LocalFile) {
		const ret = confirm(`Willst du die Datei "${entry.handle.name}" wirklich löschen?`);
		if (ret) {
			deleteEntry(entry);
			reloadFolder(fs);
		}
	}

	// setup
	let folder: FileSystemDirectoryHandle | undefined = $state();
	let fs: LocalFolder | undefined = $state();
	let tab: LocalFile | undefined = $state();
	let selected: LocalFile | LocalFolder | undefined = $state();
	let preview: Preview | undefined = $state();

	onMount(() => {
		document.onkeydown = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				saveTab(tab);
			}
		};
	});
</script>

{#snippet showFolder(root: LocalFolder)}
	<div role="button" tabindex="-1" class="container folder" class:selected={root === selected}>
		<div class="flex flex-row items-center gap-1">
			<div class="grow hover:cursor-pointer" onclick={() => selectFolder(root)}>
				📂 {root.handle.name}
			</div>
			<button class="button small" onclick={() => deleteEntryInEditor(root)}> ❌ </button>
		</div>
		{#each Object.keys(root.folders).toSorted() as name}
      {@const folder = root.folders[name] }
			{@render showFolder(folder)}
		{/each}
		{#each Object.keys(root.files).toSorted() as name}
      {@const file = root.files[name] }
			<div class="flex flex-row gap-1">
				<button
					class="button file grow"
					class:selected={file === selected}
					onclick={() => showFileInTab(file)}>{file.handle.name}</button
				>
				<button class="button small" onclick={() => deleteEntryInEditor(file)}> ❌ </button>
			</div>
		{/each}
	</div>
{/snippet}

<div class="hui">
	<Splitpanes style="height: 100dvh;">
		<Pane size={20}>
			<div class="h-full bg-linear-to-b from-blue-300 to-blue-200">
				<div class="flex flex-col gap-2 p-2">
					<div class="font-bold text-center text-white flex flex-row gap-2 p-2 items-center">
						<img class="w-8 rotate-8" alt="logo" src={codeIcon} /><span>HuiTML</span>
					</div>
					<div class="border-t-2 border-white"></div>
					{#if folder}
            <div class="flex flex-row gap-2">
              <button class="button small" onclick={() => reloadFolder(fs)}>↺</button>
						  <button class="button small" onclick={() => createFileFromTemplate(HTML_TEMPLATE, selected)}>+ html</button>
              <button class="button small" onclick={() => createFileFromTemplate(CSS_TEMPLATE, selected)}>+ css</button>
						  <button class="button small" onclick={() => createFolder(selected)}>+ Ordner</button>
					  </div>
						{#if fs}
							{@render showFolder(fs)}
						{/if}
					{:else}
						<div>Kein Ordner geöffnet</div>
						<button class="button" onclick={loadFolder}>Öffne Ordner</button>
					{/if}
				</div>
			</div>
		</Pane>
		<Pane>
			<div class="h-full p-2">
				<div class="flex flex-col gap-2 h-full">
					{#if tab}
						<div class="flex flex-row items-center gap-2">
							<div class="grow">{tab.handle.name}</div>
							{#if tab.doc}
								<button class="button" onclick={() => saveTab(tab)}>speichern</button>
							{/if}
							{#if tab.doc?.txt !== tab.doc?.lastTxt}
								<span>nicht gespeichert</span>
							{/if}
						</div>
						<div class="flex flex-col flex-wrap"></div>
						{#if tab.doc}
							<CodeMirror bind:value={tab.doc.txt} lang={pickLanguage(tab)}></CodeMirror>
						{:else}
							<div class="label negative">Datei kann nicht editiert werden.</div>
						{/if}
					{:else}
						<div class="label negative">Keine Datei geöffnet</div>
					{/if}
				</div>
			</div>
		</Pane>
		<Pane>
			<div class="bg-white h-full p-2">
				{#if tab}
					<Preview bind:this={preview} file={tab} gotoFile={gotoFileInTab}></Preview>
				{:else}
					<div class="label negative">Keine Vorschau!</div>
				{/if}
			</div>
		</Pane>
	</Splitpanes>
</div>
