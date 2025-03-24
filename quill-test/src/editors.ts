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
            <br />

            <h3> Editor 2 </h3>
            <div id="editor2"> Hello </div>
            <button id="editor2Sync">
                sync off
            </button>
        </div>
    `;
    const quill1 = new Quill("#editor1", {
        theme: "snow",
    });
    const quill2 = new Quill("#editor2", {
        // theme: "bubble",
        theme: "snow",
    });
}

async function waitRandom() {
    return await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 1000)
    );
}
function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
