import { CryptoConfig } from "./-crypto-factory"
import { getUnsafeTestingEncryptionKey } from "./3-encrypting"
import { getUnsafeTestingSigningKeypair } from "./4-signing"
export { createCryptoFactory } from "./-crypto-factory"
// exporting CryptoConfig type is causing problems

export { generateSymmetricEncryptionKey } from "./3-encrypting"
export { getUnsafeTestingEncryptionKey } from "./3-encrypting"
export { generateSigningKeyPair } from "./4-signing"
export { getUnsafeTestingSigningKeypair } from "./4-signing"
//

export async function getUnsafeTestingCryptoConfig(): Promise<CryptoConfig> {
    const { privateKey, publicKey } = await getUnsafeTestingSigningKeypair()
    return {
        mainEncryptionKey: await getUnsafeTestingEncryptionKey(),

        signingMode: "writer",
        mainSigningKey: privateKey,
        mainVerifyingKey: publicKey,
    }
}

//
export {}
