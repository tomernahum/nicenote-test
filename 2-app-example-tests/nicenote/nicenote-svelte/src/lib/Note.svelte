<script lang="ts">
	import { onMount } from 'svelte';
	// import * as Y from 'yjs';
	import { createCollaborativeQuillEditor } from '../../../../../e2ee-sync-library/src/index';
	// let props = $props(); j

	onMount(() => {
		const wrapper = document.getElementById('note')!;

		// TODO: rework createCollaborativeQuillEditor to not be async I guess. The only async part of it is connecting to server. we could have it initialize before it has been connected (go into main yjs connection provider too)

		const res = createCollaborativeQuillEditor(wrapper, 'MyDocSvelteNew');
		let deleteEditor: () => Promise<void> = () => {
			console.error('svelte tried to delete editor before it was initialized');
			return Promise.reject(new Error('deleteEditor not initialized'));
		};
		res.then((res) => {
			deleteEditor = res.deleteEditor;
		});
		return deleteEditor;
	});
</script>

<div id="note"></div>

<p>Hello Note</p>
