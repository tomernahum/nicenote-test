// choosing to use web crypto api, vs libsodium.js

// note: browser will only allow this to work over https environments (so not onion sites unfortunately)
// up to browser to implement the encryption algorithms, it may call OS functions, which may make use of special hardware.
// It is up to each users browser/device to actually implement the algorithms securely.
// I think that if you implement a system with proper post-compromise-security (I think you can achieve this by simply rotating keys, often/periodically, but not in a way in which you rely on the old key to secure the new key)
// then if a user/group-of-users has insecure web crypto implementation that gets updated to be secure, then the actual system will start being secure (except for all data passed while it was insecure).
// And I guess tell your users to make sure their browser&operating system implements cryptography securely. Which they would need even for native apps or for libsodium because they all rely on the operating system's cs-prng (libsodium.js uses web crypto api for random entropy). So difference is with web crypto the device needs to implement the algorithms themselves securely too, whereas I believe libsodium does it in memory in ws, which has it's own tradeoffs
// that said giving more of the work to the browser/OS may be more secure vs libsodium, since it has more power to do things like constant time algorithms. Although I hear libsodium's XSalsa20-Poly1305 and the like is more resistant to side channel attacks in the first place than web crypto's AES-GCM. So idk

export async function generateSymmetricEncryptionKey() {
    const key = await crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true, // extractable
        ["encrypt", "decrypt"] // key usages
    )
    return key
}
export async function generateSymmetricEncryptionKeyNonExportable() {
    const key = await crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        false, // extractable
        ["encrypt", "decrypt"]
    )
    return key
}

const SCHEMA = {
    version: [0, 1], // two bytes, will be encoded into every returned ci
    // this version = aes-gcm 256 bit key with 12 byte iv (randomly generated), padding as below with 128 at end then 0s

    // ciphertext length will be rounded up to the closest of these values, in bytes. The highest value is the max supported length
    paddingLengthCheckpoints: [256, 2048, 16384],
}

// TODO: best to be sure padding be done in constant time, I think
/** Pad plain text data to hide it's length*/
function padData(data: Uint8Array, schema: typeof SCHEMA) {
    const dataLength = data.byteLength
    const padTarget = schema.paddingLengthCheckpoints.find(
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
}
function unPadData(paddedData: Uint8Array) {
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
}

/** Do not call this more than 2^32 times with the same key! as the ivs are generated randomly and a collision breaks everything security-wise*/
export async function encryptData(key: CryptoKey, data: Uint8Array) {
    const paddedData = padData(data, SCHEMA)

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cipherText = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        paddedData
    )
    const encrypted = new Uint8Array(2 + 12 + cipherText.byteLength)
    encrypted.set(SCHEMA.version, 0)
    encrypted.set(iv, 2)
    encrypted.set(new Uint8Array(cipherText), 2 + 12)

    return encrypted
}
export async function decryptData(key: CryptoKey, encrypted: Uint8Array) {
    const schemaVersion = encrypted.slice(0, 2).join("")
    if (schemaVersion != "01") {
        throw new Error("Invalid encryption schema version, expected v01")
    }
    if (encrypted.length < 14) {
        throw new Error(
            "Invalid encrypted data length, expected at least 14 bytes"
        )
    }

    const iv = encrypted.subarray(2, 14)
    const cipherText = encrypted.subarray(14)
    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            cipherText
        ) // will throw if invalid key, data, or if tampering detected (authenticated encryption)
        const unPadded = unPadData(new Uint8Array(decrypted))
        return unPadded
    } catch (e) {
        throw new Error(
            "Failed to decrypt data, may be due to an invalid key, invalid data, or authentication check failure",
            { cause: e }
        )
    }
}

async function test() {
    // const key = await generateSymmetricEncryptionKey()
    const key = await generateSymmetricEncryptionKeyNonExportable()
    console.log(key)
    // console.log(await crypto.subtle.exportKey("raw", key))

    const plainText = new Uint8Array([1, 2, 3])
    console.log("Plain text:", plainText)

    const encrypted = await encryptData(key, plainText)
    console.log("Encrypted:", encrypted)
    const decrypted = await decryptData(key, encrypted)
    console.log("Decrypted:", decrypted)

    // const malformedEncrypted1 = encrypted.subarray(2)
    // // console.log(await decryptData(key, malformedEncrypted1))

    // const malformedEncrypted2 = await encryptData(
    //     await generateSymmetricEncryptionKeyNonExportable(),
    //     plainText
    // )
    // console.log(
    //     "Malformed encrypted 2:",
    //     await decryptData(key, malformedEncrypted2)
    // )
}

// TODO: more extensive tests, unit tests. These are pretty simple but it would still be a good idea. Note that web crypto api is not available in node.js, only in browsers
