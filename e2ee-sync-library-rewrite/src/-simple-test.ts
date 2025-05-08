import * as Y from "yjs"
import { createSyncedYDocProviderDemo } from "./0-yjs-provider"

const yDoc = new Y.Doc()
const yText = yDoc.getText("text")

const provider = await createSyncedYDocProviderDemo(yDoc, {
    remoteDocId: "test",
    mergeInitialState: true,
    onReconnect: "mergeLocalStateIntoOnline",
})
