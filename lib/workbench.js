/**
 * Workbench service: one implementation used by both the browser panel (HTTP
 * routes) and the agent tool. It owns validation, local persistence, versioning
 * and the privacy-safe exchange operations.
 */
import {
  autoAssessCandidate,
  biasDiagnostics,
  buildReportMarkdown,
  buildRunSnapshot,
  currentSkill,
  currentTemplate,
  dashboardStats,
  decisionLabel,
  ensureAssessments,
  levelOptionsFor,
  levelScore,
  rankCandidates,
  skillSummaries,
  templateSummaries,
  nowIso,
} from './engine.js'
import {
  appendLedger,
  buildDemoPeerPack,
  buildExchangePack,
  mergePack,
  peerSummary,
  validatePack,
  verifyLedger,
  verifyPackIntegrity,
} from './exchange.js'
import { audit, resetDemoStore, rotateInstance, saveStore } from './store.js'
import {
  ensureTasks, batchesOf, candidatesOfBatch, candidatesOfTask, createTask, updateTask, deleteTask,
  createBatch, updateBatch, assignCandidates, deleteBatch, suggestBatches,
  addFeedback, deleteFeedback, feedbackOfTask, buildFeedbackBrief, mergeProposal,
} from './tasks.js'
import { extractResume, suggestFields, looksLikeMultiPersonDoc, SUPPORTED_EXTENSIONS, cleanupWorkDir } from './import/extract.js'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'

/**
 * Merge the model's fields with the local rule suggestion.
 *
 * The model wins where it returned something; the rule keeps whatever the model
 * left empty, so a failed field never becomes an empty box. A disagreement on
 * name/major is reported back to the recruiter instead of being hidden.
 */
function mergeAgentFields(ruleSuggestion, agentFields, fileName) {
  const rule = ruleSuggestion ?? {}
  const notes = []
  const clean = (value) => (typeof value === 'string' ? value.trim() : '')
  const alias = clean(agentFields.alias) || clean(agentFields.realName) || clean(rule.alias) || fileName
  const realName = clean(agentFields.realName) || clean(agentFields.alias) || clean(rule.realName)
  for (const field of ['major', 'degree', 'school']) {
    const fromModel = clean(agentFields[field])
    const fromRule = clean(rule[field])
    if (fromModel !== '' && fromRule !== '' && fromModel !== fromRule) {
      notes.push(`${field} 规则=${fromRule} / 模型=${fromModel}`)
    }
  }
  return {
    notes,
    suggestion: {
      alias,
      realName,
      major: clean(agentFields.major) || clean(rule.major),
      degree: clean(agentFields.degree) || clean(rule.degree),
      school: clean(agentFields.school) || clean(rule.school),
      stage: clean(agentFields.stage) || clean(rule.stage) || '',
      direction: clean(agentFields.direction) || clean(rule.direction),
      sourceFile: rule.sourceFile ?? fileName,
      confidence: agentFields.confidence,
      evidence: {
        skills: agentFields.skills ?? [],
        publications: agentFields.publications ?? [],
        projects: agentFields.projects ?? [],
        engineering: agentFields.engineering ?? [],
        theory: agentFields.theory ?? [],
        roles: agentFields.roles ?? [],
        awards: agentFields.awards ?? [],
      },
    },
  }
}

function textHash(value) {
  return createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex').slice(0, 32)
}

const PAGE_MARKER = /[（(]\s*第?\s*[0-9一二三四五六七八九十百]+\s*页\s*[)）]/g
const TRAILING_PAGE = /[-_\s]*(?:page|pg|p)?[-_\s]?[0-9]{1,2}$/i

/** Filename without a trailing page marker, used to group multi-page scans. */
function groupKey(name) {
  const base = String(name ?? '').replace(/\.[^.]+$/, '')
  let key = base.replace(PAGE_MARKER, '').trim()
  if (TRAILING_PAGE.test(key)) {
    const stripped = key.replace(TRAILING_PAGE, '').trim()
    if (stripped.length >= 3) key = stripped
  }
  return key === '' ? base : key
}

function groupLabel(name) {
  return groupKey(name)
}

/** Page order for a filename: 第N页 or a trailing number, else 0. */
function pageRank(name) {
  const base = String(name ?? '')
  const chinese = base.match(/第\s*([0-9一二三四五六七八九十]+)\s*页/)
  const digits = base.match(/[-_\s](?:page|pg|p)?[-_\s]?([0-9]{1,2})(?:\.[^.]+)?$/i)
  const raw = chinese?.[1] ?? digits?.[1] ?? ''
  if (/^[0-9]+$/.test(raw)) return Number(raw)
  const numerals = '一二三四五六七八九十'
  const chineseValue = numerals.indexOf(raw)
  if (chineseValue >= 0) return chineseValue + 1
  return 0
}

const LIMITS = {
  alias: 60,
  realName: 60,
  major: 80,
  degree: 30,
  school: 120,
  stage: 60,
  direction: 300,
  profileText: 30000,
  note: 500,
  evidence: 800,
}

function text(value, max = 300) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max)
}

function number(value, fallback = 0, min = 0, max = 100) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function array(value, max = 60) {
  return Array.isArray(value) ? value.slice(0, max) : []
}

function id(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizePublications(input) {
  return array(input, 80).map(item => ({
    role: ['first', 'cofirst', 'other'].includes(item?.role) ? item.role : 'other',
    status: ['published', 'accepted', 'review', 'inReview', 'revise'].includes(item?.status) ? item.status : 'review',
    tier: ['top', 'sci1', 'sci2', 'ccfA', 'ccfB', 'ccfC', 'ei', 'core', 'other'].includes(item?.tier) ? item.tier : 'other',
    venue: text(item?.venue, 160),
    title: text(item?.title, 200),
  }))
}

function normalizeProjects(input) {
  return array(input, 60).map(item => ({
    name: text(item?.name, 180),
    role: ['lead', 'core', 'participant'].includes(item?.role) ? item.role : 'participant',
    level: ['national', 'provincial', 'enterprise', 'lab'].includes(item?.level) ? item.level : 'lab',
    validation: ['industrial', 'pilot', 'lab'].includes(item?.validation) ? item.validation : 'lab',
  }))
}

function normalizeEngineering(input) {
  return array(input, 60).map(item => ({
    kind: ['deployment', 'software', 'control', 'integration', 'field'].includes(item?.kind) ? item.kind : 'software',
    desc: text(item?.desc, 300),
  }))
}

function normalizeTheory(input) {
  return array(input, 60).map(item => ({
    kind: ['first-principles', 'md', 'numerical', 'thermodynamics', 'ml', 'other'].includes(item?.kind) ? item.kind : 'other',
    desc: text(item?.desc, 300),
  }))
}

function normalizeRoles(input) {
  return array(input, 40).map(item => ({
    title: text(item?.title, 100),
    kind: ['party', 'student', 'admin', 'other'].includes(item?.kind) ? item.kind : 'other',
    start: text(item?.start, 20),
    end: text(item?.end, 20),
    current: item?.current === true,
  }))
}

function normalizeCandidate(input) {
  return {
    alias: text(input?.alias, LIMITS.alias),
    realName: text(input?.realName, LIMITS.realName),
    major: text(input?.major, LIMITS.major),
    degree: text(input?.degree, LIMITS.degree),
    school: text(input?.school, LIMITS.school),
    stage: text(input?.stage, LIMITS.stage),
    direction: text(input?.direction, LIMITS.direction),
    profileText: text(input?.profileText, LIMITS.profileText),
    publications: normalizePublications(input?.publications),
    projects: normalizeProjects(input?.projects),
    engineering: normalizeEngineering(input?.engineering),
    theory: normalizeTheory(input?.theory),
    roles: normalizeRoles(input?.roles),
    skills: array(input?.skills, 60).map(item => text(item, 60)).filter(Boolean),
    awards: array(input?.awards, 40).map(item => text(item, 120)).filter(Boolean),
    tags: array(input?.tags, 20).map(item => text(item, 40)).filter(Boolean),
    notes: text(input?.notes, 1000),
    interviewDate: text(input?.interviewDate, 10),
  }
}

function normalizeTemplate(input) {
  const dimensions = array(input?.dimensions, 40).map(item => ({
    skillId: text(item?.skillId, 80),
    weight: number(item?.weight, 0, 0, 100),
    gate: item?.gate === true,
    gateMin: text(item?.gateMin, 30) || 'mid',
  })).filter(item => item.skillId !== '')
  const seen = new Set()
  const unique = dimensions.filter(item => {
    if (seen.has(item.skillId)) return false
    seen.add(item.skillId)
    return true
  })
  return {
    name: text(input?.name, 80),
    family: text(input?.family, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'general',
    description: text(input?.description, 1000),
    dimensions: unique,
    hitMinScore: number(input?.hitMinScore, 0.6, 0, 1),
    decision: {
      recommend: number(input?.decision?.recommend, 70, 0, 100),
      backup: number(input?.decision?.backup, 55, 0, 100),
    },
    tieBreak: array(input?.tieBreak, 6).map(item => text(item, 80)).filter(Boolean),
    focus: {
      industry: text(input?.focus?.industry, 40),
      keywords: array(input?.focus?.keywords, 20).map(item => text(item, 30)).filter(Boolean),
    },
  }
}

export class TalentWorkbench {
  constructor({ dataDir, db, instance, config = {}, onSkillsChanged, agentExtractor }) {
    this.dataDir = dataDir
    this.db = db
    this.instance = instance
    this.config = config
    this.onSkillsChanged = typeof onSkillsChanged === 'function' ? onSkillsChanged : () => {}
    this.agentExtractor = agentExtractor
    // 1.7: make sure the task/batch collections exist and adopt old candidates.
    ensureTasks(this.db)
    this.scans = new Map()
    // Background scan jobs: the HTTP request returns a job id immediately and the
    // work continues even when the client closes the dialog or reloads the page.
    this.scanJobs = new Map()
    this.scansRoot = join(dataDir, 'tmp', 'scans')
    this.clearScanWorkspaces()
    this.ensureSeedAssessments()
    this.ensureActiveTemplate()
  }

  /**
   * Scan workspaces only live for the current Host instance: the in-memory
   * index is lost on reload, so anything left on disk is unreachable.
   */
  clearScanWorkspaces() {
    try {
      for (const entry of readdirSync(this.scansRoot, { withFileTypes: true })) {
        if (entry.isDirectory()) cleanupWorkDir(join(this.scansRoot, entry.name))
      }
    } catch { /* the directory may not exist yet */ }
  }

  get importConfig() {
    const value = this.config?.import ?? {}
    return {
      maxFiles: Number.isFinite(value.maxFiles) ? value.maxFiles : 40,
      maxBytes: Number.isFinite(value.maxBytes) ? value.maxBytes : 48 * 1024 * 1024,
      maxOcrPages: Number.isFinite(value.maxOcrPages) ? value.maxOcrPages : 6,
      ocrDpi: Number.isFinite(value.ocrDpi) ? value.ocrDpi : 200,
      ocrScaleTo: Number.isFinite(value.ocrScaleTo) ? value.ocrScaleTo : 2400,
      ocrLanguage: typeof value.ocrLanguage === 'string' ? value.ocrLanguage : 'zh-Hans-CN',
      useAgent: value.useAgent !== false,
      poppler: value.poppler ?? {},
    }
  }

  /** Drop scan workspaces that are stale or beyond the retention count. */
  pruneScans() {
    const now = Date.now()
    // Never evict a scan whose background job is still running.
    const busy = new Set([...this.scanJobs.values()].filter(job => job.status === 'running').map(job => job.scanId))
    const entries = [...this.scans.entries()]
      .filter(([scanId]) => !busy.has(scanId))
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
    const keep = 5
    const excess = Math.max(0, entries.length - keep)
    const doomed = entries.slice(0, excess)
    for (const [scanId, scan] of entries) {
      if (doomed.includes([scanId, scan])) continue
      if (now - scan.createdAt <= 30 * 60_000) continue
      doomed.push([scanId, scan])
    }
    for (const [scanId] of doomed) {
      const scan = this.scans.get(scanId)
      this.scans.delete(scanId)
      if (scan !== undefined) cleanupWorkDir(scan.workDir)
    }
  }

  listScanFiles(root, recursive, depth = 0) {
    const result = []
    let entries = []
    try {
      entries = readdirSync(root, { withFileTypes: true })
    } catch {
      return result
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue
      const full = join(root, entry.name)
      if (entry.isDirectory()) {
        if (recursive && depth < 3) result.push(...this.listScanFiles(full, true, depth + 1))
        continue
      }
      if (!entry.isFile()) continue
      if (!SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue
      result.push(full)
    }
    return result
  }

  // ---------------------------------------------------------------- scan jobs

  /** Public view of a job: no resume text, only what a progress UI needs. */
  jobView(job) {
    return {
      jobId: job.jobId,
      scanId: job.scanId,
      status: job.status,
      phase: job.phase,
      total: job.total,
      extracted: job.extracted,
      agentTotal: job.agentTotal,
      agentDone: job.agentDone,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      error: job.error,
      cancelRequested: job.cancelRequested === true,
      items: job.items,
      skipped: job.skipped,
      summary: job.summary,
      agent: job.agent,
      limits: job.limits ?? null,
    }
  }

  /** Keep at most a few finished jobs so the UI can recover after a reload. */
  pruneJobs() {
    const finished = [...this.scanJobs.values()]
      .filter(job => job.status !== 'running')
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    for (const job of finished.slice(6)) {
      this.scanJobs.delete(job.jobId)
      this.scans.delete(job.scanId)
      cleanupWorkDir(job.workDir)
    }
  }

  /**
   * Start a scan in the background and return immediately.
   *
   * The returned job id is stable across dialog closes and page reloads: the
   * client polls scanJobStatus (or scanJobsActive after a reload) and the work
   * keeps running on the Host.
   */
  startScan(input = {}) {
    this.pruneScans()
    this.pruneJobs()
    const limits = this.importConfig
    const jobId = `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const scanId = `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const workDir = join(this.scansRoot, scanId)
    const controller = new AbortController()
    const job = {
      jobId,
      scanId,
      workDir,
      status: 'running',
      phase: 'listing',
      total: 0,
      extracted: 0,
      agentTotal: 0,
      agentDone: 0,
      items: [],
      skipped: [],
      startedAt: Date.now(),
      finishedAt: null,
      error: null,
      summary: null,
      agent: null,
      limits: { maxFiles: limits.maxFiles, maxBytes: limits.maxBytes, maxFileBytes: 30 * 1024 * 1024 },
      cancelRequested: false,
      controller,
    }
    this.scanJobs.set(jobId, job)
    const run = async () => {
      mkdirSync(workDir, { recursive: true })
      try {
        const result = await this.runScan({ input, limits, scanId, workDir, signal: controller.signal, job })
        job.status = result.cancelled === true ? 'cancelled' : 'done'
        job.summary = result.summary
        job.agent = result.agent ?? null
        job.skipped = result.skipped ?? []
        job.items = (result.items ?? []).map(item => ({ ...item }))
        job.phase = 'done'
      } catch (error) {
        const cancelled = controller.signal.aborted === true || error?.cancelled === true || job.cancelRequested === true
        job.status = cancelled ? 'cancelled' : 'error'
        job.error = cancelled ? null : String(error?.message ?? error)
        job.phase = job.status
        cleanupWorkDir(workDir)
        this.scans.delete(scanId)
      } finally {
        job.finishedAt = Date.now()
        job.controller = null
      }
    }
    // Deliberately not awaited: the request that started it returns at once.
    void run()
    return { ok: true, jobId, scanId, status: 'running' }
  }

  scanJobStatus(jobId) {
    const job = this.scanJobs.get(String(jobId ?? ''))
    if (job === undefined) return { ok: false, error: '这个导入任务已不存在或已过期' }
    return { ok: true, job: this.jobView(job) }
  }

  /** Every recent job, newest first; the client picks up a running one after reload. */
  scanJobsActive() {
    const jobs = [...this.scanJobs.values()]
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
      .map(job => this.jobView(job))
    return { ok: true, jobs }
  }

  cancelScanJob(jobId) {
    const job = this.scanJobs.get(String(jobId ?? ''))
    if (job === undefined) return { ok: false, error: '任务不存在' }
    job.cancelRequested = true
    if (job.status === 'running' && job.controller !== null) job.controller.abort(new Error('用户取消'))
    return { ok: true, job: this.jobView(job) }
  }

  discardScanJob(jobId) {
    const job = this.scanJobs.get(String(jobId ?? ''))
    if (job === undefined) return { ok: true, discarded: false }
    if (job.status === 'running' && job.controller !== null) job.controller.abort(new Error('用户取消'))
    this.scanJobs.delete(job.jobId)
    this.scans.delete(job.scanId)
    cleanupWorkDir(job.workDir)
    return { ok: true, discarded: true }
  }

  /**
   * Extract text from resume files. Sources are either files uploaded by the
   * browser (base64) or a local path (single file or folder, used by the agent).
   * Nothing is added to the candidate pool until commitScan runs.
   */
  async scanResumes(input = {}) {
    this.pruneScans()
    const limits = this.importConfig
    const scanId = `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const workDir = join(this.scansRoot, scanId)
    mkdirSync(workDir, { recursive: true })
    try {
      return await this.runScan({ input, limits, scanId, workDir, signal: input?.signal })
    } catch (error) {
      cleanupWorkDir(workDir)
      throw error
    }
  }

  async runScan({ input, limits, scanId, workDir, signal, job }) {
    const jobs = []
    const skipped = []
    /** Report progress for the polling UI; never throws into the import path. */
    const report = (patch) => {
      if (job === undefined) return
      try {
        Object.assign(job, patch)
        // Optional synchronous hook: tests and future push transports can watch
        // every transition instead of polling for it.
        if (typeof this.onScanProgress === 'function') this.onScanProgress(this.jobView(job))
      } catch { /* progress is best-effort */ }
    }
    const publishItems = () => {
      if (job === undefined) return
      report({ items: items.map(({ text: _text, ...rest }) => ({ ...rest })) })
    }
    const checkCancelled = () => {
      if (signal?.aborted === true || job?.cancelRequested === true) {
        const error = new Error('已取消')
        error.cancelled = true
        throw error
      }
    }
    if (typeof input.path === 'string' && input.path.trim() !== '') {
      const target = resolve(input.path.trim())
      let stats
      try { stats = statSync(target) } catch { throw new Error(`路径不存在：${target}`) }
      const files = stats.isDirectory() ? this.listScanFiles(target, input.recursive !== false) : [target]
      for (const file of files) {
        if (!SUPPORTED_EXTENSIONS.has(extname(file).toLowerCase())) {
          skipped.push({ name: basename(file), reason: '不支持的格式' })
          continue
        }
        if (jobs.length >= limits.maxFiles) { skipped.push({ name: basename(file), reason: '超出单次数量上限' }); continue }
        jobs.push({ name: basename(file), path: file })
      }
    }
    const uploaded = Array.isArray(input.files) ? input.files : []
    let totalBytes = 0
    for (const file of uploaded) {
      const name = text(file?.name, 200)
      if (name === '') continue
      const base = name.split(/[\\/]/).pop()
      if (base.startsWith('.') || base.startsWith('~$')) { skipped.push({ name: base, reason: '临时或隐藏文件' }); continue }
      if (!SUPPORTED_EXTENSIONS.has(extname(base).toLowerCase())) { skipped.push({ name: base, reason: '不支持的格式' }); continue }
      if (jobs.length >= limits.maxFiles) { skipped.push({ name: base, reason: '超出单次数量上限' }); continue }
      const base64 = typeof file?.data === 'string' ? file.data : ''
      const buffer = Buffer.from(base64, 'base64')
      totalBytes += buffer.length
      if (totalBytes > limits.maxBytes) throw new Error('上传总量超过上限，请分批导入')
      if (buffer.length === 0) { skipped.push({ name: base, reason: '空文件' }); continue }
      jobs.push({ name: base, buffer })
    }
    if (jobs.length === 0) throw new Error('没有找到可导入的简历文件（支持 PDF、DOC、DOCX、RTF、TXT 与常见图片）')

    // Multi-page scans usually arrive as one file per page. Group them by the
    // name with page markers removed so one candidate is one row, not five.
    const groups = []
    const byKey = new Map()
    for (const entry of jobs) {
      const key = groupKey(entry.name)
      const existing = byKey.get(key)
      if (existing === undefined) {
        const group = { key, label: groupLabel(entry.name), jobs: [entry] }
        byKey.set(key, group)
        groups.push(group)
      } else {
        existing.jobs.push(entry)
      }
    }
    for (const group of groups) {
      group.jobs.sort((a, b) => pageRank(a.name) - pageRank(b.name))
    }

    checkCancelled()
    report({ phase: 'extract', total: groups.length })
    const items = []
    const knownHashes = new Map()
    for (const candidate of Object.values(this.db.candidates)) {
      if (candidate.extraction?.textHash) knownHashes.set(candidate.extraction.textHash, candidate.alias)
    }
    for (const [index, group] of groups.entries()) {
      checkCancelled()
      report({ current: index + 1 })
      const itemWorkDir = join(workDir, `item-${index + 1}`)
      mkdirSync(itemWorkDir, { recursive: true })
      try {
        const chunks = []
        const pages = []
        const warnings = []
        const engines = new Set()
        let needsReview = false
        let ocrFallbackLanguage = false
        let format = ''
        let failure = null
        for (const [pageIndex, page] of group.jobs.entries()) {
          try {
            const buffer = page.buffer ?? readFileSync(page.path)
            if (buffer.length > 30 * 1024 * 1024) throw new Error('单个文件超过 30 MB')
            const extracted = await extractResume({
              name: page.name,
              buffer,
              workDir: join(itemWorkDir, `part-${pageIndex + 1}`),
              config: { ...limits, poppler: limits.poppler },
            })
            chunks.push(extracted.text)
            pages.push(...(extracted.pages ?? []))
            engines.add(extracted.engine)
            if (extracted.needsReview === true) needsReview = true
            if (extracted.ocrFallbackLanguage === true) ocrFallbackLanguage = true
            format = format === '' ? extracted.format : format
            for (const warning of extracted.warnings ?? []) {
              if (!warnings.includes(warning)) warnings.push(warning)
            }
          } catch (error) {
            if (group.jobs.length === 1) throw error
            failure = { name: page.name, error: String(error?.message ?? error) }
            warnings.push(`${page.name}：${String(error?.message ?? error)}`)
          }
        }
        if (chunks.length === 0) throw new Error(failure?.error ?? '没有提取到任何文本')
        const joined = chunks.join('\n\n')
        const suggestion = suggestFields(group.label, joined)
        const hash = textHash(joined)
        const earlier = items.find(entry => entry.ok === true && entry.textHash === hash)
        if (joined.length < 120) warnings.push('提取到的文本过少（不足 120 字），请核对是否识别成功')
        if (joined.length > LIMITS.profileText) warnings.push(`文本超过 ${LIMITS.profileText} 字，入库时会截断`)
        const lowQuality = ocrFallbackLanguage || joined.length < 120
        const multiCandidate = chunks.length === 1 && (joined.match(/^[ \t]*\d{2,4}[_\-—][^\n：:]{2,24}[：:]/gm) ?? []).length >= 3
        const engine = engines.size === 1 ? [...engines][0] : 'mixed'
        items.push({
          key: `item-${index + 1}`,
          name: group.jobs.length > 1 ? `${group.label}（${group.jobs.length} 个文件）` : group.jobs[0].name,
          files: group.jobs.map(entry => entry.name),
          path: group.jobs[0].path ?? '',
          ok: true,
          format,
          engine,
          chars: joined.length,
          needsReview: needsReview || lowQuality,
          lowQuality,
          multiCandidate,
          warnings,
          pages,
          preview: joined.slice(0, 600),
          suggestion,
          text: joined,
          textHash: hash,
          duplicateOf: knownHashes.get(hash) ?? earlier?.name ?? '',
        })
        report({ extracted: items.length })
        publishItems()
      } catch (error) {
        if (error?.cancelled === true) throw error
        items.push({
          key: `item-${index + 1}`,
          name: group.jobs.length > 1 ? `${group.label}（${group.jobs.length} 个文件）` : group.jobs[0].name,
          files: group.jobs.map(entry => entry.name),
          path: group.jobs[0].path ?? '',
          ok: false,
          error: String(error?.message ?? error),
        })
        cleanupWorkDir(itemWorkDir)
        report({ extracted: items.length })
        publishItems()
      }
    }
    checkCancelled()
    const scan = { scanId, createdAt: Date.now(), workDir, items }
    // Ask the model to read the resumes. The regex suggestion stays as the
    // fallback for every field the model does not return.
    let agentMeta = null
    const agent = this.agentExtractor
    if (agent !== undefined && this.importConfig.useAgent !== false) {
      const readable = items.filter(item => item.ok === true)
      if (readable.length > 0) {
        report({ phase: 'agent', agentTotal: readable.length, agentDone: 0 })
        const outcome = await agent.extract(readable, {
          signal,
          onProgress: (progress) => report({ agentDone: progress.done, agentTotal: progress.total }),
        })
        agentMeta = {
          available: true,
          provider: outcome.provider ?? '',
          model: outcome.model ?? '',
          used: outcome.items.size,
          errors: outcome.errors.slice(0, 8),
        }
        for (const item of items) {
          const found = outcome.items.get(item.key)
          if (found === undefined) continue
          const merged = mergeAgentFields(item.suggestion, found, item.name)
          item.suggestion = merged.suggestion
          item.agent = { used: true, confidence: found.confidence ?? null }
          item.extractionSource = 'agent'
          if (found.multiPerson === true && item.multiCandidate !== true) {
            item.multiCandidate = true
            item.warnings.push('模型判断这份文本包含多位候选人；建议拆分或逐份导入')
          }
          if (merged.notes.length > 0) item.warnings.push(`字段由模型解析，请核对：${merged.notes.join('；')}`)
        }
        if (outcome.items.size === 0) {
          agentMeta.available = true
          agentMeta.failed = true
          for (const item of items) {
            if (item.ok !== true) continue
            item.warnings.push(`智能体解析失败，已退回本地规则：${outcome.errors[0] ?? '无返回'}`)
          }
        }
      }
    } else if (agent === undefined) {
      agentMeta = { available: false, reason: '没有 llm 服务' }
    } else {
      agentMeta = { available: false, reason: '配置中关闭了智能体解析' }
    }
    checkCancelled()
    for (const item of items) {
      if (item.ok !== true) continue
      if (item.extractionSource === undefined) item.extractionSource = 'rule'
    }
    scan.agent = agentMeta
    this.scans.set(scanId, scan)
    this.record('resume.scan', `${items.filter(item => item.ok).length}/${items.length} 份`)
    this.persist()
    return {
      ok: true,
      scanId,
      workDir,
      items: items.map(({ text: _text, ...rest }) => rest),
      skipped,
      agent: agentMeta,
      summary: {
        total: items.length,
        ready: items.filter(item => item.ok).length,
        failed: items.filter(item => !item.ok).length,
        ocr: items.filter(item => item.ok && item.needsReview).length,
        duplicate: items.filter(item => item.ok && item.duplicateOf !== '').length,
        multiCandidate: items.filter(item => item.ok && item.multiCandidate === true).length,
        agentParsed: items.filter(item => item.ok && item.extractionSource === 'agent').length,
        skipped: skipped.length,
      },
      limits: { maxFiles: limits.maxFiles, maxBytes: limits.maxBytes, maxFileBytes: 30 * 1024 * 1024 },
    }
  }

  scanForTool(scanId) {
    return this.scans.get(scanId)
  }

  /** Create candidates from a scan; returns the created ids. */
  commitScan(input = {}) {
    const scan = this.scans.get(input.scanId)
    if (scan === undefined) throw new Error('扫描结果已过期，请重新选择文件')
    const selected = new Set(array(input.keys, 200).map(key => text(key, 40)))
    const overrides = input.overrides !== null && typeof input.overrides === 'object' ? input.overrides : {}
    const allowMulti = input.allowMultiCandidate === true
    const created = []
    const skippedDuplicate = []
    let index = 0
    const existingHashes = new Set()
    for (const candidate of Object.values(this.db.candidates)) {
      if (candidate.extraction?.textHash) existingHashes.add(candidate.extraction.textHash)
    }
    for (const item of scan.items) {
      if (item.ok !== true) continue
      if (selected.size > 0 && !selected.has(item.key)) continue
      if (item.multiCandidate === true && !allowMulti) continue
      const hash = item.textHash ?? textHash(item.text)
      if (existingHashes.has(hash)) {
        skippedDuplicate.push(item.name)
        continue
      }
      existingHashes.add(hash)
      const override = overrides[item.key] ?? {}
      const suggestion = item.suggestion ?? {}
      const context = this.resolveTargetContext(input)
      const evidence = suggestion.evidence ?? {}
      index += 1
      const aliasSeed = text(override.alias, LIMITS.alias) || suggestion.alias || ''
      const candidate = {
        ...normalizeCandidate({
          alias: aliasSeed === '' ? `候选人 ${Object.keys(this.db.candidates).length + 1}` : aliasSeed,
          realName: text(override.realName, LIMITS.realName) || suggestion.realName || '',
          major: text(override.major, LIMITS.major) || suggestion.major || '',
          degree: text(override.degree, LIMITS.degree) || suggestion.degree || '',
          school: text(override.school, LIMITS.school) || suggestion.school || '',
          stage: text(suggestion.stage, LIMITS.stage) || '',
          direction: text(override.direction, LIMITS.direction) || suggestion.direction || '',
          profileText: item.text,
          publications: Array.isArray(evidence.publications) ? evidence.publications : [],
          projects: Array.isArray(evidence.projects) ? evidence.projects : [],
          engineering: Array.isArray(evidence.engineering) ? evidence.engineering : [],
          theory: Array.isArray(evidence.theory) ? evidence.theory : [],
          roles: Array.isArray(evidence.roles) ? evidence.roles : [],
          skills: Array.isArray(evidence.skills) ? evidence.skills : [],
          awards: Array.isArray(evidence.awards) ? evidence.awards : [],
          tags: ['批量导入'],
          notes: `来源文件：${(item.files ?? [item.name]).join('、')}（${item.engine}）`,
        }),
        id: id('cand'),
        source: 'import',
        sourceFile: item.name,
        sourceFiles: item.files ?? [item.name],
        extraction: {
          format: item.format,
          engine: item.engine,
          chars: item.chars,
          needsReview: item.needsReview === true,
          textHash: hash,
          fieldSource: item.extractionSource ?? 'rule',
          fieldConfidence: typeof suggestion.confidence === 'number' ? suggestion.confidence : null,
          warnings: item.warnings ?? [],
        },
        createdAt: nowIso(),
        updatedAt: nowIso(),
        assessments: {},
        decisionOverride: null,
        taskId: context.taskId,
        batchId: context.batchId,
      }
      candidate.assessments = autoAssessCandidate(this.db, candidate)
      this.db.candidates[candidate.id] = candidate
      created.push({ candidateId: candidate.id, alias: candidate.alias, name: item.name })
    }
    if (created.length === 0) throw new Error(skippedDuplicate.length > 0 ? '选中的简历已在本地库中（内容相同），未重复导入' : '没有选中任何可导入的简历')
    this.record('resume.commit', `导入 ${created.length} 份${skippedDuplicate.length > 0 ? `，跳过重复 ${skippedDuplicate.length} 份` : ''}`)
    this.persist()
    this.scans.delete(scan.scanId)
    cleanupWorkDir(scan.workDir)
    return { ok: true, created, skippedDuplicate, snapshot: this.snapshot() }
  }

  discardScan(scanId) {
    const scan = this.scans.get(scanId)
    if (scan === undefined) return { ok: true, discarded: false }
    this.scans.delete(scanId)
    cleanupWorkDir(scan.workDir)
    return { ok: true, discarded: true }
  }

  /**
   * Recompute the import-time field suggestions from what is stored locally
   * (resume text + source file name). Used to repair records imported by an
   * older extractor; returns a diff so the caller decides what to apply.
   */
  previewFieldRefresh() {
    const fields = ['major', 'degree', 'school', 'direction']
    const rows = []
    const suspects = []
    for (const candidate of Object.values(this.db.candidates)) {
      if (candidate.source !== 'import') continue
      if (typeof candidate.profileText !== 'string' || candidate.profileText.trim() === '') continue
      // A file that lists several people is not one resume: any field derived
      // from it is meaningless, so it is reported for removal instead.
      if (looksLikeMultiPersonDoc(candidate.profileText).multi) {
        suspects.push({
          candidateId: candidate.id,
          alias: candidate.alias,
          sourceFile: candidate.sourceFile ?? '',
          reason: 'multi-person-document',
        })
        continue
      }
      const suggestion = suggestFields(candidate.sourceFile ?? '', candidate.profileText)
      const changes = {}
      for (const field of fields) {
        const next = text(suggestion[field], 120)
        const current = text(candidate[field], 120)
        if (next !== '' && next !== current) changes[field] = { from: current, to: next }
      }
      if (Object.keys(changes).length === 0) continue
      rows.push({
        candidateId: candidate.id,
        alias: candidate.alias,
        sourceFile: candidate.sourceFile ?? '',
        changes,
      })
    }
    return { ok: true, total: rows.length, candidates: rows, suspects }
  }

  /**
   * Re-read stored resumes with the model and correct what differs.
   *
   * Used for records imported before the model-based extractor existed: the
   * rules cannot tell "应用数学博士" from a stray "材料" in the body, the model can.
   * Only fields the model actually returned are written; structured evidence is
   * filled when it was empty before.
   */
  async agentRefreshFields(options = {}) {
    const agent = this.agentExtractor
    if (agent === undefined) return { ok: false, error: '没有可用的模型服务' }
    const state = agent.available()
    if (state.available !== true) return { ok: false, error: state.reason ?? '模型不可用' }
    const items = []
    for (const candidate of Object.values(this.db.candidates)) {
      if (candidate.source !== 'import') continue
      if (typeof candidate.profileText !== 'string' || candidate.profileText.trim() === '') continue
      if (looksLikeMultiPersonDoc(candidate.profileText).multi) continue
      items.push({ key: candidate.id, name: candidate.sourceFile ?? candidate.alias, text: candidate.profileText })
    }
    if (items.length === 0) return { ok: true, applied: 0, details: [], provider: state.provider, model: state.model }
    const outcome = await agent.extract(items, {})
    if (outcome.items.size === 0) {
      return { ok: false, error: outcome.errors[0] ?? '模型没有返回结果', errors: outcome.errors }
    }
    const plan = []
    for (const item of items) {
      const found = outcome.items.get(item.key)
      if (found === undefined) continue
      const candidate = this.db.candidates[item.key]
      if (candidate === undefined) continue
      const changes = {}
      // A rule-parsed name is often a section heading ("教育经历") or a placeholder
      // ("应试者"); the model reads the real name from the page. Names a previous
      // model pass produced are left alone, so a manual fix is not undone.
      const ruleNamed = (candidate.extraction?.fieldSource ?? 'rule') !== 'agent'
      for (const field of ['major', 'degree', 'school', 'stage', 'direction', 'alias']) {
        const next = text(found[field], field === 'direction' ? 300 : 120)
        const current = text(candidate[field], 300)
        if (next === '' || next === current) continue
        if ((field === 'alias' || field === 'realName') && !ruleNamed) continue
        changes[field] = { from: current, to: next }
      }
      if (changes.alias !== undefined) changes.realName = { from: text(candidate.realName, 60), to: changes.alias.to }
      const emptyEvidence = (key) => Array.isArray(candidate[key]) && candidate[key].length === 0
      const evidence = {}
      for (const key of ['publications', 'projects', 'engineering', 'theory', 'roles', 'skills', 'awards']) {
        if (!Array.isArray(found[key]) || found[key].length === 0) continue
        if (!emptyEvidence(key)) continue
        evidence[key] = found[key]
      }
      if (Object.keys(changes).length === 0 && Object.keys(evidence).length === 0) continue
      plan.push({ candidateId: item.key, alias: candidate.alias, changes, evidence, confidence: found.confidence ?? null })
    }
    if (options.apply !== true) {
      return { ok: true, preview: true, total: plan.length, plan, provider: state.provider, model: state.model, errors: outcome.errors }
    }
    const applied = []
    for (const row of plan) {
      const candidate = this.db.candidates[row.candidateId]
      if (candidate === undefined) continue
      const parts = []
      for (const [field, change] of Object.entries(row.changes)) {
        candidate[field] = change.to
        parts.push(`${field}: ${change.from || '(空)'} → ${change.to}`)
      }
      for (const [key, value] of Object.entries(row.evidence)) {
        candidate[key] = value
        parts.push(`${key}: 补录 ${value.length} 条`)
      }
      candidate.updatedAt = nowIso()
      candidate.extraction = { ...(candidate.extraction ?? {}), fieldSource: 'agent', fieldConfidence: row.confidence }
      candidate.assessments = autoAssessCandidate(this.db, candidate)
      this.record('candidate.agentRefresh', `${candidate.alias} · ${parts.join('；')}`)
      applied.push({ alias: candidate.alias, detail: parts })
    }
    if (applied.length > 0) this.persist()
    return { ok: true, applied: applied.length, details: applied, provider: state.provider, model: state.model, errors: outcome.errors, snapshot: this.snapshot() }
  }

  applyFieldRefresh(selection) {
    const ids = Array.isArray(selection) && selection.length > 0
      ? new Set(selection.map(item => text(item, 80)))
      : null
    const preview = this.previewFieldRefresh()
    const targets = ids === null ? preview.candidates : preview.candidates.filter(row => ids.has(row.candidateId))
    const applied = []
    for (const row of targets) {
      const candidate = this.db.candidates[row.candidateId]
      if (candidate === undefined) continue
      const detail = []
      for (const [field, change] of Object.entries(row.changes)) {
        candidate[field] = change.to
        detail.push(`${field}: ${change.from || '(空)'} → ${change.to}`)
      }
      candidate.updatedAt = nowIso()
      applied.push({ alias: candidate.alias, detail })
    }
    if (applied.length === 0) return { ok: true, applied: 0, snapshot: this.snapshot() }
    for (const entry of applied) this.record('candidate.refreshFields', `${entry.alias} · ${entry.detail.join('；')}`)
    this.persist()
    return { ok: true, applied: applied.length, details: applied, snapshot: this.snapshot() }
  }

  ensureSeedAssessments() {
    let changed = false
    for (const candidate of Object.values(this.db.candidates)) {
      const { candidate: next, changed: didChange } = ensureAssessments(this.db, candidate)
      if (didChange) {
        this.db.candidates[next.id] = next
        changed = true
      }
    }
    if (changed) this.persist()
  }

  ensureActiveTemplate() {
    const ids = Object.keys(this.db.templates)
    if (ids.length === 0) return
    if (!ids.includes(this.db.settings.activeTemplateId)) {
      this.db.settings.activeTemplateId = ids[0]
      this.persist()
    }
  }

  persist() {
    saveStore(this.dataDir, this.db)
  }

  record(action, detail) {
    audit(this.db, action, detail)
  }

  getSettings() {
    return { ...this.db.settings, showRealNames: this.config.allowRealNames === true && this.db.settings.showRealNames === true }
  }

  /** Task list with the counts the UI needs. */
  taskSummaries() {
    const templateName = (templateId) => {
      const record = this.db.templates[templateId]
      const definition = record?.versions.find(item => item.version === record.currentVersion)?.definition
      return definition?.name ?? '(模板已删除)'
    }
    return Object.values(this.db.tasks)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .map(task => {
        const batches = batchesOf(this.db, task.id).map(batch => ({
          ...batch,
          candidateCount: candidatesOfBatch(this.db, batch.id).length,
        }))
        return {
          ...task,
          templateName: templateName(task.templateId),
          templateVersion: this.db.templates[task.templateId]?.currentVersion ?? null,
          candidateCount: candidatesOfTask(this.db, task.id).length,
          batchCount: batches.length,
          batches,
          feedbackPending: feedbackOfTask(this.db, task.id).filter(item => item.appliedAt === '').length,
        }
      })
  }

  snapshot() {
    ensureTasks(this.db)
    const activeTask = this.db.tasks[this.db.settings.activeTaskId]
    // A task owns its template; settings.activeTemplateId stays as the global
    // "last used" default for newly created tasks.
    const activeTemplateId = activeTask?.templateId ?? this.db.settings.activeTemplateId
    const template = currentTemplate(this.db, activeTemplateId) ?? currentTemplate(this.db, Object.keys(this.db.templates)[0])
    // Only the active batch is ranked: batches are never mixed together.
    const activeBatch = this.db.batches[this.db.settings.activeBatchId]
    const pool = activeBatch !== undefined
      ? candidatesOfBatch(this.db, activeBatch.id)
      : (activeTask !== undefined ? candidatesOfTask(this.db, activeTask.id) : Object.values(this.db.candidates))
    const poolIds = pool.map(candidate => candidate.id)
    const results = template ? rankCandidates(this.db, template, { candidateIds: poolIds }) : []
    const resultById = new Map(results.map(result => [result.candidateId, result]))
    const decorate = (candidate) => {
      const clean = { ...candidate }
      if (!this.db.settings.showRealNames) delete clean.realName
      return {
        ...clean,
        result: resultById.get(candidate.id) ?? null,
        autoSummary: Object.fromEntries(Object.entries(candidate.assessments ?? {}).map(([skillId, value]) => [skillId, {
          level: value.level,
          source: value.source,
          confidence: value.confidence,
        }])),
      }
    }
    const candidates = pool.map(decorate)
    const allCandidates = Object.values(this.db.candidates).map(candidate => {
      const clean = { ...candidate }
      if (!this.db.settings.showRealNames) delete clean.realName
      return clean
    })
    const skills = Object.values(this.db.skills).map(record => {
      const current = record.versions.find(item => item.version === record.currentVersion)?.spec
      return {
        id: record.id,
        currentVersion: record.currentVersion,
        current: current ?? null,
        versions: record.versions.map(item => ({
          version: item.version,
          createdAt: item.createdAt,
          note: item.note,
          name: item.spec?.name ?? record.id,
          digest: `${item.spec?.name ?? record.id} · ${(item.spec?.scale ?? []).map(level => level.label).join('/')} · 方法 ${(item.spec?.method ?? []).length} 条 · 默认权重 ${item.spec?.defaultWeight ?? '—'}`,
        })),
      }
    })
    const templates = Object.values(this.db.templates).map(record => {
      const current = record.versions.find(item => item.version === record.currentVersion)?.definition
      return {
        id: record.id,
        currentVersion: record.currentVersion,
        current: current ?? null,
        versions: record.versions.map(item => {
          const definition = item.definition
          const total = (definition?.dimensions ?? []).reduce((sum, dimension) => sum + Number(dimension.weight || 0), 0) || 1
          return {
            version: item.version,
            createdAt: item.createdAt,
            note: item.note,
            name: definition?.name ?? record.id,
            dimensionCount: definition?.dimensions?.length ?? 0,
            weights: (definition?.dimensions ?? []).map(dimension => ({
              name: this.db.skills[dimension.skillId]?.versions
                .find(item2 => item2.version === this.db.skills[dimension.skillId].currentVersion)?.spec?.name ?? dimension.skillId,
              weight: dimension.weight,
              share: Math.round(Number(dimension.weight || 0) / total * 100),
            })),
          }
        }),
      }
    })
    const diagnostics = template ? biasDiagnostics(this.db, template) : null
    const ledgerVerify = verifyLedger(this.db, this.instance)
    return {
      ok: true,
      version: '1.0.0',
      generatedAt: nowIso(),
      dataDir: this.dataDir,
      settings: this.getSettings(),
      instance: {
        contributorId: this.instance.contributorId,
        createdAt: this.instance.createdAt,
      },
      activeTemplateId: template?.id ?? activeTemplateId,
      activeTaskId: activeTask?.id ?? '',
      activeBatchId: activeBatch?.id ?? '',
      tasks: this.taskSummaries(),
      activeTask: activeTask === undefined ? null : {
        id: activeTask.id,
        name: activeTask.name,
        description: activeTask.description,
        status: activeTask.status,
        templateId: activeTask.templateId,
        createdAt: activeTask.createdAt,
      },
      activeBatch: activeBatch === undefined ? null : { ...activeBatch },
      batches: activeTask === undefined ? [] : batchesOf(this.db, activeTask.id).map(batch => ({
        ...batch,
        candidateCount: candidatesOfBatch(this.db, batch.id).length,
      })),
      feedback: activeTask === undefined ? [] : feedbackOfTask(this.db, activeTask.id).slice(0, 60).map(item => ({
        ...item,
        candidateAlias: item.candidateId ? (this.db.candidates[item.candidateId]?.alias ?? '') : '',
        batchName: item.batchId ? (this.db.batches[item.batchId]?.name ?? '') : '',
      })),
      allCandidates,
      stats: dashboardStats(this.db),
      skills,
      templates,
      candidates,
      results,
      diagnostics,
      exchange: {
        verify: ledgerVerify,
        peers: peerSummary(this.db),
        ledger: (this.db.ledger ?? []).slice(-40),
        chainLength: (this.db.ledger ?? []).length,
      },
      runs: (this.db.runs ?? []).slice(-20).map(run => ({
        id: run.id,
        templateId: run.templateId,
        templateName: run.templateName,
        templateVersion: run.templateVersion,
        generatedAt: run.generatedAt,
        summary: run.summary,
      })),
      reportMarkdown: template ? buildReportMarkdown(this.db, template) : '',
      reportTemplate: template ? { id: template.id, name: template.name, version: template.version } : null,
      privacy: {
        network: false,
        networkScope: '仅与本机 DSH 服务通信（同源 127.0.0.1），无外部网络请求。',
        allowRealNames: this.config.allowRealNames === true,
        exchangeSchema: 'talent-screening-exchange/v1',
        kAnonymityFloor: 5,
        note: '所有人才数据只写入本机数据目录；面板只调用本机 DSH 服务的同源接口；交换包仅含匿名聚合，候选人数少于 5 时导出会附带提示。',
      },
      audit: (this.db.audit ?? []).slice(-20),
    }
  }


  // -------------------------------------------------- tasks / batches / feedback

  /** Switch the working context; both ids are validated before they are stored. */
  setActiveContext(patch = {}) {
    if (patch.taskId !== undefined && patch.taskId !== '') {
      const task = this.db.tasks[patch.taskId]
      if (task === undefined) throw new Error('招聘任务不存在')
      this.db.settings.activeTaskId = task.id
      const batches = batchesOf(this.db, task.id)
      if (patch.batchId === undefined) {
        this.db.settings.activeBatchId = batches[0]?.id ?? ''
      }
    }
    if (patch.batchId !== undefined) {
      if (patch.batchId === '') {
        this.db.settings.activeBatchId = ''
      } else {
        const batch = this.db.batches[patch.batchId]
        if (batch === undefined) throw new Error('批次不存在')
        this.db.settings.activeBatchId = batch.id
        this.db.settings.activeTaskId = batch.taskId
      }
    }
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  createTask(input = {}) {
    ensureTasks(this.db)
    const task = createTask(this.db, input)
    this.record('task.create', `${task.name} · 模板 ${this.db.templates[task.templateId]?.id ?? ''}`)
    this.persist()
    return { ok: true, taskId: task.id, snapshot: this.snapshot() }
  }

  updateTask(taskId, patch = {}) {
    const task = updateTask(this.db, taskId, patch)
    this.record('task.update', `${task.name}${patch.status === 'archived' ? '（归档）' : ''}`)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  deleteTask(taskId) {
    const task = this.db.tasks[taskId]
    deleteTask(this.db, taskId)
    this.record('task.delete', task?.name ?? taskId)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  createBatch(input = {}) {
    const batch = createBatch(this.db, { ...input, taskId: input.taskId ?? this.db.settings.activeTaskId })
    this.db.settings.activeTaskId = batch.taskId
    this.db.settings.activeBatchId = batch.id
    this.record('batch.create', `${batch.name}${batch.interviewFrom ? ` · ${batch.interviewFrom}~${batch.interviewTo}` : ''}`)
    this.persist()
    return { ok: true, batchId: batch.id, snapshot: this.snapshot() }
  }

  updateBatch(batchId, patch = {}) {
    const batch = updateBatch(this.db, batchId, patch)
    this.record('batch.update', batch.name)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  deleteBatch(batchId) {
    const batch = this.db.batches[batchId]
    deleteBatch(this.db, batchId)
    this.record('batch.delete', batch?.name ?? batchId)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  assignBatch(batchId, candidateIds = []) {
    const moved = assignCandidates(this.db, batchId, Array.isArray(candidateIds) ? candidateIds : [])
    const batch = this.db.batches[batchId]
    this.record('batch.assign', `${batch?.name ?? batchId} · ${moved.length} 人`)
    this.persist()
    return { ok: true, moved: moved.length, snapshot: this.snapshot() }
  }

  /** Interview-date based batch suggestion for candidates that have a date. */
  suggestBatches(gapDays = 2) {
    const taskId = this.db.settings.activeTaskId
    const pool = candidatesOfTask(this.db, taskId)
    const groups = suggestBatches(pool, { gapDays: Number(gapDays) || 2 })
    return {
      ok: true,
      groups: groups.map((group, index) => ({
        index: index + 1,
        from: group.from,
        to: group.to,
        candidateIds: group.candidateIds,
        aliases: group.candidateIds.map(id => this.db.candidates[id]?.alias ?? id),
      })),
      undated: pool.filter(candidate => !/^\d{4}-\d{2}-\d{2}$/.test(String(candidate.interviewDate ?? ''))).map(candidate => candidate.id),
    }
  }

  addFeedback(input = {}) {
    const entry = addFeedback(this.db, { ...input, taskId: input.taskId ?? this.db.settings.activeTaskId })
    this.record('feedback.add', `${entry.scope}/${entry.kind}: ${entry.message.slice(0, 60)}`)
    this.persist()
    return { ok: true, feedbackId: entry.id, snapshot: this.snapshot() }
  }

  deleteFeedback(feedbackId) {
    deleteFeedback(this.db, feedbackId)
    this.record('feedback.delete', feedbackId)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  /**
   * Ask the model to reweight the task template from the pending feedback.
   * Preview by default; `apply: true` writes a new template version.
   */
  async reviewFeedback(input = {}) {
    ensureTasks(this.db)
    const taskId = input.taskId ?? this.db.settings.activeTaskId
    const task = this.db.tasks[taskId]
    if (task === undefined) throw new Error('请先选择招聘任务')
    const brief = buildFeedbackBrief(this.db, taskId, Array.isArray(input.feedbackIds) ? input.feedbackIds : [])
    if (brief.pending.length === 0) return { ok: false, error: '没有待处理的反馈', snapshot: this.snapshot() }
    const templateRecord = this.db.templates[task.templateId]
    const definition = templateRecord?.versions.find(item => item.version === templateRecord.currentVersion)?.definition
    if (definition === undefined) throw new Error('该任务没有可用模板')

    const agent = this.agentExtractor
    const state = agent?.available?.() ?? { available: false, reason: '没有可用的模型服务' }
    let proposal = null
    let errors = []
    if (state.available === true) {
      try {
        const outcome = await agent.proposeTemplateAdjustment({
          definition,
          dimensions: brief.template.dimensions,
          feedback: brief.lines,
          taskName: brief.task.name,
        })
        proposal = outcome.proposal
        errors = outcome.errors ?? []
      } catch (error) {
        errors = [String(error?.message ?? error)]
      }
    } else {
      errors = [state.reason ?? '模型不可用']
    }
    if (proposal === null) return { ok: false, error: errors[0] ?? '模型没有给出建议', proposal: null, brief: brief.lines, snapshot: this.snapshot() }

    const merged = mergeProposal(this.db, definition, proposal)
    const changes = []
    const beforeMap = new Map((definition.dimensions ?? []).map(item => [item.skillId, Number(item.weight) || 0]))
    for (const dimension of merged.dimensions) {
      const before = beforeMap.get(dimension.skillId)
      const name = this.db.skills[dimension.skillId]?.versions.find(item => item.version === this.db.skills[dimension.skillId].currentVersion)?.spec?.name ?? dimension.skillId
      if (before === undefined) changes.push({ skillId: dimension.skillId, name, from: null, to: dimension.weight, kind: 'add' })
      else if (Math.abs(before - dimension.weight) > 1e-6) changes.push({ skillId: dimension.skillId, name, from: before, to: dimension.weight, kind: 'weight' })
    }
    for (const [skillId, weight] of beforeMap) {
      if (!merged.dimensions.some(item => item.skillId === skillId)) {
        const name = this.db.skills[skillId]?.versions.find(item => item.version === this.db.skills[skillId].currentVersion)?.spec?.name ?? skillId
        changes.push({ skillId, name, from: weight, to: null, kind: 'drop' })
      }
    }

    if (input.apply !== true) {
      return {
        ok: true,
        preview: true,
        taskId,
        templateId: task.templateId,
        templateName: definition.name,
        summary: String(proposal.summary ?? '').slice(0, 500),
        rationale: String(proposal.rationale ?? '').slice(0, 1500),
        changes,
        feedbackIds: brief.pending.map(item => item.id),
        brief: brief.lines,
        snapshot: this.snapshot(),
      }
    }

    const record = this.db.templates[task.templateId]
    const version = record.currentVersion + 1
    record.versions.push({
      version,
      createdAt: nowIso(),
      note: `按 ${brief.pending.length} 条反馈调整（智能体）`,
      definition: { ...merged, id: task.templateId, version },
    })
    record.currentVersion = version
    const appliedAt = nowIso()
    for (const item of brief.pending) {
      const stored = this.db.feedback[item.id]
      if (stored === undefined) continue
      stored.appliedAt = appliedAt
      stored.appliedTemplateVersion = version
      stored.adjustmentNote = String(proposal.summary ?? '').slice(0, 300)
    }
    this.record('feedback.apply', `${definition.name} v${version} · ${brief.pending.length} 条反馈 · ${changes.length} 项调整`)
    this.persist()
    return {
      ok: true,
      applied: true,
      taskId,
      templateId: task.templateId,
      version,
      changes,
      summary: String(proposal.summary ?? '').slice(0, 500),
      feedbackCount: brief.pending.length,
      snapshot: this.snapshot(),
    }
  }

  updateSettings(patch = {}) {
    if (patch.activeTemplateId !== undefined) {
      if (this.db.templates[patch.activeTemplateId] === undefined) throw new Error('模板不存在')
      this.db.settings.activeTemplateId = patch.activeTemplateId
    }
    if (patch.showRealNames !== undefined) {
      if (this.config.allowRealNames === true) this.db.settings.showRealNames = patch.showRealNames === true
    }
    if (patch.anonymizeByDefault !== undefined) this.db.settings.anonymizeByDefault = patch.anonymizeByDefault === true
    if (patch.activeTab !== undefined) this.db.settings.activeTab = text(patch.activeTab, 30)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  /** Candidates always land in a task + batch so rankings stay separated. */
  resolveTargetContext(input = {}) {
    ensureTasks(this.db)
    let taskId = text(input.taskId, 80) || this.db.settings.activeTaskId
    let batchId = text(input.batchId, 80) || this.db.settings.activeBatchId
    if (taskId === '' || this.db.tasks[taskId] === undefined) {
      const fallback = Object.values(this.db.tasks).find(item => item.status !== 'archived')
        ?? createTask(this.db, { name: '默认招聘任务', description: '首次导入时自动创建', templateId: this.db.settings.activeTemplateId })
      taskId = fallback.id
      this.db.settings.activeTaskId = taskId
    }
    if (batchId === '' || this.db.batches[batchId]?.taskId !== taskId) {
      const batch = batchesOf(this.db, taskId)[0]
        ?? createBatch(this.db, { taskId, name: '批次 1', note: '首次导入时自动创建' })
      batch.isDefault = batch.isDefault === true || batchesOf(this.db, taskId).length === 1
      batchId = batch.id
      this.db.settings.activeBatchId = batchId
    }
    return { taskId, batchId }
  }

  createCandidate(input) {
    const normalized = normalizeCandidate(input)
    const context = this.resolveTargetContext(input)
    if (normalized.alias === '') {
      normalized.alias = `候选人 ${Object.keys(this.db.candidates).length + 1}`
    }
    const candidate = {
      ...normalized,
      id: id('cand'),
      source: 'manual',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      assessments: {},
      decisionOverride: null,
      taskId: context.taskId,
      batchId: context.batchId,
    }
    candidate.assessments = autoAssessCandidate(this.db, candidate)
    this.db.candidates[candidate.id] = candidate
    this.record('candidate.create', candidate.alias)
    this.persist()
    return { ok: true, candidateId: candidate.id, snapshot: this.snapshot() }
  }

  updateCandidate(candidateId, patch = {}) {
    const existing = this.db.candidates[candidateId]
    if (existing === undefined) throw new Error('候选人不存在')
    const normalized = normalizeCandidate({ ...existing, ...patch })
    if (patch.realName === undefined || patch.realName === '') normalized.realName = existing.realName ?? ''
    const next = { ...existing, ...normalized, updatedAt: nowIso() }
    if (patch.reassess === true) {
      next.assessments = autoAssessCandidate(this.db, next)
    }
    this.db.candidates[candidateId] = next
    this.record('candidate.update', next.alias)
    this.persist()
    return { ok: true, candidateId, snapshot: this.snapshot() }
  }

  deleteCandidate(candidateId) {
    const existing = this.db.candidates[candidateId]
    if (existing === undefined) throw new Error('候选人不存在')
    delete this.db.candidates[candidateId]
    this.record('candidate.delete', existing.alias)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  autoAssess(candidateId) {
    const candidate = this.db.candidates[candidateId]
    if (candidate === undefined) throw new Error('候选人不存在')
    const assessments = autoAssessCandidate(this.db, candidate)
    const merged = { ...candidate.assessments }
    for (const [skillId, value] of Object.entries(assessments)) {
      if (merged[skillId]?.source === 'manual') continue
      merged[skillId] = value
    }
    this.db.candidates[candidateId] = { ...candidate, assessments: merged, updatedAt: nowIso() }
    this.record('candidate.autoAssess', candidate.alias)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  setAssessment(candidateId, skillId, level, options = {}) {
    const candidate = this.db.candidates[candidateId]
    if (candidate === undefined) throw new Error('候选人不存在')
    const skill = currentSkill(this.db, skillId)
    if (skill === undefined) throw new Error('维度技能不存在')
    if (!skill.scale.some(item => item.value === level)) throw new Error('等级不在该维度的分级标准内')
    const evidence = array(options.evidence, 20).map(item => text(item, LIMITS.evidence)).filter(Boolean)
    candidate.assessments = {
      ...(candidate.assessments ?? {}),
      [skillId]: {
        level,
        evidence,
        confidence: ['high', 'medium', 'low'].includes(options.confidence) ? options.confidence : 'medium',
        rationale: text(options.rationale, 800) || '人工校正',
        method: 'manual',
        annotation: text(options.annotation, 200),
        source: 'manual',
        updatedAt: nowIso(),
      },
    }
    candidate.updatedAt = nowIso()
    this.record('assessment.set', `${candidate.alias} · ${skill.name} · ${level}`)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  createTemplate(input) {
    const normalized = normalizeTemplate(input)
    if (normalized.name === '') throw new Error('模板名称不能为空')
    if (normalized.dimensions.length === 0) throw new Error('模板至少需要一个考察维度')
    for (const dimension of normalized.dimensions) {
      if (this.db.skills[dimension.skillId] === undefined) throw new Error(`维度不存在：${dimension.skillId}`)
    }
    if (normalized.decision.backup > normalized.decision.recommend) throw new Error('备选线不能高于推荐线')
    const templateId = id('tpl')
    const now = nowIso()
    const definition = { ...normalized, version: 1, id: templateId }
    this.db.templates[templateId] = {
      id: templateId,
      currentVersion: 1,
      versions: [{ version: 1, createdAt: now, note: text(input?.note, LIMITS.note) || '新建模板', definition }],
    }
    this.db.settings.activeTemplateId = templateId
    this.record('template.create', normalized.name)
    this.persist()
    return { ok: true, templateId, snapshot: this.snapshot() }
  }

  updateTemplate(templateId, patch = {}) {
    const record = this.db.templates[templateId]
    if (record === undefined) throw new Error('模板不存在')
    const current = record.versions.find(item => item.version === record.currentVersion)?.definition
    const normalized = normalizeTemplate({ ...current, ...patch })
    if (normalized.name === '') throw new Error('模板名称不能为空')
    if (normalized.dimensions.length === 0) throw new Error('模板至少需要一个考察维度')
    for (const dimension of normalized.dimensions) {
      if (this.db.skills[dimension.skillId] === undefined) throw new Error(`维度不存在：${dimension.skillId}`)
    }
    if (normalized.decision.backup > normalized.decision.recommend) throw new Error('备选线不能高于推荐线')
    const version = record.currentVersion + 1
    const definition = { ...normalized, id: templateId, version }
    record.versions.push({
      version,
      createdAt: nowIso(),
      note: text(patch.note, LIMITS.note) || `更新到 v${version}`,
      definition,
    })
    record.currentVersion = version
    this.record('template.update', `${normalized.name} v${version}`)
    this.persist()
    return { ok: true, templateId, version, snapshot: this.snapshot() }
  }

  restoreTemplate(templateId, version) {
    const record = this.db.templates[templateId]
    if (record === undefined) throw new Error('模板不存在')
    const source = record.versions.find(item => item.version === Number(version))
    if (source === undefined) throw new Error('模板版本不存在')
    const nextVersion = record.currentVersion + 1
    const definition = { ...source.definition, id: templateId, version: nextVersion }
    record.versions.push({
      version: nextVersion,
      createdAt: nowIso(),
      note: `回溯到 v${version}`,
      definition,
    })
    record.currentVersion = nextVersion
    this.record('template.restore', `${definition.name} v${version} → v${nextVersion}`)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  deleteTemplate(templateId) {
    if (Object.keys(this.db.templates).length <= 1) throw new Error('至少保留一个模板')
    if (this.db.templates[templateId] === undefined) throw new Error('模板不存在')
    const name = currentTemplate(this.db, templateId)?.name ?? templateId
    delete this.db.templates[templateId]
    if (this.db.settings.activeTemplateId === templateId) {
      this.db.settings.activeTemplateId = Object.keys(this.db.templates)[0]
    }
    this.record('template.delete', name)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  saveSkillVersion(skillId, patch = {}) {
    const record = this.db.skills[skillId]
    if (record === undefined) throw new Error('维度技能不存在')
    const current = record.versions.find(item => item.version === record.currentVersion)?.spec
    const nextSpec = {
      ...current,
      ...patch,
      id: skillId,
      version: record.currentVersion + 1,
    }
    if (Array.isArray(patch.scale)) {
      if (patch.scale.length < 2) throw new Error('分级至少需要两档')
      nextSpec.scale = patch.scale.map((item, index) => ({
        value: text(item?.value, 30) || `level-${index + 1}`,
        label: text(item?.label, 20),
        score: number(item?.score, 0, 0, 1),
        definition: text(item?.definition, 300),
      }))
    }
    if (nextSpec.name === undefined || text(nextSpec.name, 40) === '') throw new Error('维度名称不能为空')
    const version = record.currentVersion + 1
    record.versions.push({
      version,
      createdAt: nowIso(),
      note: text(patch.note, LIMITS.note) || `更新到 v${version}`,
      spec: { ...nextSpec, version },
    })
    record.currentVersion = version
    this.record('skill.update', `${nextSpec.name} v${version}`)
    this.persist()
    this.onSkillsChanged()
    return { ok: true, skillId, version, snapshot: this.snapshot() }
  }

  restoreSkillVersion(skillId, version) {
    const record = this.db.skills[skillId]
    if (record === undefined) throw new Error('维度技能不存在')
    const source = record.versions.find(item => item.version === Number(version))
    if (source === undefined) throw new Error('维度版本不存在')
    const nextVersion = record.currentVersion + 1
    record.versions.push({
      version: nextVersion,
      createdAt: nowIso(),
      note: `回溯到 v${version}`,
      spec: { ...source.spec, version: nextVersion },
    })
    record.currentVersion = nextVersion
    this.record('skill.restore', `${source.spec?.name ?? skillId} v${version} → v${nextVersion}`)
    this.persist()
    this.onSkillsChanged()
    return { ok: true, snapshot: this.snapshot() }
  }

  copySkillAsNew(skillId, input = {}) {
    const source = currentSkill(this.db, skillId)
    if (source === undefined) throw new Error('维度技能不存在')
    const nextId = id('skill')
    const version = 1
    const spec = {
      ...source,
      ...input,
      id: nextId,
      key: text(input?.key, 60) || `talent-dimension-${nextId}`,
      name: text(input?.name, 40) || `${source.name}（自定义）`,
      shortName: text(input?.shortName, 20) || source.shortName,
      version,
      description: text(input?.description, 1000) || source.description,
    }
    this.db.skills[nextId] = {
      id: nextId,
      currentVersion: version,
      versions: [{ version, createdAt: nowIso(), note: '从现有维度复制', spec }],
    }
    this.record('skill.copy', spec.name)
    this.persist()
    this.onSkillsChanged()
    return { ok: true, skillId: nextId, snapshot: this.snapshot() }
  }

  createRun(templateId) {
    const run = buildRunSnapshot(this.db, templateId ?? this.db.settings.activeTemplateId)
    this.db.runs = [...(this.db.runs ?? []), run].slice(-30)
    this.record('run.create', `${run.templateName} v${run.templateVersion}`)
    this.persist()
    return { ok: true, run, snapshot: this.snapshot() }
  }

  deleteRun(runId) {
    this.db.runs = (this.db.runs ?? []).filter(run => run.id !== runId)
    this.record('run.delete', runId)
    this.persist()
    return { ok: true, snapshot: this.snapshot() }
  }

  kAnonymityWarning() {
    const count = Object.keys(this.db.candidates).length
    if (count >= 5) return null
    return `当前本地候选人只有 ${count} 人，均值与等级占比接近个人画像；建议累计到 5 人以上再交换，或确认对方不会反推个人。`
  }

  previewPack() {
    return buildExchangePack(this.db, this.instance)
  }

  exportPack() {
    const pack = buildExchangePack(this.db, this.instance)
    const entry = appendLedger(this.db, this.instance, 'contribution', pack, '导出匿名交换包')
    this.record('exchange.export', `#${entry.index}`)
    this.persist()
    return { ok: true, pack, ledgerIndex: entry.index, warning: this.kAnonymityWarning(), snapshot: this.snapshot() }
  }

  importPack(pack) {
    if (pack === null || typeof pack !== 'object') throw new Error('交换包必须是 JSON 对象')
    const result = mergePack(this.db, this.instance, pack)
    if (!result.ok) {
      const error = new Error(`交换包未通过校验：${result.errors.join('；')}`)
      error.details = result.errors
      throw error
    }
    this.record('exchange.import', result.duplicate ? '重复包' : result.selfEcho ? '本机导出回流' : `新增 ${result.peerCount} 个来源`)
    this.persist()
    return { ...result, snapshot: this.snapshot() }
  }

  verifyChain() {
    return verifyLedger(this.db, this.instance)
  }

  importDemoPeerPack() {
    const pack = buildDemoPeerPack(this.db)
    const result = this.importPack(pack)
    return { ...result, demo: true, pack }
  }

  applyWeightSuggestion(templateId, weights, note = '应用匿名交换建议') {
    const record = this.db.templates[templateId]
    if (record === undefined) throw new Error('模板不存在')
    const current = record.versions.find(item => item.version === record.currentVersion)?.definition
    const map = new Map(array(weights, 40).map(item => [text(item?.skillId, 80), number(item?.weight, 0, 0, 100)]))
    const dimensions = current.dimensions.map(dimension => ({
      ...dimension,
      weight: map.has(dimension.skillId) ? map.get(dimension.skillId) : dimension.weight,
    }))
    return this.updateTemplate(templateId, { dimensions, note })
  }

  validatePackForPreview(pack) {
    const validation = validatePack(pack)
    const integrity = verifyPackIntegrity(pack)
    return { validation, integrity }
  }

  resetAll() {
    for (const scanId of [...this.scans.keys()]) this.discardScan(scanId)
    this.clearScanWorkspaces()
    this.db = resetDemoStore(this.dataDir, this.instance)
    this.ensureSeedAssessments()
    this.ensureActiveTemplate()
    return { ok: true, snapshot: this.snapshot() }
  }

  rotateIdentity() {
    this.instance = rotateInstance(this.dataDir)
    this.record('identity.rotate', this.instance.contributorId)
    this.persist()
    return { ok: true, instance: { contributorId: this.instance.contributorId, createdAt: this.instance.createdAt }, snapshot: this.snapshot() }
  }

  exportBackup() {
    return {
      ok: true,
      schema: 'talent-workbench-backup/v1',
      exportedAt: nowIso(),
      warning: '此备份包含本地人才信息（姓名/简历/评估），只应保存在本机，不要上传或发送到任何交换通道。',
      db: this.db,
    }
  }

  importBackup(backup, confirm) {
    if (confirm !== 'REPLACE') throw new Error('导入完整备份需要显式确认 REPLACE')
    if (backup?.schema !== 'talent-workbench-backup/v1' || backup?.db === null || typeof backup.db !== 'object') {
      throw new Error('不是有效的工作台备份')
    }
    this.db = backup.db
    if (!this.db.skills || !this.db.templates || !this.db.candidates) throw new Error('备份缺少必要数据表')
    this.record('backup.import', backup.exportedAt ?? '')
    this.ensureSeedAssessments()
    this.ensureActiveTemplate()
    this.persist()
    this.onSkillsChanged()
    return { ok: true, snapshot: this.snapshot() }
  }

  // ------------------------------------------------------- task-facing tools

  toolListTasks() {
    const tasks = this.taskSummaries()
    if (tasks.length === 0) {
      return { ok: true, tasks: [], summary: '还没有招聘任务。先用 create_task 建立任务（可指定初始模板），再上传简历并划分批次。' }
    }
    const lines = tasks.map(task => `- ${task.name}（${task.status === 'archived' ? '已归档' : '进行中'}）· 模板 ${task.templateName} v${task.templateVersion} · ${task.batchCount} 个批次 · ${task.candidateCount} 位候选人${task.feedbackPending > 0 ? ` · ${task.feedbackPending} 条待处理反馈` : ''}`)
    return { ok: true, tasks, summary: `共 ${tasks.length} 个招聘任务：\n${lines.join('\n')}` }
  }

  toolCreateTask(args = {}) {
    const task = createTask(this.db, {
      name: args.taskName ?? args.name,
      description: args.description,
      templateId: args.templateId,
    })
    this.record('task.create', task.name)
    this.persist()
    return {
      ok: true,
      taskId: task.id,
      summary: `已建立招聘任务「${task.name}」，初始模板为 ${this.db.templates[task.templateId]?.versions.find(v => v.version === this.db.templates[task.templateId].currentVersion)?.definition?.name ?? task.templateId}。接下来用 assign_batch 把简历按面试日期分批，或让用户在面板里划分。`,
    }
  }

  toolAssignBatch(args = {}) {
    let batchId = text(args.batchId, 80)
    let created = false
    if (batchId === '' || this.db.batches[batchId] === undefined) {
      const batch = createBatch(this.db, {
        taskId: args.taskId ?? this.db.settings.activeTaskId,
        name: args.batchName ?? '',
        interviewFrom: args.interviewDate ?? '',
        interviewTo: args.interviewDate ?? '',
        note: args.note ?? '',
      })
      batchId = batch.id
      created = true
    }
    const moved = Array.isArray(args.candidateIds) ? assignCandidates(this.db, batchId, args.candidateIds) : []
    const batch = this.db.batches[batchId]
    this.record('batch.assign', `${batch?.name ?? batchId} · ${moved.length} 人`)
    this.persist()
    return {
      ok: true,
      batchId,
      created,
      moved: moved.length,
      summary: `${created ? '已新建批次' : '已选定批次'}「${batch?.name ?? batchId}」${batch?.interviewFrom ? `（面试 ${batch.interviewFrom}${batch.interviewTo && batch.interviewTo !== batch.interviewFrom ? `~${batch.interviewTo}` : ''}）` : ''}，移动 ${moved.length} 位候选人。同一批次的简历只在本批次内比较。`,
    }
  }

  toolAddFeedback(args = {}) {
    const scope = args.candidateId !== undefined && args.candidateId !== '' ? 'candidate'
      : args.batchId !== undefined && args.batchId !== '' ? 'batch' : 'task'
    const entry = addFeedback(this.db, {
      taskId: args.taskId ?? this.db.settings.activeTaskId,
      scope,
      kind: args.kind ?? 'note',
      message: args.feedback ?? args.message ?? '',
      candidateId: args.candidateId,
      batchId: args.batchId,
    })
    this.record('feedback.add', `${entry.scope}/${entry.kind}: ${entry.message.slice(0, 60)}`)
    this.persist()
    return {
      ok: true,
      feedbackId: entry.id,
      summary: `已记录一条${scope === 'candidate' ? '候选人' : scope === 'batch' ? '批次' : '任务'}反馈（${entry.kind}）。攒够几条后可以调用 review_feedback 让模型据此调整模板维度与权重。`,
    }
  }

  async toolReviewFeedback(args = {}) {
    const result = await this.reviewFeedback({
      taskId: args.taskId ?? this.db.settings.activeTaskId,
      feedbackIds: Array.isArray(args.feedbackIds) ? args.feedbackIds : [],
      apply: args.apply === true,
    })
    if (result.ok !== true) {
      return { ok: false, summary: `没有可以应用的调整：${result.error ?? '未知原因'}` }
    }
    const changeLines = (result.changes ?? []).map(change => {
      if (change.kind === 'add') return `+ ${change.name}（新增，权重 ${change.to}）`
      if (change.kind === 'drop') return `- ${change.name}（移除）`
      return `  ${change.name}：${change.from} → ${change.to}`
    })
    if (result.preview === true) {
      return {
        ok: true,
        preview: { summary: result.summary, rationale: result.rationale, changes: result.changes },
        summary: `模型建议这样调整模板「${result.templateName}」：\n${changeLines.join('\n')}\n理由：${result.rationale}\n如要应用，请带 apply=true 再调用一次（会生成新的模板版本，可回溯）。`,
      }
    }
    return {
      ok: true,
      version: result.version,
      changes: result.changes,
      summary: `已按 ${result.feedbackCount} 条反馈生成模板新版本 v${result.version}：\n${changeLines.join('\n')}`,
    }
  }

  toolOverview() {
    const stats = dashboardStats(this.db)
    return {
      ok: true,
      summary: `本地候选 ${stats.candidates} 人，模板 ${stats.templates} 个，维度技能 ${stats.skills} 个，推荐 ${stats.recommended} 人，账本 ${stats.ledgerLength} 条。`,
      stats,
      activeTemplateId: this.db.settings.activeTemplateId,
      templates: templateSummaries(this.db).map(item => ({ id: item.id, name: item.name, family: item.family, version: item.currentVersion })),
      skills: skillSummaries(this.db).map(item => ({ id: item.id, name: item.name, key: item.key, version: item.currentVersion })),
      privacy: '本地存储；交换包仅匿名聚合；面板只访问本机服务的同源接口。',
    }
  }

  toolListCandidates(templateId) {
    const template = currentTemplate(this.db, templateId ?? this.db.settings.activeTemplateId)
    if (template === undefined) throw new Error('模板不存在')
    const results = rankCandidates(this.db, template)
    return {
      ok: true,
      template: { id: template.id, name: template.name, version: template.version },
      candidates: results.map(result => ({
        candidateId: result.candidateId,
        alias: result.alias,
        major: result.major,
        rank: result.rank,
        total: result.total,
        hits: result.hits,
        decision: decisionLabel(result.decision),
      })),
    }
  }

  toolEvaluate(candidateId, templateId) {
    const template = currentTemplate(this.db, templateId ?? this.db.settings.activeTemplateId)
    if (template === undefined) throw new Error('模板不存在')
    const results = rankCandidates(this.db, template)
    const result = candidateId
      ? results.find(item => item.candidateId === candidateId)
      : results[0]
    if (result === undefined) throw new Error('候选人不存在')
    return {
      ok: true,
      summary: `${result.alias}：加权分 ${result.total}，排名 ${result.rank}，结论 ${decisionLabel(result.decision)}，命中 ${result.hits}/${result.derivation.length} 个维度。`,
      template: { id: template.id, name: template.name, version: template.version },
      result,
    }
  }

  toolImportCandidate(candidate) {
    const result = this.createCandidate(candidate)
    const created = this.db.candidates[result.candidateId]
    return {
      ok: true,
      candidateId: result.candidateId,
      summary: `已本地录入 ${created.alias}（${created.major}），自动完成 ${Object.keys(created.assessments).length} 个维度初筛。`,
      candidate: {
        id: created.id,
        alias: created.alias,
        major: created.major,
        assessments: Object.fromEntries(Object.entries(created.assessments).map(([skillId, value]) => [skillId, { level: value.level, confidence: value.confidence, evidence: value.evidence }])),
      },
    }
  }

  async toolScanResumes(args = {}) {
    const result = await this.scanResumes({ path: args.path, recursive: args.recursive, files: args.files })
    const lines = result.items.map(item => item.ok
      ? `- [${item.key}] ${item.name}：${item.engine}，${item.chars} 字${item.needsReview ? '（OCR，需核对）' : ''}${item.duplicateOf ? `（与「${item.duplicateOf}」内容相同）` : ''}${item.pages.length > 0 ? `，页图 ${item.pages.join('、')}` : ''}`
      : `- [${item.key}] ${item.name}：失败（${item.error}）`)
    return {
      ok: true,
      scanId: result.scanId,
      items: result.items,
      summary: `已扫描 ${result.summary.total} 份：可导入 ${result.summary.ready}，失败 ${result.summary.failed}，OCR ${result.summary.ocr}，疑似重复 ${result.summary.duplicate}。\n${lines.join('\n')}\n用 import_resumes 提交（scanId=${result.scanId}）；OCR 结果的页图可用 read_image 复核。`,
    }
  }

  toolImportResumes(args = {}) {
    const result = this.commitScan({ scanId: args.scanId, keys: args.keys, overrides: args.overrides })
    const skipped = result.skippedDuplicate?.length ?? 0
    return {
      ok: true,
      created: result.created,
      summary: `已从扫描结果导入 ${result.created.length} 位候选人：${result.created.map(item => item.alias).join('、')}。${skipped > 0 ? `跳过重复 ${skipped} 份。` : ''}结构化证据为空，维度初筛主要依据简历文本，建议补录论文/项目后再评估。`,
    }
  }

  toolAgentRefreshFields(args = {}) {
    return this.agentRefreshFields({ apply: args?.apply === true }).then((result) => {
      if (result.ok !== true) {
        return { ok: false, summary: `智能体复核失败：${result.error ?? '未知原因'}` }
      }
      if (result.preview === true) {
        const lines = (result.plan ?? []).map(row => `- ${row.alias}：${Object.entries(row.changes).map(([field, change]) => `${field} ${change.from || '(空)'} → ${change.to}`).join('；') || '(仅补录结构化证据)'}`)
        return {
          ok: true,
          preview: result.plan,
          summary: result.total === 0
            ? `${result.provider}/${result.model} 复核后没有需要修改的字段。`
            : `${result.provider}/${result.model} 复核出 ${result.total} 位候选人字段不同：\n${lines.join('\n')}\n如要应用，请带 apply=true 再调用一次。`,
        }
      }
      return {
        ok: true,
        applied: result.applied,
        details: result.details,
        summary: result.applied === 0
          ? '没有需要修改的字段。'
          : `已用 ${result.provider}/${result.model} 修正 ${result.applied} 位候选人：${(result.details ?? []).map(item => item.alias).join('、')}。`,
      }
    })
  }

  toolRefreshFields(args = {}) {
    if (args?.apply !== true) {
      const preview = this.previewFieldRefresh()
      const lines = preview.candidates.map(row => `- ${row.alias}（${row.sourceFile}）：${Object.entries(row.changes).map(([field, change]) => `${field} ${change.from || '(空)'} → ${change.to}`).join('；')}`)
      return {
        ok: true,
        preview,
        summary: preview.total === 0
          ? '所有导入记录的字段与当前解析结果一致，无需修正。'
          : `${preview.total} 位候选人的字段与重新解析结果不同：\n${lines.join('\n')}\n如要应用，请带 apply=true 再调用一次。`,
      }
    }
    const result = this.applyFieldRefresh(args?.candidateIds)
    return {
      ok: true,
      applied: result.applied,
      details: result.details ?? [],
      summary: result.applied === 0
        ? '没有需要修正的字段。'
        : `已修正 ${result.applied} 位候选人的字段：${(result.details ?? []).map(item => item.alias).join('、')}。`,
    }
  }

  toolSetAssessment(candidateId, skillId, level, evidence = []) {
    this.setAssessment(candidateId, skillId, level, { evidence, confidence: 'medium', rationale: '智能体复核' })
    return { ok: true, summary: '已保存人工复核等级。' }
  }

  toolExportPack() {
    const result = this.exportPack()
    return {
      ok: true,
      summary: `已生成匿名交换包并追加到本地账本 #${result.ledgerIndex}；包含 ${result.pack.dimensions.length} 个维度、${result.pack.templates.length} 个模板，未包含任何人才个人信息。`,
      pack: result.pack,
    }
  }

  toolImportPack(pack) {
    const result = this.importPack(pack)
    return {
      ok: true,
      summary: result.duplicate
        ? '该交换包已存在，未重复导入。'
        : result.selfEcho
          ? '这是本机导出的交换包，不会作为同行证据回流。'
          : `已导入匿名交换包，现有 ${result.peerCount} 个同行知识包。`,
      suggestions: result.suggestions,
    }
  }
}
