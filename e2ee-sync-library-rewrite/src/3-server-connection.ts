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

const serverConnections: string[] = []

export function getBaseServerConnectionInterface() {
    const SERVER_URL = "http://localhost:3000"
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
        SERVER_URL,
        {
            reconnection: undefined,
        }
    )

    const myId = crypto.randomUUID()
    serverConnections.push(myId)

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

        /** If all instances of serverConnectionInterface are disconnected, the underlying socketio/websocket connection to the server will be closed  */
        disconnect: () => {
            return new Promise<void>((resolve) => {
                serverConnections.splice(serverConnections.indexOf(myId), 1)
                if (serverConnections.length === 0) {
                    socket.disconnect()
                    socket.on("disconnect", () => {
                        resolve()
                    })
                } else {
                    resolve()
                }
            })
        },

        addUpdate: (docId: string, update: SealedUpdate) => {
            socket.emit("addUpdate", docId, update)
        },

        subscribeToRemoteUpdates: (
            docId: string,
            callback: (sealedMessage: SealedUpdate, rowId: number) => void
        ) => {
            updateListeners.set(docId, callback)

            socket.emit("startListeningToDoc", docId)
            socket.on(
                "newUpdate",
                (updateDocId: string, update: SealedUpdate, rowId) => {
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
            socket.emit(
                "applySnapshot",
                docId,
                snapshot,
                lastUpdateRowToReplace
            )
        },

        // TODO: what about onConnectionLost??
    }
}
