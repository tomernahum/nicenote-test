import { io, Socket } from "socket.io-client"

import type {
    ServerToClientEvents,
    ClientToServerEvents,
} from "../shared-server-client/shared-types"

// to be called  with already encrypted/processed data
// this can be swapped out to use plain ws, webrtc, etc
// 1-server-client wraps this, it's what's actually used to interact with the server

import { SealedUpdate, DocId } from "./-types"

// type SealedUpdate = SealedUpdate // TODO: clean up

export type BaseServerConnectionInterfaceShape = ReturnType<
    typeof getBaseServerConnectionInterface
>
// note: traditional method: interface, function/class implements interface

// this version of the server interface uses socket.io

const updateListeners = new Map<
    DocId,
    (sealedMessage: SealedUpdate, rowId: number) => void
>()

export function getBaseServerConnectionInterface() {
    const SERVER_URL = "http://localhost:3000"
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
        SERVER_URL,
        {
            autoConnect: false, // do not connect upon initialization.
            reconnection: true, // do reconnect automatically
            // TODO: make sure we do not queue updates if the connection is lost....
        }
    )

    return {
        // may deprecate this flow of connecting first idk
        connect: async () => {
            socket.connect()
            return new Promise<void>((resolve, reject) => {
                socket.on("connect", () => {
                    resolve()
                })
                socket.on("connect_error", (error) => {
                    console.error(
                        "Failed to connect to socket.io server:",
                        error
                    )
                    reject(
                        "Failed to connect to socket.io server: connect_error"
                    )
                })
            })
        },

        disconnect: () => {
            return new Promise<void>((resolve) => {
                socket.disconnect()
                if (socket.disconnected) {
                    resolve()
                    return
                }
                socket.on("disconnect", (reason, description) => {
                    resolve()
                })
            })
        },

        onConnected: (callback: (isReconnection: boolean) => void) => {
            const onConnectedCB = () => callback(false)
            const onReconnectedCB = () => callback(true)

            socket.on("connect", onConnectedCB)
            socket.io.on("reconnect", onReconnectedCB)

            return () => {
                socket.off("connect", onConnectedCB)
                socket.io.off("reconnect", onReconnectedCB)
            }
        },
        onDisconnected: (callback: (unexpected: boolean) => void) => {
            type DisconnectCallback = Parameters<
                typeof socket.on<"disconnect">
            >[1]

            const onDisconnectedCB: DisconnectCallback = (
                reason,
                description
            ) => {
                callback(
                    reason !== "io client disconnect" &&
                        reason !== "io server disconnect"
                )
            }

            socket.on("disconnect", onDisconnectedCB)
            return () => {
                socket.off("disconnect", onDisconnectedCB)
            }
        },

        addUpdate: (docId: string, update: SealedUpdate) => {
            return new Promise<number>((resolve, reject) => {
                if (!socket.connected) {
                    reject(new Error("Socket is disconnected"))
                    return
                }
                socket.emit("addUpdate", docId, update, (result) => {
                    if (!result.success) {
                        reject(new Error(result.errorMessage))
                    } else {
                        resolve(result.rowId)
                    }
                })
            })
        },

        subscribeToRemoteUpdates: (
            docId: string,
            callback: (sealedMessage: SealedUpdate, rowId: number) => void
        ) => {
            updateListeners.set(docId, callback)

            console.log("SUBSCRIBING TO DOC", docId)

            // this function is okay to be queued while offline since it is not writing
            // so no (!socket.connected) check

            socket.emit("startListeningToDoc", docId)
            socket.on(
                "newUpdate",
                (updateDocId: string, update: SealedUpdate, rowId) => {
                    // console.debug("NEW UPDATE")
                    if (updateDocId !== docId) return

                    callback(new Uint8Array(update), rowId)
                    // sometimes/always it returns a raw array buffer even though it's not supposed to, so we convert it
                }
            )

            return () => {
                updateListeners.delete(docId)
                if ((updateListeners.get(docId) || []).length === 0) {
                    socket.emit("stopListeningToDoc", docId)
                }
            }
        },
        getRemoteUpdateList: (docId: string) => {
            return new Promise<
                { rowId: number; sealedMessage: SealedUpdate }[]
            >((resolve, reject) => {
                if (!socket.connected) {
                    reject(new Error("Socket is disconnected"))
                    return
                }
                socket.emit("getDoc", docId, (data) => {
                    resolve(
                        data.map(({ id, operation }) => ({
                            rowId: id,
                            sealedMessage: new Uint8Array(operation),
                        }))
                    )
                })
            })
        },

        applySnapshot: async (
            docId: string,
            snapshot: Uint8Array,
            lastUpdateRowToReplace: number // may change to another indicator of what is in the snapshot. Valid if we never receive an update out of order from it's row... with current server implementation I think it should be fine, but not 100%
        ) => {
            if (!socket.connected) {
                throw new Error("Socket is disconnected")
            }
            return new Promise<number>((resolve, reject) => {
                socket.emit(
                    "applySnapshot",
                    docId,
                    snapshot,
                    lastUpdateRowToReplace,
                    (result) => {
                        if (!result.success) {
                            reject(new Error(result.errorMessage))
                        } else {
                            resolve(result.rowId)
                        }
                    }
                )
            })
        },
    }
}
