import * as Y from "yjs"
import { Observable } from "lib0/observable"

class Provider extends ObservableV2 {
    /**
     * @param {Y.Doc} ydoc
     */
    constructor(ydoc: Y.Doc) {
        super()

        ydoc.on("update", (update, origin) => {
            // ignore updates applied by this provider
            if (origin !== this) {
                // this update was produced either locally or by another provider.
                this.emit("update", [update])
            }
        })
        // listen to an event that fires when a remote update is received
        this.on("update", (update) => {
            Y.applyUpdate(ydoc, update, this) // the third parameter sets the transaction-origin
        })
    }
}
