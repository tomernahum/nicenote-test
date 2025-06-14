import { type getLocalStorageInterface } from "../--0-provider-with-offline-mode"
import { ClientUpdate } from "../-types"
import { type getServerInterface } from "../1-server-client"

export type localCrdtInterface<CRDTUpdate> = {
    applyRemoteUpdates: (updates: ClientUpdate[]) => void
    subscribeToLocalUpdates: (
        callback: (update: ClientUpdate) => void
    ) => () => void

    getChangesNotAppliedToAnotherDoc: (
        remoteDocChanges: ClientUpdate[]
    ) => ClientUpdate[]
    getSnapshot: () => ClientUpdate[]
    disconnect: () => void
}

function getStorageAndServerInterface(
    server: ReturnType<typeof getServerInterface>,
    storage: ReturnType<typeof getLocalStorageInterface>
) {
    // const status = {
    //     serverConnectionStatus: "connecting" as ConnectionStatus,
    //     storageConnectionStatus: "connecting" as ConnectionStatus,
    // }

    function addUpdates(updates: ClientUpdate[]) {
        storage.addUpdates(updates)
        server.addUpdates(updates)
    }

    function applySnapshot(
        snapshot: ClientUpdate[],
        lastUpdateRowToReplace: number
    ) {
        storage.applySnapshot(snapshot, lastUpdateRowToReplace)
        server.applySnapshot(snapshot, lastUpdateRowToReplace)
    }

    // try to connect?

    return {
        addUpdates,
        applySnapshot,
    }
}

type ConnectionStatus = "connecting" | "connected" | "failed" | "disconnected" // failed == could not connect
async function createCrdtSyncStoreProvider<CRDTUpdate>(
    crdtInterface: localCrdtInterface<CRDTUpdate>,
    server: ReturnType<typeof getServerInterface>,
    storage: ReturnType<typeof getLocalStorageInterface>,
    params: {
        reconcileWithStorageStrategy?: "merge with storage"
        // | "replace crdt with storage" // not as easily supported by yjs as I would think
        // | "replace storage with crdt"
        // | // leave in differing updates in the crdt but don't store them
    }
) {
    const status = {
        serverConnectionStatus: "connecting" as ConnectionStatus,
        storageConnectionStatus: "connecting" as ConnectionStatus,
    }

    const storageConnectionPromise = storage
        .connect()
        .then(() => {
            status.storageConnectionStatus = "connected"
        })
        .catch(() => {
            status.storageConnectionStatus = "failed"
        })
    const serverConnectionPromise = server
        .connect()
        .then(() => {
            status.serverConnectionStatus = "connected"
            // server.onConnectionLost(() => {
            //     status.serverConnectionStatus = "disconnected"
            //     // do periodic reconnection attempts
            // })
        })
        .catch(() => {
            status.serverConnectionStatus = "failed"
        })

    // for now we are requiring storage to work, otherwise we will throw. Can still use this function without storage by passing in a storage interface that does nothing or keeps things in memory
    await storageConnectionPromise

    // reconcile crdt holder with storage
    if (
        params.reconcileWithStorageStrategy ??
        "merge with storage" === "merge with storage"
    ) {
        // apply updates from storage into crdt holder
        const storageState = await storage.getStateAsUpdates()
        crdtInterface.applyRemoteUpdates(storageState)

        // // apply updates from crdt holder into storage
        // const diffUpdates =
        //     crdtInterface.getChangesNotAppliedToAnotherDoc(storageState)
        // storage.addUpdates(diffUpdates)

        // replace storage with fresh crdt snapshot
        storage.applySnapshot(crdtInterface.getSnapshot())
    } // no other reconciliation strategies supported for now

    async function onConnectedToServer() {
        // reconcile the local storage / crdt holder (which have been kept in sync)   with the server

        // TODO: alternative strategies of showing server and local state at once..... might need two crdts for that...

        // apply remote updates to local doc
        const remoteDocUpdates = (await server.getRemoteUpdateList()).map(
            (u) => u.update
        )
        crdtInterface.applyRemoteUpdates(remoteDocUpdates) // (storage will be triggered from a listener)

        // apply remaining local updates to server
        const diffUpdates =
            crdtInterface.getChangesNotAppliedToAnotherDoc(remoteDocUpdates)
        server.addUpdates(diffUpdates)
    }
}

/*
Plan:
CRDT holder
    onChange: 
        back up into storage
        (try) propagate up to server
    
    onConnectToCRDTHolder: 
        reconcile holder with storage
    onConnectToServer
        reconcile storage=holder with server

*/
