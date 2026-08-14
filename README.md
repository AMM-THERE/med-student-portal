# MedPortal — Medical College Student Hub

A full-featured single-page web app for medical college students. Three pillars: **Lectures (Study Hub)**, **Community & Chat**, and **Quiz & Question Bank**. Pure frontend, runs offline, persists in localStorage.

## Quick start

1. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
   - Either double-click the file, or right-click → Open with…
   - No build step, no install, no server required.
2. On first open, register with a name, username, academic email, ID, and year.
   - Emails listed in `js/config.js → ADMIN_EMAILS` automatically become admins.
3. Use the top-right cog to change theme, font scale, default-anonymous, and account details.

> If your browser blocks `file://` resources, either:
> - serve the folder with `python -m http.server 8000` and visit `http://localhost:8000`, or
> - right-click `index.html` → Properties → Unblock (Windows), or
> - use VS Code “Live Server”.

## Default admin emails

Open `js/config.js` and edit the `ADMIN_EMAILS` array. The check is case-insensitive. To create your first admin, register with one of these emails, or simply add your own email to the list before registering.

```js
const ADMIN_EMAILS = [
  'admin@medcollege.edu',
  'superadmin@medcollege.edu'
];
```

## Features

### Lectures (Study Hub)
- Filter by year, subject, free-text search.
- Lecture cards show title, description, year, subject, Drive links, and the author.
- Drive link parser handles `/file/d/{ID}/view`, `?id={ID}`, and `/uc?id={ID}`.
- Admins see a floating `+` to post a new lecture with multiple Drive links.

### Community (Chat)
- Text + image attachments (≤ 2MB), instant delivery, 3-second polling for simulated real-time.
- Year badge next to every name (e.g. `[1]`, `[2]`, `[I]` for Intern).
- Per-message **Anonymous** toggle; default pulled from Settings → Privacy.
- Admins can see the real author on anonymous posts (`(real)` marker + identity shown when expanding).

### Quiz
- Admin uploads `.csv`, `.xls`, or `.xlsx`. Expected columns:
  `Question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation`.
- `CorrectAnswer` accepts `A`/`B`/`C`/`D`, `1`–`4`, or matching option text.
- Live preview table; on import, quiz is saved.
- Runner shows a per-question **timer** (configurable, default 60s), **question counter**, **instant grading**, **explanations**, and a final **review screen** with score and per-question correctness.

### Settings
- **Account**: edit name, username, academic ID, and year.
- **Privacy**: toggle default-anonymous.
- **Appearance**: dark/light mode, font scale slider (85%–125%), local-storage usage, and “Clear chat images” / “Reset everything” controls.

## File layout

```
med-student-portal/
├── index.html                # SPA shell (CDN: Tailwind, SheetJS, Inter font)
├── README.md
├── assets/
│   └── favicon.svg
├── css/
│   └── styles.css            # Custom animations, scrollbar, focus rings
└── js/
    ├── config.js             # Constants: admin emails, years, storage keys
    ├── storage.js            # localStorage wrapper
    ├── state.js              # In-memory pub/sub store
    ├── utils.js              # uid, formatDate, file→base64, CSV parser, Drive parser
    ├── ui.js                 # Toasts, year badges, avatars, inline SVGs
    ├── modals.js             # Generic Modal class
    ├── auth.js               # Registration modal & session
    ├── navigation.js         # Top bar, 3 tabs, FAB
    ├── lectures.js           # Study Hub
    ├── chat.js               # Community & anonymous mode
    ├── quiz.js               # Quiz runner + CSV/Excel import
    ├── settings.js           # Settings modal
    └── app.js                # Bootstraps on DOMContentLoaded
```

## Tech

- **Tailwind CSS** via CDN (no build step)
- **SheetJS (xlsx)** via CDN for `.xlsx` parsing
- **Vanilla JavaScript** — no framework, no bundler
- **localStorage** for persistence
- All UI primitives are inline; no icon library

## Privacy & data

All data stays on this device. There is **no server** and **no telemetry**. To wipe everything, open Settings → Appearance → “Reset everything” (or clear the browser’s storage for the site).

## Browser support

Modern browsers with ES2018+ support (Chrome/Edge 88+, Firefox 78+, Safari 14+). Image uploads use `FileReader`, file imports use `File.arrayBuffer()`.

## License

MIT — do what you want, no warranty.
