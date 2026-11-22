import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'
import { biasDiagnostics, currentTemplate } from '../lib/engine.js'
import { validatePack, verifyPackIntegrity } from '../lib/exchange.js'
import { DEMO_CANDIDATES } from '../lib/seed.js'

const dir = mkdtempSync(join(tmpdir(), 'tw-smoke-'))
const { db, instance } = loadStore(dir)
// Sample candidates are display-only: a fresh database has none. Seed a small
// real-looking pool here so diagnostics and reports have something to chew on.
const now = new Date().toISOString()
for (const candidate of DEMO_CANDIDATES.slice(0, 6)) {
  db.candidates[candidate.id] = {
    ...candidate, source: 'manual', assessments: {}, tags: [], decisionOverride: null,
    createdAt: now, updatedAt: now,
  }
}
const wb = new TalentWorkbench({ dataDir: dir, db, instance, config: { allowRealNames: false }, onSkillsChanged: () => {} })
const state = wb.snapshot()
console.log('skills', state.skills.length, 'templates', state.templates.length, 'candidates', state.candidates.length)
for (const templateId of Object.keys(db.templates)) {
  const template = currentTemplate(db, templateId)
  const diagnostics = biasDiagnostics(db, template)
  console.log('\n==', template.name, 'v' + template.version, 'recommend=' + diagnostics.recommendCount, '/', diagnostics.total)
  console.log('majors:', diagnostics.recommendedMajors.map(item => `${item.major}${item.count}`).join(' '))
  for (const warning of diagnostics.warnings) console.log(' warn:', warning)
  if (diagnostics.contrast) {
    console.log(' contrast vs', diagnostics.contrast.templateName, 'drift', diagnostics.contrast.drift.map(item => `${item.major}:${item.sibling}->${item.current}`).join(', '))
  }
  console.log(' dims:', diagnostics.dimensions.map(item => `${item.name}(${Math.round(item.normalizedWeight * 100)}% pass${item.passCount} dom${item.dominantCount}·${item.dominantMajor})`).join(' | '))
}
const pack = wb.previewPack()
const validation = validatePack(pack)
console.log('\npack validation', validation.ok, validation.errors)
console.log('pack integrity', verifyPackIntegrity(pack).ok)
const strings = []
const walk = (value) => {
  if (typeof value === 'string') strings.push(value)
  else if (Array.isArray(value)) value.forEach(walk)
  else if (value && typeof value === 'object') Object.values(value).forEach(walk)
}
walk({ ...pack, privacy: { ...pack.privacy, aggregation: '' } })
const aliases = state.candidates.map(item => item.alias)
const leaked = aliases.filter(alias => strings.some(text => text.includes(alias)))
console.log('leaked aliases', leaked.length, leaked)
const exported = wb.exportPack()
console.log('export ledger', exported.ledgerIndex, 'chain ok', wb.verifyChain().ok)
const imported = wb.importPack(pack)
console.log('import duplicate?', imported.duplicate, 'peers', imported.peerCount, 'suggestions', imported.suggestions?.weightSuggestions?.length, imported.suggestions?.dimensionSuggestions?.length)
const created = wb.createCandidate({ alias: '候选人 测试', major: '控制科学与工程', degree: '硕士', direction: '过程控制', skills: ['Python'] })
wb.setAssessment(created.candidateId, 'tech-stack-match', 'high', { evidence: ['测试证据'] })
console.log('evaluated', wb.toolEvaluate(created.candidateId).summary)
console.log('run', wb.createRun().run.summary.recommended)
console.log('backup', wb.exportBackup().schema)
wb.rotateIdentity()
console.log('rotated', wb.snapshot().instance.contributorId.slice(0, 12))
console.log('reset', wb.resetAll().snapshot.candidates.length, 'chain', wb.snapshot().exchange.chainLength)
rmSync(dir, { recursive: true, force: true })
console.log('OK')
