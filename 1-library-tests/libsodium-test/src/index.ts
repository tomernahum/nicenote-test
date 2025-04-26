import _sodium from "libsodium-wrappers"

// The API exposed by the wrappers is identical to the one of the C library, except that buffer lengths never need to be explicitly given.

async function libraryDemo() {
    // vars renamed by ai
    await _sodium.ready
    const sodium = _sodium

    let secretKey = sodium.crypto_secretstream_xchacha20poly1305_keygen()

    let initializationResult =
        sodium.crypto_secretstream_xchacha20poly1305_init_push(secretKey)
    let [encryptionState, headerData] = [
        initializationResult.state,
        initializationResult.header,
    ]
    let ciphertext1 = sodium.crypto_secretstream_xchacha20poly1305_push(
        encryptionState,
        sodium.from_string("message 1"),
        null,
        sodium.crypto_secretstream_xchacha20poly1305_TAG_MESSAGE
    )
    let ciphertext2 = sodium.crypto_secretstream_xchacha20poly1305_push(
        encryptionState,
        sodium.from_string("message 2"),
        null,
        sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
    )

    let decryptionState =
        sodium.crypto_secretstream_xchacha20poly1305_init_pull(
            headerData,
            secretKey
        )
    let decryptedResult1 = sodium.crypto_secretstream_xchacha20poly1305_pull(
        decryptionState,
        ciphertext1
    )
    let [decryptedMessage1, messageTag1] = [
        sodium.to_string(decryptedResult1.message),
        decryptedResult1.tag,
    ]
    let decryptedResult2 = sodium.crypto_secretstream_xchacha20poly1305_pull(
        decryptionState,
        ciphertext2
    )
    let [decryptedMessage2, messageTag2] = [
        sodium.to_string(decryptedResult2.message),
        decryptedResult2.tag,
    ]

    console.log(decryptedMessage1)
    console.log(decryptedMessage2)
}

libraryDemo()
