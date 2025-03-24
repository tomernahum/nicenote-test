import { schema } from "prosemirror-schema-basic";
import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import "prosemirror-view/style/prosemirror.css";

export function setupEditor(editorId: string, element: HTMLDivElement) {
    const editorWrapper = document.createElement("div");
    editorWrapper.classList.add("editor-wrapper");
    editorWrapper.style.cssText = `
        border: 2px solid white; 
        padding: 0rem 0.5rem;
    `;
    element.appendChild(editorWrapper);

    let state = EditorState.create({
        schema, // uses the schema from prosemirror-schema-basic
    });
    let view = new EditorView(editorWrapper, {
        state,
        dispatchTransaction(transaction) {
            // state = transaction.state;
            onEditorTransaction(editorId, transaction);
            view.updateState(state);
        },
    });

    return;
}

function onEditorTransaction(editorId: string, transaction: Transaction) {
    console.log(transaction, transaction.state);
}
