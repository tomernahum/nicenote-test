<script lang="ts">
	import { onMount } from 'svelte';
	// import { createSyncedYDocProviderDemo } from '../../../e2ee-sync-library-rewrite/src/0-interface-yjs';
	import { createDemoYjsSyncProviderNewB } from '../../../e2ee-sync-library-rewrite/src/provider-B/create-y-provider';

	// import { getUnsafeTestingEncryptionKey } from '../../../e2ee-sync-library-rewrite/src/2-crypto-factory';
	import {
		generateSigningKeyPair,
		getUnsafeTestingCryptoConfig
	} from '../../../e2ee-sync-library-rewrite/crypto/index';
	import Quill from 'quill';
	import QuillCursors from 'quill-cursors';
	import * as Y from 'yjs';
	import { getRandomAnimal, getRandomColor } from '../../../e2ee-sync-library/src';
	import { QuillBinding } from 'y-quill';
	import 'quill/dist/quill.bubble.css';
	import 'quill/dist/quill.snow.css';

	function initializeQuillEditor(element: HTMLElement | string) {
		const QUILL_TOOLBAR = [
			[{ font: [] }],
			[{ size: ['small', false, 'large', 'huge'] }],
			// [{ size: ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '36px'] }],
			['bold', 'italic', 'underline', 'strike'],
			['link', 'formula'],
			[{ script: 'sub' }, { script: 'super' }],
			['blockquote', 'code-block'],
			[{ color: [] }, { background: [] }],
			[{ list: 'ordered' }, { list: 'bullet' }],
			[{ indent: '-1' }, { indent: '+1' }],
			[{ align: [] }],
			['image', 'video'],
			['clean']
		];
		// TODO: don't rerun this if already registered
		Quill.register('modules/cursors', QuillCursors);

		const quillEditor = new Quill(element, {
			modules: {
				cursors: true,
				// cursors: {
				//     transformOnTextChange: true,
				// },
				toolbar: QUILL_TOOLBAR,
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
	async function createCollaborativeQuillEditor(params: {
		domElement: HTMLElement | string;
		remoteDocId: string;
	}) {
		const { domElement, remoteDocId } = params;
		const realDomElement =
			domElement instanceof HTMLElement ? domElement : document.querySelector(domElement)!;
		const quillWrapperElem = document.createElement('div');
		quillWrapperElem.style.overflow = 'visible';
		realDomElement.appendChild(quillWrapperElem);

		const yDoc = new Y.Doc();
		const yType = yDoc.getText('quill');

		// using our local-provider provider

		// const remoteDocYBindingProvider = await createSyncedYDocProviderDemo(yDoc, {
		// 	remoteDocId
		// }).catch((error) => {
		// 	console.error('App: Failed to create remote doc provider!', error);
		// 	if (error instanceof Error) {
		// 		if (error.message.includes('connect failed')) {
		// 			// onConnectError(error);
		// 		}
		// 	}
		// 	throw error;
		// });

		// old way
		// const remoteDocYBindingProvider = await createYjsSyncProvider(yDoc, {
		// 	remoteDocId,
		// 	cryptoConfig: await getUnsafeTestingCryptoConfig(),
		// 	mergeInitialState: true
		// 	// mergeInitialState: false
		// });
		const remoteDocYBindingProvider = await createDemoYjsSyncProviderNewB(yDoc);

		// const remoteDocYBindingProvider = await createProvider();

		// Specify awareness information for local user to integrate with quill-cursors
		remoteDocYBindingProvider.awareness.setLocalStateField('user', {
			name: `anonymous ${getRandomAnimal()}`,
			color: getRandomColor()
		});

		const quillEditor = initializeQuillEditor(quillWrapperElem);
		const quillBinding = new QuillBinding(yType, quillEditor, remoteDocYBindingProvider.awareness);

		async function deleteEditor() {
			await remoteDocYBindingProvider.disconnect();
			yDoc.destroy();

			// remove the dom element. Needs to be parent of the quillEditor container because the quill toolbars module is added next to the main quillEditor container
			// const realElement = domElement instanceof HTMLElement ? domElement : document.querySelector(domElement)
			const quillWrapperElem = quillEditor.container.parentElement;
			quillWrapperElem?.remove();
		}
		return {
			yDoc,
			yType,
			quillEditor,
			quillBinding,
			yBindingProvider: remoteDocYBindingProvider,
			deleteEditor
		};
	}

	// async function createFastLoadingCollaborativeQuillEditor(params: {
	// 	domElement: HTMLElement | string;
	// 	remoteDocId: string;
	// }) {
	// 	const { domElement, remoteDocId } = params;
	// 	const realDomElement =
	// 		domElement instanceof HTMLElement ? domElement : document.querySelector(domElement)!;
	// 	const quillWrapperElem = document.createElement('div');
	// 	quillWrapperElem.style.overflow = 'visible';
	// 	realDomElement.appendChild(quillWrapperElem);

	// 	const yDoc = new Y.Doc();
	// 	const yType = yDoc.getText('quill');

	// 	const quillEditor = initializeQuillEditor(quillWrapperElem);
	// 	let quillBinding: QuillBinding;

	// 	async function connectToOnline() {
	// 		const remoteDocYBindingProvider = await createYjsSyncProvider(yDoc, {
	// 			remoteDocId,
	// 			cryptoConfig: await getUnsafeTestingEncryptionKey(),
	// 			mergeInitialState: true
	// 		});

	// 		// Specify awareness information for local user to integrate with quill-cursors
	// 		remoteDocYBindingProvider.awareness.setLocalStateField('user', {
	// 			name: `anonymous ${getRandomAnimal()}`,
	// 			color: getRandomColor()
	// 		});

	// 		quillBinding = new QuillBinding(yType, quillEditor, remoteDocYBindingProvider.awareness);

	// 		return remoteDocYBindingProvider;
	// 	}
	// 	const remoteDocYBindingProvider = connectToOnline();

	// 	async function deleteEditor() {
	// 		await (await remoteDocYBindingProvider).disconnect();
	// 		yDoc.destroy();

	// 		// remove the dom element. Needs to be parent of the quillEditor container because the quill toolbars module is added next to the main quillEditor container
	// 		// const realElement = domElement instanceof HTMLElement ? domElement : document.querySelector(domElement)
	// 		const quillWrapperElem = quillEditor.container.parentElement;
	// 		quillWrapperElem?.remove();
	// 	}
	// 	return {
	// 		yDoc,
	// 		yType,
	// 		quillEditor,
	// 		quillBinding: () => quillBinding,
	// 		yBindingProvider: remoteDocYBindingProvider,
	// 		deleteEditor
	// 	};
	// }

	const REMOTE_DOC_ID = 'EFGHI';

	let noteElem: HTMLDivElement; // defaults to undefined

	let editor: Awaited<ReturnType<typeof createCollaborativeQuillEditor>>;
	onMount(() => {
		// should not happen, since onMount should be called after noteElem is bound
		if (!noteElem) {
			console.error('tried to initialize quill editor before binding noteElem the wrapping div');
			return;
		}

		// we may want to use something other than quill (like prosemirror) for the final app
		const promise = createCollaborativeQuillEditor({
			domElement: noteElem,
			remoteDocId: REMOTE_DOC_ID
		});
		promise.then((res) => {
			editor = res;
			editor.yBindingProvider.onConnected(() => {
				console.log('CONNECTED');
			});
			editor.yBindingProvider.onDisconnected(() => {
				alert('DISCONNECTED');
				console.log('DISCONNECTED');
			});
		});
		return async () => {
			(await promise).deleteEditor();
			console.log('deleted');
		};
	});
	//NOTE / TODO maybe this isn't ideal: on mount we reconnect to the doc, including downloading all it's history, and onUnMount we disconnect entirely. so if it rerenders we refetch the history. probably would rather keep it around locally even if the component is unmounted. hopefully we can do this without adapting the api
</script>

<p>DocDemo</p>
<button
	on:click={async () => {
		editor.yBindingProvider.changeCryptoConfig(async (cryptoConfig) => {
			console.log('Started using bad signing key', { prevConfig: cryptoConfig });
			return {
				...cryptoConfig,
				signingMode: 'skip',
				signingKey: (await generateSigningKeyPair()).privateKey
				// encryptionKey: await generateSymmetricEncryptionKey()
			};
		});
	}}
>
	start using bad signing key
	<!-- Not rejecting!! TODO -->
</button>

<button
	on:click={async () => {
		editor.yBindingProvider.changeCryptoConfig(async (cryptoConfig) => {
			return {
				...cryptoConfig,
				signingMode: 'reader',
				mainVerifyingKey: cryptoConfig.mainEncryptionKey
			};
		});
	}}
>
	become read onlyer</button
>

<!-- <button> Stop with the minimum updates</button> -->
<!-- <button on:click={() => console.log(editor.yDoc)}> Log yDoc</button> -->
<button on:click={() => console.log(editor.yDoc.getText('quill').toString())}>Log yDoc</button>

<div bind:this={noteElem} id="note" style="overflow: visible;"></div>

<!-- 
<DocDebugDisplay remoteDocId={REMOTE_DOC_ID} /> -->

<!-- <pre style="overflow: scroll; max-height: 600px;">{editor.yDoc.getText('quill').toString()}</pre> -->

<style>
	:global(.ql-bubble .ql-tooltip) {
		z-index: 9999;
		pointer-events: auto;
	}
</style>
