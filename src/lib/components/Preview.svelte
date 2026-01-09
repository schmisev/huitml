<script lang="ts">
	import { resolve } from '$app/paths';
	import { inTag } from '$lib/utils';
	import { onMount } from 'svelte';
	import type { FS, FS_File } from '../../fast-fs.svelte';
	import refreshIcon from '$lib/components/ui-icons/refresh-svgrepo-com.svg';

	let {
		file,
		fs,
		gotoFile,
		preview
	}: {
		file: FS_File;
		fs: FS;
		gotoFile: (path: string) => void;
		preview: undefined | FS_File;
	} = $props();

	let realBase = $derived(fs.getPath(file, true, true));
	let base = $derived('/preview' + realBase);
	let src = $derived(base + file.handle.name);
	let realPath = $derived(realBase + file.handle.name);
	let previewSrc = $derived('/preview' + fs.getRelativeURL(preview || file));
  let previewPath = $derived(fs.getPath(preview || file));

	let frame: HTMLIFrameElement | null = $state(null);
	let browserFrame: HTMLIFrameElement | null = $state(null);
	let doc: HTMLDocument | null = $state(null);
	let title: string = $derived.by(() => (doc && doc.title ? doc.title : realPath));
	let browseMode: boolean = $derived(!file.handle.name.endsWith('.html'));

	onMount(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) location.reload(); // ensure control
		updateFrame();
	});

	function updateFrame() {
		if (!frame) return;
		frame.src = resolve(src as '/');
		if (file.state) frame.srcdoc = `${file.state.doc}<base href="${resolve(base as '/')}">`;

		frame.onload = (ev) => {
			if (!frame) return;
			if (!frame.contentDocument) return;
			doc = frame.contentDocument;
			for (const a of doc.getElementsByTagName('a')) {
				a.onclick = (ev) => {
					ev.preventDefault();
					const el = ev.target;
					if (el && 'href' in el) gotoFile(el.href as string);
				};
			}
			console.log('finished on load!');
		};
	}

	$effect(updateFrame);

	$effect(() => {
		$state.snapshot(file.state?.cachedDoc);
		console.log('reload');
		browserFrame?.contentWindow?.location.reload();
	});
</script>

<div class="w-full h-full flex flex-col gap-2">
	<div class="flex flex-row flex-nowrap gap-2 overflow-visible">
		<button class="button neutral grow flex flex-row items-center"onclick={() => {
				frame?.contentWindow?.location.reload();
				browserFrame?.contentWindow?.location.reload();
			}}>
			<div class="flex-grow">{title}</div>
      <img class="h-5" src={refreshIcon} />
    </button>
	</div>
	<iframe
		hidden={!browseMode}
		class="grow bg-white border-2 border-blue-300 rounded-md"
		title="Browser"
		bind:this={browserFrame}
		src={resolve(previewSrc as '/')}></iframe>
	<iframe hidden={browseMode} class="grow bg-white border-2 border-gray-300 rounded-md" title="Vorschau" bind:this={frame}></iframe>
</div>
