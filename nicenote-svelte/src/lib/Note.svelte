<script lang="ts">
	import { onMount } from 'svelte';
	import { createCollaborativeQuillEditor } from '../../../../../e2ee-sync-library/src/index';
	import 'quill/dist/quill.snow.css';
	import { initializeQuillEditor } from './Note';

	let props = $props<{ remoteDocId: string }>();

	let noteElem: HTMLDivElement; // defaults to undefined

	onMount(() => {
		if (!noteElem) {
			// should not happen, since onMount should be called after noteElem is bound
			console.error('tried to initialize quill editor before binding noteElem the wrapping div');
			return;
		}

		const promise = createCollaborativeQuillEditor(
			noteElem,
			props.remoteDocId,
			initializeQuillEditor
		);

		promise.then((editor) => {
			//
			editor.yDoc;
		});
		return async () => {
			(await promise).deleteEditor();
			console.log('deleted');
		};
	});

	// TODO: check official way to have multiple quills in one page
	// then also catch enter key
	// and in my app maybe make multiple yDocs be able to go into one server-seen doc (for privacy) (maybe subdocId)
</script>

<!-- <p>----Note:----</p> -->
<div bind:this={noteElem} id="note" style="overflow: visible;"></div>
<!-- <p>---End Note----</p> -->
