import { ClientUpdate, SealedUpdate } from "./-types"
import { tryCatch } from "./-utils"

type ClientMessage = ClientUpdate
type SealedMessage = SealedUpdate

// todo: maybe narrow the types
type AESEncryptionKey = CryptoKey
type SigningKey = CryptoKey

export type CryptoConfig = {
    mainKey: AESEncryptionKey
    validOldKeys: AESEncryptionKey[]

    /** plaintext message length will be padded up to the closest of these values, in bytes. The highest value is the max supported length  of messages */
    paddingLengthCheckpoints?: number[]
}
/* 
useClientServerWriteSignatures  
- client signs updates before encrypting them, for the server to verify
useClientClientWriteSignatures
- client signs updates before encrypting them, for other clients to verify
verifyWriteSignatures
- client verifies signatures of writes from other clients before applying them - this should apply for read-only clients as well

write signatures will likely be done with web crypto api's Ed25519 algo implementation, which should ship in chrome soon (has shipped in chrome beta 137) (has shipped in firefox+safari already):
https://groups.google.com/a/chromium.org/g/blink-dev/c/T2kriFdjXsg/m/ZeD_PoLXBwAJ?pli=1  
(concerns raised in that thread about it not being quantum resistant, (will switch algorithms once a better one is provided by web crypto). However this is just verifying integrity of updates, which won't remain relevant for very long (not past a snapshot/compaction), so the quantum resistance is not as important as something like the obscurity-providing encryption who's traffic could be captured and analyzed in the future. Plus for our app it is only protecting from non-writer readers, protection from non-readers is already covered (by aes-256-gcm encryption, which to my understanding is quantum resistant as far as anyone knows, as long as it is not undermined by a separate key exchange protocol). So our threat model currently does not  protect against someone who has gained read access, but not write access, and also has a powerful quantum computer before we can roll out a post-quantum algorithm and get more doc activity to invalidate the old writes

*/
const DEFAULT_ENCRYPTION_CONFIG_VALUES = {
    paddingLengthCheckpoints: [256, 2048, 16_384, 65_536, 262144],
}
const ADDITIONAL_CONFIG_VALUES = {
    // Note that versions are currently read by reading the first expectedVersion.length bytes of the encoded update message.
    // Meaning a newer version with > 4 length will be detected by current code as whatever the first 4 chars are.
    // changing the version bytelength will also break backwards compatibility on new code, so createVersionLogic will need to be edited
    // version can be any string
    schemaVersion: "v0001",
    backwardsCompatibleSchemaVersions: ["v0001"],
} as const

type Config = CryptoConfig &
    typeof DEFAULT_ENCRYPTION_CONFIG_VALUES &
    typeof ADDITIONAL_CONFIG_VALUES

export function createCryptoFactory(cryptoConfig: CryptoConfig) {
    let config: Config = {
        ...DEFAULT_ENCRYPTION_CONFIG_VALUES,
        ...ADDITIONAL_CONFIG_VALUES,
        ...cryptoConfig,
    }

    // these are all pure (other than config), I just organized them like this
    // config should update in them when it updates since its an object therefore passed by reference
    const encoding = createEncodingLogic()
    const padding = createPaddingLogic(config)
    const encryption = createEncryptionLogic(config)
    const versioning = createVersionLogic(config)

    return {
        clientMessagesToSealedMessage,
        sealedMessageToClientMessages,

        getCryptoConfig: () => config,
        changeCryptoConfig,
    }
    async function clientMessagesToSealedMessage(
        clientMessages: ClientMessage[]
    ) {
        const encoded = encoding.encodeMultipleUpdatesAsOne(clientMessages)
        return new Uint8Array()
    }
    async function sealedMessageToClientMessages(sealedMessage: SealedMessage) {
        return []
    }
    function changeCryptoConfig(newConfig: CryptoConfig) {
        config = {
            ...DEFAULT_ENCRYPTION_CONFIG_VALUES,
            ...ADDITIONAL_CONFIG_VALUES,
            ...newConfig,
        }
        // TODO: test thatnew config is used in all handlers.
        // Note that if a handler caches config values in variables, it would need to be reinitialized to use the new config
    } // might refactor how this is managed. Note that cryptoConfig needs to change periodically to rotate keys to provide PCS
}
export async function getInsecureCryptoConfigForTesting(): Promise<CryptoConfig> {
    return {
        mainKey: await getNonSecretHardCodedKeyForTestingSymmetricEncryption(),
        validOldKeys: [],
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

// TODO: generateSigningKey (Pair?)

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
// ----

function createEncodingLogic() {
    const SIZE_PREFIX_LENGTH = 4 // note this. This will be annoying to change while maintaining backwards compatibility. luckily it won't need to change for a long time as there are technically 4+ billion possible values. or at least 26 * 1000

    // all this code could probably be improved, but it does work.
    // note this code shouldn't be security critical (unless it somehow exposes us to side channel timing attacks but the application logic would already probably do that if it were a problem)
    function encode4ByteNumber(number: number) {
        if (number < 0 || number > 4_294_967_295) {
            throw new Error("Number out of bounds for 4-byte encoding")
        }
        const buffer = new ArrayBuffer(4)
        const view = new DataView(buffer)
        view.setUint32(0, number, true) // little-endian
        return new Uint8Array(buffer)
    }
    function decode4ByteNumber(buffer: Uint8Array) {
        const view = new DataView(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength
        )
        return view.getUint32(0, true)
    }
    function encodeList(listOfBinary: Uint8Array[]) {
        const outLength = listOfBinary.reduce((acc, item) => {
            return acc + item.byteLength + SIZE_PREFIX_LENGTH
        }, 0)
        const out = new Uint8Array(outLength)
        let currentOffset = 0

        if (SIZE_PREFIX_LENGTH !== 4) {
            throw new Error(
                "SIZE_PREFIX_LENGTH must be 4 for current code to work"
            )
        }
        for (const update of listOfBinary) {
            const lengthPrefix = encode4ByteNumber(update.byteLength)
            out.set(lengthPrefix, currentOffset)
            currentOffset += 4
            out.set(update, currentOffset)
            currentOffset += update.byteLength
        }
        return out
    }
    function decodeList(encoded: Uint8Array) {
        const out: Uint8Array[] = []
        let currentOffset = 0

        if (SIZE_PREFIX_LENGTH !== 4) {
            throw new Error(
                "SIZE_PREFIX_LENGTH must be 4 for current code to work"
            )
        }
        while (currentOffset < encoded.byteLength) {
            const lengthPrefix = encoded.slice(currentOffset, currentOffset + 4)
            const length = decode4ByteNumber(lengthPrefix)
            currentOffset += 4
            const update = encoded.slice(currentOffset, currentOffset + length)
            currentOffset += length
            out.push(update)
        }
        return out
    }

    function encodeMultipleUpdatesAsOne(updates: ClientMessage[]): Uint8Array {
        return encodeList(updates)
    }
    function decodeMultiUpdate(message: Uint8Array): ClientMessage[] {
        return decodeList(message)
    }
    return {
        encodeMultipleUpdatesAsOne,
        decodeMultiUpdate,
    }
}

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
// see also generateSymmetricEncryptionKey function above

// TODO: signing logic

function createVersionLogic(config: Config) {
    // these are kept as functions so that the config can be changed at runtime. hopefully the js engine optimizes if they are not changed lol. if not and we see a performance issue we can cache them ourselves or actually reinitialize this function when config changes
    const mainVersionBytes = (conf: Config) =>
        new TextEncoder().encode(conf.schemaVersion)
    const mainVersionLength = (conf: Config) => mainVersionBytes(conf).length

    function addVersion(message: Uint8Array) {
        const versionLen = mainVersionLength(config)
        const out = new Uint8Array(message.length + versionLen)
        out.set(mainVersionBytes(config))
        out.set(message, versionLen)
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
        const version = readVersion(message, mainVersionLength(config))
        if (
            version !== config.schemaVersion &&
            // @ts-expect-error // this shouldn't be an error imo
            !config.backwardsCompatibleSchemaVersions.includes(version)
        ) {
            // TODO: support backwards compatible versions with different lengths
            throw new Error("Invalid version")
        }
        return [message.subarray(version.length), version] as const
    }
    return { addVersion, stripOffVersionAndConfirmItIsValid }
}
