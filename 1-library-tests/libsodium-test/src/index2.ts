// const { SodiumPlus } = require('sodium-plus');
import { SodiumPlus } from "sodium-plus" // last commit was last year...

async function sodiumPlusLibDemo() {
    let sodium = await SodiumPlus.auto()
    let key = await sodium.crypto_secretbox_keygen()
    let nonce = await sodium.randombytes_buf(24)
    let message = "This is just a test message"
    // Message can be a string, buffer, array, etc.

    let ciphertext = await sodium.crypto_secretbox(message, nonce, key)
    console.log(ciphertext)
    let decrypted = await sodium.crypto_secretbox_open(ciphertext, nonce, key)
    console.log(decrypted.toString("utf-8"))
}
sodiumPlusLibDemo()

async function soatokTut() {
    let sodium = await SodiumPlus.auto()
    const VERSION = "v1"

    /**
     * @param {string|Uint8Array} message
     * @param {Uint8Array} key
     * @param {string|null} assocData
     * @returns {string}
     */
    async function encryptData(message, key, assocData = null) {
        const nonce = await sodium.randombytes_buf(24)
        const aad = JSON.stringify({
            version: VERSION,
            nonce: await sodium.sodium_bin2hex(nonce),
            extra: assocData,
        })

        const encrypted =
            await sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
                message,
                nonce,
                key,
                aad
            )
        return (
            VERSION +
            (await sodium.sodium_bin2hex(nonce)) +
            (await sodium.sodium_bin2hex(encrypted))
        )
    }
    async function decryptData(encrypted, key, assocData = null) {
        const ver = encrypted.slice(0, 2)
        if (!(await sodium.sodium_memcmp(ver, VERSION))) {
            throw new Error("Incorrect version: " + ver)
        }
        const nonce = await sodium.sodium_hex2bin(encrypted.slice(2, 50))
        const ciphertext = await sodium.sodium_hex2bin(encrypted.slice(50))
        const aad = JSON.stringify({
            version: ver,
            nonce: encrypted.slice(2, 50),
            extra: assocData,
        })

        const plaintext =
            await sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
                ciphertext,
                nonce,
                key,
                aad
            )
        return plaintext.toString("utf-8")
    }
}
