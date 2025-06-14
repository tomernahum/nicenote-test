import { ClientUpdate } from "../-types"

import { getLocalStorageInterface } from "../--0-provider-with-offline-mode" // TODO: move this code to a canonical file
import { getServerInterface } from "../1-server-client"
import { createInMemoryCache, createLocalStorageCache } from "./1-local-cache"
import {
    decodeListWithMixedTypes,
    encodeList,
    encodeListWithMixedTypes,
} from "../../crypto/1-encodingList"
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

export function createProvider(
    mainLocalCrdtInterface: LocalCrdtInterface,
    secondaryLocalCrdtInterface: LocalCrdtInterface,
    server: ReturnType<typeof getServerInterface>,
    storage: any,
    params: {}
) {
    // always start in offline mode
    let mode: "online" | "offline" | "both" = "offline"

    const localPersistedCache = createLocalStorageCache()
    const onlineProvider = createOnlineProvider(localPersistedCache, server)
    const offlineProvider = createOfflineProvider(localPersistedCache)

    const localInMemoryCache = createInMemoryCache()
    const onlineProviderWithinBothMode = createOnlineProvider(
        localInMemoryCache,
        server
    )
    // offline provider within both mode is the same. Also the mainLocalCrdtInterface is used as the offline one.

    mainLocalCrdtInterface.subscribeToLocalUpdates((update) => {
        if (mode === "online") {
            onlineProvider.notifyOfLocalUpdate(update)
        } else if (mode === "offline") {
            offlineProvider.notifyOfLocalUpdate(update)
        } else if (mode === "both") {
            // in both mode the main local crdt interface is used as the offline one (may change)
            offlineProvider.notifyOfLocalUpdate(update)
        }
    })

    function onReceivedRemoteUpdate(update: ClientUpdate, rowId: number) {
        if (mode === "online") {
            onlineProvider.notifyOfRemoteUpdate(update, rowId)
        } else if (mode === "both") {
            // add it to the correct local crdt interface
            onlineProviderWithinBothMode.notifyOfRemoteUpdate(update, rowId)
            secondaryLocalCrdtInterface.applyRemoteUpdates([update])
        }
    }
    server.subscribeToRemoteUpdates((updates, rowId) => {
        for (const update of updates) {
            onReceivedRemoteUpdate(update, rowId)
        }
    })

    function onlineToOfflineMode() {
        mode = "offline"
    }
    function offlineToOnlineMode() {
        mode = "online"
    }
    function offlineToBothMode() {}

    function exitOfflineMode() {
        if (true) {
            offlineToOnlineMode()
        } else {
            offlineToBothMode()
        }
    }

    server.connect().then(() => {
        exitOfflineMode()
    })
    // server.onConnectionLost(() => {
    //     onlineToOfflineMode()
    // })
    // todo: attempt to regain connection when offline (not just when initialized)

    return {
        //
    }
}

function createOnlineProvider(
    localCache: ReturnType<typeof createLocalStorageCache>,
    server: ReturnType<typeof getServerInterface>
) {
    return {
        async notifyOfLocalUpdate(update: ClientUpdate) {
            const clientUpdateId = crypto.randomUUID()

            const enrichedUpdate = encodeListWithMixedTypes([
                clientUpdateId,
                update,
            ])
            // we may have server take unencoded enrichedUpdate directly later

            localCache.addOptimisticUpdate(update, clientUpdateId)
            server.addUpdates([enrichedUpdate])
        },
        async notifyOfRemoteUpdate(update: ClientUpdate, rowId: number) {
            const [clientUpdateId, trueUpdate] = decodeListWithMixedTypes(
                update
            ) as [string, ClientUpdate]
            if (typeof clientUpdateId !== "string") {
                throw new Error("Invalid client update id")
            }

            localCache.addCanonicalUpdate(trueUpdate, clientUpdateId)
        },
    }
}
function createOfflineProvider(
    localCache: ReturnType<typeof createLocalStorageCache>
) {
    return {
        notifyOfLocalUpdate(update: ClientUpdate) {
            const clientUpdateId = crypto.randomUUID()
            localCache.addOptimisticUpdate(update, clientUpdateId)
        },
    }
}

function getEnrichedUpdate(update: ClientUpdate) {
    const clientUpdateId = crypto.randomUUID()
    return encodeListWithMixedTypes([clientUpdateId, update])
}
/* 
    Modes:
    - online: 
        - updates are applied to local cache
        - updates are sent straight to server
        - if update fails on server, it is removed from local cache
        - if connection is lost (incl page refreshes), the local cache becomes the main state of offline mode
    - offline: 
        - updates are applied to local cache
        - if connection is regained, local cache is merged with online cache based on certain strategy, and we transition to either online mode or both mode
    - both: 
        - two separate types of updates: offline state and online state
        - online
            - updates are applied to local (in-memory) cache
            - updates are sent straight to server
            - if update fails on server, it is removed from local cache
            - if connection is lost (incl page refreshes), the local (in-memory) cache is discarded
        - offline
            - updates are applied to local (persisted) cache
            - reconciling offline and online states is up to the consumer
*/

/* 
Maybe:
updates: Basic: Uint8Array compatible with local crdt interface
rich client update: {
    update: Uint8Array
    clientUpdateId: string
}
rich server update: {
    update: Uint8Array
    clientUpdateId: string // ??

    senderRole: string // eg "reader", "writer", "admin" (based on what key they authenticated their message with)
    rowId: string
    
}
tbd if we need to add more fields to either, eg timestamp
todo: rework crypto pipeline to return rich server update and maybe take rich client update as input






*/
