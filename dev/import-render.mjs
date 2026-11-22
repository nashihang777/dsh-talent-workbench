/**
 * Renders the resume-import dialog with a stub React and asserts the review
 * surface: five editable fields, per-item states, the skipped-file list, and
 * the select-all toggle state.
 *
 * Run: node dev/import-render.mjs
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'

const dir = mkdtempSync(join(tmpdir(), 'tw-import-render-'))
const { db, instance } = loadStore(dir)
const wb = new TalentWorkbench({ dataDir: dir, db, instance, config: {}, onSkillsChanged: () => {} })
// 1.7: a recruiting task is the only way in; create one before importing.
wb.createTask({ name: '自检任务', templateId: Object.keys(db.templates)[0] })
const state = wb.snapshot()

const seeds = new Map()
let currentName = ''
const React = {
  createElement: (...args) => ({ type: args[0], props: args[1] ?? {}, children: args.slice(2) }),
  useState(initial) {
    // Only the components under test consume seeded values; every other
    // component renders with its defaults so hook order cannot drift.
    const queue = seeds.get(currentName)
    if (queue !== undefined && queue.length > 0) return [queue.shift(), () => {}]
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
  useEffect() {},
  useMemo(fn) { return fn() },
  useRef() { return { current: null } },
}
globalThis.window = { __ModuleLoader__: { load(definition) { globalThis.__captured = definition } } }
globalThis.document = {
  createElement: () => ({ click() {}, remove() {}, style: {} }),
  body: { appendChild() {} },
  addEventListener() {}, removeEventListener() {}, activeElement: null,
}
globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} }
globalThis.Blob = class {}
globalThis.FileReader = class {}
await import('../client.js')
const module = globalThis.__captured.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require ${name}`)
})

const t = (key) => key
let Workbench = null
module.apply({
  locale: { bind: () => t, register: () => () => {} },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { openTab() {} },
  slots: {
    inject: (key, callback) => { callback(); return () => {} },
    register: (options, component) => { if (options.name === 'main') Workbench = component; return () => {} },
  },
  effect: (fn) => fn(),
})
if (typeof Workbench !== 'function') throw new Error('panel component not registered')

const fakeScan = {
  ok: true,
  scanId: 'scan-test',
  items: [
    { key: 'item-1', name: 'a.docx', ok: true, engine: 'docx-ooxml', chars: 900, needsReview: false, duplicateOf: '', lowQuality: false, warnings: [], preview: '示例', suggestion: { alias: '甲', major: '材料', degree: '博士', school: '示例大学', direction: '稀土' }, pages: [] },
    { key: 'item-2', name: 'b.png', ok: true, engine: 'image-ocr', chars: 600, needsReview: true, duplicateOf: '', lowQuality: false, warnings: ['OCR 结果可能有错字，请核对'], preview: '示例', suggestion: { alias: '乙' }, pages: ['/tmp/p1.png'] },
    { key: 'item-3', name: 'c.pdf', ok: true, engine: 'pdf-text', chars: 800, needsReview: false, duplicateOf: 'a.docx', lowQuality: false, warnings: [], preview: '示例', suggestion: { alias: '甲' }, pages: [] },
    { key: 'item-4', name: 'd.exe', ok: false, error: '不支持的格式' },
  ],
  skipped: [{ name: 'e.zip', reason: '不支持的格式' }],
  summary: { total: 4, ready: 3, failed: 1, ocr: 1, duplicate: 1, skipped: 1 },
}
const fakeJob = {
  jobId: 'job-test',
  scanId: 'scan-test',
  status: 'done',
  phase: 'done',
  total: 4,
  extracted: 4,
  agentTotal: 4,
  agentDone: 4,
  startedAt: Date.now() - 5000,
  finishedAt: Date.now(),
  error: null,
  cancelRequested: false,
  agent: { available: true, provider: 'fake', model: 'fake', used: 3, errors: [] },
  skipped: fakeScan.skipped,
  summary: { ...fakeScan.summary, multiCandidate: 0, agentParsed: 3 },
  items: fakeScan.items,
}
const fakeRows = [
  { key: 'item-1', jobId: 'job-test', ok: true, selected: true, alias: '甲', major: '材料', degree: '博士', school: '示例大学', direction: '稀土' },
  { key: 'item-2', jobId: 'job-test', ok: true, selected: true, alias: '乙', major: '', degree: '', school: '', direction: '' },
  { key: 'item-3', jobId: 'job-test', ok: true, selected: false, alias: '甲', major: '材料', degree: '博士', school: '示例大学', direction: '稀土' },
  { key: 'item-4', jobId: 'job-test', ok: false, selected: false, alias: '', major: '', degree: '', school: '', direction: '' },
]

const collected = { texts: [], props: [] }
const textSink = []
const propSink = []

const walk = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return
  if (typeof node === 'string') { textSink.push(node); return }
  if (Array.isArray(node)) { node.forEach(walk); return }
  if (typeof node !== 'object') return
  if (typeof node.type === 'function') {
    const previous = currentName
    currentName = node.type.name || 'anonymous'
    walk(node.type({ ...node.props, children: node.children.length === 1 ? node.children[0] : node.children, t: (key) => key }))
    currentName = previous
    return
  }
  if (typeof node.type === 'string') propSink.push({ tag: node.type, props: node.props })
  walk(node.children)
}

function renderImport(seedJob, seedRows, open = seedJob !== null) {
  seeds.clear()
  // Workbench hooks in order: state, loading, error, tab, notice, busy,
  // selectedCandidateId, query, then the modal slots; importOpen + job + rows.
  seeds.set('Workbench', [state, false, '', 'screening', null, '', state.results[0]?.candidateId ?? '', '', null, null, '', null, null, null, null, open, false, seedJob, seedRows, []])
  // ImportModal's own hooks: busy, phase, reading, pathText, recursive.
  seeds.set('ImportModal', [false, '', false, '', true])
  textSink.length = 0
  propSink.length = 0
  currentName = 'Workbench'
  const tree = Workbench({ t: (key) => key })
  currentName = ''
  walk(tree)
  return { texts: textSink.slice(), props: propSink.slice() }
}

let failures = 0
const check = (label, condition, detail = '') => {
  if (condition) console.log(`ok   ${label}`)
  else { failures += 1; console.log(`FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`) }
}

const review = renderImport(fakeJob, fakeRows)
const placeholders = review.props.filter(entry => entry.tag === 'input').map(entry => entry.props.placeholder)
for (const key of ['import.alias', 'import.major', 'import.degree', 'import.school', 'import.direction']) {
  check(`review shows ${key}`, placeholders.includes(key), placeholders.join(','))
}
check('skipped list rendered', review.texts.some(text => String(text).startsWith('import.skipped')))
check('duplicate row is disabled', review.props.some(entry => entry.tag === 'input' && entry.props.disabled === true && entry.props.type === 'checkbox'))
check('needs-review badge', review.texts.includes('图片 · OCR'))
check('page image path shown', review.texts.some(text => typeof text === 'string' && text.includes('/tmp/p1.png')))
check('failed row explains why', review.texts.includes('不支持的格式'))
check('select-all exposes aria-pressed', review.props.some(entry => entry.tag === 'button' && 'aria-pressed' in (entry.props ?? {})))
check('commit button counts selection', review.texts.some(text => typeof text === 'string' && text.startsWith('import.commit')))
check('skipped files are listed', review.texts.some(text => typeof text === 'string' && text.includes('e.zip')))

const picker = renderImport(null, [], true)
check('picker states limits', picker.texts.includes('import.limits'))
check('picker offers files and folder', picker.texts.includes('import.pickFiles') && picker.texts.includes('import.pickFolder'))
check('path input has an aria label', picker.props.some(entry => entry.tag === 'input' && entry.props['aria-label'] === 'import.pathTitle'))
check('file inputs are labelled by the row', picker.props.filter(entry => entry.tag === 'input' && entry.props.type === 'file').length === 2)

// The background job surface: a running job shows progress and keeps the
// review disabled; a closed dialog leaves the banner in the page header.
const runningJob = { ...fakeJob, status: 'running', phase: 'agent', agentTotal: 4, agentDone: 2, items: fakeScan.items.slice(0, 2) }
const runView = renderImport(runningJob, [])
check('running job shows agent progress', runView.texts.some(text => typeof text === 'string' && text.startsWith('import.phaseAgent')), runView.texts.slice(0, 40).join('|'))
check('running job is not importable yet', !runView.texts.some(text => typeof text === 'string' && text.startsWith('import.commit')))
check('running job explains the background', runView.texts.includes('import.backgroundHint'))
const bannerView = renderImport(null, [], false)
check('no job means no banner', !bannerView.texts.some(text => typeof text === 'string' && text.startsWith('import.jobDone')))

console.log(failures === 0 ? '\nimport render: all checks passed' : `\nimport render: ${failures} check(s) failed`)
process.exitCode = failures === 0 ? 0 : 1
rmSync(dir, { recursive: true, force: true })
