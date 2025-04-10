import { decryptData, encryptData } from "./2-crypto"
import { getServerInterface } from "./2-server-interface-hono-socketio"
import { ObservableList } from "./utils"

type YUpdate = Uint8Array

export type EncryptionParams = {
    mainKey: CryptoKey
    validOldKeys: CryptoKey[]
}

/** Wraps server interface with encryption and decryption
 *  maybe this should be rolled into 0-remote-provider, lots of unnecessary decoupling tbh makes you have to write the same code like 4 times
 */
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
    function decodeUpdateMessage(message: Uint8Array) {
        const bucket = message[0] === 100 ? "doc" : "awareness"
        const update = message.slice(1)
        return { bucket, update }
    }
    //--
    // todo: i think its better to inline functions in the return (reading wise)

    async function connectToDoc() {
        await server.connect(docId)
    }

    async function broadcastUpdate(
        bucket: "doc" | "awareness",
        update: Uint8Array
    ) {
        // console.log("broadcasting update", bucket, update)
        // TODO: maybe batch updates

        const encoded = encodeUpdateMessage(bucket, update)
        const encrypted = await encryptData(encryptionParams.mainKey, encoded)
        try {
            await server.addUpdate(docId, encrypted)
        } catch (error) {
            console.error("Failed to broadcast update:", error)
            // TODO: handle error
            // we should handle it by either
            // undoing the update in 0-remote-provider (+ allowing user to be shown notif that something was rejected),
            // or by retrying it (not sure which file is best for that),    or something else
            throw error
        }

        // TODO: what if update is rejected? Should return that.
        // Currently update is actually never rejected by server, but connection might fail

        return
    }
    async function subscribeToRemoteUpdates(
        bucket: "doc" | "awareness" | "all",
        callback: (update: Uint8Array) => void
    ) {
        await server.subscribeToRemoteUpdates(docId, async (update) => {
            const decrypted = await decryptData(
                encryptionParams.mainKey,
                update
            )
            const decoded = decodeUpdateMessage(decrypted)
            if (bucket !== "all" && decoded.bucket !== bucket) return
            callback(decoded.update)
        })
    }

    // function overload for typing
    function getRemoteUpdateList(
        bucket: "doc" | "awareness"
    ): Promise<Uint8Array[]>
    function getRemoteUpdateList(bucket: "all"): Promise<{
        docUpdates: Uint8Array[]
        awarenessUpdates: Uint8Array[]
    }>
    async function getRemoteUpdateList(bucket: "doc" | "awareness" | "all") {
        // get all the updates
        const encryptedUpdates = await server
            .getRemoteUpdateList(docId)
            .catch((error) => {
                throw new Error(
                    "Error getting remote updates from the server",
                    {
                        cause: error,
                    }
                )
            })
        const decryptedUpdates = (
            await Promise.all(
                encryptedUpdates.map(async (update) => {
                    try {
                        const decrypted = await decryptData(
                            encryptionParams.mainKey,
                            update.operation
                        )
                        return {
                            serverId: update.id,
                            operation: decrypted,
                        }
                    } catch (error) {
                        console.warn(
                            "Error decrypting remote update, ignoring it",
                            error
                        )
                        return undefined
                    }
                })
            )
        ).filter((update) => update !== undefined)

        const decodedUpdates = decryptedUpdates
            .map((update) => {
                try {
                    const decoded = decodeUpdateMessage(update.operation)

                    return decoded
                } catch (error) {
                    console.warn(
                        "Error interpreting remote update format, ignoring it",
                        error
                    )
                    return undefined
                }
            })
            .filter((update) => update !== undefined)

        // sort the updates
        if (bucket === "all") {
            const docUpdates = decodedUpdates.filter(
                (update) => update.bucket === "doc"
            )
            const awarenessUpdates = decodedUpdates.filter(
                (update) => update.bucket === "awareness"
            )
            return {
                docUpdates: docUpdates.map((update) => update.update),
                awarenessUpdates: awarenessUpdates.map(
                    (update) => update.update
                ),
            }
        } else {
            const relevantDecodedUpdates = decodedUpdates
                .filter((update) => update.bucket === bucket)
                .map((update) => update.update)
            return relevantDecodedUpdates
        }
    }

    return {
        connectToDoc,
        broadcastUpdate,
        subscribeToRemoteUpdates,
        getRemoteUpdateList,
        disconnect: () => {
            server.disconnect()
        },
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
