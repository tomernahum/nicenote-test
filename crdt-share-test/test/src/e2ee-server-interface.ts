type YUpdate = Uint8Array

// make sure we are connected to server, make sure the doc is initialized
export async function connectToDoc(docId: string) {}

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

export async function broadcastDocUpdate(docId: string, update: Uint8Array) {}

export async function broadcastAwarenessUpdate(
    docId: string,
    update: Uint8Array
) {}

export async function doSquash(
    docId: string,
    lastSeenUpdateIdentifier: unknown,
    newUpdate: Uint8Array
) {}
