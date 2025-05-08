import * as Y from "yjs"
import { createSyncedYDocProviderDemo } from "./0-yjs-provider"

console.log("imported")

const yDoc = new Y.Doc()
const yText = yDoc.getText("text")

console.log("initialized yDoc")

try {
    const provider = await createSyncedYDocProviderDemo(yDoc, {
        remoteDocId: "test",
        mergeInitialState: true,
        onReconnect: "mergeLocalStateIntoOnline",
    })
} catch (err) {
    const e2 = new Error(err.message)
    throw e2
}

console.log("initialized provider")
