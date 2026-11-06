# Google Keep

A browser-only notes app modeled on Google Keep. You can add notes, search them, edit them, and move them between Notes and Archive. Nothing is sent to a server. Notes stay in this browser under the `localStorage` key `keep-notes`.

## Requirements

- A current desktop browser (Chrome, Edge, Firefox, or Safari)
- A local web server

The app is plain HTML, CSS, and JavaScript. There is no install step and no build step.

`js/app.js` is loaded as an ES module. Opening `index.html` directly with a `file://` address often blocks that script, so serve the folder over `http://localhost` instead.

## Run the app

From this folder, start any static server, then open the address it prints (usually `http://localhost:8000`).

**Python**

```bash
python -m http.server 8000
```

**Node.js**

```bash
npx serve
```

You can also use the Live Server extension in VS Code or Cursor: right-click `index.html` and choose **Open with Live Server**.

## How to use it

- Type a title, a note, or both, then choose **Add note**. The button stays disabled until one of those fields has text.
- Press **Ctrl+Enter** (or **Cmd+Enter** on macOS) in the composer or the editor to save.
- Search matches the title and the body of both active and archived notes. Clearing the search box shows the full list again.
- Click a note card, or focus it and press **Enter** or **Space**, to edit it.
- **Archive** moves a note out of the main list. **Unarchive** brings it back. The sidebar switches between the two views.
- In the editor, **Escape** or **Cancel** closes without saving. **Tab** stays inside the dialog.

## Project layout

| Path | Role |
| --- | --- |
| `index.html` | Page structure, composer, lists, editor dialog, and the note-card template |
| `css/styles.css` | Layout and visual styles |
| `js/app.js` | Creating, editing, searching, archiving, and saving notes |
| `assets/` | Favicon and search icon |

## Notes and storage

Each note is an object with `id`, `title`, `content`, `archived`, and `createdAt`. Newest notes appear first. A note must have a title or body; both cannot be blank. Duplicate ids and records that do not match that shape are dropped when the page loads.

Data is per browser and per origin. A different browser, a private window, or a different host (for example `localhost` versus `127.0.0.1`) will not see the same notes. Clearing site data for this origin deletes them. If the browser refuses to write `localStorage`, the current notes stay on screen for that visit only.
