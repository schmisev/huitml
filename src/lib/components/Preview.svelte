<script lang="ts">
	import { getPathToFile, openPath, type LocalFile, type LocalFolder } from '$lib/file-system';
	import { onMount } from 'svelte';

	let {
		file,
		gotoFile
	}: {
		file: LocalFile;
		gotoFile: (path: string) => void;
	} = $props();

	let base = $derived('/preview' + getPathToFile(file, true, true));
	let src = $derived(base + file.handle.name);

	let frame: HTMLIFrameElement | null = $state(null);
	let doc: HTMLDocument | null = $state(null);
  let title: string = $derived.by(() => {
    return doc?.head.title || src;
  });

	onMount(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) location.reload(); // ensure control
		if (frame) frame.src = src;
	});

	$effect(() => {
		if (!frame) return;
		frame.src = src;
		if (file.doc) frame.srcdoc = `<base href="${base}">${file.doc.txt}`;

		frame.onload = (ev) => {
			if (!frame) return;
			doc = frame.contentDocument!;
			for (const a of doc.getElementsByTagName('a')) {
				a.onclick = (ev) => {
					ev.preventDefault();
					const el = ev.target;
					if (el && 'href' in el) gotoFile(el.href as string);
				};
			}
		};
	});
</script>

<div class="w-full h-full flex flex-col gap-2">
	{#if file.blob.type.startsWith('image')}
    <div class="label">Bild-Vorschau</div>
		<img alt="Bild-Vorschau" {src} />
	{:else if file.blob.type.endsWith('css')}
    <div class="label">Style-Vorschau</div>
		<iframe
			class="grow"
      title="Style-Vorschau"
			srcdoc={`
      <style>${file.doc.txt}</style>
      <div>div-Element</div>
      <p>p-Element</p>
      <ul><li>li-element</li></ul>`}
		>
		</iframe>
	{:else}
    <div class="label">{title}</div>
		<iframe class="grow" title="Vorschau" bind:this={frame}></iframe>
	{/if}
</div>
