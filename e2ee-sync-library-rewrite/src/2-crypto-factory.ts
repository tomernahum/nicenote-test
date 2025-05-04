// type ServerReceivedMessage = { op: EncryptedMessage; rowId: number }

import { ClientUpdate, SealedUpdate } from "./-types"

type ClientMessage = ClientUpdate
type SealedMessage = SealedUpdate

export interface CryptoFactory {
    clientMessagesToSealedMessage: (
        clientMessages: ClientMessage[]
    ) => Promise<SealedMessage>
    sealedMessageToClientMessages: (
        sealedMessage: SealedMessage
    ) => Promise<ClientMessage[]>
    changeEncryptionConfig: (newConfig: EncryptionConfig) => void
}

export type EncryptionConfig = {
    mainKey: CryptoKey
    validOldKeys: CryptoKey[]
} // will be defined in 1-crypto-update-factory equivalent

export function createCryptoFactory(encryptionConfig: EncryptionConfig) {
    let config = encryptionConfig
    return {
        clientMessagesToSealedMessage,
        sealedMessageToClientMessages,

        encryptionConfig: config,
        changeEncryptionConfig,
    }
    async function clientMessagesToSealedMessage(
        clientMessages: ClientMessage[]
    ) {}
    async function sealedMessageToClientMessages(
        sealedMessage: SealedMessage
    ) {}
    function changeEncryptionConfig(newConfig: EncryptionConfig) {
        config = newConfig
    }
}
