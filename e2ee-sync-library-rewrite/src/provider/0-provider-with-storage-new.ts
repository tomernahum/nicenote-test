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

/**
 *
 * @param reconciliationStrategy
 * controls what happens when we go from offline to online mode and the states are not the same
 * - automatic: does not use both mode or the secondaryLocalCrdtInterface, instead just merges the crdt updates/states between the local and the server and lets the crdt handle what state comes out
 * - smart-manual: if an easily resolved conflict is detected, it is resolved automatically. Otherwise, (todo: callback maybe) we go into both mode and the caller is responsible for merging online and offline representing crdts as and when they see fit. Not yet implemented.
 *
 * once the caller is done with both mode, they can call __todo__ to transition to online mode, keeping just the online-representing crdt state as the new canonical state
 */
export function createProvider(
    mainLocalCrdtInterface: LocalCrdtInterface,
    secondaryLocalCrdtInterface: LocalCrdtInterface,
    server: ReturnType<typeof getServerInterface>,
    storageProvider: any, // todo
    reconciliationStrategy: "automatic" | "smart-manual"
    // params: {}
) {
    // always start in offline mode
    // let mode: "online" | "offline" | "both" = "offline"

    const serverConnection = server
    const localPersistedCache = createLocalStorageCache()

    const offlineProvider = createOfflineProvider(
        mainLocalCrdtInterface,
        localPersistedCache,
        "off"
    )
    const onlineProvider = createOnlineProvider(
        mainLocalCrdtInterface,
        localPersistedCache,
        server,
        "off"
    )

    // todo: make sure any initial state from the crdt is merged into the local cache / offline provider properly

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

        //@ts-ignore
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

    // todo: m

    // always start in offline mode
    let mode: "online" | "offline" | "both" = "offline"
    offlineProvider.turn("on")

    // Establish server connections, detect disconnection and reconnection
    const connectionPromise = serverConnection.connect()

    connectionPromise.catch(() => {
        // connection failed to establish
        // keep mode as is: offline.
        // keep onlineProvider off and offlineProvider on
    })
    serverConnection.onDisconnected(() => {
        // connection lost
        if (mode === "online") {
            mode = "offline"
            onlineProvider.turn("off")
            offlineProvider.turn("on")
        } else if (mode === "both") {
            // TODO: make the transitions correct here
        } else {
            console.error("Connection lost in unexpected mode", mode)
        }
    })
    serverConnection.onConnected((isReconnection) => {
        // connection gained or regained
        // either transition into online mode or both mode, depending on configuration
        if (reconciliationStrategy === "automatic") {
            //
            autoMergeLocalAndServerStates()
        } else if (reconciliationStrategy === "smart-manual") {
            // TODO: implement
        } else {
            console.error(
                "Unexpected reconciliation strategy",
                reconciliationStrategy
            )
        }
    })

    async function autoMergeLocalAndServerStates() {
        // todo
        // two approaches (?):
        // 1) combine the local cache list and the server list
        // 2) use the local crdt
    }

    /*
        may be like this or implemented slightly differently:
        
        we will need to detect if an automatic merge is possible in smart-manual mode.
        for this we will need to detect if the server state has changed since the last time we were online
        if no: we just merge up
        if yes: we will need to detect if the local state has changed since the last time we were online
            if no: we just merge down
            if yes: we have divergent states, and we need to go into both mode
        
        so we check 
        server-state-when-last-online vs current-server state
        & 
        server-state-when-last-online vs current-local state
        or
        local-state-when-last-online vs current-local state
        (these should be equal I think)
        
        how to detect this?
        1) see if the final states are equal. Can have a method in the crdt provider to test this
        2) see if all the updates are equal. Not ideal because there could be snapshotted/squashed updates
        3) see if the last update has the same identity (on current-server vs last-seen-server or on current-)
        
    */

    return {
        //
    }
}

// todo in each provider: mergeInitialState logic
// todo in online: (after everything): snapshots

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

        // maybe:
        async initializeConnectionWithMergeAndTurnOn() {
            const pendingClientUpdates = (
                await localCache.getUnconfirmedOptimisticUpdates()
            ).map((u) => encodeListWithMixedTypes([u.id, u.update]))
            const serverState = (await server.getRemoteUpdateList()).map(
                (u) => u.update
            )
            // localCRDT should have the pending updates and previous server state already

            localCRDTInterface.applyRemoteUpdates(serverState)
            const diffUpdates =
                localCRDTInterface.getChangesNotAppliedToAnotherDoc(serverState)

            // todo: merge with server state
            // todo: transition to online mode
            // also need to make sure the remoteUpdateSubscriptions and stuff is really on
            // maybe before we do any of this we need to implement server disconnect notification logic and recconect
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
