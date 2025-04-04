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

// put this together, since our server will not know the difference so fetching from the server will have to fetch both
export async function getRemoteUpdateList(docId: string) {
    // returns a list of yjs updates, can be processed by the provider into a yjs doc
    return {
        docUpdates: remoteDocUpdates.get(docId)!.toArray(),
        awarenessUpdates: remoteAwarenessUpdates.get(docId)!.toArray(),
    }
}

export async function subscribeToRemoteUpdates(
    docId: string,
    bucket: "doc" | "awareness",
    callback: (update: Uint8Array) => void
) {
    // register callback for when a new update is received
    if (bucket === "doc") {
        return remoteDocUpdates.get(docId)!.subscribeItem(callback)
    } else {
        return remoteAwarenessUpdates.get(docId)!.subscribeItem(callback)
    }
}

export async function broadcastUpdate(
    docId: string,
    bucket: "doc" | "awareness",
    update: Uint8Array
) {
    if (bucket === "doc") {
        remoteDocUpdates.get(docId)!.push(update)
    } else {
        remoteAwarenessUpdates.get(docId)!.push(update)
    }
}

export async function doSquash(
    docId: string,
    lastSeenUpdateIdentifier: unknown,
    newUpdate: Uint8Array
) {
    // TODO
}
