import { decodeList, encodeList } from "../shared/binary-encoding-helpers"
import { prettyUpdateObj, type Update, type UpdateOptRow } from "./0-data-model"
import {
    createUpdateFactory,
    type ProviderEncryptionConfig,
} from "./1-crypto-update-factory"
import { getServerInterface } from "./2-server-interface-hono-socketio"

// encryption logic in 1-crypto-update-factory
// encoding logic also in 1-crypto-update-factory

export function getProviderServerInterface(
    docId: string,
    encryptionParams: ProviderEncryptionConfig
) {
    const { clientMessagesToServerMessage, serverMessageToClientMessages } =
        createUpdateFactory(encryptionParams)

    const server = getServerInterface()

    // --
    let receivedUpdatesCache: Update[] = []
    let subscriberCallbacks: ((update: Update) => void)[] = []

    function getHighestSeenRowIdFromCached() {
        // TODO: replace with highest row id seen where we have seen all sequential updates up to that row.
        // this would solve for case where we heard about updates out of order (not the same order they were committed to the server db)
        // which may or may not actually happen
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

        const decodedUpdatesPromises = encryptedUpdates.map(
            serverMessageToClientMessages
        )

        const decodedUpdates = (
            await Promise.all(decodedUpdatesPromises)
        ).flat()

        receivedUpdatesCache = decodedUpdates
    }
    // --

    async function broadcastSnapshot(
        snapshot: UpdateOptRow[],
        lastUpdateRowToReplace: number | "auto"
    ) {
        const withoutRows = snapshot.map((u) => ({
            bucket: u.bucket,
            operation: u.operation,
        }))
        const serverMessage = await clientMessagesToServerMessage(withoutRows)

        const lastUpdateRow =
            lastUpdateRowToReplace === "auto"
                ? getHighestSeenRowIdFromCached()
                : lastUpdateRowToReplace
        console.info("broadcasting snapshot", {
            lastUpdateRow,
            snapshot: snapshot.map(prettyUpdateObj),
        })
        await server.applySnapshot(docId, serverMessage, lastUpdateRow)
        //
    }

    return {
        connect: async function () {
            console.info("1- connecting to doc server")
            await server.connect(docId)

            // initialize memory cache
            await refreshCache()
            await server.subscribeToRemoteUpdates(
                docId,
                async (update, updateRow) => {
                    const updates = await serverMessageToClientMessages({
                        rowId: updateRow,
                        sealedMessage: update,
                    })
                    console.info(
                        "received update(s)",
                        await prettyUpdateObj(updates[0]),
                        updates
                    )
                    receivedUpdatesCache.push(...updates)

                    subscriberCallbacks.forEach((callback) => {
                        updates.forEach((update) => {
                            callback(update)
                        })
                    })
                }
            )
            // console.log("1- finished connecting to doc server", {
            //     length: receivedUpdatesCache.length,
            //     receivedUpdatesCache,
            // })
        },
        disconnect: async function () {
            return await server.disconnect()
        },

        getRemoteUpdateList(forceRefresh = false) {
            if (forceRefresh) {
                return refreshCache().then(() => receivedUpdatesCache)
            }
            return receivedUpdatesCache
        },
        refreshCache,
        subscribeToRemoteUpdates(callback: (update: Update) => void) {
            subscriberCallbacks.push(callback)
            return () => {
                subscriberCallbacks = subscriberCallbacks.filter(
                    (cb) => cb !== callback
                )
            }
        },

        broadcastUpdate: async function (update: UpdateOptRow) {
            // TODO: maybe batch updates
            // TODO: make sure we are handling update rejection & send failure
            try {
                const sealed = await clientMessagesToServerMessage([update])
                console.info("broadcasting update:", {
                    bucket: update.bucket,
                    plainText: update,
                    sealed,
                })
                await server.addUpdate(docId, sealed)

                // on success hopefully server will notify us!
            } catch (error) {
                console.error("Failed to broadcast update:", error)
                // TODO: handle error or explicit server rejection (current server never rejects)
                // we should handle it by either
                // undoing the update in 0-remote-provider (+ allowing user to be shown notif that something was rejected),
                //      or if we can't we can periodically rerender from only confirmed updates (happens when user reloads the page already)
                //      or we can just detect the error/divergence, tell the user and ask them to reload for proper access
                // ie just throw the error and catch it in the provider
                // or by retrying it (not sure which file is best for that),    or something else
                // or if it is because it's too big for one message, maybe split it into multiple messages
                throw error
            }
        },

        /**
         * Manually do a snapshot
         * Probably easier to safely call createSnapshot instead
         * Snapshot is made out of multiple updates (will be encrypted together and sent as one update to the server),
         * anything not captured in the snapshot will be lost
         * recommended: one update per bucket
         */
        broadcastSnapshot,

        /**  */
        async createSnapshot(
            callback: (
                currentDoc: typeof receivedUpdatesCache
            ) => Parameters<typeof broadcastSnapshot>[0],
            refresh = true
        ) {
            if (refresh) {
                await refreshCache()
            }
            const lastUpdateRow = getHighestSeenRowIdFromCached()
            const res = callback(receivedUpdatesCache)
            return await broadcastSnapshot(res, lastUpdateRow)
        },

        // todo encryption swapping
    }
}
