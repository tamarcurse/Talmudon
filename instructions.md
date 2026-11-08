# Talmudon Project Instructions

## Tech Stack

- Electron for the desktop shell and offline-first application environment.
- Node.js + TypeScript for the main process and local SQLite/IPC integration.
- React + TypeScript for the frontend UI.
- Tailwind CSS for layout, theming, and RTL support.
- Node.js runtime: use the local installation from `C:\node-v26.13.0-win-x64` when running project commands.

# 01: Project Bootstrap, Tech Instructions & Initial Run (Electron)

## What to build

Create the initial development environment and project foundation for an Electron + React + TypeScript + Tailwind desktop application. This ticket includes writing a technical instruction file, defining the project structure, and ensuring the app can run successfully in a desktop window from VS Code in offline mode.

## Acceptance criteria

- [ ] A project technical file exists at `instructions.md` that describes the stack, architecture, and folder layout.
- [ ] The app is configured as Electron with a TypeScript main process and a React + TypeScript + Tailwind renderer.
- [ ] The app runs successfully from VS Code with `npm start` or `npm run dev` and opens a desktop window in offline mode.

## Stack and architecture

- Electron: desktop window and main process
- React + TypeScript: renderer interface and screen management
- Tailwind CSS: design system, spacing, and RTL layout
- SQLite: planned for local persistence
- Offline-first runtime: only local data and local storage

## Folder structure

```text
/
├── src/
│   ├── main/             # Electron main process and preload
│   ├── renderer/        # React + TypeScript UI screens
│   └── test/            # Test setup files
├── index.html            # Vite app entry point
├── instructions.md       # Technical guidance and project spec
├── package.json          # Scripts and dependencies
├── tsconfig.app.json     # App TypeScript config
├── tsconfig.main.json    # Electron main process config
├── vite.config.ts        # Vite + Tailwind configuration
├── README.md             # Project overview
├── .gitignore            # Generated-file exclusions
└── dist/ / dist-electron # Build output folders
```

## Development flow

```powershell
$env:PATH = "C:\node-v26.13.0-win-x64;$env:PATH"
npm install
npm run dev
```

## UI principles

- RTL-first Hebrew layout
- Fixed side navigation
- Central planning board
- Separate wizard flow for creating plans
- Hierarchical document tracking down to the Rashi and Tosafot level

## Notes

The project is designed to remain local, fast, and self-contained. The renderer is intentionally simple at this stage and will grow into the full study workspace in later tickets.
