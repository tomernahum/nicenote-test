import Quill from 'quill';
import QuillCursors from 'quill-cursors';

// to be used with createCollaborativeQuillEditor
function initializeQuillEditor(element: HTMLElement | string) {
	// TODO: don't rerun this if already registered
	Quill.register('modules/cursors', QuillCursors);
	const realElement = element instanceof HTMLElement ? element : document.querySelector(element)!;
	const quillWrapperElem = document.createElement('div');
	realElement.appendChild(quillWrapperElem);
}
