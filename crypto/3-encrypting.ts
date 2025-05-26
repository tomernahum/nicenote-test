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

export async function getUnsafeTestingEncryptionKey(seed: number = 0) {
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

// --

// Note that key rotation is not the responsibility of this library
// new keys should be agreed upon in a separate system and then passed into this library via encryptionConfig
// that should be enough to get PCS, I think

/**
 * Do not call this more than 2^32 (4 billion) times with the same key! as the ivs are generated randomly and a collision breaks everything security-wise
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

// -- For our crypto chain: --

export type EncryptionConfig = {
    mainEncryptionKey: CryptoKey
    validOldEncryptionKeys: CryptoKey[]
}

export async function encrypt(config: EncryptionConfig, data: Uint8Array) {
    return await encryptData(config.mainEncryptionKey, data)
}

/**
 * attempts to decrypt the data with each of the valid encryption keys in the config
 * (won't get false decryptions since aes-gcm encryption is authenticated)
 */
export async function decrypt(
    config: EncryptionConfig,
    encryptedData: Uint8Array
) {
    // first try with main key
    try {
        return await decryptData(config.mainEncryptionKey, encryptedData)
    } catch (err) {
        // ignore and fall through
        console.log("decrypt failed with main key:", err)
    }

    // then try with old keys:
    // try {
    //     return await Promise.any(
    //         config.validOldEncryptionKeys.map((key) =>
    //             decryptData(key, encryptedData)
    //         )
    //     )
    // } catch (aggregateErr) {
    //     throw new Error("Failed to decrypt with any key", {
    //         cause: aggregateErr,
    //     })
    // }
    for (const key of config.validOldEncryptionKeys) {
        try {
            return await decryptData(key, encryptedData)
        } catch {
            // try next
        }
    }
    throw new Error("Failed to decrypt with any key")
}
