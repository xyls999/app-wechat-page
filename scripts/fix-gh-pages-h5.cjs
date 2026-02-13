const fs = require('node:fs')
const path = require('node:path')

const h5Root = path.resolve(__dirname, '..', 'dist', 'build', 'h5')
const assetsDir = path.join(h5Root, 'assets')

if (!fs.existsSync(h5Root) || !fs.existsSync(assetsDir)) {
  console.log('[fix-gh-pages-h5] skip: h5 output not found')
  process.exit(0)
}

fs.writeFileSync(path.join(h5Root, '.nojekyll'), '')

const renamed = {}
for (const fileName of fs.readdirSync(assetsDir)) {
  if (!fileName.startsWith('_')) continue
  const nextName = fileName.replace(/^_+/, '')
  if (!nextName || nextName === fileName) continue
  fs.renameSync(path.join(assetsDir, fileName), path.join(assetsDir, nextName))
  renamed[fileName] = nextName
}

const renamedKeys = Object.keys(renamed)
if (renamedKeys.length === 0) {
  console.log('[fix-gh-pages-h5] done: .nojekyll written, no underscore assets to rename')
  process.exit(0)
}

function walk(dir, collector = []) {
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath, collector)
      continue
    }
    collector.push(fullPath)
  }
  return collector
}

const targetFiles = walk(h5Root).filter((file) => /\.(html|js|css)$/i.test(file))
for (const filePath of targetFiles) {
  let source = fs.readFileSync(filePath, 'utf8')
  let changed = false
  for (const oldName of renamedKeys) {
    if (!source.includes(oldName)) continue
    source = source.split(oldName).join(renamed[oldName])
    changed = true
  }
  if (changed) {
    fs.writeFileSync(filePath, source, 'utf8')
  }
}

console.log('[fix-gh-pages-h5] done:', renamed)
