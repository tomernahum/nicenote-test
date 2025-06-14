import * as Y from "yjs"
import {
    Awareness,
    applyAwarenessUpdate,
    encodeAwarenessUpdate,
    removeAwarenessStates,
} from "y-protocols/awareness.js"

import { getUnsafeTestingCryptoConfig } from "./2-crypto-factory"
import { getServerInterface } from "./1-server-client"
import { type ClientUpdate } from "./-types"
import {
    type CRDTUpdateEncoder,
    type localCrdtInterfaceO,
    createCrdtSyncProvider,
} from "./0-provider"
import { createEventsHelper } from "./ts-helper-lib"
// ----

/**
 * You can also directly call {@link createCrdtSyncProvider}, with a local yjs provider wrapper ({@link createBaseYjsProvider}) (that creates an awareness object for the ydoc (and wraps it in a nicer interface for this library to use))
 */
export async function createYjsSyncProvider(
    yDoc: Y.Doc,
    params: Parameters<typeof createCrdtSyncProvider>[2]
) {
    const yjsProvider = createBaseYjsProvider(yDoc)

    const syncProvider = await createCrdtSyncProvider(
        yjsProvider,
        yjsPUpdateEncoder(),
        params
    )
    return {
        awareness: yjsProvider.awareness,
        ...syncProvider,
    }
}
export async function createExampleYjsSyncProvider(yDoc: Y.Doc) {
    return createYjsSyncProvider(yDoc, {
        remoteDocId: "test",
        cryptoConfig: await getUnsafeTestingCryptoConfig(),
        mergeInitialState: true,
    })
}

// ----

function createProppaCRDTProvider<CRDTUpdate>(
    localCrdtInterface: localCrdtInterfaceO<CRDTUpdate>,
    localInterfaceUpdateEncoder: CRDTUpdateEncoder<CRDTUpdate>
) {
    function decodeWithRowIdToCrdt(
        updates: { update: ClientUpdate; rowId: number }[]
    ): CRDTUpdate[] {
        return updates.map((update) =>
            localInterfaceUpdateEncoder.decode(update.update)
        )
    }
    function encodeFromCrdt(updates: CRDTUpdate[]): ClientUpdate[] {
        return updates.map((update) =>
            localInterfaceUpdateEncoder.encode(update)
        )
    }

    localCrdtInterface
    return {
        applyRemoteUpdates: (updates: ClientUpdate[]) => {
            const crdtEncoded = updates.map((update) =>
                localInterfaceUpdateEncoder.decode(update)
            )
            localCrdtInterface.applyRemoteUpdates(crdtEncoded)
        },
        subscribeToLocalUpdates: (callback: (update: ClientUpdate) => void) => {
            return localCrdtInterface.subscribeToLocalUpdates((update) => {
                callback(localInterfaceUpdateEncoder.encode(update))
            })
        },
        getSnapshot: () => {
            const crdtEncoded = localCrdtInterface.getSnapshot()
            return encodeFromCrdt(crdtEncoded)
        },
        getChangesNotAppliedToAnotherDoc: (
            remoteDocChanges: ClientUpdate[]
        ) => {
            const crdtEncoded = remoteDocChanges.map((update) =>
                localInterfaceUpdateEncoder.decode(update)
            )
            return localCrdtInterface.getChangesNotAppliedToAnotherDoc(
                crdtEncoded
            )
        },
        disconnect: () => {
            localCrdtInterface.disconnect()
        },
    }
}

export function createProppaYjsCRDTInterface(yDoc: Y.Doc) {
    const yjsProvider = createBaseYjsProvider(yDoc)
    const updateEncoder = yjsPUpdateEncoder()
    return {
        ...createProppaCRDTProvider(yjsProvider, updateEncoder),
        awareness: yjsProvider.awareness,
        // y doc is known by the caller
    }
}
// ----

type LibraryUpdate = ClientUpdate
type YProviderUpdate = {
    type: "doc" | "awareness"
    operation: Uint8Array
}
export function yjsPUpdateEncoder(): CRDTUpdateEncoder<YProviderUpdate> {
    return {
        // encode
        encode: (providerUpdate: YProviderUpdate): LibraryUpdate => {
            // A simple encoding scheme: [type byte, ...operation bytes]
            // 0 for 'doc', 1 for 'awareness'
            const typeByte = providerUpdate.type === "doc" ? 0 : 1
            const encoded = new Uint8Array(1 + providerUpdate.operation.length)
            encoded[0] = typeByte
            encoded.set(providerUpdate.operation, 1)
            return encoded
        },

        // decode binary update into one that the Y Provider Wrapper can understand
        decode: (update: LibraryUpdate): YProviderUpdate => {
            if (update.length === 0) {
                console.warn("Tried to decode an empty library update")
                throw new Error("Cannot decode empty update")
            }

            const typeByte = update[0]
            const type: "doc" | "awareness" =
                typeByte === 0 ? "doc" : "awareness"
            const operation = update.slice(1)

            return {
                type,
                operation,
            }
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
export function createBaseYjsProvider(
    yDoc: Y.Doc,
    onUpdate: (update: YProviderUpdate) => void = () => {},
    removeClientAwarenessDataOnWindowClose = true
) {
    const eventsHelper = createEventsHelper<{ update: YProviderUpdate }>()
    eventsHelper.on("update", onUpdate)

    const awareness = new Awareness(yDoc)

    const providerId = crypto.randomUUID()
    // const providerId = "provider"

    // subscribe to local doc updates
    function onDocUpdate(update: Uint8Array, origin: any) {
        // don't react to updates applied by this provider
        if (origin === providerId) {
            return
        }
        // now this update was produced either locally or by another provider.

        // onUpdate({ type: "doc", operation: update })
        eventsHelper.emit("update", { type: "doc", operation: update })
    }
    yDoc.on("update", onDocUpdate)
    // subscribe to local awareness updates

    //@ts-ignore
    function onAwarenessUpdate({ added, updated, removed }) {
        const changedClients = added.concat(updated).concat(removed)
        const encodedUpdate = encodeAwarenessUpdate(awareness, changedClients)
        // onUpdate({ type: "awareness", operation: encodedUpdate })
        eventsHelper.emit("update", {
            type: "awareness",
            operation: encodedUpdate,
        })
    }
    awareness.on("update", onAwarenessUpdate)

    // remove ourselves from the awareness when we close the window (otherwise will be auto-detected after a timeout)
    // this should trigger awareness.on("update") which will trigger onUpdates, which will hopefully broadcast our removal to the server before the tab gets closed
    function onBeforeWindowUnload() {
        removeAwarenessStates(awareness, [yDoc.clientID], "window unload")
    }
    if (removeClientAwarenessDataOnWindowClose) {
        try {
            window.addEventListener("beforeunload", onBeforeWindowUnload)
        } catch (e) {
            console.warn(
                "failed to add window.beforeunload listener to remove awareness state",
                e
            )
        }
    }

    /*returned*/ function disconnectFromYDoc() {
        yDoc.off("update", onDocUpdate)
        awareness.off("update", onAwarenessUpdate)
        if (removeClientAwarenessDataOnWindowClose) {
            window.removeEventListener("beforeunload", onBeforeWindowUnload)
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
        // (these are intended to be worked with directly, not encapsulated by this object, this object reacts to their changes)
        awareness,
        yDoc,

        //
        applyRemoteUpdates,

        /**
         * Initial subscriber is passed in as a parameter.
         * Only supports one subscriber at a time (that is all that is needed currently).
         */
        subscribeToLocalUpdates: (
            callback: (update: YProviderUpdate) => void
        ) => {
            // onUpdate = callback
            const unsub = eventsHelper.on("update", callback)
            return unsub
        },

        disconnect: disconnectFromYDoc,

        // we could actually just use getSnapshot here instead (less efficient but it's called often anyways), with or without actually replacing the rows that are snapshotted.
        /**
         * Used for merging into the online doc
         * if you are lazy implementing this in another provider, you could just return getSnapshot
         * (converts a diff of states to a change object, could also be used for passing in updates directly without going through your main crdt object, if I add a method for that
         */
        getChangesNotAppliedToAnotherDoc: (
            remoteDocUpdates: YProviderUpdate[]
            // may have been good to take an already merged/ ydoc?
        ) => {
            const remoteDoc = new Y.Doc()
            remoteDocUpdates.forEach((update) => {
                if (update.type == "awareness") {
                    return //continue
                }
                Y.applyUpdate(remoteDoc, update.operation)
            })

            // calculate the diff between the onlineDoc and the local yDoc
            const remoteStateVector = Y.encodeStateVector(remoteDoc)
            const docUpdate = Y.encodeStateAsUpdate(yDoc, remoteStateVector) // only writes the changes missing from remoteStateVector

            // gets the awareness state of the local doc. No optimizations to avoid redundant updates on this one
            const awarenessUpdate = encodeAwarenessUpdate(awareness, [
                yDoc.clientID,
            ])

            return [
                { type: "doc", operation: docUpdate },
                {
                    type: "awareness",
                    operation: awarenessUpdate,
                },
            ] as const
        },

        getSnapshot() {
            const yDocSnapshot = Y.encodeStateAsUpdate(yDoc)
            const awarenessClients = Array.from(awareness.getStates().keys())
            const yAwarenessSnapshot = encodeAwarenessUpdate(
                awareness,
                awarenessClients
            )
            return [
                { type: "doc", operation: yDocSnapshot },
                {
                    type: "awareness",
                    operation: yAwarenessSnapshot,
                },
            ] as const
        },

        reset() {
            //
        },
    } satisfies localCrdtInterfaceO<YProviderUpdate> & {
        [key: string]: unknown
    } // there may be a better way out there to do this typing interface implementation thing
}
