import { Server } from "socket.io"
import { addDocOperation } from "./db"
// socketio

// Note: socketio supports binding to alternative packages to ws, including, eiows, µWebSockets.js  swapping in one of these may improve performance
// can also integrate with regular http server (ie with express, hono)
// may replace the whole thing with cloudflare durable objects for the data and workers for transporting, then we can keep the documents as one durable object and have it be close to the users.

const io = new Server(3000, {
    cors: {
        origin: "*",
    },
})

io.on("connection", (socket) => {
    console.log(socket.id, "connected")

    // add an update to a doc
    socket.on("addUpdate", (docId: string, update: Uint8Array) => {
        console.log("addUpdate", docId, update)
        addDocOperation(docId, update)
        // notify other clients
        socket.to(docId).emit("addUpdate", docId, update)
    })
})
