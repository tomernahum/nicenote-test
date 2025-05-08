import { ClientUpdate } from "./-types"
import { createBaseYjsProvider, yjsPUpdateEncoder } from "./0-yjs-provider"
import type { Doc as YDoc } from "yjs"
import { getServerInterface } from "./1-server-client"

// TYPES
type localCrdtInterface<CRDTUpdate> = {
    applyRemoteUpdates: (updates: CRDTUpdate[]) => void
    subscribeToRemoteUpdates: (callback: (update: CRDTUpdate) => void) => void

    // getChangesNotAppliedToAnotherYDoc: (
    //     remoteDoc: ClientUpdate[]
    // ) => CRDTUpdate[] // maybe
    disconnect: () => void
}
type CRDTUpdateEncoder<CRDTUpdate> = {
    encode: (update: CRDTUpdate) => ClientUpdate
    decode: (update: ClientUpdate) => CRDTUpdate
}

// ----

export function createYjsSyncProvider(
    yDoc: YDoc,
    params: {
        remoteDocId: string
    }
) {
    return createCrdtSyncProvider(
        createBaseYjsProvider(yDoc),
        yjsPUpdateEncoder(),
        params
    )
}
// now can also create providers with same api but for any crdt (and I could make a crdt out of reducers too). Hopefully it is similar enough though

export async function createCrdtSyncProvider<CRDTUpdate>(
    localCrdtInterface: localCrdtInterface<CRDTUpdate>,
    localInterfaceUpdateEncoder: CRDTUpdateEncoder<CRDTUpdate>,
    params: {
        remoteDocId: string
    }
) {
    // THIS WOULD BE WHAT createSyncedYDocProviderDemo IS NOW

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
}
