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
import { addVersion, stripOffVersionAndConfirmItIsValid } from "./5-versioning"

type ClientMessage = Uint8Array
type SealedMessage = Uint8Array

/*
Steps:
encoding multiple messages into one
padding
encryption
signing
versioning
*/

export type CryptoConfig = PaddingConfig & EncryptionConfig & SigningConfig // includes optional properties

const DEFAULT_CRYPTO_CONFIG_VALUES = {
    ...DEFAULT_PADDING_CONFIG_VALUES,
    ...DEFAULT_ENCRYPTION_CONFIG_VALUES,
    ...DEFAULT_SIGNING_CONFIG_VALUES,
}

type RealConfig = CryptoConfig & typeof DEFAULT_CRYPTO_CONFIG_VALUES

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
    const encrypted = await encrypt(c, padded)
    const signed = await sign(c, encrypted)
    const versioned = addVersion(c, signed) // v0

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

    const [deVersioned, version] = stripOffVersionAndConfirmItIsValid(
        c,
        sealedMessage
    )
    // if we ever support multiple versions, branch off here based on version

    const deSigned = await verifyAndStripOffSignature(c, deVersioned)
    const decrypted = await decrypt(c, deSigned)
    const unPadded = unPadData(c, decrypted)
    const decoded = decodeMultiUpdate(c, unPadded)

    return decoded
}

/** Can also just call above functions directly, but this is for if you want a more oop thing to call that can remember config */
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
