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
// import { setLatency } from "../1--mock-server-interface"
import { getRandomAnimal, getRandomColor } from "../utils"
import {
    generateSymmetricEncryptionKey,
    getNonSecretHardCodedKeyForTestingSymmetricEncryption,
} from "../1-crypto-update-factory"
import { getProviderServerInterface } from "../1-provider-server-interface"
import { prettyUpdateString } from "../0-data-model"

Quill.register("modules/cursors", QuillCursors)

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <!-- <div>
    <label for="latency">Latency (ms):</label>
    <input type="number" id="latency" value="500" />
  </div> -->
  <br />

  <div id="editors">
    <div id="editor1"></div>
    <br />
    <div id="editor2"></div>
    <br />
    <div id="editor3"></div>
    <br />
    <div id="data-display"></div>
  </div>
`
// latency slider
// const latencyInput = document.getElementById("latency") as HTMLInputElement
// latencyInput.addEventListener("input", (e) => {
//     const latency = parseInt(latencyInput.value)
//     // setLatency("doc1", latency)
// })

function createQuillEditor(elementSelector: string) {
    const toolbar1 = [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline"],
        ["image", "code-block"],
    ]

    const toolbar2 = [
        // Font selection (Google Docs usually supports a variety of fonts)
        [{ font: [] }],

        // Header formatting (H1 to H6, plus normal text)
        [{ header: [1, 2, 3, 4, 5, 6, false] }],

        // Basic text formatting: Bold, Italic, Underline and Strike through.
        ["bold", "italic", "underline", "strike"],

        // Color and background color pickers
        [{ color: [] }, { background: [] }],

        // Subscript and Superscript (if needed)
        [{ script: "sub" }, { script: "super" }],

        // List options: Ordered and bullet list.
        [{ list: "ordered" }, { list: "bullet" }],

        // Indentation controls.
        [{ indent: "-1" }, { indent: "+1" }],

        // Text alignment options.
        [{ align: [] }],

        // Insert links, images, and videos.
        ["link", "image", "video"],

        // Clear formatting button.
        ["clean"],
    ]
    const toolbar3 = [
        // Font selection
        [{ font: [] }],

        // Header formatting (H1 to H6, plus normal text)
        // [{ header: [1, 2, 3, 4, 5, 6, false] }],

        // Font size (this might need a corresponding CSS configuration)
        [{ size: ["small", false, "large", "huge"] }],
        // [{ size: ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '36px'] }],

        // Basic text formatting: Bold, Italic, Underline, Strike through.
        ["bold", "italic", "underline", "strike"],

        ["link", "formula"],

        // Subscript and superscript.
        [{ script: "sub" }, { script: "super" }],

        // Block formatting: Code Block and Blockquote.
        ["blockquote", "code-block"],

        // Color and background color pickers.
        [{ color: [] }, { background: [] }],

        // List options: Ordered and bullet lists.
        [{ list: "ordered" }, { list: "bullet" }],

        // Outdent and Indent.
        [{ indent: "-1" }, { indent: "+1" }],

        // Text alignment options.
        [{ align: [] }],

        // Media embeds: Link, Image, Video, Formula.
        // ["link", "image", "video", "formula"],
        ["image", "video"],

        // Clear formatting.
        ["clean"],

        // (Optional) Custom item example: Adding a horizontal rule.
        // You would need to implement a custom handler for this option.
        // [{ // This is a custom group that you can tie to a custom handler.
        //   handler: "insertHorizontalRule"
        // }],
    ]
    const quillEditor = new Quill(elementSelector, {
        modules: {
            cursors: true,
            // cursors: {
            //     transformOnTextChange: true,
            // },
            toolbar: toolbar3,
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
            mainKey:
                await getNonSecretHardCodedKeyForTestingSymmetricEncryption(),
            validOldKeys: [],
        },
    }).catch((error) => {
        console.error("App: Failed to create remote doc provider!", error)
        if (error instanceof Error) {
            if (error.message.includes("connect failed")) {
                alert("sorry you may be offline")
            }
        }
        throw error
    })

    if (false && elementSelector === "#editor1") {
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
// console.log("----")
// await createEditor("#editor2", "doc1")
// console.log("----")
// await createEditor("#editor3", "doc1")

async function createDisplay(docId: string) {
    const dataDisplayDiv = document.getElementById("data-display")!
    dataDisplayDiv.innerHTML = `
        <pre id="json-display" 
            style="overflow: scroll; max-height: 600px;"
        >...</pre>
        <button id = "refresh-button"> Refresh </button>
    `
    const jsonDisplay = dataDisplayDiv.querySelector("pre")!
    const refreshButton = dataDisplayDiv.querySelector("button")!

    const encryptionParams = {
        mainKey: await getNonSecretHardCodedKeyForTestingSymmetricEncryption(),
        validOldKeys: [],
    }

    const serverInterface = await getProviderServerInterface(
        docId,
        encryptionParams
    )

    await serverInterface.connect()

    async function refresh() {
        const remoteUpdates = await serverInterface.getRemoteUpdateList(true)
        const docUpdates = remoteUpdates.filter((u) => u.bucket === "doc")
        const awarenessUpdates = remoteUpdates.filter(
            (u) => u.bucket === "awareness"
        )

        const stringifiedUpdates = JSON.stringify(
            {
                docUpdates: await Promise.all(
                    docUpdates.map(prettyUpdateString)
                ),
                awarenessUpdates: await Promise.all(
                    awarenessUpdates.map(prettyUpdateString)
                ),
            },
            null,
            2
        )
        console.log("(updatesDisplay) remoteUpdates:", remoteUpdates)
        jsonDisplay.textContent = stringifiedUpdates
    }

    refreshButton.addEventListener("click", refresh)
    refresh()
}
createDisplay("doc1")
