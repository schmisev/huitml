<script lang="ts">
	import FileIcon from './FileIcon.svelte';
	import Modal from './Modal.svelte';

	type PromptState = {
		value?: string;
		result?: boolean;
	};

	type PromptSettings = {
		titleClass?: string;
		icon?: string;
		title?: string;
		body?: string;
		inputLabel?: string;
		inputExt?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		valuePreset?: string;
		onlyConfirm?: boolean;
		onConfirm?: (state: PromptState) => any;
		onCancel?: (state: PromptState) => any;
	};

	let modal: Modal;
	let config: PromptSettings = $state({});
	let info: PromptState = $state({
		value: ''
	});

	let resolvePromise: (value: PromptState | PromiseLike<PromptState>) => void;
	let rejectPromise: (reason?: any) => void;

	export function open(settings: PromptSettings) {
		info = {};
		config = settings;
		info.value = config.valuePreset || '';
		modal.open();
		const promise = new Promise<PromptState>((resolve, reject) => {
			resolvePromise = resolve;
			rejectPromise = reject;
		});
		return promise;
	}

	function confirm() {
		config.onConfirm?.({ ...info, result: true });
		resolvePromise({ ...info, result: true });
		modal.hide();
	}

	function cancel() {
		config.onCancel?.({ ...info, result: false });
		resolvePromise({ result: false });
		modal.hide();
	}
</script>

<Modal bind:this={modal} onClose={cancel}>
	<div class="flex flex-col gap-2">
		<div
			class="label {config.titleClass} flex flex-row gap-2 items-center justify-center">
			{#if config.icon}
				<img alt="icon" class="h-5" src={config.icon} />
			{/if}
			<div>{config.title || 'Eingabeaufforderung'}</div>
		</div>

		<div class="flex flex-col gap-1">
			<div>{@html config.body || ''}</div>
			{#if !config.onlyConfirm}
				<div
					class="container flex flex-row gap-2 flex-wrap items-center justify-items-center">
					<b>{config.inputLabel || ''}</b>
					<input
						class="input grow"
						type="text"
						bind:value={info.value}
						onchange={confirm} />
					<span>{config.inputExt || ''}</span>
				</div>
			{/if}
		</div>
		<div class="grid grid-cols-2 gap-2">
			<button class="button stretch positive" onclick={confirm}
				>{config.confirmLabel || 'OK'}</button>
			<button class="button stretch negative" onclick={cancel}
				>{config.cancelLabel || 'Abbrechen'}</button>
		</div>
	</div>
</Modal>
