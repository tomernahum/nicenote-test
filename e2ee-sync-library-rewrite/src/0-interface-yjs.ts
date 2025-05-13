import * as Y from "yjs"
import {
    Awareness,
    applyAwarenessUpdate,
    encodeAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness.js"

import { getInsecureCryptoConfigForTesting } from "./2-crypto-factory"
import { getServerInterface } from "./1-server-client"
import { ClientUpdate } from "./-types"
import {
    CRDTUpdateEncoder,
    createCrdtSyncProvider,
    localCrdtInterface,
} from "./0-provider"

// ----

/**
 * You can also directly call {@link createCrdtSyncProvider}, with a local yjs provider wrapper ({@link createBaseYjsProvider}) (that creates an awareness object for the ydoc (and wraps it in a nicer interface for this library to use))
 */
export async function createYjsSyncProvider(
    yDoc: Y.Doc,
    params: Parameters<typeof createCrdtSyncProvider>[2]
) {
    const yjsProvider = createBaseYjsProvider(yDoc)

    const syncProvider = await createCrdtSyncProvider(
        yjsProvider,
        yjsPUpdateEncoder(),
        params
    )
    return {
        awareness: yjsProvider.awareness,
        ...syncProvider,
    }
}
export async function createExampleYjsSyncProvider(yDoc: Y.Doc) {
    return createYjsSyncProvider(yDoc, {
        remoteDocId: "test",
        cryptoConfig: await getInsecureCryptoConfigForTesting(),
        mergeInitialState: true,
    })
}

// ----

/** @deprecated */
export async function createSyncedYDocProviderDemo(
    yDoc: Y.Doc,
    params: {
        remoteDocId: string
        mergeInitialState?: boolean
        onReconnect?:
            | "mergeLocalStateIntoOnline"
            | "replaceLocalStateWithOnline"
        // | "cancelReconnect"
        // onDisconnect
        // onInitialConnectionError
    }
) {
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

    // connect local yDoc // put after server is connected since onLocalUpdate sends to the server...
    const localYProvider = createBaseYjsProvider(yDoc, onLocalUpdate)

    // get the initial/current remote yDoc state (as updates), and apply it to the local yDoc
    // async function hydrateDocUponConnection() {
    //     const remoteDocUpdatesUponConnection =
    //         await server.getRemoteUpdateList()
    //     const yDocUpdates = remoteDocUpdatesUponConnection.map((libUpdate) =>
    //         yjsPUpdateEncoder().decode(libUpdate.update)
    //     )
    //     localYProvider.applyRemoteUpdates(yDocUpdates)

    //     // Todo merging
    // }
    const remoteDocUpdatesUponConnection = await server.getRemoteUpdateList()
    console.debug("got remote doc updates upon connection")
    const yDocUpdates = remoteDocUpdatesUponConnection.map((libUpdate) =>
        yjsPUpdateEncoder().decode(libUpdate.update)
    )
    console.debug("decoded remote doc updates upon connection")
    localYProvider.applyRemoteUpdates(yDocUpdates)
    console.debug("applied remote doc updates upon connection")

    // listen for updates from the server and apply them to the local yDoc
    server.subscribeToRemoteUpdates((updates) => {
        const decodedUpdates = updates.map((update) =>
            yjsPUpdateEncoder().decode(update)
        )
        localYProvider.applyRemoteUpdates(decodedUpdates)
    })

    // listen for local updates and apply them to the server
    // actually passed in when we connected to the local doc
    function onLocalUpdate(update: {
        type: "doc" | "awareness"
        operation: Uint8Array
    }) {
        const encodedUpdate = yjsPUpdateEncoder().encode(update)
        server.addUpdates([encodedUpdate])
    }

    // send initial local yDoc state to server
    if (params.mergeInitialState ?? true) {
        const remoteDocOnlyUpdates = yDocUpdates
            .filter((update) => update.type === "doc")
            .map((update) => update.operation)
        const differingInitialUpdates =
            localYProvider.getChangesNotAppliedToAnotherYDoc(
                remoteDocOnlyUpdates
            )
        server.addUpdates(
            differingInitialUpdates.map((update) => {
                const encodedUpdate = yjsPUpdateEncoder().encode({
                    type: "doc",
                    operation: update,
                })
                return encodedUpdate
            })
        )
    }

    return {
        awareness: localYProvider.awareness,
        disconnect: () => {
            server.disconnect()
            localYProvider.disconnect()
        },
    }

    // TODO: perform periodic snapshots
    // ...

    // TODO: notice when we go into offline mode & notify caller. maybe add option to autoreconnect
    // in our ultimate app, upon disconnection we will switch to offline mode, stop sending updates to the server, and then upon reconnection trigger custom logic of what to merge in to the server (for now / by default sending missing yjs updates and letting yjs handle the merging is fine, but in final app I want either a custom merging algorithm that is my specific-content-aware, or actually having the user in the loop. as in show them current & offline version and let them copy paste manually or run an automerge algorithm)

    // function onDisconnectBrainstorm() {}
    // const configBrainstorm = {}
    // // callback
    // function onReconnectBrainstorm(onlineDocState) {}
    // function onReconnectOneLayerUpBrainstorm(
    //     onlineDocState,
    //     localDocState
    // ): { newDocState: any } {
    //     return { newDocState: null }
    // }

    // const configBrainstorm2 = {
    //     mergeInitialState: true,
    //     //mergeStateOnReconnect: true, // turn off for our app, then onReconnect do merge at higher up level

    //     onReconnectHandling: "" as
    //         | "mergeLocalStateIntoOnline"
    //         | "replaceLocalStateWithOnline", //| "addOnlineStateToLocalButDontAddLocalToOnline"
    //          | "don't autorecconnect"

    //     callbackOnDisconnect: (
    //         docStateOnDisconnectIsAlreadyCapturedInTheYDoc
    //     ) => {},
    //     callbackOnReconnect: () => {},

    //     // either: use the same yDoc for online and offline, do onReconnect=mergeLocalStateIntoOnline
    //     // or: use a different yDoc for online and offline, do onReconnect=replaceLocalStateWithOnline, then manually merge the two docs however you want
    // }

    // right now im not sure whether or not socketio will automatically rehydrate messages that we were meant to get while offline. or automatically send messages we were trying to send (pretty sure yes for sending). should turn off the latter.
}
// ----

type LibraryUpdate = ClientUpdate
type YProviderUpdate = {
    type: "doc" | "awareness"
    operation: Uint8Array
}
export function yjsPUpdateEncoder(): CRDTUpdateEncoder<YProviderUpdate> {
    return {
        encode: (providerUpdate: YProviderUpdate): LibraryUpdate => {
            // A simple encoding scheme: [type byte, ...operation bytes]
            // 0 for 'doc', 1 for 'awareness'
            const typeByte = providerUpdate.type === "doc" ? 0 : 1
            const encoded = new Uint8Array(1 + providerUpdate.operation.length)
            encoded[0] = typeByte
            encoded.set(providerUpdate.operation, 1)
            return encoded
        },
        decode: (update: LibraryUpdate): YProviderUpdate => {
            if (update.length === 0) {
                console.warn("Tried to decode an empty library update")
                throw new Error("Cannot decode empty update")
            }

            const typeByte = update[0]
            const type: "doc" | "awareness" =
                typeByte === 0 ? "doc" : "awareness"
            const operation = update.slice(1)

            return {
                type,
                operation,
            }
        },
    }
}

/**
 * Creates a remote provider for yjs.
 * calls a callback when an update is detected (and therefore needs to be broadcasted)
 * returns a method to apply an update (ie one received from another client's broadcast)
 *
 * Also sets up and returns an awareness instance, as is the job of most yjs providers
 *
 */
export function createBaseYjsProvider(
    yDoc: Y.Doc,
    onUpdate: (update: YProviderUpdate) => void = () => {},
    removeClientAwarenessDataOnWindowClose = true
) {
    const awareness = new Awareness(yDoc)

    const providerId = crypto.randomUUID()
    // const providerId = "provider"

    // subscribe to local doc updates
    function onDocUpdate(update: Uint8Array, origin: any) {
        // don't react to updates applied by this provider
        if (origin === providerId) {
            return
        }
        // now this update was produced either locally or by another provider.

        onUpdate({ type: "doc", operation: update })
    }
    yDoc.on("update", onDocUpdate)
    // subscribe to local awareness updates
    function onAwarenessUpdate({ added, updated, removed }) {
        const changedClients = added.concat(updated).concat(removed)
        const encodedUpdate = encodeAwarenessUpdate(awareness, changedClients)
        onUpdate({ type: "awareness", operation: encodedUpdate })
    }
    awareness.on("update", onAwarenessUpdate)

    // remove ourselves from the awareness when we close the window (otherwise will be auto-detected after a timeout)
    // this should trigger awareness.on("update") which will trigger onUpdates, which will hopefully broadcast our removal to the server before the tab gets closed
    function onBeforeWindowUnload() {
        removeAwarenessStates(awareness, [yDoc.clientID], "window unload")
    }
    if (removeClientAwarenessDataOnWindowClose) {
        try {
            window.addEventListener("beforeunload", onBeforeWindowUnload)
        } catch (e) {
            console.warn(
                "failed to add window.beforeunload listener to remove awareness state",
                e
            )
        }
    }

    /*returned*/ function disconnectFromYDoc() {
        yDoc.off("update", onDocUpdate)
        awareness.off("update", onAwarenessUpdate)
        if (removeClientAwarenessDataOnWindowClose) {
            window.removeEventListener("beforeunload", onBeforeWindowUnload)
        }
    }

    /*returned*/ function applyRemoteUpdates(
        updates: {
            type: "doc" | "awareness"
            operation: Uint8Array
        }[]
    ) {
        updates.forEach((update) => {
            if (update.type === "doc") {
                Y.applyUpdate(yDoc, update.operation, providerId) // the third parameter sets the transaction-origin
            } else if (update.type === "awareness") {
                applyAwarenessUpdate(awareness, update.operation, yDoc)
            }
        })
    }

    // ---

    return {
        applyRemoteUpdates,

        // (these are intended to be worked with directly, not encapsulated by this object, this object reacts to their changes)
        awareness,
        yDoc,

        // yDoc helper functions
        /** @deprecated for {@link getChangesNotAppliedToAnotherDoc} */
        getChangesNotAppliedToAnotherYDoc: (
            remoteDoc: Y.Doc | Uint8Array[]
        ) => {
            console.warn({ remoteDoc })
            const remoteDocReal =
                remoteDoc instanceof Y.Doc
                    ? remoteDoc
                    : buildYDocFromUpdates(remoteDoc)

            function buildYDocFromUpdates(updates: Uint8Array[]) {
                // error here...
                const yDoc = new Y.Doc()
                updates.forEach((update) => {
                    Y.applyUpdate(yDoc, update)
                })
                return yDoc
            }

            // calculate the diff between the onlineDoc and the local yDoc
            const remoteStateVector = Y.encodeStateVector(remoteDocReal)
            const update = Y.encodeStateAsUpdate(yDoc, remoteStateVector) // only writes the changes missing from remoteStateVector

            const updateIsEmpty = update.toString() === "0,0"
            return updateIsEmpty ? [] : [update]
        },

        /**
         * Used for merging into the online doc
         */
        getChangesNotAppliedToAnotherDoc: (
            remoteDocUpdates: YProviderUpdate[]
            // may have been good to take an already merged/ ydoc?
        ) => {
            const remoteDoc = new Y.Doc()
            remoteDocUpdates.forEach((update) => {
                if (update.type == "awareness") {
                    return //continue
                }
                Y.applyUpdate(remoteDoc, update.operation)
            })

            // calculate the diff between the onlineDoc and the local yDoc
            const remoteStateVector = Y.encodeStateVector(remoteDoc)
            const docUpdate = Y.encodeStateAsUpdate(yDoc, remoteStateVector) // only writes the changes missing from remoteStateVector

            // gets the awareness state of the local doc. No optimizations to avoid redundant updates on this one
            const awarenessUpdate = encodeAwarenessUpdate(awareness, [
                yDoc.clientID,
            ])

            // TODO: also support awareness updates?

            return [
                { type: "doc" as const, operation: docUpdate },
                {
                    type: "awareness" as const,
                    operation: awarenessUpdate,
                },
            ]
        },

        disconnect: disconnectFromYDoc,

        /** only supports one subscriber at a time (that is all that is needed currently) */
        subscribeToRemoteUpdates: (
            callback: (update: YProviderUpdate) => void
        ) => {
            onUpdate = callback
        },
    } satisfies localCrdtInterface<YProviderUpdate> & {
        [key: string]: unknown
    } // there may be a better way out there to do this typing interface implementation thing
}
