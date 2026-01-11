<script lang="ts">
	import { resolveToPreview, type FS, type FS_File } from '$lib/fast-fs.svelte';
	import { eyeIcon, homeIcon, refreshIcon, undoIcon, xIcon } from '$lib/icons';
	import { onMount } from 'svelte';

	let {
		fs,
		previewFile,
    onClose,
	}: {
		fs: FS;
		previewFile: FS_File;
    onClose: () => void;
	} = $props();

	let previewSrc = $derived(resolveToPreview(fs.getRelativeURL(previewFile)));
	let previewFrame: HTMLIFrameElement;

	let previewDoc: HTMLDocument | undefined = $state();
	let title = $derived(
		previewDoc && previewDoc.title ? previewDoc.title : previewSrc
	);

	export function reload() {
		previewFrame?.contentWindow?.location.reload();
	}

	onMount(() => {
		previewFrame.onload = () => {
			if (!previewFrame.contentDocument) return;
			previewDoc = previewFrame.contentDocument;
		};
	});
</script>

<div class="w-full h-full flex flex-col gap-2">
	<div class="flex flex-row gap-2">
		<button
			title="Zurück"
			class="button"
			onclick={() => previewFrame.contentWindow?.history.back()}>
			<img alt="back" class="w-5" src={undoIcon} />
		</button>
		<button
			title="Start"
			class="button"
			onclick={() => (previewFrame.src = previewSrc)}>
			<img alt="home" class="w-5" src={homeIcon} />
		</button>

    <button
			class="button stretch neutral flex flex-row items-center gap-2"
			onclick={reload}>
			<img class="w-5" alt="peek" src={eyeIcon} />
			<div class="grow">{title}</div>
			<img class="w-5" alt="refresh" src={refreshIcon} />
		</button>
		
    <button
			title="Schließen"
			class="button"
			onclick={onClose}>
			<img alt="home" class="w-5" src={xIcon} />
		</button>
	</div>
	<iframe
		title="Browser"
		class="rounded-large standard-shadow border-2 border-blue-300 grow bg-white"
		loading="eager"
		bind:this={previewFrame}
		src={previewSrc}></iframe>
</div>
