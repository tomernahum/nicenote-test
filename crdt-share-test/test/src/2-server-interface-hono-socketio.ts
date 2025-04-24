import { io, Socket } from "socket.io-client"
import type {
    ServerToClientEvents,
    ClientToServerEvents,
} from "../shared/shared-types"
import { decodeOperations } from "../shared/serializer"

// to be called by e2ee provider, with already encrypted data
// then this can be swapped out to use plain ws, webrtc, etc

type SealedUpdate = Uint8Array // see crypto-update-factory.ts

export function getServerInterface() {
    // const hono = hc<HonoServer>("http://localhost:3000")
    const SERVER_URL = "http://localhost:3000"
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
        io(SERVER_URL)
    return {
        // may deprecate this flow of connecting first idk
        connect: async (docId: string) => {
            // todo ping hono?
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

        /** NOTE: this only supports one listener per doc (currently - TODO)
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
        getRemoteUpdateList: async (docId: string) => {
            const response = await fetch(
                "http://localhost:3000/getAllDocOperations/" + docId
            )
            // const data = await response.json() // TODO. need to change the encoding for this. currently wont work as expected
            const dataBinary = await response.arrayBuffer()
            // console.log("response binary", dataBinary)
            const data = decodeOperations(new Uint8Array(dataBinary))
            // console.log("data", data)

            type ExpectedDataType = {
                id: number
                operation: Uint8Array
            }[]
            // validate it
            if (
                !Array.isArray(data) ||
                !data.every(
                    (item) =>
                        typeof item.id === "number" &&
                        item.operation instanceof Uint8Array
                )
            ) {
                throw new Error(
                    "Invalid response format, response was: " +
                        JSON.stringify(data)
                )
            }
            // console.log(Date.now(), "got server state")
            // return data as ExpectedDataType

            // TODO: make this consistent in socketio too

            return data.map(({ id, operation }) => ({
                rowId: id,
                sealedMessage: operation,
            }))
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
