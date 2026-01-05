<script lang="ts">
	import { resolve } from '$app/paths';
	import { getPathToFile, openPath, type LocalFile, type LocalFolder } from '$lib/file-system';
	import { inTag } from '$lib/utils';
	import { onMount } from 'svelte';

	let {
		file,
		gotoFile
	}: {
		file: LocalFile;
		gotoFile: (path: string) => void;
	} = $props();

  let realBase = $derived(getPathToFile(file, true, true))
	let base = $derived('/preview' + realBase);
	let src = $derived(base + file.handle.name);
  let realPath = $derived(realBase + file.handle.name);

	let frame: HTMLIFrameElement | null = $state(null);
	let doc: HTMLDocument | null = $state(null);
  let title: string = $derived.by(() => doc && doc.title ? doc.title : realPath);

	onMount(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) location.reload(); // ensure control
		if (frame) frame.src = src;
	});

	$effect(() => {
		if (!frame) return;
		frame.src = resolve(src as "/");
		if (file.doc) frame.srcdoc = `<base href="${resolve(base as "/")}">${file.doc.txt}`;

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
			srcdoc={
`<html>
  <head>
    <title>Style-Vorschau</title>
  </head>
  <body>
    <style>
      ${file.doc.txt}
    </style>
    <h1>&lt;h1&gt; Dies ist die größte Überschrift &lt;/h1&gt;</h1>
    <h2>&lt;h2&gt; Dies ist eine Überschrift &lt;/h2&gt;</h2>
    <h3>&lt;h3&gt; Und noch eine &lt;/h3&gt;</h3>
    <h4>&lt;h4&gt; Und noch eine kleinere &lt;/h4&gt;</h4>
    <h5>&lt;h5&gt; Immer kleiner &lt;/h5&gt;</h5>
    <h6>&lt;h6&gt; Und kleiner &lt;/h6&gt;</h6>
    <div>
      Dies ist ein &lt;div&gt;-Element
      <div>Und das ist ein &lt;div&gt; im &lt;div&gt;.</div>
    </div>
    <p>Dies ist ein &lt;p&gt;-Element (Paragraph) mit...
    <ul>
      <li>${inTag("u", "unterstrichenem")}</li>
      <li>${inTag("b", "fettem")}</li>
      <li>${inTag("i", "kursivem")}</li>
      <li>${inTag("s", "durchgestrichenem")}</li>
      <li>${inTag("sub", "tiefgestellten")}</li>
      <li>${inTag("sup", "hochgestellten")}</li>
    </ul>
    ... Text in einer ungeordneten Liste (&lt;ul&gt;).
    <p>Und noch eins, mit etwas mehr Text: Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.</p>
    <figure>
      <img style="width: 100%" src="https://www.windowslatest.com/wp-content/uploads/2024/10/Windows-XP-Bliss-Wallpaper-4K-1068x712.jpg">      
      <figcaption>Hier ist ein Bild in einem &lt;img&gt;-Tag - in einem &lt;figure&gt;-Tag.</figcaption>
    </figure>
  </body>
</html>`}
		>
		</iframe>
	{:else}
    <div class="label">{title}</div>
		<iframe class="grow" title="Vorschau" bind:this={frame}></iframe>
	{/if}
</div>
