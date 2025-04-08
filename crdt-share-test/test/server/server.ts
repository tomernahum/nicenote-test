import { Server } from "socket.io"
import { addDocOperation, getAllDocOperations } from "./db"
import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { validator } from "hono/validator"

// Note: socketio supports binding to alternative packages to ws, including, eiows, µWebSockets.js  swapping in one of these may improve performance
// can also integrate with regular http server (ie with express, hono)
// may replace the whole thing with cloudflare durable objects for the data and workers for transporting, then we can keep the documents as one durable object and have it be close to the users.

const honoApp = new Hono()
const httpServer = serve({
    fetch: honoApp.fetch,
    port: 3000,
})
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    },
})

// todo:  getAllDocOperations(docId) accessible from regular http api (since it takes a second to connect to socket)

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
        console.log("addUpdate", docId, update)
        addDocOperation(docId, update)
        // notify other clients listening to this doc
        socket.to(docId).emit("newUpdate", docId, update)
    })
})

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
        return c.json(getAllDocOperations(docId))
    }
)
