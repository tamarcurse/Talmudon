# Talmudon

Desktop application for local study and planning, built as an offline-first Electron shell with a React + TypeScript renderer and Tailwind-based Hebrew UI.

## Stack

- Electron for the desktop window and main process
- React + TypeScript for the renderer
- Tailwind CSS for styling and RTL layout
- Local file-based storage for future app data

## Project structure

```text
/
├── src/
│   ├── main/             # Electron main process and preload bridge
│   ├── renderer/        # React UI and Tailwind styling
│   ├── test/            # Test setup
│   ├── App.test.tsx     # Minimal app render test
│   └── App.tsx          # Compatibility re-export
├── dist/                 # Vite renderer output
├── dist-electron/        # Compiled Electron main process
├── index.html            # Renderer entry point
├── instructions.md       # Product and technical specification
├── package.json          # Scripts and dependencies
├── vite.config.ts        # Vite + Tailwind configuration
├── tsconfig.app.json     # React app TypeScript config
├── tsconfig.main.json    # Electron main process config
├── README.md             # Project summary
├── .gitignore            # Excluded generated files
└── public/               # Static assets
```

## Local development

```powershell
$env:PATH = "C:\node-v26.13.0-win-x64;$env:PATH"
npm install
npm run dev
```

Production validation:

```powershell
npm run build
npm test
```

## Requirements

- Offline first: the app opens without network dependency.
- Hebrew-first layout with proper RTL behavior.
- Desktop shell remains local and self-contained.
- Future data storage remains local to the machine.
