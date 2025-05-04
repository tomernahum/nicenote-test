// type LocalUpdate = Uint8Array
// interface LocalProvider {
//     subscribeToLocalUpdates: (update: LocalUpdate) => void
//     applyRemoteUpdate: (update: LocalUpdate) => void
// }

import { ClientUpdate, DocId } from "./-types"
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
        addUpdate: async (docId: DocId, update: ClientUpdate) => {
            const sealedUpdate = await crypto.clientMessagesToSealedMessage([
                update,
            ])
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
            lastUpdateRowToReplace: number // may change. see 3-
        ) => {
            const sealedUpdate = await crypto.clientMessagesToSealedMessage(
                updates
            )
            server.applySnapshot(docId, sealedUpdate, lastUpdateRowToReplace)
        },
    }
}
