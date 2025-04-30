<script lang="ts">
	import Quill from 'quill';
	import { QuillBinding } from 'y-quill';
	import QuillCursors from 'quill-cursors';
	import * as Y from 'yjs';
	import {
		createRemoteDocProvider,
		getNonSecretHardCodedKeyForTestingSymmetricEncryption
	} from '../../../../../e2ee-sync-library/src/index';

	import 'quill/dist/quill.snow.css';
	import { getRandomAnimal, getRandomColor } from './utils';
	import { onMount } from 'svelte';
	function createQuillEditor(element: HTMLElement | string) {
		const toolbar3 = [
			// Font selection
			[{ font: [] }],

			// Header formatting (H1 to H6, plus normal text)
			// [{ header: [1, 2, 3, 4, 5, 6, false] }],

			// Font size (this might need a corresponding CSS configuration)
			[{ size: ['small', false, 'large', 'huge'] }],
			// [{ size: ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '36px'] }],

			// Basic text formatting: Bold, Italic, Underline, Strike through.
			['bold', 'italic', 'underline', 'strike'],

			['link', 'formula'],

			// Subscript and superscript.
			[{ script: 'sub' }, { script: 'super' }],

			// Block formatting: Code Block and Blockquote.
			['blockquote', 'code-block'],

			// Color and background color pickers.
			[{ color: [] }, { background: [] }],

			// List options: Ordered and bullet lists.
			[{ list: 'ordered' }, { list: 'bullet' }],

			// Outdent and Indent.
			[{ indent: '-1' }, { indent: '+1' }],

			// Text alignment options.
			[{ align: [] }],

			// Media embeds: Link, Image, Video, Formula.
			// ["link", "image", "video", "formula"],
			['image', 'video'],

			// Clear formatting.
			['clean']

			// (Optional) Custom item example: Adding a horizontal rule.
			// You would need to implement a custom handler for this option.
			// [{ // This is a custom group that you can tie to a custom handler.
			//   handler: "insertHorizontalRule"
			// }],
		];
		const quillEditor = new Quill(element, {
			modules: {
				cursors: true,
				// cursors: {
				//     transformOnTextChange: true,
				// },
				toolbar: toolbar3,
				history: {
					// Local undo shouldn't undo changes
					// from remote users
					userOnly: true
				}
			},
			placeholder: 'Start collaborating...',
			theme: 'snow' // or 'bubble'
		});
		return quillEditor;
	}
	async function createEditor(element: HTMLElement | string, remoteDocId: string) {
		const yDoc = new Y.Doc();
		const yType = yDoc.getText('quill');

		// using our local-provider provider
		const yBindingProvider = await createRemoteDocProvider(yDoc, {
			remoteDocId,
			mergeInitialState: true,
			encryptionParams: {
				mainKey: await getNonSecretHardCodedKeyForTestingSymmetricEncryption(),
				validOldKeys: []
			}
		}).catch((error) => {
			console.error('App: Failed to create remote doc provider!', error);
			if (error instanceof Error) {
				if (error.message.includes('connect failed')) {
					alert('sorry you may be offline');
				}
			}
			throw error;
		});

		// Specify awareness information for local user to integrate with quill-cursors
		yBindingProvider.awareness.setLocalStateField('user', {
			name: `anonymous ${getRandomAnimal()}`,
			color: getRandomColor()
		});

		const quillEditor = createQuillEditor(element);
		const quillBinding = new QuillBinding(yType, quillEditor, yBindingProvider.awareness);

		return { yDoc, yType, quillEditor, quillBinding, yBindingProvider };
	}

	$effect(() => {
		const editorStuff = createEditor('#editor1', 'svelte-doc-1');
		return () => {
			editorStuff.then((stuff) => {
				stuff.yBindingProvider.disconnect();
				stuff.quillBinding.destroy();
			});
		};
	});
</script>

<div id="editor1"></div>
