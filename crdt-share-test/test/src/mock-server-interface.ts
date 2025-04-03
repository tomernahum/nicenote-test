import { SlowObservableList } from "./utils"

type YUpdate = Uint8Array

const remoteDocUpdates = new Map<string, SlowObservableList<YUpdate>>()
const remoteAwarenessUpdates = new Map<string, SlowObservableList<YUpdate>>()

const initialLatency = 500
export function setLatency(docId: string, latency: number) {
    remoteDocUpdates.get(docId)!.setLatency(latency)
    remoteAwarenessUpdates.get(docId)!.setLatency(latency)
}

export async function connectToDoc(docId: string) {
    // make sure we are connected to server, make sure the doc is initialized

    // ensure doc exists
    if (!remoteDocUpdates.has(docId)) {
        remoteDocUpdates.set(
            docId,
            new SlowObservableList<YUpdate>({ latency: initialLatency })
        )
    }
    if (!remoteAwarenessUpdates.has(docId)) {
        remoteAwarenessUpdates.set(
            docId,
            new SlowObservableList<YUpdate>({ latency: initialLatency })
        )
    }
    return { remoteDocUpdates, remoteAwarenessUpdates }
}

export async function getRemoteDocUpdateList(
    docId: string
): Promise<YUpdate[]> {
    // returns a list of yjs updates, can be processed by the provider into a yjs doc
    return remoteDocUpdates.get(docId)!.toArray()
}

// do we want this? // I wish awareness could be inside regular ydoc
export async function getRemoteAwarenessUpdatesList(
    docId: string
): Promise<YUpdate[]> {
    // returns a list of yjs updates, can be processed by the provider into a yjs doc
    return remoteAwarenessUpdates.get(docId)!.toArray()
}
export async function subscribeToRemoteDocUpdates(
    docId: string,
    callback: (update: Uint8Array) => void
) {
    // register callback for when a new update is received
    return remoteDocUpdates.get(docId)!.subscribeItem(callback)
}
export async function subscribeToRemoteAwarenessUpdates(
    docId: string,
    callback: (update: Uint8Array) => void
) {
    // register callback for when a new update is received
    return remoteAwarenessUpdates.get(docId)!.subscribeItem(callback)
}

export async function broadcastDocUpdate(docId: string, update: Uint8Array) {
    remoteDocUpdates.get(docId)!.push(update)
}

export async function broadcastAwarenessUpdate(
    docId: string,
    update: Uint8Array
) {
    remoteAwarenessUpdates.get(docId)!.push(update)
}

export async function doSquash(
    docId: string,
    lastSeenUpdateIdentifier: unknown,
    newUpdate: Uint8Array
) {
    // TODO
}
