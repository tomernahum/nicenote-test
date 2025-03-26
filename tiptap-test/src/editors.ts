import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit"; // contains a collection of extensions
import BubbleMenu from "@tiptap/extension-bubble-menu";

export function setupEditors(wrapperElement: HTMLElement) {
    wrapperElement.innerHTML = `
        <div id="editor1" class="editor"></div>
        <button id="editor1-button">Bold Selection</button>
        <div id="editor2" class="editor"></div>
    `;

    const editor1 = new Editor({
        element: document.getElementById("editor1")!,
        extensions: [
            // extensions provide functionality
            StarterKit.configure({
                heading: {
                    // levels: [1, 2, 3],
                    HTMLAttributes: {
                        class: "you-could-put tailwind-classes-here", // and they will apply to all headings. not sure what to do if you want to distinguish between different heading levels... but you can also style everything with css `.tiptap h1`, etc. you can also extend extensions. maybe you can provide the heading extension multiple times, restrict the level, and style it that way. In many ways I feel this is not the time for inline-styles anyway since the user is creating the content, it's not being created with html/jsx code. I like what roamresearch did where user can add styles & tailwind classes though.
                    },
                },
                // history: false // conflicts with tiptap's collaboration extension
            }),
            BubbleMenu.configure({
                element: document.getElementById("editor1-bubble-menu")!,
                shouldShow: ({ editor, view, state, oldState, from, to }) => {
                    // Only show the bubble menu when text is selected
                    return editor.isActive("textStyle") || from !== to;
                },
                // Optional positioning function (you may adjust this)
                tippyOptions: {
                    duration: 100,
                },
            }),
        ],
        content: "<p>Hello World</p>", // initial content
    });

    const doSomethingButton = document.getElementById("editor1-button")!;
    doSomethingButton.addEventListener("click", () => {
        // editor1.commands.setContent("<p>Do something</p>");
        // editor1.chain().focus().toggleBold().run();
        // chain = multiple operations
        // focus = restore users dom focus and selection focus to the editor and last saved selection, optional but recommended for this kind of functionality
    });
}

// Demo:
// const CustomBold = Bold.extend({
//     renderHTML({ HTMLAttributes }) {
//       // Original:
//       // return ['strong', HTMLAttributes, 0]
//       return ['b', HTMLAttributes, 0]
//     },
//   })
