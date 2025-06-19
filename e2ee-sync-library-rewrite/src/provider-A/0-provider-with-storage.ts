import { ClientUpdate } from "../-types"

import { getLocalStorageInterface } from "../--0-provider-with-offline-mode" // TODO: move this code to a canonical file
import { getServerInterface } from "../1-server-client"
import { createInMemoryCache, createLocalStorageCache } from "./1-local-cache"
import {
    decodeListWithMixedTypes,
    encodeList,
    encodeListWithMixedTypes,
} from "../../crypto/1-encodingList"
import { tryCatch, tryCatch2 } from "../-utils"
import { CryptoConfig } from "../2-crypto-factory"
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
export async function createProvider(
    mainLocalCrdtInterface: LocalCrdtInterface,
    secondaryLocalCrdtInterface: LocalCrdtInterface,
    server: ReturnType<typeof getServerInterface>,
    // storageProvider: any, // todo
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

    // we always start in offline mode
    let mode: "online" | "offline" | "both" = "offline"

    // initialize the crdt with the state from the local cache + any state it already had
    const localCacheInitialState = (
        await localPersistedCache.getStateWithOptimistic()
    ).map((u) => u.update)
    mainLocalCrdtInterface.applyRemoteUpdates(localCacheInitialState) // (don't worry remote updates just means its not from the crdt, not that is from the server)

    // may add config options later for whether/how to do this
    const diffUpdates = mainLocalCrdtInterface.getChangesNotAppliedToAnotherDoc(
        localCacheInitialState
    )
    diffUpdates.forEach((u) =>
        localPersistedCache.addOptimisticUpdate(updateToUpdateWithId(u))
    )

    // secondary CRDT is currently not initialized (part of the both mode feature set coming soon)

    // ready to start listening to crdt
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
    // TODO: way to report errors to consumer
    serverConnection.onConnected(async (isReconnection) => {
        // connection gained or regained
        // either transition into online mode or both mode, depending on configuration

        if (reconciliationStrategy === "automatic") {
            // (may extract this code into a function)

            // get updates to merge up
            const updates =
                await localPersistedCache.getUnconfirmedOptimisticUpdates()

            // TODO: make sure the updates are merged (should be done by the cache maybe?)
            const mergedUpdates = updates
                .map((u) => u.update)
                .map((u) => getEnrichedUpdate(u))
            // could also do Y.mergeUpdates (wrapped by crdt provider)

            // send up the offline updates
            const [res, error] = await tryCatch2(
                serverConnection.addUpdates(mergedUpdates) // right now I believe there is no timeout so it will only reject if the server rejects the updates or if the connection is for sure lost
            )
            if (error) {
                console.error(
                    "Failed to send offline updates up to server. ",
                    error
                )
                // TODO FOR REAL: display error to caller instead of alerting
                alert(
                    "Failed to merge local state up to the server. Maybe your connection is unstable, or maybe your permissions have been downgraded, or maybe it's a bug on our end. Please report. For now we are keeping you in offline mode (manual merge / both modes mode coming soon) (option to just go with the online version coming soon - but you could clear your storage). Reload the app to try again. - sync library " // very bad if a non-affiliated-with-me app ships this code since it could sound like its coming from them
                )
                // don't go into online mode for now
                return // TODO: retry at least a few times (config option?)
            }

            // download the current server state
            // todo maybe: only download diff from what you have (maybe have to negotiate with a peer for this. Lower tolerance for bugs but less traffic = cheaper for user & for me)
            // but for now we just redownload everything
            const serverState = await serverConnection.getRemoteUpdateList()

            // apply it to the local crdt, then go into online mode
            mainLocalCrdtInterface.applyRemoteUpdates(
                serverState.map((u) => u.update)
            )
            onlineProvider.turn("on")
            offlineProvider.turn("off")
            mode = "online"
        } else if (reconciliationStrategy === "smart-manual") {
            // TODO: implement
            throw new Error("Not implemented yet")
        } else {
            console.error(
                "Unexpected reconciliation strategy. Skipped going online.",
                reconciliationStrategy
            )
        }
    })

    return {
        // TODO

        disconnect: () => {
            // beta
            server.disconnect()
            mainLocalCrdtInterface.disconnect()
            // secondaryLocalCrdtInterface.disconnect() // TODO
            // localPersistedCache.disconnect // not a thing
        },
        // TODO on mode change

        getMode: () => mode,
        onConnected: server.onConnected,
        onDisconnected: server.onDisconnected,

        // todo edit crypto config
        setCryptoConfig: (newCryptoConfig: CryptoConfig) => {
            server.setCryptoConfig(newCryptoConfig)
            // TODO at rest crypto config for local cache?
        },
        changeCryptoConfig: async (
            callback: (cryptoConfig: CryptoConfig) => Promise<CryptoConfig>
        ) => {
            const newCryptoConfig = await callback(server.getCryptoConfig())
            server.setCryptoConfig(newCryptoConfig)
        },
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

        localCache.addOptimisticUpdate({ update, id: clientUpdateId })
        server.addUpdates([enrichedUpdate]).catch((e) => {
            console.warn(
                "Failed to send update to server. Revoking it from the cache... would revert from crdt but too hard for now",
                e
            )
            localCache.revokeOptimisticUpdate(clientUpdateId)
            // todo: remove it from yjs. no easy way to do that lol. Could reconstruct it from the cache
        })
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

        /** for sending an update without having it be in the crdt. Still persists it before sending to server */
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

        localCache.addOptimisticUpdate(updateToUpdateWithId(update))
    })

    // no need to support receiving remote updates, as we are offline
    // may need to add a function for it though or may not we'll see

    return {
        turn(onOrOff: "on" | "off") {
            isTurnedOff = onOrOff === "off"
        },
    }
}

function updateToUpdateWithId(update: ClientUpdate) {
    const id = crypto.randomUUID()
    return { update, id }
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
