import { io, Socket } from "socket.io-client"

// shared code between server and client. server specific.
import type {
    ServerToClientEvents,
    ClientToServerEvents,
} from "../shared-server-client/shared-types"

// to be called  with already encrypted/processed data
// this can be swapped out to use plain ws, webrtc, etc

type SealedUpdate = Uint8Array
type DocId = string

export type BaseServerInterfaceShape = ReturnType<typeof getServerInterface>

// this version of the server interface uses socket.io
export function getServerInterface() {
    const SERVER_URL = "http://localhost:3000"
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
        io(SERVER_URL)

    // const updateListeners = new Map<
    //     string,
    //     (sealedMessage: SealedUpdate, rowId: number) => void
    // >()

    return {
        // may deprecate this flow of connecting first idk
        connect: async (docId: string) => {
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
            socket.disconnect()
            return new Promise<void>((resolve) => {
                socket.on("disconnect", () => {
                    resolve()
                })
            })
        },

        addUpdate: (docId: string, update: SealedUpdate) => {
            socket.emit("addUpdate", docId, update)
        },

        /** NOTE: this only supports one listener per doc (currently - TODO) can easily fix this by maintaining list of listeners
         * works fine in our app if we only have one provider active per single doc - or multiple which we never unsubscribe from
         */
        subscribeToRemoteUpdates: (
            docId: string,
            callback: (sealedMessage: SealedUpdate, rowId: number) => void
        ) => {
            socket.emit("startListeningToDoc", docId)
            socket.on(
                "newUpdate",
                (updateDocId: string, update: SealedUpdate, rowId) => {
                    if (updateDocId !== docId) return
                    callback(new Uint8Array(update), rowId) // sometimes/always it returns a raw array buffer even though it's not supposed to
                }
            )

            return () => {
                socket.emit("stopListeningToDoc", docId)
                // NOTE: removes all listeners for this doc across our app, hence the above note
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
                            sealedMessage: operation,
                        }))
                    )
                })
            })
        },

        applySnapshot: async (
            docId: string,
            snapshot: Uint8Array,
            lastUpdateRowToReplace: number
        ) => {
            socket.emit(
                "applySnapshot",
                docId,
                snapshot,
                lastUpdateRowToReplace
            )
        },
    }
}
