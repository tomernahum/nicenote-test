import Quill from 'quill';
import QuillCursors from 'quill-cursors';

import 'quill/dist/quill.bubble.css';
import './Note.global.css';

// shoot, with bubble theme, toolbar is cut off in the div
/*
 * to be used with createCollaborativeQuillEditor
 */
export function getInitializeQuillEditor(
	onEnterKey: (range: [number, number], context: any) => void
) {
	// TODO: don't rerun this if already registered
	Quill.register('modules/cursors', QuillCursors);

	return (element: HTMLElement | string) => {
		const quillEditor = new Quill(element, {
			modules: {
				cursors: true,
				// cursors: {
				//     transformOnTextChange: true,
				// },
				// toolbar: QUILL_TOOLBAR,
				history: {
					// Local undo shouldn't undo changes
					// from remote users
					userOnly: true
				},
				keyboard: {
					bindings: {
						noNewlineBinding: {
							key: 'enter', // Enter key
							handler: function (range, context) {
								// `range` is the current [index, length]
								// Do whatever you want here instead of inserting \n
								// e.g. insert “—” at cursor:
								console.error('enter key pressed');
								onEnterKey(range, context);
								// return false to prevent default newline
								return false;
							}
						}
					}
				}
			},
			placeholder: 'Start collaborating...',
			theme: 'bubble' // or 'snow'
		});

		quillEditor.keyboard.handleEnter;

		return quillEditor;
	};
}
