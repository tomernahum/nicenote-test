import * as Y from "yjs"
// import * as YAwareness from "y-protocols/awareness.js"
import {
    Awareness,
    applyAwarenessUpdate,
    encodeAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness.js"

import { SlowObservableList } from "../utils"
import { createProvider } from "../base-provider"

type YUpdate = Uint8Array

const remoteDocs = new Map<string, SlowObservableList<YUpdate>>()
function ensureRemoteDocExists(docId: string) {
    if (remoteDocs.has(docId)) {
        return
    }
    remoteDocs.set(docId, new SlowObservableList<YUpdate>({ latency: 500 }))
}
async function getRemoteDoc(docId: string) {
    await ensureRemoteDocExists(docId)
    return remoteDocs.get(docId)!
}

// Awareness section (added on)
const remoteAwarenessUpdates = new Map<string, SlowObservableList<YUpdate>>()
function ensureRemoteAwarenessExists(docId: string) {
    if (remoteAwarenessUpdates.has(docId)) {
        return
    }
    remoteAwarenessUpdates.set(
        docId,
        new SlowObservableList<YUpdate>({ latency: 500 })
    )
}
async function getRemoteAwarenessUpdates(docId: string) {
    await ensureRemoteAwarenessExists(docId)
    return remoteAwarenessUpdates.get(docId)!
}

export function setLatency(docId: string, latency: number) {
    remoteDocs.get(docId)?.setLatency(latency)
    remoteAwarenessUpdates.get(docId)?.setLatency(latency)
}

/**
 * Bind a local yDoc to a remote shared doc
 * if mergeInitialState is true, the initial state of the local yDoc will be merged with the remote yDoc
 */
export async function createRemoteDocProvider(
    yDoc: Y.Doc,
    params: {
        remoteDocId: string
        mergeInitialState?: boolean // defaults to defaulting to false,
    }
) {
    // "connect to the server"
    const remoteDocUpdates = await getRemoteDoc(params.remoteDocId)

    // connect to the yDoc
    const yDocProvider = createProvider(yDoc, broadcastUpdate)

    // initialize the local yDoc with all the previous remote state & updates
    remoteDocUpdates.toArray().forEach((update) => {
        yDocProvider.applyRemoteUpdate(update)
    })

    // params.yDoc either has no existing state, has had some of the same updates as from the server, or has had unique updates. if it has had unique updates, we need to merge them
    if (params.mergeInitialState) {
        // calculate the onlineDoc
        const onlineDoc = new Y.Doc()
        remoteDocUpdates.toArray().forEach((update) => {
            Y.applyUpdate(onlineDoc, update)
        })

        // calculate the diff between the onlineDoc and the local yDoc
        const onlineStateVector = Y.encodeStateVector(onlineDoc)
        const update = Y.encodeStateAsUpdate(yDoc, onlineStateVector)

        console.log("merging initial state", {
            onlineDoc: onlineDoc.getText("text").toJSON(),
            yDoc: yDoc.getText("text").toJSON(),
            onlineStateVector,
        })
        broadcastUpdate(update)
    }

    // Listen to new updates from the "server", and apply them to the local doc
    remoteDocUpdates.subscribeItem((newItem, fullState) => {
        yDocProvider.applyRemoteUpdate(newItem)
    })

    // broadcast local updates to the server
    function broadcastUpdate(update: Uint8Array) {
        console.log("broadcasting update", update)
        remoteDocUpdates.push(update)
    }

    // Squash confirmed updates into a single smaller update
    // didn't test this extensively, since this whole file is just a proof of concept
    function doSquash() {
        const lastSeenDocUpdates = remoteDocUpdates.toArray()

        const onlineDoc = new Y.Doc()
        lastSeenDocUpdates.forEach((update) => {
            Y.applyUpdate(onlineDoc, update)
        })
        const squashedOnlineDocUpdate = Y.encodeStateAsUpdate(onlineDoc)

        // on the "server" replace the last seen updates with the squashed update, don't replace any updates that happened after/while this function ran
        // if someone else is also squashing updates, right now it maybe breaks but in the real world with a real server it will just reject the 2nd one or use a more complex strategy
        remoteDocUpdates.splice(
            0,
            lastSeenDocUpdates.length,
            squashedOnlineDocUpdate
        )
    }

    // Implement Awareness using yjs's awareness protocol https://docs.yjs.dev/api/about-awareness#adding-awareness-support-to-a-provider
    // initialize awareness
    const remoteAwarenessUpdates = await getRemoteAwarenessUpdates(
        params.remoteDocId
    )
    const awareness = new Awareness(yDoc)
    remoteAwarenessUpdates.toArray().forEach((update) => {
        applyAwarenessUpdate(awareness, update, yDoc)
    })

    remoteAwarenessUpdates.subscribeItem((newItem, fullState) => {
        applyAwarenessUpdate(awareness, newItem, yDoc)
    })

    // code from docs
    // Whenever the local state changes, communicate that change to all connected clients
    awareness.on("update", ({ added, updated, removed }) => {
        console.log("awareness update in provider", { added, updated, removed })
        const changedClients = added.concat(updated).concat(removed)
        const update = encodeAwarenessUpdate(awareness, changedClients)
        // broadcast to server
        remoteAwarenessUpdates.push(update)
    })
    try {
        window.addEventListener("beforeunload", () => {
            removeAwarenessStates(awareness, [yDoc.clientID], "window unload")
        })
    } catch (e) {
        console.warn(e)
    }

    return {
        doSquash,
        awareness,
    }
}

// Missing: awareness support (yjs awareness data structure used for ephemeral state)
