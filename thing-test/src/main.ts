import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <div id="editor">
        <h3> Editor </h3>
        <p> Hello </p>
    </div>
`;

/*
    dom representation
    internal state representation

    on dom change create internal state change
    on internal state change create dom change

    - 
    on dom change create internal state change
    on internal state change create shared state change
    on shared state change create internal state change
    on internal state change create dom change
    except don't update for changes that came from yourself

    eg dcA -> iscA -> sscA  then can leave be or reconstruct

    ---
    quill js provides internal state and synchronization of internal state with dom, including log of changes

*/
//
const editorDiv = document.querySelector<HTMLDivElement>("#editor")!;
