import { decryptData, encryptData } from "./2-crypto"
import { getServerInterface } from "./2-server-interface-hono-socketio"
import { ObservableList } from "./utils"
import { promiseAllSettled, tryCatch } from "./utils2"

type YUpdate = Uint8Array

export type EncryptionParams = {
    mainKey: CryptoKey
    validOldKeys: CryptoKey[]
    // TODO: write key
}

function createDecoder() {}

/** Wraps server interface with encryption and decryption
 *  maybe this should be rolled into 0-remote-provider, lots of unnecessary decoupling tbh makes you have to write the same code like 4 times
 */
export function getProviderServerInterface(
    docId: string,
    encryptionParams: EncryptionParams
) {
    const server = getServerInterface()
    let encryptionConfig = encryptionParams

    const MULTI_UPDATE_PREFIX = 0
    const DOC_PREFIX = 100
    const AWARENESS_PREFIX = 97
    function encodeOneUpdateMessage(
        bucket: "doc" | "awareness",
        update: Uint8Array
    ) {
        const bucketEncoded = bucket === "doc" ? DOC_PREFIX : AWARENESS_PREFIX
        const messageEncoded = new Uint8Array(update.length + 1)
        messageEncoded[0] = bucketEncoded
        messageEncoded.set(update, 1)
        return messageEncoded
    }

    function decodeOneUpdateMessage(message: Uint8Array) {
        const bucket = message[0] === DOC_PREFIX ? "doc" : "awareness"
        const update = message.slice(1)
        return { bucket, update }
    }

    function encodeMultipleUpdatesAsOne(
        updates: {
            bucket: "doc" | "awareness"
            update: Uint8Array
        }[]
    ) {
        function encode4ByteNumber(number: number) {
            if (number < 0 || number > 4294967295) {
                throw new Error("Number out of bounds for 4-byte encoding")
            }
            const buffer = new ArrayBuffer(4)
            const view = new DataView(buffer)
            view.setUint32(0, number, true) // little-endian
            return new Uint8Array(buffer)
        }

        const encodedIndividualUpdates = updates.map((update) =>
            encodeOneUpdateMessage(update.bucket, update.update)
        )
        const outLength =
            1 +
            encodedIndividualUpdates.reduce(
                (acc, update) => acc + update.byteLength + 4, // 4 bytes for length prefix
                0
            )
        const out = new Uint8Array(outLength)
        let currentOffset = 0

        out[0] = MULTI_UPDATE_PREFIX
        currentOffset = 1
        for (const update of encodedIndividualUpdates) {
            const lengthPrefix = encode4ByteNumber(update.byteLength)
            out.set(lengthPrefix, currentOffset)
            currentOffset += 4
            out.set(update, currentOffset)
            currentOffset += update.byteLength
        }
        return out
    }
    function decodeMultiUpdate(message: Uint8Array): {
        bucket: string
        update: Uint8Array
    }[] {
        const updatePrefix = message[0]
        if (updatePrefix !== MULTI_UPDATE_PREFIX) {
            return [decodeOneUpdateMessage(message)]
        }

        function decode4ByteNumber(buffer: Uint8Array) {
            const view = new DataView(
                buffer.buffer,
                buffer.byteOffset,
                buffer.byteLength
            )
            return view.getUint32(0, true)
        }

        const updatesOut: { bucket: string; update: Uint8Array }[] = []
        let currentOffset = 1
        while (currentOffset < message.byteLength) {
            const lengthPrefix = message.slice(currentOffset, currentOffset + 4)
            const length = decode4ByteNumber(lengthPrefix)
            currentOffset += 4
            const update = message.slice(currentOffset, currentOffset + length)
            currentOffset += length
            updatesOut.push(decodeOneUpdateMessage(update))
        }
        return updatesOut
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
        const decoded = decodeOneUpdateMessage(decrypted)
        // const decoded = decodeMultiUpdate(decrypted)

        // TODO, support update that is really multiple updates
        return decoded
    }
    //--

    //--

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
            const encoded = encodeOneUpdateMessage(bucket, update)
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

    async function applySnapshot(snapshots: {
        doc: Uint8Array
        awareness: Uint8Array
        // may make buckets dynamic
    }) {
        // combine snapshots into one, encrypt, send to server
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
