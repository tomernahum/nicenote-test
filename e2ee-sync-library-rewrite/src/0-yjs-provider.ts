import * as Y from "yjs"
import {
    Awareness,
    applyAwarenessUpdate,
    encodeAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness.js"

import { getInsecureCryptoConfigForTesting } from "./2-crypto-factory"
import { type Update } from "../../e2ee-sync-library/src/0-data-model"
import { getServerInterface } from "./1-server-client"

async function test(yDoc: Y.Doc, mergeInitialState: boolean) {
    const localYProvider = createBaseYjsProvider(yDoc, () => {
        return
    })

    const server = getServerInterface(
        "my-docId",
        await getInsecureCryptoConfigForTesting(),
        {
            timeBetweenUpdatesMs: 100,
            sendUpdatesToServerWhenNoUserUpdate: true,
        }
    )

    await server.connect()

    const remoteDocUpdatesUponConnection = await server.getRemoteUpdateList()
    const decodedRemoteDocUpdatesUponConnection =
        remoteDocUpdatesUponConnection.map((libUpdate) =>
            libUpdateToYjsProviderUpdateCodec().decode(libUpdate.update)
        )

    localYProvider.applyRemoteUpdates(decodedRemoteDocUpdatesUponConnection)
    if (mergeInitialState) {
        const remoteDocOnlyUpdates = decodedRemoteDocUpdatesUponConnection
            .filter((update) => update.type === "doc")
            .map((update) => update.operation)
        const differingInitialUpdates =
            localYProvider.getChangesNotAppliedToAnotherYDoc(
                remoteDocOnlyUpdates
            )
        server.addUpdates(
            differingInitialUpdates.map((update) => {
                const encodedUpdate =
                    libUpdateToYjsProviderUpdateCodec().encode({
                        type: "doc",
                        operation: update,
                    })
                return encodedUpdate
            })
        )
    }
}

// TODO //WIP // fake data
function libUpdateToYjsProviderUpdateCodec() {
    return {
        encode: (libUpdate: {
            type: "doc" | "awareness"
            operation: Uint8Array
        }) => {
            return libUpdate.operation
        },
        decode: (libUpdate: Uint8Array) => {
            return {
                type: "doc",
                operation: libUpdate,
            } as const
        },
    }
}

/**
 * Creates a remote provider for yjs.
 * calls a callback when an update is detected (and therefore needs to be broadcasted)
 * returns a method to apply an update (ie one received from another client's broadcast)
 *
 * Also sets up and returns an awareness instance, as is the job of most yjs providers
 *
 */
function createBaseYjsProvider(
    yDoc: Y.Doc,
    onUpdates: (
        updates: { type: "doc" | "awareness"; operation: Uint8Array }[]
    ) => void,
    removeClientAwarenessDataOnWindowClose = true
) {
    const awareness = new Awareness(yDoc)

    const providerId = crypto.randomUUID()
    // const providerId = "provider"

    // subscribe to local doc updates
    yDoc.on("update", (update, origin) => {
        // don't react to updates applied by this provider
        if (origin === providerId) {
            return
        }
        // now this update was produced either locally or by another provider.

        onUpdates([{ type: "doc", operation: update }])
    })
    // subscribe to local awareness updates
    awareness.on("update", ({ added, updated, removed }) => {
        const changedClients = added.concat(updated).concat(removed)
        const encodedUpdate = encodeAwarenessUpdate(awareness, changedClients)
        onUpdates([{ type: "awareness", operation: encodedUpdate }])
    })

    // remove ourselves from the awareness when we close the window (will be auto-detected after a while anyways)
    // should trigger awareness.on("update") which will trigger onUpdates, which will hopefully broadcast our removal to the server before the tab gets closed
    if (removeClientAwarenessDataOnWindowClose) {
        try {
            window.addEventListener("beforeunload", () => {
                removeAwarenessStates(
                    awareness,
                    [yDoc.clientID],
                    "window unload"
                )
            })
        } catch (e) {
            console.warn(
                "failed to add beforeunload listener to remove awareness state",
                e
            )
        }
    }

    /*returned*/ function applyRemoteUpdates(
        updates: {
            type: "doc" | "awareness"
            operation: Uint8Array
        }[]
    ) {
        updates.forEach((update) => {
            if (update.type === "doc") {
                Y.applyUpdate(yDoc, update.operation, providerId) // the third parameter sets the transaction-origin
            } else if (update.type === "awareness") {
                applyAwarenessUpdate(awareness, update.operation, yDoc)
            }
        })
    }

    // ---

    return {
        applyRemoteUpdates,
        awareness,
        yDoc,

        // yDoc helper functions
        // WIP
        getChangesNotAppliedToAnotherYDoc: (
            remoteDoc: Y.Doc | Uint8Array[]
        ) => {
            const remoteDocReal =
                remoteDoc instanceof Y.Doc
                    ? remoteDoc
                    : remoteDoc.reduce((acc, update) => {
                          Y.applyUpdate(acc, update)
                          return acc
                      }, new Y.Doc())

            // calculate the diff between the onlineDoc and the local yDoc
            const remoteStateVector = Y.encodeStateVector(remoteDocReal)
            const update = Y.encodeStateAsUpdate(yDoc, remoteStateVector) // only writes the changes missing from remoteStateVector

            const updateIsEmpty = update.toString() === "0,0"
            return updateIsEmpty ? [] : [update]
        },
    }
}
