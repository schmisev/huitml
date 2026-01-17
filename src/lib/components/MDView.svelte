<script lang="ts">
	import { onMount, untrack } from 'svelte';
  import { marked } from 'marked';

	let {
		src,
		doc
	}: {
		src: string;
		doc: string;
	} = $props();

</script>

<div class="w-full h-full flex flex-col gap-2">
	<button
		class="button stretch negative text-center flex flex-row items-center">
		<div class="grow">{src}</div>
	</button>
	<div class="marked overflow-auto">
    {@html marked(doc)}
  </div>
</div>