import * as Y from "yjs"

/** Creates a generic provider */
export function createProvider(
    ydoc: Y.Doc,
    onBroadcastAttempt: (update: Uint8Array) => void
) {
    const providerId = crypto.randomUUID()
    // const providerId = "provider"

    ydoc.on("update", (update, origin) => {
        // don't react to updates applied by this provider
        if (origin === providerId) {
            return
        }
        // now this update was produced either locally or by another provider.

        onBroadcastAttempt(update)
        console.log("update!")
    })

    function onRemoteUpdateReceived(update: Uint8Array) {
        Y.applyUpdate(ydoc, update, providerId) // the third parameter sets the transaction-origin
    }

    return {
        applyRemoteUpdate: onRemoteUpdateReceived,
    }

    // TODO: what about initialization?
}
// YDoc will be updated by the main application (locally)
// when that happens, the  provider^^ will detect it and trigger onDocUpdate
// we might also receive updates from other users / the server.
// when that happens we will apply them to the local doc with localProvider.applyRemoteUpdate
//
