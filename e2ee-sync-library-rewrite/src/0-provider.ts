import { ClientUpdate } from "./-types"
import { createBaseYjsProvider, yjsPUpdateEncoder } from "./0-interface-yjs"
import type { Doc as YDoc } from "yjs"
import { getServerInterface } from "./1-server-client"
import {
    CryptoConfig,
    getInsecureCryptoConfigForTesting,
} from "./2-crypto-factory"

// ----

// TYPES USED
export type localCrdtInterface<CRDTUpdate> = {
    applyRemoteUpdates: (updates: CRDTUpdate[]) => void
    subscribeToRemoteUpdates: (callback: (update: CRDTUpdate) => void) => void

    getChangesNotAppliedToAnotherDoc: (
        remoteDocChanges: CRDTUpdate[]
    ) => CRDTUpdate[]
    getSnapshot: () => CRDTUpdate[]
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
    let sentUpdateCountSinceLastSnapshot = 0
    localCrdtInterface.subscribeToRemoteUpdates((update) => {
        console.debug("local crdt update detected", update)
        const encodedUpdates = encodeFromCrdt([update])
        server.addUpdates(encodedUpdates)
        sentUpdateCountSinceLastSnapshot += 1
    })
    console.debug("registered listener for local crdt updates")

    // listen for updates from the server and apply them to the local yDoc
    let highestUpdateRowSeen = -1
    server.subscribeToRemoteUpdates((updates, rowId) => {
        const decodedUpdates = updates.map((update) =>
            localInterfaceUpdateEncoder.decode(update)
        )
        localCrdtInterface.applyRemoteUpdates(decodedUpdates)

        if (rowId > highestUpdateRowSeen) {
            highestUpdateRowSeen = rowId
        }
    })
    console.debug("registered listener for remote updates")

    // TODO: snapshotting
    let lastRowSnapshottedOn = -1
    async function doSnapshot() {
        const snapshotUpdatesRaw = localCrdtInterface.getSnapshot()
        const encodedSnapshotUpdates = snapshotUpdatesRaw.map(
            localInterfaceUpdateEncoder.encode
        )

        // Applies the snapshot replacing up to the last update seen by the client
        // NOTE / DEBUGGING: if the client gets updates out of order, this may accidentally replace updates not captured in the snapshot
        server.applySnapshot(encodedSnapshotUpdates, highestUpdateRowSeen)
    }
    // currently no way to tell when somebody else did a snapshot. Could add this as a server event/method
    // instead for now we'll just do it semi-randomly // TODO: make it more intelligent

    const SNAPSHOT_EVERY_MS = 5000
    const SNAPSHOT_MIN_UPDATE_COUNT = 5 // todo: replace this with total unsnapshotted updates from the doc instead of ones from this client
    setTimeout(() => {
        setInterval(() => {
            if (sentUpdateCountSinceLastSnapshot >= SNAPSHOT_MIN_UPDATE_COUNT) {
                doSnapshot()
                sentUpdateCountSinceLastSnapshot = 0
            }
        }, SNAPSHOT_EVERY_MS)
    }, Math.random() * SNAPSHOT_EVERY_MS) // offset randomly at the start so that clients don't all do snapshots at the same time

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

            // cached server data is stored in the local CRDT interface (ydoc object)
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
