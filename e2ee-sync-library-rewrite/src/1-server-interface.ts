// type LocalUpdate = Uint8Array
// interface LocalProvider {
//     subscribeToLocalUpdates: (update: LocalUpdate) => void
//     applyRemoteUpdate: (update: LocalUpdate) => void
// }

import { BaseServerInterfaceShape } from "./2-base-server-interface"

// ;``
type DocId = string
export type EncryptionConfig = {
    mainKey: CryptoKey
    validOldKeys: CryptoKey[]
} // will be defined in 1-crypto-update-factory equivalent

export function getServerInterface(
    docId: DocId,
    encryptionConfig: EncryptionConfig,
    server: BaseServerInterfaceShape
) {
    /*returned*/ function connect() {
        return server.connect(docId)
    }
    return {
        connect,
    }
}
