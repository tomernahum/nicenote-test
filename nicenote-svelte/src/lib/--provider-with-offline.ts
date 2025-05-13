import * as Y from 'yjs';
import {
	createBaseYjsProvider,
	createYjsSyncProvider,
	yjsPUpdateEncoder
} from '../../../e2ee-sync-library-rewrite/src/0-interface-yjs';
import { getInsecureCryptoConfigForTesting } from '../../../e2ee-sync-library-rewrite/src/2-crypto-factory';
import { createCrdtSyncProvider } from '../../../e2ee-sync-library-rewrite/src/0-provider';
import { tryCatch2 } from '../../../e2ee-sync-library-rewrite/src/-utils';

// Demo / brainstorm. will rewrite

async function startUpDoc(docId: string) {
	const onlineModeDoc = createBaseYjsProvider(new Y.Doc());
	const offlineModeDoc = createBaseYjsProvider(new Y.Doc());

	function setupOfflineModeDoc() {
		// // make sure offlineDocCache is subscribed to updates from the offline doc memory
		// offlineModeDoc.subscribeToLocalUpdates((update) => {
		// 	// cache the offline doc state
		// 	localStorage.setItem(`doc-cache-${docId}`, JSON.stringify(offlineModeDoc.getSnapshot()));
		// });
	}

	let mode = 'connecting';
	const [remoteProvider, error] = await tryCatch2(
		createCrdtSyncProvider(onlineModeDoc, yjsPUpdateEncoder(), {
			remoteDocId: docId,
			cryptoConfig: await getInsecureCryptoConfigForTesting(),
			mergeInitialState: true
		})
	);
	if (error) {
		// start up in offline mode
		mode = 'offline';
		const cachedOfflineDoc = localStorage.getItem(`doc-cache-${docId}`);
		if (!cachedOfflineDoc) {
			// keep offline doc empty
		} else {
			// load the cached offline doc state into the in-memory offline doc
			offlineModeDoc.applyRemoteUpdates(JSON.parse(cachedOfflineDoc));
		}
		// make sure offlineDocCache is subscribed to updates from the offline doc memory
		offlineModeDoc.subscribeToLocalUpdates((update) => {
			// cache the offline doc state
			localStorage.setItem(`doc-cache-${docId}`, JSON.stringify(offlineModeDoc.getSnapshot()));
		});
	} else {
		// start up in online mode
		mode = 'online';

		// onlineModeDoc is already connected.

		// make sure offlineModeDoc kept in sync with the authoritative online doc
		// could alternatively only copy it over when the connection is lost
		onlineModeDoc.yDoc.on('update', (update) => {
			Y.applyUpdate(offlineModeDoc.yDoc, update, 'online mode sync');
			// this will trigger this code above:
			// localStorage.setItem(`doc-cache-${docId}`, JSON.stringify(onlineModeDoc.getSnapshot()));
		});

		remoteProvider.on('lost connection', () => {
			// time to go into offline mode
			mode = 'offline';
			// offline doc is already up to date with latest online doc

			remoteProvider.on('reconnected', () => {
				// go back into online mode, or go into online-and-offline mode to merge manually
				mode = 'online-and-offline';

				clearListeners;
			});
		});
	}
}

let mode = 'online' as 'online' | 'offline';

const onlineModeYDoc = createBaseYjsProvider(new Y.Doc());
const remoteDocYBindingProvider = await createCrdtSyncProvider(
	onlineModeYDoc,
	yjsPUpdateEncoder(),
	{
		remoteDocId: DOC_ID,
		cryptoConfig: await getInsecureCryptoConfigForTesting(),
		mergeInitialState: true
		// mergeInitialState: false
	}
);

const offlineModeYDoc = createBaseYjsProvider(new Y.Doc());
remoteDocYBindingProvider.on('lost connection', () => {
	offlineModeYDoc.applyRemoteUpdates(onlineModeYDoc.getSnapshot());
	mode = 'offline';
});
remoteDocYBindingProvider.on('reconnected', () => {
	// merge in any updates that occurred while offline
});
