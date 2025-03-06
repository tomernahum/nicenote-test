
import { Server } from "socket.io";
import { db } from "./db";

const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
> (3000, {
    cors: {
        origin: "*"
    }
})

type SocketType = Parameters<(Parameters<typeof io.on<"connection">>[1])>[0]


io.on("connection", (socket)=>{
    console.log("Connected !", socket.id)

    registerRoomHandlers(socket)

    socket.on("sendAction", async (actionData, callback)=>{
        // insert the action into the db, copying for each doc
        try {
            // using better-sqlite3 for now, it is synchronous
            const insert = db.prepare(`
                INSERT INTO actions (doc_id, all_doc_ids, action_data, encryption_scheme_version)
                VAlUES (?, ?, ?, ?)
            `);
            db.transaction(()=>{
                for (const docId of actionData.toDocs){
                    insert.run(docId, actionData.toDocs, actionData.actionData, actionData.esv)
                }
            })
        }
        catch {
            callback("500")
            return
        }

        // if successful, notify any clients in the rooms
        actionData.toDocs.forEach(docId=>{
            io.to(docId).emit("receiveAction", actionData)
        })
        callback("200")

    })
})


function registerRoomHandlers(socket: SocketType){
    async function leaveAllRoomsButDefault(){ 
        socket.rooms.forEach(room => {
            if (room != socket.id){
                socket.leave(room)
            }
        })
    }
    socket.on("join_room_exclusively", async (roomId, callback)=>{
        await leaveAllRoomsButDefault()
        await socket.join(roomId)
        callback("200")
    })
    socket.on("join_room", async (roomId, callback)=>{
        await socket.join(roomId)
        callback("200")
    })
    socket.on("leave_room", async (roomId, callback)=>{
        await socket.leave(roomId)
        callback("200")
    })
    
}

