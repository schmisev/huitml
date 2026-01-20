<script lang="ts">
	import {
		AnyIcon,
		CSSIcon,
		FolderIcon,
		HTMLIcon,
		JavascriptIcon,
		JPGIcon,
		MP3Icon,
		PNGIcon,
		RootIcon
	} from '$lib/icons';
	import type { FS_Entry } from '$lib/fast-fs.svelte';

	let {
		file,
		ext,
    size = 5
	}: {
		file?: FS_Entry;
		ext?: string;
    size?: number;
	} = $props();

	let useName = $derived(ext ? ext : file ? file.handle.name : '');
	let icon = $derived.by(() => {
		if (file && file.kind === 'dir') {
			if (file.parent) {
				return FolderIcon;
			} else {
				return RootIcon;
			}
		} else {
			if (useName === 'dir') return FolderIcon;
			if (useName.endsWith('.html')) return HTMLIcon;
			else if (useName.endsWith('.css')) return CSSIcon;
      else if (useName.endsWith('.js')) return JavascriptIcon;
			else if (useName.endsWith('.jpg')) return JPGIcon;
			else if (useName.endsWith('.webp')) return JPGIcon;
			else if (useName.endsWith('.png')) return PNGIcon;
			else if (useName.endsWith('.mp3')) return MP3Icon;
			else return AnyIcon;
		}
	});
</script>

<img class="w-{size} h-{size}" alt="📄" src={icon} />

<style>
	img {
		filter: drop-shadow(0.1rem 0.1rem 0.1rem rgba(0, 0, 0, 0.4));
	}
</style>
