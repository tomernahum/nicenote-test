<script lang="ts">
	import { createYjsSyncProviderNew } from '../../../e2ee-sync-library-rewrite/src/0-interface-yjs';
	import * as Y from 'yjs';
	import { getUnsafeTestingCryptoConfig } from '../../../e2ee-sync-library-rewrite/crypto/index';
	let props = $props<{ remoteDocId: string }>();

	const yDoc = new Y.Doc();

	let connected = $state(false);

	let text = $state(yDoc.getText('quill').toString());

	yDoc.on('update', () => {
		text = yDoc.getText('quill').toString();
	});

	async function connect() {
		const remoteDocYBindingProvider = await createYjsSyncProviderNew(yDoc, {
			docId: props.remoteDocId,
			cryptoConfig: await getUnsafeTestingCryptoConfig()
		});
		remoteDocYBindingProvider.onConnected(() => {
			connected = true;
		});
		remoteDocYBindingProvider.onDisconnected(() => {
			connected = false;
		});

		return () => remoteDocYBindingProvider.disconnect();
	}
</script>

<div style="margin-top: 1rem; border: 2px solid gray; padding: 0.7rem;">
	{connected ? 'Connected' : 'Disconnected'}
	<pre id="json-display" style="overflow: scroll; max-height: 600px;">{text}</pre>
	<button
		id="refresh-button"
		onclick={() => {
			text = yDoc.getText('quill').toString();
			console.log(text);
			console.log(yDoc.getText('quill'));
		}}
	>
		Refresh
	</button>
</div>
