/**
 * Agent-assisted resume field extraction.
 *
 * The regex heuristics in `extract.js` stay as a local fallback, but names and
 * majors are exactly the fields where pattern matching fails: "应用数学博士"
 * loses to a stray "材料" in the body, a table header is read as a name, and so
 * on. When a model route is available this module asks the configured model to
 * read the extracted text and return structured fields.
 *
 * Privacy: this is the only part of the import flow that leaves the machine.
 * It sends the extracted resume text to the provider the user configured in
 * DSH; nothing else (no file bytes, no images) is transmitted. `import.useAgent`
 * turns it off, and the caller tells the user which path ran.
 */

const FIELD_PROMPT = `你是招聘系统的简历结构化器。输入是一份或多份简历的纯文本（已由本地解析器提取，可能来自 OCR，含有错字或空格）。

对每一份简历输出一个对象，键名严格如下：
- key：原样返回输入里的 key
- name：真实姓名（中文姓名或英文全名），取简历最显眼处；不要用「教育经历」「个人信息」「个人简历」等标题，也不要用文件名
- major：专业。以**最高学历**那一条教育经历上的专业为准；若只有研究方向没有专业，可留空，不要猜
- degree：最高学历，只能是「博士」「硕士」「本科」之一；无法判断则留空
- school：最高学历所在院校（大学/学院全称，不含城市前缀、不含下属学院）
- stage：年级或在读状态（如「博士四年级」「2021.09–至今」「工作 5 年」），无法判断则留空
- direction：研究方向或求职方向，一句话以内
- skills：技能关键词数组，最多 12 项
- publications：数组，每项是对象 {"role":"first|cofirst|other","status":"published|accepted|review","tier":"top|sci1|sci2|ccfA|ccfB|ccfC|ei|core|other","venue":"期刊或会议名"}；期刊分区/影响因子按简历自述，在投/在审用 review
- projects：数组，每项 {"name":"项目名","role":"lead|core|participant","level":"national|provincial|enterprise|lab","validation":"industrial|pilot|lab"}
- engineering：数组，每项 {"kind":"deployment|software|control|integration|field","desc":"一句话说明"}
- theory：数组，每项 {"kind":"first-principles|md|numerical|thermodynamics|ml|other","desc":"一句话说明"}
- roles：数组，每项 {"title":"职务名","kind":"party|student|admin|other","current":true|false}
- awards：奖项或荣誉字符串数组，最多 6 项
- confidence：0 到 1 的数字，表示你对 name/major/degree/school 四项的把握

规则：
1. 只使用文本中出现的事实，不得编造学校、专业、论文、项目或量化指标；文本没有的字段留空字符串或空数组。
2. 专业必须来自学历记录（教育经历里「博士/硕士/学士」所在的那一行或那个单元格），不要把正文里的研究领域、项目描述、技能列表当成专业。
3. 姓名必须是人的名字；OCR 可能把名字拆成带空格的字，请合并。
4. 如果这份文本看起来是名单、评审记录或包含多人，请在对象里加 "multiPerson": true，并仍然按第一位出现的人填写其余字段。
5. 只输出 JSON，不要 Markdown 代码块，不要解释文字。输出形如 {"results":[...]}。`

function stripFences(text) {
  const value = String(text ?? '').trim()
  if (!value.startsWith('```')) return value
  return value.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim()
}

/** Parse the model reply leniently: fences, leading prose, trailing commas. */
export function parseAgentJson(raw) {
  const text = stripFences(raw)
  const attempts = [text]
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) attempts.push(text.slice(first, last + 1))
  const firstArray = text.indexOf('[')
  const lastArray = text.lastIndexOf(']')
  if (firstArray >= 0 && lastArray > firstArray) attempts.push(`{"results":${text.slice(firstArray, lastArray + 1)}}`)
  for (const attempt of attempts) {
    const cleaned = attempt.replace(/,\s*([}\]])/g, '$1')
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) return parsed
      if (Array.isArray(parsed?.results)) return parsed.results
      if (Array.isArray(parsed?.items)) return parsed.items
      if (parsed !== null && typeof parsed === 'object') return [parsed]
    } catch { /* try the next shape */ }
  }
  return []
}

const DEGREES = new Set(['博士', '硕士', '本科'])
const PUB_ROLES = new Set(['first', 'cofirst', 'other'])
const PUB_STATUS = new Set(['published', 'accepted', 'review'])
const PUB_TIERS = new Set(['top', 'sci1', 'sci2', 'ccfA', 'ccfB', 'ccfC', 'ei', 'core', 'other'])
const PROJECT_ROLES = new Set(['lead', 'core', 'participant'])
const PROJECT_LEVELS = new Set(['national', 'provincial', 'enterprise', 'lab'])
const VALIDATION = new Set(['industrial', 'pilot', 'lab'])
const ENG_KINDS = new Set(['deployment', 'software', 'control', 'integration', 'field'])
const THEORY_KINDS = new Set(['first-principles', 'md', 'numerical', 'thermodynamics', 'ml', 'other'])
const ROLE_KINDS = new Set(['party', 'student', 'admin', 'other'])

function str(value, max = 200) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)
}

function pickEnum(value, allowed, fallback) {
  const text = str(value, 40)
  return allowed.has(text) ? text : fallback
}

function list(value, max, map) {
  if (!Array.isArray(value)) return []
  const out = []
  for (const entry of value.slice(0, max)) {
    const item = map(entry)
    if (item !== null) out.push(item)
  }
  return out
}

/** Normalize one model object into the shape the store expects. */
export function normalizeAgentItem(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const degree = str(raw.degree, 10)
  const publications = list(raw.publications, 60, (entry) => {
    if (entry === null || typeof entry !== 'object') return null
    const venue = str(entry.venue, 160)
    if (venue === '') return null
    return {
      role: pickEnum(entry.role, PUB_ROLES, 'other'),
      status: pickEnum(entry.status, PUB_STATUS, 'review'),
      tier: pickEnum(entry.tier, PUB_TIERS, 'other'),
      venue,
    }
  })
  return {
    key: str(raw.key, 40),
    alias: str(raw.alias ?? raw.name, 60),
    realName: str(raw.realName ?? raw.name, 60),
    major: str(raw.major, 80),
    degree: DEGREES.has(degree) ? degree : '',
    school: str(raw.school, 120),
    stage: str(raw.stage, 60),
    direction: str(raw.direction, 300),
    skills: list(raw.skills, 20, (entry) => {
      const value = str(entry, 40)
      return value === '' ? null : value
    }),
    publications,
    projects: list(raw.projects, 40, (entry) => {
      if (entry === null || typeof entry !== 'object') return null
      const name = str(entry.name, 180)
      if (name === '') return null
      return {
        name,
        role: pickEnum(entry.role, PROJECT_ROLES, 'participant'),
        level: pickEnum(entry.level, PROJECT_LEVELS, 'lab'),
        validation: pickEnum(entry.validation, VALIDATION, 'lab'),
      }
    }),
    engineering: list(raw.engineering, 40, (entry) => {
      if (entry === null || typeof entry !== 'object') return null
      const desc = str(entry.desc, 300)
      if (desc === '') return null
      return { kind: pickEnum(entry.kind, ENG_KINDS, 'software'), desc }
    }),
    theory: list(raw.theory, 40, (entry) => {
      if (entry === null || typeof entry !== 'object') return null
      const desc = str(entry.desc, 300)
      if (desc === '') return null
      return { kind: pickEnum(entry.kind, THEORY_KINDS, 'other'), desc }
    }),
    roles: list(raw.roles, 40, (entry) => {
      if (entry === null || typeof entry !== 'object') return null
      const title = str(entry.title, 100)
      if (title === '') return null
      return { title, kind: pickEnum(entry.kind, ROLE_KINDS, 'other'), current: entry.current === true }
    }),
    awards: list(raw.awards, 20, (entry) => {
      const value = str(entry, 120)
      return value === '' ? null : value
    }),
    multiPerson: raw.multiPerson === true,
    confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : undefined,
  }
}

/**
 * Build an extractor over the Host `llm` service.
 *
 * @param {{ getLlm: () => any, getSelection?: () => { provider?: string, model?: string }, config?: object }} deps
 */
export function createAgentExtractor(deps) {
  const config = deps.config ?? {}
  const batchSize = Number.isFinite(config.agentBatch) ? Math.max(1, Math.min(6, config.agentBatch)) : 3
  const timeoutMs = Number.isFinite(config.agentTimeoutMs) ? Math.max(10_000, config.agentTimeoutMs) : 90_000
  const maxChars = Number.isFinite(config.agentMaxCharsPerResume) ? config.agentMaxCharsPerResume : 9_000

  const target = () => {
    const explicitProvider = str(config.agentProvider, 60)
    const explicitModel = str(config.agentModel, 80)
    if (explicitProvider !== '' && explicitModel !== '') return { provider: explicitProvider, model: explicitModel }
    try {
      const selection = deps.getSelection?.()
      if (selection?.provider && selection?.model) return { provider: selection.provider, model: selection.model }
    } catch { /* fall through */ }
    return null
  }

  const available = () => {
    const llm = deps.getLlm()
    if (llm === undefined || typeof llm.stream !== 'function') return { available: false, reason: '当前 composition 没有提供 llm 服务' }
    const route = target()
    if (route === null) return { available: false, reason: '没有可用的默认模型路由' }
    return { available: true, provider: route.provider, model: route.model }
  }

  async function callModel(prompt, signal) {
    const llm = deps.getLlm()
    const route = target()
    if (llm === undefined || route === null) throw new Error('模型不可用')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('模型响应超时')), timeoutMs)
    const onAbort = () => controller.abort(signal?.reason)
    if (signal !== undefined) signal.addEventListener('abort', onAbort, { once: true })
    try {
      let text = ''
      let failure = null
      const stream = llm.stream({
        provider: route.provider,
        model: route.model,
        system: FIELD_PROMPT,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        temperature: 0,
        maxTokens: 8000,
        purpose: 'talent-resume-parse',
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') text += chunk.text
        else if (chunk.type === 'finish' && chunk.reason?.kind === 'error') failure = chunk.reason.failure
        else if (chunk.type === 'finish' && chunk.reason?.kind === 'aborted') failure = chunk.reason.failure
      }
      if (failure !== null && failure !== undefined) throw new Error(String(failure.message ?? '模型调用失败'))
      if (text.trim() === '') throw new Error('模型没有返回内容')
      return text
    } finally {
      clearTimeout(timer)
      if (signal !== undefined) signal.removeEventListener('abort', onAbort)
      if (typeof deps.resetIdle === 'function') deps.resetIdle()
    }
  }

  /**
   * Extract fields for the given scan items.
   * @param {Array<{key: string, name: string, text: string}>} items
   * @param {{ signal?: AbortSignal, onProgress?: (progress: { done: number, total: number }) => void }} options
   * @returns {{ ok: boolean, items: Map<string, object>, errors: string[], provider?: string, model?: string }}
   */
  async function extract(items, { signal, onProgress } = {}) {
    const state = available()
    if (state.available !== true) return { ok: false, items: new Map(), errors: [state.reason ?? '模型不可用'] }
    const result = new Map()
    const errors = []
    const usable = items.filter(item => typeof item.text === 'string' && item.text.trim() !== '')
    const report = (done, total) => {
      if (typeof onProgress !== 'function') return
      try { onProgress({ done, total }) } catch { /* progress is best-effort */ }
    }
    report(0, usable.length)
    let processed = 0
    for (let offset = 0; offset < usable.length; offset += batchSize) {
      if (signal?.aborted === true) break
      const batch = usable.slice(offset, offset + batchSize)
      const payload = batch.map(item => `<<<RESUME key="${item.key}" file="${item.name}">>>\n${item.text.slice(0, maxChars)}\n<<<END>>>`).join('\n\n')
      const prompt = `下面是 ${batch.length} 份简历，请按系统提示逐份输出 JSON：\n\n${payload}`
      try {
        const reply = await callModel(prompt, signal)
        const parsed = parseAgentJson(reply)
        const byKey = new Map()
        for (const entry of parsed) {
          const normalized = normalizeAgentItem(entry)
          if (normalized === null || normalized.key === '') continue
          byKey.set(normalized.key, normalized)
        }
        for (const item of batch) {
          const found = byKey.get(item.key)
          if (found === undefined) {
            errors.push(`${item.name}：模型没有返回这一份`)
            continue
          }
          result.set(item.key, found)
        }
      } catch (error) {
        if (signal?.aborted === true) break
        errors.push(`${batch.map(item => item.name).join('、')}：${String(error?.message ?? error)}`)
      }
      processed += batch.length
      report(processed, usable.length)
    }
    return {
      ok: result.size > 0,
      items: result,
      errors,
      provider: state.provider,
      model: state.model,
    }
  }

  return { available, extract, batchSize, timeoutMs }
}
