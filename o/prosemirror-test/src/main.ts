import { setupEditor } from "./editor";
import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h2>NiceNote</h2>
    <div id="editor">
      <p>Helloo</p>
    </div>
  </div>
`;

setupEditor("main", document.querySelector<HTMLDivElement>("#editor")!);
