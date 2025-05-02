<script lang="ts">
	import { onMount } from 'svelte';
	// import * as Y from 'yjs';
	import { createCollaborativeQuillEditor } from '../../../../../e2ee-sync-library/src/index';
	// let props = $props(); j

	let noteElem: HTMLDivElement; // defaults to undefined

	onMount(() => {
		if (!noteElem) {
			// should not happen, since onMount should be called after noteElem is bound
			console.error('tried to initialize quill editor before binding noteElem the wrapping div');
			return;
		}

		// TODO: rework createCollaborativeQuillEditor to not be async I guess. The only async part of it is connecting to server. we could have it initialize before it has been connected (go into main yjs connection provider too)
		// tsts could it be?
		// yeah still doesn't work lol

		// const { promise, deleteEditor } = createCollaborativeQuillEditorSync(wrapper, 'MyDocSvelteNew');

		const promise = createCollaborativeQuillEditor(noteElem, 'MyDocSvelteNew');
		return async () => {
			(await promise).deleteEditor();
			console.log('deleted');
			// await deleteEditor();
		};
	});

	// TODO: allow this element to be used multiple times, without conflicting the query selector
</script>

<p>----Note:----</p>
<div bind:this={noteElem} id="note"></div>
<p>---End Note----</p>
