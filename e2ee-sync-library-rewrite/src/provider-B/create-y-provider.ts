import * as Y from "yjs"
import { createProppaYjsCRDTInterface } from "../0-interface-yjs"
import { getUnsafeTestingCryptoConfig } from "../2-crypto-factory"
import { getServerInterface } from "../1-server-client"
import { createInMemoryStorageCache } from "./1-storage-cache"
import { createProvider } from "./0-provider-with-storage"

export async function createDemoYjsSyncProviderNewB(yDoc: Y.Doc) {
    const cryptoConfig = await getUnsafeTestingCryptoConfig()
    const serverInterface = await getServerInterface("test", cryptoConfig, {
        timeBetweenUpdatesMs: 100,
        sendUpdatesToServerWhenNoUserUpdate: false,
    })
    const storageCache = createInMemoryStorageCache()

    const yCrdtInterface = createProppaYjsCRDTInterface(yDoc)

    const provider = await createProvider({
        localCrdtInterface: yCrdtInterface,
        storageCache,
        server: serverInterface,
    })

    return {
        ...provider,
        awareness: yCrdtInterface.awareness,
    }
}
