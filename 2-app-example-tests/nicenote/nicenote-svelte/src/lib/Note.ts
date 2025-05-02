import Quill from 'quill';
import QuillCursors from 'quill-cursors';

import 'quill/dist/quill.bubble.css';

// shoot, with bubble theme, toolbar is cut off in the div
/*
 * to be used with createCollaborativeQuillEditor
 */
export function initializeQuillEditor(element: HTMLElement | string) {
	// TODO: don't rerun this if already registered
	Quill.register('modules/cursors', QuillCursors);

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
			}
		},
		placeholder: 'Start collaborating...',
		theme: 'bubble' // or 'snow'
	});
	return quillEditor;
}
