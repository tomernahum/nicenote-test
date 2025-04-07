import { getServerInterface } from "./3-server-interface-ws"
import { ObservableList } from "./utils"

type YUpdate = Uint8Array

export type EncryptionParams = {
    mainKey: CryptoKey
    validOldKeys: CryptoKey[]
}

/** Wraps server interface with encryption and decryption */
export function getProviderServerInterface(
    docId: string,
    encryptionParams: EncryptionParams
) {
    const server = getServerInterface()

    function encodeUpdateMessage(
        bucket: "doc" | "awareness",
        update: Uint8Array
    ) {
        const bucketEncoded = bucket === "doc" ? 100 : 97 // ascii values for 'd' and 'a'
        const messageEncoded = new Uint8Array(update.length + 1)
        messageEncoded[0] = bucketEncoded
        messageEncoded.set(update, 1)
        return messageEncoded
    }

    async function connectToDoc() {}

    async function broadcastUpdate(
        bucket: "doc" | "awareness",
        update: Uint8Array
    ) {
        // TODO: maybe batch updates

        const encoded = encodeUpdateMessage(bucket, update)

        return
    }

    return {
        connectToDoc,

        // connectToDoc,
        // getRemoteUpdateList,
        // subscribeToRemoteUpdates,
        // broadcastUpdate,
        // doSquash,
    }
}

// make sure we are connected to server, make sure the doc is initialized
// export async function connectToDoc(docId: string) {
//     // connect to server
//     // make sure the doc is initialized
// }

// // returns a list of yjs updates, can be processed by the provider into a yjs doc
// export async function getRemoteUpdateList(docId: string) {
//     return {
//         docUpdates: [],
//         awarenessUpdates: [],
//         // could one day add other buckets for things outside of yjs (like a reducer based one, or other crdts). Or maybe do it in a separate system idk
//     }
// }

// // register callback for when a new update is received
// export async function subscribeToRemoteUpdates(
//     docId: string,
//     bucket: "doc" | "awareness", // could later add other buckets
//     callback: (update: Uint8Array) => void
// ) {}

// export async function broadcastUpdate(
//     docId: string,
//     bucket: "doc" | "awareness",
//     update: Uint8Array
// ) {
//     // encode
//     // encrypt
//     //send
// }

// // TODO TODO // also need to figure out where to implement this...
// export async function doSquash(
//     docId: string,
//     lastSeenUpdateIdentifier: unknown,
//     newUpdate: Uint8Array
// ) {}

// ------
