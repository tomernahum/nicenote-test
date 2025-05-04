import { Server } from "socket.io"
import {
    addDocOperation,
    getAllDocOperations,
    getHighestIdForDoc,
    processSnapshot,
} from "./db"
import type {
    InterServerEvents,
    ServerToClientEvents,
    ClientToServerEvents,
    SocketData,
} from "../shared-server-client/shared-types"

// may replace the whole thing with something else, such as cloudflare durable objects for the data and workers for transporting, then we can keep the documents as one durable object and have it be close to the users.
// or might replace with webrtc based strategy, where server only listens and backs up  updates, but does not relay them in real time ( ingress is typically free btw)

// Note: socketio supports binding to alternative packages to ws, including, eiows, µWebSockets.js  swapping in one of these may improve performance
const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>({
    cors: {
        origin: "*",
    },
})

io.on("connection", (socket) => {
    console.log(socket.id, "connected")

    socket.on("startListeningToDoc", (docId: string) => {
        socket.join(docId)
    })
    socket.on("stopListeningToDoc", (docId: string) => {
        socket.leave(docId)
    })

    // add an update to a doc
    socket.on("addUpdate", (docId: string, update: Uint8Array) => {
        console.log(socket.id, docId, "addUpdate")

        if (typeof docId !== "string") {
            console.error("DocId was not a string! may have been null")
            // TODO, add method to notify client that their update request failed
            return
        }
        try {
            const id = addDocOperation(docId, update)
            // notify this and other clients listening to this doc
            io.to(docId).emit("newUpdate", docId, update, id)
        } catch (error) {
            console.error("Failed to add update!", error)
        }
    })

    socket.on(
        "applySnapshot",
        (
            docId: string,
            snapshot: Uint8Array,
            lastUpdateRowToReplace: number | BigInt
        ) => {
            console.log(
                socket.id,
                docId,
                "doing snapshot",
                "lastToReplace: ",
                lastUpdateRowToReplace
                // "lastUpdateInDb: ",
                // getHighestIdForDoc(docId)
            )
            if (lastUpdateRowToReplace === -1) {
                // delete everything
                processSnapshot(docId, snapshot, Number.MAX_SAFE_INTEGER - 1)
                return
            }
            const lastUpdateRow = processSnapshot(
                docId,
                snapshot,
                lastUpdateRowToReplace
            )
        }
    ),
        socket.on(
            "getDoc",
            (
                docId: string,
                callback: (
                    docOperations: { id: number; operation: Uint8Array }[]
                ) => void
            ) => {
                const x = getAllDocOperations(docId)

                callback(x)
            }
        )
})
