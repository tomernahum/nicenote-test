import { decryptData, encryptData } from "./2-crypto"
import { getServerInterface } from "./2-server-interface-hono-socketio"
import { ObservableList } from "./utils"
import { promiseAllSettled, tryCatch } from "./utils2"

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
    let encryptionConfig = encryptionParams

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

    async function decryptUpdate(encryptedUpdate: Uint8Array) {
        const decryptedMainKey = await tryCatch(
            decryptData(encryptionConfig.mainKey, encryptedUpdate)
        )
        if (!decryptedMainKey.error) {
            return decryptedMainKey.data
        }
        for (const key of encryptionConfig.validOldKeys) {
            const decryptedR = await tryCatch(decryptData(key, encryptedUpdate))
            if (!decryptedR.error) {
                return decryptedR.data
            }
        }
        throw new Error("Failed to decrypt update")
    }
    async function encryptUpdate(encodedUpdate: Uint8Array) {
        const encrypted = await encryptData(
            encryptionConfig.mainKey,
            encodedUpdate
        )
        return encrypted
    }

    async function processNewUpdate(encryptedUpdate: Uint8Array) {
        const decrypted = await decryptUpdate(encryptedUpdate)
        const decoded = decodeUpdateMessage(decrypted)
        return decoded
    }
    //--
    // todo: maybe its better to inline functions in the return (reading wise)

    async function connectToDoc() {
        // TODO deprecate maybe or dont
        await server.connect(docId)
    }

    async function broadcastUpdate(
        bucket: "doc" | "awareness",
        update: Uint8Array
    ) {
        // console.log("broadcasting update", bucket, update)
        // TODO: maybe batch updates

        try {
            const encoded = encodeUpdateMessage(bucket, update)
            const encrypted = await encryptUpdate(encoded)
            console.log("update to broadcast:", bucket, {
                update,
                encoded,
                encrypted,
            })
            await server.addUpdate(docId, encrypted)
        } catch (error) {
            console.error("Failed to broadcast update:", error)
            // TODO: handle error
            // we should handle it by either
            // undoing the update in 0-remote-provider (+ allowing user to be shown notif that something was rejected),
            //      or if we can't we can periodically rerender from only confirmed updates (happens when user reloads the page already)
            //      or we can just detect the error/divergence, tell the user and ask them to reload for proper access
            // or by retrying it (not sure which file is best for that),    or something else
            // or if it is because it's too big for one message, maybe split it into multiple messages
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
            const decoded = await processNewUpdate(update)
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
        //
        const updates = await promiseAllSettled(
            encryptedUpdates.map(async (update) => {
                return processNewUpdate(update.operation)
            })
        )
        const decodedUpdates = updates.fulfilled
        if (updates.rejected.length > 0) {
            console.warn(
                "Failed to process some encrypted updates (skipped them)",
                updates.rejected
            )
        }

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
        swapEncryptionParams: (newParams: EncryptionParams) => {
            // TODO test
            encryptionConfig = newParams
        },
    }
}
