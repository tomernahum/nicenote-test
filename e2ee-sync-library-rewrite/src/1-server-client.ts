// type LocalUpdate = Uint8Array
// interface LocalProvider {
//     subscribeToLocalUpdates: (update: LocalUpdate) => void
//     applyRemoteUpdate: (update: LocalUpdate) => void
// }

import { type ClientUpdate, type DocId } from "./-types"
import { bindFirst, type BoundFirstAll } from "./-utils"
import {
    createCryptoFactory,
    type CryptoConfig,
    type CryptoFactoryI,
} from "./2-crypto-factory"
import {
    type BaseServerConnectionInterfaceShape,
    getBaseServerConnectionInterface,
} from "./3-server-connection"

export function getServerInterface(
    docId: DocId,
    cryptoConfig: CryptoConfig,
    timeBatchingConfig: Parameters<
        typeof getServerInterfaceWithTimeBatching
    >[3],
    serverConnectionInterface?: BaseServerConnectionInterfaceShape,
    cryptoFactory?: CryptoFactoryI
) {
    const serverConnectionInterfaceReal =
        serverConnectionInterface ?? getBaseServerConnectionInterface()
    const cryptoFactoryReal = cryptoFactory ?? createCryptoFactory(cryptoConfig)
    const server = getServerInterfaceWithTimeBatching(
        docId,
        serverConnectionInterfaceReal,
        cryptoFactoryReal,
        timeBatchingConfig
    )
    return {
        ...server,
        // time batching config is returned by the above line
        getCryptoConfig: server.crypto.getCryptoConfig,
        setCryptoConfig: server.crypto.changeCryptoConfig,
    }
}

// also binds to a doc apparently.
// TODO: rewrite this whole function. Split out the part that does the time batching vs the part that binds it to the doc id. Maybe even rewrite this whole file
function getServerInterfaceWithTimeBatching(
    docId: DocId,
    server: BaseServerConnectionInterfaceShape,
    crypto: CryptoFactoryI, // takes cryptoConfig. might refactor how it is passed.
    timeBatchingConfig: {
        timeBetweenUpdatesMs: number
        sendUpdatesToServerWhenNoUserUpdate: boolean // if true, will send an update to the server even if there are no new updates from the user, this is done to obfuscate to the server when/how often the user is making updates (eg how much they are typing)
        // TODO maybe: if user is not generating updates, send updates periodically but not as frequently as if they are generating updates // if this actually provides a security benefit...

        // minTimeBetweenUpdatesMs: number,
        // maxTimeBetweenUpdatesMs: number | "unlimited",
    }
) {
    // TODO: IDEA: option to replay events with same delay that they came in (encode that data into the plaintext)
    let timeBatchingConfigReal = timeBatchingConfig
    let connected = false

    const basicInterface = getBasicEncryptedServerInterface(server, crypto)

    const queuedUpdates: {
        update: ClientUpdate[]
        promiseResolver: (rowId: number) => void
    }[] = []
    const queuedSnapshots: {
        updates: ClientUpdate[]
        lastUpdateRowToReplace: number
        promiseResolver: (rowId: number) => void
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
            const updatesRowId = await basicInterface.addUpdates(
                docId,
                updatesToSend
            ) // this will encrypt them all into one message to the server

            // resolve promises
            queuedUpdates.forEach(({ promiseResolver }) =>
                promiseResolver(updatesRowId)
            )
            queuedUpdates.splice(0, queuedUpdates.length) // clear
        }
        if (snapshotToSend) {
            const snapshotRowId = await basicInterface.applySnapshot(
                docId,
                snapshotToSend.updates,
                snapshotToSend.lastUpdateRowToReplace
            )

            // resolve promises
            // note: we resolve the promises of each snapshot even though we only apply the last one
            queuedSnapshots.forEach(({ promiseResolver }) =>
                promiseResolver(snapshotRowId)
            )
            queuedSnapshots.splice(0, queuedSnapshots.length) // clear
        }
    }

    let intervalId = setInterval(
        onTimeToSendUpdates,
        timeBatchingConfigReal.timeBetweenUpdatesMs
    )

    function setTheUpdateSendingInterval() {
        clearInterval(intervalId)
        intervalId = setInterval(
            onTimeToSendUpdates,
            timeBatchingConfigReal.timeBetweenUpdatesMs
        )
    }
    basicInterface.onConnected(() => {
        connected = true
        setTheUpdateSendingInterval()
    })
    basicInterface.onDisconnected(() => {
        clearInterval(intervalId)
        connected = false
    })

    // basicInterface.onReconnected(() => {
    //     connected = true
    //     setTheUpdateSendingInterval()
    // })

    const returnValuePart: BoundFirstAll<
        Omit<typeof basicInterface, "onConnected" | "onDisconnected">
    > & {
        onConnected: typeof basicInterface.onConnected
        onDisconnected: typeof basicInterface.onDisconnected
    } = {
        crypto: basicInterface.crypto,

        addUpdates: async (updates: ClientUpdate[]) => {
            const promise = new Promise<number>((resolve) => {
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
            const promise = new Promise<number>((resolve) => {
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
        onConnected: basicInterface.onConnected,
        onDisconnected: basicInterface.onDisconnected,
    }
    // todo: make sure this works properly (will probably rewrite everything eventually btw)

    return {
        ...returnValuePart,
        getTimeBatchingConfig: () => timeBatchingConfigReal,

        /** Change the time batching config. This will clear the existing interval and create a new one. */
        setTimeBatchingConfig: (newConfig: typeof timeBatchingConfig) => {
            timeBatchingConfigReal = newConfig
            clearInterval(intervalId)
            setTheUpdateSendingInterval()
        },
    }
}

function getBasicEncryptedServerInterface(
    server: BaseServerConnectionInterfaceShape,
    crypto: CryptoFactoryI
) {
    // very similar to BaseServerConnectionInterfaceShape, but some variation
    const out = {
        crypto,

        connect: server.connect,
        disconnect: server.disconnect,
        onConnected: server.onConnected,
        onDisconnected: server.onDisconnected,

        addUpdates: async (docId: DocId, updates: ClientUpdate[]) => {
            const sealedUpdate = await crypto.clientMessagesToSealedMessage(
                updates
            )
            return server.addUpdate(docId, sealedUpdate)
        },
        subscribeToRemoteUpdates: (
            docId: DocId,
            callback: (newUpdates: ClientUpdate[], rowId: number) => void
        ) => {
            return server.subscribeToRemoteUpdates(
                docId,
                async (sealedMessage, rowId) => {
                    const decryptedUpdates =
                        await crypto.sealedMessageToClientMessages(
                            sealedMessage
                        )
                    callback(decryptedUpdates, rowId)
                }
            )
        },
        getRemoteUpdateList: async (docId: DocId) => {
            const sealedUpdates = await server.getRemoteUpdateList(docId)
            const decryptedUpdatesFinal = await Promise.all(
                sealedUpdates.map(async (sealedUpdate) => {
                    const decryptedUpdates =
                        await crypto.sealedMessageToClientMessages(
                            sealedUpdate.sealedMessage
                        )
                    return decryptedUpdates.map((update) => ({
                        update,
                        rowId: sealedUpdate.rowId,
                    }))
                })
            )
            return decryptedUpdatesFinal.flat()
        },

        /** @param updates recommended to minimize the total byte size, and then the count*/
        applySnapshot: async (
            docId: DocId,
            updates: ClientUpdate[],
            lastUpdateRowToReplace: number // may change. see 3-server-connection.ts
        ) => {
            const sealedUpdate = await crypto.clientMessagesToSealedMessage(
                updates
            )
            return server.applySnapshot(
                docId,
                sealedUpdate,
                lastUpdateRowToReplace
            )
        },
    }

    // type checking helpers, so that if I change the interface of BaseServerConnectionInterfaceShape, I get a type error here, to remind me to consider changing this as well. Maybe unnecessary
    const outMethodsModified = {} as VoidMethods<typeof out> & {
        addUpdate: () => void
    }
    outMethodsModified satisfies VoidMethods<BaseServerConnectionInterfaceShape>
    type MethodNames<T> = {
        [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
    }[keyof T]

    type VoidMethods<T> = {
        [K in MethodNames<T>]: () => void
    }

    return out
}

/**
 * currently there are only persistent updates, which get compacted. it could be slightly useful to have separate ephemeral/awareness state section, but it's not necessary as long as we compact updates regularly
 */
