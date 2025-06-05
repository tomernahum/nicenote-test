//

import { decodeList, encodeList } from "./1-encodingList"

type SignatureKey = CryptoKey // todo: narrow the type
export type SigningConfig =
    | { signingMode: "skip" }
    | {
          signingMode: "reader"
          mainVerifyingKey: SignatureKey
          validOldVerifyingKeys?: SignatureKey[]
      }
    | {
          signingMode: "writer"

          mainVerifyingKey: SignatureKey
          validOldVerifyingKeys?: SignatureKey[]

          mainSigningKey: SignatureKey // (signing key = secret/private key)
          validOldSigningKeys?: SignatureKey[]
      }
export const DEFAULT_SIGNING_CONFIG_VALUES = {
    validOldVerifyingKeys: [] as SignatureKey[],
    validOldSigningKeys: [] as SignatureKey[],
} // these are included every time since they are default, but they will not be used if not appropriate to do so

type Config = typeof DEFAULT_SIGNING_CONFIG_VALUES & SigningConfig

export async function generateSigningKeyPair() {
    const { publicKey, privateKey } = await crypto.subtle.generateKey(
        {
            name: "Ed25519",
        },
        true,
        ["sign", "verify"]
    )
    return { publicKey, privateKey } // aka verifyingKey, signingKey
}
export async function getUnsafeTestingSigningKeypair() {
    // hard coded values
    const privBuf = new Uint8Array([
        48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32, 108, 53, 131,
        86, 230, 4, 201, 90, 1, 122, 58, 88, 49, 238, 242, 208, 26, 75, 37, 48,
        216, 55, 25, 174, 6, 158, 143, 249, 127, 164, 178, 239,
    ]).buffer

    const pubBuf = new Uint8Array([
        48, 42, 48, 5, 6, 3, 43, 101, 112, 3, 33, 0, 198, 234, 25, 168, 200, 66,
        172, 37, 173, 227, 217, 40, 68, 85, 68, 114, 106, 57, 175, 81, 113, 90,
        142, 118, 67, 165, 67, 127, 87, 7, 96, 107,
    ]).buffer

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        privBuf,
        { name: "Ed25519" },
        true,
        ["sign"]
    )
    const publicKey = await crypto.subtle.importKey(
        "spki",
        pubBuf,
        { name: "Ed25519" },
        true,
        ["verify"]
    )
    return { privateKey, publicKey }
}

export async function sign(config: Config, outgoingData: Uint8Array) {
    if (config.signingMode === "skip") {
        // throw new Error("Cannot sign data in skip mode")
        return outgoingData
    }
    if (config.signingMode === "reader") {
        throw new Error("Reader cannot sign data")
    }
    const signature = await crypto.subtle.sign(
        {
            name: "Ed25519",
        },
        config.mainSigningKey,
        outgoingData
    ) // signature is 64 bytes

    // add the signature to the data
    const out = encodeList([outgoingData, new Uint8Array(signature)])

    return out
}
export async function verifyAndStripOffSignature(
    config: Config,
    incomingData: Uint8Array
) {
    if (config.signingMode === "skip") {
        return incomingData
    }
    const [message, signature] = decodeList(incomingData)
    if (!message || !signature) {
        console.error("Invalid data", incomingData, message, signature)
        throw new Error("Invalid data")
    }

    // try verifying with main key
    try {
        const verificationResult = await crypto.subtle.verify(
            {
                name: "Ed25519",
            },
            config.mainVerifyingKey,
            signature,
            message
        )

        if (!verificationResult) {
            throw new Error("Signature verification failed")
        }

        return message
    } catch {}
    // try with old keys
    for (const key of config.validOldVerifyingKeys) {
        try {
            const verificationResult = await crypto.subtle.verify(
                {
                    name: "Ed25519",
                },
                key,
                signature,
                message
            )

            if (!verificationResult) {
                throw new Error("Signature verification failed")
            }
            return message
        } catch {}
    }

    throw new Error("Signature verification failed")
}
