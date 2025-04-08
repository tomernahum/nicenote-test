import { io } from "socket.io-client"

// to be called by e2ee provider, with already encrypted data
// then this can be swapped out to use plain ws, webrtc, etc

type EncryptedUpdate = Uint8Array // generally 2 bytes version, 12 bytes iv, then ciphertext

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
        getRemoteUpdateList: (docId: string) => {
            return new Promise<EncryptedUpdate[]>((resolve) => {
                socket.emit(
                    "getFullUpdateList",
                    docId,
                    (fullUpdateList: EncryptedUpdate[]) => {
                        resolve(fullUpdateList)
                    }
                )
            })
        },
    }
}
