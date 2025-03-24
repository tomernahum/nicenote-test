import "./style.css";

import { setupEditor } from "./editor.ts";
import { setupEditors } from "./editors.ts";

// document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
//   <div>

//     <div id="toolbar"></div>
//     <h2>Editor:</h1>
//     <div id="editor">
//       <h2> Editor Initial Content</h1>
//       <p>Hello World!</p>
//       <p>Some initial <strong>bold</strong> text</p>
//       <p><br /></p>
//     </div>
//   </div>
// `;
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div id="editors">
  </div>
`;

setupEditors();
