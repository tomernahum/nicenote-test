import { decodeMultiUpdate, encodeMultipleUpdatesAsOne } from "./1-encodingList"
import {
    DEFAULT_PADDING_CONFIG_VALUES,
    padData,
    PaddingConfig,
    unPadData,
} from "./2-padding"
import {
    decrypt,
    DEFAULT_ENCRYPTION_CONFIG_VALUES,
    encrypt,
    EncryptionConfig,
} from "./3-encrypting"
import {
    DEFAULT_SIGNING_CONFIG_VALUES,
    sign,
    SigningConfig,
    verifyAndStripOffSignature,
} from "./4-signing"
import {
    addSchemaVersion,
    stripOffSchemaVersionAndConfirmItIsValid,
    DEFAULT_VERSION_CONFIG,
    SchemaVersionConfig,
} from "./5-versioning"

type ClientMessage = Uint8Array
type SealedMessage = Uint8Array

// type RichClientMessage = {
//     id: string,
//     content: Uint8Array
// }
// could also add support for a wide range of encodable

/*
Steps:
encoding multiple messages into one
padding

signing
encryption
versioning

Sign the plaintext, not the ciphertext, so that the signature data is authenticated data by the aes-gcm encryption
*/

export type CryptoConfig = PaddingConfig &
    EncryptionConfig &
    SigningConfig &
    SchemaVersionConfig // includes optional properties

const DEFAULT_CRYPTO_CONFIG_VALUES = {
    ...DEFAULT_PADDING_CONFIG_VALUES,
    // can add default values from the other modules if they need any
    ...DEFAULT_ENCRYPTION_CONFIG_VALUES,
    ...DEFAULT_SIGNING_CONFIG_VALUES,
    ...DEFAULT_VERSION_CONFIG,
}

type RealConfig = typeof DEFAULT_CRYPTO_CONFIG_VALUES & CryptoConfig

/** Do not call >4 billion times with the same encryption key (across any device), due to unacceptable chance of an IV overlap */
export async function clientMessagesToSealedMessage(
    config: CryptoConfig,
    clientMessages: ClientMessage[]
) {
    const c: RealConfig = {
        ...DEFAULT_CRYPTO_CONFIG_VALUES,
        ...config,
    }
    const encoded = encodeMultipleUpdatesAsOne(c, clientMessages)
    const padded = padData(c, encoded)

    const signed = await sign(c, padded)
    const encrypted = await encrypt(c, signed)
    const versioned = addSchemaVersion(c, encrypted) // v0

    return versioned
}
export async function sealedMessageToClientMessages(
    config: CryptoConfig,
    sealedMessage: SealedMessage
) {
    const c: RealConfig = {
        ...DEFAULT_CRYPTO_CONFIG_VALUES,
        ...config,
    }

    const [deVersioned, version] = stripOffSchemaVersionAndConfirmItIsValid(
        c,
        sealedMessage
    )
    // if we ever support multiple versions, branch off here based on version

    const decrypted = await decrypt(c, deVersioned)
    const deSigned = await verifyAndStripOffSignature(c, decrypted)
    const unPadded = unPadData(c, deSigned)
    const decoded = decodeMultiUpdate(c, unPadded)

    return decoded
}

/** Can also just call above functions directly, but this is for if you want a more oop thing to call that can remember config
 *
 * Meant to be used with a separate key rotation system too provide PCS, maybe FS
 * Do not seal messages >2^32 (4 billion) times with the same encryption key (across any device), or the encryption breaks, due to there being an unacceptable chance of a randomly generated IV overlap
 * Do not use more than 2^48 (281 trillion) encryption keys total, apparently (read here https://soatok.blog/2020/05/13/why-aes-gcm-sucks/)
 */
export function createCryptoFactory(config: CryptoConfig) {
    let c: RealConfig = {
        ...DEFAULT_CRYPTO_CONFIG_VALUES,
        ...config,
    }
    return {
        clientMessagesToSealedMessage: (clientMessages: ClientMessage[]) =>
            clientMessagesToSealedMessage(c, clientMessages),
        sealedMessageToClientMessages: (sealedMessage: SealedMessage) =>
            sealedMessageToClientMessages(c, sealedMessage),

        getCryptoConfig: () => c,
        changeCryptoConfig: (newConfig: CryptoConfig) => {
            c = {
                ...DEFAULT_CRYPTO_CONFIG_VALUES,
                ...newConfig,
            }
        },
    }
}
