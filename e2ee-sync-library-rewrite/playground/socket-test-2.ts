import {
    ClientToServerEvents,
    ServerToClientEvents,
} from "../shared-server-client/shared-types"
import { io, Socket } from "socket.io-client"

await new Promise((resolve) => setTimeout(resolve, 500))

const SERVER_URL = "http://localhost:3000"
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
        autoConnect: false, // do not connect upon initialization.
        reconnection: true, // do reconnect automatically
    }
)
const socket1: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
        autoConnect: false, // do not connect upon initialization.
        reconnection: true, // do reconnect automatically
    }
)
const socket2: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    SERVER_URL,
    {
        autoConnect: false, // do not connect upon initialization.
        reconnection: true, // do reconnect automatically
    }
)

console.log("connecting")
socket.connect()
socket1.connect()
socket2.connect()

function waitForConnection(
    socket: Socket<ServerToClientEvents, ClientToServerEvents>
) {
    return new Promise<void>((resolve) => {
        if (socket.connected) {
            resolve()
        } else {
            socket.on("connect", resolve)
        }
    })
}
await waitForConnection(socket)
await waitForConnection(socket1)
await waitForConnection(socket2)

console.log("connected")

socket1.emit("startListeningToDoc", "my-testing-doc")
socket1.on("newUpdate", (docId, update, rowId) => {
    console.log("socket1 newUpdate!", rowId)
})

socket2.emit("startListeningToDoc", "my-testing-doc")
socket2.on("newUpdate", (docId, update, rowId) => {
    console.log("socket2 newUpdate!", rowId)
})

await socket.emitWithAck(
    "addUpdate",
    "my-testing-doc",
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
)

socket1.emit("stopListeningToDoc", "my-testing-doc")

await socket.emitWithAck(
    "addUpdate",
    "my-testing-doc",
    new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
)
