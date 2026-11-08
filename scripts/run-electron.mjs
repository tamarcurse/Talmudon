// Launches Electron with ELECTRON_RUN_AS_NODE cleared. Some hosts (VS Code, Claude Code)
// set it, which makes Electron run as plain Node and breaks `import { app } from 'electron'`.
import { spawn } from 'node:child_process'
import electronPath from 'electron'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electronPath, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
