// Quill Binding Demo...
// run with `vite .`

import Quill, { Delta, Range } from "quill"
import { QuillBinding } from "y-quill"
import QuillCursors from "quill-cursors"
import * as Y from "yjs"

import "quill/dist/quill.snow.css"
import { createRemoteDocProvider, setLatency } from "../local-provider"

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
            toolbar: [
                [{ header: [1, 2, false] }],
                ["bold", "italic", "underline"],
                ["image", "code-block"],
            ],
        },
        placeholder: "Start collaborating...",
        theme: "snow", // or 'bubble'
    })
    return quillEditor
}
function createEditor(elementSelector: string, remoteDocId: string) {
    const yDoc = new Y.Doc()
    const yType = yDoc.getText("quill")

    const yBindingProvider = createRemoteDocProvider(yDoc, {
        remoteDocId,
        mergeInitialState: true,
    })

    const quillEditor = createQuillEditor(elementSelector)
    const quillBinding = new QuillBinding(yType, quillEditor)
    //Optionally specify an Awareness instance, if supported by the Provider (not supported by my local-provider)
    // provider1.awareness.setLocalStateField('user', {
    //   name: 'Typing Jimmy',
    //   color: 'blue'
    // })

    return { yDoc, yType, quillEditor, quillBinding, yBindingProvider }
}

createEditor("#editor1", "doc1")
createEditor("#editor2", "doc1")
createEditor("#editor3", "doc1")
