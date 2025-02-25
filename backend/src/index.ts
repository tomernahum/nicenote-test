import { Hono } from "hono";
import { cors } from 'hono/cors'
import { serve } from "@hono/node-server";
import { Server } from "socket.io";
import type { Server as HTTPServer } from "node:http";

const app = new Hono();

const httpServer = serve({
    fetch: app.fetch,
    port: 3000,
});

const io = new Server(httpServer as HTTPServer, {
    /* options */
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use('*', cors())

//


app.get('/', (c) => {
    return c.text('Hello Hono!')
})    

io.on("connection", (socket) => {
    // ...
    socket.emit("testEvent", "Hello!")
});
