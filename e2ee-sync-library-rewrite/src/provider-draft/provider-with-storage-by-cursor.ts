import { type ClientUpdate } from "../-types"
import { type localCrdtInterfaceO } from "../0-provider"
import { type CRDTUpdateEncoder } from "../0-provider"
import { type CryptoConfig } from "../2-crypto-factory"
import { getServerInterface } from "../1-server-client"
import { getLocalStorageInterface } from "../--0-provider-with-offline-mode"

export type ProviderMode = "online" | "offline" | "both"

interface ProviderState {
    mode: ProviderMode
    onlineState: ClientUpdate[]
    offlineState: ClientUpdate[]
    connectionStatus: {
        server: "connected" | "disconnected" | "connecting"
        storage: "connected" | "disconnected" | "connecting"
    }
}

export async function createProviderWithStorage<CRDTUpdate>(
    localCrdtInterface: localCrdtInterfaceO<CRDTUpdate>,
    localInterfaceUpdateEncoder: CRDTUpdateEncoder<CRDTUpdate>,
    params: {
        remoteDocId: string
        cryptoConfig: CryptoConfig
        initialMode?: ProviderMode
        timeBatchingConfig?: Parameters<typeof getServerInterface>[2]
        mergeInitialState?: boolean
        snapshotIntervalMs?: number
        snapshotMinUpdateCount?: number
    }
) {
    // Initialize interfaces
    const server = getServerInterface(
        params.remoteDocId,
        params.cryptoConfig,
        params.timeBatchingConfig ?? {
            timeBetweenUpdatesMs: 200,
            sendUpdatesToServerWhenNoUserUpdate: true,
        }
    )

    const storage = getLocalStorageInterface(
        params.remoteDocId,
        params.cryptoConfig
    )

    // Initialize state
    const state: ProviderState = {
        mode: params.initialMode ?? "both",
        onlineState: [],
        offlineState: [],
        connectionStatus: {
            server: "connecting",
            storage: "connecting",
        },
    }

    // Connect to storage and server
    const storageConnectionPromise = storage
        .connect()
        .then(() => {
            state.connectionStatus.storage = "connected"
            return storage.getStateAsUpdates()
        })
        .then((updates) => {
            state.offlineState = updates
            localCrdtInterface.applyRemoteUpdates(
                updates.map((update) =>
                    localInterfaceUpdateEncoder.decode(update)
                )
            )
        })
        .catch(() => {
            state.connectionStatus.storage = "disconnected"
        })

    const serverConnectionPromise = server
        .connect()
        .then(() => {
            state.connectionStatus.server = "connected"
            return server.getRemoteUpdateList()
        })
        .then((updates) => {
            state.onlineState = updates.map((u) => u.update)
            if (state.mode !== "offline") {
                localCrdtInterface.applyRemoteUpdates(
                    state.onlineState.map((update) =>
                        localInterfaceUpdateEncoder.decode(update)
                    )
                )
            }
        })
        .catch(() => {
            state.connectionStatus.server = "disconnected"
        })

    // Set up update listeners
    localCrdtInterface.subscribeToLocalUpdates((update) => {
        const encodedUpdate = localInterfaceUpdateEncoder.encode(update)

        // Update offline state
        if (state.mode !== "online") {
            storage.addUpdates([encodedUpdate])
            state.offlineState.push(encodedUpdate)
        }

        // Update online state
        if (
            state.mode !== "offline" &&
            state.connectionStatus.server === "connected"
        ) {
            server.addUpdates([encodedUpdate])
            state.onlineState.push(encodedUpdate)
        }
    })

    // Set up server update listener
    server.subscribeToRemoteUpdates((updates, rowId) => {
        if (state.mode !== "offline") {
            const decodedUpdates = updates.map((update) =>
                localInterfaceUpdateEncoder.decode(update)
            )
            localCrdtInterface.applyRemoteUpdates(decodedUpdates)
            state.onlineState = updates
        }
    })

    return {
        // State management
        getState: () => ({ ...state }),
        setMode: (newMode: ProviderMode) => {
            state.mode = newMode
            // Trigger appropriate sync based on new mode
            if (newMode === "both") {
                // Show both states for manual reconciliation
                return
            }
            if (
                newMode === "online" &&
                state.connectionStatus.server === "connected"
            ) {
                localCrdtInterface.applyRemoteUpdates(
                    state.onlineState.map((update) =>
                        localInterfaceUpdateEncoder.decode(update)
                    )
                )
            } else if (newMode === "offline") {
                localCrdtInterface.applyRemoteUpdates(
                    state.offlineState.map((update) =>
                        localInterfaceUpdateEncoder.decode(update)
                    )
                )
            }
        },

        // Manual reconciliation
        reconcileStates: async (
            strategy: "useOnline" | "useOffline" | "merge"
        ) => {
            if (strategy === "useOnline") {
                state.offlineState = state.onlineState
                await storage.applySnapshot(
                    state.onlineState,
                    state.onlineState.length - 1
                )
            } else if (strategy === "useOffline") {
                state.onlineState = state.offlineState
                await server.applySnapshot(
                    state.offlineState,
                    state.offlineState.length - 1
                )
            } else if (strategy === "merge") {
                // Implement merge strategy
                const mergedUpdates =
                    localCrdtInterface.getChangesNotAppliedToAnotherDoc(
                        state.onlineState.map((update) =>
                            localInterfaceUpdateEncoder.decode(update)
                        )
                    )
                const encodedMerged = mergedUpdates.map((update) =>
                    localInterfaceUpdateEncoder.encode(update)
                )
                state.onlineState = [...state.onlineState, ...encodedMerged]
                state.offlineState = [...state.offlineState, ...encodedMerged]
                await Promise.all([
                    storage.applySnapshot(
                        state.offlineState,
                        state.offlineState.length - 1
                    ),
                    server.applySnapshot(
                        state.onlineState,
                        state.onlineState.length - 1
                    ),
                ])
            }
        },

        // Connection management
        reconnect: async () => {
            if (state.connectionStatus.server === "disconnected") {
                state.connectionStatus.server = "connecting"
                try {
                    await server.connect()
                    state.connectionStatus.server = "connected"
                    const updates = await server.getRemoteUpdateList()
                    state.onlineState = updates.map((u) => u.update)
                    if (state.mode !== "offline") {
                        localCrdtInterface.applyRemoteUpdates(
                            state.onlineState.map((update) =>
                                localInterfaceUpdateEncoder.decode(update)
                            )
                        )
                    }
                } catch {
                    state.connectionStatus.server = "disconnected"
                }
            }
        },

        // Cleanup
        disconnect: () => {
            server.disconnect()
            localCrdtInterface.disconnect()
        },

        // Crypto config management
        setCryptoConfig: (newCryptoConfig: CryptoConfig) => {
            server.setCryptoConfig(newCryptoConfig)
            storage.setCryptoConfig(newCryptoConfig)
        },

        changeCryptoConfig: async (
            callback: (cryptoConfig: CryptoConfig) => Promise<CryptoConfig>
        ) => {
            const newCryptoConfig = await callback(server.getCryptoConfig())
            server.setCryptoConfig(newCryptoConfig)
            storage.setCryptoConfig(newCryptoConfig)
        },
    }
}
