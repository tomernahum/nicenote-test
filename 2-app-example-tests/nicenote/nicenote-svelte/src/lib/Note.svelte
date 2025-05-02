<script lang="ts">
	import { onMount } from 'svelte';
	import { createCollaborativeQuillEditor } from '../../../../../e2ee-sync-library/src/index';
	import 'quill/dist/quill.snow.css';
	// let props = $props();

	let noteElem: HTMLDivElement; // defaults to undefined

	onMount(() => {
		if (!noteElem) {
			// should not happen, since onMount should be called after noteElem is bound
			console.error('tried to initialize quill editor before binding noteElem the wrapping div');
			return;
		}

		const promise = createCollaborativeQuillEditor(noteElem, 'MyDocSvelteNew');
		return async () => {
			(await promise).deleteEditor();
			console.log('deleted');
		};
	});

	// TODO: allow this element to be used multiple times, without conflicting the query selector
</script>

<p>----Note:----</p>
<div bind:this={noteElem} id="note"></div>
<p>---End Note----</p>
