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
    const offlineProvider = createOfflineProvider(
        mainLocalCrdtInterface,
        localPersistedCache,
        "on"
    )
    const onlineProvider = createOnlineProvider(
        mainLocalCrdtInterface,
        localPersistedCache,
        server,
        "off"
    )

    async function onConnectionEstablished() {
        // TODO make it correctly
        const mergeMode = "auto"
        // todo: make mergeMode a param, and add a mode that sometimes goes into both mode instead for manual merging
        if (mergeMode === "auto") {
            // merge the server state and the local cache state
            // TODO: look over.    Right now it is merging with the crdt holder not the local cache. Which may be fine

            const remoteDocUpdates = await server.getRemoteUpdateList()
            const remoteDocUpdatesWithoutIds = remoteDocUpdates.map(
                (u) => u.update
            )

            mainLocalCrdtInterface.applyRemoteUpdates(
                remoteDocUpdatesWithoutIds
            )

            const diffUpdates =
                mainLocalCrdtInterface.getChangesNotAppliedToAnotherDoc(
                    remoteDocUpdatesWithoutIds
                )

            // Send diff updates to server
            await server.addUpdates(diffUpdates)
            // promise should resolve when server confirms receipt. Or throw if it fails

            // what if an update comes in while we are merging? or user makes an update while we are merging? TODO
            // maybe this logic needs to go in the provider?

            // once merged, transition to online mode
            offlineProvider.turn("off")
            onlineProvider.turn("on")
        }
        if (mergeMode === "auto2") {
            // merge the server state and the local cache state
            const pendingUpdates =
                await localPersistedCache.getUnconfirmedOptimisticUpdates()

            const encodedPendingUpdates = pendingUpdates.map((u) =>
                encodeListWithMixedTypes([u.id, u.update])
            )

            await server.addUpdates(encodedPendingUpdates)
            // promise should resolve when server confirms receipt. Or throw if it fails

            // what if user makes an update while we are merging? TODO
            // maybe this logic needs to go in the provider?

            // once merged, transition to online mode
            offlineProvider.turn("off")
            onlineProvider.turn("on")
        }
    }
    async function onConnectionLost() {
        if (mode === "online") {
            // transition to offline mode
            onlineProvider.turn("off")
            offlineProvider.turn("on")
        }
        // todo: both mode logic
    }

    // Establish server connections, detect disconnection and reconnection
    // todo

    return {
        //
    }
}

function createOnlineProvider(
    localCRDTInterface: LocalCrdtInterface,
    localCache: ReturnType<typeof createLocalStorageCache>,
    server: ReturnType<typeof getServerInterface>,
    onOrOff: "on" | "off"
) {
    let isTurnedOff = onOrOff === "off"

    function onLocalUpdate(update: ClientUpdate) {
        const clientUpdateId = crypto.randomUUID()

        const enrichedUpdate = encodeListWithMixedTypes([
            clientUpdateId,
            update,
        ])
        // we may have server take unencoded enrichedUpdate directly later

        localCache.addOptimisticUpdate(update, clientUpdateId)
        server.addUpdates([enrichedUpdate])
    }
    localCRDTInterface.subscribeToLocalUpdates((update) => {
        if (isTurnedOff) {
            return
        }
        onLocalUpdate(update)
    })
    // onLocalUpdate also called by manual sendNonOptimisticUpdate function

    server.subscribeToRemoteUpdates((updates, rowId) => {
        if (isTurnedOff) {
            return
        }

        for (const update of updates) {
            const [clientUpdateId, trueUpdate] = decodeListWithMixedTypes(
                update
            ) as [string, ClientUpdate]
            if (typeof clientUpdateId !== "string") {
                throw new Error(
                    "Invalid update format received. Was expecting encoded identifier at start"
                )
            }

            localCache.addCanonicalUpdate(trueUpdate, clientUpdateId)
            localCRDTInterface.applyRemoteUpdates([trueUpdate])
        }
    })

    return {
        turn(onOrOff: "on" | "off") {
            isTurnedOff = onOrOff === "off"
        },

        /** for sending an update without having it be in the crdt. Still caches it */
        async sendLessOptimisticUpdate(
            update: ClientUpdate,
            evenIfTurnedOff: boolean = false
        ) {
            if (evenIfTurnedOff || !isTurnedOff) {
                onLocalUpdate(update)
            }
        },
    }
}
function createOfflineProvider(
    localCRDTInterface: LocalCrdtInterface,
    localCache: ReturnType<typeof createLocalStorageCache>,
    onOrOff: "on" | "off"
) {
    let isTurnedOff = onOrOff === "off"

    localCRDTInterface.subscribeToLocalUpdates((update) => {
        if (isTurnedOff) {
            return
        }

        localCache.addOptimisticUpdate(update, crypto.randomUUID())
    })

    // no need to support receiving remote updates, as we are offline
    // may need to add a function for it though or may not we'll see

    return {
        turn(onOrOff: "on" | "off") {
            isTurnedOff = onOrOff === "off"
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
