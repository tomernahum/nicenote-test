export {
    createCryptoFactory,
    getUnsafeTestingEncryptionKey,
    getUnsafeTestingCryptoConfig,
} from "../crypto/index"

import { createCryptoFactory } from "../crypto/index"

// problems with export type { CryptoConfig } from "../../crypto/index"

export type CryptoConfig = Parameters<typeof createCryptoFactory>[0]

export type CryptoFactoryI = ReturnType<typeof createCryptoFactory>
