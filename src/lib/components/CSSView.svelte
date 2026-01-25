<script lang="ts">
	import { onMount, untrack } from 'svelte';

	let {
		src,
		doc
	}: {
		src: string;
		doc: string;
	} = $props();

	let sheet = new CSSStyleSheet();
	let rules: CSSStyleRule[] = $state([]);

	$effect(() => {
		if (!sheet) return;
		sheet.replaceSync(doc);

		untrack(() => {
			rules = [];
			for (let i = 0; i < sheet.cssRules.length; i++) {
				rules.push(sheet.cssRules[i] as CSSStyleRule);
			}
		});
	});
</script>

<div class="w-full h-full flex flex-col gap-2">
	<button
		class="button stretch negative text-center flex flex-row items-center">
		<div class="grow">{src}</div>
	</button>
	<div
		class="h-full min-h-0 overflow-auto rounded-large standard-shadow border-2 border-red-300 grow bg-white flex flex-col gap-2 p-2">
		{#each rules as rule}
			<div style={rule.style.cssText}>
				{rule.selectorText}
			</div>
		{/each}
	</div>
</div>
