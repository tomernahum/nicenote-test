import { localCrdtInterfaceO } from "./0-provider"
import { CRDTUpdateEncoder } from "./0-provider"
import { createCryptoFactory, CryptoConfig } from "./2-crypto-factory"
import { getServerInterface } from "./1-server-client"
import { ClientUpdate } from "./-types"
import { decodeList, encodeList } from "../crypto/1-encodingList"
import { createObservable } from "./ts-helper-lib"

/* 
On load:
1. load the cache & display that
2. fetch/connect to the remote/canonical state
3. merge the remote state and the cache state
4. keep the cache updated with remote state
5. on connection loss or failure, use the cache and go back to step one
(create a new doc by first creating an empty cache and then creating a new remote doc)


*/

// This file is still WIP

export async function createOnlineOfflineStateManager<CRDTUpdate>(
    localCrdtInterface: localCrdtInterfaceO<CRDTUpdate>,
    localInterfaceUpdateEncoder: CRDTUpdateEncoder<CRDTUpdate>,
    // later we may dependency inject serverInterface and especially local storage interface
    params: {
        remoteDocId: string
        cryptoConfig: CryptoConfig
        timeBatchingConfig?: Parameters<typeof getServerInterface>[2]
        mergeInitialState?: boolean //note to caller: if set to false and doc has any initial state than it might diverge
        snapshotIntervalMs?: number
        snapshotMinUpdateCount?: number
        // TODO
        //onReconnect?: "mergeLocalStateIntoOnline" | "replaceLocalStateWithOnline"
    }
) {
    // setup objects (might get passed in later)
    const storage = getLocalStorageInterface(
        params.remoteDocId,
        params.cryptoConfig
    )
    const server = getServerInterface(
        params.remoteDocId,
        params.cryptoConfig,
        params.timeBatchingConfig ?? {
            timeBetweenUpdatesMs: 200,
            sendUpdatesToServerWhenNoUserUpdate: true,
            // sendUpdatesToServerWhenNoUserUpdate: false,
        }
    ) // I think this does not auto connect until we call .connect()

    // ----

    const { storageConnectionPromise, serverConnectionPromise, internalState } =
        setupStorageAndServerConnections(server, storage)

    function getMainState() {
        if (internalState.serverConnectionStatus === "connected") {
            return internalState.onlineState
        }
        if (internalState.storageConnectionStatus === "connected") {
            return internalState.storageState
        }
        return [] //null,
    }

    let out = {
        getMainState,

        getCryptoConfig: server.getCryptoConfig,
        setCryptoConfig: (newCryptoConfig: CryptoConfig) => {
            server.setCryptoConfig(newCryptoConfig)
            storage.setCryptoConfig(newCryptoConfig)
        },
        changeCryptoConfig: async (
            callback: (cryptoConfig: CryptoConfig) => Promise<CryptoConfig>
        ) => {
            const newCryptoConfig = await callback(server.getCryptoConfig())
            server.setCryptoConfig(newCryptoConfig)
            storage.setCryptoConfig(newCryptoConfig)
        },
    }
}
// nvmnd
function setupStorageAndServerConnections(
    server: ReturnType<typeof getServerInterface>,
    storage: ReturnType<typeof getLocalStorageInterface>
) {
    const internalState = {
        serverConnectionStatus: "connecting" as
            | "connecting"
            | "connected"
            | "could not connect"
            | "disconnected",
        onlineState: [] as ClientUpdate[],

        storageConnectionStatus: "connecting" as
            | "connecting"
            | "connected"
            | "could not connect"
            | "disconnected",
        storageState: [] as ClientUpdate[],
    }

    async function onServerConnected() {
        internalState.onlineState = (await server.getRemoteUpdateList()).map(
            (update) => update.update
        )

        server.subscribeToRemoteUpdates((updates, rowId) => {
            internalState.onlineState =
                internalState.onlineState.concat(updates)
            storage.applySnapshot(internalState.onlineState) // may fail if storage is not connected/available
        })

        internalState.serverConnectionStatus = "connected"
    }

    async function onStorageConnected() {
        internalState.storageConnectionStatus = "connected"
        internalState.storageState = await storage.getStateAsUpdates()
    }

    const storageConnectionPromise = storage
        .connect()
        .then(() => {
            onStorageConnected()
            // todo maybe: detect storage connection loss and stuff
        })
        .catch((e) => {
            internalState.storageConnectionStatus = "could not connect"
            console.warn("could not connect to storage for a doc", e)

            // todo maybe: try to reconnect (maybe end user needs to trigger reconnection after permissions granted, or they can just reload the whole doc)
        })

    const serverConnectionPromise = server
        .connect()
        .then(() => {
            onServerConnected()
            server.onConnectionLost(() => {
                internalState.serverConnectionStatus = "disconnected"
            })
            // todo: try to reconnect  (or maybe this goes in the server interface?)
        })
        .catch((e) => {
            internalState.serverConnectionStatus = "could not connect"
            console.warn("could not connect to server for a doc", e)

            // todo: try to reconnect (or maybe this goes in the server interface?)
        })

    return {
        storageConnectionPromise,
        serverConnectionPromise,
        internalState,
    }
}

//

//
export function getLocalStorageInterface(
    docId: string,
    cryptoConfig: CryptoConfig
) {
    function base64Encode(bytes: Uint8Array | ArrayBuffer) {
        const realBytes = "buffer" in bytes ? bytes : new Uint8Array(bytes)

        const binString = Array.from(realBytes, (x) =>
            String.fromCodePoint(x)
        ).join("")
        return btoa(binString)
    }
    function base64Decode(base64: string) {
        const binString = atob(base64)
        return Uint8Array.from(binString, (m) => m.codePointAt(0) as number)
    }
    const crypto = createCryptoFactory(cryptoConfig) // crypto is designed for client-server communication but we use it here too for some encryption at rest on the client

    // we want to store a list of binary updates. But we can only store a string in LS
    function encodeListToLS(updates: Uint8Array[]) {
        return base64Encode(encodeList(updates))
    }
    function decodeListFromLS(encoded: string) {
        return decodeList(base64Decode(encoded))
    }

    const ADDRESS = `doc-cache-${docId}`

    return {
        connect: async () => {
            localStorage.getItem(ADDRESS)
        },
        addUpdates: async (updates: ClientUpdate[]) => {
            const sealedUpdate = await crypto.clientMessagesToSealedMessage(
                updates
            )

            const existing = localStorage.getItem(ADDRESS) ?? encodeListToLS([])
            const existingDecoded = decodeListFromLS(existing)
            const merged = existingDecoded.concat(sealedUpdate)
            localStorage.setItem(ADDRESS, encodeListToLS(merged))

            return merged.length // returns index number of last added operation
        },
        getStateAsUpdates: async () => {
            const storageResult =
                localStorage.getItem(`doc-cache-${docId}`) ?? encodeListToLS([])
            const decodedList = decodeListFromLS(storageResult)
            const decryptedList = (
                await Promise.all(
                    decodedList.map(crypto.sealedMessageToClientMessages)
                )
            ).flat()
            return decryptedList
        },
        applySnapshot: async (
            snapshot: ClientUpdate[],
            lastUpdateRowToReplace?: number
        ) => {
            const sealedSnapshot = await crypto.clientMessagesToSealedMessage(
                snapshot
            )

            const existing = localStorage.getItem(ADDRESS) ?? encodeListToLS([])
            const existingDecoded = decodeListFromLS(existing)

            const existingAfterIndex =
                lastUpdateRowToReplace === undefined
                    ? []
                    : existingDecoded.slice(lastUpdateRowToReplace + 1) // [0, 1,2,3,4,5] -> 3 => [4,5]

            const merged = [sealedSnapshot, ...existingAfterIndex]
            localStorage.setItem(ADDRESS, encodeListToLS(merged))
        },
        getCryptoConfig: crypto.getCryptoConfig,
        setCryptoConfig: crypto.changeCryptoConfig,
    }
}

// type StorageInterface = {
//     connect: () => void
//     get: () => ClientUpdate[]
//     addUpdates: (updates: ClientUpdate[]) => Promise<number>
//     applySnapshot: (
//         snapshot: ClientUpdate[],
//         lastUpdateRowToReplace?: number
//     ) => void
// }
