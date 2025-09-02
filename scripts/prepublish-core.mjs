import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function copyFileIfExists(src, dest) {
  try {
    await fs.copyFile(src, dest)
    console.log(`Copied ${src} -> ${dest}`)
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.warn(`Skip copy, not found: ${src}`)
      return
    }
    throw err
  }
}

async function main() {
  // repoRoot/scripts/prepublish-core.mjs -> repoRoot
  const repoRoot = path.resolve(__dirname, '..')
  const coreDir = path.join(repoRoot, 'core')

  // Ensure we are run from core or workspace publish
  console.log('Preparing package files for publish...')

  const readmeSrc = path.join(repoRoot, 'README.md')
  const readmeDest = path.join(coreDir, 'README.md')
  const licenseSrc = path.join(repoRoot, 'LICENSE')
  const licenseDest = path.join(coreDir, 'LICENSE')

  await copyFileIfExists(readmeSrc, readmeDest)
  await copyFileIfExists(licenseSrc, licenseDest)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

