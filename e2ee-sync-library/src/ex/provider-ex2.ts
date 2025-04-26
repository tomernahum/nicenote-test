import * as Y from "yjs"
import { createProvider } from "../provider"

const doc1 = new Y.Doc()
const doc2 = new Y.Doc()
const provider1 = createProvider(doc1, (update) => {
    provider2.applyRemoteUpdate(update)
})
const provider2 = createProvider(doc2, (update) => {
    provider1.applyRemoteUpdate(update)
})

function str(doc: Y.Doc) {
    return doc.getText("text").toJSON()
}
function logDocs() {
    console.log({
        doc1: str(doc1),
        doc2: str(doc2),
    })
}
const text1 = doc1.getText("text")
const text2 = doc2.getText("text")

//
logDocs()
text1.insert(0, "Hello")
logDocs()
text2.insert(5, " World")
logDocs()
text1.insert(5, " There")
logDocs()
