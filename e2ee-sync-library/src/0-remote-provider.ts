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
import { getProviderServerInterface } from "./1-provider-server-interface"
import type { ProviderEncryptionConfig } from "./1-crypto-update-factory"

type YUpdate = Uint8Array

// TODO: maybe a synchronous version of this?

/**
 * Bind a local yDoc to a remote shared doc
 * if mergeInitialState is true, the initial state of the local yDoc will be merged with the remote yDoc
 */
export async function createRemoteDocProvider(
    yDoc: Y.Doc,
    params: {
        remoteDocId: string
        mergeInitialState?: boolean // defaults to defaulting to false,

        encryptionParams: ProviderEncryptionConfig
    }
    // todo maybe: rewrite params of func to be more like other providers y-websocket (url, roomname, doc) // may also need secret key params
) {
    const {
        connect,
        disconnect,
        getRemoteUpdateList,
        subscribeToRemoteUpdates,
        broadcastUpdate,
        broadcastSnapshot,
        // } = getProviderServerInterface(params.remoteDocId, params.encryptionParams)
    } = getProviderServerInterface(params.remoteDocId, params.encryptionParams)

    // initialize all that we can before connecting to the server

    // "connect to the server doc"
    await connect().catch((error) => {
        // console.warn("!! Failed to connect to the remote doc:", error)
        // application can catch the error and handle it / display to user. Currently checks for error contains "connect failed". idk if there is a better way we should do this maybe... we could return isError or something (todo maybe)
        throw new Error("connect failed", { cause: error })
    })
    const remoteUpdates = await getRemoteUpdateList()
    const remoteDocUpdates = remoteUpdates
        .filter((update) => update.bucket === "doc")
        .map((update) => update.operation)
    const remoteAwarenessUpdates = remoteUpdates
        .filter((update) => update.bucket === "awareness")
        .map((update) => update.operation)

    let sentUpdateCount = 0
    // console.log("0- connected to doc", remoteUpdates)

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
    subscribeToRemoteUpdates((newItem) => {
        if (newItem.bucket !== "doc") return
        yDocProvider.applyRemoteUpdate(newItem.operation)
    })

    // broadcast local updates to the server. called by yDocProvider
    function handleBroadcastUpdate(update: Uint8Array) {
        // console.log("detected doc update, broadcasting")
        broadcastUpdate({ bucket: "doc", operation: update })
        sentUpdateCount += 1
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
    subscribeToRemoteUpdates((newItem) => {
        if (newItem.bucket !== "awareness") return
        applyAwarenessUpdate(awareness, newItem.operation, yDoc)
    })
    // subscribe to local awareness updates and broadcast them to the server
    awareness.on("update", ({ added, updated, removed }) => {
        const changedClients = added.concat(updated).concat(removed)
        const encodedUpdate = encodeAwarenessUpdate(awareness, changedClients)
        // console.log("detected awareness update, broadcasting")
        sentUpdateCount += 1
        broadcastUpdate({ bucket: "awareness", operation: encodedUpdate })
    })

    // remove ourselves from the remote awareness when we close the window (this should be done automatically after a while anyways, but this speeds it up)
    try {
        window.addEventListener("beforeunload", () => {
            removeAwarenessStates(awareness, [yDoc.clientID], "window unload")
        })
    } catch (e) {
        console.warn(e)
    }

    // squash/snapshot functionality
    async function doSnapshot() {
        const yDocSnapshot = Y.encodeStateAsUpdate(yDoc)
        const awarenessClients = Array.from(awareness.getStates().keys())
        const yAwarenessSnapshot = encodeAwarenessUpdate(
            awareness,
            awarenessClients
        )
        await broadcastSnapshot(
            [
                { bucket: "doc", operation: yDocSnapshot },
                { bucket: "awareness", operation: yAwarenessSnapshot },
            ],
            "auto"
        )
    }

    setTimeout(() => {
        setInterval(() => {
            // const totalDocUpdates = ""
            // TODO: replace sentUpdateCount with count of current total doc updates from anyone
            // which we can keep track of, but we currently don't have a way to be notified of transactions

            if (sentUpdateCount >= 5) {
                doSnapshot()
                sentUpdateCount = 0
            }
        }, 5000) // TODO: make this smarter
    }, Math.random() * 5000)

    console.log("finished provider initialization")

    return {
        awareness,
        async disconnect() {
            return await disconnect()
        },
        internal: {
            sentUpdateCount,
        },
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

    console.info(
        "merging initial state of local doc into online doc"
        // {
        //     onlineDoc: onlineDoc.getText("text").toJSON(),
        //     yDoc: yDoc.getText("text").toJSON(),
        //     onlineStateVector,
        //     update,
        // }
    )
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
