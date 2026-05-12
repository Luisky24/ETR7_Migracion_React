/**
 * Pipeline: lee `dist/` del build Vite (modo gas) y escribe en `gas-webapp-react/`
 * `Assets_js.html` y `Assets_css.html` como **HTML válido** para
 * `HtmlService.createHtmlOutputFromFile()` (usado por `include()` en GAS).
 *
 * Cada archivo incluye su propio `<script type="module">` o `<style>` para que
 * el parser HTML trate el bundle como datos de script/estilo (no como markup
 * suelto con literales tipo `<Route ...>` en strings).
 *
 * No dependencias npm: solo Node stdlib.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.resolve(rootDir, 'dist')
const gasDir = path.resolve(rootDir, '..', 'gas-webapp-react')

function escapeClosingStyleTag(css) {
  return css.replace(/<\/style>/gi, '<\\/style>')
}

function escapeClosingScriptTag(js) {
  return js.replace(/<\/script>/gi, '<\\/script>')
}

function resolveFromHtml(htmlDir, url) {
  if (url.startsWith('/')) {
    return path.resolve(distDir, url.slice(1))
  }
  return path.resolve(htmlDir, url)
}

async function readUtf8(filePath) {
  return fs.readFile(filePath, 'utf8')
}

async function main() {
  const indexPath = path.join(distDir, 'index.html')
  let indexHtml
  try {
    indexHtml = await readUtf8(indexPath)
  } catch {
    console.error(
      'No se encontró dist/index.html. Ejecuta antes: npm run build (modo gas) o npm run build:gas.',
    )
    process.exit(1)
  }

  const htmlDir = path.dirname(indexPath)

  const cssParts = []
  for (const m of indexHtml.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)) {
    const tag = m[0]
    const hrefMatch = tag.match(/href=["']([^"']+)["']/)
    if (!hrefMatch) {
      continue
    }
    const abs = resolveFromHtml(htmlDir, hrefMatch[1])
    cssParts.push(await readUtf8(abs))
  }

  const jsParts = []
  for (const m of indexHtml.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi)) {
    const abs = resolveFromHtml(htmlDir, m[1])
    jsParts.push(await readUtf8(abs))
  }

  if (jsParts.length === 0) {
    console.error('No se encontraron <script src="..."> en dist/index.html.')
    process.exit(1)
  }

  const cssInner = escapeClosingStyleTag(cssParts.join('\n'))
  const jsInner = escapeClosingScriptTag(jsParts.join('\n;\n'))

  const cssOut = `<style>\n${cssInner}\n</style>\n`
  const jsOut = `<script type="module">\n${jsInner}\n</script>\n`

  await fs.mkdir(gasDir, { recursive: true })
  await fs.writeFile(path.join(gasDir, 'Assets_css.html'), cssOut, 'utf8')
  await fs.writeFile(path.join(gasDir, 'Assets_js.html'), jsOut, 'utf8')

  console.log('OK: generados gas-webapp-react/Assets_css.html y Assets_js.html')
}

await main()
