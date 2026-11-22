/**
 * Background import-job self-check.
 *
 * The behaviour under test: after files are picked, text extraction and agent
 * field reading run on the Host, report live progress, and keep going when the
 * dialog is closed. The finished job stays available so the review list can be
 * rebuilt later (even after a page reload).
 *
 * Run: node dev/background-smoke.mjs
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'

let failures = 0
const check = (label, ok, detail = '') => {
  if (ok) console.log('ok  ', label)
  else { failures += 1; console.log('FAIL', label, detail) }
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const waitFor = async (predicate, timeout = 6000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeout) {
    if (predicate()) return true
    await sleep(15)
  }
  return false
}

/** A model stub the test can hold open, to observe the agent phase. */
function makeGatedExtractor() {
  const gate = { hold: true, started: false, release: null }
  gate.open = () => {
    gate.hold = false
    gate.release?.()
  }
  const extractor = {
    available: () => ({ available: true, provider: 'fake', model: 'fake-model' }),
    extract: async (items, { signal, onProgress } = {}) => {
      gate.started = true
      onProgress?.({ done: 0, total: items.length })
      if (gate.hold) {
        await new Promise((resolve) => {
          gate.release = resolve
          const timer = setTimeout(resolve, 30_000)
          signal?.addEventListener('abort', () => { clearTimeout(timer); resolve() }, { once: true })
        })
      }
      if (signal?.aborted === true) return { ok: false, items: new Map(), errors: ['aborted'], provider: 'fake', model: 'fake-model' }
      const map = new Map()
      for (const [index, item] of items.entries()) {
        if (signal?.aborted === true) break
        map.set(item.key, {
          key: item.key,
          alias: `模型姓名${index + 1}`,
          realName: `模型姓名${index + 1}`,
          major: '软件工程',
          degree: '博士',
          school: '示例大学',
          stage: '博士四年级',
          direction: '知识图谱',
          skills: ['Python'],
          publications: [{ role: 'first', status: 'published', tier: 'sci1', venue: 'Neurocomputing' }],
          projects: [], engineering: [], theory: [], roles: [], awards: [],
          multiPerson: false,
          confidence: 0.9,
        })
        onProgress?.({ done: index + 1, total: items.length })
      }
      return { ok: true, items: map, errors: [], provider: 'fake', model: 'fake-model' }
    },
  }
  return { extractor, gate }
}

const dir = mkdtempSync(join(tmpdir(), 'tw-bg-smoke-'))
const fixtures = join(dir, 'resumes')
mkdirSync(fixtures, { recursive: true })
// Distinct names on purpose: numbered suffixes would be merged as pages of one
// candidate, which is a different feature.
const people = ['张一', '李二', '王三', '赵四']
for (const person of people) {
  writeFileSync(join(fixtures, `候选人-${person}.txt`), `候选人${person}
教育经历
2020.09-2024.06 某大学 软件工程 博士
研究方向：知识图谱与知识推理
专业技能：Python、PyTorch、Neo4j
`.repeat(3), 'utf8')
}
writeFileSync(join(fixtures, 'notes.zip'), 'not a resume', 'utf8')

const { db, instance } = loadStore(dir)
const { extractor, gate } = makeGatedExtractor()
const wb = new TalentWorkbench({ dataDir: dir, db, instance, config: {}, onSkillsChanged: () => {}, agentExtractor: extractor })

// ---------- start returns before the work is done ----------
const before = Date.now()
const started = wb.startScan({ path: fixtures, recursive: false })
const startMs = Date.now() - before
check('startScan returns a job id', started.ok === true && typeof started.jobId === 'string')
check('startScan does not block the caller', startMs < 1500, `${startMs}ms`)

// Every transition, captured synchronously: fast phases cannot hide from the test.
const history = []
const jobId = started.jobId
const poller = setInterval(() => {}, 1 << 30)
wb.onScanProgress = (view) => {
  if (view.jobId !== jobId) return
  history.push({ phase: view.phase, status: view.status, extracted: view.extracted, total: view.total, agentDone: view.agentDone, agentTotal: view.agentTotal, items: view.items.length })
}

const reachedAgent = await waitFor(() => wb.scanJobStatus(jobId).job.phase === 'agent' && gate.started)
check('the job reaches the agent phase', reachedAgent, JSON.stringify(wb.scanJobStatus(jobId).job.phase))

const extractSnapshots = history.filter(entry => entry.phase === 'extract')
check('text extraction reported progress', extractSnapshots.some(entry => entry.extracted >= 1), JSON.stringify(history.map(entry => `${entry.phase}:${entry.extracted}/${entry.total}`)))
check('partial items were published while extracting', extractSnapshots.some(entry => entry.items >= 1), JSON.stringify(history.map(entry => `${entry.phase}:${entry.items}items`)))
const agentSnapshot = history.find(entry => entry.phase === 'agent')
check('agent progress starts at zero', agentSnapshot !== undefined && agentSnapshot.agentDone === 0, JSON.stringify(agentSnapshot))
check('every file is extracted before the agent pass', agentSnapshot?.extracted === agentSnapshot?.total, JSON.stringify(agentSnapshot))

const partial = wb.scanJobStatus(jobId).job
check('partial items are visible before the end', partial.items.length === 4, `${partial.items.length}`)
check('partial items carry no raw resume text', partial.items.every(item => item.text === undefined))
check('the job is still running while the model works', partial.status === 'running', partial.status)

// ---------- "closing the dialog": drop every client-side reference ----------
// Nothing below keeps a handle to the job; polling only passes its id.
let handle = wb.scanJobs.get(jobId)
check('host owns the running job, not the client', handle !== undefined && handle.status === 'running')
handle = null
check('job survives losing the client handle', wb.scanJobStatus(jobId).job.status === 'running')

gate.open()
const finished = await waitFor(() => wb.scanJobStatus(jobId).job.status === 'done')
clearInterval(poller)
check('job finishes after the client stopped looking', finished)

const done = wb.scanJobStatus(jobId).job
check('finished job keeps every item', done.items.length === 4, `${done.items.length}`)
check('finished job reports the model route', done.agent?.model === 'fake-model', JSON.stringify(done.agent))
check('finished job reports agent coverage', done.summary?.agentParsed === 4, JSON.stringify(done.summary))
check('unsupported files never become candidates', done.items.every(item => !String(item.name).endsWith('.zip')))
check('finished job has a complete summary', ['total', 'ready', 'failed', 'ocr', 'duplicate', 'multiCandidate', 'agentParsed', 'skipped'].every(key => done.summary?.[key] !== undefined), JSON.stringify(done.summary))

// ---------- results are still presentable ----------
const rebuild = (job) => job.items.map(item => ({ key: item.key, alias: item.suggestion?.alias ?? '', major: item.suggestion?.major ?? '' }))
const rows = rebuild(done)
check('review rows can be rebuilt from the job', rows.length === 4 && rows.every(row => row.major === '软件工程'), JSON.stringify(rows[0]))
check('rebuilt rows carry the model name', rows[0]?.alias === '模型姓名1', rows[0]?.alias)

// ---------- a page reload recovers the finished job ----------
const jobs = wb.scanJobsActive().jobs
check('job list exposes the finished job for recovery', jobs.some(job => job.jobId === jobId && job.status === 'done'))
check('job list is newest first', jobs[0]?.jobId === jobId, jobs.map(job => job.jobId).join(','))

// ---------- commit still works from the recovered job ----------
const commit = wb.commitScan({ scanId: done.scanId, keys: done.items.map(item => item.key) })
check('commit works from the finished job', commit.created.length === 4, String(commit.created.length))
const stored = wb.snapshot().candidates.find(candidate => candidate.id === commit.created[0].candidateId)
check('stored candidate keeps the model fields', stored.major === '软件工程' && stored.school === '示例大学', `${stored.major}/${stored.school}`)

// ---------- discard frees the workspace ----------
const discarded = wb.discardScanJob(jobId)
check('discard removes the job', discarded.discarded === true && wb.scanJobStatus(jobId).ok === false)

// ---------- cancel while the model is working ----------
const secondGate = makeGatedExtractor()
wb.agentExtractor = secondGate.extractor
const second = wb.startScan({ path: fixtures, recursive: false })
const cancelledDuringModel = await waitFor(() => wb.scanJobStatus(second.jobId).job.phase === 'agent')
check('second job reaches the agent phase', cancelledDuringModel && secondGate.gate.started, String(secondGate.gate.started))
const cancelled = wb.cancelScanJob(second.jobId)
check('cancel is acknowledged', cancelled.ok === true && cancelled.job.cancelRequested === true)
const settled = await waitFor(() => wb.scanJobStatus(second.jobId).job.status !== 'running')
const settledJob = wb.scanJobStatus(second.jobId).job
check('cancelled job settles as cancelled', settled && settledJob.status === 'cancelled', settledJob.status)
check('cancelled job keeps no error text', settledJob.error === null, String(settledJob.error))
wb.discardScanJob(second.jobId)

// ---------- a missing job degrades gracefully ----------
check('unknown job id is reported', wb.scanJobStatus('job-nope').ok === false)

rmSync(dir, { recursive: true, force: true })
console.log(failures === 0 ? '\nbackground smoke: all checks passed' : `\nbackground smoke: ${failures} failed`)
process.exitCode = failures === 0 ? 0 : 1
