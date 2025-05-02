import { Server } from "socket.io"
import {
    addDocOperation,
    getAllDocOperations,
    getHighestIdForDoc,
    processSnapshot,
} from "./db"
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
// import { Bandwidth, ICreateToxicBody, Toxiproxy } from "toxiproxy-node-client"

// async function setupToxiProxy() {
//     // WIP
//     const toxiproxy = new Toxiproxy("http://localhost:8474")
//     const proxyBody = {
//         listen: "localhost:0",
//         name: "redis",
//         upstream: "redis:6379",
//     }
//     const proxy = await toxiproxy.createProxy(proxyBody)

//     await proxy.addToxic({
//         name: "latency_down",
//         type: "latency",
//         stream: "downstream",
//         toxicity: 1.0,
//         attributes: { latency: 500, jitter: 50 },
//     })

//     // const client = new Toxiproxy("http://localhost:8474")

//     // // Create a proxy named "hono" on 3001 → upstream 3000
//     // const proxy = await client.createProxy({
//     //     name: "hono",
//     //     listen: "127.0.0.1:3001",
//     //     upstream: "127.0.0.1:3000",
//     // })
//     // console.log(`Created proxy ${proxy.name} 3001→3000`)

//     // return proxy
// }

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
