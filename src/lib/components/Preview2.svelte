<script lang="ts">
	import type { FS, FS_File } from '../fast-fs.svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { PREVIEW_PREFIX } from '$lib/routing-info';
	import { eyeIcon, refreshIcon } from '$lib/icons';

	let {
		fs,
		editFile,
		previewFile,
		gotoFile
	}: {
		fs: FS;
		editFile: FS_File | undefined;
		previewFile: FS_File | undefined;
		gotoFile: (pathe: string) => void;
	} = $props();

	let frame: HTMLIFrameElement;
	let previewFrame: HTMLIFrameElement;

	let showPeek = $state(true);

	let editBase = $derived(editFile ? resolve((PREVIEW_PREFIX + fs.getRelativeURL(editFile, true, true)) as '/') : undefined);
	let live = $derived(editFile && editFile.handle.name.endsWith('.html')); // we only allow live preview for html
	let editSrcdoc = $derived((live && editFile) ? editFile.state?.doc.replace('<head>', `<head><base href="${editBase}">`) : undefined);
	let editSrc = $derived(editFile ? resolve((PREVIEW_PREFIX + fs.getRelativeURL(editFile)) as '/') : undefined);
	let previewSrc = $derived(previewFile ? resolve((PREVIEW_PREFIX + fs.getRelativeURL(previewFile)) as '/') : live ? undefined : editSrc);

	onMount(() => {
		frame.onload = () => {
			if (!frame.contentDocument) return;
			const doc = frame.contentDocument;

			for (const a of doc.getElementsByTagName('a')) {
				a.onclick = (ev) => {
					ev.preventDefault();
					if ('href' in a) gotoFile(a.href);
				};
			}
		};
	});

	export function reload() {
		frame?.contentWindow?.location.reload();
		previewFrame?.contentWindow?.location.reload();
	}
</script>

<div class="w-full h-full flex flex-col gap-2">
	<div hidden={!live} class="w-full h-full flex flex-col gap-2">
		<button class="button stretch negative flex flex-row items-center" onclick={() => frame?.contentWindow?.location.reload()}>
			<div class="font-bold">LIVE</div>
			<div class="grow">{editSrc}</div>
			<img class="w-5" src={refreshIcon} />
		</button>
		<iframe class="border-2 border-red-300 grow bg-white" loading="eager" bind:this={frame} srcdoc={editSrcdoc}></iframe>
	</div>

	<div hidden={!previewSrc} class="w-full h-full flex flex-col gap-2">
		<div class="flex flex-row gap-2">
    <button class="button stretch neutral flex flex-row items-center gap-2" onclick={() => previewFrame?.contentWindow?.location.reload()}>
			<img class="w-5" src={eyeIcon} />
			<div class="grow">{previewSrc}</div>
			<img class="w-5" src={refreshIcon} />
		</button>
    <button class="button" onclick={() => previewFrame.contentWindow?.history.back()}>{"<"}</button>
    </div>
		<iframe class="border-2 border-blue-300 grow bg-white" loading="eager" bind:this={previewFrame} src={previewSrc}></iframe>
	</div>
</div>
