// type LocalUpdate = Uint8Array
// interface LocalProvider {
//     subscribeToLocalUpdates: (update: LocalUpdate) => void
//     applyRemoteUpdate: (update: LocalUpdate) => void
// }

import { ClientUpdate, DocId } from "./-types"
import { bindFirst, BoundFirstAll } from "./-utils"
import { CryptoFactory } from "./2-crypto-factory"
import { BaseServerConnectionInterfaceShape } from "./3-server-connection"

export function getBasicEncryptedServerInterface(
    server: BaseServerConnectionInterfaceShape,
    crypto: CryptoFactory
) {
    // very similar to BaseServerConnectionInterfaceShape, but some variation
    return {
        crypto,

        connect: () => server.connect(),
        disconnect: () => server.disconnect(),

        addUpdates: async (docId: DocId, updates: ClientUpdate[]) => {
            const sealedUpdate = await crypto.clientMessagesToSealedMessage(
                updates
            )
            return server.addUpdate(docId, sealedUpdate)
        },
        subscribeToRemoteUpdates: (
            docId: DocId,
            callback: (newUpdates: ClientUpdate[], rowId: number) => void
        ) =>
            server.subscribeToRemoteUpdates(
                docId,
                async (sealedMessage, rowId) => {
                    const decryptedUpdates =
                        await crypto.sealedMessageToClientMessages(
                            sealedMessage
                        )
                    callback(decryptedUpdates, rowId)
                }
            ),
        getRemoteUpdateList: (docId: DocId) =>
            server.getRemoteUpdateList(docId),

        /** @param updates recommended to be one update per bucket */
        applySnapshot: async (
            docId: DocId,
            updates: ClientUpdate[],
            lastUpdateRowToReplace: number // may change. see 3-server-connection.ts
        ) => {
            const sealedUpdate = await crypto.clientMessagesToSealedMessage(
                updates
            )
            server.applySnapshot(docId, sealedUpdate, lastUpdateRowToReplace)
        },
    }
}

export function getServerInterfaceWithTimeBatching(
    docId: DocId,
    server: BaseServerConnectionInterfaceShape,
    crypto: CryptoFactory, // takes cryptoConfig. might refactor how it is passed.
    timeBatchingConfig: {
        timeBetweenUpdatesMs: number
        sendUpdatesToServerWhenNoUserUpdate: boolean // if true, will send an update to the server even if there are no new updates from the user, this is done to obfuscate to the server when/how often the user is making updates (eg how much they are typing)
        // TODO maybe: if user is not generating updates, send updates periodically but not as frequently as if they are generating updates

        // minTimeBetweenUpdatesMs: number,
        // maxTimeBetweenUpdatesMs: number | "unlimited",
    }
) {
    let timeBatchingConfigReal = timeBatchingConfig
    let connected = false

    const basicInterface = getBasicEncryptedServerInterface(server, crypto)

    const queuedUpdates: {
        update: ClientUpdate[]
        promiseResolver: () => void
    }[] = []
    const queuedSnapshots: {
        updates: ClientUpdate[]
        lastUpdateRowToReplace: number
        promiseResolver: () => void
    }[] = []

    async function onTimeToSendUpdates() {
        if (!connected) return

        const updatesToSend = queuedUpdates.map(({ update }) => update).flat()
        // just send the last snapshot if there are multiple
        const snapshotToSend = queuedSnapshots.at(-1)

        // Todo maybe: we could merge the update into the snapshot so that server doesn't know if an update was made at time a snapshot was made (server has to know when a snapshot happens)
        if (
            updatesToSend.length > 0 ||
            timeBatchingConfigReal.sendUpdatesToServerWhenNoUserUpdate
        ) {
            await basicInterface.addUpdates(docId, updatesToSend) // this will encrypt them all into one message to the server
        }
        if (snapshotToSend) {
            await basicInterface.applySnapshot(
                docId,
                snapshotToSend.updates,
                snapshotToSend.lastUpdateRowToReplace
            )
        }

        // resolve promises
        queuedUpdates.forEach(({ promiseResolver }) => promiseResolver())
        queuedUpdates.splice(0, queuedUpdates.length) // clear

        queuedSnapshots.forEach(({ promiseResolver }) => promiseResolver()) // note: we resolve the promises of each snapshot even though we only apply the last one
        queuedSnapshots.splice(0, queuedSnapshots.length) // clear
    }

    const intervalId = setInterval(
        onTimeToSendUpdates,
        timeBatchingConfigReal.timeBetweenUpdatesMs
    )

    const returnValuePart: BoundFirstAll<typeof basicInterface> = {
        crypto: basicInterface.crypto,

        addUpdates: async (updates: ClientUpdate[]) => {
            const promise = new Promise<void>((resolve) => {
                queuedUpdates.push({
                    update: updates,
                    promiseResolver: resolve,
                })
            })
            return promise
        },

        applySnapshot: async (
            updates: ClientUpdate[],
            lastUpdateRowToReplace: number
        ) => {
            const promise = new Promise<void>((resolve) => {
                queuedSnapshots.push({
                    updates,
                    lastUpdateRowToReplace,
                    promiseResolver: resolve,
                })
            })
            return promise
        },

        // Todo maybe: May want to time-batch the reading functions too? (Or even the connection?)
        // these will pretty much be called once each per doc, after connection. though maybe it will one day be used in an unexpected way
        subscribeToRemoteUpdates: bindFirst(
            basicInterface.subscribeToRemoteUpdates,
            docId
        ),
        getRemoteUpdateList: bindFirst(
            basicInterface.getRemoteUpdateList,
            docId
        ),

        connect: async () => {
            await basicInterface.connect()
            connected = true
        },
        // TODO: maybe make disconnect based on docId, because right now it will possibly disconnect anything else with the same instance of BaseServerConnectionInterfaceShape, and may not clear their interval
        disconnect: () => {
            clearInterval(intervalId)
            connected = false
            return basicInterface.disconnect()
        },
    }
    return {
        ...returnValuePart,
        getTimeBatchingConfig: () => timeBatchingConfigReal,
        setTimeBatchingConfig: (newConfig) =>
            (timeBatchingConfigReal = newConfig),
    }
}
