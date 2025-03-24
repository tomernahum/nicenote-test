import Quill, { Delta, Range } from "quill";

import "quill/dist/quill.core.css";
import "quill/dist/quill.snow.css";
import "quill/dist/quill.bubble.css";

export function setupEditors1() {
    const wrapper = document.getElementById("editors")!;
    wrapper.innerHTML = `
        <div>
            <h3> Editor 1 </h3>
            <div id="editor1"> Hello </div>
            <button id="editor1Sync">
                sync off
            </button>
            <br />

            <button id="hiButton">
                enable random sets
            </button>
            <button id="hiButton2">
                enable random adds
            </button>
            <button id="rerenderButton">
                enable periodic rerenders
            </button>
            <button id="rerenderButton2">
                enable random changes best so far
            </button>

            <h3> Editor 2 </h3>
            <div id="editor2"> Hello </div>
            <button id="editor2Sync">
                sync off
            </button>
        </div>
    `;

    let syncEditor1 = true;
    let syncEditor2 = true;
    const editor1SyncButton = document.getElementById("editor1Sync")!;
    const editor2SyncButton = document.getElementById("editor2Sync")!;
    editor1SyncButton.addEventListener("click", () => {
        syncEditor1 = !syncEditor1;
        editor1SyncButton.innerText = syncEditor1 ? "sync on" : "sync off";
    });
    editor1SyncButton.innerText = syncEditor1 ? "sync on" : "sync off";
    editor2SyncButton.addEventListener("click", () => {
        syncEditor2 = !syncEditor2;
        editor2SyncButton.innerText = syncEditor2 ? "sync on" : "sync off";
    });
    editor2SyncButton.innerText = syncEditor2 ? "sync on" : "sync off";

    const quill1 = new Quill("#editor1", {
        theme: "snow",
    });
    const quill2 = new Quill("#editor2", {
        // theme: "bubble",
        theme: "snow",
    });

    quill1.on("text-change", async (changeDelta, oldStateDelta, source) => {
        console.log(changeDelta);

        // send the change delta to editor 2
        if (!syncEditor1) {
            return;
        }
        // await waitRandom();
        await new Promise((resolve) => setTimeout(resolve, 200));
        const resultantDelta = quill2.updateContents(changeDelta, "silent"); // using silent for now to avoid infinite feedback loop

        // check if the change delta is the same as the resultant delta, if not it's definitely out of sync
        if (JSON.stringify(resultantDelta) != JSON.stringify(changeDelta)) {
            console.log("change differs", {
                og: changeDelta,
                res: resultantDelta,
            });
        }
    });
    quill2.on("text-change", async (changeDelta, oldStateDelta, source) => {
        if (!syncEditor2) {
            return;
        }
        // await waitRandom();
        await new Promise((resolve) => setTimeout(resolve, 200));
        const resultantDelta = quill1.updateContents(changeDelta, "silent");
        if (JSON.stringify(resultantDelta) != JSON.stringify(changeDelta)) {
            console.log("change differs", {
                og: changeDelta,
                res: resultantDelta,
            });
        }
    });
    /*
    if we ever miss syncing a change, it seems to be liable to  state diverge / sometimes break badly
    so if we go offline syncing was off, we need to sync changes from when we were offline
    also if a change was rejected by server

    also it does NOT result the same if deltas are applied out of order, so I think they are not OT suitable like the docs claim (this is apparently called tp1, tp2), maybe I am missing a cruical step
    
    we simulate messages arriving out of order here with getRandom. in truth messages from one person won't arrive out of order as tcp will order them for us, if theres 3 people idk, maybe central server would order it for us
    */

    //

    const hiButton = document.getElementById("hiButton")!;
    const rerenderButton = document.getElementById("rerenderButton")!;
    const hiButton2 = document.getElementById("hiButton2")!;
    const rerenderButton2 = document.getElementById("rerenderButton2")!;
    hiButton.addEventListener("click", () => {
        setInterval(() => {
            const selection = quill1.getSelection();

            const contents = quill1.getContents();
            const hiDelta = new Delta().insert("hi");

            const newContents = contents.compose(hiDelta);
            quill1.setContents(newContents);

            const newSelection = selection;
            quill1.setSelection(newSelection);
        }, 1000);
    });

    rerenderButton.addEventListener("click", () => {
        setInterval(() => {
            // const selection = quill1.getSelection();

            // set it to the "canonical" contents
            const contents = quill1.getContents();

            quill1.setContents(contents);
            // quill1.setSelection(selection);
        }, 200);
    });
    hiButton2.addEventListener("click", () => {
        // does a good job preserving where your selection was
        setInterval(() => {
            const hiDelta = new Delta().insert("hi");
            quill1.updateContents(hiDelta);
        }, 1000);
    });
    rerenderButton2.addEventListener("click", () => {
        setInterval(() => {
            const oldSelection = quill1.getSelection();

            // set it to the "canonical" contents. may be a bit different
            const oldContents = quill1.getContents();
            const randomLength = getRandomInt(0, 4);
            let randomString = "";
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const char = chars[Math.floor(Math.random() * chars.length)];
            for (let i = 0; i < randomLength; i++) {
                randomString += char;
            }
            const retainLength = getRandomInt(
                0,
                Math.floor(oldContents.length() / 1)
            );

            const hiDelta = new Delta()
                .retain(retainLength)
                .insert(randomString);
            const newContents = oldContents.compose(hiDelta);

            //
            oldContents;
            newContents;

            // apply the newContents
            const diff = oldContents.diff(newContents);
            quill1.updateContents(diff);
        }, 1000);
    });
}

export function setupEditors() {
    const wrapper = document.getElementById("editors")!;
    wrapper.innerHTML = `
        <div>
            <h3> Editor 1 </h3>
            <div id="editor1"> Hello </div>
            <button id="editor1Sync">
                sync off
            </button>
            <button id="editor1Rerender">
                reload state 
            </button>
            <br />

            <h3> Editor 2 </h3>
            <div id="editor2"> Hello </div>
            <button id="editor2Sync">
                sync off
            </button>
            <button id="editor2Rerender">
                reload state 
            </button>

            <h3> Canonical </h3>
            <div id="canonical"> Hello </div>
        </div>
    `;
    let syncEditor1 = true;
    let syncEditor2 = true;
    setupSyncButton("editor1", () => (syncEditor1 = !syncEditor1));
    setupSyncButton("editor2", () => (syncEditor2 = !syncEditor2));
    function setupSyncButton(editorId: string, toggle: () => void) {
        const editorSyncButton = document.getElementById(`${editorId}Sync`)!;
        editorSyncButton.addEventListener("click", () => {
            const syncVar = toggle();
            editorSyncButton.innerText = syncVar ? "sync on" : "sync off";
        });
        toggle();
        const syncVar = toggle();
        editorSyncButton.innerText = syncVar ? "sync on" : "sync off";
    }

    const quill1 = new Quill("#editor1", {
        theme: "snow",
    });
    const quill2 = new Quill("#editor2", {
        // theme: "bubble",
        theme: "snow",
    });

    const LATENCY = 4000;
    // const canonicalChangeList: Delta[] = [quill1.getContents()];
    const canonicalChangeList = new SlowObservableList<Delta>({
        latency: LATENCY,
        initialItems: [quill1.getContents()],
    });
    canonicalChangeList.subscribe((canonicalChangeList) => {
        const appliedChanges = canonicalChangeList.reduce((acc, change) => {
            return acc.compose(change);
        }, new Delta());

        console.log(
            "CANONICAL EVENT",
            canonicalChangeList.length,
            appliedChanges.ops
        );
    });

    //

    function handleQuillTextChange() {
        quill1.on("text-change", async (changeDelta, oldStateDelta, source) => {
            // console.log("text-change", changeDelta, source);
            if (!syncEditor1) {
                return;
            }

            // todo irl maybe: some batching

            // notify the canonical list
            canonicalChangeList.push(changeDelta);

            // notify the other editors
            // irl would be over server boundary, eg socket.broadcast
            new Promise((resolve) => setTimeout(resolve, LATENCY)).then(() => {
                quill2.updateContents(changeDelta, "silent");
                // or testing smething
                // const newContents = oldStateDelta.compose(changeDelta);
                // mergeInNewContents(quill2, newContents);
            });
        });
        quill2.on("text-change", async (changeDelta, oldStateDelta, source) => {
            // console.log("text-change", changeDelta, source);
            if (!syncEditor1) {
                return;
            }

            // todo irl maybe: some batching

            // notify the canonical list
            canonicalChangeList.push(changeDelta);

            // notify the other editors
            // irl would be over server boundary
            new Promise((resolve) => setTimeout(resolve, LATENCY)).then(() => {
                quill1.updateContents(changeDelta, "silent");
                // or testing smething
                // const newContents = oldStateDelta.compose(changeDelta);
                // mergeInNewContents(quill2, newContents);
            });
        });
    }

    handleQuillTextChange();

    canonicalChangeList.subscribe((canonicalChangeList) => {
        // const appliedChanges = canonicalChangeList.reduce((acc, change) => {
        //     return acc.compose(change);
        // }, new Delta());
        // mergeInNewContents(quill1, appliedChanges);
        // mergeInNewContents(quill2, appliedChanges);
    });

    function mergeInNewContents(quill: Quill, newContents: Delta) {
        const oldContents = quill.getContents();

        const diff = oldContents.diff(newContents);

        quill.updateContents(diff, "silent");
    }

    const editor1RerenderButton = document.getElementById("editor1Rerender")!;
    editor1RerenderButton.addEventListener("click", () => {
        rerender(quill1);
    });
    const editor2RerenderButton = document.getElementById("editor2Rerender")!;
    editor2RerenderButton.addEventListener("click", () => {
        rerender(quill2);
    });
    // we can rerender every time the editor loses focus, if only all local changes are merged in already

    function rerender(quill: Quill) {
        const newContents = canonicalChangeList
            .toArray()
            .reduce((acc, change) => {
                return acc.compose(change);
            }, new Delta());
        quill.setContents(newContents, "silent");
    }

    // canonical
    const canonical = new Quill("#canonical", {
        theme: "snow",
        readOnly: true,
    });
    canonicalChangeList.subscribe((canonicalChangeList) => {
        const appliedChanges = canonicalChangeList.reduce((acc, change) => {
            return acc.compose(change);
        }, new Delta());
        canonical.setContents(appliedChanges, "silent");
    });

    /*
        so now here we are broadcasting to all but selves, and also broadcasting to canonical listener
        it would be good if editors naturally stayed in sync but they don't very well. maybe a crdt library would?? then I got to bring my own dom <-> state sync

        or could do crdt <--> quill (<--> dom)   in fact bindings like these exist already

        creating event   : (user edits and api edits) --> quill delta --> yjs transformation -> encrypted transformation
        from another user: encrypted -> yjs -> quill delta -> dom
        not just one to one events. the yjs system tells us when a new event happens, then we translate that into a quill delta (differently for each client), yjs is consistent one, and that shows it for us...


        my original idea was to have
        canonical state + optimistic actions at the end. when optimisticAction is confirmed it's good

    */
}

async function waitRandom() {
    return await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 1000)
    );
}
function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

type Subscriber<T> = (value: T) => void;
class SlowObservableList<T> {
    private items: T[] = [];
    private subscribers: Subscriber<T[]>[] = [];

    private latency = 0;

    constructor({
        latency = 0,
        initialItems = [],
    }: { latency?: number; initialItems?: T[] } = {}) {
        this.latency = latency;
        this.items = initialItems;
    }

    subscribe(callback: Subscriber<T[]>) {
        this.subscribers.push(callback);
        callback(this.items); // Initial call with current state
        return () => {
            // Return unsubscribe function
            this.subscribers = this.subscribers.filter((cb) => cb !== callback);
        };
    }

    private notifySubscribers() {
        this.subscribers.forEach((callback) => callback(this.items));
    }

    async push(...items: T[]) {
        await new Promise((resolve) => setTimeout(resolve, this.latency));
        this.items.push(...items);
        this.notifySubscribers();
    }

    pop(): T | undefined {
        const item = this.items.pop();
        this.notifySubscribers();
        return item;
    }

    clear() {
        this.items = [];
        this.notifySubscribers();
    }

    get length(): number {
        return this.items.length;
    }

    get(index: number): T | undefined {
        return this.items[index];
    }

    toArray(): T[] {
        return [...this.items];
    }
}
