/*
 * Google Keep notes.
 * index.html holds the page, css/styles.css holds the layout,
 * and this file creates, shows, edits, searches, and archives notes.
 * Notes are kept in localStorage under STORAGE_KEY.
 *
 * The script is a module, so it runs after the page has been parsed.
 */

const STORAGE_KEY = "keep-notes";
const VIEW_NOTES = "notes";
const VIEW_ARCHIVE = "archive";

const EMPTY_NOTES_MESSAGE = "No notes yet. Add one above.";
const EMPTY_ARCHIVE_MESSAGE = "No archived notes.";
const EMPTY_SEARCH_MESSAGE = "No notes match your search.";
const ACTION_ARCHIVE = "archive";
const ACTION_UNARCHIVE = "unarchive";

/* Elements from index.html. A missing one stops the app with a clear error. */
function queryElement(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Google Keep is missing ${selector}.`);
  }

  return element;
}

const elements = {
  noteForm: queryElement("#note-form"),
  titleInput: queryElement("#note-title-input"),
  contentInput: queryElement("#note-content-input"),
  addNoteButton: queryElement("#add-note-button"),
  searchForm: queryElement("#search-form"),
  searchInput: queryElement("#search-input"),
  notesList: queryElement("#notes-list"),
  archiveList: queryElement("#archive-list"),
  notesSection: queryElement("#notes-section"),
  archiveSection: queryElement("#archive-section"),
  notesEmptyMessage: queryElement("#notes-empty-message"),
  archiveEmptyMessage: queryElement("#archive-empty-message"),
  noteCreator: queryElement("#note-creator"),
  notesNavButton: queryElement("#notes-nav-button"),
  archiveNavButton: queryElement("#archive-nav-button"),
  noteTemplate: queryElement("#note-card-template"),
  app: queryElement("#app"),
  noteModal: queryElement("#note-modal"),
  noteModalDialog: queryElement("#note-modal-dialog"),
  noteModalForm: queryElement("#note-modal-form"),
  noteModalTitleInput: queryElement("#note-modal-title-input"),
  noteModalContentInput: queryElement("#note-modal-content-input"),
  noteModalArchiveButton: queryElement("#note-modal-archive-button"),
  noteModalSaveButton: queryElement("#note-modal-save-button"),
};

/* Saved notes, the current search text, and which note the editor has open. */
let notes = [];
let searchQuery = "";
let editingNoteId = null;
let returnFocusElement = null;

/* --- Storage --- */

/* Read saved notes. Broken or duplicate records are dropped. */
function loadNotes() {
  try {
    const savedNotes = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(savedNotes)) {
      return [];
    }

    const seenIds = new Set();
    return savedNotes.flatMap((note) => {
      const normalizedNote = normalizeNote(note);
      if (!normalizedNote || seenIds.has(normalizedNote.id)) {
        return [];
      }

      seenIds.add(normalizedNote.id);
      return [normalizedNote];
    });
  } catch {
    return [];
  }
}

/* Write the current list. A storage failure still leaves the notes on screen. */
function saveNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    // The notes stay on screen when the browser refuses to store them.
  }
}

/* --- Note data --- */

/* Return trimmed text, or null when a note would be blank. */
function readNoteFields(title, content) {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  if (!trimmedTitle && !trimmedContent) {
    return null;
  }

  return { title: trimmedTitle, content: trimmedContent };
}

function normalizeNote(note) {
  if (!note || typeof note.id !== "string" || !note.id.trim()) {
    return null;
  }
  if (typeof note.title !== "string" || typeof note.content !== "string") {
    return null;
  }
  if (typeof note.archived !== "boolean") {
    return null;
  }

  return {
    id: note.id,
    title: note.title,
    content: note.content,
    archived: note.archived,
    createdAt: Number.isFinite(note.createdAt) ? note.createdAt : 0,
  };
}

/* randomUUID needs a secure page. The fallback still gives every note its own id. */
function createNoteId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createNote(title, content) {
  return {
    id: createNoteId(),
    title,
    content,
    archived: false,
    createdAt: Date.now(),
  };
}

function findNote(noteId) {
  return notes.find((note) => note.id === noteId);
}

/* Save, then draw both lists again. */
function commitNotes() {
  saveNotes();
  renderNotes();
}

/* Add a note. Returns false when both fields are empty. */
function addNote(title, content) {
  const fields = readNoteFields(title, content);
  if (!fields) {
    return false;
  }

  notes.unshift(createNote(fields.title, fields.content));
  commitNotes();
  return true;
}

function setNoteArchived(noteId, archived) {
  const note = findNote(noteId);
  if (!note || note.archived === archived) {
    return false;
  }

  note.archived = archived;
  commitNotes();
  return true;
}

/* Replace a note's text. Returns false when both fields are empty. */
function updateNote(noteId, title, content) {
  const note = findNote(noteId);
  const fields = readNoteFields(title, content);
  if (!note || !fields) {
    return false;
  }

  note.title = fields.title;
  note.content = fields.content;
  commitNotes();
  return true;
}

/* --- Display --- */

function noteMatchesSearch(note) {
  if (!searchQuery) {
    return true;
  }

  return `${note.title}\n${note.content}`.toLowerCase().includes(searchQuery);
}

function getNotesForView(archived) {
  return notes
    .filter((note) => note.archived === archived && noteMatchesSearch(note))
    .sort((first, second) => second.createdAt - first.createdAt);
}

function createNoteCard(note) {
  const fragment = elements.noteTemplate.content.cloneNode(true);
  const noteItem = fragment.querySelector(".note-item");
  const title = fragment.querySelector(".note-card-title");
  const content = fragment.querySelector(".note-card-content");

  noteItem.dataset.noteId = note.id;
  title.textContent = note.title;
  content.textContent = note.content;
  title.hidden = note.title.length === 0;
  content.hidden = note.content.length === 0;

  return fragment;
}

function renderList(listElement, visibleNotes, emptyMessage, archived) {
  const fragment = document.createDocumentFragment();
  visibleNotes.forEach((note) => {
    fragment.append(createNoteCard(note));
  });

  listElement.replaceChildren(fragment);

  const notesInView = notes.filter((note) => note.archived === archived).length;
  emptyMessage.hidden = visibleNotes.length > 0;

  if (visibleNotes.length > 0) {
    return;
  }

  if (searchQuery && notesInView > 0) {
    emptyMessage.textContent = EMPTY_SEARCH_MESSAGE;
    return;
  }

  emptyMessage.textContent = archived ? EMPTY_ARCHIVE_MESSAGE : EMPTY_NOTES_MESSAGE;
}

/* Draw the Notes list and the Archive list from the saved notes. */
function renderNotes() {
  renderList(elements.notesList, getNotesForView(false), elements.notesEmptyMessage, false);
  renderList(elements.archiveList, getNotesForView(true), elements.archiveEmptyMessage, true);
}

/* --- Views --- */

function fieldsHaveText(title, content) {
  return Boolean(title.trim() || content.trim());
}

function updateAddButton() {
  elements.addNoteButton.disabled = !fieldsHaveText(
    elements.titleInput.value,
    elements.contentInput.value
  );
}

function updateModalSaveButton() {
  elements.noteModalSaveButton.disabled = !fieldsHaveText(
    elements.noteModalTitleInput.value,
    elements.noteModalContentInput.value
  );
}

function setCurrentButton(button, isCurrent) {
  button.classList.toggle("nav-button-active", isCurrent);

  if (isCurrent) {
    button.setAttribute("aria-current", "page");
    return;
  }

  button.removeAttribute("aria-current");
}

/* Switch between the Notes view and the Archive view. */
function showView(view) {
  const showingArchive = view === VIEW_ARCHIVE;

  elements.notesSection.hidden = showingArchive;
  elements.archiveSection.hidden = !showingArchive;
  elements.noteCreator.hidden = showingArchive;
  setCurrentButton(elements.notesNavButton, !showingArchive);
  setCurrentButton(elements.archiveNavButton, showingArchive);
}

/* --- Composer --- */

function handleNoteSubmit(event) {
  event.preventDefault();

  const wasAdded = addNote(elements.titleInput.value, elements.contentInput.value);
  if (!wasAdded) {
    elements.contentInput.focus();
    return;
  }

  /* A search that would hide the new note is cleared so the note stays on screen. */
  const newestNote = notes[0];
  if (newestNote && !noteMatchesSearch(newestNote)) {
    searchQuery = "";
    elements.searchInput.value = "";
    renderNotes();
  }

  elements.noteForm.reset();
  updateAddButton();
  elements.titleInput.focus();
}

function handleComposerKeydown(event) {
  if (event.key !== "Enter" || (!event.ctrlKey && !event.metaKey)) {
    return;
  }

  event.preventDefault();
  if (elements.addNoteButton.disabled) {
    elements.contentInput.focus();
    return;
  }

  elements.noteForm.requestSubmit();
}

/* --- Editor --- */

function getModalFocusable() {
  return [...elements.noteModalDialog.querySelectorAll("button, input, textarea")].filter(
    (element) => !element.disabled
  );
}

function isAvailableToFocus(element) {
  return element instanceof HTMLElement && document.contains(element) && !element.closest("[hidden]");
}

/* Open the editor for one note and move focus into it. */
function openNoteModal(noteId, focusTarget) {
  const note = findNote(noteId);
  if (!note) {
    return;
  }

  editingNoteId = note.id;
  returnFocusElement = focusTarget || document.activeElement;
  elements.noteModalTitleInput.value = note.title;
  elements.noteModalContentInput.value = note.content;
  elements.noteModalArchiveButton.textContent = note.archived ? "Unarchive" : "Archive";
  elements.noteModalArchiveButton.dataset.tooltip = note.archived
    ? "Move this note back to your notes"
    : "Move this note to the archive";
  updateModalSaveButton();

  elements.noteModal.hidden = false;
  elements.app.inert = true;
  document.body.classList.add("modal-open");
  elements.noteModalTitleInput.focus();
}

/* Close the editor and return focus to a control the user can still see. */
function closeNoteModal() {
  const noteId = editingNoteId;
  elements.noteModal.hidden = true;
  elements.app.inert = false;
  document.body.classList.remove("modal-open");
  editingNoteId = null;

  const noteCard = noteId
    ? document.querySelector(`[data-note-id="${CSS.escape(noteId)}"]`)
    : null;
  const focusTarget = [noteCard, returnFocusElement, elements.notesNavButton].find(isAvailableToFocus);
  returnFocusElement = null;
  focusTarget?.focus();
}

function handleModalSubmit(event) {
  event.preventDefault();
  if (!editingNoteId) {
    return;
  }

  const wasSaved = updateNote(
    editingNoteId,
    elements.noteModalTitleInput.value,
    elements.noteModalContentInput.value
  );
  if (!wasSaved) {
    elements.noteModalContentInput.focus();
    return;
  }

  closeNoteModal();
}

function handleModalArchive() {
  const note = findNote(editingNoteId);
  if (!note) {
    closeNoteModal();
    return;
  }

  /* Keep the text currently in the editor, then move the note. */
  const wasSaved = updateNote(
    note.id,
    elements.noteModalTitleInput.value,
    elements.noteModalContentInput.value
  );
  if (!wasSaved) {
    elements.noteModalContentInput.focus();
    return;
  }

  setNoteArchived(note.id, !note.archived);
  closeNoteModal();
}

/* Escape closes the editor. Tab stays inside it. */
function handleModalKeydown(event) {
  if (elements.noteModal.hidden) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeNoteModal();
    return;
  }

  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (elements.noteModalSaveButton.disabled) {
      elements.noteModalContentInput.focus();
      return;
    }

    elements.noteModalForm.requestSubmit();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusable = getModalFocusable();
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) {
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleModalClick(event) {
  if (event.target.closest("[data-close-modal]")) {
    closeNoteModal();
  }
}

/* --- Note cards --- */

function handleNoteAction(event) {
  const actionButton = event.target.closest("[data-action]");
  const noteItem = event.target.closest(".note-item");
  if (!noteItem) {
    return;
  }

  const noteId = noteItem.dataset.noteId;
  if (actionButton?.dataset.action === ACTION_ARCHIVE) {
    setNoteArchived(noteId, true);
    return;
  }

  if (actionButton?.dataset.action === ACTION_UNARCHIVE) {
    setNoteArchived(noteId, false);
    return;
  }

  if (actionButton) {
    return;
  }

  openNoteModal(noteId, noteItem);
}

function handleNoteKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  if (event.target.closest("button")) {
    return;
  }

  const noteItem = event.target.closest(".note-item");
  if (!noteItem) {
    return;
  }

  event.preventDefault();
  openNoteModal(noteItem.dataset.noteId, noteItem);
}

/* --- Search --- */

function handleSearchSubmit(event) {
  event.preventDefault();
}

function handleSearchInput() {
  searchQuery = elements.searchInput.value.trim().toLowerCase();
  renderNotes();
}

/* --- Startup --- */

/* Connect the page controls, then show the saved notes. */
function init() {
  notes = loadNotes();

  elements.noteForm.addEventListener("submit", handleNoteSubmit);
  elements.noteForm.addEventListener("input", updateAddButton);
  elements.noteForm.addEventListener("keydown", handleComposerKeydown);
  elements.searchForm.addEventListener("submit", handleSearchSubmit);
  elements.searchInput.addEventListener("input", handleSearchInput);
  elements.searchInput.addEventListener("search", handleSearchInput);
  elements.notesList.addEventListener("click", handleNoteAction);
  elements.archiveList.addEventListener("click", handleNoteAction);
  elements.notesList.addEventListener("keydown", handleNoteKeydown);
  elements.archiveList.addEventListener("keydown", handleNoteKeydown);
  elements.noteModalForm.addEventListener("submit", handleModalSubmit);
  elements.noteModalForm.addEventListener("input", updateModalSaveButton);
  elements.noteModalArchiveButton.addEventListener("click", handleModalArchive);
  elements.noteModal.addEventListener("click", handleModalClick);
  document.addEventListener("keydown", handleModalKeydown);
  elements.notesNavButton.addEventListener("click", () => showView(VIEW_NOTES));
  elements.archiveNavButton.addEventListener("click", () => showView(VIEW_ARCHIVE));

  updateAddButton();
  renderNotes();
  showView(VIEW_NOTES);
}

init();
