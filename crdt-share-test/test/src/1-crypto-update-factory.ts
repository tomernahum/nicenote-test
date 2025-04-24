import { decodeList, encodeList } from "../shared/binary-encoding-helpers"
import { Bucket, Update, UpdateNoRow, UpdateOptRow } from "./0-data-model"
import { decryptData, encryptData } from "./1-crypto"
import { tryCatch } from "./utils2"

// used by 1-provider-server-interface.ts

/* 
// encryption/transformation steps:
let plaintext: UpdateOptRow[]
let encoded: Uint8Array(bucket, operation)
let clientSigned: Uint8Array(bucket, operation, client signature)
let padded: Uint8Array(bucket, operation, client signature, padding)
let encrypted: Uint8Array(iv, ciphertext(^))
let serverSigned: Uint8Array(serverSignature, iv, ciphertext(^^))
let serverMessage: Uint8Array(schemaVersionIndicator, serverSignature, iv, ciphertext(^^))
onServerItself: rowId, serverMessage
*/

// UpdateOptRow[] -> encrypted&server-signed
// encrypted&server-signed -> Update[]

// Client Generated Message: UpdateNoRow
// Server message after decryption: Update with row

export type ProviderEncryptionConfig = {
    mainKey: CryptoKey
    validOldKeys: CryptoKey[]

    /** plaintext message length will be padded up to the closest of these values, in bytes. The highest value is the max supported length  */
    paddingLengthCheckpoints?: number[]
}
const DEFAULT_ENCRYPTION_CONFIG_VALUES = {
    paddingLengthCheckpoints: [256, 2048, 16_384, 65_536, 262144],
    schemaVersion: "1",
}

const ADDITIONAL_CONFIG_VALUES = {
    schemaVersion: "1",
    backwardsCompatibleSchemaVersions: ["1"],
}
type Config = ProviderEncryptionConfig &
    typeof DEFAULT_ENCRYPTION_CONFIG_VALUES &
    typeof ADDITIONAL_CONFIG_VALUES

type ServerMessage = {
    sealedMessage: Uint8Array
    rowId: number
}
/** Converts between decrypted client update messages and encoded encrypted server messages */
export function createUpdateFactory(
    encryptionConfig: ProviderEncryptionConfig
) {
    const config = {
        ...DEFAULT_ENCRYPTION_CONFIG_VALUES,
        ...encryptionConfig,
        ...ADDITIONAL_CONFIG_VALUES,
    }
    const encoding = createEncodingLogic()
    const padding = createPaddingLogic(config)
    const encryptionOld = createEncryptionLogicOld(config)

    return {
        clientMessagesToServerMessage,
        serverMessageToClientMessages,
    }
    function clientMessagesToServerMessage(clientMessages: UpdateNoRow[]) {
        const encoded = encoding.encodeMultipleUpdatesAsOne(clientMessages)
        // todo: pre-encrypt hmac
        const padded = padding.padData(encoded)
        // todo: encrypt
        // todo: post-encrypt hmac
        // return encrypted
        return
    }
    function serverMessageToClientMessages(serverMessage: ServerMessage) {
        // WIP
        const sealedMessage = serverMessage.sealedMessage

        const padded = padding.unPadData(sealedMessage)
        const decoded = encoding.decodeMultiUpdate(padded)
    }
}

// maybe export crypto key creation functions here too?
//

function createPaddingLogic(config: Config) {
    return {
        padData: (data: Uint8Array) => {
            const dataLength = data.byteLength
            const padTarget = config.paddingLengthCheckpoints.find(
                (checkpoint) => checkpoint >= dataLength + 1 // 1 bit for the padding indicator
            )
            if (!padTarget) {
                throw new Error("Data is too long to encrypt")
            }
            const paddedData = new Uint8Array(padTarget)
            paddedData.set(data)
            paddedData[dataLength] = 0x80
            // the rest should be 0-filled
            return paddedData
        },
        unPadData: (paddedData: Uint8Array) => {
            let i = paddedData.length - 1

            // Skip all 0x00 bytes from the end
            while (i >= 0 && paddedData[i] === 0x00) {
                i--
            }

            // Expect 0x80 as the first non-zero padding byte
            if (i < 0 || paddedData[i] !== 0x80) {
                throw new Error("Invalid padding")
            }

            // Return everything before the 0x80 padding byte
            return paddedData.slice(0, i)
        },
    }
}

function createEncodingLogic() {
    const MULTI_UPDATE_PREFIX = 0
    const DOC_PREFIX = 100
    const AWARENESS_PREFIX = 97
    function encodeOneUpdateMessage(message: UpdateNoRow) {
        const bucketEncoded =
            message.bucket === "doc" ? DOC_PREFIX : AWARENESS_PREFIX
        const messageEncoded = new Uint8Array(message.operation.length + 1)
        messageEncoded[0] = bucketEncoded
        messageEncoded.set(message.operation, 1)
        return messageEncoded
    }

    function decodeOneUpdateMessage(message: Uint8Array) {
        const bucket: Bucket = message[0] === DOC_PREFIX ? "doc" : "awareness"
        const operation = message.slice(1)
        const out: UpdateNoRow = { bucket, operation }
        return out
    }

    function encodeMultipleUpdatesAsOne(updates: UpdateNoRow[]) {
        const encoded = encodeList(updates.map(encodeOneUpdateMessage))
        const out = new Uint8Array(encoded.length + 1)

        out[0] = MULTI_UPDATE_PREFIX
        out.set(encoded, 1)
        return out
    }
    function decodeMultiUpdate(message: Uint8Array): UpdateNoRow[] {
        const updatePrefix = message[0]
        if (updatePrefix !== MULTI_UPDATE_PREFIX) {
            return [decodeOneUpdateMessage(message)]
        }

        const decoded = decodeList(message.slice(1))
        return decoded.map(decodeOneUpdateMessage)
    }
    return {
        encodeOneUpdateMessage,
        encodeMultipleUpdatesAsOne,
        decodeMultiUpdate,
    }
}

function createEncryptionLogicOld(encryptionConfig: ProviderEncryptionConfig) {
    async function decryptUpdate(encryptedUpdate: Uint8Array) {
        const decryptedMainKey = await tryCatch(
            decryptData(encryptionConfig.mainKey, encryptedUpdate)
        )
        if (!decryptedMainKey.error) {
            return decryptedMainKey.data
        }
        for (const key of encryptionConfig.validOldKeys) {
            const decryptedR = await tryCatch(decryptData(key, encryptedUpdate))
            if (!decryptedR.error) {
                return decryptedR.data
            }
        }
        throw new Error("Failed to decrypt update")
    }
    async function encryptUpdate(encodedUpdate: Uint8Array) {
        const encrypted = await encryptData(
            encryptionConfig.mainKey,
            encodedUpdate
        )
        return encrypted
    }

    return {
        decryptUpdate,
        encryptUpdate,
    }
}
