import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'
import { DEMO_CANDIDATES } from '../lib/seed.js'

const dir = mkdtempSync(join(tmpdir(), 'tw-render-'))
const { db, instance } = loadStore(dir)
// The database no longer carries sample rows, so seed them for this fixture to
// exercise the "candidate selected" screens.
const now = new Date().toISOString()
for (const candidate of DEMO_CANDIDATES) {
  db.candidates[candidate.id] = {
    ...candidate,
    createdAt: now,
    updatedAt: now,
    source: 'manual',
    assessments: {},
    tags: [],
    decisionOverride: null,
  }
}
const wb = new TalentWorkbench({ dataDir: dir, db, instance, config: { allowRealNames: false }, onSkillsChanged: () => {} })
// Two extra tasks make sure the header renders the picker, not just a label;
// the fixture then switches back to the task that holds the seeded candidates.
const seededTaskId = wb.snapshot().activeTaskId
wb.createTask({ name: '渲染任务甲', templateId: Object.keys(db.templates)[0] })
wb.createTask({ name: '渲染任务乙', templateId: Object.keys(db.templates)[0] })
wb.setActiveContext({ taskId: seededTaskId })
const state = wb.snapshot()
if ((state.tasks ?? []).length < 2) throw new Error('fixture needs at least two tasks')

let queue = []
const React = {
  createElement: (...args) => ({ type: args[0], props: args[1] ?? {}, children: args.slice(2) }),
  useState(initial) {
    if (queue.length > 0) return [queue.shift(), () => {}]
    return [typeof initial === 'function' ? initial() : initial, () => {}]
  },
  useEffect() {},
  useMemo(fn) { return fn() },
  useRef() { return { current: null } },
}
globalThis.window = { __ModuleLoader__: { load(definition) { globalThis.__captured = definition } } }
globalThis.document = { createElement: () => ({ click() {}, remove() {}, style: {} }), body: { appendChild() {} }, addEventListener() {}, removeEventListener() {}, activeElement: null }
globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} }
globalThis.Blob = class {}
globalThis.FileReader = class {}
await import('../client.js')
const module = globalThis.__captured.factory((name) => {
  if (name === 'react') return React
  throw new Error(`unexpected require ${name}`)
})

const t = (key) => key
const errors = []

function walk(node, path, depth) {
  if (depth > 60) return 0
  if (node === null || node === undefined || typeof node === 'boolean') return 0
  if (typeof node === 'string' || typeof node === 'number') return 1
  if (Array.isArray(node)) return node.reduce((sum, item, index) => sum + walk(item, `${path}[${index}]`, depth + 1), 0)
  if (typeof node !== 'object') return 1
  let total = 1
  if (typeof node.type === 'function') {
    let rendered
    try {
      rendered = node.type({ ...node.props, children: node.children.length === 1 ? node.children[0] : node.children, t })
    } catch (error) {
      errors.push(`${path} <${node.type.name || 'anonymous'}>: ${error.message}`)
      return total
    }
    total += walk(rendered, `${path}.${node.type.name || 'child'}`, depth + 1)
    return total
  }
  total += walk(node.children, path, depth + 1)
  return total
}

let Workbench = null
const fakeCtx = {
  locale: { bind: () => t, register: () => () => {} },
  sidebarRightTabs: { register: () => () => {} },
  sidebarRight: { openTab() {} },
  slots: {
    inject: (key, callback) => { callback(); return () => {} },
    register: (options, component) => { if (options.name === 'main') Workbench = component; return () => {} },
  },
  effect: (fn) => fn(),
}
module.apply(fakeCtx)
if (typeof Workbench !== 'function') throw new Error('panel component not registered')

const candidateId = state.results[0].candidateId
// An empty real pool is what a fresh profile looks like: the panel must render
// the built-in samples instead of an empty state.
const emptyState = { ...state, candidates: [], results: [], stats: { ...state.stats, candidates: 0, recommended: 0, avgScore: 0 } }
const cases = [
  ['loading', [null, true, '', 'overview']],
  ['error', [null, false, 'boom', 'overview']],
  ['overview', [state, false, '', 'overview']],
  ['screening', [state, false, '', 'screening']],
  ['templates', [state, false, '', 'templates']],
  ['templates+draft', [state, false, '', 'templates', null, '', candidateId, '', null, null, '', { templateId: state.activeTemplateId, isNew: false, definition: JSON.parse(JSON.stringify(state.templates[0].current)), note: 'x' }]],
  ['skills', [state, false, '', 'skills']],
  ['exchange', [state, false, '', 'exchange']],
  ['data', [state, false, '', 'data']],
  ['candidateModal', [state, false, '', 'screening', null, '', candidateId, '', { mode: 'edit', candidate: state.candidates[0] }, null, '']],
  ['deleteCandidateModal', [state, false, '', 'screening', null, '', candidateId, '', null, null, candidateId]],
  ['guardModal', [state, false, '', 'templates', null, '', candidateId, '', null, null, '', { templateId: state.activeTemplateId, isNew: false, definition: JSON.parse(JSON.stringify(state.templates[0].current)), note: '' }, { action: () => {} }]],
  ['importModal', [state, false, '', 'screening', null, '', candidateId, '', null, null, '', null, null, null, null, true]],
  ['demoPreview', [emptyState, false, '', 'screening', null, '', '', '', null, null, '']],
  ['demoOverview', [emptyState, false, '', 'overview', null, '', '', '', null, null, '']],
]
const textSink = []
const collect = (node) => {
  if (node === null || node === undefined) return
  if (typeof node === 'string') { textSink.push(node); return }
  if (Array.isArray(node)) { node.forEach(collect); return }
  if (typeof node !== 'object') return
  if (typeof node.type === 'function') {
    try { collect(node.type({ ...node.props, children: node.children.length === 1 ? node.children[0] : node.children, t })) } catch { /* recorded by walk */ }
    return
  }
  collect(node.children)
}

for (const [name, values] of cases) {
  queue = [...values]
  const nodes = walk(Workbench({ t }), name, 0)
  console.log(`${name}: nodes=${nodes}`)
  if (name === 'overview') {
    textSink.length = 0
    queue = [...values]
    collect(Workbench({ t }))
  }
}

const activeTaskName = state.tasks.find(task => task.id === state.activeTaskId)?.name ?? ''
console.log(textSink.includes(activeTaskName)
  ? `ok   header picker shows the active task (${activeTaskName})`
  : `FAIL header picker missing the active task (${activeTaskName}) -> ${textSink.slice(0, 12).join(' | ')}`)
if (!textSink.includes(activeTaskName)) process.exitCode = 1
if (errors.length > 0) {
  console.log('\nERRORS:')
  for (const error of errors) console.log(' -', error)
} else {
  console.log('\nall components rendered without throwing')
}
rmSync(dir, { recursive: true, force: true })
