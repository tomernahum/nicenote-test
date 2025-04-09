import * as Y from "yjs"
import {
    Awareness,
    applyAwarenessUpdate,
    encodeAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness.js"

// import {
//     connectToDoc,
//     getRemoteUpdateList,
//     subscribeToRemoteUpdates,
//     broadcastUpdate,
//     doSquash,
// } from "./1--mock-server-interface"
import {
    EncryptionParams,
    getProviderServerInterface,
} from "./1-provider-server-interface"

type YUpdate = Uint8Array

/**
 * Bind a local yDoc to a remote shared doc
 * if mergeInitialState is true, the initial state of the local yDoc will be merged with the remote yDoc
 */
export async function createRemoteDocProvider(
    yDoc: Y.Doc,
    params: {
        remoteDocId: string
        mergeInitialState?: boolean // defaults to defaulting to false,

        encryptionParams: EncryptionParams
    }
    // todo maybe: rewrite params of func to be more like other providers y-websocket (url, roomname, doc) // may also need secret key params
) {
    const {
        connectToDoc,
        getRemoteUpdateList,
        subscribeToRemoteUpdates,
        broadcastUpdate,
        // doSquash,
    } = getProviderServerInterface(params.remoteDocId, params.encryptionParams)

    // "connect to the server doc"
    await connectToDoc()
    const remoteUpdates = await getRemoteUpdateList("all")
    const remoteDocUpdates = remoteUpdates.docUpdates
    const remoteAwarenessUpdates = remoteUpdates.awarenessUpdates

    // connect to the local yDoc
    const yDocProvider = createBaseProvider(yDoc, handleBroadcastUpdate)

    // ---- Doc Interaction -----
    // initialize the local yDoc with all the previous remote state & updates
    mergeOnlineDocIntoLocal(yDocProvider, remoteDocUpdates)

    // write back to the server initial state from the yDoc that the server doesn't already have
    if (params.mergeInitialState) {
        mergeLocalDocIntoOnline(remoteDocUpdates, yDoc, handleBroadcastUpdate)
    }

    // Listen to new updates from the "server", and apply them to the local doc
    subscribeToRemoteUpdates(params.remoteDocId, "doc", (newItem) => {
        yDocProvider.applyRemoteUpdate(newItem)
    })

    // broadcast local updates to the server. called by yDocProvider
    function handleBroadcastUpdate(update: Uint8Array) {
        broadcastUpdate(params.remoteDocId, "doc", update)
    }

    // ---- Awareness Interaction -----
    // const remoteAwarenessUpdates = remoteUpdates.awarenessUpdates
    // initialize the local awareness with all the previous remote state & updates
    const awareness = new Awareness(yDoc)
    remoteAwarenessUpdates.forEach((update) => {
        applyAwarenessUpdate(awareness, update, yDoc)
        // applyAwarenessUpdate(awareness, update, "provider")
    })
    // subscribe to remote awareness updates and apply them to the local awareness
    subscribeToRemoteUpdates(params.remoteDocId, "awareness", (newItem) => {
        applyAwarenessUpdate(awareness, newItem, yDoc)
    })
    // subscribe to local awareness updates and broadcast them to the server
    awareness.on("update", ({ added, updated, removed }) => {
        // broadcastAwarenessUpdate(params.remoteDocId, update)
        const changedClients = added.concat(updated).concat(removed)
        const encodedUpdate = encodeAwarenessUpdate(awareness, changedClients)
        broadcastUpdate(params.remoteDocId, "awareness", encodedUpdate)
    })
    // remove ourselves from the remote awareness when we close the window (this should be done automatically after a while anyways, but this speeds it up)
    try {
        window.addEventListener("beforeunload", () => {
            removeAwarenessStates(awareness, [yDoc.clientID], "window unload")
        })
    } catch (e) {
        console.warn(e)
    }

    // TODO: squash functionality

    return {
        awareness,
    }
}

/** write back to the server initial state from the yDoc that the server doesn't already have */
function mergeLocalDocIntoOnline(
    remoteDocUpdates: Uint8Array[],
    yDoc: Y.Doc,

    handleBroadcastUpdate: (update: Uint8Array) => void
) {
    const onlineDoc = getOnlineDoc(remoteDocUpdates)

    // calculate the diff between the onlineDoc and the local yDoc
    const onlineStateVector = Y.encodeStateVector(onlineDoc)
    const update = Y.encodeStateAsUpdate(yDoc, onlineStateVector)

    const updateIsEmpty = update.toString() === "0,0"
    if (updateIsEmpty) {
        return
    }

    console.info("merging initial state", {
        onlineDoc: onlineDoc.getText("text").toJSON(),
        yDoc: yDoc.getText("text").toJSON(),
        onlineStateVector,
        update,
    })
    handleBroadcastUpdate(update)
}

function mergeOnlineDocIntoLocal(
    yDocProvider: ReturnType<typeof createBaseProvider>,
    // yDoc: Y.Doc,
    remoteDocUpdates: YUpdate[]
) {
    remoteDocUpdates.forEach((update) => {
        yDocProvider.applyRemoteUpdate(update)
    })
    return

    // Could also make one dif based on onlineDoc (get from getOnlineDoc)
}

function getOnlineDoc(remoteDocUpdates: YUpdate[]) {
    const onlineDoc = new Y.Doc()
    remoteDocUpdates.forEach((update) => {
        Y.applyUpdate(onlineDoc, update)
    })
    return onlineDoc
}
// could also have one that just takes onlineYDocId. could put that one in the server

/**
 * Creates a generic provider.
 * YDoc will be updated by the main application (locally)
 * when that happens, the provider will detect it and trigger onBroadcastAttempt
 * we might also receive updates from other users / the server.
 * when that happens we will apply them to the local doc with localProvider.applyRemoteUpdate
 */
export function createBaseProvider(
    ydoc: Y.Doc,
    onBroadcastAttempt: (update: Uint8Array) => void
) {
    const providerId = crypto.randomUUID()
    // const providerId = "provider"

    ydoc.on("update", (update, origin) => {
        // don't react to updates applied by this provider
        if (origin === providerId) {
            return
        }
        // now this update was produced either locally or by another provider.

        onBroadcastAttempt(update)
    })

    function onRemoteUpdateReceived(update: Uint8Array) {
        Y.applyUpdate(ydoc, update, providerId) // the third parameter sets the transaction-origin
    }

    return {
        applyRemoteUpdate: onRemoteUpdateReceived,
    }
}
