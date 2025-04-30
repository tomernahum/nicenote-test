<script lang="ts">
	// TODO: set up proper monorepo tooling
	import {
		createRemoteDocProvider,
		getNonSecretHardCodedKeyForTestingSymmetricEncryption
	} from '../../../../../e2ee-sync-library/src/index';
	import * as Y from 'yjs';

	const x = $state(1);
	const allNotes = null;
	const yDoc = new Y.Doc();

	// const remoteDocProvider = createRemoteDocProvider(yDoc, {
	// 	remoteDocId: 'test',
	// 	mergeInitialState: true,
	// 	encryptionParams: {
	// 		mainKey: getNonSecretHardCodedKeyForTestingSymmetricEncryption(),
	// 		validOldKeys: [],
	// 		// WIP
	// 		useWriteSignaturesForClients: false,
	// 		useWriteSignaturesForServer: false
	// 	}
	// });

	yDoc.getText('text').insert(0, 'Hello Yjs!');
	const yText = $derived(yDoc.getText('text'));
</script>

<div class="h-full w-full rounded-xl bg-amber-200 p-2">
	<h3>Recent Notes</h3>
	<ul>
		<li>1</li>
		<li>2</li>
	</ul>

	<br />
	<h3>{yText.toString()}</h3>
</div>

<style>
</style>
