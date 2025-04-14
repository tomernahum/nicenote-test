import { io, Socket } from "socket.io-client"
import type {
    ServerToClientEvents,
    ClientToServerEvents,
} from "../shared/shared-types"
import { decodeOperations } from "../shared/serializer"

// to be called by e2ee provider, with already encrypted data
// then this can be swapped out to use plain ws, webrtc, etc

type EncryptedUpdate = Uint8Array // generally 2 bytes version, 12 bytes iv, then ciphertext

export function getServerInterface() {
    // const hono = hc<HonoServer>("http://localhost:3000")
    const SERVER_URL = "http://localhost:3000"
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
        io(SERVER_URL)
    return {
        // may likely deprecate this flow of connecting first
        connect: async (docId: string) => {
            // todo ping hono?
            socket.connect()
            socket.on("connect", () => {
                console.log(Date.now(), "Connected to socket.io server")
            })
            return
            // return new Promise<void>((resolve, reject) => {
            //     socket.on("connect", () => {
            //         resolve()
            //     })
            //     socket.on("connect_error", (error) => {
            //         console.error("Failed to connect to server:", error)
            //         reject("Failed to connect to server: connect_error")
            //     })
            // })
        },
        disconnect: () => {
            socket.disconnect()
            return new Promise<void>((resolve) => {
                socket.on("disconnect", () => {
                    resolve()
                })
            })
        },

        addUpdate: (docId: string, update: EncryptedUpdate) => {
            socket.emit("addUpdate", docId, update)
        },
        subscribeToRemoteUpdates: (
            docId: string,
            callback: (
                update: EncryptedUpdate,
                updateRow?: number | BigInt
            ) => void
        ) => {
            socket.emit("startListeningToDoc", docId)
            socket.on(
                "newUpdate",
                (updateDocId: string, update: EncryptedUpdate, updateRow) => {
                    if (updateDocId !== docId) return
                    callback(new Uint8Array(update), updateRow) // sometimes/always it returns a raw array buffer even though it shouldn't
                }
            )

            return () => {
                socket.emit("stopListeningToDoc", docId)
            }
        },
        getRemoteUpdateList: async (docId: string) => {
            const response = await fetch(
                "http://localhost:3000/getAllDocOperations/" + docId
            )
            // const data = await response.json() // TODO. need to change the encoding for this. currently wont work as expected
            const dataBinary = await response.arrayBuffer()
            console.log("response binary", dataBinary)
            const data = decodeOperations(new Uint8Array(dataBinary))
            console.log("data", data)

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
            console.log(Date.now(), "got server state")
            return data as ExpectedDataType
        },

        applySnapshot: async (
            docId: string,
            snapshot: Uint8Array,
            lastUpdateRowToReplace: number | BigInt
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
