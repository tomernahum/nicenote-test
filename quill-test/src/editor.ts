import Quill from "quill"; // Imports full build
// import Quill from "quill/core"; // Imports core, doesn't seem to work with non-core themes

import "quill/dist/quill.core.css";
import "quill/dist/quill.snow.css";
import "quill/dist/quill.bubble.css";

//

export function setupEditor() {
    const elementSelector = "#editor";
    const toolbarSelector = "#toolbar";

    const quill = new Quill(elementSelector, {
        theme: "bubble",
        formats: null, // restrict what kind of text can exist. better solution is to register them into registries which allows multiple different editors to coexist (why does it need this) and allows custom format creation

        modules: {
            // can also specify a separate div as the toolbar
            // toolbar: [
            //     // specifies what buttons will appear in the toolbar, can also register handlers that will do something on button press (ie transform the text, ask user for url of a link and then transformt the text, etc)
            //     // [{ header: [1, 2, false] }],
            //     ["bold", "italic", "underline", "strike","link"],
            //     ["h1", "h2", "code-block"],
            //     ["image"],
            // ],
            // there exist modules to custimize the toolbar, keyboard shortcuts, paste formatting, undo/redo history, and code syntax highlighting
        },
    });
    const thing = document.querySelector(toolbarSelector)!;
    console.log(thing);
    const button = document.createElement("button");
    button.innerText = "press me";
    button.addEventListener("click", () => {
        quill.insertText(0, "you pressed?");
    });
    thing.appendChild(button);

    quill.on(Quill.events.TEXT_CHANGE, (delta, oldDelta, source) => {
        // source = user, api, or silent (this won't be called if it was silent)
        // user = user typed or clicked a button, api = our app made the change "manually" via quill.insertText() and similar (unless you manually specify in insertText to be from the user)

        const contents = quill.getContents();
        console.log("text changed", {
            source,
            change: JSON.stringify(delta, null, 2),
            newContents: JSON.stringify(contents, null, 2),
            oldContents: JSON.stringify(oldDelta, null, 2),
        });
    });
    quill.on(Quill.events.SELECTION_CHANGE, (range, oldRange, source) => {
        console.log("selection changed", {
            source,
            range,
            oldRange,
        });
    });
    // quill.on(
    //     Quill.events.EDITOR_CHANGE,
    //     (eventName, oldDeltaOrRange, source) => {
    //         // this is called even when source is silent I think
    //         console.log("text or selection changed", {
    //             eventName,
    //             source,
    //             oldDeltaOrRange,
    //         });
    //     }
    // );
}
