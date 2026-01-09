<script lang="ts">
	let {
		children,
		onClose = () => {}
	}: {
		children: any;
		onClose: () => void;
	} = $props();

	let dialog: HTMLDialogElement;

	export function open() {
		dialog.showModal();
	}

	export function hide() {
		dialog.close();
	}

	export function close() {
		onClose?.();
		hide();
	}
</script>

<dialog
	class="container opaque"
	bind:this={dialog}
	onclick={(ev) => {
		if (ev.target === dialog) close();
	}}>
	<div>
		{@render children?.()}
	</div>
</dialog>

<style>
	dialog {
		justify-self: center;
		align-self: center;
		max-width: calc(min(70%, 32rem));
		border-radius: 1rem;
		padding: 0;
	}
	dialog::backdrop {
		background: rgba(0, 0, 0, 0.3);
	}
	dialog > div {
		padding: 1em;
	}
	dialog[open] {
		animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes zoom {
		from {
			transform: scale(0.95);
		}
		to {
			transform: scale(1);
		}
	}
	dialog[open]::backdrop {
		animation: fade 0.2s ease-out;
	}
	@keyframes fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	button {
		display: block;
	}
</style>
