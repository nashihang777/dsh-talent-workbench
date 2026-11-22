/**
 * Recruiting tasks, interview batches and the feedback → template loop.
 *
 * The rule being protected: resumes are never ranked across batches, and a
 * template only changes through an explicit, versioned action.
 *
 * Run: node dev/task-smoke.mjs
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'
import { suggestBatches } from '../lib/tasks.js'

let failures = 0
const check = (label, ok, detail = '') => {
  if (ok) console.log('ok  ', label)
  else { failures += 1; console.log('FAIL', label, detail) }
}

const dir = mkdtempSync(join(tmpdir(), 'tw-task-'))
const { db, instance } = loadStore(dir)
const wb = new TalentWorkbench({ dataDir: dir, db, instance, config: {}, onSkillsChanged: () => {} })

// ---------- migration: an old database without tasks ----------------------
writeFileSync(join(dir, 'placeholder.txt'), 'x', 'utf8')
const legacy = {
  id: 'cand-legacy', alias: '历史候选人', major: '软件工程', degree: '博士', school: '示例大学',
  profileText: '示例', publications: [], projects: [], engineering: [], theory: [], roles: [], skills: [], awards: [],
  tags: [], notes: '', source: 'import', sourceFile: 'x.pdf', assessment: {},
  extraction: { format: 'pdf', engine: 'pdf-text', chars: 10, needsReview: false, textHash: 'h1', warnings: [] },
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), assessments: {}, decisionOverride: null,
}
db.candidates['cand-legacy'] = { ...legacy }
const migrated = wb.snapshot()
check('legacy candidate adopted into a task', typeof db.candidates['cand-legacy'].taskId === 'string' && db.candidates['cand-legacy'].taskId !== '')
check('legacy candidate adopted into a batch', typeof db.candidates['cand-legacy'].batchId === 'string' && db.candidates['cand-legacy'].batchId !== '')
check('migration creates exactly one task', migrated.tasks.length === 1, String(migrated.tasks.length))
check('migration creates exactly one batch', migrated.batches.length === 1, String(migrated.batches.length))
check('snapshot exposes the active task', migrated.activeTask !== null && migrated.activeTask.name.length > 0)

// ---------- explicit task + two batches ----------------------------------
const created = wb.createTask({ name: '算法工程师 · 测试', description: '用于自检', templateId: Object.keys(db.templates)[0] })
const taskId = created.taskId
check('task created and active', wb.snapshot().activeTaskId === taskId)
const b1 = wb.createBatch({ taskId, name: '9 月 12 日', interviewFrom: '2026-09-12', interviewTo: '2026-09-12' })
const b2 = wb.createBatch({ taskId, name: '9 月 19 日', interviewFrom: '2026-09-19', interviewTo: '2026-09-20' })

// three candidates: two in batch 1, one in batch 2
const mk = (name, batchId, date) => {
  const body = wb.createCandidate({
    alias: name, major: '软件工程', degree: '博士', school: '示例大学', interviewDate: date,
    taskId, batchId,
    publications: [{ role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊' }],
  })
  return body.candidateId
}
const a1 = mk('候选甲', b1.batchId, '2026-09-12')
const a2 = mk('候选乙', b1.batchId, '2026-09-12')
const a3 = mk('候选丙', b2.batchId, '2026-09-19')

// ---------- batches are ranked separately --------------------------------
wb.setActiveContext({ batchId: b1.batchId })
const snap1 = wb.snapshot()
check('active batch filters the candidate list', snap1.candidates.length === 2, String(snap1.candidates.length))
check('ranking only covers the batch', snap1.results.length === 2, String(snap1.results.length))
check('ranks restart per batch', snap1.results.map(r => r.rank).sort().join(',') === '1,2', snap1.results.map(r => r.rank).join(','))
check('other batch candidate is not ranked', !snap1.results.some(r => r.candidateId === a3))

wb.setActiveContext({ batchId: b2.batchId })
const snap2 = wb.snapshot()
check('second batch has its own pool', snap2.candidates.length === 1 && snap2.results.length === 1)
check('second batch rank starts at 1', snap2.results[0].rank === 1)
check('allCandidates still lists everyone', snap2.allCandidates.length >= 4, String(snap2.allCandidates.length))

// ---------- moving a candidate between batches ---------------------------
wb.assignBatch(b1.batchId, [a3])
check('assignment moves the candidate', db.candidates[a3].batchId === b1.batchId)
wb.setActiveContext({ batchId: b1.batchId })
check('moved candidate joins the batch ranking', wb.snapshot().results.length === 3)

// ---------- batch suggestion by interview date ---------------------------
const groups = suggestBatches([
  { id: 'x1', interviewDate: '2026-09-12' },
  { id: 'x2', interviewDate: '2026-09-13' },
  { id: 'x3', interviewDate: '2026-09-20' },
  { id: 'x4', interviewDate: '' },
], { gapDays: 2 })
check('close dates group together', groups.length === 2, JSON.stringify(groups.map(g => g.from)))
check('two-day gap stays in one group', groups[0].candidateIds.length === 2, JSON.stringify(groups[0]))
check('undated candidates are ignored', groups.every(group => group.candidateIds.length <= 2))
const suggestion = wb.suggestBatches(2)
check('workbench exposes the suggestion', suggestion.ok === true && Array.isArray(suggestion.groups))

// ---------- guards --------------------------------------------------------
let refused = false
try { wb.deleteBatch(b1.batchId) } catch { refused = true }
check('a batch holding candidates cannot be deleted', refused)
refused = false
try { wb.deleteTask(taskId) } catch { refused = true }
check('a task holding candidates cannot be deleted', refused)

// ---------- feedback ------------------------------------------------------
const f1 = wb.addFeedback({ taskId, scope: 'candidate', kind: 'negative', candidateId: a1, message: '工程落地证据不足，不应排在前面' })
const f2 = wb.addFeedback({ taskId, scope: 'batch', kind: 'positive', batchId: b1.batchId, message: '这批人的学术水平整体不错' })
const f3 = wb.addFeedback({ taskId, scope: 'task', kind: 'adjust', message: '希望技术栈权重更高一些' })
check('three feedback entries recorded', [f1, f2, f3].every(item => item.ok === true))
const withFeedback = wb.snapshot()
check('feedback is listed for the task', withFeedback.feedback.length === 3, String(withFeedback.feedback.length))
check('feedback resolves the candidate alias', withFeedback.feedback.some(item => item.candidateAlias === '候选甲'))
check('pending count is exposed on the task', withFeedback.tasks.find(item => item.id === taskId)?.feedbackPending === 3)

// ---------- agent adjustment (stub) --------------------------------------
const templateId = db.tasks[taskId].templateId
const beforeVersion = db.templates[templateId].currentVersion
const firstSkill = db.templates[templateId].versions.find(v => v.version === beforeVersion).definition.dimensions[0].skillId
const stub = {
  available: () => ({ available: true, provider: 'fake', model: 'fake' }),
  extract: async () => ({ ok: false, items: new Map(), errors: ['unused'] }),
  proposeTemplateAdjustment: async ({ dimensions }) => ({
    proposal: {
      summary: '提高技术栈权重，降低跨学科',
      rationale: '反馈指出交付证据更重要',
      weights: { [firstSkill]: 0.5 },
      drop: dimensions.length > 2 ? [dimensions[dimensions.length - 1].skillId] : [],
    },
    errors: [],
  }),
}
wb.agentExtractor = stub
const preview = await wb.reviewFeedback({ taskId, apply: false })
check('preview does not touch the template', db.templates[templateId].currentVersion === beforeVersion)
check('preview lists changes', preview.ok === true && preview.preview === true && preview.changes.length > 0, JSON.stringify(preview.changes?.length))
check('preview explains itself', typeof preview.summary === 'string' && preview.summary.length > 0)
const applied = await wb.reviewFeedback({ taskId, apply: true })
check('apply creates a new template version', applied.ok === true && db.templates[templateId].currentVersion === beforeVersion + 1)
check('new version carries the new weight', db.templates[templateId].versions.at(-1).definition.dimensions.find(d => d.skillId === firstSkill)?.weight === 0.5)
check('applied feedback is marked', Object.values(db.feedback).filter(item => item.taskId === taskId).every(item => item.appliedAt !== ''))
check('no feedback left pending', wb.snapshot().feedback.filter(item => item.appliedAt === '').length === 0)
const second = await wb.reviewFeedback({ taskId, apply: false })
check('nothing to review once applied', second.ok !== true)

// ---------- archiving keeps data -----------------------------------------
wb.updateTask(taskId, { status: 'archived' })
check('archived task keeps its candidates', Object.values(db.candidates).filter(c => c.taskId === taskId).length === 3)
const afterArchive = wb.snapshot()
check('archiving switches the active task', afterArchive.activeTaskId !== taskId)

rmSync(dir, { recursive: true, force: true })
console.log(failures === 0 ? '\ntask smoke: all checks passed' : `\ntask smoke: ${failures} failed`)
process.exitCode = failures === 0 ? 0 : 1
