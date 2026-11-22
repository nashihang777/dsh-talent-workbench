/**
 * Privacy-preserving exchange layer.
 *
 * There is no network call here. A "pack" contains only anonymized aggregates
 * (means, normalized weights, level shares, sample-size buckets). The local
 * ledger is a hash chain for tamper evidence; it is a local prototype of the
 * collaborative-evolution idea, not a connection to a public blockchain.
 */
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { biasDiagnostics, currentSkill, currentTemplate, rankCandidates } from './engine.js'

export const PACK_SCHEMA = 'talent-screening-exchange/v1'
const MAX_STRING = 60

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export function hmacSha256(secret, text) {
  return createHmac('sha256', secret).update(text, 'utf8').digest('hex')
}

export function sampleBucket(count) {
  if (count <= 0) return '0'
  if (count < 10) return '1-9'
  if (count < 50) return '10-49'
  if (count < 200) return '50-199'
  if (count < 1000) return '200-999'
  return '1000+'
}

function round2(value) {
  return Math.round(value * 100) / 100
}

const PII_PATTERNS = [
  { name: 'email', pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/i },
  { name: 'phone', pattern: /(?:\+?86[- ]?)?1[3-9]\d{9}/ },
  { name: 'id-card', pattern: /\b\d{17}[\dXx]\b/ },
  { name: 'url', pattern: /https?:\/\//i },
  { name: 'long-digits', pattern: /\b\d{8,}\b/ },
]

const ALLOWED_TOP = new Set([
  'schema', 'contributor', 'generatedAt', 'sample', 'privacy', 'dimensions', 'templates', 'calibration', 'integrity',
])
const ALLOWED_DIMENSION = new Set([
  'id', 'version', 'meanScore', 'levelShares', 'weightMean', 'weightSamples', 'successMean', 'sampleBucket',
])
const ALLOWED_TEMPLATE = new Set(['family', 'dimensionCount', 'hitMinScore', 'weights', 'sampleBucket'])
const ALLOWED_WEIGHT = new Set(['id', 'weight'])

function validateString(value, path, errors, { scanPii = true } = {}) {
  if (typeof value !== 'string') {
    errors.push(`${path} 必须是字符串`)
    return false
  }
  if (value.length > MAX_STRING) {
    errors.push(`${path} 超过 ${MAX_STRING} 字符，可能是自由文本`)
    return false
  }
  if (!scanPii) return true
  for (const rule of PII_PATTERNS) {
    if (rule.pattern.test(value)) errors.push(`${path} 命中隐私特征：${rule.name}`)
  }
  return true
}

function checkKeys(object, allowed, path, errors) {
  if (object === null || typeof object !== 'object' || Array.isArray(object)) {
    errors.push(`${path} 必须是对象`)
    return false
  }
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) errors.push(`${path}.${key} 不在允许字段内`)
  }
  return true
}

function checkNumber(value, path, errors, min = -1e9, max = 1e9) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    errors.push(`${path} 必须是 ${min}—${max} 的数字`)
    return false
  }
  return true
}

/**
 * Strict schema + privacy check. A pack is deliberately unable to carry names,
 * schools, candidate ids, evidence text or URLs.
 */
export function validatePack(pack) {
  const errors = []
  if (!checkKeys(pack, ALLOWED_TOP, 'pack', errors)) return { ok: false, errors }
  if (pack.schema !== PACK_SCHEMA) errors.push(`schema 必须是 ${PACK_SCHEMA}`)
  // Structured identifiers are constrained by their own regex; the free-text PII
  // scan would flag a UUID that happens to contain eight digits in a row.
  validateString(pack.contributor, 'pack.contributor', errors, { scanPii: false })
  if (!/^ts-[a-f0-9-]{8,40}$/.test(String(pack.contributor))) errors.push('pack.contributor 必须是匿名实例标识')
  validateString(pack.generatedAt, 'pack.generatedAt', errors, { scanPii: false })
  if (Number.isNaN(Date.parse(String(pack.generatedAt)))) errors.push('pack.generatedAt 必须是 ISO 时间')
  if (pack.integrity !== undefined && (typeof pack.integrity !== 'string' || !/^[a-f0-9]{64}$/.test(pack.integrity))) {
    errors.push('pack.integrity 必须是 64 位十六进制哈希')
  }

  checkKeys(pack.sample, new Set(['bucket', 'templates', 'assessments']), 'pack.sample', errors)
  if (!['0', '1-9', '10-49', '50-199', '200-999', '1000+'].includes(String(pack.sample?.bucket))) {
    errors.push('pack.sample.bucket 不合法')
  }
  checkNumber(pack.sample?.templates, 'pack.sample.templates', errors, 0, 100)
  checkNumber(pack.sample?.assessments, 'pack.sample.assessments', errors, 0, 100000)
  checkKeys(pack.privacy, new Set(['personalData', 'aggregation', 'fields']), 'pack.privacy', errors)
  if (pack.privacy?.personalData !== false) errors.push('pack.privacy.personalData 必须为 false')
  validateString(pack.privacy?.aggregation, 'pack.privacy.aggregation', errors)
  if (!Array.isArray(pack.privacy?.fields)) errors.push('pack.privacy.fields 必须是数组')
  else for (const [index, field] of pack.privacy.fields.entries()) validateString(field, `pack.privacy.fields[${index}]`, errors)

  if (!Array.isArray(pack.dimensions) || pack.dimensions.length === 0 || pack.dimensions.length > 100) {
    errors.push('pack.dimensions 必须是 1—100 个元素')
  } else {
    for (const [index, dimension] of pack.dimensions.entries()) {
      checkKeys(dimension, ALLOWED_DIMENSION, `pack.dimensions[${index}]`, errors)
      validateString(dimension.id, `pack.dimensions[${index}].id`, errors)
      if (!/^[a-z0-9-]{2,40}$/.test(String(dimension.id))) errors.push(`pack.dimensions[${index}].id 不合法`)
      checkNumber(dimension.version, `pack.dimensions[${index}].version`, errors, 1, 100000)
      checkNumber(dimension.meanScore, `pack.dimensions[${index}].meanScore`, errors, 0, 1)
      checkNumber(dimension.weightMean, `pack.dimensions[${index}].weightMean`, errors, 0, 1)
      checkNumber(dimension.weightSamples, `pack.dimensions[${index}].weightSamples`, errors, 0, 100000)
      if (dimension.successMean !== null) checkNumber(dimension.successMean, `pack.dimensions[${index}].successMean`, errors, 0, 1)
      if (!['0', '1-9', '10-49', '50-199', '200-999', '1000+'].includes(String(dimension.sampleBucket))) {
        errors.push(`pack.dimensions[${index}].sampleBucket 不合法`)
      }
      checkKeys(dimension.levelShares, new Set(['high', 'upperMid', 'mid', 'lowerMid', 'low', 'yes', 'no', 'partial']), `pack.dimensions[${index}].levelShares`, errors)
      for (const [level, share] of Object.entries(dimension.levelShares ?? {})) {
        checkNumber(share, `pack.dimensions[${index}].levelShares.${level}`, errors, 0, 1)
      }
    }
  }

  if (!Array.isArray(pack.templates) || pack.templates.length === 0 || pack.templates.length > 100) {
    errors.push('pack.templates 必须是 1—100 个元素')
  } else {
    for (const [index, template] of pack.templates.entries()) {
      checkKeys(template, ALLOWED_TEMPLATE, `pack.templates[${index}]`, errors)
      validateString(template.family, `pack.templates[${index}].family`, errors)
      if (!/^[a-z0-9-]{2,40}$/.test(String(template.family))) errors.push(`pack.templates[${index}].family 不合法`)
      checkNumber(template.dimensionCount, `pack.templates[${index}].dimensionCount`, errors, 1, 100)
      checkNumber(template.hitMinScore, `pack.templates[${index}].hitMinScore`, errors, 0, 1)
      if (!Array.isArray(template.weights) || template.weights.length === 0) {
        errors.push(`pack.templates[${index}].weights 必须非空`)
      } else {
        for (const [weightIndex, weight] of template.weights.entries()) {
          checkKeys(weight, ALLOWED_WEIGHT, `pack.templates[${index}].weights[${weightIndex}]`, errors)
          validateString(weight.id, `pack.templates[${index}].weights[${weightIndex}].id`, errors)
          checkNumber(weight.weight, `pack.templates[${index}].weights[${weightIndex}].weight`, errors, 0, 1)
        }
      }
      if (!['0', '1-9', '10-49', '50-199', '200-999', '1000+'].includes(String(template.sampleBucket))) {
        errors.push(`pack.templates[${index}].sampleBucket 不合法`)
      }
    }
  }

  checkKeys(pack.calibration, new Set(['scoring', 'recommendRate', 'avgScore']), 'pack.calibration', errors)
  validateString(pack.calibration?.scoring, 'pack.calibration.scoring', errors)
  checkNumber(pack.calibration?.recommendRate, 'pack.calibration.recommendRate', errors, 0, 1)
  checkNumber(pack.calibration?.avgScore, 'pack.calibration.avgScore', errors, 0, 100)
  return { ok: errors.length === 0, errors }
}

export function verifyPackIntegrity(pack) {
  const copy = { ...pack }
  const expected = pack.integrity
  delete copy.integrity
  const actual = sha256(canonicalJson(copy))
  return { ok: expected === actual, expected, actual }
}

export function buildExchangePack(db, instance) {
  const candidates = Object.values(db.candidates)
  const templates = Object.values(db.templates)
    .map(record => record.versions.find(item => item.version === record.currentVersion)?.definition)
    .filter(Boolean)
  const results = []
  for (const template of templates) {
    results.push({ template, rows: rankCandidates(db, template) })
  }
  const allAssessments = results.flatMap(entry => entry.rows.flatMap(row => row.derivation))
  const assessmentCount = allAssessments.length
  const dimensionIds = [...new Set(templates.flatMap(template => template.dimensions.map(item => item.skillId)))]
  const dimensions = []
  for (const skillId of dimensionIds) {
    const skill = currentSkill(db, skillId)
    const entries = allAssessments.filter(item => item.skillId === skillId)
    if (entries.length === 0) continue
    const meanScore = entries.reduce((sum, item) => sum + item.score, 0) / entries.length
    const shares = {}
    for (const entry of entries) {
      shares[entry.level] = (shares[entry.level] ?? 0) + 1
    }
    for (const key of Object.keys(shares)) shares[key] = round2(shares[key] / entries.length)
    const weightEntries = results.flatMap(entry => entry.template.dimensions
      .filter(item => item.skillId === skillId)
      .map(item => ({ weight: item.weight, total: entry.template.dimensions.reduce((sum, dim) => sum + dim.weight, 0) })))
    const weightMean = weightEntries.length === 0
      ? 0
      : weightEntries.reduce((sum, item) => sum + item.weight / (item.total || 1), 0) / weightEntries.length
    const recommended = entries.filter(entry => {
      const row = results.flatMap(item => item.rows).find(item => item.candidateId === entry.candidateId)
      return row?.decision === 'recommend'
    })
    const successMean = recommended.length === 0
      ? null
      : round2(recommended.reduce((sum, item) => sum + item.score, 0) / recommended.length)
    dimensions.push({
      id: skillId,
      version: db.skills[skillId]?.currentVersion ?? 1,
      meanScore: round2(meanScore),
      levelShares: shares,
      weightMean: round2(weightMean),
      weightSamples: weightEntries.length,
      successMean,
      sampleBucket: sampleBucket(entries.length),
    })
  }
  const templatePacks = templates.map(template => {
    const total = template.dimensions.reduce((sum, item) => sum + item.weight, 0) || 1
    return {
      family: template.family || 'general',
      dimensionCount: template.dimensions.length,
      hitMinScore: template.hitMinScore ?? 0.6,
      weights: template.dimensions.map(item => ({ id: item.skillId, weight: round2(item.weight / total) })),
      sampleBucket: sampleBucket(candidates.length),
    }
  })
  const allRows = results.flatMap(entry => entry.rows)
  const recommendRate = allRows.length === 0 ? 0 : allRows.filter(row => row.decision === 'recommend').length / allRows.length
  const avgScore = allRows.length === 0 ? 0 : allRows.reduce((sum, row) => sum + row.total, 0) / allRows.length
  const payload = {
    schema: PACK_SCHEMA,
    contributor: instance.contributorId,
    generatedAt: new Date().toISOString(),
    sample: {
      bucket: sampleBucket(candidates.length),
      templates: templates.length,
      assessments: assessmentCount,
    },
    privacy: {
      personalData: false,
      aggregation: '仅维度均值/权重/等级占比/样本量分级；不含姓名、学校、联系方式、简历原文或候选人 ID',
      fields: ['dimension means', 'weight distribution', 'level shares', 'sample-size bucket', 'template weight vectors'],
    },
    dimensions,
    templates: templatePacks,
    calibration: {
      scoring: 'weighted-0-100',
      recommendRate: round2(recommendRate),
      avgScore: round2(avgScore),
    },
  }
  payload.integrity = sha256(canonicalJson(payload))
  return payload
}

export function appendLedger(db, instance, kind, payload, note = '') {
  const ledger = Array.isArray(db.ledger) ? db.ledger : []
  const previous = ledger[ledger.length - 1]
  const prevHash = previous?.hash ?? '0'.repeat(64)
  const payloadHash = sha256(canonicalJson(payload))
  const createdAt = new Date().toISOString()
  const index = (previous?.index ?? 0) + 1
  const hash = sha256(`${prevHash}|${payloadHash}|${createdAt}|${instance.contributorId}|${kind}`)
  const entry = {
    index,
    kind,
    createdAt,
    contributor: instance.contributorId,
    payloadHash,
    prevHash,
    hash,
    signature: hmacSha256(instance.secret, hash),
    note,
    payload,
  }
  ledger.push(entry)
  db.ledger = ledger
  return entry
}

export function verifyLedger(db, instance) {
  const ledger = Array.isArray(db.ledger) ? db.ledger : []
  let previousHash = '0'.repeat(64)
  const issues = []
  for (const entry of ledger) {
    const payloadHash = sha256(canonicalJson(entry.payload))
    const hash = sha256(`${previousHash}|${payloadHash}|${entry.createdAt}|${entry.contributor}|${entry.kind}`)
    if (entry.prevHash !== previousHash) issues.push(`#${entry.index} prevHash 不连续`)
    if (entry.payloadHash !== payloadHash) issues.push(`#${entry.index} payload 被修改`)
    if (entry.hash !== hash) issues.push(`#${entry.index} hash 不匹配`)
    if (entry.contributor === instance.contributorId) {
      const signature = hmacSha256(instance.secret, entry.hash)
      if (entry.signature !== signature) issues.push(`#${entry.index} 本机签名不匹配`)
    }
    previousHash = entry.hash
  }
  return {
    ok: issues.length === 0,
    length: ledger.length,
    lastHash: ledger[ledger.length - 1]?.hash ?? '',
    issues,
  }
}

function bucketMid(bucket) {
  if (bucket === '1-9') return 5
  if (bucket === '10-49') return 25
  if (bucket === '50-199') return 100
  if (bucket === '200-999') return 500
  if (bucket === '1000+') return 1000
  return 1
}

/**
 * Merge one validated anonymous pack and produce *suggestions only*. The user
 * decides whether to publish a new template version.
 */
export function mergePack(db, instance, pack) {
  const validation = validatePack(pack)
  if (!validation.ok) return { ok: false, errors: validation.errors }
  const integrity = verifyPackIntegrity(pack)
  if (!integrity.ok) return { ok: false, errors: ['交换包完整性校验失败，可能被修改过。'] }
  const hash = pack.integrity
  const existing = db.peerKnowledge?.[hash]
  if (existing !== undefined) {
    return { ok: true, duplicate: true, suggestions: existing.suggestions ?? null, peerCount: Object.keys(db.peerKnowledge).length }
  }
  if (pack.contributor === instance.contributorId) {
    // Re-importing your own export must not feed your own weights back as "peer" evidence.
    return {
      ok: true,
      selfEcho: true,
      duplicate: false,
      peerCount: Object.keys(db.peerKnowledge ?? {}).length,
      suggestions: null,
    }
  }
  const knowledge = db.peerKnowledge ?? {}
  const localTemplates = Object.values(db.templates)
    .map(record => record.versions.find(item => item.version === record.currentVersion)?.definition)
    .filter(Boolean)
  const weightSuggestions = []
  for (const template of localTemplates) {
    const matches = [pack, ...Object.values(knowledge).map(entry => entry.pack)]
      .filter(item => item.contributor !== instance.contributorId)
      .filter(item => item.templates.some(candidate => candidate.family === template.family))
    if (matches.length === 0) continue
    const localTotal = template.dimensions.reduce((sum, item) => sum + item.weight, 0) || 1
    const dimensionSuggestions = []
    for (const dimension of template.dimensions) {
      let weighted = 0
      let weightSum = 0
      for (const match of matches) {
        for (const candidate of match.templates.filter(item => item.family === template.family)) {
          const weight = candidate.weights.find(item => item.id === dimension.skillId)
          if (weight === undefined) continue
          const sample = bucketMid(candidate.sampleBucket)
          weighted += weight.weight * sample
          weightSum += sample
        }
      }
      if (weightSum === 0) continue
      const suggestedNormalized = weighted / weightSum
      const currentNormalized = dimension.weight / localTotal
      const delta = suggestedNormalized - currentNormalized
      if (Math.abs(delta) >= 0.01) {
        dimensionSuggestions.push({
          skillId: dimension.skillId,
          currentWeight: dimension.weight,
          currentNormalized: round2(currentNormalized),
          suggestedNormalized: round2(suggestedNormalized),
          delta: round2(delta),
          direction: delta > 0 ? 'up' : 'down',
        })
      }
    }
    if (dimensionSuggestions.length > 0) {
      const suggestedWeights = template.dimensions.map(dimension => {
        const suggestion = dimensionSuggestions.find(item => item.skillId === dimension.skillId)
        const currentNormalized = dimension.weight / localTotal
        const target = suggestion?.suggestedNormalized ?? currentNormalized
        const bounded = Math.max(currentNormalized - 0.05, Math.min(currentNormalized + 0.05, target))
        return { skillId: dimension.skillId, weight: Math.max(0, Math.round(bounded * 100)) }
      })
      const sum = suggestedWeights.reduce((total, item) => total + item.weight, 0) || 1
      weightSuggestions.push({
        templateId: template.id,
        templateName: template.name,
        sources: matches.length,
        dimensions: dimensionSuggestions,
        suggestedWeights: suggestedWeights,
        reason: `基于 ${matches.length} 个同岗位族的匿名交换包（样本量按分级中值加权）计算。`,
      })
    }
  }
  const dimensionSuggestions = []
  for (const dimension of pack.dimensions) {
    if (dimension.successMean === null) continue
    const delta = dimension.successMean - dimension.meanScore
    if (Math.abs(delta) < 0.05) continue
    dimensionSuggestions.push({
      skillId: dimension.id,
      meanScore: dimension.meanScore,
      successMean: dimension.successMean,
      delta: round2(delta),
      direction: delta > 0 ? 'up' : 'down',
      reason: delta > 0
        ? '同行样本中，该维度得分较高者更常进入推荐名单，可考虑保持或小幅上调。'
        : '同行样本中，该维度得分与推荐结果关联偏弱，可考虑下调。',
    })
  }
  const suggestions = { weightSuggestions, dimensionSuggestions }
  knowledge[hash] = {
    pack,
    importedAt: new Date().toISOString(),
    suggestions,
  }
  db.peerKnowledge = knowledge
  appendLedger(db, instance, 'import', {
    packHash: hash,
    contributor: pack.contributor,
    generatedAt: pack.generatedAt,
    schema: pack.schema,
    dimensions: pack.dimensions.map(item => item.id),
    templateFamilies: [...new Set(pack.templates.map(item => item.family))],
  }, '导入匿名交换包')
  return {
    ok: true,
    duplicate: false,
    peerCount: Object.keys(knowledge).length,
    suggestions,
    privacyReport: {
      personalData: false,
      checks: ['schema allowlist', 'PII pattern scan', 'integrity hash'],
      fields: pack.privacy.fields,
    },
  }
}

export function peerSummary(db) {
  const knowledge = db.peerKnowledge ?? {}
  const entries = Object.entries(knowledge).map(([hash, entry]) => ({
    hash,
    contributor: entry.pack.contributor,
    generatedAt: entry.pack.generatedAt,
    importedAt: entry.importedAt,
    sampleBucket: entry.pack.sample.bucket,
    dimensions: entry.pack.dimensions.length,
    templates: entry.pack.templates.length,
    families: [...new Set(entry.pack.templates.map(item => item.family))],
  }))
  return {
    count: entries.length,
    entries,
    families: [...new Set(entries.flatMap(entry => entry.families))],
  }
}

export function newInstanceIdentity() {
  const contributorId = `ts-${randomUUID()}`
  return { contributorId, secret: randomUUID().replace(/-/g, '') }
}

export function buildGenesisPayload() {
  return {
    schema: PACK_SCHEMA,
    note: '本地匿名交换账本创世记录。账本不联网；不包含任何人才信息，只记录本地实例与协议版本。',
    protocolVersion: 1,
  }
}

/**
 * A clearly-labelled fictional peer pack, so the collaborative-evolution flow
 * can be exercised without a network or a second installation. It carries only
 * aggregates and a different anonymous instance id.
 */
export function buildDemoPeerPack(db) {
  const weightPlan = {
    'tech-stack-match': 26,
    'cross-discipline': 4,
    'academic-level': 20,
    'engineering-gap': 8,
    'theory-depth': 12,
    'long-term-potential': 10,
    'research-depth': 14,
    'research-focus': 6,
  }
  const total = Object.values(weightPlan).reduce((sum, value) => sum + value, 0)
  const dimensions = Object.values(db.skills).map((record) => {
    const spec = record.versions.find(item => item.version === record.currentVersion)?.spec
    const first = spec?.scale?.[0]?.value ?? 'high'
    const middle = spec?.scale?.[Math.floor((spec?.scale?.length ?? 1) / 2)]?.value ?? 'mid'
    return {
      id: record.id,
      version: record.currentVersion,
      meanScore: 0.62,
      levelShares: { [first]: 0.24, [middle]: 0.56, low: 0.2 },
      weightMean: round2((weightPlan[record.id] ?? 10) / total),
      weightSamples: 14,
      successMean: record.id === 'tech-stack-match' || record.id === 'academic-level' ? 0.82 : 0.6,
      sampleBucket: '10-49',
    }
  })
  const payload = {
    schema: PACK_SCHEMA,
    contributor: 'ts-0a1b2c3d-4e5f-6789-abcd-ef0123456789',
    generatedAt: '2026-01-01T00:00:00.000Z',
    sample: { bucket: '10-49', templates: 1, assessments: 112 },
    privacy: {
      personalData: false,
      aggregation: '演示用虚构同行包：仅维度均值、等级占比、归一化权重与样本量分级',
      fields: ['dimension means', 'weight distribution', 'level shares', 'sample-size bucket'],
    },
    dimensions,
    templates: [{
      family: 'ai-rare-earth',
      dimensionCount: Object.keys(weightPlan).length,
      hitMinScore: 0.6,
      weights: Object.entries(weightPlan).map(([id, weight]) => ({ id, weight: round2(weight / total) })),
      sampleBucket: '10-49',
    }],
    calibration: { scoring: 'weighted-0-100', recommendRate: 0.29, avgScore: 71.5 },
  }
  payload.integrity = sha256(canonicalJson(payload))
  return payload
}
