/**
 * Agent extraction self-check. Uses a fake `llm` service so the whole path runs
 * offline: prompt assembly, JSON parsing (including fences and trailing commas),
 * normalization against the allowed enums, merge with the local rule fallback,
 * and the failure path that must keep the rules and report why.
 *
 * Run: node dev/agent-smoke.mjs
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'
import { createAgentExtractor, normalizeAgentItem, parseAgentJson } from '../lib/agent-extract.js'

let failures = 0
const check = (label, ok, detail = '') => {
  if (ok) console.log('ok  ', label)
  else { failures += 1; console.log('FAIL', label, detail) }
}

// ---------- parsing ----------
check('plain json', parseAgentJson('{"results":[{"key":"item-1","major":"软件工程"}]}').length === 1)
check('fenced json', parseAgentJson('```json\n{"results":[{"key":"a"}]}\n```').length === 1)
check('prose around json', parseAgentJson('好的，结果如下：\n{"results":[{"key":"a"}]}\n以上。').length === 1)
check('bare array', parseAgentJson('[{"key":"a"}]').length === 1)
check('trailing comma', parseAgentJson('{"results":[{"key":"a"},]}').length === 1)
check('garbage yields empty', parseAgentJson('抱歉我无法完成').length === 0)

// ---------- normalization ----------
const normalized = normalizeAgentItem({
  key: 'item-1', name: '示例乙', major: '软件工程', degree: '博士', school: '示例大学',
  direction: '知识图谱', skills: ['Python', 'Neo4j'],
  publications: [{ role: 'first', status: 'published', tier: 'sci1', venue: 'Neurocomputing' }, { role: 'bogus', venue: '' }],
  projects: [{ name: '国家重点研发计划', role: 'core', level: 'national', validation: 'pilot' }],
  engineering: [{ kind: 'software', desc: '知识图谱平台' }],
  theory: [{ kind: 'other', desc: '图表示学习' }],
  roles: [{ title: '党支部书记', kind: 'party', current: true }],
  awards: ['优秀学生'],
  confidence: 0.9,
})
check('name kept', normalized.realName === '示例乙')
check('major kept verbatim', normalized.major === '软件工程')
check('degree enum', normalized.degree === '博士')
check('invalid publication dropped', normalized.publications.length === 1)
check('unknown enum falls back', normalized.projects[0].role === 'core' && normalized.engineering[0].kind === 'software')
check('confidence clamped', normalized.confidence === 0.9)
check('bad degree cleared', normalizeAgentItem({ major: 'x', degree: '博士后' }).degree === '')

// ---------- extractor against a fake llm ----------
const reply = JSON.stringify({
  results: [
    {
      key: 'item-1', name: '示例乙', major: '软件工程', degree: '博士', school: '示例大学',
      stage: '2021.09–至今', direction: '知识图谱表示学习与推理',
      skills: ['Python', 'PyTorch'],
      publications: [{ role: 'first', status: 'published', tier: 'sci1', venue: 'Neurocomputing' }],
      projects: [{ name: '工业大数据知识图谱', role: 'core', level: 'national', validation: 'pilot' }],
      engineering: [{ kind: 'software', desc: '基于 Neo4j 的知识图谱平台' }],
      theory: [{ kind: 'ml', desc: '知识表示学习' }],
      roles: [], awards: ['博士学业奖学金'], confidence: 0.88,
    },
    { key: 'item-2', name: '应试者', multiPerson: true, major: '', degree: '', school: '' },
  ],
})
let calls = 0
const fakeLlm = {
  stream(options) {
    calls += 1
    check('system prompt present', typeof options.system === 'string' && options.system.includes('简历结构化器'))
    check('temperature is deterministic', options.temperature === 0)
    const text = options.messages?.[0]?.content?.[0]?.text ?? ''
    check('prompt carries the resume keys', text.includes('key="item-1"') && text.includes('key="item-2"'))
    return (async function* () {
      // Split the JSON across deltas to prove chunk assembly works.
      for (const part of reply.match(/[\s\S]{1,120}/g) ?? []) {
        yield { type: 'text-delta', index: 0, text: part }
      }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })()
  },
}
const extractor = createAgentExtractor({
  getLlm: () => fakeLlm,
  getSelection: () => ({ provider: 'fake', model: 'fake-model' }),
  config: {},
})
const available = extractor.available()
check('extractor available', available.available === true, JSON.stringify(available))

// ---------- end-to-end scan through the workbench ----------
const dir = mkdtempSync(join(tmpdir(), 'tw-agent-'))
const { db, instance } = loadStore(dir)
const wb = new TalentWorkbench({ dataDir: dir, db, instance, config: {}, onSkillsChanged: () => {}, agentExtractor: extractor })
// 1.7: a recruiting task is the only way in; create one before importing.
wb.createTask({ name: '自检任务', templateId: Object.keys(db.templates)[0] })
const fx = join(dir, 'fx')
mkdirSync(fx, { recursive: true })
writeFileSync(join(fx, '604_软件工程_示例乙.txt'), '示例乙\n教育经历\n2018.09-2022.06 博士 某大学 软件工程\n研究方向：知识图谱\n', 'utf8')
writeFileSync(join(fx, '评审记录.txt'), '269_物理_某：方向契合。\n351_材料_某：成果较少。\n400_力学_某：水平较高。\n', 'utf8')

const scan = await wb.scanResumes({ path: fx, recursive: false })
check('scan reports the model route', scan.agent?.available === true && scan.agent.model === 'fake-model', JSON.stringify(scan.agent))
const ljh = scan.items.find(item => item.name.includes('示例乙'))
const memo = scan.items.find(item => item.name.includes('评审记录'))
check('row marked as agent-parsed', ljh?.extractionSource === 'agent', ljh?.extractionSource)
check('agent major used', ljh?.suggestion?.major === '软件工程', ljh?.suggestion?.major)
check('agent stage used', ljh?.suggestion?.stage === '2021.09–至今', ljh?.suggestion?.stage)
check('agent evidence carried', (ljh?.suggestion?.evidence?.publications ?? []).length === 1)
check('model flagged the memo', memo?.multiCandidate === true)
check('summary counts agent rows', scan.summary.agentParsed >= 1, JSON.stringify(scan.summary))

const commit = wb.commitScan({ scanId: scan.scanId, keys: [ljh.key] })
const saved = wb.snapshot().candidates.find(c => c.id === commit.created[0].candidateId)
check('stored major from agent', saved.major === '软件工程', saved.major)
check('stored publications from agent', saved.publications.length === 1)
check('stored field source', saved.extraction.fieldSource === 'agent', String(saved.extraction.fieldSource))

// ---------- model refresh over stored records ----------
// A record imported by the old rules: wrong name and wrong major.
db.candidates['cand-old'] = {
  id: 'cand-old', alias: '教育经历', realName: '教育经历', major: '材料', degree: '博士', school: '',
  stage: '', direction: '', profileText: '示例甲\n教育经历\n2020.09-至今 某大学 应用数学 博士\n研究方向：数学建模',
  publications: [], projects: [], engineering: [], theory: [], roles: [], skills: [], awards: [], tags: [],
  notes: '', source: 'import', sourceFile: '401_数学_示例甲.pdf',
  extraction: { format: 'pdf', engine: 'pdf-text', chars: 60, needsReview: false, textHash: 'x', fieldSource: 'rule', warnings: [] },
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), assessments: {}, decisionOverride: null,
}
const refresher = createAgentExtractor({
  getLlm: () => ({
    stream() {
      return (async function* () {
        const payload = JSON.stringify({ results: [{
          key: 'cand-old', name: '示例甲', major: '应用数学', degree: '博士', school: '示例工业大学',
          direction: '数学建模', skills: ['MATLAB'],
          publications: [{ role: 'first', status: 'published', tier: 'sci1', venue: 'DCDS-B' }],
        }] })
        yield { type: 'text-delta', index: 0, text: payload }
        yield { type: 'finish', reason: { kind: 'stop' } }
      })()
    },
  }),
  getSelection: () => ({ provider: 'fake', model: 'fake' }),
  config: {},
})
const wb4 = new TalentWorkbench({ dataDir: dir, db, instance, config: {}, onSkillsChanged: () => {}, agentExtractor: refresher })
// 1.7: a recruiting task is the only way in; create one before importing.
wb4.createTask({ name: '自检任务', templateId: Object.keys(db.templates)[0] })
const previewResult = await wb4.agentRefreshFields({ apply: false })
check('refresh previews without writing', previewResult.preview === true && previewResult.total === 1, JSON.stringify({ total: previewResult.total }))
check('preview keeps the old name in place', db.candidates['cand-old'].alias === '教育经历')
const planRow = previewResult.plan[0]
check('preview flags the name', planRow.changes.alias?.to === '示例甲', JSON.stringify(planRow.changes.alias))
check('preview flags the major', planRow.changes.major?.to === '应用数学', JSON.stringify(planRow.changes.major))
check('preview proposes evidence', (planRow.evidence.publications ?? []).length === 1)
const appliedRefresh = await wb4.agentRefreshFields({ apply: true })
const fixed = wb4.snapshot().allCandidates.find(c => c.id === 'cand-old')
check('apply writes the name', fixed.alias === '示例甲', fixed.alias)
check('apply writes the major', fixed.major === '应用数学', fixed.major)
check('apply writes evidence', fixed.publications.length === 1)
check('apply marks the source', fixed.extraction.fieldSource === 'agent', String(fixed.extraction.fieldSource))
check('apply records an audit entry', (wb4.snapshot().audit ?? []).some(a => a.action === 'candidate.agentRefresh'))
const noop = await wb4.agentRefreshFields({ apply: true })
check('second refresh is a no-op', noop.applied === 0, String(noop.applied))

// ---------- failure path keeps the rules ----------
const brokenExtractor = createAgentExtractor({
  getLlm: () => ({
    stream() {
      return (async function* () {
        yield { type: 'finish', reason: { kind: 'error', failure: { message: '配额不足', code: 'quota' } } }
      })()
    },
  }),
  getSelection: () => ({ provider: 'fake', model: 'fake' }),
  config: {},
})
const wb2 = new TalentWorkbench({ dataDir: dir, db, instance, config: {}, onSkillsChanged: () => {}, agentExtractor: brokenExtractor })
// 1.7: a recruiting task is the only way in; create one before importing.
wb2.createTask({ name: '自检任务', templateId: Object.keys(db.templates)[0] })
const scan2 = await wb2.scanResumes({ path: fx, recursive: false })
const fallbackItem = scan2.items.find(item => item.name.includes('示例乙'))
check('failure falls back to rules', fallbackItem?.extractionSource === 'rule', fallbackItem?.extractionSource)
check('failure is reported', (fallbackItem?.warnings ?? []).some(w => w.includes('智能体解析失败')), JSON.stringify(fallbackItem?.warnings))
check('fallback still yields a major', (fallbackItem?.suggestion?.major ?? '') !== '')

// ---------- disabled by config ----------
const wb3 = new TalentWorkbench({ dataDir: dir, db, instance, config: { import: { useAgent: false } }, onSkillsChanged: () => {}, agentExtractor: extractor })
// 1.7: a recruiting task is the only way in; create one before importing.
wb3.createTask({ name: '自检任务', templateId: Object.keys(db.templates)[0] })
const scan3 = await wb3.scanResumes({ path: fx, recursive: false })
check('config can disable the agent', scan3.agent?.available === false, JSON.stringify(scan3.agent))
check('disabled run uses rules', scan3.items.every(item => item.ok !== true || item.extractionSource === 'rule'))

rmSync(dir, { recursive: true, force: true })
console.log(failures === 0 ? '\nagent smoke: all checks passed' : `\nagent smoke: ${failures} failed`)
process.exitCode = failures === 0 ? 0 : 1
