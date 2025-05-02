<script lang="ts">
	import { onMount } from 'svelte';
	// import * as Y from 'yjs';
	import { createCollaborativeQuillEditor } from '../../../../../e2ee-sync-library/src/index';
	// let props = $props();

	onMount(() => {
		const wrapper = document.getElementById('note')!;
		console.log(wrapper);
		const res = createCollaborativeQuillEditor(wrapper, 'MyDocSvelteNew');
		let deleteEditor: () => Promise<void> = () => {
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
