import "./style.css";

import { setupEditors } from "./editors.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <div id="editors">
    </div>
`;

setupEditors(document.getElementById("editors")!);
