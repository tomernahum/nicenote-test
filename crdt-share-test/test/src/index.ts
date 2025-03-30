import * as Y from "yjs"
import { createRemoteDocProvider } from "./local-provider"

const doc1 = new Y.Doc()
const doc2 = new Y.Doc()
const doc3 = new Y.Doc()
doc3.getText("text").insert(0, "(Im existing innit)")

const provider1 = await createRemoteDocProvider(doc1, {
    remoteDocId: "myDoc",
    mergeInitialState: false,
})
const provider2 = await createRemoteDocProvider(doc2, {
    remoteDocId: "myDoc",
    mergeInitialState: true,
})
const provider3 = await createRemoteDocProvider(doc3, {
    remoteDocId: "myDoc",
    mergeInitialState: true,
})

const unrelatedDoc1 = new Y.Doc()
const provider4 = await createRemoteDocProvider(unrelatedDoc1, {
    remoteDocId: "unrelatedDoc",
    mergeInitialState: false,
})

const unrelatedDoc2 = new Y.Doc()
await createRemoteDocProvider(unrelatedDoc2, {
    remoteDocId: "unrelatedDoc",
    mergeInitialState: false,
})

function logDocs() {
    console.log({
        doc1: doc1.getText("text").toJSON(),
        doc2: doc2.getText("text").toJSON(),
        doc3: doc3.getText("text").toJSON(),
        doc4: doc4?.getText("text").toJSON(),
        unrelated1: unrelatedDoc1.getText("text").toJSON(),
        unrelated2: unrelatedDoc2.getText("text").toJSON(),
    })
}
async function logDocsTwiceWithWait() {
    logDocs()
    await new Promise((resolve) => setTimeout(resolve, 600))
    logDocs()
}

doc1.on("update", () => {
    // console.log("doc1 update")
})

logDocs()

doc1.getText("text").insert(0, "Hello")
doc2.getText("text").insert(0, "World")
unrelatedDoc1.getText("text").insert(0, "Unrelated ftw")
await logDocsTwiceWithWait()

console.log("creating doc4")
const doc4 = new Y.Doc()
doc4.getText("text").insert(0, "444")
await createRemoteDocProvider(doc4, {
    remoteDocId: "myDoc",
    mergeInitialState: true,
})

await logDocsTwiceWithWait()

console.log("-----------------\n----------")

doc1.getText("text").delete(0, 19)
doc3.getText("text").insert(2, "'")

await logDocsTwiceWithWait()

// interesting. the merge result is consistent across docs but not consistent across runs of this program

console.log("-----------------\n----------")
doc1.getText("text").delete(0, 1000)
await logDocsTwiceWithWait()
console.log("-----------------\n-------------\n\n")

doc1.getText("text").insert(0, "Hello")
doc2.getText("text").insert(0, "Hello")
await logDocsTwiceWithWait() // HelloHello

doc1.getText("text").delete(0, 5)
doc2.getText("text").delete(0, 5)
doc3.getText("text").delete(0, 2)
await logDocsTwiceWithWait() // Hello    // these are deduped. ok good

console.log("----Squash Test----")

provider1.doSquash()
doc1.getText("text").insert(0, "A")
doc2.getText("text").insert(2, "B")

await logDocsTwiceWithWait()

doc1.getText("text").insert(0, "1")
doc1.getText("text").insert(0, "(1)")
doc2.getText("text").insert(0, "2")
doc3.getText("text").insert(0, "3")
doc3.getText("text").insert(0, "(333)")

console.log("--- Dangerous Squash Test ---")

provider1.doSquash()
provider2.doSquash()

await logDocsTwiceWithWait()
