import { ObservableList } from "./utils"

type YUpdate = Uint8Array

//maybe
const remoteDocUpdatesList = new ObservableList<YUpdate>()
const remoteAwarenessUpdatesList = new ObservableList<YUpdate>()

// make sure we are connected to server, make sure the doc is initialized
export async function connectToDoc(docId: string) {
    // connect to server
    // make sure the doc is initialized
}

// returns a list of yjs updates, can be processed by the provider into a yjs doc
export async function getRemoteDocUpdateList(
    docId: string
): Promise<YUpdate[]> {
    return []
}

// returns a list of y-protocol/awareness updates, can be processed by the provider into a awareness object
// (I wish awareness could be inside regular ydoc)
export async function getRemoteAwarenessUpdatesList(
    docId: string
): Promise<YUpdate[]> {
    // get the full list of updates
    // get the decrypted version
    // get just the ones for awareness

    return []
}

// register callback for when a new update is received
export async function subscribeToRemoteDocUpdates(
    docId: string,
    callback: (update: Uint8Array) => void
) {}

// register callback for when a new awareness update is received
export async function subscribeToRemoteAwarenessUpdates(
    docId: string,
    callback: (update: Uint8Array) => void
) {}

export async function broadcastDocUpdate(docId: string, update: Uint8Array) {
    sendMessageToDocument(docId, "doc", update)
}

export async function broadcastAwarenessUpdate(
    docId: string,
    update: Uint8Array
) {
    sendMessageToDocument(docId, "awareness", update)
}

export async function doSquash(
    docId: string,
    lastSeenUpdateIdentifier: unknown,
    newUpdate: Uint8Array
) {}

// -----

function sendMessageToDocument(
    docId: string,
    bucket: "doc" | "awareness",
    update: Uint8Array
) {
    // encrypt
    const encryptedUpdate = encrypt({
        bucket,
        update,
    })
    // send
}
