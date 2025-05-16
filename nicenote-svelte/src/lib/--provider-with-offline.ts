import * as Y from 'yjs';
import {
	createBaseYjsProvider,
	createYjsSyncProvider,
	yjsPUpdateEncoder
} from '../../../e2ee-sync-library-rewrite/src/0-interface-yjs';
import { getInsecureCryptoConfigForTesting } from '../../../e2ee-sync-library-rewrite/src/2-crypto-factory';
import {
	createCrdtSyncProvider,
	type localCrdtInterface
} from '../../../e2ee-sync-library-rewrite/src/0-provider';
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

async function createDoc(docId: string) {
	// start up offline doc
}

type StorageEncoder<CRDTUpdate> = {
	encodeStorage: (updates: CRDTUpdate[]) => string;
	decodeStorage: (updates: string) => CRDTUpdate[];
};

// offline counterpart of createCrdtSyncProvider.   Actually maybe we could reuse it and replace the server interface. but WET
function createOfflineDoc<CRDTUpdate>(
	localCrdtInterface: localCrdtInterface<CRDTUpdate>, // maybe used to subscribe to updates?
	storageEncoder: StorageEncoder<CRDTUpdate>,
	params: {
		docId: string;
		//NOTE: initial state is always merged... you should probably all this with an empty initial state CRDT
	}
) {
	const storageInterface = ((docId: string) => ({
		// Localstorage. Likely to be replaced with another storage system

		/** store the doc, overwriting any existing doc */
		store: (state: CRDTUpdate[]) => {
			const encoded = storageEncoder.encodeStorage(state);
			localStorage.setItem(`doc-cache-${docId}`, encoded);
		},

		/** load doc (as CRDTUpdates). If there is no doc, return an empty array */ // should it indicate more clearly a difference instead?
		load: () => {
			const encoded = localStorage.getItem(`doc-cache-${docId}`);
			if (!encoded) {
				return [];
			}
			return storageEncoder.decodeStorage(encoded);
		},

		/** make sure storage interface is available */
		connect: () => {
			localStorage.setItem(`pinging-ls-121212`, 'ping');
			if (localStorage.getItem(`pinging-ls-121212`) !== 'ping') {
				throw new Error('Could not connect to localStorage');
			}
			localStorage.removeItem(`pinging-ls-121212`);
			return;
		}
	}))(params.docId);

	// connect / make sure its available. will throw otherwise
	storageInterface.connect();

	// load the doc from storage
	const initialStoredDocUpdates = storageInterface.load();
	localCrdtInterface.applyRemoteUpdates(initialStoredDocUpdates);

	// merge the initial state into the local CRDT. always doing this because it will get merged later anyways
	storageInterface.store(localCrdtInterface.getSnapshot());

	// subscribe to local updates and save them to storage
	localCrdtInterface.subscribeToLocalUpdates((update) => {
		storageInterface.store(localCrdtInterface.getSnapshot());
	});

	// listen for updates to the storage that were not triggered by this instance
	// TODO: can do polling, replace localstorage with dexie/similar, but what I really want is to (optionally?) back it with (one of) the filesystem apis, which I will look into later.

	return {};
}
