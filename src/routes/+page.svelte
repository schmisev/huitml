<script lang="ts">
	import globeIcon from '$lib/components/ui-icons/globe-1-svgrepo-com.svg';
	import renameIcon from '$lib/components/ui-icons/edit-2-svgrepo-com.svg';
	import saveIcon from '$lib/components/ui-icons/save-svgrepo-com.svg';
	import undoIcon from '$lib/components/ui-icons/undo-svgrepo-com.svg';
	import wandIcon from '$lib/components/ui-icons/wand-svgrepo-com.svg';
	import trashIcon from '$lib/components/ui-icons/trash-2-svgrepo-com.svg';
	import laptopIcon from '$lib/components/ui-icons/laptop-svgrepo-com.svg';
	import refreshIcon from '$lib/components/ui-icons/refresh-svgrepo-com.svg';
  import eyeIcon from '$lib/components/ui-icons/eye-open-svgrepo-com.svg';
  import eyeOffIcon from '$lib/components/ui-icons/eye-off-svgrepo-com.svg';

	import { html } from '@codemirror/lang-html';
	import { css } from '@codemirror/lang-css';
	import { javascript } from '@codemirror/lang-javascript';
	import { undo } from '@codemirror/commands';
	import { Pane, Splitpanes } from 'svelte-splitpanes';
	import CodeMirror from 'svelte-codemirror-editor';
	import isValidFilename from 'valid-filename';
	import Preview from '$lib/components/Preview.svelte';
	import { onMount } from 'svelte';
	import type { EditorView } from 'codemirror';
	import * as prettier from 'prettier/standalone';
	import * as parserHTML from 'prettier/parser-html';
	import * as parserCSS from 'prettier/parser-postcss';
	import { FS, type FS_FileTemplate, type FS_Dir, type FS_Entry, type FS_File } from '../fast-fs.svelte';
	import FileIcon from '$lib/components/FileIcon.svelte';
	import Prompt from '$lib/components/Prompt.svelte';

	// setup
	let view: EditorView | undefined = $state();
	let root: FileSystemDirectoryHandle | undefined = $state();
	let fs: FS = new FS();
	let tab: FS_File | undefined = $state();
	let selected: FS_Entry | undefined = $state();
	let dragged: FS_Entry | undefined = $state();
	let preview: FS_File | undefined = $state();
	let simplePrompt: Prompt;

	// loading
	async function loadOPFS() {
		try {
			root = await navigator.storage.getDirectory();
			await fs.open(root);
			noTab();
		} catch (e) {
			console.error(e);
			return;
		}
	}

	async function loadFolder() {
		try {
			root = await window.showDirectoryPicker();
			await fs.open(root);
			noTab();
		} catch (e) {
			return;
		}
	}

	async function reloadFolder() {
		if (!root) return;
		try {
			await fs.open(root);
			noTab();
		} catch (e) {
			console.error(e);
			return;
		}
	}

	// tab manipulation
	function noTab() {
		selected = undefined;
		tab = undefined;
	}

	function showFileInTab(file: FS_File) {
		tab = file;
		selected = file;
	}

	function selectFolder(folder: FS_Dir) {
		selected = folder;
	}

	async function saveTab() {
		if (!tab) return;
		await fs.saveFile(tab);
	}

	function revertTab(tab?: FS_File) {
		if (!tab?.state) return;
		tab.state.doc = tab.state.cachedDoc;
	}

	async function gotoFileInTab(path: string) {
		const base = document.baseURI;
		if (path.search(base) === 0) {
			if (!fs) return;
			const reducedPath = path.replace(base, '').replace('preview', '');
			const file = fs.resolveURL(reducedPath);
      if (!file) {
				if (tab) showFileInTab(tab);
				// window.open(path);
				return;
			}
			showFileInTab(file);
		} else {
			window.open(path);
		}
	}

	function togglePreviewFile(file: FS_File) {
    if (preview === file) preview = undefined;
		else preview = file;
	}

	// codemirror
	function pickLanguage(tab: FS_File) {
		if (tab.blob.type.endsWith('css')) return css();
		if (tab.blob.type.endsWith('html')) return html();
		if (tab.blob.type.endsWith('javascript')) return javascript();
	}

	async function insertText(template: (content: string) => string, defaultContent: string) {
		if (!view) return;
		const range = view.state.selection.ranges[0];
		const insertText = range.empty ? template(defaultContent) : template(view.state.doc.sliceString(range.from, range.to));
		const indent = view.state.doc.lineAt(range.from).text.match(/^\s*/)?.[0] || '';
		const indentedText = insertText
			.split('\n')
			.map((l, i) => (i ? indent + l : l))
			.join('\n');
		view.dispatch({
			changes: {
				from: range.from,
				to: range.to,
				insert: indentedText
			},
			selection: { anchor: range.to + 1 }
		});
	}

	async function undoEdit() {
		if (!tab?.state) return;
		if (!view) return;
		undo(view);
	}

	async function autoformat() {
		if (!tab?.state) return;
		if (!view) return;

		if (tab.handle.name.endsWith('html')) {
			const newDoc = await prettier.format(tab.state.doc, { parser: 'html', plugins: [parserHTML] });
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: newDoc
				}
			});
		} else if (tab.handle.name.endsWith('css')) {
			const newDoc = await prettier.format(tab.state.doc, { parser: 'css', plugins: [parserCSS] });
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: newDoc
				}
			});
		}
	}

	const HTML_TEMPLATE: FS_FileTemplate = {
		doc: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Noch kein Titel</title>
  </head>
  <body>
    Hier könnte der Website-Inhalt stehen.
  </body>
</html>`,
		ext: '.html'
	};

	const CSS_TEMPLATE: FS_FileTemplate = {
		doc: `div {
  background-color: lightblue;
  border: 2px solid red;
  padding: 0.5rem;
}
`,
		ext: '.css'
	};

	// create
	async function createFile(entry?: FS_Dir | FS_File) {
		if (!entry) return;
		if (entry.kind === 'file') entry = entry.parent;

		const pathToFolder = fs.getPath(entry);
		const state = await simplePrompt.open({
			title: 'Datei erstellen',
			body: `Du bist dabei, eine Neue Datei im Ordner <b>${pathToFolder}</b> zu erstellen.`,
			inputLabel: 'Dateiname:',
			inputExt: '(Gib eine Dateiendung an!)',
			valuePreset: `neue-datei`
		});

		let fileName = state.value;
		if (!fileName || !isValidFilename(fileName)) return;
		const file = await fs.createFile(entry, fileName);
		if (!file) return;
		showFileInTab(file);
	}

	async function createFileFromTemplate(template: FS_FileTemplate, entry?: FS_Dir | FS_File) {
		if (!entry) return;
		if (entry.kind === 'file') entry = entry.parent;
		const pathToFolder = fs.getPath(entry, false, false);

		const state = await simplePrompt.open({
			title: `${template.ext}-Datei erstellen`,
			body: `Du bist dabei, eine neue Datei im Ordner <b>${pathToFolder}</b> zu erstellen.`,
			inputLabel: 'Dateiname:',
			inputExt: `${template.ext}`,
			valuePreset: `neue-datei`
		});

		let fileName = state.value;
		// let fileName = prompt(`Es wird eine neue Datei im Ordner ${pathToFolder} erzeugt.\nGib den Dateinamen an: _________${template.ext}`);

		if (!fileName) return;
		if (!fileName.endsWith(template.ext)) fileName += template.ext;
		if (!isValidFilename(fileName)) return;
		const file = await fs.createFile(entry, fileName);
		if (!file) return;

		file.state = {
			doc: template.doc,
			cachedDoc: ''
		};

		await fs.saveFile(file);
		showFileInTab(file);
	}

	async function createFolder(entry?: FS_Dir | FS_File) {
		if (!entry) return;
		if (entry.kind === 'file') entry = entry.parent;

		const pathToFolder = fs.getPath(entry);
		const state = await simplePrompt.open({
			title: 'Ordner erstellen',
			body: `Du bist dabei, einen neue Ordner in <b>${pathToFolder}</b> zu erstellen.`,
			inputLabel: 'Ordnername:',
			valuePreset: `neuer-ordner`
		});

		let fileName = state.value;
		if (!fileName || !isValidFilename(fileName)) return;
		await fs.createDir(entry, fileName);
	}

	async function dropDraggedEntry(target: FS_Dir) {
		if (!dragged) return;

		switch (dragged.kind) {
			case 'file':
				const newFile = await fs.moveFile(dragged, target);
				if (!newFile) return;
				showFileInTab(newFile);
				dragged = undefined;
				break;
			case 'dir':
				break;
		}
	}

	// renames
	async function renameFolder(folder?: FS_Dir) {
		if (!folder) return;
		const pathToFile = fs.getPath(folder);

		const check = await simplePrompt.open({
			titleClass: 'warning',
			title: 'Warnung',
			body: `Bist du sicher, dass du <b>${pathToFile}</b> wirklich umbenennen willst? Das kann sehr lange dauern!`,
			onlyConfirm: true
		});
		if (!check.result) return;

		const state = await simplePrompt.open({
			icon: renameIcon,
			title: 'Datei umbennen',
			body: `Du bist dabei, den Ordner <b>${pathToFile}</b> umzubenennen!`,
			inputLabel: 'Neuer Name:',
			valuePreset: folder.handle.name
		});

		let fileName = state.value;
		if (!fileName || !isValidFilename(fileName)) return;
		const movedFolder = await fs.moveFolder(folder, undefined, fileName);
		if (!movedFolder) return;
	}

	async function renameFile(file?: FS_File) {
		if (!file) return;

		const pathToFile = fs.getPath(file);
		const state = await simplePrompt.open({
			title: 'Datei umbennen',
			body: `Du bist dabei, die Datei <b>${pathToFile}</b> umzubenennen!`,
			inputLabel: 'Neue Name:',
			inputExt: `(Achte auf den Dateityp!)`,
			valuePreset: file.handle.name
		});

		let fileName = state.value;
		if (!fileName || !isValidFilename(fileName)) return;
		const movedFile = await fs.moveFile(file, undefined, fileName);
		if (!movedFile) return;
		showFileInTab(movedFile);
	}

	async function deleteEntryInEditor(entry: FS_Dir | FS_File) {
		const state = await simplePrompt.open({
			titleClass: 'negative',
			icon: trashIcon,
			title: `${entry.kind === 'dir' ? 'Ordner' : 'Datei'} löschen`,
			body: `Willst ${entry.kind === 'dir' ? 'den Ordner' : 'die Datei'} <b>${entry.handle.name}</b> wirklich löschen?`,
			onlyConfirm: true
		});

		if (state.result) {
			await fs.removeEntry(entry);
			noTab();
		}
	}

	onMount(async () => {
		document.onkeydown = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				saveTab();
			}
		};

		/*
    window.onfocus = async (e) => {
			await reloadFolder(fs);
		};
    */

		await loadOPFS();
	});
</script>

{#snippet showTools(tab: FS_File)}
	{#if tab.blob.type.endsWith('html')}
		<div class="flex flex-row flex-wrap gap-1">
			<!-- INLINE -->
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `<a href="">${content}</a>`, 'Link');
				}}
				title="Link">
				<u class="text-blue-700">{'<a>'}</u>
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `<b>${content}</b>`, 'fett');
				}}
				title="fett">
				<b>{'<b>'}</b>
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `<i>${content}</i>`, 'kursiv');
				}}
				title="kursiv">
				<i>{'<i>'}</i>
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `<u>${content}</u>`, 'unterstrichen');
				}}
				title="unterstrichen">
				<u>{'<u>'}</u>
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `<button>${content}</button>`, 'Button');
				}}
				title="Button">
				<span class="border rounded-md pl-2 pr-2">{'<button>'}</span>
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `<link href="${content}" rel="stylesheet">`, 'style.css');
				}}
				title="Style-Link">
				{'<link "stylesheet">'}
			</button>
		</div>
		<!-- BLOCKS -->
		<div class="flex flex-row flex-wrap gap-1">
			<button
				class="button medium"
				onclick={() => {
					insertText(
						(content) => `
<div>
${content}
</div>`,
						'Neue Einteilung'
					);
				}}
				title="Einteilung">
				{'<div>'}
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText(
						(content) => `
<p>
${content}
</p>`,
						'Neuer Paragraph'
					);
				}}
				title="Paragraph">
				{'<p>'}
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText(
						(content) => `
<ul>
  <li>${content}</li>
  <li>...</li>
</ul>`,
						'Erstes Listenelement'
					);
				}}
				title="Ungeordnete Liste">
				{'● <ul>'}
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText(
						(content) => `
<ol>
  <li>${content}</li>
  <li>...</li>
</ol>`,
						'Erstes Listenelement'
					);
				}}
				title="Geordnete Liste">
				{'1. <ol>'}
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText(
						(content) => `
<table border="1" width="100%">
  <tr>
    <th>${content}</th>
  </tr>
  <tr>
    <td>${content}</td>
  </tr>
</table>`,
						'Inhalt'
					);
				}}
				title="Tabelle">
				{'<table>'}
			</button>
		</div>
	{/if}
{/snippet}

{#snippet showFolder(root: FS_Dir)}
	{@const { dirs, files } = fs.getSortedChildren(root)}
	{@const deselect = (
		ev: DragEvent & {
			currentTarget: EventTarget & HTMLDivElement;
		}
	) => {
		ev.stopPropagation();
		ev.preventDefault();
		ev.currentTarget.classList.remove('selected');
	}}
	{@const select = (
		ev: DragEvent & {
			currentTarget: EventTarget & HTMLDivElement;
		}
	) => {
		ev.stopPropagation();
		ev.preventDefault();
		ev.currentTarget.classList.add('selected');
	}}
	<div
		role="button"
		tabindex="-1"
		class="container folder"
		class:selected={selected && fs.equalEntry(selected, root)}
		ondragover={select}
		ondragleave={deselect}
		ondragend={deselect}
		ondrop={async (ev) => {
			ev.stopPropagation();
			ev.preventDefault();
			ev.currentTarget.classList.remove('selected');
			if (dragged) return await dropDraggedEntry(root);
			if (!ev.dataTransfer) return;
			let selectedFile: FS_File | null = null;
			for (const file of ev.dataTransfer.files) {
				selectedFile = await fs.createFile(root, file.name, file);
			}
			if (selectedFile) showFileInTab(selectedFile);
		}}>
		<div class="flex flex-row items-center gap-1">
			<button
				class="text-left grow hover:cursor-pointer flex flex-row flex-nowrap overflow-hidden items-center gap-2"
				oncontextmenu={(ev) => ev.preventDefault()}
				onclick={(ev) => {
					ev.preventDefault();
					selectFolder(root);
				}}>
				<FileIcon file={root}></FileIcon>
				{root.handle.name || 'Online-Ordner'}
			</button>
			{#if selected === root && root.parent}
				<button class="button" title="Datei umbenennen" onclick={() => renameFolder(root)}><img class="h-4" src={renameIcon} /></button>
				<button class="button" title="Lösche Ordner" onclick={() => deleteEntryInEditor(root)}><img class="h-4" src={trashIcon} /></button>
			{/if}
		</div>

		{#each files as file}
			<div class="flex flex-row gap-1">
				<button
					draggable="true"
					class="button file grow flex flex-row items-center cursor-grab gap-2 min-w-0 overflow-hidden"
					class:selected={selected === file}
					oncontextmenu={(ev) => {
						ev.preventDefault();
						togglePreviewFile(file);
					}}
					onclick={(ev) => {
						ev.preventDefault();
						if (ev.button === 0) {
							showFileInTab(file);
						} else if (ev.button === 2) {
							togglePreviewFile(file);
						}
					}}
					ondragstart={(ev) => {
						dragged = file;
					}}>
					<FileIcon {file}></FileIcon><span class="grow"
						>{file.handle.name}{file.state?.doc === file.state?.cachedDoc ? '' : '*'}</span>{#if file === preview}<img class="w-5" src={eyeIcon}>{/if}
				</button>
				{#if selected && fs.equalEntry(selected, file)}
					<button class="button" title="Datei umbenennen" onclick={() => renameFile(file)}><img class="h-4" src={renameIcon} /></button>
					<button class="button" title="Lösche Datei" onclick={() => deleteEntryInEditor(file)}><img class="h-4" src={trashIcon} /></button>
				{/if}
			</div>
		{/each}

		{#each dirs as dir}
			{@render showFolder(dir)}
		{/each}
	</div>
{/snippet}

<svelte:head>
	<title>HuiTML Editor</title>
</svelte:head>

<div class="hui">
	<Splitpanes style="height: 100dvh;">
		<Pane size={20}>
			<div class="h-full bg-linear-to-b from-blue-300 to-blue-200 flex flex-col gap-2 p-2">
				<div class="flex flex-col gap-2 p-2 min-h-0 h-min w-full">
					{#if fs.root && fs.root.handle.name === ''}
						<button class="button w-full items-center flex flex-row gap-2 flex-nowrap overflow-hidden min-w-0" onclick={loadFolder}
							><img class="h-5" src={laptopIcon} /> Lade Ordner von PC</button>
					{:else}
						<button class="button w-full items-center flex flex-row gap-2 flex-nowrap overflow-hidden min-w-0" onclick={loadOPFS}
							><img class="h-5" src={globeIcon} /> Lade Online-Ordner</button>
					{/if}
					<div class="border-t-2 border-white"></div>
					{#if fs.root}
						<div class="flex flex-row gap-2">
							<button title="Ordner neu laden" class="button" onclick={() => reloadFolder()}><img class="h-3" src={refreshIcon} /></button>
							<button
								title="Neues HTML-File erstellen"
								class="button inline-flex items-center"
								onclick={() => createFileFromTemplate(HTML_TEMPLATE, selected)}><FileIcon ext="html"></FileIcon></button>
							<button
								title="Neues CSS-File erstellen"
								class="button inline-flex items-center"
								onclick={() => createFileFromTemplate(CSS_TEMPLATE, selected)}><FileIcon ext="css"></FileIcon></button>
							<button title="Neuen Ordner erstellen" class="button inline-flex items-center" onclick={() => createFolder(selected)}
								><FileIcon ext="dir"></FileIcon></button>
						</div>
						{@render showFolder(fs.root)}
					{:else}
						<div>Kein Ordner geöffnet</div>
						<button class="button" onclick={loadFolder}>Öffne Ordner</button>
					{/if}
				</div>
			</div>
		</Pane>
		<Pane>
			<div class="flex flex-col gap-2 p-2 h-full min-h-0 max-h-full">
				{#if tab}
					<div class="flex flex-row items-center gap-2">
						<div class="grow">
							<div class="font-bold">{fs.getPath(tab)}</div>
							{#if tab?.state?.doc !== tab?.state?.cachedDoc}
								<button title="Änderungen rückgängig machen!" onclick={() => revertTab(tab)}
									><u class="cursor-not-allowed">nicht gespeichert</u></button>
							{:else}
								<span>aktuell</span>
							{/if}
						</div>
						{#if tab.state}
							<button title="Rückgängig!" class="button" onclick={undoEdit}><img class="h-6" src={undoIcon} /></button>
							<button title="Speichern!" class="button" onclick={() => saveTab()}><img class="h-6" src={saveIcon} /></button>
							<button title="Formatieren!" class="button whitespace-nowrap" onclick={async () => await autoformat()}
								><img class="h-6" src={wandIcon} /></button>
						{/if}
					</div>
					<div class="flex flex-col flex-wrap"></div>
					{#if tab.state}
						{@render showTools(tab)}
						<CodeMirror lineWrapping={true} onready={(e) => (view = e)} bind:value={tab.state.doc} lang={pickLanguage(tab)}></CodeMirror>
					{:else}
						<div class="label negative">Datei kann nicht editiert werden.</div>
					{/if}
				{:else}
					<div class="label negative">Keine Datei geöffnet</div>
				{/if}
			</div>
		</Pane>
		<Pane>
			<div class="bg-white h-full p-2">
				{#if tab}
					<Preview file={tab} {preview} {fs} gotoFile={gotoFileInTab}></Preview>
				{:else}
					<div class="label negative">Keine Vorschau!</div>
				{/if}
			</div>
		</Pane>
	</Splitpanes>

	<Prompt bind:this={simplePrompt}></Prompt>
</div>
