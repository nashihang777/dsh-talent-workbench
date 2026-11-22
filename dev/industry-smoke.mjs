/**
 * Industry template self-check.
 *
 * Asserts that every industry template ranks its own fictional specialist
 * first, that the industry-focus cap works, and that a stored database without
 * the new content is migrated without touching existing versions.
 *
 * Run: node dev/industry-smoke.mjs
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore, saveStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'
import { autoAssessCandidate, currentTemplate, rankCandidates, evaluateCandidate, currentSkill } from '../lib/engine.js'
import { buildSeedDb, DEMO_CANDIDATES } from '../lib/seed.js'

let failures = 0
const check = (label, condition, detail = '') => {
  if (condition) console.log(`ok   ${label}`)
  else { failures += 1; console.log(`FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`) }
}

const dir = mkdtempSync(join(tmpdir(), 'tw-industry-'))
const { db, instance } = loadStore(dir)
// Sample candidates are display-only and no longer live in the database, so
// this fixture writes them explicitly to exercise the scoring engine.
const now = new Date().toISOString()
for (const candidate of DEMO_CANDIDATES) {
  db.candidates[candidate.id] = {
    ...candidate,
    createdAt: now,
    updatedAt: now,
    source: 'manual',
    assessments: {},
    tags: [],
    decisionOverride: null,
  }
}
const wb = new TalentWorkbench({ dataDir: dir, db, instance, config: {}, onSkillsChanged: () => {} })
const state = wb.snapshot()

check('19 dimension skills', state.skills.length === 19, String(state.skills.length))
check('13 templates', state.templates.length === 13, String(state.templates.length))
check('22 fixture candidates', state.candidates.length === 22, String(state.candidates.length))
check('fixture candidates are not source=demo', state.candidates.every(c => c.source !== 'demo'))
check('every candidate has an assessment for every skill',
  state.candidates.every(c => state.skills.every(s => c.assessments[s.id] !== undefined)))

const expected = {
  'tpl-ai-algorithm': '候选人 R',
  'tpl-backend-engineer': '候选人 S',
  'tpl-data-analyst': '候选人 T',
  'tpl-quant-research': '候选人 U',
  'tpl-product-b2b': '候选人 V',
  'tpl-implementation-pm': '候选人 W',
  'tpl-medical-device': '候选人 X',
  'tpl-compliance-risk': '候选人 X',
  'tpl-enterprise-sales': '候选人 Y',
  'tpl-manufacturing-support': '候选人 W',
}
for (const [templateId, alias] of Object.entries(expected)) {
  const template = currentTemplate(db, templateId)
  const rows = rankCandidates(db, template)
  check(`${templateId} ranks ${alias} first`, rows[0]?.alias === alias, `got ${rows[0]?.alias}`)
  check(`${templateId} recommends someone`, rows.some(row => row.decision === 'recommend'))
  check(`${templateId} declares industry focus`, (template.focus?.keywords ?? []).length > 0)
}

// The focus cap: a candidate with no medical wording must not beat the medical
// specialist on the medical template.
const medical = currentTemplate(db, 'tpl-medical-device')
const algorithmLead = Object.values(db.candidates).find(candidate => candidate.alias === '候选人 R')
const evaluated = evaluateCandidate(db, algorithmLead, medical)
const domainItem = evaluated.derivation.find(item => item.skillId === 'domain-knowledge')
check('industry mismatch caps domain knowledge', domainItem?.focusMiss === true && domainItem.score <= 0.4,
  JSON.stringify({ focusMiss: domainItem?.focusMiss, score: domainItem?.score }))
check('mismatch is explained in evidence', (domainItem?.evidence ?? []).some(line => line.includes('行业关键词')))

// Migration: a database with only the research content gains the new skills and
// templates, and keeps the version numbers it already had.
const legacyDir = mkdtempSync(join(tmpdir(), 'tw-legacy-'))
const legacyDb = buildSeedDb()
const keep = legacyDb.skills['tech-stack-match']
keep.versions.push({ version: 2, createdAt: new Date().toISOString(), note: 'user edit', spec: { ...keep.versions[0].spec, version: 2, defaultWeight: 30 } })
keep.currentVersion = 2
for (const id of Object.keys(legacyDb.skills)) {
  if (id !== 'tech-stack-match') delete legacyDb.skills[id]
}
for (const id of Object.keys(legacyDb.templates)) {
  if (id !== 'tpl-ai-rare-earth-calibrated') delete legacyDb.templates[id]
}
// A previous release stored the sample rows in the database.
for (const candidate of DEMO_CANDIDATES) {
  legacyDb.candidates[candidate.id] = {
    ...candidate, source: 'demo', assessments: {}, createdAt: now, updatedAt: now, tags: [], decisionOverride: null,
  }
}
saveStore(legacyDir, legacyDb)
const migrated = loadStore(legacyDir)
check('migration adds missing skills', Object.keys(migrated.db.skills).length === 19, String(Object.keys(migrated.db.skills).length))
check('migration adds missing templates', Object.keys(migrated.db.templates).length === 13, String(Object.keys(migrated.db.templates).length))
check('migration keeps the edited skill version', migrated.db.skills['tech-stack-match'].currentVersion === 2)
check('migration keeps the edited weight', currentSkill(migrated.db, 'tech-stack-match').defaultWeight === 30)
check('migration reports what it added', migrated.merged.skills.length > 0 && migrated.merged.templates.length > 0,
  JSON.stringify({ skills: migrated.merged.skills.length, templates: migrated.merged.templates.length }))
check('migration purges stored sample rows', migrated.merged.removedSamples === 22, String(migrated.merged.removedSamples))
check('legacy pool is empty after the purge', Object.keys(migrated.db.candidates).length === 0)

// Real (non-demo) pools must not receive sample candidates, and any sample rows
// a previous release stored are removed on load.
const realDir = mkdtempSync(join(tmpdir(), 'tw-real-'))
const realDb = buildSeedDb()
realDb.candidates['cand-real'] = {
  id: 'cand-real', alias: '真实候选人', major: '材料', degree: '硕士', school: '某大学', stage: '', direction: '',
  profileText: '', publications: [], projects: [], engineering: [], theory: [], roles: [], skills: [], awards: [], tags: [],
  notes: '', source: 'import', extraction: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  assessments: {}, decisionOverride: null,
}
// A leftover sample row from an older release.
realDb.candidates['cand-a'] = {
  ...DEMO_CANDIDATES[0], source: 'demo', assessments: {}, createdAt: now, updatedAt: now, tags: [], decisionOverride: null,
}
saveStore(realDir, realDb)
const realMigrated = loadStore(realDir)
check('stored sample rows are purged on load', realMigrated.db.candidates['cand-a'] === undefined)
check('real candidates survive the purge', realMigrated.db.candidates['cand-real'] !== undefined)
check('purge is reported', realMigrated.merged.removedSamples === 1, String(realMigrated.merged.removedSamples))
check('no sample candidates are injected', Object.keys(realMigrated.db.candidates).length === 1,
  String(Object.keys(realMigrated.db.candidates).length))
check('fresh database starts without candidates', Object.keys(buildSeedDb().candidates).length === 0)

// The Client embeds the sample candidates (display-only). Their precomputed
// levels must stay identical to what the engine produces today.
const clientSource = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const embedStart = clientSource.indexOf('const DEMO_CANDIDATES = [')
const embedEnd = clientSource.indexOf('\n    ]\n', embedStart)
check('client embeds the sample payload', embedStart > 0 && embedEnd > embedStart)
if (embedStart > 0 && embedEnd > embedStart) {
  const block = clientSource.slice(embedStart, embedEnd)
  const rows = [...block.matchAll(/^      (\{.*\}),$/gm)].map(match => JSON.parse(match[1]))
  check('embedded sample count matches the source', rows.length === DEMO_CANDIDATES.length, `${rows.length}/${DEMO_CANDIDATES.length}`)
  let drift = 0
  for (const row of rows) {
    const source = DEMO_CANDIDATES.find(candidate => candidate.id === row.id)
    if (source === undefined) { drift += 1; continue }
    const assessed = autoAssessCandidate(db, { ...source, assessments: {} })
    for (const [skillId, level] of Object.entries(row.assessments)) {
      if (level !== assessed[skillId]?.level) drift += 1
    }
    if (Object.keys(row.assessments).length !== 19) drift += 1
  }
  check('embedded levels match the engine', drift === 0, `${drift} mismatches`)
}

rmSync(dir, { recursive: true, force: true })
rmSync(legacyDir, { recursive: true, force: true })
rmSync(realDir, { recursive: true, force: true })
console.log(failures === 0 ? '\nindustry smoke: all checks passed' : `\nindustry smoke: ${failures} check(s) failed`)
process.exitCode = failures === 0 ? 0 : 1
