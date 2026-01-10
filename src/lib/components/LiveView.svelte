<script lang="ts">
	import { resolve } from '$app/paths';
	import type { FS, FS_File } from '$lib/fast-fs.svelte';
	import { refreshIcon } from '$lib/icons';
	import { PREVIEW_PREFIX } from '$lib/routing-info';
	import { onMount } from 'svelte';

	let {
		fs,
		editFile,
		gotoFile
	}: {
		fs: FS;
		editFile: FS_File;
		gotoFile: (pathe: string) => void;
	} = $props();

	let frame: HTMLIFrameElement | undefined = $state();

	let editBase = $derived(resolve((PREVIEW_PREFIX + fs.getRelativeURL(editFile, true, true)) as '/'));
	let live = $derived(editFile.handle.name.endsWith('.html')); // we only allow live preview for html
	let editSrcdoc = $derived(live && editFile ? editFile.state?.doc.replace('<head>', `<head><base href="${editBase}">`) : undefined);
	let editSrc = $derived(resolve((PREVIEW_PREFIX + fs.getRelativeURL(editFile)) as '/'));

	let editDoc: HTMLDocument | undefined = $state();
	let title = $derived(live && editDoc && editDoc.title ? editDoc.title : editSrc);

	export function reload() {
		frame?.contentWindow?.location.reload();
	}

	onMount(() => {
    if (!frame) return;
		frame.onload = () => {
      if (!frame) return;
			if (!frame.contentDocument) return;
			const doc = frame.contentDocument;

			for (const a of doc.getElementsByTagName('a')) {
				a.onclick = (ev) => {
					ev.preventDefault();
					if ('href' in a) gotoFile(a.href);
				};
			}

			editDoc = doc;
		};
	});
</script>

<div class="w-full h-full flex flex-col gap-2">
	<button class="button stretch negative flex flex-row items-center" onclick={reload}>
		<div class="font-bold">LIVE</div>
		<div class="grow">{title}</div>
		<img class="w-5" alt="refresh" src={refreshIcon} />
	</button>

	{#if editSrcdoc}
		<iframe
			title="Live-Ansicht"
			class="rounded-large standard-shadow border-2 border-red-300 grow bg-white"
			loading="eager"
			bind:this={frame}
			srcdoc={editSrcdoc}></iframe>
	{/if}
</div>
