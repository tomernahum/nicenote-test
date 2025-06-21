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
>(3000, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
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
    socket.on("addUpdate", (docId, update, callback) => {
        console.log(socket.id, docId, "addUpdate")

        if (typeof docId !== "string") {
            console.error("DocId was not a string! may have been null")
            callback({
                success: false,
                errorMessage: "DocId was not a string! may have been null",
            })
            return
        }

        try {
            const rowId = addDocOperation(docId, update)

            callback({
                success: true,
                rowId: rowId,
            })
            // notify this and other clients listening to this doc
            io.to(docId).emit("newUpdate", docId, update, rowId)

            console.log(docId, "success", rowId)
        } catch (error) {
            console.error("Error adding update!", error)
            callback({
                success: false,
                errorMessage: "500",
            })
        }
    })

    socket.on(
        "applySnapshot",
        (
            docId: string,
            snapshot: Uint8Array,
            lastUpdateRowToReplace: number | BigInt,
            callback
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
            const realLastUpdateRowToReplace =
                lastUpdateRowToReplace === -1
                    ? Number.MAX_SAFE_INTEGER - 1
                    : Number(lastUpdateRowToReplace)

            const lastUpdateRow = processSnapshot(
                docId,
                snapshot,
                realLastUpdateRowToReplace
            )
            if (typeof lastUpdateRow !== "number") {
                console.error(
                    "Last update row was not a number, may have been a big int"
                )
                callback({
                    success: false,
                    errorMessage:
                        "document has had too many changes. Please contact us if this happens. Your change may still have gone through",
                })
                // TODO: maybe rotate rowIds down or something. if rowIds were per document, this shouldn't happen for centuries (but they are global btw)
                return
            }
            callback({
                success: true,
                rowId: lastUpdateRow,
            })
        }
    )

    socket.on(
        "getDoc",
        (
            docId: string,
            callback: (
                docOperations: { id: number; operation: Uint8Array }[]
            ) => void
        ) => {
            console.log(socket.id, docId, "getDoc")
            const x = getAllDocOperations(docId)

            callback(x)
        }
    )
})
