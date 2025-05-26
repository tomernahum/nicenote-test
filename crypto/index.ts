import { CryptoConfig } from "./-crypto-factory"
import { getUnsafeTestingEncryptionKey } from "./3-encrypting"
import { getUnsafeTestingSigningKeypair } from "./4-signing"
export { createCryptoFactory, CryptoConfig } from "./-crypto-factory"

export { generateSymmetricEncryptionKey } from "./3-encrypting"
export { getUnsafeTestingEncryptionKey } from "./3-encrypting"
export { generateSigningKeyPair } from "./4-signing"
export { getUnsafeTestingSigningKeypair } from "./4-signing"
//

export async function getUnsafeTestingCryptoConfig(): Promise<CryptoConfig> {
    return {
        mainEncryptionKey: await getUnsafeTestingEncryptionKey(),
        mainSigningKey: (await getUnsafeTestingSigningKeypair()).privateKey,
    }
}

//
export {}
