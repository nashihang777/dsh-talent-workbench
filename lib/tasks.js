/**
 * Recruiting tasks, interview batches and reviewer feedback.
 *
 * A task is the unit a recruiter actually works in: one role, one template, and
 * one or more batches of resumes. Candidates always belong to exactly one batch
 * of one task, so two batches are never mixed into the same ranking.
 *
 * Everything here is pure bookkeeping over the local document store; the
 * template itself keeps its own version history.
 */
import { nowIso } from './engine.js'

export const DEFAULT_TASK_NAME = '默认招聘任务'
export const DEFAULT_BATCH_NAME = '历史导入'
export const TASK_STATUS = new Set(['active', 'archived'])
export const FEEDBACK_KINDS = new Set(['positive', 'negative', 'adjust', 'note'])
export const FEEDBACK_SCOPES = new Set(['candidate', 'batch', 'task'])

const str = (value, max = 200) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)

let counter = 0
function newId(prefix) {
  counter = (counter + 1) % 1000
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}${counter.toString(36)}`
}

/**
 * Create the collections when missing and adopt candidates imported by an older
 * release (they have no task yet) into a default task + batch, so nothing is
 * lost and nothing stays "unassigned" in the UI.
 */
export function ensureTasks(db) {
  if (db.tasks === null || typeof db.tasks !== 'object' || Array.isArray(db.tasks)) db.tasks = {}
  if (db.batches === null || typeof db.batches !== 'object' || Array.isArray(db.batches)) db.batches = {}
  if (db.feedback === null || typeof db.feedback !== 'object' || Array.isArray(db.feedback)) db.feedback = {}

  let migrated = 0
  const templateId = db.settings?.activeTemplateId ?? Object.keys(db.templates ?? {})[0] ?? ''
  const orphans = Object.values(db.candidates ?? {}).filter(candidate => {
    if (candidate === null || typeof candidate !== 'object') return false
    return typeof candidate.taskId !== 'string' || db.tasks[candidate.taskId] === undefined
      || typeof candidate.batchId !== 'string' || db.batches[candidate.batchId] === undefined
  })
  if (orphans.length > 0) {
    let task = Object.values(db.tasks).find(item => item.isDefault === true)
    if (task === undefined) {
      task = {
        id: newId('task'),
        name: DEFAULT_TASK_NAME,
        description: '升级到 1.7 时自动创建，用于收纳已有的候选人。可以改名或归档。',
        templateId,
        status: 'active',
        isDefault: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      db.tasks[task.id] = task
    }
    let batch = Object.values(db.batches)
      .filter(item => item.taskId === task.id)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]
      || Object.values(db.batches).find(item => item.taskId === task.id && item.isDefault === true)
    if (batch === undefined) {
      batch = {
        id: newId('batch'),
        taskId: task.id,
        name: DEFAULT_BATCH_NAME,
        interviewFrom: '',
        interviewTo: '',
        note: '升级到 1.7 之前导入的简历，面试时间未知。',
        isDefault: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      db.batches[batch.id] = batch
    }
    for (const candidate of orphans) {
      candidate.taskId = task.id
      candidate.batchId = batch.id
      candidate.updatedAt = nowIso()
      migrated += 1
    }
  }

  // Keep the "current task / batch" pointers usable.
  const tasks = Object.values(db.tasks).filter(item => item.status !== 'archived')
  if (db.settings.activeTaskId === undefined || db.tasks[db.settings.activeTaskId] === undefined) {
    db.settings.activeTaskId = tasks[0]?.id ?? ''
  }
  const activeTask = db.tasks[db.settings.activeTaskId]
  if (activeTask !== undefined) {
    const batches = batchesOf(db, activeTask.id)
    if (db.settings.activeBatchId === undefined || db.batches[db.settings.activeBatchId]?.taskId !== activeTask.id) {
      db.settings.activeBatchId = batches[0]?.id ?? ''
    }
    if (typeof activeTask.templateId !== 'string' || db.templates?.[activeTask.templateId] === undefined) {
      activeTask.templateId = templateId
    }
  } else {
    db.settings.activeBatchId = ''
  }
  return migrated
}

export function batchesOf(db, taskId) {
  return Object.values(db.batches)
    .filter(batch => batch.taskId === taskId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

export function candidatesOfBatch(db, batchId) {
  return Object.values(db.candidates).filter(candidate => candidate.batchId === batchId)
}

export function candidatesOfTask(db, taskId) {
  return Object.values(db.candidates).filter(candidate => candidate.taskId === taskId)
}

export function createTask(db, input = {}) {
  const name = str(input.name, 60)
  if (name === '') throw new Error('招聘任务名称不能为空')
  const templateId = str(input.templateId, 60) || db.settings?.activeTemplateId || Object.keys(db.templates)[0]
  if (db.templates[templateId] === undefined) throw new Error('初始模板不存在')
  const task = {
    id: newId('task'),
    name,
    description: str(input.description, 400),
    templateId,
    status: 'active',
    isDefault: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  db.tasks[task.id] = task
  db.settings.activeTaskId = task.id
  db.settings.activeBatchId = ''
  return task
}

export function updateTask(db, taskId, patch = {}) {
  const task = db.tasks[taskId]
  if (task === undefined) throw new Error('招聘任务不存在')
  if (patch.name !== undefined) {
    const name = str(patch.name, 60)
    if (name === '') throw new Error('招聘任务名称不能为空')
    task.name = name
  }
  if (patch.description !== undefined) task.description = str(patch.description, 400)
  if (patch.templateId !== undefined) {
    if (db.templates[patch.templateId] === undefined) throw new Error('模板不存在')
    task.templateId = patch.templateId
  }
  if (patch.status !== undefined) {
    if (!TASK_STATUS.has(patch.status)) throw new Error('任务状态不合法')
    task.status = patch.status
    if (patch.status === 'archived' && db.settings.activeTaskId === taskId) {
      const next = Object.values(db.tasks).find(item => item.status !== 'archived' && item.id !== taskId)
      db.settings.activeTaskId = next?.id ?? ''
      db.settings.activeBatchId = next === undefined ? '' : (batchesOf(db, next.id)[0]?.id ?? '')
    }
  }
  task.updatedAt = nowIso()
  return task
}

export function deleteTask(db, taskId) {
  const task = db.tasks[taskId]
  if (task === undefined) throw new Error('招聘任务不存在')
  const candidates = candidatesOfTask(db, taskId)
  if (candidates.length > 0) throw new Error(`任务下还有 ${candidates.length} 位候选人，请先归档而不是删除`)
  for (const batch of batchesOf(db, taskId)) delete db.batches[batch.id]
  for (const [feedbackId, item] of Object.entries(db.feedback)) {
    if (item.taskId === taskId) delete db.feedback[feedbackId]
  }
  delete db.tasks[taskId]
  if (db.settings.activeTaskId === taskId) {
    const next = Object.values(db.tasks).find(item => item.status !== 'archived')
    db.settings.activeTaskId = next?.id ?? ''
    db.settings.activeBatchId = next === undefined ? '' : (batchesOf(db, next.id)[0]?.id ?? '')
  }
  return { ok: true }
}

export function createBatch(db, input = {}) {
  const task = db.tasks[input.taskId]
  if (task === undefined) throw new Error('请先选择招聘任务')
  const name = str(input.name, 60) || `批次 ${batchesOf(db, task.id).length + 1}`
  const interviewFrom = str(input.interviewFrom, 20)
  const interviewTo = str(input.interviewTo, 20) || interviewFrom
  if (interviewFrom !== '' && interviewTo !== '' && interviewFrom > interviewTo) {
    throw new Error('面试开始日期不能晚于结束日期')
  }
  const batch = {
    id: newId('batch'),
    taskId: task.id,
    name,
    interviewFrom,
    interviewTo,
    note: str(input.note, 400),
    isDefault: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  db.batches[batch.id] = batch
  if (Array.isArray(input.candidateIds) && input.candidateIds.length > 0) {
    assignCandidates(db, batch.id, input.candidateIds)
  }
  if (db.settings.activeTaskId !== task.id || db.settings.activeBatchId === undefined || db.settings.activeBatchId === '') {
    db.settings.activeTaskId = task.id
    db.settings.activeBatchId = batch.id
  }
  return batch
}

export function updateBatch(db, batchId, patch = {}) {
  const batch = db.batches[batchId]
  if (batch === undefined) throw new Error('批次不存在')
  if (patch.name !== undefined) {
    const name = str(patch.name, 60)
    if (name === '') throw new Error('批次名称不能为空')
    batch.name = name
  }
  if (patch.interviewFrom !== undefined) batch.interviewFrom = str(patch.interviewFrom, 20)
  if (patch.interviewTo !== undefined) batch.interviewTo = str(patch.interviewTo, 20) || batch.interviewFrom
  if (patch.note !== undefined) batch.note = str(patch.note, 400)
  if (batch.interviewFrom !== '' && batch.interviewTo !== '' && batch.interviewFrom > batch.interviewTo) {
    throw new Error('面试开始日期不能晚于结束日期')
  }
  batch.updatedAt = nowIso()
  return batch
}

export function assignCandidates(db, batchId, candidateIds = []) {
  const batch = db.batches[batchId]
  if (batch === undefined) throw new Error('批次不存在')
  const moved = []
  for (const raw of candidateIds) {
    const candidate = db.candidates[str(raw, 80)]
    if (candidate === undefined) continue
    candidate.taskId = batch.taskId
    candidate.batchId = batch.id
    candidate.updatedAt = nowIso()
    moved.push(candidate.id)
  }
  return moved
}

export function deleteBatch(db, batchId) {
  const batch = db.batches[batchId]
  if (batch === undefined) throw new Error('批次不存在')
  const holding = candidatesOfBatch(db, batchId)
  if (holding.length > 0) throw new Error(`批次里还有 ${holding.length} 位候选人，请先移动到其他批次`)
  for (const [feedbackId, item] of Object.entries(db.feedback)) {
    if (item.batchId === batchId) delete db.feedback[feedbackId]
  }
  delete db.batches[batchId]
  if (db.settings.activeBatchId === batchId) {
    db.settings.activeBatchId = batchesOf(db, batch.taskId)[0]?.id ?? ''
  }
  return { ok: true }
}

/**
 * Suggest batch boundaries from interview dates.
 *
 * The rule the product documents: people interviewed on the same day (or within
 * a run of days that are no more than `gapDays` apart) belong together. It is
 * only a suggestion — the recruiter confirms or edits it in the UI.
 */
export function suggestBatches(candidates, { gapDays = 2 } = {}) {
  const dated = []
  for (const candidate of candidates) {
    const raw = candidate.interviewDate ?? candidate.interviewAt ?? ''
    const day = String(raw).slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) dated.push({ candidateId: candidate.id, day })
  }
  dated.sort((a, b) => a.day.localeCompare(b.day))
  const groups = []
  let current = null
  const dayNumber = (day) => Date.parse(`${day}T00:00:00Z`) / 86400000
  for (const entry of dated) {
    if (current === null) {
      current = { from: entry.day, to: entry.day, candidateIds: [entry.candidateId] }
      groups.push(current)
      continue
    }
    const distance = dayNumber(entry.day) - dayNumber(current.to)
    if (distance <= gapDays) {
      current.to = entry.day
      current.candidateIds.push(entry.candidateId)
    } else {
      current = { from: entry.day, to: entry.day, candidateIds: [entry.candidateId] }
      groups.push(current)
    }
  }
  return groups
}

export function addFeedback(db, input = {}) {
  const scope = str(input.scope, 20) || 'candidate'
  if (!FEEDBACK_SCOPES.has(scope)) throw new Error('反馈对象不合法')
  const kind = str(input.kind, 20) || 'note'
  if (!FEEDBACK_KINDS.has(kind)) throw new Error('反馈类型不合法')
  const taskId = str(input.taskId, 80)
  const task = db.tasks[taskId]
  if (task === undefined) throw new Error('请先选择招聘任务')
  const message = str(input.message, 1000)
  const candidateId = str(input.candidateId, 80)
  const batchId = str(input.batchId, 80)
  if (scope === 'candidate' && db.candidates[candidateId] === undefined) throw new Error('候选人不存在')
  if (scope === 'batch' && db.batches[batchId] === undefined) throw new Error('批次不存在')
  if (message === '' && kind === 'note') throw new Error('反馈内容不能为空')
  const entry = {
    id: newId('fb'),
    taskId,
    scope,
    kind,
    candidateId: scope === 'candidate' ? candidateId : '',
    batchId: scope === 'batch' ? batchId : (scope === 'candidate' ? (db.candidates[candidateId]?.batchId ?? '') : ''),
    message: message || (kind === 'positive' ? '认可' : kind === 'negative' ? '不认可' : ''),
    createdAt: nowIso(),
    appliedAt: '',
    appliedTemplateVersion: null,
    adjustmentNote: '',
  }
  db.feedback[entry.id] = entry
  return entry
}

export function deleteFeedback(db, feedbackId) {
  if (db.feedback[feedbackId] === undefined) throw new Error('反馈不存在')
  delete db.feedback[feedbackId]
  return { ok: true }
}

export function feedbackOfTask(db, taskId) {
  return Object.values(db.feedback)
    .filter(item => item.taskId === taskId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

/**
 * Turn pending feedback into a compact brief for the model: what the recruiter
 * liked, what they rejected, and how the current weights scored those people.
 */
export function buildFeedbackBrief(db, taskId, feedbackIds = []) {
  const wanted = new Set(feedbackIds)
  const items = feedbackOfTask(db, taskId).filter(item => wanted.size === 0 || wanted.has(item.id))
  const pending = items.filter(item => item.appliedAt === '')
  const template = db.templates[db.tasks[taskId]?.templateId]
  const current = template?.versions.find(item => item.version === template.currentVersion)?.definition ?? null
  const dimensions = (current?.dimensions ?? []).map(dimension => ({
    skillId: dimension.skillId,
    name: db.skills[dimension.skillId]?.versions.find(item => item.version === db.skills[dimension.skillId].currentVersion)?.spec?.name ?? dimension.skillId,
    weight: dimension.weight,
  }))
  const lines = pending.map((item, index) => {
    const who = item.scope === 'candidate'
      ? (db.candidates[item.candidateId]?.alias ?? item.candidateId)
      : item.scope === 'batch'
        ? (db.batches[item.batchId]?.name ?? item.batchId)
        : '整个任务'
    const kindLabel = { positive: '认可', negative: '不认可', adjust: '希望调整', note: '备注' }[item.kind] ?? item.kind
    return `${index + 1}. [${kindLabel}] ${who}：${item.message}`
  })
  return {
    task: { id: taskId, name: db.tasks[taskId]?.name ?? '' },
    template: current === null ? null : { id: current.id, name: current.name, version: current.version, dimensions },
    pending,
    lines,
  }
}

/**
 * Merge a model proposal into the current template definition.
 * The proposal only needs to name the weights it wants to change.
 */
export function mergeProposal(db, definition, proposal) {
  const weights = proposal?.weights ?? {}
  const drop = new Set(Array.isArray(proposal?.drop) ? proposal.drop.map(item => str(item, 80)) : [])
  const add = Array.isArray(proposal?.add) ? proposal.add : []
  const dimensions = []
  const seen = new Set()
  for (const dimension of definition.dimensions ?? []) {
    if (drop.has(dimension.skillId)) continue
    const next = weights[dimension.skillId]
    dimensions.push({
      ...dimension,
      weight: Number.isFinite(Number(next)) ? Math.max(0, Number(next)) : dimension.weight,
    })
    seen.add(dimension.skillId)
  }
  for (const entry of add) {
    const skillId = str(typeof entry === 'string' ? entry : entry?.skillId, 80)
    if (skillId === '' || seen.has(skillId) || db.skills[skillId] === undefined) continue
    const rawWeight = typeof entry === 'object' && entry !== null ? Number(entry.weight) : 0.1
    dimensions.push({
      skillId,
      weight: Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 0.1,
      gate: null,
    })
    seen.add(skillId)
  }
  if (dimensions.length === 0) throw new Error('调整后模板不能没有维度')
  const sum = dimensions.reduce((total, dimension) => total + dimension.weight, 0)
  if (sum <= 0) throw new Error('调整后权重之和必须大于 0')
  return { ...definition, dimensions }
}
