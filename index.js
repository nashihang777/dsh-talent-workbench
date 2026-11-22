/**
 * Host half of the talent workbench.
 *
 * - Local JSON database under the DSH profile data directory.
 * - Eight dimension skills registered into the DSH skill registry.
 * - One privacy-preserving HTTP API for the Client workbench panel.
 * - One agent tool (`talent_screening`) sharing the same service methods.
 */
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { TalentWorkbench } from './lib/workbench.js'
import { loadStore } from './lib/store.js'
import { currentSkill } from './lib/engine.js'
import { renderSkillMarkdown } from './lib/seed.js'
import { createAgentExtractor } from './lib/agent-extract.js'

export const inject = ['tools']

function resolveDataDir(config) {
  if (typeof config?.dataDir === 'string' && config.dataDir.trim() !== '' && isAbsolute(config.dataDir.trim())) {
    return config.dataDir.trim()
  }
  const profileDir = process.env.DSH_PROFILE_DIR
    || join(homedir(), '.dsh', 'profiles', process.env.DSH_PROFILE || 'desktop')
  return join(profileDir, 'talent-workbench')
}

function sameOrigin(request) {
  const origin = request.headers.origin
  if (typeof origin !== 'string' || origin === '') return true
  const host = request.headers.host
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** The local workbench API answers loopback callers only. */
function isLoopbackRequest(request) {
  const address = request.socket?.remoteAddress ?? ''
  return address === '' || address === '::1' || address === '127.0.0.1' || address.startsWith('127.')
    || address === '::ffff:127.0.0.1' || address.endsWith('::1')
}

function sendJson(response, status, body) {
  const text = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  response.end(text)
}

async function readJsonBody(request, limit = 64 * 1024 * 1024) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(text)
}

function mutation(type, payload, workbench) {
  switch (type) {
    case 'settings.update':
      return workbench.updateSettings(payload ?? {})
    case 'context.select':
      return workbench.setActiveContext(payload ?? {})
    case 'task.create':
      return workbench.createTask(payload ?? {})
    case 'task.update':
      return workbench.updateTask(payload?.taskId, payload ?? {})
    case 'task.delete':
      return workbench.deleteTask(payload?.taskId)
    case 'batch.create':
      return workbench.createBatch(payload ?? {})
    case 'batch.update':
      return workbench.updateBatch(payload?.batchId, payload ?? {})
    case 'batch.delete':
      return workbench.deleteBatch(payload?.batchId)
    case 'batch.assign':
      return workbench.assignBatch(payload?.batchId, payload?.candidateIds)
    case 'batch.suggest':
      return workbench.suggestBatches(payload?.gapDays)
    case 'feedback.add':
      return workbench.addFeedback(payload ?? {})
    case 'feedback.delete':
      return workbench.deleteFeedback(payload?.feedbackId)
    case 'feedback.review':
      return workbench.reviewFeedback(payload ?? {})
    case 'candidate.create':
      return workbench.createCandidate(payload ?? {})
    case 'candidate.update':
      return workbench.updateCandidate(payload?.candidateId, payload ?? {})
    case 'candidate.delete':
      return workbench.deleteCandidate(payload?.candidateId)
    case 'candidate.autoAssess':
      return workbench.autoAssess(payload?.candidateId)
    case 'resumes.scan':
      return workbench.scanResumes(payload ?? {})
    case 'resumes.startScan':
      return workbench.startScan(payload ?? {})
    case 'resumes.job':
      return workbench.scanJobStatus(payload?.jobId)
    case 'resumes.jobs':
      return workbench.scanJobsActive()
    case 'resumes.cancelJob':
      return workbench.cancelScanJob(payload?.jobId)
    case 'resumes.discardJob':
      return workbench.discardScanJob(payload?.jobId)
    case 'resumes.commit':
      return workbench.commitScan(payload ?? {})
    case 'resumes.discard':
      return workbench.discardScan(payload?.scanId)
    case 'candidates.previewRefresh':
      return workbench.previewFieldRefresh()
    case 'candidates.applyRefresh':
      return workbench.applyFieldRefresh(payload?.candidateIds)
    case 'candidates.agentRefresh':
      return workbench.agentRefreshFields({ apply: payload?.apply === true })
    case 'assessment.set':
      return workbench.setAssessment(payload?.candidateId, payload?.skillId, payload?.level, payload ?? {})
    case 'template.create':
      return workbench.createTemplate(payload ?? {})
    case 'template.update':
      return workbench.updateTemplate(payload?.templateId, payload ?? {})
    case 'template.restore':
      return workbench.restoreTemplate(payload?.templateId, payload?.version)
    case 'template.delete':
      return workbench.deleteTemplate(payload?.templateId)
    case 'skill.saveVersion':
      return workbench.saveSkillVersion(payload?.skillId, payload ?? {})
    case 'skill.restore':
      return workbench.restoreSkillVersion(payload?.skillId, payload?.version)
    case 'skill.copy':
      return workbench.copySkillAsNew(payload?.skillId, payload ?? {})
    case 'run.create':
      return workbench.createRun(payload?.templateId)
    case 'run.delete':
      return workbench.deleteRun(payload?.runId)
    case 'exchange.export':
      return workbench.exportPack()
    case 'exchange.preview':
      return { ok: true, pack: workbench.previewPack() }
    case 'exchange.import':
      return workbench.importPack(payload?.pack)
    case 'exchange.demoPeer':
      return workbench.importDemoPeerPack()
    case 'exchange.verify':
      return { ok: true, verify: workbench.verifyChain() }
    case 'exchange.applyWeights':
      return workbench.applyWeightSuggestion(payload?.templateId, payload?.weights, payload?.note)
    case 'data.reset':
      return workbench.resetAll()
    case 'data.rotateIdentity':
      return workbench.rotateIdentity()
    case 'data.exportBackup':
      return workbench.exportBackup()
    case 'data.importBackup':
      return workbench.importBackup(payload?.backup, payload?.confirm)
    default:
      throw new Error(`未知操作：${type}`)
  }
}

function toolDefinition(workbench) {
  return {
    name: 'talent_screening',
    description: [
      'Work with the local talent matching workbench: list candidates and templates, evaluate a candidate against a weighted template, import candidates (single record or a folder/file of resumes), save a manual dimension assessment, or exchange anonymized dimension/template statistics.',
      'scan_resumes reads a local file or folder and extracts text from PDF (text layer, with OCR for scans), DOC, DOCX, RTF, TXT and images (PNG/JPEG/WebP/BMP/TIFF) using local engines only; import_resumes commits the chosen scan items. OCR text may contain errors — its page images are listed so read_image can verify them.',
      'All candidate data stays in the local DSH profile database. Exchange packs contain only aggregated dimension means, normalized weights and sample-size buckets; never names, schools, contacts, resume text or candidate ids.',
      'Dimension skills (talent-dimension-*) hold the assessment standards; load one with the skill tool when you need the exact rubric.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['overview', 'list_tasks', 'create_task', 'list_candidates', 'evaluate', 'import_candidate', 'scan_resumes', 'import_resumes', 'refresh_import_fields', 'agent_refresh_fields', 'set_assessment', 'assign_batch', 'add_feedback', 'review_feedback', 'preview_pack', 'export_pack', 'import_pack', 'verify_chain'],
          description: 'Operation to perform.',
        },
        candidateId: { type: 'string', description: 'Candidate id for evaluate/set_assessment.' },
        templateId: { type: 'string', description: 'Template id; defaults to the active template.' },
        skillId: { type: 'string', description: 'Dimension skill id for set_assessment.' },
        level: { type: 'string', description: 'Level value from the skill scale, e.g. high/mid/low or yes/no.' },
        evidence: { type: 'array', items: { type: 'string' }, description: 'Short evidence lines for a manual assessment.' },
        candidate: {
          type: 'object',
          description: 'Candidate fields for import_candidate: alias, major, degree, school, stage, direction, profileText, publications, projects, engineering, theory, roles, skills, awards, notes.',
        },
        path: { type: 'string', description: 'Absolute file or folder path for scan_resumes.' },
        recursive: { type: 'boolean', description: 'For a folder: include subfolders (default true, depth 3).' },
        scanId: { type: 'string', description: 'Scan id returned by scan_resumes.' },
        keys: { type: 'array', items: { type: 'string' }, description: 'Scan item keys to import; omit to import every readable item.' },
        overrides: { type: 'object', description: 'Per-item field overrides keyed by scan item key: alias, realName, major, degree, school, direction.' },
        apply: { type: 'boolean', description: 'For refresh_import_fields / review_feedback: false or omitted previews, true applies.' },
        taskName: { type: 'string', description: 'For create_task: the recruiting task name.' },
        templateId: { type: 'string', description: 'For create_task: the initial role template id (defaults to the active one).' },
        batchName: { type: 'string', description: 'For assign_batch: create this batch when batchId is omitted.' },
        interviewDate: { type: 'string', description: 'For assign_batch: ISO date (YYYY-MM-DD) of the interviews, used to suggest batch boundaries.' },
        feedback: { type: 'string', description: 'For add_feedback: the reviewer comment.' },
        kind: { type: 'string', description: 'For add_feedback: positive | negative | adjust | note.' },
        candidateIds: { type: 'array', items: { type: 'string' }, description: 'For refresh_import_fields with apply: limit to these candidate ids; omit for all.' },
        pack: { type: 'object', description: 'Validated anonymous exchange pack for import_pack.' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          summary: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: String(value?.summary ?? '完成。') }],
    },
    async execute(args) {
      const action = String(args?.action ?? '')
      if (action === 'list_tasks') {
        return workbench.toolListTasks()
      }
      if (action === 'create_task') {
        return workbench.toolCreateTask(args ?? {})
      }
      if (action === 'assign_batch') {
        return workbench.toolAssignBatch(args ?? {})
      }
      if (action === 'add_feedback') {
        return workbench.toolAddFeedback(args ?? {})
      }
      if (action === 'review_feedback') {
        return workbench.toolReviewFeedback(args ?? {})
      }
      if (action === 'overview') {
        const result = workbench.toolOverview()
        return { ...result, summary: result.summary }
      }
      if (action === 'list_candidates') {
        const result = workbench.toolListCandidates(args?.templateId)
        return {
          ...result,
          summary: `${result.template.name} v${result.template.version}：${result.candidates.map(item => `${item.rank}. ${item.alias} ${item.total}`).join('；')}`,
        }
      }
      if (action === 'evaluate') {
        return workbench.toolEvaluate(args?.candidateId, args?.templateId)
      }
      if (action === 'import_candidate') {
        return workbench.toolImportCandidate(args?.candidate ?? {})
      }
      if (action === 'scan_resumes') {
        return workbench.toolScanResumes({ path: args?.path, recursive: args?.recursive, files: args?.files })
      }
      if (action === 'import_resumes') {
        return workbench.toolImportResumes({ scanId: args?.scanId, keys: args?.keys, overrides: args?.overrides })
      }
      if (action === 'refresh_import_fields') {
        return workbench.toolRefreshFields({ apply: args?.apply, candidateIds: args?.candidateIds })
      }
      if (action === 'agent_refresh_fields') {
        return workbench.toolAgentRefreshFields({ apply: args?.apply === true })
      }
      if (action === 'set_assessment') {
        return workbench.toolSetAssessment(args?.candidateId, args?.skillId, args?.level, args?.evidence ?? [])
      }
      if (action === 'preview_pack') {
        const pack = workbench.previewPack()
        return {
          ok: true,
          summary: `匿名交换包预览：${pack.dimensions.length} 个维度、${pack.templates.length} 个模板；样本量分级 ${pack.sample.bucket}；不含任何个人信息。`,
          pack,
        }
      }
      if (action === 'export_pack') {
        return workbench.toolExportPack()
      }
      if (action === 'import_pack') {
        return workbench.toolImportPack(args?.pack)
      }
      if (action === 'verify_chain') {
        const verify = workbench.verifyChain()
        return {
          ok: verify.ok,
          summary: verify.ok ? `本地账本 ${verify.length} 条记录校验通过。` : `账本校验失败：${verify.issues.join('；')}`,
          verify,
        }
      }
      throw new Error(`未知操作：${action}`)
    },
  }
}

export function apply(ctx, config = {}) {
  const dataDir = resolveDataDir(config)
  const { db, instance } = loadStore(dataDir)

  let skillDisposers = []
  const disposeSkills = () => {
    for (const dispose of skillDisposers) {
      try { dispose() } catch { /* already disposed */ }
    }
    skillDisposers = []
  }
  const refreshSkills = () => {
    disposeSkills()
    if (config.autoRegisterSkills === false) return
    const skillsService = typeof ctx.get === 'function' ? ctx.get('skills') : undefined
    if (skillsService === undefined || typeof skillsService.register !== 'function') return
    for (const record of Object.values(db.skills)) {
      const spec = currentSkill(db, record.id)
      if (spec === undefined || typeof spec.key !== 'string' || spec.key === '') continue
      const dispose = skillsService.register({
        name: spec.key,
        description: spec.description,
        whenToUse: spec.whenToUse,
        content: renderSkillMarkdown(spec),
        metadata: {
          plugin: '@nashihang777/dsh-talent-workbench',
          dimensionId: spec.id,
          version: spec.version,
          localOnly: true,
        },
        invocation: { modelInvocable: true, userInvocable: true },
      })
      skillDisposers.push(dispose)
    }
  }

  // Field extraction runs through the configured model: names and majors are
  // where regex heuristics fail. The local rule suggestion stays as fallback.
  const agentExtractor = createAgentExtractor({
    getLlm: () => (typeof ctx.get === 'function' ? ctx.get('llm') : undefined),
    getSelection: () => {
      const service = typeof ctx.get === 'function' ? ctx.get('agentDefaultModel') : undefined
      try {
        return service?.currentSelection?.()
      } catch {
        return undefined
      }
    },
    config: config.import ?? {},
  })

  const workbench = new TalentWorkbench({
    dataDir,
    db,
    instance,
    config,
    onSkillsChanged: refreshSkills,
    agentExtractor,
  })

  ctx.effect(() => {
    refreshSkills()
    return () => disposeSkills()
  }, 'talent workbench: dimension skills')

  const webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  if (webServer !== undefined && typeof webServer.register === 'function') {
    ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/dsh-talent',
      handler: async (request, response) => {
        const url = new URL(request.url ?? '/', 'http://localhost')
        if (!url.pathname.startsWith('/dsh-talent/api/')) {
          sendJson(response, 404, { ok: false, error: 'not found' })
          return
        }
        if (!['GET', 'HEAD', 'POST'].includes(request.method ?? 'GET')) {
          response.writeHead(405, { allow: 'GET, HEAD, POST' })
          response.end()
          return
        }
        if (!isLoopbackRequest(request)) {
          sendJson(response, 403, { ok: false, error: 'local callers only' })
          return
        }
        if (request.method === 'POST' && !sameOrigin(request)) {
          sendJson(response, 403, { ok: false, error: 'untrusted origin' })
          return
        }
        try {
          const route = url.pathname.slice('/dsh-talent/api/'.length)
          if (request.method === 'GET' || request.method === 'HEAD') {
            if (route === 'health') {
              sendJson(response, 200, { ok: true, version: '1.7.2', dataDir, runtime: 'local' })
              return
            }
            if (route === 'state') {
              sendJson(response, 200, workbench.snapshot())
              return
            }
            if (route === 'preview-pack') {
              sendJson(response, 200, { ok: true, pack: workbench.previewPack() })
              return
            }
            if (route === 'verify') {
              sendJson(response, 200, { ok: true, verify: workbench.verifyChain() })
              return
            }
            sendJson(response, 404, { ok: false, error: 'not found' })
            return
          }
          if (route === 'action') {
            const body = await readJsonBody(request)
            const result = await mutation(String(body?.type ?? ''), body?.payload ?? {}, workbench)
            sendJson(response, 200, result)
            return
          }
          sendJson(response, 404, { ok: false, error: 'not found' })
        } catch (error) {
          sendJson(response, 400, {
            ok: false,
            error: String(error?.message ?? error),
            details: Array.isArray(error?.details) ? error.details : undefined,
          })
        }
      },
    }), 'talent workbench: local API')
  }

  ctx.effect(() => ctx.tools.register(toolDefinition(workbench)), 'talent workbench: talent_screening tool')
}
