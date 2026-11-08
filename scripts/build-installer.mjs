// Builds a Windows NSIS installer offline. GitHub is unreachable on the build machine, so
// electron-builder's helper tools are served from downloads/electron-builder-binaries/ through
// a local HTTP mirror (ELECTRON_BUILDER_BINARIES_MIRROR).
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, createReadStream, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, Platform } from 'electron-builder'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mirrorDir = join(root, 'downloads', 'electron-builder-binaries')
const GH = 'https://github.com/electron-userland/electron-builder-binaries/releases/download/'
const requiredFiles = [
  'nsis-3.0.4.1/nsis-3.0.4.1.7z',
  'nsis-resources-3.4.1/nsis-resources-3.4.1.7z',
  'winCodeSign-2.6.0/winCodeSign-2.6.0.7z',
  'icons@1.2.3/icons-bundle.tar.gz',
  '7zip@1.0.0/7zip-win-x64.tar.gz',
]

if (process.platform !== 'win32') {
  console.error('This script builds a Windows installer and must run on Windows.')
  process.exit(1)
}

// electron-builder's cache may already hold the tools; only insist on files when they are missing.
const missing = requiredFiles.filter((f) => !existsSync(join(mirrorDir, f)))
if (missing.length > 0) {
  console.warn(`Missing in ${mirrorDir} (needed on the first build only):`)
  for (const f of missing) console.warn(`  ${f}\n    download: ${GH}${f}`)
}

const npm = spawnSync('npm run build', { cwd: root, stdio: 'inherit', shell: true })
if (npm.status !== 0) process.exit(npm.status ?? 1)

const server = createServer((req, res) => {
  const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
  const file = resolve(mirrorDir, rel)
  if (!file.startsWith(mirrorDir) || !existsSync(file)) {
    console.warn(`[mirror] missing: ${rel}\n         download: ${GH}${rel}`)
    res.writeHead(404).end()
    return
  }
  res.writeHead(200)
  createReadStream(file).pipe(res)
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const { port } = server.address()

process.env.ELECTRON_BUILDER_BINARIES_MIRROR = `http://127.0.0.1:${port}/`
delete process.env.ELECTRON_RUN_AS_NODE

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
try {
  await build({
    projectDir: root,
    targets: Platform.WINDOWS.createTarget(),
    config: join(root, 'electron-builder.yml'),
    publish: 'never',
  })
  console.log(`\nInstaller: ${join(root, 'release', `Talmudon-Setup-${version}.exe`)}`)
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  server.close()
}
