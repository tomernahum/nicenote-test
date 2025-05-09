import { ClientUpdate } from "./-types"
import { createBaseYjsProvider, yjsPUpdateEncoder } from "./0-interface-yjs"
import type { Doc as YDoc } from "yjs"
import { getServerInterface } from "./1-server-client"
import {
    CryptoConfig,
    getInsecureCryptoConfigForTesting,
} from "./2-crypto-factory"

// ----

// may move this section somewhere (maybe yjs-provider.ts?)
/**
 * You can also directly call {@link createCrdtSyncProvider}, with a local yjs provider wrapper ({@link createBaseYjsProvider}) (that creates an awareness object for the ydoc (and wraps it in a nicer interface for this library to use))
 */
export async function createYjsSyncProvider(
    yDoc: YDoc,
    params: Parameters<typeof createCrdtSyncProvider>[2]
) {
    const yjsProvider = createBaseYjsProvider(yDoc)

    const syncProvider = await createCrdtSyncProvider(
        yjsProvider,
        yjsPUpdateEncoder(),
        params
    )
    return {
        awareness: yjsProvider.awareness,
        ...syncProvider,
    }
}
export async function createExampleYjsSyncProvider(yDoc: YDoc) {
    return createYjsSyncProvider(yDoc, {
        remoteDocId: "test",
        cryptoConfig: await getInsecureCryptoConfigForTesting(),
        mergeInitialState: true,
    })
}

// ----

// TYPES USED
export type localCrdtInterface<CRDTUpdate> = {
    applyRemoteUpdates: (updates: CRDTUpdate[]) => void
    subscribeToRemoteUpdates: (callback: (update: CRDTUpdate) => void) => void

    getChangesNotAppliedToAnotherDoc: (
        remoteDocChanges: CRDTUpdate[]
    ) => CRDTUpdate[] // maybe
    disconnect: () => void
}
export type CRDTUpdateEncoder<CRDTUpdate> = {
    encode: (update: CRDTUpdate) => ClientUpdate
    decode: (update: ClientUpdate) => CRDTUpdate
    // Maybe replace decode with one that takes into account rowId?
}

// ----

// now can also create providers with same api but for any crdt (and I could make a crdt out of reducers too). Hopefully it is similar enough though

export async function createCrdtSyncProvider<CRDTUpdate>(
    localCrdtInterface: localCrdtInterface<CRDTUpdate>,
    localInterfaceUpdateEncoder: CRDTUpdateEncoder<CRDTUpdate>,
    params: {
        remoteDocId: string
        cryptoConfig: CryptoConfig
        timeBatchingConfig?: Parameters<typeof getServerInterface>[2]
        mergeInitialState?: boolean
        // TODO
        //onReconnect?: "mergeLocalStateIntoOnline" | "replaceLocalStateWithOnline"
    }
) {
    // THIS WOULD BE WHAT createSyncedYDocProviderDemo IS NOW

    // connect to server
    const server = getServerInterface(
        params.remoteDocId,
        params.cryptoConfig,
        params.timeBatchingConfig ?? {
            timeBetweenUpdatesMs: 200,
            sendUpdatesToServerWhenNoUserUpdate: true,
        }
    )
    console.debug("created server interface")
    await server.connect()
    console.debug("connected to server")

    // initialize local CRDT: hydrate it with server updates, and if mergeInitialState is true, merge the initial state into the local CRDT
    async function syncInitialState(applyLocalUpdatesToRemoteDoc: boolean) {
        console.debug("syncing initial state")

        // Apply remote updates to local doc
        const remoteDocUpdates = await server.getRemoteUpdateList()
        console.debug("got current remote doc updates")
        const crdtUpdates = decodeWithRowIdToCrdt(remoteDocUpdates)
        console.debug("decoded current remote doc updates")
        localCrdtInterface.applyRemoteUpdates(crdtUpdates)
        console.debug("applied current remote doc updates")

        // merge in any differing state as an update to the remote doc
        if (applyLocalUpdatesToRemoteDoc) {
            const remoteDocUpdatesDecoded =
                decodeWithRowIdToCrdt(remoteDocUpdates)
            const diffUpdates =
                localCrdtInterface.getChangesNotAppliedToAnotherDoc(
                    remoteDocUpdatesDecoded
                )
            server.addUpdates(encodeFromCrdt(diffUpdates))
        }
    }
    await syncInitialState(params.mergeInitialState ?? true)

    // subscribe to local updates and send them to the server
    localCrdtInterface.subscribeToRemoteUpdates((update) => {
        console.debug("local crdt update detected", update)
        const encodedUpdates = encodeFromCrdt([update])
        server.addUpdates(encodedUpdates)
    })
    console.debug("registered listener for local crdt updates")

    // listen for updates from the server and apply them to the local yDoc
    server.subscribeToRemoteUpdates((updates) => {
        const decodedUpdates = updates.map((update) =>
            localInterfaceUpdateEncoder.decode(update)
        )
        localCrdtInterface.applyRemoteUpdates(decodedUpdates)
    })
    console.debug("registered listener for remote updates")

    // TODO: snapshotting
    // TODO: connection lost notification api
    //     maybe:
    //     onReconnectStrategy: "mergeLocalStateIntoOnline" | "replaceLocalStateWithOnline" | "don't auto reconnect"
    //         or tryToReconnectOnConnectionLost: boolean,
    //     onReconnected: () => void
    //     reconnectBehavior: "mergeWithLocal", "replaceLocal", "noAutoReconnect"
    //     See ./0-yjs-provider.ts comments

    return {
        disconnect: () => {
            // beta
            server.disconnect()
            localCrdtInterface.disconnect()
        },
    }

    // helper functions

    function decodeToCrdt(updates: ClientUpdate[]): CRDTUpdate[] {
        return updates.map((update) =>
            localInterfaceUpdateEncoder.decode(update)
        )
    }
    function decodeWithRowIdToCrdt(
        updates: { update: ClientUpdate; rowId: number }[]
    ): CRDTUpdate[] {
        return updates.map((update) =>
            localInterfaceUpdateEncoder.decode(update.update)
        )
    }
    function encodeFromCrdt(updates: CRDTUpdate[]): ClientUpdate[] {
        return updates.map((update) =>
            localInterfaceUpdateEncoder.encode(update)
        )
    }
}
