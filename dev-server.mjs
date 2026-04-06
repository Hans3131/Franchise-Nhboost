import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const nodeBin = process.execPath

const env = {
  ...process.env,
  PATH: `/opt/homebrew/Cellar/node@20/20.20.1/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
  NODE: nodeBin,
  TURBOPACK_NODE_PATH: nodeBin,
}

const next = resolve(__dirname, 'node_modules/.bin/next')
const child = spawn(process.execPath, [next, 'start'], {
  env,
  stdio: 'inherit',
  cwd: __dirname,
})

child.on('exit', (code) => process.exit(code ?? 0))
