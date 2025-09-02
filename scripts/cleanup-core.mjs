import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function removeIfSame(src, dest) {
  try {
    const [a, b] = await Promise.all([
      fs.readFile(src),
      fs.readFile(dest),
    ])
    const same = a.length === b.length && a.equals(b)
    if (same) {
      await fs.unlink(dest)
      console.log(`Removed ${dest}`)
    } else {
      console.warn(`Skip remove (differs from root): ${dest}`)
    }
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      // either src or dest missing; nothing to do
      return
    }
    throw err
  }
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..')
  const coreDir = path.join(repoRoot, 'core')

  const readmeSrc = path.join(repoRoot, 'README.md')
  const readmeDest = path.join(coreDir, 'README.md')
  const licenseSrc = path.join(repoRoot, 'LICENSE')
  const licenseDest = path.join(coreDir, 'LICENSE')

  await removeIfSame(readmeSrc, readmeDest)
  await removeIfSame(licenseSrc, licenseDest)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

