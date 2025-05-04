// type LocalUpdate = Uint8Array
// interface LocalProvider {
//     subscribeToLocalUpdates: (update: LocalUpdate) => void
//     applyRemoteUpdate: (update: LocalUpdate) => void
// }

import { BaseServerConnectionInterfaceShape } from "./2-server-connection"

// ;``
type DocId = string
export type EncryptionConfig = {
    mainKey: CryptoKey
    validOldKeys: CryptoKey[]
} // will be defined in 1-crypto-update-factory equivalent

export function getServerInterface(
    docId: DocId,
    encryptionConfig: EncryptionConfig,
    server: BaseServerConnectionInterfaceShape
) {
    /*returned*/ function connect() {
        return server.connect(docId)
    }
    function disconnect() {
        return server.disconnect()
    }
    return {
        connect,
        disconnect,
    }
}
