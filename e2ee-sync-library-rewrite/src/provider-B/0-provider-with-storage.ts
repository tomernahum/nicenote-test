import { ClientUpdate } from "../-types"
import { StorageCache } from "./1-storage-cache"
import { getServerInterface } from "../1-server-client"

export type LocalCrdtInterface = {
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

export async function createProvider(params: {
    localCrdtInterface: LocalCrdtInterface
    storageCache: StorageCache
    server: ReturnType<typeof getServerInterface>
}) {
    const { localCrdtInterface, storageCache, server } = params

    // we start off in offline mode (crdt represents offline state)

    // first, merge the cached local storage with the crdt
    // TODO

    // then, while we are still in offline mode, keep it in sync (TODO)

    // now, lets try to connect to the server
    const serverConnectionPromise = server.connect()
    serverConnectionPromise.catch(() => {
        // failed to connect
        // TODO: retry logic. should go in server interface itself in a method like tryToGetConnected
    })

    // handle connection events. we will need to transition modes of course
    server.onConnected(async (isReconnection) => {
        // connected
        // todo: complex logic / "both" mode
        // for now, just transition into online mode:

        // merge the local state and the online state
        const onlineUpdates = await server.getRemoteUpdateList()
        let lastSeenRowId: number = onlineUpdates.at(-1)?.rowId ?? 0
        const onlineState = onlineUpdates.map((u) => u.update)
        localCrdtInterface.applyRemoteUpdates(onlineState)
        const diffUpdates =
            localCrdtInterface.getChangesNotAppliedToAnotherDoc(onlineState)
        if (diffUpdates.length > 0) {
            // TODO: should not need this check
            const mergeUpPromise = server.addUpdates(diffUpdates)
            mergeUpPromise.catch((error) => {
                console.error(
                    "Failed to merge local state up to the server. ",
                    error
                )
            })
        }

        // start listening to new updates from the local and online
        localCrdtInterface.subscribeToLocalUpdates((update) => {
            server.addUpdates([update])
        })
        server.subscribeToRemoteUpdates((updates, rowId) => {
            localCrdtInterface.applyRemoteUpdates(updates)
            lastSeenRowId = rowId
        })

        // periodically do snapshots
        setInterval(() => {
            const snapshot = localCrdtInterface.getSnapshot()
            server.applySnapshot(snapshot, lastSeenRowId)
        }, 5000)
    })
    server.onDisconnected((unexpected) => {
        // disconnected
        // TODO (simple)
    })

    return {
        disconnect() {
            console.warn("Attempted disconnect (beta functionality")
            // maybe this is meant to be called destroy. used with onMount
            server.disconnect()
        },
    }
}
