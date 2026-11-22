/**
 * Windows OCR bridge. The recognition engine is the one bundled with Windows
 * (Windows.Media.Ocr), driven through Windows PowerShell 5.1 because the WinRT
 * projection is not available in PowerShell 7. All work stays on this machine.
 */
import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, 'windows-ocr.ps1')
const POWERSHELL = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')

/** A 64x64 white PNG: enough to prove the recognizer can run. */
const PROBE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAJUlEQVR42u3OMQEAAAgDoJvc6FpjDyQgdWXm5ubm5ubm5ubm5uYPJQAAAe0B9YQAAAAASUVORK5CYII=',
  'base64',
)

let probePromise

const MISS_TTL_MS = 5 * 60_000

function runtimeFor() {
  if (!existsSync(SCRIPT)) return { available: false, reason: `OCR 脚本缺失：${SCRIPT}` }
  if (!existsSync(POWERSHELL)) return { available: false, reason: '未找到 Windows PowerShell 5.1' }
  return { available: true }
}

function runPowerShell(args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(POWERSHELL, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1_000_000 }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
    })
  })
}

/** Probe, cached for the plugin lifetime; a failure is retried after 5 minutes. */
export function ocrAvailable() {
  if (probePromise !== undefined) {
    return probePromise.then((value) => {
      if (value.available === true) return value
      if (Date.now() - (value.checkedAt ?? 0) < MISS_TTL_MS) return value
      probePromise = undefined
      return ocrAvailable()
    })
  }
  probePromise = (async () => {
    const runtime = runtimeFor()
    if (!runtime.available) return { ...runtime, checkedAt: Date.now() }
    let dir
    try {
      dir = mkdtempSync(join(tmpdir(), 'tw-ocr-probe-'))
      const image = join(dir, 'probe.png')
      const out = join(dir, 'probe.txt')
      writeFileSync(image, PROBE_PNG)
      const result = await runPowerShell(['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-ImagePath', image, '-OutPath', out], 30_000)
      if (result.error !== null) {
        return { available: false, reason: result.stderr.trim() || result.error.message, checkedAt: Date.now() }
      }
      let languageTag = ''
      try { languageTag = readFileSync(`${out}.lang`, 'utf8').trim() } catch { languageTag = '' }
      return { available: true, languages: ['zh-Hans-CN', 'en-US'], languageTag, checkedAt: Date.now() }
    } catch (error) {
      return { available: false, reason: String(error?.message ?? error), checkedAt: Date.now() }
    } finally {
      if (dir !== undefined) {
        try { rmSync(dir, { recursive: true, force: true }) } catch { /* best effort */ }
      }
    }
  })()
  return probePromise
}

/**
 * Recognize one image file. Returns the text plus the language tag of the
 * recognizer that actually ran (a missing language pack falls back silently
 * inside Windows, so callers must be able to see this).
 */
export async function ocrImage(imagePath, { language = 'zh-Hans-CN', timeoutMs = 90_000 } = {}) {
  const runtime = runtimeFor()
  if (!runtime.available) throw new Error(runtime.reason)
  const dir = mkdtempSync(join(tmpdir(), 'tw-ocr-'))
  const out = join(dir, 'out.txt')
  try {
    const result = await runPowerShell([
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', SCRIPT,
      '-ImagePath', imagePath,
      '-OutPath', out,
      '-Language', language,
    ], timeoutMs)
    if (result.error !== null) {
      throw new Error(result.stderr.trim() || result.error.message)
    }
    if (!existsSync(out)) throw new Error('OCR 没有生成结果')
    let languageTag = ''
    try { languageTag = readFileSync(`${out}.lang`, 'utf8').trim() } catch { languageTag = '' }
    return { text: readFileSync(out, 'utf8').replace(/^\ufeff/, ''), languageTag, requested: language }
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* PowerShell may still hold the file */ }
  }
}
