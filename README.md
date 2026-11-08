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

## בניית קובץ התקנה

הבנייה עובדת ללא גישה ל-GitHub. בפעם הראשונה יש להוריד ידנית (ממחשב עם גישה) את הקבצים הבאים
ולשים אותם בתיקייה `downloads/electron-builder-binaries/` (עם אותה מבנה תיקיות):

- `nsis-3.0.4.1/nsis-3.0.4.1.7z`
- `nsis-resources-3.4.1/nsis-resources-3.4.1.7z`
- `winCodeSign-2.6.0/winCodeSign-2.6.0.7z`
- `icons@1.2.3/icons-bundle.tar.gz`
- `7zip@1.0.0/7zip-win-x64.tar.gz`

כתובת ההורדה: `https://github.com/electron-userland/electron-builder-binaries/releases/download/<תיקייה>/<קובץ>`

לאחר מכן מריצים `build-installer.cmd` (או `npm run dist:win`). התוצאה: `release/Talmudon-Setup-<גרסה>.exe`.
ההתקנה עצמה לא דורשת אינטרנט, והנתונים נשמרים ב-`%APPDATA%\Talmudon`.

## Requirements

- Offline first: the app opens without network dependency.
- Hebrew-first layout with proper RTL behavior.
- Desktop shell remains local and self-contained.
- Future data storage remains local to the machine.
