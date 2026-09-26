# Castle Battle Rally Planner

An interactive, fully client-side planning tool for *Whiteout Survival* Castle Battles / SvS.
Arrange 2×2 rally-lead city positions around a central castle — automatically by priority or
manually via drag-and-drop — then export, print, or share the layout.

## Features

- **Auto-placement** — greedy algorithm places rally leads closest-to-castle first, ordered by priority.
- **Manual editing** — drag-and-drop to reposition, drop onto another city to swap, or click-to-move.
- **Locking** — pin a lead's position so auto-placement won't move it.
- **Grid config** — adjustable grid size, castle size/position, and 2×2 / 1×1 snapping.
- **Roster management** — add leads individually or via bulk paste, with search/filter and inline edit.
- **Pet rotation tracking** — assign UTC time slots and view coverage per slot.
- **Presets & templates** — quick-start demo rosters plus save/load/backup of custom layouts.
- **Export & share** — CSV, high-res PNG, print/PDF, and a shareable URL that encodes the full layout.

All data is stored locally in your browser (`localStorage`); there is no backend.

## Tech stack

React 19, TypeScript, Vite 6, Tailwind CSS v4, `lucide-react`, `motion`.

## Run locally

**Prerequisites:** Node.js (LTS)

```bash
npm install
npm run dev
```

Then open the printed local URL (default http://localhost:3000).

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — type-check with `tsc --noEmit`
