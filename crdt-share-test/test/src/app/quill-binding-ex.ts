// Quill Binding Demo...
// run with `vite .`

import Quill, { Delta, Range } from "quill"
import { QuillBinding } from "y-quill"
import QuillCursors from "quill-cursors"
import * as Y from "yjs"
import { WebsocketProvider } from "y-websocket"

import "quill/dist/quill.snow.css"
// import { createRemoteDocProvider, setLatency } from "./local-provider"
import { createRemoteDocProvider } from "../0-remote-provider"
import { setLatency } from "../1--mock-server-interface"
import { getRandomAnimal, getRandomColor } from "../utils"
import {
    generateSymmetricEncryptionKey,
    getNonSecretHardCodedKeyForTesting,
} from "../2-crypto"

Quill.register("modules/cursors", QuillCursors)

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <label for="latency">Latency (ms):</label>
    <input type="number" id="latency" value="500" />
  </div>
  <br />

  <div id="editors">
    <div id="editor1"></div>
    <br />
    <div id="editor2"></div>
    <br />
    <div id="editor3"></div>
  </div>
`
// latency slider
const latencyInput = document.getElementById("latency") as HTMLInputElement
latencyInput.addEventListener("input", (e) => {
    const latency = parseInt(latencyInput.value)
    setLatency("doc1", latency)
})

function createQuillEditor(elementSelector: string) {
    const quillEditor = new Quill(elementSelector, {
        modules: {
            cursors: true,
            // cursors: {
            //     transformOnTextChange: true,
            // },
            toolbar: [
                [{ header: [1, 2, false] }],
                ["bold", "italic", "underline"],
                ["image", "code-block"],
            ],
            history: {
                // Local undo shouldn't undo changes
                // from remote users
                userOnly: true,
            },
        },
        placeholder: "Start collaborating...",
        theme: "snow", // or 'bubble'
    })
    return quillEditor
}
let updatesCount = 0
async function createEditor(elementSelector: string, remoteDocId: string) {
    const yDoc = new Y.Doc()
    const yType = yDoc.getText("quill")

    // using our local-provider provider
    const yBindingProvider = await createRemoteDocProvider(yDoc, {
        remoteDocId,
        mergeInitialState: true,
        encryptionParams: {
            mainKey: await getNonSecretHardCodedKeyForTesting(),
            validOldKeys: [],
        },
    })

    if (false && (elementSelector === "#editor1" || false)) {
        yDoc.on("update", (update) => {
            updatesCount++
            console.log("updateCount", updatesCount)
        })
    }

    // Specify awareness information for local user to integrate with quill-cursors
    yBindingProvider.awareness.setLocalStateField("user", {
        name: `anonymous ${getRandomAnimal()}`,
        color: getRandomColor(),
    })

    const quillEditor = createQuillEditor(elementSelector)
    const quillBinding = new QuillBinding(
        yType,
        quillEditor,
        yBindingProvider.awareness
    )

    return { yDoc, yType, quillEditor, quillBinding, yBindingProvider }
}

await createEditor("#editor1", "doc1")
console.log("----")
await createEditor("#editor2", "doc1")
console.log("----")
await createEditor("#editor3", "doc1")
