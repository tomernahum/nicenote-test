import { Server } from "socket.io"
// socketio

// Note: socketio supports binding to alternative packages to ws, including, eiows, µWebSockets.js  swapping in one of these may improve performance
// can also integrate with regular http server (ie with express, hono)
const io = new Server(3000, {
    cors: {
        origin: "*",
    },
})

io.on("connection", (socket) => {
    console.log(socket.id, "connected")

    // socket.on("send")
})
