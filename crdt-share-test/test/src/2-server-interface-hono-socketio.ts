import { io, Socket } from "socket.io-client"
import type {
    ServerToClientEvents,
    ClientToServerEvents,
} from "../server/shared-types"

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
            callback: (update: EncryptedUpdate) => void
        ) => {
            socket.emit("startListeningToDoc", docId)
            socket.on(
                "newUpdate",
                (updateDocId: string, update: EncryptedUpdate) => {
                    if (updateDocId !== docId) return
                    callback(update)
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
            const data = await response.json() // TODO. need to change the encoding for this. currently wont work as expected

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
            return data as ExpectedDataType
        },
    }
}
