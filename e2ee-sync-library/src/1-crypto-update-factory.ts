import { decodeList, encodeList } from "../shared/binary-encoding-helpers"
import { Bucket, Update, UpdateNoRow, UpdateOptRow } from "./0-data-model"
import { tryCatch } from "./utils2"

// used by 1-provider-server-interface.ts

/* 
// encryption/transformation steps:
(
    quill change
    yjs change
    yjs encoded operation
)
let plainObject: UpdateOptRow[] (bucket, operation(eg yjs op))
let encoded: Uint8Array(bucket, operation)
let clientSigned: Uint8Array(bucket, operation, client signature)
let padded: Uint8Array(bucket, operation, client signature, padding)
let encrypted: Uint8Array(iv, ciphertext(^))
let serverSigned: Uint8Array(serverSignature, iv, ciphertext(^^))
let sealedMessage: Uint8Array(schemaVersionIndicator, serverSignature, iv, ciphertext(^^))
(
    sent up/down using 2-server-interface, which uses socketio (may swap though)
)
onServerItself: rowId, sealedMessage

        

arguably encoding is odd one out here since it's not about security
instead it is about structure/compatibility, and compactness
encoding also merges multiple updates into one in it, which is actually about security
*/

// UpdateNoRow[] -> encrypted&server-signed
// encrypted&server-signed -> Update[]

/**
 * mainKey, validOldKeys must be an AES key
 *
 */
export type ProviderEncryptionConfig = {
    mainKey: CryptoKey
    validOldKeys: CryptoKey[]

    /** plaintext message length will be padded up to the closest of these values, in bytes. The highest value is the max supported length  */
    paddingLengthCheckpoints?: number[]

    useWriteSignaturesForServer: boolean
    useWriteSignaturesForClients: boolean
}
const DEFAULT_ENCRYPTION_CONFIG_VALUES = {
    paddingLengthCheckpoints: [256, 2048, 16_384, 65_536, 262144],
}

const ADDITIONAL_CONFIG_VALUES = {
    // Note that versions are read by reading the first expectedVersion.length bytes of the encoded update message.
    // Meaning a newer version with > 4 length will be detected by current code as whatever the first 4 chars are.
    // changing the version bytelength will also break backwards compatibility on new code, so createVersionLogic will need to be edited
    // version can be any string
    schemaVersion: "0001",
    backwardsCompatibleSchemaVersions: ["0001"],
} as const
type Config = ProviderEncryptionConfig &
    typeof DEFAULT_ENCRYPTION_CONFIG_VALUES &
    typeof ADDITIONAL_CONFIG_VALUES

type ServerMessage = {
    sealedMessage: Uint8Array
    rowId: number
}
/**
 * Converts between decrypted client update messages and encoded encrypted server messages
 * not actually the factory pattern
 */
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
    const encryption = createEncryptionLogic(config)
    const versioning = createVersionLogic(config)

    return {
        clientMessagesToServerMessage,
        serverMessageToClientMessages,
    }
    async function clientMessagesToServerMessage(
        clientMessages: UpdateNoRow[]
    ) {
        const encoded = encoding.encodeMultipleUpdatesAsOne(clientMessages)

        // todo: pre-encrypt hmac
        const padded = padding.padData(encoded)
        const encrypted = await encryption.encrypt(padded)
        // todo: post-encrypt hmac
        // todo: add schema version string for future backwards compatibility with migrations
        const versioned = versioning.addVersion(encrypted)
        return versioned
    }
    async function serverMessageToClientMessages(serverMessage: ServerMessage) {
        const sealedMessage = serverMessage.sealedMessage

        const [deVersioned, version] =
            versioning.stripOffVersionAndConfirmItIsValid(sealedMessage)
        // can branch off logic here for a backwards compatible but differently processed version

        // todo: strip off client-server-known hmac (verifying accomplishes nothing)
        const decrypted = await encryption.decrypt(deVersioned)
        const dePadded = padding.unPadData(decrypted)
        // todo: verify post-encrypt hmac
        const decoded = encoding.decodeMultiUpdate(dePadded)

        const unsealedMessage = decoded

        const out = unsealedMessage.map((message) => ({
            ...message,
            rowId: serverMessage.rowId,
        }))
        out satisfies Update[]

        return out
    }
}

// maybe export crypto key creation functions here too?
//

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

// ---

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

// Note that key rotation is not the responsibility of this library
// new keys should be agreed upon in a separate system and then passed into this library via encryptionConfig
// that should be enough to get PCS
function createEncryptionLogic(config: Config) {
    /**
     * Do not call this more than 2^32 times with the same key! as the ivs are generated randomly and a collision breaks everything security-wise
     * This does not hide message length, call padding logic first
     */
    async function encryptData(key: CryptoKey, data: Uint8Array) {
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const cipherText = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            data
        )
        const encrypted = new Uint8Array(12 + cipherText.byteLength)
        // encrypted.set(SCHEMA.version, 0)
        // idk if we should also put encryption version here separate from the version encoded in the overall update transformation message
        encrypted.set(iv, 0)
        encrypted.set(new Uint8Array(cipherText), 12)

        return encrypted
    }
    async function decryptData(key: CryptoKey, encrypted: Uint8Array) {
        if (encrypted.length < 14) {
            throw new Error(
                "Invalid encrypted data length, expected at least 14 bytes"
            )
        }
        // otherwise assume correct encryption version (as in it's using the same 14 byte iv : aes-gcm encoded ciphertext)
        const iv = encrypted.subarray(0, 12)
        const cipherText = encrypted.subarray(12)
        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv },
                key,
                cipherText
            ) // will throw if invalid key, data, or if tampering detected (authenticated encryption)
            // our overall system is planned to have redundant HMAC verification because not everyone who is able to decrypt should be able to successfully encrypt like is the assumption of symmetric encryption. wait I could have used authenticated asymmetric construction couldn't I have. but symmetric does have better support in web crypto + asymmetric would need to be wrapping symmetric anyways. but we basically want a read secret key and a write secret key...

            return new Uint8Array(decrypted)
        } catch (e) {
            throw new Error(
                "Failed to decrypt data, may be due to an invalid key, invalid data, or authentication check failure",
                { cause: e }
            )
        }
    }

    /** tries decrypting a message with each of multiple keys.
     * (won't get false decryptions since aes-gcm encryption is authenticated) */
    async function decryptWithMultipleKeys(
        p: {
            mainKey: CryptoKey
            validOldKeys: CryptoKey[]
        },
        encryptedMessage: Uint8Array
    ) {
        for (const key of [p.mainKey, ...p.validOldKeys]) {
            const decryptedR = await tryCatch(
                decryptData(key, encryptedMessage)
            )
            if (!decryptedR.error) {
                return decryptedR.data
            }
        }
        throw new Error("Failed to decrypt update")
    }

    return {
        encrypt: (message: Uint8Array) => encryptData(config.mainKey, message),
        decrypt: (encryptedMessage: Uint8Array) =>
            decryptWithMultipleKeys(config, encryptedMessage),
    }
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

export async function getNonSecretHardCodedKeyForTestingSymmetricEncryption(
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

function createSigningLogic(config: Config) {
    // our system uses two separate signing steps, to verify that someone is allowed to write to a document / send a message
    // 1. pre-encryption, used to verify that a sent message is legitimate by the clients. The key for this is secret between writer-permissioned clients of a document
    //    - if skipped, then server could maliciously allow someone with only read permissions to send messages. (a random person / server itself still couldn't as the symmetric reading encryption is in place and is authenticated)
    // 2. post-encrypt hmac, used by server to verify that a message send attempt is really from a writer-permissioned client
    //    - can replace this with a traditional auth system
    //    - if skipped, people with read-only permissions could send messages which are processed by other readers/writers and then  skipped by the first signature verification (if it is enabled), ie you could spam them / dos them, whereas server could hopefully take it. may not be a real problem idk, esp for use case of readers being trusted select few
}

function createVersionLogic(config: Config) {
    const mainVersionBytes = new TextEncoder().encode(config.schemaVersion)
    const mainVersionLength = mainVersionBytes.length

    function addVersion(message: Uint8Array) {
        const out = new Uint8Array(message.length + mainVersionLength)
        out.set(mainVersionBytes)
        out.set(message, mainVersionLength)
        return out
    }
    function readVersion(message: Uint8Array, expectedByteLength: number) {
        if (message.length < expectedByteLength) {
            throw new Error("Message too short to contain version")
        }
        const versionBytes = message.subarray(0, expectedByteLength)
        const version = new TextDecoder().decode(versionBytes)
        return version
    }
    function stripOffVersionAndConfirmItIsValid(message: Uint8Array) {
        const version = readVersion(message, mainVersionLength)
        if (
            version !== config.schemaVersion &&
            // @ts-expect-error // this shouldn't be an error imo
            !config.backwardsCompatibleSchemaVersions.includes(version)
        ) {
            // TODO see if any backwards compatible version matches, in case they are a different length
            throw new Error("Invalid version")
        }
        return [message.subarray(version.length), version] as const
    }
    return { addVersion, stripOffVersionAndConfirmItIsValid }
}
