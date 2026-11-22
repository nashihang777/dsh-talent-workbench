import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'
const dir = mkdtempSync(join(tmpdir(), 'tw-slots-'))
const { db, instance } = loadStore(dir)
new TalentWorkbench({ dataDir: dir, db, instance, config: {}, onSkillsChanged: () => {} })
let captured = null
globalThis.window = { __ModuleLoader__: { load(d) { captured = d } } }
globalThis.document = { createElement: () => ({ click(){}, remove(){}, style:{} }), body: { appendChild(){} }, addEventListener(){}, removeEventListener(){}, activeElement: null }
globalThis.URL = { createObjectURL: () => 'x', revokeObjectURL() {} }; globalThis.Blob = class {}; globalThis.FileReader = class {}
const React = { createElement: (...a) => ({ type: a[0], props: a[1] ?? {}, children: a.slice(2) }), useState: v => [typeof v === 'function' ? v() : v, () => {}], useEffect(){}, useMemo: f => f(), useRef: () => ({ current: null }) }
await import('../client.js')
const module = captured.factory(n => { if (n === 'react') return React; throw new Error(n) })
const registered = []
module.apply({
  locale: { bind: () => k => k, register: () => () => {} },
  slots: { inject: (k, cb) => { cb(); return () => {} }, register: (options, component) => { registered.push({ slot: options.name, id: options.id ?? options.key, component }); return () => {} } },
  effect: fn => fn(),
})
console.log('inject list:', JSON.stringify(module.inject))
for (const item of registered) console.log(`${item.slot} -> ${item.id} (${typeof item.component})`)
const left = registered.find(item => item.slot === 'sidebar.panellist')
const page = registered.find(item => item.slot === 'main')
console.log(left !== undefined && page !== undefined && left.id === page.id ? 'ok   left entry and main page share the id' : 'FAIL slot wiring')
console.log(registered.some(item => item.slot === 'conversation.input.left') ? 'FAIL composer entry still present' : 'ok   composer entry removed')
const icon = left.component({ size: 20, active: false })
console.log(icon !== null && icon.type === 'svg' ? 'ok   icon renders svg' : 'FAIL icon')
rmSync(dir, { recursive: true, force: true })
