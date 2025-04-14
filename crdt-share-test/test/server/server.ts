import { Server } from "socket.io"
import { addDocOperation, getAllDocOperations, processSnapshot } from "./db"
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { validator } from "hono/validator"
import { cors } from "hono/cors"
import type {
    InterServerEvents,
    ServerToClientEvents,
    ClientToServerEvents,
    SocketData,
} from "../shared/shared-types"
import { encodeOperations } from "../shared/serializer"

// may replace the whole thing with something else, like cloudflare durable objects for the data and workers for transporting, then we can keep the documents as one durable object and have it be close to the users.

const honoApp = new Hono()
const httpServer = serve({
    fetch: honoApp.fetch,
    port: 3000,
})
honoApp.use(
    "*",
    cors({
        origin: "*",
    })
)
// Note: socketio supports binding to alternative packages to ws, including, eiows, µWebSockets.js  swapping in one of these may improve performance
const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>(httpServer, {
    cors: {
        origin: "*",
    },
})

// SocketIo for realtime updates,
// hono (http) for one off updates (I thought it would be faster to access without having to first setup websocket connection, but I think I was wrong it's not a big difference)

// Socketio
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
        const id = addDocOperation(docId, update)
        // notify other clients listening to this doc
        socket.to(docId).emit("newUpdate", docId, update, id)
    })

    socket.on(
        "applySnapshot",
        (
            docId: string,
            snapshot: Uint8Array,
            lastUpdateRowToReplace: number | BigInt
        ) => {
            console.log(socket.id, docId, "snapshot", lastUpdateRowToReplace)

            if (lastUpdateRowToReplace === -1) {
                // delete everything
                processSnapshot(docId, snapshot, Number.MAX_SAFE_INTEGER - 1)
            }
            processSnapshot(docId, snapshot, lastUpdateRowToReplace)
        }
    )
})

// TODO: squash, key rotation (key rotation planned to not be called by 3-server-interface but instead by a separate key management module (sold separately), which will also integrate with some service to securely send/agree on rotated keys with others)

// Hono http server
honoApp.get(
    "/getAllDocOperations/:docId",
    validator("param", (value, c) => {
        const docId = value["docId"]
        if (!docId || typeof docId !== "string") {
            return c.json({ error: "Invalid docId" }, 400)
        }
        return { docId }
    }),
    (c) => {
        const { docId } = c.req.valid("param")
        const x = getAllDocOperations(docId)
        console.log("getAllDocOperations", docId, x)
        const binaryEncoded = encodeOperations(x)
        return new Response(binaryEncoded, {
            status: 200,
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Length": binaryEncoded.length.toString(),
            },
        })
    }
)
