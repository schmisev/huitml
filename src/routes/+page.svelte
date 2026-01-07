<script lang="ts">
	import { html } from '@codemirror/lang-html';
	import { css } from '@codemirror/lang-css';
	import { javascript } from '@codemirror/lang-javascript';
	import { undo } from '@codemirror/commands';
	import { Pane, Splitpanes } from 'svelte-splitpanes';
	import CodeMirror from 'svelte-codemirror-editor';
	import isValidFilename from 'valid-filename';
	import Preview from '$lib/components/Preview.svelte';
	import { onMount } from 'svelte';
	import codeIcon from '$lib/images/code.svg';
	import type { EditorView } from 'codemirror';
	import * as prettier from 'prettier/standalone';
	import * as parserHTML from 'prettier/parser-html';
	import * as parserCSS from 'prettier/parser-postcss';
	import { FS, type FS_Dir, type FS_Entry, type FS_File } from '../fast-fs';

  // setup
	let view: EditorView | undefined = $state();
	let folder: FileSystemDirectoryHandle | undefined = $state();
	let fs: FS = new FS();
	let tab: FS_File | undefined = $state();
	let selected: FS_Entry | undefined = $state();
	let dragged: FS_Entry | undefined = $state();
	let preview: Preview | undefined = $state();

	// loading
	async function loadFolder() {
		try {
			folder = await window.showDirectoryPicker();
			fs.open(folder);
      fs.setVFS();
		} catch (e) {
			return;
		}
	}

	async function reloadFolder(folder?: FS_Dir) {
		if (!folder) return;
		try {
			fs.openDir(folder.handle, folder.parent);
			fs.setVFS();
		} catch (e) {
			console.error(e);
			return;
		}
	}

	// tab manipulation
	function showFileInTab(file: FS_File) {
		tab = file;
		selected = file;
	}

	function selectFolder(folder: FS_Dir) {
		selected = folder;
	}

	async function saveTab() {
    if (!tab) return;
		fs.saveFile(tab);
	}

	function revertTab(tab?: FS_File) {
		if (!tab?.doc) return;
		tab.doc.txt = tab.doc?.lastTxt;
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
	function pickLanguage(tab: FS_File) {
		if (tab.blob.type.endsWith('css')) return css();
		if (tab.blob.type.endsWith('html')) return html();
		if (tab.blob.type.endsWith('javascript')) return javascript();
	}

	async function insertText(template: (content: string) => string, defaultContent: string) {
		if (!view) return;
		const range = view.state.selection.ranges[0];
		const insertText = range.empty ? template(defaultContent) : template(view.state.doc.sliceString(range.from, range.to));
		view.dispatch({
			changes: {
				from: range.from,
				to: range.to,
				insert: insertText
			},
			selection: { anchor: range.to + 1 }
		});
	}

	async function undoEdit() {
		if (!tab?.doc) return;
		if (!view) return;
		undo(view);
	}

	async function autoformat() {
		if (!tab?.doc) return;
		if (!view) return;

		if (tab.blob.type.endsWith('html')) {
			const newDoc = await prettier.format(tab.doc.txt, { parser: 'html', plugins: [parserHTML] });
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: newDoc
				}
			});
		} else if (tab.blob.type.endsWith('css')) {
			const newDoc = await prettier.format(tab.doc.txt, { parser: 'css', plugins: [parserCSS] });
			view.dispatch({
				changes: {
					from: 0,
					to: view.state.doc.length,
					insert: newDoc
				}
			});
		}
	}

	// file management
	interface FileTemplate {
		ext: `.${string}`;
		doc: string;
	}

	const HTML_TEMPLATE: FileTemplate = {
		doc: `<html>
  <head>
    <title>Noch kein Titel</title>
  </head>
  <body>
    Hier könnte der Website-Inhalt stehen.
  </body>
</html>`,
		ext: '.html'
	};

	const CSS_TEMPLATE: FileTemplate = {
		doc: `div {
  background-color: lightblue;
  border: 2px solid red;
  padding: 0.5rem;
}
`,
		ext: '.css'
	};

	async function createFileFromTemplate(template: FileTemplate, entry?: FS_Dir | FS_File) {
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
		};

		await saveFile(file);
		await reloadFolder(fs);
		showFileInTab(file);
	}

	async function renameFile(file?: FS_File) {
		if (!file) return;

		const pathToFile = getPathToFile(file, false, false);
		let fileName = prompt(`Die Datei ${pathToFile} wird umbenannt.\nGib einen neuen Dateinamen an:`, file.handle.name);
		if (!fileName || !isValidFilename(fileName)) return;
		const movedFile = await moveFile(file, undefined, fileName);
		if (!movedFile) return;
		await reloadFolder(fs);
		showFileInTab(movedFile);
	}

	async function dropDraggedEntry(target: FS_Dir) {
		if (!dragged) return;

		switch (dragged.kind) {
			case 'file':
				const newFile = await moveFile(dragged, target);
				if (!newFile) return;
				await reloadFolder(fs);
				showFileInTab(newFile);
				dragged = undefined;
				break;
			case 'dir':
				break;
		}
	}

	async function renameFolder(folder?: FS_Dir) {
		if (!folder) return;
		if (!confirm('Bist du dir sicher, dass du den Ordner umbenennen willst? Es kann sehr lange dauern!')) return;

		const pathToFile = getPathToFile(folder, false, false);
		let fileName = prompt(`Der Ordner ${pathToFile} wird umbenannt.\nGib einen neuen Ordnernamen an:`, folder.handle.name);
		if (!fileName || !isValidFilename(fileName)) return;
		const movedFolder = await moveFolder(folder, undefined, fileName);
		if (!movedFolder) return;
		await reloadFolder(fs);
	}

	async function createFile(entry?: FS_Dir | FS_File) {
		if (!entry) return;
		if (entry.kind === 'file') entry = entry.parent;

		const pathToFolder = getPathToFile(entry, false, false);
		let fileName = prompt(`Es wird ein neuer Ordner ${pathToFolder} erzeugt.\nGib den Ordnernamen an:`);
		if (!fileName || !isValidFilename(fileName)) return;
		const file = await createNewFile(entry, fileName);
		if (!file) return;
		await reloadFolder(fs);
		showFileInTab(file);
	}

	async function createFolder(entry?: FS_Dir | FS_File) {
		if (!entry) return;
		if (entry.kind === 'file') entry = entry.parent;

		const fileName = prompt('Gib den Ordnernamen an!');
		if (!fileName || !isValidFilename(fileName)) return;
		await createNewFolder(entry, fileName);
		await reloadFolder(fs);
	}

	async function deleteEntryInEditor(entry: FS_Dir | FS_File) {
		const ret = confirm(`Willst du die Datei "${entry.handle.name}" wirklich löschen?`);
		if (ret) {
			await deleteEntry(entry);
			await reloadFolder(fs);
		}
	}

	onMount(() => {
		window.onfocus = async (e) => {
			await reloadFolder(fs);
		};

		document.onkeydown = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				saveTab(tab);
			}
		};
	});
</script>

{#snippet showTools(tab: FS_File)}
	{#if tab.blob.type.endsWith('html')}
		<div class="flex flex-row flex-wrap gap-1">
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
		</div>
		<div class="flex flex-row flex-wrap gap-1">
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `\n<div>\n${content}\n</div>\n`, 'Neue Einteilung');
				}}
				title="Einteilung">
				{'<div>'}
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `\n<p>\n${content}\n</p>\n`, 'Neuer Paragraph');
				}}
				title="Paragraph">
				{'<p>'}
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `\n<ul>\n<li>${content}</li>\n<li>...</li>\n</ul>\n`, 'Erstes Listenelement');
				}}
				title="Ungeordnete Liste">
				{'● <ul>'}
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText((content) => `\n<ol>\n<li>${content}</li>\n<li>...</li>\n</ol>\n`, 'Erstes Listenelement');
				}}
				title="Geordnete Liste">
				{'1. <ol>'}
			</button>
			<button
				class="button medium"
				onclick={() => {
					insertText(
						(content) => `\n<table border="1" width="100%">\n<tr>\n<th>${content}</th>\n</tr>\n<tr>\n<td>${content}</td>\n</tr>\n</table>\n`,
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
	<div
		role="button"
		tabindex="-1"
		class="container folder"
		class:selected={root === selected}
		ondragover={(ev) => {
			ev.stopPropagation();
			ev.preventDefault();
			ev.currentTarget.classList.add('selected');
		}}
		ondragleave={(ev) => {
			ev.stopPropagation();
			ev.preventDefault();
			ev.currentTarget.classList.remove('selected');
		}}
		ondragend={(ev) => {
			ev.stopPropagation();
			ev.preventDefault();
			ev.currentTarget.classList.remove('selected');
		}}
		ondrop={async (ev) => {
			ev.stopPropagation();
			ev.preventDefault();
			ev.currentTarget.classList.remove('selected');
			await dropDraggedEntry(root);
		}}>
		<div class="flex flex-row items-center gap-1">
			<button class="text-left grow hover:cursor-pointer" onclick={() => selectFolder(root)}>
				📂 {root.handle.name}
			</button>
			{#if selected === root}
				<button class="button small" title="Datei umbenennen" onclick={() => renameFolder(root)}> ✏️ </button>
				<button class="button small" title="Lösche Ordner" onclick={() => deleteEntryInEditor(root)}> ❌ </button>
			{/if}
		</div>
		{#each Object.keys(root.folders).toSorted() as name}
			{@const folder = root.folders[name]}
			{@render showFolder(folder)}
		{/each}
		{#each Object.keys(root.files).toSorted() as name}
			{@const file = root.files[name]}
			<div class="flex flex-row gap-1">
				<button
					draggable="true"
					class="button file grow flex flex-row cursor-grab"
					class:selected={file === selected}
					onclick={() => showFileInTab(file)}
					ondragstart={(ev) => {
						dragged = file;
					}}>
					<span class="grow">{file.handle.name}</span>
					<span class="text-white">{file.doc?.txt === file.doc?.lastTxt ? '' : '●'}</span>
				</button>
				{#if file === selected}
					<button class="button small" title="Datei umbenennen" onclick={() => renameFile(file)}> ✏️ </button>
					<button class="button small" title="Lösche Datei" onclick={() => deleteEntryInEditor(file)}> ❌ </button>
				{/if}
			</div>
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
				<div class="flex flex-col gap-2 p-2 min-h-max h-min">
					<div class="font-bold text-center text-white flex flex-row gap-2 p-2 items-center">
						<img class="w-8 rotate-8" alt="logo" src={codeIcon} /><span>HuiTML</span>
					</div>
					<div class="border-t-2 border-white"></div>
					{#if folder}
						<div class="flex flex-row gap-2">
							<button class="button small" onclick={() => reloadFolder(fs)}>↺</button>
							<button class="button small" onclick={() => createFileFromTemplate(HTML_TEMPLATE, selected)}>+📄 html</button>
							<button class="button small" onclick={() => createFileFromTemplate(CSS_TEMPLATE, selected)}>+🖌️ css</button>
							<button class="button small" onclick={() => createFolder(selected)}>+📂 Ordner</button>
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
			<div class="flex flex-col gap-2 p-2 h-full min-h-0 max-h-full">
				{#if tab}
					<div class="flex flex-row items-center gap-2">
						<div class="grow">
							<div class="font-bold">{getPathToFile(tab, false, false)}</div>
							{#if tab?.doc?.txt !== tab?.doc?.lastTxt}
								<button title="Änderungen rückgängig machen!" onclick={() => revertTab(tab)}
									><u class="cursor-not-allowed">nicht gespeichert</u></button>
							{:else}
                <span>aktuell</span>
              {/if}
						</div>
						{#if tab.doc}
							<button title="Rückgängig!" class="button" onclick={undoEdit}>⏪</button>
							<button title="Speichern!" class="button" onclick={() => saveTab(tab)}>💾</button>
							<button title="Formatieren!" class="button whitespace-nowrap" onclick={async () => await autoformat()}>💫</button>
						{/if}
					</div>
					<div class="flex flex-col flex-wrap"></div>
					{#if tab.doc}
						{@render showTools(tab)}
						<CodeMirror onready={(e) => (view = e)} bind:value={tab.doc.txt} lang={pickLanguage(tab)}></CodeMirror>
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
					<Preview bind:this={preview} file={tab} gotoFile={gotoFileInTab}></Preview>
				{:else}
					<div class="label negative">Keine Vorschau!</div>
				{/if}
			</div>
		</Pane>
	</Splitpanes>
</div>
