<script lang="ts">
	import { resolveToPreview, type FS, type FS_File } from '$lib/fast-fs.svelte';
	import { refreshIcon } from '$lib/icons';
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

	let fileURLBase = $derived(
		resolveToPreview(fs.getRelativeURL(editFile, true, true))
	);
	let isLive = $derived(editFile.handle.name.endsWith('.html')); // we only allow live preview for html
	let fileSrcDoc = $derived(
		isLive && editFile
			? editFile.state?.doc.replace(
					'<head>',
					`<head><base href="${fileURLBase}">`
				)
			: undefined
	);
	let relFileSrc = $derived(fs.getRelativeURL(editFile));
	let fileSrc = $derived(resolveToPreview(relFileSrc));

	let fileDoc: HTMLDocument | undefined = $state();
	let title = $derived(
		isLive && fileDoc && fileDoc.title ? fileDoc.title : fileSrc
	);

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

			fileDoc = doc;
		};
	});
</script>

<div class="w-full h-full flex flex-col gap-2">
	<button
		class="button stretch negative flex flex-row items-center"
		onclick={reload}>
		<div class="font-bold">LIVE</div>
		<div class="grow">{title}</div>
		<img class="w-5" alt="refresh" src={refreshIcon} />
	</button>

	{#if fileSrcDoc}
		<iframe
			title="Live-Ansicht"
			class="rounded-large standard-shadow border-2 border-red-300 grow bg-white"
			loading="eager"
			bind:this={frame}
			srcdoc={fileSrcDoc}></iframe>
	{/if}
</div>
