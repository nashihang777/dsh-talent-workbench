/**
 * Deterministic scoring engine, rule-based first-pass assessment, and
 * bias diagnostics. No network, no model call: every number below can be
 * recomputed from the local record.
 */

const CORE_DISCIPLINES = ['材料', '冶金', '化学', '化工', '物理', '稀土']

const TIER_POINTS = {
  top: 3,
  sci1: 2,
  sci2: 1,
  ccfA: 3,
  ccfB: 2,
  ccfC: 1.5,
  ei: 1,
  core: 0.8,
  other: 0.3,
}

const TIER_LABEL = {
  top: '顶刊/CNS 子刊',
  sci1: 'JCR 一区',
  sci2: 'JCR 二区',
  ccfA: 'CCF-A',
  ccfB: 'CCF-B',
  ccfC: 'CCF-C',
  ei: 'EI',
  core: '北大核心',
  other: '其他',
}

const TIER_RANK = { top: 0, ccfA: 0, sci1: 1, ccfB: 1, sci2: 2, ccfC: 2, ei: 3, core: 4, other: 5 }

const ROLE_LABEL = { lead: '主导', core: '核心', participant: '参与' }
const VALIDATION_LABEL = { industrial: '产线/现场', pilot: '中试', lab: '实验室' }
const LEVEL_LABEL = { high: '高', upperMid: '中上', mid: '中', lowerMid: '中下', low: '低', yes: '是', no: '否', partial: '部分' }

export function nowIso() {
  return new Date().toISOString()
}

export function currentSkill(db, skillId) {
  const record = db.skills[skillId]
  if (record === undefined) return undefined
  const version = record.versions.find(item => item.version === record.currentVersion)
  return version?.spec
}

export function currentTemplate(db, templateId) {
  const record = db.templates[templateId]
  if (record === undefined) return undefined
  const version = record.versions.find(item => item.version === record.currentVersion)
  return version?.definition
}

export function levelScore(skill, levelValue) {
  const found = skill?.scale?.find(level => level.value === levelValue)
  return found?.score ?? 0
}

export function levelLabel(skill, levelValue) {
  const found = skill?.scale?.find(level => level.value === levelValue)
  return found?.label ?? LEVEL_LABEL[levelValue] ?? levelValue
}

function normalizeWeights(dimensions) {
  const total = dimensions.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0)
  if (total <= 0) return dimensions.map(item => ({ ...item, normalized: 0 }))
  return dimensions.map(item => ({ ...item, normalized: Math.max(0, Number(item.weight) || 0) / total }))
}

function hasAny(text, keywords) {
  const value = String(text ?? '')
  return keywords.some(keyword => value.includes(keyword))
}

export function publicationStats(candidate) {
  const publications = Array.isArray(candidate.publications) ? candidate.publications : []
  const first = []
  const cofirst = []
  const other = []
  const inReview = []
  for (const publication of publications) {
    const status = publication.status === 'published' || publication.status === 'accepted'
      ? 'published'
      : 'review'
    if (status === 'review') inReview.push(publication)
    if (publication.role === 'first') first.push(publication)
    else if (publication.role === 'cofirst') cofirst.push(publication)
    else other.push(publication)
  }
  const publishedFirst = first.filter(item => item.status === 'published' || item.status === 'accepted')
  const publishedCofirst = cofirst.filter(item => item.status === 'published' || item.status === 'accepted')
  let points = 0
  for (const item of publishedFirst) points += TIER_POINTS[item.tier] ?? 0.3
  for (const item of publishedCofirst) points += (TIER_POINTS[item.tier] ?? 0.3) * 0.5
  const best = [...publishedFirst, ...publishedCofirst]
    .sort((a, b) => (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9))
    .slice(0, 3)
  return {
    points,
    firstCount: publishedFirst.length,
    cofirstCount: publishedCofirst.length,
    publishedCount: publishedFirst.length + publishedCofirst.length,
    inReview,
    otherCount: other.length,
    best,
    first,
    cofirst,
  }
}

function roleBurden(candidate) {
  const roles = Array.isArray(candidate.roles) ? candidate.roles : []
  let burden = 0
  const heavy = []
  for (const role of roles) {
    const title = String(role.title ?? '')
    let point = 0.15
    if (role.kind === 'party') point = 0.8
    else if (role.kind === 'admin') point = 1.0
    else if (role.kind === 'student') point = 0.3
    if (/主席|书记|主任|部长|会长|队长|团长|辅导员/.test(title)) point += 0.3
    if (role.current === true) point += 0.2
    burden += point
    if (point >= 0.6) heavy.push(title)
  }
  return { burden, heavy, roles }
}

function engineeringScore(candidate) {
  const items = Array.isArray(candidate.engineering) ? candidate.engineering : []
  const weights = { deployment: 1.0, control: 0.8, software: 0.55, integration: 0.7, field: 0.8 }
  let score = 0
  for (const item of items) score += weights[item.kind] ?? 0.3
  const projects = Array.isArray(candidate.projects) ? candidate.projects : []
  for (const project of projects) {
    if (project.validation === 'industrial') score += 0.5
    else if (project.validation === 'pilot') score += 0.25
  }
  return { score, items }
}

function theoryKinds(candidate) {
  const items = Array.isArray(candidate.theory) ? candidate.theory : []
  const kinds = new Set()
  for (const item of items) if (item.kind) kinds.add(item.kind)
  return { kinds: [...kinds], items }
}

function projectChainScore(candidate) {
  const projects = Array.isArray(candidate.projects) ? candidate.projects : []
  const levelPoints = { national: 1.0, provincial: 0.5, enterprise: 0.7, lab: 0.2 }
  const rolePoints = { lead: 1.0, core: 0.7, participant: 0.3 }
  const validationPoints = { industrial: 1.0, pilot: 0.6, lab: 0.3 }
  let score = 0
  let bestProject = null
  for (const project of projects) {
    const value = (levelPoints[project.level] ?? 0.2)
      + (rolePoints[project.role] ?? 0.2)
      + (validationPoints[project.validation] ?? 0.2)
    score += value
    if (bestProject === null || value > bestProject.value) bestProject = { ...project, value }
  }
  score += Math.min(0.6, (Array.isArray(candidate.publications) ? candidate.publications.length : 0) * 0.12)
  return { score, bestProject }
}

function evidenceLine(value) {
  const text = String(value ?? '').trim()
  if (text === '') return ''
  return text.length > 120 ? `${text.slice(0, 116)}…` : text
}

function publicationEvidence(candidate) {
  const stats = publicationStats(candidate)
  const lines = []
  for (const publication of stats.best) {
    lines.push(`${publication.role === 'cofirst' ? '共同一作' : '一作'}·${TIER_LABEL[publication.tier] ?? '其他'}：${publication.venue}`)
  }
  if (stats.inReview.length > 0) {
    lines.push(`在投/在审 ${stats.inReview.length} 篇（不计入已发表）：${stats.inReview.map(item => evidenceLine(item.venue)).join('；')}`)
  }
  return lines
}

export function assessTechStack(candidate) {
  const text = [candidate.major, candidate.direction, candidate.profileText, ...(candidate.skills ?? [])].join(' ')
  const projectText = (candidate.projects ?? []).map(item => item.name).join(' ')
  const pubText = (candidate.publications ?? []).map(item => item.venue).join(' ')
  const domainKeywords = ['稀土', '永磁', '储氢', '抛光', '萃取', '湿法', '高纯', '冶金', '材料', '化学', '界面', '电池', '烧结', '相图', '过程']
  const methodKeywords = ['机器学习', '深度学习', '第一性原理', '分子动力学', 'CFD', '数值', '建模', '强化学习', '优化', 'LLM', 'Agent', 'RAG', '多智能体', '时序', '预测', '神经网络']
  const deployKeywords = ['上线', '部署', '产线', '现场', '中试', '装置', '控制系统', '软件平台', '集成', 'DCS', 'PLC']
  const domain = hasAny(`${candidate.major} ${candidate.direction} ${projectText} ${pubText}`, domainKeywords)
  const method = hasAny(text, methodKeywords)
  const deploy = hasAny(text, deployKeywords)
  const directRareEarth = hasAny(`${candidate.direction} ${projectText} ${pubText}`, ['稀土', '永磁', '储氢', '抛光'])
  const llmStack = hasAny(text, ['LLM', 'Agent', 'RAG', '多智能体'])
  let level = 'low'
  const evidence = []
  if (directRareEarth && method) {
    level = publicationStats(candidate).points >= 2 || deploy ? 'high' : 'upperMid'
    evidence.push('方向直接落在稀土/永磁/储氢等岗位对象上，并具备数据/模型方法。')
  } else if (domain && method) {
    level = deploy ? 'high' : 'upperMid'
    evidence.push('有材料/过程领域问题，又有数据/模型方法，可迁移性较强。')
  } else if (llmStack && deploy) {
    level = 'upperMid'
    evidence.push('LLM/Agent 全栈工程能力可迁移到场景智能体，但缺少材料/冶金对象证据。')
  } else if (domain && deploy) {
    level = 'mid'
    evidence.push('懂领域与现场，但缺少数据/模型方法证据。')
  } else if (domain || method) {
    level = 'mid'
    evidence.push('具备一侧能力，缺少「对象 + 方法 + 结果」的完整链条。')
  } else if ((candidate.skills ?? []).length > 0) {
    level = 'lowerMid'
    evidence.push('只有工具/课程级技能，未看到岗位对象或方法证据。')
  }
  if (deploy) evidence.push('出现部署/产线/现场类证据，需在面试中核实个人负责范围。')
  return {
    level,
    confidence: evidence.length >= 2 ? 'medium' : 'low',
    evidence,
    rationale: `领域证据：${domain ? '有' : '无'}；方法证据：${method ? '有' : '无'}；交付证据：${deploy ? '有' : '无'}。`,
    method: '规则初筛 v1：领域/方法/交付三层锚点 + 证据链',
  }
}

export function assessCrossDiscipline(candidate) {
  const major = String(candidate.major ?? '')
  const core = CORE_DISCIPLINES.some(item => major.includes(item))
  const discipline = major || '未填写专业'
  if (core) {
    return {
      level: 'no',
      confidence: 'high',
      evidence: [`主学科「${discipline}」属于本岗位核心集合（材料/冶金/化学/化工/物理）。`],
      rationale: '不带来团队外的新学科能力；若确有第二学科，请在证据中补充。',
      method: '规则初筛 v1：核心学科集合比对',
      annotation: '核心方向',
    }
  }
  return {
    level: 'yes',
    confidence: major === '' ? 'low' : 'medium',
    evidence: [`主学科「${discipline}」不在本岗位核心集合内，可能带来补充能力。`],
    rationale: '仅标记学科差异；具体能力是否填补缺口，需要在证据中命名。',
    method: '规则初筛 v1：核心学科集合比对',
    annotation: '需命名具体能力',
  }
}

export function assessAcademic(candidate) {
  const stats = publicationStats(candidate)
  let level = 'low'
  if (stats.points >= 4.5) level = 'high'
  else if (stats.points >= 3) level = 'upperMid'
  else if (stats.points >= 1.5) level = 'mid'
  else if (stats.points > 0) level = 'lowerMid'
  const evidence = publicationEvidence(candidate)
  if (evidence.length === 0) evidence.push('没有已发表/已接收的一作或共同一作成果。')
  return {
    level,
    confidence: stats.publishedCount > 0 ? 'high' : 'medium',
    evidence,
    rationale: `一作 ${stats.firstCount} 篇、共同一作 ${stats.cofirstCount} 篇、在投/在审 ${stats.inReview.length} 篇；折算点 ${stats.points.toFixed(1)}（共同一作按 0.5 折算）。`,
    method: '规则初筛 v1：已发表/已接收 × 作者位次 × 刊物层级',
  }
}

export function assessEngineering(candidate) {
  const { score, items } = engineeringScore(candidate)
  const level = score >= 1.0 ? 'yes' : score >= 0.4 ? 'partial' : 'no'
  const evidence = items.map(item => `${item.desc}`)
  if (evidence.length === 0) evidence.push('没有软件平台、控制系统、集成或现场交付证据。')
  return {
    level,
    confidence: items.length > 0 ? 'medium' : 'high',
    evidence,
    rationale: `落地证据加权 ${score.toFixed(2)}；产线/现场证据优先于中试、原型。`,
    method: '规则初筛 v1：部署/控制/集成/现场证据强度',
  }
}

export function assessTheory(candidate) {
  const { kinds, items } = theoryKinds(candidate)
  const level = kinds.length > 0 ? 'yes' : 'no'
  const evidence = items.map(item => `${item.kind}：${item.desc}`)
  if (evidence.length === 0) evidence.push('没有第一性原理、分子动力学、数值算法或热力学建模证据。')
  return {
    level,
    confidence: kinds.length > 0 ? 'medium' : 'high',
    evidence,
    rationale: `理论方法：${kinds.length > 0 ? kinds.join('、') : '无'}；仅「会用软件」不计入。`,
    method: '规则初筛 v1：理论方法清单 + 独立实现',
  }
}

export function assessPotential(candidate) {
  const stats = publicationStats(candidate)
  const { bestProject } = projectChainScore(candidate)
  let points = 0
  points += Math.min(3, stats.points * 0.7)
  if (stats.best.some(item => item.tier === 'top' || item.tier === 'ccfA')) points += 1
  if (bestProject?.role === 'lead') points += 0.8
  if ((candidate.awards ?? []).length > 0) points += 0.3
  if (candidate.degree === '博士' && /三|四/.test(String(candidate.stage ?? ''))) points += 0.3
  let level = 'low'
  if (points >= 3) level = 'high'
  else if (points >= 2) level = 'upperMid'
  else if (points >= 1) level = 'mid'
  else if (points > 0) level = 'lowerMid'
  const evidence = []
  if (stats.best.length > 0) evidence.push(`代表作层级：${stats.best.map(item => TIER_LABEL[item.tier] ?? item.tier).join('、')}。`)
  if (bestProject) evidence.push(`项目角色：${ROLE_LABEL[bestProject.role] ?? bestProject.role}（${bestProject.name}）。`)
  if (evidence.length === 0) evidence.push('缺少可判断成长轨迹的产出证据。')
  return {
    level,
    confidence: stats.publishedCount > 0 ? 'medium' : 'low',
    evidence,
    rationale: '只使用产出轨迹、独立性与平台证据；未使用年龄、性别、籍贯、第一学历。',
    method: '规则初筛 v1：产出轨迹 + 独立性 + 方向连续性',
  }
}

export function assessDepth(candidate) {
  const { score, bestProject } = projectChainScore(candidate)
  let level = 'low'
  if (score >= 2.2) level = 'high'
  else if (score >= 1.6) level = 'upperMid'
  else if (score >= 1.0) level = 'mid'
  else if (score >= 0.5) level = 'lowerMid'
  const evidence = []
  if (bestProject) {
    evidence.push(`${bestProject.name}：${ROLE_LABEL[bestProject.role] ?? bestProject.role}，${VALIDATION_LABEL[bestProject.validation] ?? bestProject.validation}验证。`)
  }
  evidence.push(`项目链条加权 ${score.toFixed(2)}；需核实个人决策点与失败修正记录。`)
  return {
    level,
    confidence: bestProject ? 'medium' : 'low',
    evidence,
    rationale: '按问题定义、方法、验证、放大/现场四段还原；项目名头不计分。',
    method: '规则初筛 v1：项目链条完成度 × 角色 × 验证强度',
  }
}

export function assessFocus(candidate) {
  const { burden, heavy, roles } = roleBurden(candidate)
  const stats = publicationStats(candidate)
  let level = 'high'
  if (roles.length === 0) level = 'high'
  else if (burden >= 1.2 && stats.firstCount === 0) level = 'low'
  else if (burden >= 0.9 && stats.firstCount <= 1) level = 'lowerMid'
  else if (burden >= 0.6) level = 'mid'
  else level = 'high'
  const evidence = roles.map(role => `${role.title}（${role.kind}${role.current ? '，在任' : ''}）`)
  if (evidence.length === 0) evidence.push('未列出党务、学生干部或行政职务。')
  evidence.push(`同期一作 ${stats.firstCount} 篇；专注度需在面试中核实任期与每周投入。`)
  return {
    level,
    confidence: roles.length > 0 ? 'medium' : 'high',
    evidence,
    rationale: `职务负担加权 ${burden.toFixed(2)}${heavy.length > 0 ? `（重点：${heavy.join('、')}）` : ''}；仅作风险提示。`,
    method: '规则初筛 v1：职务强度 × 是否在任 × 一作产出',
  }
}

/**
 * Rule-based first pass for the industry dimensions.
 *
 * These are keyword/shape heuristics over the resume text plus the structured
 * fields. They exist to give the recruiter a starting level, not a verdict:
 * every result carries the matched snippets so a human (or the model, via the
 * dimension skill) can confirm or correct it.
 */
function candidateText(candidate) {
  const parts = [
    candidate.major,
    candidate.direction,
    candidate.profileText,
    candidate.notes,
    ...(candidate.skills ?? []),
    ...(candidate.awards ?? []),
    ...(candidate.projects ?? []).map(item => item.name),
    ...(candidate.engineering ?? []).map(item => `${item.kind} ${item.desc}`),
    ...(candidate.theory ?? []).map(item => `${item.kind} ${item.desc}`),
    ...(candidate.roles ?? []).map(item => item.title),
  ]
  return parts.filter(Boolean).join(' \n ')
}

function hitGroups(text, groups) {
  const hits = []
  let points = 0
  for (const group of groups) {
    const matched = group.any.filter(keyword => text.includes(keyword))
    if (matched.length === 0) continue
    points += group.weight
    hits.push(matched.slice(0, 3).join('/'))
  }
  return { points, hits }
}

function hasNumberEvidence(text) {
  return /(\d+(\.\d+)?\s*(%|万|亿|k|K|qps|QPS|ms|毫秒|倍|篇|人|家|个))/.test(text)
}

function levelFromPoints(points, thresholds) {
  const [high, upperMid, mid, lowerMid] = thresholds
  if (points >= high) return 'high'
  if (points >= upperMid) return 'upperMid'
  if (points >= mid) return 'mid'
  if (points >= lowerMid) return 'lowerMid'
  return 'low'
}

function industryResult(level, confidence, evidence, rationale, method) {
  return { level, confidence, evidence: evidence.filter(Boolean), rationale, method }
}

/** Does the resume mention any keyword of the template's target industry? */
export function focusMatch(candidate, keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return true
  const text = `${candidateText(candidate)} ${candidate.school ?? ''}`
  return keywords.some(keyword => text.includes(keyword))
}

export function assessEngineeringQuality(candidate) {
  const text = candidateText(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['单元测试', '自动化测试', '集成测试', '覆盖率', '回归测试', '压测', '压力测试'] },
    { weight: 2, any: ['CI/CD', 'CI', '持续集成', '代码评审', 'CR', '灰度', '回滚', '发布流程'] },
    { weight: 2, any: ['监控', '告警', '日志', '链路追踪', '可观测', '事故复盘', '故障定位'] },
    { weight: 1, any: ['重构', '代码规范', '设计模式', '模块化', '可维护'] },
    { weight: 1, any: ['性能优化', 'P99', 'QPS', '吞吐', '延迟优化'] },
  ])
  let score = points + (hasNumberEvidence(text) ? 1 : 0)
  if ((candidate.engineering ?? []).some(item => item.kind === 'deployment' || item.kind === 'software')) score += 1
  const level = levelFromPoints(score, [6.5, 4.5, 3, 1.5])
  return industryResult(
    level,
    hits.length >= 2 ? 'medium' : 'low',
    hits.length > 0 ? [`规则命中：${hits.join('；')}。`] : ['没有看到测试、CI、监控或事故复盘的证据。'],
    `信号加权 ${score}（含数字证据与部署类结构化证据各 +1）；只看关键词命中，需人工核对具体动作。`,
    '规则初筛 v1：测试/流程/可观测/性能关键词 + 结构化工程证据',
  )
}

export function assessSystemDesign(candidate) {
  const text = candidateText(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['架构设计', '系统设计', '领域划分', '模块边界', '接口契约', '微服务', '拆分'] },
    { weight: 2, any: ['高并发', '容量规划', 'QPS', '削峰', '限流', '熔断', '降级', '幂等'] },
    { weight: 2, any: ['容灾', '多活', '故障域', '隔离', '高可用'] },
    { weight: 1, any: ['技术选型', '自研', '取舍', '演进', '迁移'] },
  ])
  let score = points
  if ((candidate.projects ?? []).some(item => item.role === 'lead')) score += 1
  if (hasNumberEvidence(text)) score += 0.5
  const level = levelFromPoints(score, [6, 4.5, 3, 1.5])
  return industryResult(
    level,
    hits.length >= 2 ? 'medium' : 'low',
    hits.length > 0 ? [`规则命中：${hits.join('；')}。`] : ['没有看到架构、容量或故障域相关证据。'],
    `信号加权 ${score}（主导项目 +1、量化规模 +0.5）；需追问取舍理由。`,
    '规则初筛 v1：架构/容量/故障域/取舍关键词 + 项目角色',
  )
}

export function assessDataExperiment(candidate) {
  const text = candidateText(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['AB 实验', 'AB测试', 'A/B', '实验设计', '对照组', '显著性', '样本量'] },
    { weight: 2, any: ['指标定义', '指标体系', '口径', '埋点', '数据质量', '一致性', '标注规范'] },
    { weight: 2, any: ['数据清洗', '特征工程', '样本外', '回测', '交叉验证', '偏差', '交易成本'] },
    { weight: 1, any: ['SQL', '数仓', 'ETL', 'Pandas', 'Spark', 'Flink'] },
    { weight: 1, any: ['留存', '转化', '归因', '分层'] },
  ])
  let score = points + (hasNumberEvidence(text) ? 1 : 0)
  const level = levelFromPoints(score, [7, 5.5, 3.5, 1.5])
  return industryResult(
    level,
    hits.length >= 2 ? 'medium' : 'low',
    hits.length > 0 ? [`规则命中：${hits.join('；')}。`] : ['没有看到数据口径、实验设计或数据质量证据。'],
    `信号加权 ${score}；关键词无法判断口径正确性，需人工核对分母与去重规则。`,
    '规则初筛 v1：指标/实验/数据质量/工具关键词',
  )
}

export function assessModeling(candidate) {
  const text = candidateText(candidate)
  const stats = publicationStats(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['自研', '改进', '提出', '新方法', '消融', '误差分析', '失效边界'] },
    { weight: 2, any: ['基线', 'baseline', 'SOTA', '指标提升', 'F1', 'AUC', 'MOS', '唤醒率', '误唤醒', '夏普', '回撤'] },
    { weight: 2, any: ['模型训练', '微调', '蒸馏', '推理优化', '量化', '部署', '时延', '实盘', '对冲', '定价'] },
    { weight: 1, any: ['Transformer', 'CNN', 'GNN', 'LSTM', '强化学习', '扩散模型', '优化求解', '随机', '因子'] },
    { weight: 1, any: ['数学原理', '推导', '数值稳定', '信号处理', '滤波', '波束成形', '波动率'] },
  ])
  let score = points + (hasNumberEvidence(text) ? 1 : 0) + Math.min(1.5, stats.points * 0.4)
  const level = levelFromPoints(score, [6.5, 5, 3, 1.5])
  return industryResult(
    level,
    hits.length >= 2 ? 'medium' : 'low',
    [
      hits.length > 0 ? `规则命中：${hits.join('；')}。` : '没有看到任务定义、基线或消融证据。',
      stats.publishedCount > 0 ? `已发表一作/共一 ${stats.publishedCount} 篇。` : '',
    ],
    `信号加权 ${score}（含数字证据 +1、成果折算）；模型名词本身不加分。`,
    '规则初筛 v1：任务/基线/消融/成本关键词 + 成果折算',
  )
}

export function assessProductSense(candidate) {
  const text = candidateText(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['需求分析', '用户访谈', '用户调研', '场景', '痛点', 'PRD', '原型'] },
    { weight: 2, any: ['优先级', '砍掉', '范围', '路线图', 'ROI', '价值判断'] },
    { weight: 2, any: ['成功标准', '验收标准', '上线指标', '复盘', '续约率', '留存'] },
    { weight: 1, any: ['竞品', '行业调研', '客户反馈', '方案汇报', '解决方案'] },
  ])
  let score = points
  if (/产品经理|产品负责人|解决方案|售前|产品规划/.test(text)) score += 1.5
  const level = levelFromPoints(score, [7, 5.5, 3.5, 1.5])
  return industryResult(
    level,
    hits.length >= 2 ? 'medium' : 'low',
    hits.length > 0 ? [`规则命中：${hits.join('；')}。`] : ['没有看到需求来源、取舍或成功标准的证据。'],
    `信号加权 ${score}（产品/解决方案身份 +1.5）；需追问被砍掉的需求与理由。`,
    '规则初筛 v1：需求来源/取舍/成功标准关键词 + 岗位身份',
  )
}

const INDUSTRY_WORDS = [
  '制造', '能源', '电力', '电厂', '冶金', '化工', '汽车', '半导体', '医疗', '器械', '检验', '临床',
  '试剂', '金融', '证券', '基金', '保险', '银行', '风控', '量化', '期权', '期货', '物流', '零售',
  '电商', '教育', '政务', '通信', '稀土', '材料', '音频', '语音',
]

export function assessDomain(candidate) {
  const text = candidateText(candidate)
  const matched = INDUSTRY_WORDS.filter(word => text.includes(word))
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['工艺', '产线', '现场', '工序', '验收', '试点', '中试', '生产'] },
    { weight: 2, any: ['合规', '法规', '标准', '认证', '审计', '注册', '等保', 'GxP', 'GMP', 'ISO', '质量体系', '临床'] },
    { weight: 1, any: ['行业调研', '客户访谈', '业务链', '术语', '实盘', '交易成本'] },
  ])
  const head = `${candidate.major ?? ''} ${candidate.direction ?? ''}`
  const headHit = INDUSTRY_WORDS.some(word => head.includes(word))
  let score = points + Math.min(2, matched.length * 0.5) + (headHit ? 1.5 : 0)
  const level = levelFromPoints(score, [6, 4.5, 3, 1.5])
  return industryResult(
    level,
    matched.length > 0 ? 'medium' : 'low',
    [
      matched.length > 0 ? `行业词命中：${matched.slice(0, 5).join('、')}。` : '没有识别到明确的行业背景。',
      headHit ? '专业或研究方向直接落在该行业上。' : '',
      hits.length > 0 ? `领域证据：${hits.join('；')}。` : '缺少工艺/合规类深度证据。',
    ],
    `信号加权 ${score}（行业词最多 +2、专业/方向命中 +1.5）；行业词只说明待过，不代表理解约束关系。`,
    '规则初筛 v1：行业词 + 专业方向 + 工艺/合规/现场关键词',
  )
}

export function assessCollaboration(candidate) {
  const text = candidateText(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['跨团队', '跨部门', '多方', '协作推进', '对齐', '协调'] },
    { weight: 2, any: ['带', '小组', '辅导', '培训', '负责人', '接口人'] },
    { weight: 2, any: ['规范', '文档', '流程', '评审', '复盘', '交接'] },
    { weight: 1, any: ['客户沟通', '方案汇报', '冲突', '分歧'] },
  ])
  let score = points
  if ((candidate.roles ?? []).some(role => /负责人|经理|组长|lead|主管/i.test(String(role.title ?? '')))) score += 1
  const level = levelFromPoints(score, [6.5, 4.5, 3, 1.5])
  return industryResult(
    level,
    hits.length >= 2 ? 'medium' : 'low',
    hits.length > 0 ? [`规则命中：${hits.join('；')}。`] : ['没有看到跨团队协作、带人或文档沉淀的证据。'],
    `信号加权 ${score}（负责人身份 +1）；关键词无法判断冲突处理质量。`,
    '规则初筛 v1：协作/带人/沉淀/沟通关键词 + 岗位身份',
  )
}

export function assessOutcome(candidate) {
  const text = candidateText(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['上线', '交付', '验收', '按期', '里程碑', '进度'] },
    { weight: 2, any: ['提升', '降低', '下降', '增长', '节省', '效率', '良率', '续约率'] },
    { weight: 1, any: ['营收', '签约', '成本', '回滚', '延期', '复盘'] },
  ])
  let score = points + (hasNumberEvidence(text) ? 1.5 : 0)
  const level = levelFromPoints(score, [6, 4.5, 3, 1.5])
  return industryResult(
    level,
    hits.length >= 2 ? 'medium' : 'low',
    hits.length > 0 ? [`规则命中：${hits.join('；')}。`] : ['没有看到交付结果或量化变化的证据。'],
    `信号加权 ${score}（量化数字 +1.5）；需核实归因，避免把团队结果算成个人结果。`,
    '规则初筛 v1：交付/量化变化/成本关键词 + 数字证据',
  )
}

export function assessLearning(candidate) {
  const text = candidateText(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['从零', '自学', '转岗', '跨领域', '快速上手', '短期'] },
    { weight: 2, any: ['复现', '源码', '迁移', '方法论', '踩坑'] },
    { weight: 1, any: ['多种技术栈', '新技术', '学习路径', '培训'] },
  ])
  const techCount = (candidate.skills ?? []).length
  let score = points + Math.min(1.5, techCount * 0.25)
  const level = levelFromPoints(score, [5, 3.5, 2.5, 1])
  return industryResult(
    level,
    hits.length >= 1 ? 'medium' : 'low',
    [
      hits.length > 0 ? `规则命中：${hits.join('；')}。` : '没有看到领域切换或迁移的具体描述。',
      techCount > 0 ? `技能条目 ${techCount} 项（广度不等于速度）。` : '',
    ],
    `信号加权 ${score}（技能广度最多 +1.5）；技能数量不能替代迁移案例。`,
    '规则初筛 v1：切换/迁移/复现关键词 + 技能广度',
  )
}

export function assessField(candidate) {
  const text = candidateText(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['驻场', '现场', '实施', '部署', '验收', '培训', '交接'] },
    { weight: 2, any: ['成功后', '签约', '续约', '商机', '成单', '拜访', '客户', '甲方', '售前', '解决方案'] },
    { weight: 1, any: ['回滚', '变更', '生产环境', '隔离', '内网', 'POC'] },
  ])
  const structured = (candidate.engineering ?? []).some(item => item.kind === 'field' || item.kind === 'integration')
  const score = points + (structured ? 1 : 0)
  let level = 'no'
  if (score >= 4.5) level = 'yes'
  else if (score >= 2) level = 'partial'
  return industryResult(
    level,
    hits.length >= 1 ? 'medium' : 'low',
    [
      hits.length > 0 ? `规则命中：${hits.join('；')}。` : '没有看到现场实施或客户界面的证据。',
      structured ? '结构化证据包含现场/集成类条目。' : '',
    ],
    `信号加权 ${score}；现场改动是否留回滚需人工确认。`,
    '规则初筛 v1：驻场/客户/变更关键词 + 结构化现场证据',
  )
}

export function assessCompliance(candidate) {
  const text = candidateText(candidate)
  const { points, hits } = hitGroups(text, [
    { weight: 2, any: ['合规', '法规', '监管', '内控', '风控', '反洗钱', '审计'] },
    { weight: 2, any: ['数据安全', '隐私', '脱敏', '权限', '审计日志', '等保', '数据完整性'] },
    { weight: 2, any: ['ISO', 'GxP', 'GMP', '13485', '认证', '注册', '审批', '留痕'] },
    { weight: 1, any: ['红线', '风险', '整改', '纠正预防'] },
  ])
  const score = points
  let level = 'low'
  if (score >= 4.5) level = 'high'
  else if (score >= 2.5) level = 'mid'
  else if (score >= 1.5) level = 'lowerMid'
  return industryResult(
    level,
    hits.length >= 1 ? 'medium' : 'low',
    hits.length > 0 ? [`规则命中：${hits.join('；')}。`] : ['没有看到合规、审计或数据安全的证据。'],
    `信号加权 ${score}；关键词命中不等于执行过流程，需核对审计与审批证据。`,
    '规则初筛 v1：合规/数据安全/体系认证关键词',
  )
}

const INDUSTRY_ASSESSORS = {
  'engineering-quality': assessEngineeringQuality,
  'system-design': assessSystemDesign,
  'data-experiment': assessDataExperiment,
  'modeling-tuning': assessModeling,
  'product-sense': assessProductSense,
  'domain-knowledge': assessDomain,
  'collaboration': assessCollaboration,
  'outcome-delivery': assessOutcome,
  'learning-agility': assessLearning,
  'field-implementation': assessField,
  'compliance-risk': assessCompliance,
}

const ASSESSORS = Object.assign({}, INDUSTRY_ASSESSORS, {
  'tech-stack-match': assessTechStack,
  'cross-discipline': assessCrossDiscipline,
  'academic-level': assessAcademic,
  'engineering-gap': assessEngineering,
  'theory-depth': assessTheory,
  'long-term-potential': assessPotential,
  'research-depth': assessDepth,
  'research-focus': assessFocus,
})

export function assessorIds() {
  return Object.keys(ASSESSORS)
}

export function autoAssessCandidate(db, candidate) {
  const assessments = {}
  for (const skillId of Object.keys(ASSESSORS)) {
    const skill = currentSkill(db, skillId)
    if (skill === undefined) continue
    const result = ASSESSORS[skillId](candidate)
    assessments[skillId] = {
      level: result.level,
      confidence: result.confidence,
      evidence: result.evidence.filter(Boolean),
      rationale: result.rationale,
      method: result.method,
      annotation: result.annotation ?? '',
      source: 'auto',
      updatedAt: nowIso(),
    }
  }
  return assessments
}

export function ensureAssessments(db, candidate) {
  const next = { ...candidate, assessments: { ...(candidate.assessments ?? {}) } }
  let changed = false
  for (const skillId of Object.keys(ASSESSORS)) {
    if (next.assessments[skillId] === undefined) {
      const auto = autoAssessCandidate(db, candidate)
      next.assessments[skillId] = auto[skillId]
      changed = true
    }
  }
  return { candidate: next, changed }
}

function assessmentFor(db, candidate, skillId) {
  const current = candidate.assessments?.[skillId]
  if (current !== undefined) return current
  const skill = currentSkill(db, skillId)
  const auto = autoAssessCandidate(db, candidate)
  return auto[skillId] ?? {
    level: skill?.scale?.[skill.scale.length - 1]?.value ?? 'low',
    confidence: 'low',
    evidence: [],
    rationale: '缺少评估记录。',
    method: 'missing',
    source: 'auto',
  }
}

export function evaluateCandidate(db, candidate, template) {
  const weights = normalizeWeights(template.dimensions ?? [])
  // A zero-weight dimension is documented as "not considered", so it must not
  // contribute points, gate failures, or a hit in the denominator.
  const dimensions = weights.filter(dimension => (Number(dimension.weight) || 0) > 0)
  const derivation = []
  let total = 0
  let hits = 0
  const gateFailures = []
  for (const dimension of dimensions) {
    const skill = currentSkill(db, dimension.skillId)
    const assessment = assessmentFor(db, candidate, dimension.skillId)
    let score = levelScore(skill, assessment.level)
    // A template may name its target industry keywords. Domain knowledge is the
    // one dimension that must be judged against that industry: a strong general
    // domain score cannot substitute for the industry the role is hiring for.
    let focusMiss = false
    if (dimension.skillId === 'domain-knowledge' && (template.focus?.keywords ?? []).length > 0) {
      if (!focusMatch(candidate, template.focus.keywords)) {
        focusMiss = true
        score = Math.min(score, 0.4)
      }
    }
    const contribution = score * dimension.normalized * 100
    total += contribution
    if (score >= (template.hitMinScore ?? 0.6)) hits += 1
    const gateMinScore = levelScore(skill, dimension.gateMin)
    const gateFailed = dimension.gate === true && score < gateMinScore
    if (gateFailed) gateFailures.push(skill?.name ?? dimension.skillId)
    derivation.push({
      candidateId: candidate.id,
      skillId: dimension.skillId,
      name: skill?.name ?? dimension.skillId,
      shortName: skill?.shortName ?? skill?.name ?? dimension.skillId,
      weight: dimension.weight,
      normalizedWeight: dimension.normalized,
      level: assessment.level,
      levelLabel: focusMiss
        ? `${levelLabel(skill, assessment.level)}（行业不匹配，按 0.4 计）`
        : levelLabel(skill, assessment.level),
      score,
      contribution,
      confidence: assessment.confidence ?? 'low',
      source: assessment.source ?? 'auto',
      evidence: focusMiss
        ? [...(assessment.evidence ?? []), `未命中本岗位行业关键词（${(template.focus?.industry ?? '') || '目标行业'}），该维度按上限 0.4 计。`]
        : (assessment.evidence ?? []),
      rationale: assessment.rationale ?? '',
      method: assessment.method ?? '',
      annotation: focusMiss ? '行业不匹配' : (assessment.annotation ?? ''),
      focusMiss,
      gate: dimension.gate === true,
      gateMin: dimension.gateMin ?? '',
      gateFailed,
    })
  }
  total = Math.round(total * 10) / 10
  const decision = gateFailures.length > 0
    ? 'hold'
    : total >= (template.decision?.recommend ?? 70)
      ? 'recommend'
      : total >= (template.decision?.backup ?? 55)
        ? 'backup'
        : 'hold'
  return {
    candidateId: candidate.id,
    alias: candidate.alias,
    major: candidate.major,
    degree: candidate.degree,
    direction: candidate.direction,
    total,
    hits,
    decision,
    gateFailures,
    derivation,
  }
}

function tieBreakValue(result, template) {
  return (template.tieBreak ?? []).map(skillId => {
    const dimension = result.derivation.find(item => item.skillId === skillId)
    return dimension?.score ?? 0
  })
}

function compareResults(a, b, template) {
  if (b.total !== a.total) return b.total - a.total
  if (b.hits !== a.hits) return b.hits - a.hits
  const aValues = tieBreakValue(a, template)
  const bValues = tieBreakValue(b, template)
  for (let index = 0; index < Math.max(aValues.length, bValues.length); index += 1) {
    const diff = (bValues[index] ?? 0) - (aValues[index] ?? 0)
    if (diff !== 0) return diff
  }
  return String(a.alias).localeCompare(String(b.alias), 'zh')
}

export function rankCandidates(db, template, options = {}) {
  // A batch (or any explicit pool) must be ranked on its own: candidates from
  // different interview batches are never compared against each other.
  const pool = Array.isArray(options.candidateIds)
    ? options.candidateIds.map(id => db.candidates[id]).filter(Boolean)
    : Object.values(db.candidates)
  const results = pool.map(candidate => evaluateCandidate(db, candidate, template))
  results.sort((a, b) => compareResults(a, b, template))
  results.forEach((result, index) => { result.rank = index + 1 })
  const legacy = [...results].sort((a, b) => b.hits - a.hits || b.total - a.total)
  const legacyRank = new Map(legacy.map((result, index) => [result.candidateId, index + 1]))
  for (const result of results) {
    result.legacyHits = result.hits
    result.legacyRank = legacyRank.get(result.candidateId) ?? result.rank
    result.rankShift = result.legacyRank - result.rank
  }
  return results
}

export function biasDiagnostics(db, template) {
  const results = rankCandidates(db, template)
  const total = results.length
  const recommend = results.filter(result => result.decision === 'recommend')
  const majorCounts = (items) => {
    const map = new Map()
    for (const item of items) map.set(item.major || '未填写', (map.get(item.major || '未填写') ?? 0) + 1)
    return [...map.entries()]
      .map(([major, count]) => ({ major, count, share: items.length === 0 ? 0 : count / items.length }))
      .sort((a, b) => b.count - a.count)
  }
  const dimensions = []
  const totalWeight = template.dimensions.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0) || 1
  const dominantOf = (result) => {
    let best = null
    for (const item of result.derivation) {
      if (best === null || item.contribution > best.contribution) best = item
    }
    return best
  }
  for (const dimension of template.dimensions ?? []) {
    const skill = currentSkill(db, dimension.skillId)
    const values = results.map(result => result.derivation.find(item => item.skillId === dimension.skillId))
    const passers = results.filter((result) => {
      const item = result.derivation.find(entry => entry.skillId === dimension.skillId)
      return (item?.score ?? 0) >= (template.hitMinScore ?? 0.6)
    })
    const majors = majorCounts(passers)
    const top = majors[0] ?? { major: '—', count: 0, share: 0 }
    const avgScore = values.length === 0 ? 0 : values.reduce((sum, item) => sum + (item?.score ?? 0), 0) / values.length
    const spread = values.length === 0 ? 0 : Math.max(...values.map(item => item?.score ?? 0)) - Math.min(...values.map(item => item?.score ?? 0))
    const zeroed = template.dimensions.map(item => ({ ...item, weight: item.skillId === dimension.skillId ? 0 : item.weight }))
    const doubled = template.dimensions.map(item => ({ ...item, weight: item.skillId === dimension.skillId ? item.weight * 2 : item.weight }))
    const baseRank = new Map(results.map(result => [result.candidateId, result.rank]))
    const zeroRank = new Map(rankCandidates(db, { ...template, dimensions: zeroed }).map(result => [result.candidateId, result.rank]))
    const doubleRank = new Map(rankCandidates(db, { ...template, dimensions: doubled }).map(result => [result.candidateId, result.rank]))
    let maxShift = 0
    for (const result of results) {
      maxShift = Math.max(
        maxShift,
        Math.abs((zeroRank.get(result.candidateId) ?? result.rank) - baseRank.get(result.candidateId)),
        Math.abs((doubleRank.get(result.candidateId) ?? result.rank) - baseRank.get(result.candidateId)),
      )
    }
    const normalizedWeight = Math.max(0, Number(dimension.weight) || 0) / totalWeight
    // Which candidates does this dimension actually drive? Its "dominant" rows.
    const dominantRows = results.filter((result) => dominantOf(result)?.skillId === dimension.skillId)
    const dominantMajors = majorCounts(dominantRows)
    const dominantTop = dominantMajors[0] ?? { major: '—', count: 0, share: 0 }
    const flags = []
    if (top.share >= 0.6 && normalizedWeight >= 0.1 && passers.length >= 2) {
      flags.push({ kind: 'concentration', text: `该维度入选者中「${top.major}」占 ${Math.round(top.share * 100)}%，权重 ${Math.round(normalizedWeight * 100)}%，可能把结果推向单一专业。` })
    }
    if (dominantTop.share >= 0.5 && dominantRows.length >= 3 && normalizedWeight >= 0.08 && dominantTop.major !== '—') {
      flags.push({ kind: 'dominant', text: `该维度是 ${dominantRows.length} 位候选人的最大贡献项，其中「${dominantTop.major}」占 ${Math.round(dominantTop.share * 100)}%；权重 ${Math.round(normalizedWeight * 100)}% 时容易系统性放大这一类背景。` })
    }
    if (dominantRows.length >= 3 && results.length > 0 && dominantRows.length / results.length >= 0.5) {
      flags.push({ kind: 'dominantDim', text: `该维度是 ${dominantRows.length}/${results.length} 位候选人的最大贡献项，实际上主导了本次排序。` })
    }
    if (spread < 0.15) flags.push({ kind: 'flat', text: '该维度在当前候选池中区分度很低，几乎不改变排序。' })
    if (maxShift >= 2) flags.push({ kind: 'impact', text: `权重归零或翻倍时，最大位次变化 ${maxShift} 名。` })
    dimensions.push({
      skillId: dimension.skillId,
      name: skill?.name ?? dimension.skillId,
      weight: dimension.weight,
      normalizedWeight,
      avgScore,
      spread,
      passCount: passers.length,
      passRate: total === 0 ? 0 : passers.length / total,
      topMajor: top.major,
      topMajorShare: top.share,
      majorBreakdown: majors,
      dominantCount: dominantRows.length,
      dominantMajor: dominantTop.major,
      dominantShare: dominantTop.share,
      dominantBreakdown: dominantMajors,
      maxRankShift: maxShift,
      flags,
    })
  }
  const recommendedMajors = majorCounts(recommend)
  const poolMajors = majorCounts(results)
  const warnings = []
  for (const dimension of dimensions) {
    for (const flag of dimension.flags) {
      if (flag.kind === 'concentration' || flag.kind === 'dominant') warnings.push(`${dimension.name}：${flag.text}`)
      if (flag.kind === 'dominantDim') warnings.push(`观察·${dimension.name}：${flag.text}`)
    }
  }
  const topRecommended = recommendedMajors[0]
  if (topRecommended && topRecommended.share >= 0.6 && recommend.length >= 3) {
    warnings.push(`推荐名单中「${topRecommended.major}」占 ${Math.round(topRecommended.share * 100)}%，建议调整权重或扩大候选池。`)
  }
  // Compare with a sibling template in the same family to make weight drift visible.
  const siblings = Object.values(db.templates)
    .filter(record => record.id !== template.id)
    .map(record => record.versions.find(item => item.version === record.currentVersion)?.definition)
    .filter(definition => definition !== undefined && definition.family === template.family)
  let contrast = null
  if (siblings.length > 0) {
    const sibling = siblings[0]
    const siblingResults = rankCandidates(db, sibling)
    const siblingRecommend = siblingResults.filter(result => result.decision === 'recommend')
    const siblingMajors = majorCounts(siblingRecommend)
    const drift = []
    for (const major of new Set([...recommendedMajors.map(item => item.major), ...siblingMajors.map(item => item.major)])) {
      const a = recommendedMajors.find(item => item.major === major)?.count ?? 0
      const b = siblingMajors.find(item => item.major === major)?.count ?? 0
      if (a !== b) drift.push({ major, current: a, sibling: b, delta: a - b })
    }
    contrast = {
      templateId: sibling.id,
      templateName: sibling.name,
      currentRecommended: recommend.length,
      siblingRecommended: siblingRecommend.length,
      currentMajors: recommendedMajors,
      siblingMajors,
      drift,
    }
    const riskMajors = drift.filter(item => item.sibling >= 2 && item.delta <= -1)
    if (riskMajors.length > 0) {
      warnings.push(`与同岗位族的「${sibling.name}」相比，本模板推荐名单中 ${riskMajors.map(item => `「${item.major}」${item.sibling}→${item.current}`).join('、')}；这通常来自跨学科/落地类维度的权重差。`)
    }
  }
  if (recommend.length === 0) warnings.push('当前模板没有候选人达到推荐线，可下调阈值或补充候选人。')
  return {
    total,
    recommendCount: recommend.length,
    backupCount: results.filter(result => result.decision === 'backup').length,
    holdCount: results.filter(result => result.decision === 'hold').length,
    recommendedMajors,
    poolMajors,
    dimensions,
    warnings,
    contrast,
    top: results.slice(0, 5).map(result => ({
      candidateId: result.candidateId,
      alias: result.alias,
      major: result.major,
      total: result.total,
      rank: result.rank,
      decision: result.decision,
    })),
  }
}

export function dashboardStats(db) {
  const template = currentTemplate(db, db.settings?.activeTemplateId) ?? currentTemplate(db, Object.keys(db.templates)[0])
  const results = template ? rankCandidates(db, template) : []
  return {
    candidates: Object.keys(db.candidates).length,
    templates: Object.keys(db.templates).length,
    skills: Object.keys(db.skills).length,
    runs: (db.runs ?? []).length,
    ledgerLength: (db.ledger ?? []).length,
    recommended: results.filter(result => result.decision === 'recommend').length,
    backup: results.filter(result => result.decision === 'backup').length,
    hold: results.filter(result => result.decision === 'hold').length,
    avgScore: results.length === 0 ? 0 : Math.round(results.reduce((sum, result) => sum + result.total, 0) / results.length * 10) / 10,
    activeTemplateId: template?.id ?? db.settings?.activeTemplateId ?? '',
  }
}

export function buildRunSnapshot(db, templateId) {
  const template = currentTemplate(db, templateId)
  if (template === undefined) throw new Error('模板不存在')
  const results = rankCandidates(db, template)
  const skillVersions = {}
  for (const dimension of template.dimensions ?? []) {
    const record = db.skills[dimension.skillId]
    if (record !== undefined) skillVersions[dimension.skillId] = record.currentVersion
  }
  const recommend = results.filter(result => result.decision === 'recommend')
  const majorMap = new Map()
  for (const result of recommend) majorMap.set(result.major, (majorMap.get(result.major) ?? 0) + 1)
  return {
    id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    templateId,
    templateName: template.name,
    templateVersion: template.version,
    skillVersions,
    generatedAt: nowIso(),
    summary: {
      total: results.length,
      recommended: recommend.length,
      backup: results.filter(result => result.decision === 'backup').length,
      hold: results.filter(result => result.decision === 'hold').length,
      avgScore: results.length === 0 ? 0 : Math.round(results.reduce((sum, result) => sum + result.total, 0) / results.length * 10) / 10,
      majorMix: [...majorMap.entries()].map(([major, count]) => ({ major, count })),
    },
    results: results.map(result => ({
      candidateId: result.candidateId,
      alias: result.alias,
      major: result.major,
      total: result.total,
      hits: result.hits,
      rank: result.rank,
      decision: result.decision,
      gateFailures: result.gateFailures,
      dimensions: result.derivation.map(item => ({
        skillId: item.skillId,
        name: item.name,
        level: item.level,
        levelLabel: item.levelLabel,
        weight: item.weight,
        contribution: item.contribution,
        score: item.score,
      })),
    })),
  }
}

export function buildReportMarkdown(db, template) {
  const results = rankCandidates(db, template)
  const diagnostics = biasDiagnostics(db, template)
  const lines = []
  lines.push(`# ${template.name} · 筛选推导报告`)
  lines.push('')
  lines.push(`生成时间：${new Date().toLocaleString('zh-CN')}`)
  lines.push('')
  lines.push('> 本报告由本地人才匹配工作台生成。人物为虚构示例或本地录入；姓名/联系方式/简历原文不会写入任何交换包。')
  lines.push('')
  lines.push('## 一、模板权重')
  lines.push('')
  lines.push('| 维度 | 权重 | 归一化 | 门槛 |')
  lines.push('|---|---:|---:|---|')
  const totalWeight = template.dimensions.reduce((sum, item) => sum + item.weight, 0)
  for (const item of template.dimensions) {
    const skill = currentSkill(db, item.skillId)
    lines.push(`| ${skill?.name ?? item.skillId} | ${item.weight} | ${Math.round(item.weight / totalWeight * 100)}% | ${item.gate ? `≥ ${LEVEL_LABEL[item.gateMin] ?? item.gateMin}` : '—'} |`)
  }
  lines.push('')
  lines.push('## 二、排序与结论')
  lines.push('')
  lines.push('| 排名 | 候选人 | 专业 | 加权分 | 命中维度 | 结论 | 关键推导 |')
  lines.push('|---:|---|---|---:|---:|---|---|')
  for (const result of results) {
    const top = [...result.derivation].sort((a, b) => b.contribution - a.contribution).slice(0, 3)
      .map(item => `${item.shortName} ${item.levelLabel}`).join('；')
    lines.push(`| ${result.rank} | ${result.alias} | ${result.major} | ${result.total} | ${result.hits}/${result.derivation.length} | ${decisionLabel(result.decision)} | ${top} |`)
  }
  lines.push('')
  lines.push('## 三、偏差诊断')
  lines.push('')
  for (const dimension of diagnostics.dimensions) {
    lines.push(`- **${dimension.name}**：权重 ${Math.round(dimension.normalizedWeight * 100)}%，平均分 ${dimension.avgScore.toFixed(2)}，入选者最多专业为「${dimension.topMajor}」（${Math.round(dimension.topMajorShare * 100)}%），权重扰动最大位次变化 ${dimension.maxRankShift} 名。`)
  }
  lines.push('')
  if (diagnostics.warnings.length > 0) {
    lines.push('### 需要复核的信号')
    lines.push('')
    for (const warning of diagnostics.warnings) lines.push(`- ${warning}`)
    lines.push('')
  }
  lines.push('## 四、隐私边界')
  lines.push('')
  lines.push('- 本报告与数据库只保存在本机；插件不发起任何网络请求。')
  lines.push('- 交换包只包含维度均值、权重分布与样本量分级，不含姓名、学校、联系方式、简历原文或候选人 ID。')
  lines.push('- 模板与维度技能均在本地保留版本历史，可回溯。')
  return lines.join('\n')
}

export function decisionLabel(decision) {
  if (decision === 'recommend') return '推荐面试'
  if (decision === 'backup') return '备选'
  if (decision === 'hold') return '暂缓'
  return decision
}

export function levelOptionsFor(db, skillId) {
  const skill = currentSkill(db, skillId)
  return skill?.scale ?? []
}

export function skillSummaries(db) {
  return Object.values(db.skills).map(record => {
    const spec = record.versions.find(item => item.version === record.currentVersion)?.spec
    return {
      id: record.id,
      name: spec?.name ?? record.id,
      shortName: spec?.shortName ?? spec?.name ?? record.id,
      key: spec?.key ?? record.id,
      description: spec?.description ?? '',
      defaultWeight: spec?.defaultWeight ?? 0,
      currentVersion: record.currentVersion,
      versionCount: record.versions.length,
      scale: spec?.scale ?? [],
      order: spec?.order ?? 99,
    }
  }).sort((a, b) => a.order - b.order)
}

export function templateSummaries(db) {
  return Object.values(db.templates).map(record => {
    const definition = record.versions.find(item => item.version === record.currentVersion)?.definition
    return {
      id: record.id,
      name: definition?.name ?? record.id,
      family: definition?.family ?? '',
      description: definition?.description ?? '',
      currentVersion: record.currentVersion,
      versionCount: record.versions.length,
      dimensionCount: definition?.dimensions?.length ?? 0,
      updatedAt: record.versions[record.versions.length - 1]?.createdAt ?? '',
    }
  })
}
