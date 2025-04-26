import { Editor } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit" // contains a collection of extensions
import BubbleMenu from "@tiptap/extension-bubble-menu"
import { Transaction } from "@tiptap/pm/state"

export function setupEditors(wrapperElement: HTMLElement) {
    wrapperElement.innerHTML = `
        <div id="editor1" class="editor"></div>
        <button id="editor1-bold-button">Bold</button>
        <br />
        <br />
        <div id="editor2" class="editor"></div>
        <br />
    `

    const editor1 = new Editor({
        element: document.getElementById("editor1")!,
        extensions: [StarterKit],
        content: "<p>Hello World</p>", // initial content

        onTransaction({ editor, transaction }) {
            // change in any state
            console.log("transaction", transaction, editor)
            onTransactionEditor1(editor, transaction)
        },
        onUpdate({ editor }) {
            // change in the content
            console.log("update", editor)
        },
    })
    setupButtons(editor1)
    const editor2 = new Editor({
        element: document.getElementById("editor2")!,
        extensions: [StarterKit],
        content: "<p>Hello World</p>",
    })

    const LATENCY = 1000

    // my style sync:   // should also try prebuilt ones with yjs, maybe I can make or use an encrypted yjs provider
    // const canonicalChangeList = new SlowObservableList<[Id, Delta]>({
    //     latency: LATENCY,
    //     initialItems: [[crypto.randomUUID(), quill1.getContents()]],
    // })

    function onTransactionEditor1(editor1: Editor, transaction: Transaction) {
        //
        // editor
    }
    // function onTransactionEditor2(editor2: Editor) {}

    //
    type Id = string
}

function setupButtons(editor: Editor) {
    const boldButton = document.getElementById("editor1-bold-button")!
    boldButton.addEventListener("click", () => {
        editor.chain().focus().toggleBold().run()
        // chain = multiple operations
        // focus = restore users dom focus and selection focus to the editor and last saved selection, optional but recommended for this kind of functionality
    })
}

// Demo:
// const CustomBold = Bold.extend({
//     renderHTML({ HTMLAttributes }) {
//       // Original:
//       // return ['strong', HTMLAttributes, 0]
//       return ['b', HTMLAttributes, 0]
//     },
//   })

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
