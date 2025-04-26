import Quill, { Delta, Range } from "quill"


import "quill/dist/quill.core.css"
import "quill/dist/quill.snow.css"
import "quill/dist/quill.bubble.css"

export function setupEditors() {
    const wrapper = document.getElementById("editors")!
    wrapper.innerHTML = `
        <div>
            todo latency slider

            <h3> Editor 1 </h3>
            <div id="editor1"> Hello </div>
            <button id="editor1Rerender">
                reload state 
            </button>
            <br />

            <h3> Editor 2 </h3>
            <div id="editor2"> Hello </div>
            <button id="editor2Rerender">
                reload state 
            </button>

            <h3> Canonical </h3>
            <div id="canonical"> Hello </div>
        </div>
    `

    const quill1 = new Quill("#editor1", {
        theme: "snow",
    })
    const quill2 = new Quill("#editor2", {
        // theme: "bubble",
        theme: "snow",
    })

    //
    const LATENCY = 1000
    // const canonicalChangeList: Delta[] = [quill1.getContents()];
    const canonicalChangeList = new SlowObservableList<[Id, Delta]>({
        latency: LATENCY,
        initialItems: [[crypto.randomUUID(), quill1.getContents()]],
    })

    ///

    // canonical
    const canonical = new Quill("#canonical", {
        theme: "snow",
        readOnly: true,
    })
    canonicalChangeList.subscribe((canonicalChangeList) => {
        const appliedChanges = convertToOneDelta(canonicalChangeList)
        console.log(
            "CANONICAL EVENT",
            canonicalChangeList.length,
            deltaToString(appliedChanges)
        )
        canonical.setContents(appliedChanges, "silent")
    })
    ///
    const optimisticChangeListEditor1 = new SlowObservableList<[Id, Delta]>({
        latency: 0,
        initialItems: [],
    })
    const optimisticChangeListEditor2 = new SlowObservableList<[Id, Delta]>({
        latency: 0,
        initialItems: [],
    })

    quill1.on("text-change", async (changeDelta, oldStateDelta, source) => {
        // add it to our system
        const id = crypto.randomUUID()
        optimisticChangeListEditor1.push([id, changeDelta])
        canonicalChangeList.push([id, changeDelta])
    })
    quill2.on("text-change", async (changeDelta, oldStateDelta, source) => {
        // add it to our system
        const id = crypto.randomUUID()
        optimisticChangeListEditor2.push([id, changeDelta])
        canonicalChangeList.push([id, changeDelta])
    })

    // on change in canonical list:
    // either apply the new one to us
    // if it comes from us, still apply it but remove it from our optimistic changes list
    // then rerender us
    canonicalChangeList.subscribeItem((newItem, fullList) => {
        const cursorIsAtEndToStart =
            quill1.getSelection()?.index === quill1.getLength() - 1

        // remove the corresponding optimistic change if it exists
        optimisticChangeListEditor1.filter(([id, change]) => {
            return newItem[0] === id
        })
        optimisticChangeListEditor2.filter(([id, change]) => {
            return newItem[0] === id
        })

        // rerender the editor with the new canon state
        const canonicalState = convertToOneDelta(fullList)

        const optimisticState1 = convertToOneDelta(
            optimisticChangeListEditor1.toArray(),
            canonicalState // start with canonical state
        )
        const optimisticState2 = convertToOneDelta(
            optimisticChangeListEditor2.toArray(),
            canonicalState // start with canonical state
        )

        const x1 = mergeInNewContents(quill1, optimisticState1)
        mergeInNewContents(quill2, optimisticState2)

        const cursorIsAtEnd =
            quill1.getSelection()?.index === quill1.getLength() - 1
        const cursorIsNull = quill1.getSelection()?.index === null
        if (cursorIsAtEndToStart && !cursorIsAtEnd && !cursorIsNull) {
            console.warn(
                "cursor is not at end after merge due to canonical state change!",
                {
                    diffApplied: x1.ops,
                    canonicalState: canonicalState.ops,
                    optimisticState: optimisticState1.ops,
                    fullOptimisticState: optimisticChangeListEditor1.toArray(),
                    fullOptimisticStateCleaner: optimisticChangeListEditor1
                        .toArray()
                        .map(([_, change]) => deltaToString(change)),
                }
            )
            alert("!")
        }
    })
    setInterval(() => {
        // console.log("RERENDERING");
        const canonicalState = convertToOneDelta(canonicalChangeList.toArray())

        const optimisticState1 = convertToOneDelta(
            optimisticChangeListEditor1.toArray(),
            canonicalState // start with canonical state
        )

        canonical.setContents(canonicalState, "silent")
        mergeInNewContents(quill1, optimisticState1)

        const cursorIsAtEnd =
            quill1.getSelection()?.index === quill1.getLength() - 1
        const cursorIsNull = quill1.getSelection()?.index === null
        if (!cursorIsAtEnd && !cursorIsNull) {
            console.warn(
                "cursor is not at end after merge due to periodic rerender!"
            )
        }
    }, 100000000000000000)

    // doesn't quite work yet idk why
}

function deltaToString(delta: Delta) {
    const ops = delta.ops
    let thing
    if (ops.length === 1) {
        thing = ops[0]
    }
    return JSON.stringify(thing)
}
//

type Id = string
function convertToOneDelta(
    idDeltaList: [Id, Delta][],
    initialState = new Delta()
): Delta {
    return idDeltaList
        .map(([_, change]) => change)
        .reduce((acc, change) => {
            return acc.compose(change)
        }, initialState || new Delta())
}
function mergeInNewContents(quill: Quill, newContents: Delta) {
    const oldContents = quill.getContents()

    const diff = oldContents.diff(newContents)

    const diffThatWasApplied = quill.updateContents(diff, "silent")
    if (JSON.stringify(diffThatWasApplied) !== JSON.stringify(diff)) {
        console.warn("diff applied differed", {
            attempted: diff.ops,
            actual: diffThatWasApplied.ops,
        })
    }
    return diffThatWasApplied
}
//

async function waitRandom() {
    return await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 1000)
    )
}
function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

class SlowObservableList<T> {
    // Callback type for full state updates of the list.
    private subscribers: ((state: T[]) => void)[] = []
    // Callback type for notifications on each new item added.
    // The callback receives the new item, along with the full state of the list.
    private itemSubscribers: ((newItem: T, fullState: T[]) => void)[] = []

    private items: T[] = []
    private latency = 0

    constructor({
        latency = 0,
        initialItems = [],
    }: { latency?: number; initialItems?: T[] } = {}) {
        this.latency = latency
        this.items = initialItems
    }

    // Subscribe to full list updates.
    subscribe(callback: (state: T[]) => void) {
        this.subscribers.push(callback)
        callback(this.items) // Initial call with current state
        return () => {
            // Unsubscribe function.
            this.subscribers = this.subscribers.filter((cb) => cb !== callback)
        }
    }

    // Subscribe to notifications for each new item added.
    // The callback gets the new item and the full state of the list.
    subscribeItem(callback: (newItem: T, fullState: T[]) => void) {
        this.itemSubscribers.push(callback)
        return () => {
            this.itemSubscribers = this.itemSubscribers.filter(
                (cb) => cb !== callback
            )
        }
    }

    private notifySubscribers() {
        this.subscribers.forEach((callback) => callback(this.items))
    }

    async push(...newItems: T[]) {
        await new Promise((resolve) => setTimeout(resolve, this.latency))
        this.items.push(...newItems)
        this.notifySubscribers()
        // Notify each new item subscriber separately for every new item added.
        newItems.forEach((item) => {
            this.itemSubscribers.forEach((callback) =>
                callback(item, this.items)
            )
        })
    }

    pop(): T | undefined {
        const item = this.items.pop()
        this.notifySubscribers()
        return item
    }

    filter(filterFn: (item: T) => boolean): T[] {
        const removedItems: T[] = []
        this.items = this.items.filter((item) => {
            if (filterFn(item)) {
                removedItems.push(item)
                return false
            }
            return true
        })
        if (removedItems.length > 0) {
            this.notifySubscribers()
        }
        return removedItems
    }

    clear() {
        this.items = []
        this.notifySubscribers()
    }

    get length(): number {
        return this.items.length
    }

    get(index: number): T | undefined {
        return this.items[index]
    }

    toArray(): T[] {
        return [...this.items]
    }
}
