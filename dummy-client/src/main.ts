import { io } from 'socket.io-client'
import './style.css'

async function getHelloWorld(){
    const r = await fetch("http://localhost:3000")
    const x = await r.text()
    console.log(x)
}


const socket = io("localhost:3000")
getHelloWorld()
socket.on("connect", ()=>{console.log("connected to socket server")})
socket.on("testEvent", (data)=>{console.log("test event", data)})
