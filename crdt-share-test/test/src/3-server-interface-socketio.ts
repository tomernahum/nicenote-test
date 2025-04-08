import { io } from "socket.io-client"

// to be called by e2ee provider, with already encrypted data
// then this can be swapped out to use plain ws, webrtc, etc

export function getServerInterface() {
    const socket = io()
    return {
        connect: async (docId: string) => {
            socket.connect()
            return new Promise<void>((resolve) => {
                socket.on("connect", () => {
                    resolve()
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
        addUpdate: (docId: string, update: Uint8Array) => {
            socket.emit("addUpdate", docId, update)
        },
        subscribeToRemoteUpdates: (
            docId: string,
            callback: (update: Uint8Array) => void
        ) => {
            socket.on("", (docId: string, update: Uint8Array) => {
                callback(update)
            })
        },
    }
}
