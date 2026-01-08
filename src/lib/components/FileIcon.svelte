<script lang="ts">
	import CSSIcon from '$lib/components/file-icons/css.svg';
	import CSVIcon from '$lib/components/file-icons/csv.svg';
	import HTMLIcon from '$lib/components/file-icons/html.svg';
	import JavascriptIcon from '$lib/components/file-icons/javascript.svg';
	import JPGIcon from '$lib/components/file-icons/jpg.svg';
	import MP3Icon from '$lib/components/file-icons/mp3.svg';
	import PNGIcon from '$lib/components/file-icons/png.svg';
	import TXTIcon from '$lib/components/file-icons/txt.svg';
	import ZIPIcon from '$lib/components/file-icons/zip.svg';
	import AnyIcon from '$lib/components/file-icons/file.svg';
	import FolderIcon from '$lib/components/file-icons/folder.svg';
	import RootIcon from '$lib/components/file-icons/folder-2.svg';

	import type { FS_Entry, FS_File } from '../../fast-fs.svelte';
	import { onMount } from 'svelte';

	let {
		file,
		ext
	}: {
		file?: FS_Entry;
		ext?: string;
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
      if (useName === "dir") return FolderIcon;
			if (useName.endsWith('html')) return HTMLIcon;
			else if (useName.endsWith('css')) return CSSIcon;
		  else if (useName.endsWith('jpg')) return JPGIcon;
			else if (useName.endsWith('png')) return PNGIcon;
			else if (useName.endsWith('mp3')) return MP3Icon;
      else return AnyIcon;
		}
	});
</script>

<img class="h-5" alt="📄" src={icon} />

<style>
	img {
		filter: drop-shadow(0.1rem 0.1rem 0.1rem rgba(0, 0, 0, 0.4));
	}
</style>
