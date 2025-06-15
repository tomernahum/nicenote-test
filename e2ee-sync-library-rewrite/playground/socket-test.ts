import {
    ClientToServerEvents,
    ServerToClientEvents,
} from "../shared-server-client/shared-types"
import { io, Socket } from "socket.io-client"

await new Promise((resolve) => setTimeout(resolve, 500))

const SERVER_URL = "http://localhost:3000"
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
socket1.connect()
socket2.connect()

await new Promise<void>((resolve) => {
    if (socket1.connected) {
        resolve()
    } else {
        socket1.on("connect", resolve)
    }
})
await new Promise<void>((resolve) => {
    if (socket2.connected) {
        resolve()
    } else {
        socket2.on("connect", resolve)
    }
})
console.log("connected")

await new Promise<void>((resolve) => setTimeout(resolve, 300))

console.log("disconnecting 1")
socket1.disconnect()

await new Promise<void>((resolve) => setTimeout(resolve, 300))

try {
    const res = await socket2
        .timeout(5000)
        .emitWithAck("addUpdate", "my-testing-doc", new Uint8Array())
    console.log("added update", res)
} catch (e) {
    console.error(e)
}

const res2 = await socket2.timeout(1000).emitWithAck("getDoc", "my-testing-doc")
console.log("got doc", res2)

// socket2.emit(
//     "addUpdate",
//     "my-testing-doc",
//     new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]),
//     (result) => {
//         console.log(result)
//     }
// )

// Results: it is not combining the connection
