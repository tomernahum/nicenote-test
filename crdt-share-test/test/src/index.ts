import * as Y from "yjs"

function createProvider(
    ydoc: Y.Doc,
    onBroadcastAttempt: (update: Uint8Array) => void
) {
    const clientId = crypto.randomUUID()
    const providerId = clientId

    ydoc.on("update", (update, origin) => {
        // don't react to updates applied by this provider
        if (origin === providerId) {
            return
        }

        // this update was produced either locally or by another provider.
        // this.emit("update", [update])
        onBroadcastAttempt(update)
        console.log("update", update)
    })

    function onRemoteUpdateReceived(update: Uint8Array) {
        Y.applyUpdate(ydoc, update, providerId) // the third parameter sets the transaction-origin
    }

    return {
        applyRemoteUpdate: onRemoteUpdateReceived,
    }
}

const doc1 = new Y.Doc()
const doc2 = new Y.Doc()
const provider1 = createProvider(doc1, onBroadcastAttemptP1)
const provider2 = createProvider(doc2, () => {})

function onBroadcastAttemptP1(update: Uint8Array) {
    provider2.applyRemoteUpdate(update)
}

function str(doc: Y.Doc) {
    return doc.getText("text").toJSON()
}

const text1 = doc1.getText("text")
const text2 = doc2.getText("text")
function logDocs() {
    console.log({
        doc1: str(doc1),
        doc2: str(doc2),
    })
}

//
logDocs()
text1.insert(0, "Hello")
logDocs()
text2.insert(5, " World")
logDocs()
text1.insert(5, " There")
logDocs()
