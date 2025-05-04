// type ServerReceivedMessage = { op: EncryptedMessage; rowId: number }

import { ClientUpdate, SealedUpdate } from "./-types"

type ClientMessage = ClientUpdate
type SealedMessage = SealedUpdate

export interface CryptoFactory {
    /*This will still generate a padded message even from an empty array of updates*/
    clientMessagesToSealedMessage: (
        clientMessages: ClientMessage[]
    ) => Promise<SealedMessage>
    sealedMessageToClientMessages: (
        sealedMessage: SealedMessage
    ) => Promise<ClientMessage[]>

    getCryptoConfig: () => CryptoConfig
    changeCryptoConfig: (newConfig: CryptoConfig) => void
    // may be able to just return cryptoConfig instead, not 100% - ok yes but only since it's an object instead of a literal. I'll keep this to be explicit though
}

// todo: maybe narrow the types
type AESKey = CryptoKey
type HMACKey = CryptoKey //HMAC wip might end up being different signing algorithm
export type CryptoConfig = {
    mainKey: AESKey
    validOldKeys: AESKey[]
} & (
    | { useWriteSignaturesForServer: false; serverSignatureSecretKey?: HMACKey }
    | { useWriteSignaturesForServer: true; serverSignatureSecretKey: HMACKey }
) &
    (
        | {
              useWriteSignaturesForClients: false
              clientSignatureSecretKey?: HMACKey
          }
        | {
              useWriteSignaturesForClients: true
              clientSignatureSecretKey: HMACKey
          }
    )

export function createCryptoFactory(cryptoConfig: CryptoConfig): CryptoFactory {
    let config = cryptoConfig
    return {
        clientMessagesToSealedMessage,
        sealedMessageToClientMessages,

        getCryptoConfig: () => config,
        changeCryptoConfig,
    }
    async function clientMessagesToSealedMessage(
        clientMessages: ClientMessage[]
    ) {
        return new Uint8Array()
    }
    async function sealedMessageToClientMessages(sealedMessage: SealedMessage) {
        return []
    }
    function changeCryptoConfig(newConfig: CryptoConfig) {
        config = newConfig
    } // might refactor how this is managed. Note that cryptoConfig needs to change periodically to rotate keys to provide PCS
}
export async function getInsecureCryptoConfigForTesting(): Promise<CryptoConfig> {
    return {
        mainKey: await getNonSecretHardCodedKeyForTestingSymmetricEncryption(),
        validOldKeys: [],
        useWriteSignaturesForServer: false,
        useWriteSignaturesForClients: false,
    }
}
async function getNonSecretHardCodedKeyForTestingSymmetricEncryption(
    seed: number = 0
) {
    const seedArray = new Uint8Array(16)
    seedArray.set([seed])

    return await crypto.subtle.importKey(
        "raw",
        seedArray,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    )
}
export async function generateSymmetricEncryptionKey(
    extractable: boolean = true
) {
    const key = await crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        extractable,
        ["encrypt", "decrypt"] // key usages
    )
    return key
}
