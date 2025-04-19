import { decodeList, encodeList } from "../shared/binary-encoding-helpers"
import {
    getRemoteUpdateList,
    subscribeToRemoteUpdates,
} from "./1--mock-server-interface"
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

type Bucket = "doc" | "awareness"

function createEncodingLogic(
    docId: string,
    encryptionParams: EncryptionParams
) {
    const MULTI_UPDATE_PREFIX = 0
    const DOC_PREFIX = 100
    const AWARENESS_PREFIX = 97
    function encodeOneUpdateMessage(bucket: Bucket, update: Uint8Array) {
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
            bucket: Bucket
            update: Uint8Array
        }[]
    ) {
        const encoded = encodeList(
            updates.map((update) =>
                encodeOneUpdateMessage(update.bucket, update.update)
            )
        )
        const out = new Uint8Array(encoded.length + 1)

        out[0] = MULTI_UPDATE_PREFIX
        out.set(encoded, 1)
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

        const out = decodeList(message.slice(1))
        return out.map((update) => decodeOneUpdateMessage(update))
    }
    return {
        encodeOneUpdateMessage,
        encodeMultipleUpdatesAsOne,
        decodeMultiUpdate,
    }
}

function createEncryptionLogic(
    docId: string,
    encryptionConfig: EncryptionParams
) {
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

    return {
        decryptUpdate,
        encryptUpdate,
    }
}

export function getProviderServerInterfaceNew(
    docId: string,
    encryptionParams: EncryptionParams
) {
    const {
        encodeOneUpdateMessage,
        encodeMultipleUpdatesAsOne,
        decodeMultiUpdate,
    } = createEncodingLogic(docId, encryptionParams)

    const { decryptUpdate, encryptUpdate } = createEncryptionLogic(
        docId,
        encryptionParams
    )

    async function decryptAndDecodeUpdate(update: {
        rowId: number
        operation: Uint8Array<ArrayBufferLike>
    }) {
        try {
            const decrypted = await decryptUpdate(update.operation)
            const decoded = decodeMultiUpdate(decrypted)
            const updates = decoded.map((d) => ({
                ...d,
                rowId: update.rowId,
            }))

            return updates
        } catch (e) {
            console.warn(
                "Failed to decode an encrypted update, skipped applying it",
                e
            )
            return []
        }
    }

    const server = getServerInterface()

    // --
    type Update = {
        bucket: string
        rowId: number // row id of the update on the server
        update: Uint8Array
    }
    let receivedUpdatesCache: Update[] = []
    let subscriberCallbacks: ((update: Update) => void)[] = []

    function getHighestSeenRowIdFromCached() {
        if (receivedUpdatesCache.length == 0) {
            throw "length was 0"
        }
        let highest = receivedUpdatesCache[0].rowId
        for (const update of receivedUpdatesCache) {
            if (update.rowId > highest) {
                highest = update.rowId
            }
        }
        return highest
    }

    async function refreshCache() {
        const encryptedUpdates = await server.getRemoteUpdateList(docId)

        receivedUpdatesCache = []
        encryptedUpdates.forEach(async (update) => {
            const decodedUpdates = await decryptAndDecodeUpdate({
                rowId: update.id,
                operation: update.operation,
            })
            receivedUpdatesCache.push(...decodedUpdates)
        })
    }
    // --

    async function broadcastSnapshot(
        snapshot: {
            rowId?: number
            bucket: Bucket
            update: Uint8Array
        }[],
        lastUpdateRowToReplace: number
    ) {
        snapshot satisfies Omit<Update, "rowId">[]

        const withoutRows = snapshot.map((u) => ({
            bucket: u.bucket,
            update: u.update,
        }))
        const encoded = encodeMultipleUpdatesAsOne(withoutRows)
        const encrypted = await encryptUpdate(encoded)

        await server.applySnapshot(docId, encrypted, lastUpdateRowToReplace)
    }

    return {
        connect: async function () {
            await server.connect(docId)

            // initialize memory cache
            refreshCache()
            await server.subscribeToRemoteUpdates(
                docId,
                async (update, updateRow) => {
                    const updates = await decryptAndDecodeUpdate({
                        rowId: updateRow,
                        operation: update,
                    })
                    receivedUpdatesCache.push(...updates)

                    subscriberCallbacks.forEach((callback) => {
                        updates.forEach((update) => {
                            callback(update)
                        })
                    })
                }
            )
        },
        disconnect: async function () {
            server.disconnect()
        },

        getRemoteUpdateList(forceRefresh = false) {
            if (forceRefresh) {
                return refreshCache().then(() => receivedUpdatesCache)
            }
            return receivedUpdatesCache
        },
        subscribeToRemoteUpdates(callback: (update: Update) => void) {
            subscriberCallbacks.push(callback)
            return () => {
                subscriberCallbacks = subscriberCallbacks.filter(
                    (cb) => cb !== callback
                )
            }
        },

        broadcastUpdate: async function (
            bucket: Bucket,
            operation: Uint8Array
        ) {
            // TODO: maybe batch updates
            // TODO: make sure we are handling update rejection & send failure
            try {
                const encoded = encodeOneUpdateMessage(bucket, operation)
                const encrypted = await encryptUpdate(encoded)
                console.log("update to broadcast:", bucket, {
                    operation,
                    encoded,
                    encrypted,
                })
                await server.addUpdate(docId, encrypted)
            } catch (error) {
                console.error("Failed to broadcast update:", error)
                // TODO: handle error or explicit server rejection (current server never rejects)
                // we should handle it by either
                // undoing the update in 0-remote-provider (+ allowing user to be shown notif that something was rejected),
                //      or if we can't we can periodically rerender from only confirmed updates (happens when user reloads the page already)
                //      or we can just detect the error/divergence, tell the user and ask them to reload for proper access
                // or by retrying it (not sure which file is best for that),    or something else
                // or if it is because it's too big for one message, maybe split it into multiple messages
                throw error
            }
        },

        /**
         * Manually do a snapshot
         * Snapshot is made out of multiple updates (will be encrypted together and sent as one update to the server),
         * anything not captured in the snapshot will be lost
         * recommended: one update per bucket
         */
        broadcastSnapshot,

        /**  */
        async createSnapshot(
            callback: (
                currentDoc: typeof receivedUpdatesCache
            ) => Parameters<typeof broadcastSnapshot>[0]
        ) {
            const lastUpdateRow = getHighestSeenRowIdFromCached()
            const res = callback(receivedUpdatesCache)
            return await broadcastSnapshot(res, lastUpdateRow)
        },

        // todo encryption swapping
    }
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

    //
    let lastKnownUpdateId: number | null = null

    //

    const MULTI_UPDATE_PREFIX = 0
    const DOC_PREFIX = 100
    const AWARENESS_PREFIX = 97
    function encodeOneUpdateMessage(bucket: Bucket, update: Uint8Array) {
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
            bucket: Bucket
            update: Uint8Array
        }[]
    ) {
        const encoded = encodeList(
            updates.map((update) =>
                encodeOneUpdateMessage(update.bucket, update.update)
            )
        )
        const out = new Uint8Array(encoded.length + 1)

        out[0] = MULTI_UPDATE_PREFIX
        out.set(encoded, 1)
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

        const out = decodeList(message.slice(1))
        return out.map((update) => decodeOneUpdateMessage(update))
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

    // nevermind for now: /** Also updates lastKnownUpdateId */
    async function decryptAndDecodeNewUpdate(encryptedUpdate: Uint8Array) {
        const decrypted = await decryptUpdate(encryptedUpdate)
        const decoded = decodeMultiUpdate(decrypted)

        return decoded
    }
    //--

    //--

    async function connectToDoc() {
        // TODO deprecate maybe or dont
        await server.connect(docId)
    }

    async function broadcastUpdate(bucket: Bucket, update: Uint8Array) {
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

    /**
     * Snapshot is made out of multiple updates (will be encrypted together and sent as one update to the server),
     * anything not captured in the snapshot will be lost
     * recommended: one update per bucket
     */
    async function applySnapshot(
        updates: {
            bucket: Bucket
            update: Uint8Array
        }[]
    ) {
        // combine snapshots into one, encrypt, send to server
        const encoded = encodeMultipleUpdatesAsOne(updates)

        const encrypted = await tryCatch(encryptUpdate(encoded))
        if (encrypted.error) {
            console.error(
                "Failed to encrypt snapshot (could be because document is too long):",
                encrypted.error
            )
            throw encrypted.error
        }

        const lastKnownId = -1 // TODO

        console.log("applying snapshot!")
        await server.applySnapshot(docId, encrypted.data, lastKnownId)
    }

    async function subscribeToRemoteUpdates(
        bucket: Bucket | "all",
        callback: (update: Uint8Array) => void
    ) {
        await server.subscribeToRemoteUpdates(docId, async (update) => {
            const updates = await decryptAndDecodeNewUpdate(update)
            for (const update of updates) {
                if (bucket !== "all" && update.bucket !== bucket) return
                callback(update.update)
            }
        })
    }

    // function overload for typing
    function getRemoteUpdateList(bucket: Bucket): Promise<Uint8Array[]>
    function getRemoteUpdateList(bucket: "all"): Promise<{
        docUpdates: Uint8Array[]
        awarenessUpdates: Uint8Array[]
    }>
    async function getRemoteUpdateList(bucket: Bucket | "all") {
        // get all the updates
        const encryptedUpdatesFromServer = await server
            .getRemoteUpdateList(docId)
            .catch((error) => {
                throw new Error(
                    "Error getting remote updates from the server",
                    {
                        cause: error,
                    }
                )
            })
        const updatePromises = await promiseAllSettled(
            encryptedUpdatesFromServer.map(async (update) => {
                return decryptAndDecodeNewUpdate(update.operation)
            })
        )
        if (updatePromises.rejected.length > 0) {
            console.warn(
                "Failed to process some encrypted updates (skipped them)",
                updatePromises.rejected
            )
        }
        const updates = updatePromises.fulfilled.flat()

        // sort the updates
        if (bucket === "all") {
            const docUpdates = updates.filter(
                (update) => update.bucket === "doc"
            )
            const awarenessUpdates = updates.filter(
                (update) => update.bucket === "awareness"
            )
            return {
                docUpdates: docUpdates.map((update) => update.update),
                awarenessUpdates: awarenessUpdates.map(
                    (update) => update.update
                ),
            }
        } else {
            const relevantDecodedUpdates = updates
                .filter((update) => update.bucket === bucket)
                .map((update) => update.update)
            return relevantDecodedUpdates
        }
    }

    return {
        connectToDoc,
        broadcastUpdate,
        applySnapshot,
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
