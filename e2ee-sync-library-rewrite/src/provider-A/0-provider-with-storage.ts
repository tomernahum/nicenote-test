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
 * - smart-manual: if only one of the server state and the local state has changed since we were last online/in-sync, the divergence is resolved automatically. Otherwise, we go into both mode, and the caller is responsible for merging the online and offline representing crdts as they see fit & on their own timeline. Not yet implemented.
 *
 * once the caller is done with both mode, they can call __todo__ to transition to online mode, keeping just the online-representing crdt state as the new canonical state
 *
 * @param mainLocalCrdtInterface - the main local crdt interface.
 * In online mode, this represents the online state + optimistic updates. Updates to it are sent to online (and also persisted)
 * In offline mode, this represents the local state. Updates to it are persisted
 * In both mode, this represents the local state. updates to it are persisted but not sent online.  secondaryLocalCrdtInterface represents the online state. changes to secondaryLocalCrdtInterface are sent online but not persisted.
 * @param secondaryLocalCrdtInterface - the secondary local crdt interface. (currently) Only updated/listened to in both mode. It represents the online state + optimistic updates. Updates to it are sent to online, but not persisted unlike the regular mainLocalCrdtInterface. See also: mainLocalCrdtInterface
 *
 * In both online and in both mode, There will be a way to make updates directly to the server without displaying them optimistically.(you should make your display based on the crdt state) To make optimistic updates you just update the crdt and we listen to it reactively and send to server. to make non-optimistic updates there will be a method you can call here that will send to the server but not the crdt state. all changes confirmed by the server whether by you or by another device will be added to the crdt state.
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
    // TODO

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
            // turn online
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
        // simulate online mode so we don't miss any updates
        const inMemoryCache = createInMemoryCache()
        const ephemeralOnlineProvider = createOnlineProvider(
            mainLocalCrdtInterface,
            inMemoryCache,
            server,
            "off"
        )
        ephemeralOnlineProvider.turn("on")

        /* 
            Steps that need doing:
            - get the remote doc updates
            - apply remote doc updates to the crdt
            ----
            - get the unconfirmed local updates
            - apply unconfirmed local updates to the server
            
            optimization: squash unconfirmed local updates
            optimization: get only the diff of local state vs server state
            (local state)
        
        */

        // --------
        // todo
        // two approaches (?):
        // 1) combine the local cache list and the server list
        // 2) use the local crdt
        // the local crdt is supposed to represent the state of the local cache, so we can just call it to get the state

        /*
            we want to have online mode 
            
            wait can we go into online mode, queue the diff shit to go up (but have it be stayed as optimistic update), and that's it?
            if it succeeds, then yeah. And we can listen for new updates
            if it fails though, we don't have retry failed important updates functionality, so it would be lost (uh oh)
            
            so instead we can fully simulate online mode but only go into real online mode once we know our local state has merged
            
            I mean we don't actually discard failed updates yet afaik. I guess we will only discard updates sent by online mode. but still no retry. I guess if it fails to send we would want to send message to our user "failed to merge update up, would you like to try again? or try to go into both mode, or discard the local state?" or we could just fail the whole ->online mode and communicate the reason it failed afawwk
        */

        // draft code
        // onlineProvider.

        // onlineProvider.sendLessOptimisticUpdate(remoteDocUpdates)
        // onlineProvider.sendLessOptimisticUpdate(remoteDocUpdates)

        // reference code from prev draft:
        let temp: boolean = false
        if (temp) {
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

            // could also have a static method that doesn't modify our real crdt?

            // Send diff updates to server
            await server.addUpdates(diffUpdates)
            // promise should resolve when server confirms receipt. Or throw if it fails

            // what if an update comes in while we are merging? or user makes an update while we are merging? TODO
            // maybe this logic needs to go in the provider?

            // once merged, transition to online mode
            offlineProvider.turn("off")
            onlineProvider.turn("on")
        }
    }

    /*
        may be like this or implemented slightly differently:
        
        we will need to detect if an automatic merge is desired in smart-manual mode.
        
        hasServerUpdatedSinceLastOnline() 
        hasMyStateUpdatedSinceLastOnline()
        if neither: you're done
        if just me: merge up
        if just server: merge down  (some users may not want this - can be a different merge strategy)
        if both: (assume they are not equal - then we have conflicting state) enter both mode
        
        how to detect if it's updated? either compare the last update's id, or call the crdt provider to compare the equality of states
        what if it's been updated but only by being snapshotted? maybe the id of the snapshot can remain the same as the last update
        what if it's been updated but to something and back again? subjective whether we should auto merge in this case, but I think we should - so maybe we should detect by comparing equality via the crdt provider
        
        crdtProvider.static.areTheseEqual(serverState[], localState[])
        instance.isAnotherDocEqualToMe(serverState[]) (very similar to getChangesNotAppliedToAnotherDoc)
        
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

        // // maybe:
        // async initializeConnectionWithMergeAndTurnOn() {
        //     const pendingClientUpdates = (
        //         await localCache.getUnconfirmedOptimisticUpdates()
        //     ).map((u) => encodeListWithMixedTypes([u.id, u.update]))
        //     const serverState = (await server.getRemoteUpdateList()).map(
        //         (u) => u.update
        //     )
        //     // localCRDT should have the pending updates and previous server state already

        //     localCRDTInterface.applyRemoteUpdates(serverState)
        //     const diffUpdates =
        //         localCRDTInterface.getChangesNotAppliedToAnotherDoc(serverState)

        //     // todo: merge with server state
        //     // todo: transition to online mode
        //     // also need to make sure the remoteUpdateSubscriptions and stuff is really on
        //     // maybe before we do any of this we need to implement server disconnect notification logic and recconect
        // },

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
