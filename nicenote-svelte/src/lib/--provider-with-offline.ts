import * as Y from 'yjs';
import {
	createBaseYjsProvider,
	createYjsSyncProvider,
	yjsPUpdateEncoder
} from '../../../e2ee-sync-library-rewrite/src/0-interface-yjs';
import {
	createEncodingLogic,
	getInsecureCryptoConfigForTesting
} from '../../../e2ee-sync-library-rewrite/src/2-crypto-factory';
import {
	createCrdtSyncProvider,
	type CRDTUpdateEncoder,
	type localCrdtInterface
} from '../../../e2ee-sync-library-rewrite/src/0-provider';
import { tryCatch2 } from '../../../e2ee-sync-library-rewrite/src/-utils';
import type { ClientUpdate } from '../../../e2ee-sync-library-rewrite/src/-types';

// Demo / brainstorm. will rewrite

async function startUpDocBrainStorm(docId: string) {
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

type StorageInterface = {
	/** store the doc, overwriting any existing doc */
	store: (state: ClientUpdate[]) => void;

	/** load doc (as CRDTUpdates). If there is no doc, return an empty array */ // should it indicate more clearly a difference instead?
	load: () => ClientUpdate[];

	/** make sure storage interface is available */
	connect: () => void;
};

function createLocalStorageInterface(docId: string) {
	const { encodeMultipleUpdatesAsOne, decodeMultiUpdate } = createEncodingLogic();
	// copied from some old code
	function base64Encode(bytes: Uint8Array | ArrayBuffer) {
		const realBytes = 'buffer' in bytes ? bytes : new Uint8Array(bytes);

		const binString = Array.from(realBytes, (x) => String.fromCodePoint(x)).join('');
		return btoa(binString);
	}
	function base64Decode(base64: string) {
		const binString = atob(base64);
		return Uint8Array.from(binString, (m) => m.codePointAt(0) as number);
	}

	return {
		/** store the doc, overwriting any existing doc */
		store: (state: ClientUpdate[]) => {
			const encodedForStorage = base64Encode(encodeMultipleUpdatesAsOne(state));
			// todo: maybe some encryption at rest
			localStorage.setItem(`doc-cache-${docId}`, encodedForStorage);
		},

		/** load doc (as CRDTUpdates). If there is no doc, return an empty array */ // should it indicate more clearly a difference instead?
		load: () => {
			const storageResult = localStorage.getItem(`doc-cache-${docId}`);
			if (!storageResult) {
				return [];
			}
			// todo: maybe some encryption at rest
			return decodeMultiUpdate(base64Decode(storageResult));
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
	} satisfies StorageInterface;
}

// offline counterpart of createCrdtSyncProvider.   Actually maybe we could reuse it and replace the server interface. but WET
function createOfflineDocProvider<CRDTUpdate>(
	localCrdtInterface: localCrdtInterface<CRDTUpdate>, // maybe used to subscribe to updates?
	storageInterface: StorageInterface,
	localCrdtUpdateEncoder: CRDTUpdateEncoder<CRDTUpdate>
	//NOTE: initial state is always merged... you should probably all this with an empty initial state CRDT
) {
	const codec = localCrdtUpdateEncoder;
	// connect / make sure its available. will throw otherwise
	storageInterface.connect();

	// load the doc from storage
	const initialStoredDocUpdates = storageInterface.load().map(codec.decode);
	localCrdtInterface.applyRemoteUpdates(initialStoredDocUpdates);

	// merge the initial state into the local CRDT. always doing this because it will get merged later anyways
	storageInterface.store(localCrdtInterface.getSnapshot().map(codec.encode));

	// subscribe to local updates and save them to storage
	localCrdtInterface.subscribeToLocalUpdates((update) => {
		storageInterface.store(localCrdtInterface.getSnapshot().map(codec.encode));
	});

	// listen for updates to the storage that were not triggered by this instance
	// TODO: can do polling, replace localstorage with dexie/similar, but what I really want is to (optionally?) back it with (one of) the filesystem apis, which I will look into later.

	return {};
}

async function createOnlineAndOfflineDoc<CRDTUpdate>(
	onlineDoc: localCrdtInterface<CRDTUpdate>,
	offlineDoc: localCrdtInterface<CRDTUpdate>,
	localInterfaceUpdateEncoder: CRDTUpdateEncoder<CRDTUpdate>,
	params: {
		docId: string;
		onlineDocParams: Parameters<typeof createCrdtSyncProvider>[2];
	}
) {
	// connect to local storage cache
	const storageInterface = createLocalStorageInterface(params.docId);
	createOfflineDocProvider(offlineDoc, storageInterface, localInterfaceUpdateEncoder); // will throw if no access to storage

	createCrdtSyncProvider(onlineDoc, localInterfaceUpdateEncoder, params.onlineDocParams); // will throw if can't connect to server
}
async function demo() {
	const onlineDoc = createBaseYjsProvider(new Y.Doc());
	const offlineDoc = createBaseYjsProvider(new Y.Doc());

	createOnlineAndOfflineDoc(onlineDoc, offlineDoc, yjsPUpdateEncoder(), {
		docId: 'test-doc-id', // TODO: merge this and remoteDocId
		onlineDocParams: {
			remoteDocId: 'test-doc-id', // TODO: merge this and docId (ie rename this)
			cryptoConfig: await getInsecureCryptoConfigForTesting(),
			mergeInitialState: true
		}
	});
}
