import { type ClientUpdate } from "./-types"
import { createBaseYjsProvider, yjsPUpdateEncoder } from "./0-interface-yjs"
import type { Doc as YDoc } from "yjs"
import { getServerInterface } from "./1-server-client"
import { type CryptoConfig } from "./2-crypto-factory"
import { tryCatch, tryCatch2 } from "./-utils"

// ----

// TYPES USED
export type localCrdtInterface<CRDTUpdate> = {
    applyRemoteUpdates: (updates: CRDTUpdate[]) => void
    subscribeToLocalUpdates: (
        callback: (update: CRDTUpdate) => void
    ) => () => void

    getChangesNotAppliedToAnotherDoc: (
        remoteDocChanges: CRDTUpdate[]
    ) => CRDTUpdate[]
    getSnapshot: () => CRDTUpdate[]
    // maybe: createSnapshot: (updatesToMerge: CRDTUpdate[]) => CRDTUpdate[] // (pure)
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
        mergeInitialState?: boolean //note to caller: if set to false and doc has any initial state than it might diverge
        snapshotIntervalMs?: number
        snapshotMinUpdateCount?: number
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
            // sendUpdatesToServerWhenNoUserUpdate: false,
        }
    )
    console.debug("created server interface")
    const { error: connectError } = await tryCatch(server.connect())
    if (connectError) {
        throw connectError
    }
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
        // otherwise caller should have emptied the local crdt themselves...
    }
    await syncInitialState(params.mergeInitialState ?? true)

    // subscribe to local updates and send them to the server
    localCrdtInterface.subscribeToLocalUpdates((update) => {
        console.debug("local crdt update detected", update)
        const encodedUpdates = encodeFromCrdt([update])
        server.addUpdates(encodedUpdates)
    })
    console.debug("registered listener for local crdt updates")

    // listen for updates from the server and apply them to the local yDoc
    let highestUpdateRowSeen = -1
    server.subscribeToRemoteUpdates((updates, rowId) => {
        const decodedUpdates = updates.map((update) =>
            localInterfaceUpdateEncoder.decode(update)
        )
        localCrdtInterface.applyRemoteUpdates(decodedUpdates)
        console.debug(`applied (${decodedUpdates.length}) new remote updates`)

        if (rowId > highestUpdateRowSeen) {
            highestUpdateRowSeen = rowId
        }
    })
    console.debug("registered listener for remote updates")

    // periodically snapshot the doc to prevent it growing to big
    let updateRowOfLastSnapshot = -1
    async function doSnapshot() {
        const snapshotUpdatesRaw = localCrdtInterface.getSnapshot()
        const encodedSnapshotUpdates = snapshotUpdatesRaw.map(
            localInterfaceUpdateEncoder.encode
        )

        // Applies the snapshot replacing up to the last update seen by the client
        // NOTE / DEBUGGING: if the client gets updates out of order, this may accidentally replace updates not captured in the snapshot
        server.applySnapshot(encodedSnapshotUpdates, highestUpdateRowSeen)
        updateRowOfLastSnapshot = highestUpdateRowSeen
    }
    // currently no way to tell when somebody else did a snapshot. Could add this as a server event/method
    // you can also fetch the whole doc to see how many updates are in it.
    // could even use that remote update list to construct the snapshot instead of the local crdt state. this would prevent accidentally sneaking in newer changes (which seems fine though), (wouldn't prevent maliciously sneaking in changes)
    // instead for now we'll just do it semi-randomly // TODO: make it more intelligent
    const snapshotIntervalMs = params.snapshotIntervalMs ?? 5000
    const realSnapshotMinUpdateCount = params.snapshotMinUpdateCount // randomizing it a bit so that clients don't all fire at the same time
        ? params.snapshotMinUpdateCount +
          (Math.random() - 0.5) * params.snapshotMinUpdateCount
        : 5 + (Math.random() - 0.5) * 5
    // i just realized snapshotting is likely free for us since it's ingress. so we might as well actually snapshot constantly. except not free for user if user is billed on upload data, which they would be esp if on mobile. but cheap for user
    setTimeout(() => {
        setInterval(() => {
            const updatePackagesReceivedSinceLastSnapshot =
                highestUpdateRowSeen - updateRowOfLastSnapshot
            // todo: make based on received updates that have not been snapshotted by another client. ie make updateRowOfLastSnapshot take other's snapshots into account

            // console.debug(new Date(), "considering doing snapshot", {
            //     updatePackagesReceivedSinceLastSnapshot,
            //     realSnapshotMinUpdateCount,
            // })
            if (
                updatePackagesReceivedSinceLastSnapshot >=
                realSnapshotMinUpdateCount // includes case of updateRowOfLastSnapshot being -1
            ) {
                doSnapshot()
                console.debug("did snapshot")
            }
        }, snapshotIntervalMs)
    }, Math.random() * snapshotIntervalMs) // offset randomly at the start so that clients don't all do snapshots at the same time
    // TODO: INSECURE: this leaks how many updates we've really done to the server, instead of how many we've sent to it.

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
        setCryptoConfig: (newCryptoConfig: CryptoConfig) => {
            server.setCryptoConfig(newCryptoConfig)
        },
        changeCryptoConfig: async (
            callback: (cryptoConfig: CryptoConfig) => Promise<CryptoConfig>
        ) => {
            const newCryptoConfig = await callback(server.getCryptoConfig())
            server.setCryptoConfig(newCryptoConfig)
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
