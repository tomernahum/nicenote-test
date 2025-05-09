import { ClientUpdate } from "./-types"
import { createBaseYjsProvider, yjsPUpdateEncoder } from "./0-yjs-provider"
import type { Doc as YDoc } from "yjs"
import { getServerInterface } from "./1-server-client"
import {
    CryptoConfig,
    getInsecureCryptoConfigForTesting,
} from "./2-crypto-factory"

// TYPES USED
type localCrdtInterface<CRDTUpdate> = {
    applyRemoteUpdates: (updates: CRDTUpdate[]) => void
    subscribeToRemoteUpdates: (callback: (update: CRDTUpdate) => void) => void

    getChangesNotAppliedToAnotherDoc: (
        remoteDocChanges: CRDTUpdate[]
    ) => CRDTUpdate[] // maybe
    disconnect: () => void
}
type CRDTUpdateEncoder<CRDTUpdate> = {
    encode: (update: CRDTUpdate) => ClientUpdate
    decode: (update: ClientUpdate) => CRDTUpdate
    // Maybe replace decode with one that takes into account rowId?
}

// ----

export async function createYjsSyncProvider(
    yDoc: YDoc,
    params: Parameters<typeof createCrdtSyncProvider>[2]
) {
    const yjsProvider = createBaseYjsProvider(yDoc)
    // Temp, will make it one thing later
    // const adaptedYjsProvider = {
    //     ...yjsProvider,
    //     getChangesNotAppliedToAnotherDoc: (remoteDocChanges) => {
    //         const updates = yjsProvider.getChangesNotAppliedToAnotherYDoc(
    //             remoteDocChanges.map((update) => update.operation)
    //         )
    //         return updates.map((update) => ({
    //             type: "doc",
    //             operation: update,
    //         }))
    //         // merging awareness not currently supported in here
    //     },
    // } satisfies localCrdtInterface<{
    //     type: "doc" | "awareness"
    //     operation: Uint8Array
    // }>
    const adaptedYjsProvider = yjsProvider satisfies localCrdtInterface<{
        type: "doc" | "awareness"
        operation: Uint8Array
    }>
    const crdtSyncProvider = await createCrdtSyncProvider(
        adaptedYjsProvider,
        yjsPUpdateEncoder(),
        params
    )
    return {
        awareness: adaptedYjsProvider.awareness,
        ...crdtSyncProvider,
    } satisfies {
        disconnect: () => void

        [key: string]: unknown
    }
}
export async function createExampleYjsSyncProvider(yDoc: YDoc) {
    return createYjsSyncProvider(yDoc, {
        remoteDocId: "test",
        cryptoConfig: await getInsecureCryptoConfigForTesting(),
        mergeInitialState: true,
    })
}

// now can also create providers with same api but for any crdt (and I could make a crdt out of reducers too). Hopefully it is similar enough though

export async function createCrdtSyncProvider<CRDTUpdate>(
    localCrdtInterface: localCrdtInterface<CRDTUpdate>,
    localInterfaceUpdateEncoder: CRDTUpdateEncoder<CRDTUpdate>,
    params: {
        remoteDocId: string
        cryptoConfig: CryptoConfig
        mergeInitialState?: boolean
        // TODO
        //onReconnect?: "mergeLocalStateIntoOnline" | "replaceLocalStateWithOnline"
    }
) {
    // THIS WOULD BE WHAT createSyncedYDocProviderDemo IS NOW

    // connect to server
    const server = getServerInterface(
        params.remoteDocId,
        await getInsecureCryptoConfigForTesting(),
        {
            timeBetweenUpdatesMs: 100,
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
        // for our current yjs provider, this only merges up doc updates, not awareness updates
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

    return {
        disconnect: () => {
            // beta
            server.disconnect()
            localCrdtInterface.disconnect()
        },
    }

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
