/**
 * Local PDF helpers. Poppler's `pdftotext` / `pdftoppm` are used when they can
 * be found (for example in a TeX Live or MiKTeX installation); nothing is
 * downloaded and no network access happens here.
 */
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** Run a program with bytes on stdin and collect stdout text. */
function runWithInput(executable, args, buffer, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true })
    const chunks = []
    const errors = []
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try { child.kill() } catch { /* ignore */ }
      reject(new Error(`pdftotext 超时（${Math.round(timeoutMs / 1000)} s）`))
    }, timeoutMs)
    child.stdout.on('data', chunk => chunks.push(chunk))
    child.stderr.on('data', chunk => errors.push(chunk))
    child.on('error', (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'))
      else reject(new Error(Buffer.concat(errors).toString('utf8').trim() || `pdftotext 退出码 ${code}`))
    })
    child.stdin.on('error', () => { /* the process may close stdin early */ })
    child.stdin.end(buffer)
  })
}

const CANDIDATE_DIRS = [
  'D:\\texlive\\2024\\bin\\windows',
  'C:\\texlive\\2024\\bin\\windows',
  'C:\\texlive\\2025\\bin\\windows',
  'D:\\texlive\\2025\\bin\\windows',
  'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64',
  'C:\\Program Files\\poppler\\Library\\bin',
  'C:\\Program Files\\poppler\\bin',
]

function searchPath(executable) {
  const pathValue = process.env.PATH ?? ''
  for (const dir of pathValue.split(';')) {
    if (dir.trim() === '') continue
    const candidate = join(dir.trim(), executable)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

function searchDirs(executable) {
  for (const dir of CANDIDATE_DIRS) {
    const candidate = join(dir, executable)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

const toolCache = new Map()
const MISS_TTL_MS = 5 * 60_000

export function pdfTool(name, configuredPath) {
  const cached = toolCache.get(name)
  // A hit stays valid; a miss is re-checked after a few minutes so installing
  // poppler mid-session does not require a restart.
  if (cached !== undefined && (cached.path !== undefined || Date.now() - cached.at < MISS_TTL_MS)) {
    return cached.path
  }
  let resolved
  if (typeof configuredPath === 'string' && configuredPath.trim() !== '' && existsSync(configuredPath.trim())) {
    resolved = configuredPath.trim()
  } else {
    resolved = searchPath(`${name}.exe`) ?? searchDirs(`${name}.exe`) ?? searchPath(name) ?? searchDirs(name)
  }
  toolCache.set(name, { path: resolved, at: Date.now() })
  return resolved
}

export function pdfTools(configured = {}) {
  return {
    pdftotext: pdfTool('pdftotext', configured.pdftotextPath),
    pdftoppm: pdfTool('pdftoppm', configured.pdftoppmPath),
  }
}

/**
 * Extract the text layer through stdin/stdout so no temporary file is created.
 */
export async function pdfText(buffer, { configured, timeoutMs = 60_000 } = {}) {
  const tool = pdfTools(configured).pdftotext
  if (tool === undefined) return { ok: false, reason: 'missing-pdftotext' }
  const stdout = await runWithInput(tool, ['-enc', 'UTF-8', '-layout', '-', '-'], buffer, timeoutMs)
  return { ok: true, text: stdout }
}

/**
 * Rasterize the first pages of a PDF to PNG files inside `outputDir`.
 *
 * Sizing is by longest edge (`scaleTo`), not by DPI: scanned resumes can declare
 * page sizes of 5700x4000 points, where a fixed DPI produces a 40 MB image and
 * takes a minute. A 2400 px long edge is enough for OCR and stays fast.
 * Returns file paths in page order; the caller owns and deletes them.
 */
export async function pdfPageImages(buffer, outputDir, { configured, scaleTo = 2400, maxPages = 6, timeoutMs = 120_000 } = {}) {
  const tool = pdfTools(configured).pdftoppm
  if (tool === undefined) return { ok: false, reason: 'missing-pdftoppm' }
  mkdirSync(outputDir, { recursive: true })
  const source = join(outputDir, 'source.pdf')
  writeFileSync(source, buffer)
  const prefix = join(outputDir, 'page')
  await run(tool, ['-scale-to', String(scaleTo), '-png', '-f', '1', '-l', String(maxPages), source, prefix], {
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  })
  const files = readdirSync(outputDir)
    .filter(name => /^page-\d+\.png$/i.test(name) || /^page\d+\.png$/i.test(name))
    .sort((a, b) => {
      const left = Number((a.match(/\d+/) ?? ['0'])[0])
      const right = Number((b.match(/\d+/) ?? ['0'])[0])
      return left - right
    })
    .map(name => join(outputDir, name))
  return { ok: true, files, source: basename(source) }
}
