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
import {
	assert,
	doIf,
	tryCatch2,
	tryCatch2SyncFn
} from '../../../e2ee-sync-library-rewrite/src/-utils';
import type { ClientUpdate } from '../../../e2ee-sync-library-rewrite/src/-types';
import { createObservable } from '../../../e2ee-sync-library-rewrite/src/ts-helper-lib';

// Demo / brainstorm. will rewrite

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
function createLSOfflineDocProvider<CRDTUpdate>(
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
		// maybe:
		// useOfflineProvider: boolean;
		// useOnlineProvider: boolean;
	}
) {
	const storageInterface = createLocalStorageInterface(params.docId);

	//

	// connect the offline doc to the offline provider / storage
	const offlineProvider = createLSOfflineDocProvider(
		offlineDoc,
		storageInterface,
		localInterfaceUpdateEncoder
	); // will throw if no access to storage
	// TODO maybe: param in this function to not use offline mode

	// connect the online doc to the online provider / server

	let status = createObservable<'connecting' | 'online' | 'offline'>('connecting');

	let onlineProvider: Awaited<ReturnType<typeof createCrdtSyncProvider>> | null;
	let onlineError: Error | null;
	[onlineProvider, onlineError] = await tryCatch2(
		createCrdtSyncProvider(onlineDoc, localInterfaceUpdateEncoder, params.onlineDocParams)
	);
	if (onlineError) {
		// assume the reason is we couldn't connect
		// TODO: maybe rethink the failed to connect api, don't return that info by erroring
		// 		// maybe create first and then connect as a method?
		status.set('offline');
	} else {
		status.set('online');
	}

	status.whenValueIs('online', {
		onStart: () => {
			// the offline doc should sync with the online doc exactly....
			//

			return;
		},
		onStop: () => {
			// let the

			return;
		}
	});

	// In online mode, make the offline doc listen to the online provider
	if (status.value === 'online') {
		// TODO! support multiple subscriptions inside
		onlineDoc.subscribeToLocalUpdates((update) => {
			offlineDoc.applyRemoteUpdates([update]);
		});
	}

	function onConnectionLost() {
		status = 'offline';
	}

	//@ts-ignore // TODO: implement this api, assuming we decide its the right one
	onlineProvider.onConnectionLost(() => {
		status = 'offline';
		// offline doc is kept up to date with the last online doc state elsewhere

		// TODO: cache the most recent doc state in "last online doc state"

		// NOTE / TODO: when online provider loses connection, it currently may have a few updates applied to it that did not actually go through to the server. TODO: we need to handle this. maybe roll these back here?..
		// onlineProvider.getNonOptimisticState or removeNonConfirmedUpdates? difficult.
	});

	function onReconnected() {
		// reconnect onlineProvider
		status = 'transition'; // todo online-and-offline mode

		// for now just push offline state onto online. Later will add option to do custom merging logic, or online-and-offline mode to allow the user to be looped in for the merging (eg just display both side by side, or show one doc with highlighted diff of the other)
		const autoComputedDiffUpdates = offlineDoc.getChangesNotAppliedToAnotherDoc(
			onlineDoc.getSnapshot()
		); // could instead add getsnapshot to the provider api, doesn't matter i think
		onlineDoc.applyRemoteUpdates(autoComputedDiffUpdates);
		// now will get auto merged up..., and we don't know when/whether it succeeded
		// TODO handle above problem, as in what if we reconnect, try to merge in our offline state and then reconnect
		// related to problem mentioned in onConnectionLost
		// may also be solved for us if we solve above problem???
	}

	// TODO: keep offlineDoc in sync with online doc while in online mode
}
async function demo() {
	const onlineDoc = createBaseYjsProvider(new Y.Doc());
	const offlineDoc = createBaseYjsProvider(new Y.Doc());

	createOnlineAndOfflineDoc(onlineDoc, offlineDoc, yjsPUpdateEncoder(), {
		docId: 'test-doc-id', // TODO: merge this and remoteDocId
		useOfflineProvider: true,
		onlineDocParams: {
			remoteDocId: 'test-doc-id', // TODO: merge this and docId (ie rename this)
			cryptoConfig: await getInsecureCryptoConfigForTesting(),
			mergeInitialState: true
		}
	});
}

async function createOnlineAndOfflineDocNew<CRDTUpdate>(
	doc: localCrdtInterface<CRDTUpdate>,
	localInterfaceUpdateEncoder: CRDTUpdateEncoder<CRDTUpdate>,
	storageInterface: StorageInterface,
	params: {
		onlineDocParams: Parameters<typeof createCrdtSyncProvider>[2];
	}
) {
	// verify the local storage interface is available
	storageInterface.connect(); // will throw if can't connect to local storage

	let status = createObservable<'connecting' | 'online' | 'offline'>('connecting');

	// try to connect to the online provider
	let onlineProvider: Awaited<ReturnType<typeof createCrdtSyncProvider>> | undefined;

	const [onlineProviderResult, onlineError] = await tryCatch2(
		createCrdtSyncProvider(doc, localInterfaceUpdateEncoder, params.onlineDocParams)
	);
	if (onlineError) {
		// assume the reason is we couldn't connect
		// TODO: maybe rethink the failed to connect api, don't return that info by erroring
		status.set('offline');
	} else {
		// successfully connected to the online provider and the server
		onlineProvider = onlineProviderResult;
		status.set('online');
	}

	status.whenValueIs('online', {
		onStart: () => {
			return;
		},
		onStop: () => {
			// let the

			return;
		}
	});

	status.whenValueIs('offline', {
		onStart: () => {
			return;
		},
		onStop: () => {
			return;
		}
	});

	//
}
