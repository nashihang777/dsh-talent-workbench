/**
 * Local document store. One JSON file under the DSH profile data directory,
 * written with a temp-file rename and a rolling backup. Nothing here touches
 * the network or the user's project workspace.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildGenesisPayload, appendLedger, newInstanceIdentity } from './exchange.js'
import { buildSeedDb, mergeSeedContent, renderSkillMarkdown } from './seed.js'

export function ensureDir(path) {
  mkdirSync(path, { recursive: true })
  return path
}

export function loadStore(dataDir) {
  ensureDir(dataDir)
  const dbPath = join(dataDir, 'db.json')
  const backupPath = join(dataDir, 'db.backup.json')
  let db
  let loadedFrom = 'new'
  if (existsSync(dbPath)) {
    try {
      db = JSON.parse(readFileSync(dbPath, 'utf8'))
      loadedFrom = 'db'
    } catch (error) {
      if (existsSync(backupPath)) {
        try {
          db = JSON.parse(readFileSync(backupPath, 'utf8'))
          loadedFrom = 'backup'
          copyFileSync(dbPath, join(dataDir, `db.corrupt-${Date.now()}.json`))
        } catch {
          loadedFrom = 'new'
        }
      }
    }
  }
  if (db === undefined) db = buildSeedDb()
  db = ensureShape(db)
  // A newer release may ship additional dimensions and role templates; add the
  // missing ones without touching versions the user already edited.
  const merged = mergeSeedContent(db)
  const instance = loadInstance(dataDir)
  let seededGenesis = false
  if (!Array.isArray(db.ledger) || db.ledger.length === 0) {
    appendLedger(db, instance, 'genesis', buildGenesisPayload(), '本地匿名交换账本创世记录')
    seededGenesis = true
  }
  const grewContent = merged.skills.length > 0 || merged.templates.length > 0 || merged.removedSamples > 0
  if (loadedFrom !== 'db' || db.createdAt === undefined || seededGenesis || grewContent) saveStore(dataDir, db)
  return { db, instance, dataDir, loadedFrom, merged }
}

export function ensureShape(db) {
  const seed = buildSeedDb()
  const next = db && typeof db === 'object' ? db : seed
  next.schemaVersion = next.schemaVersion ?? 1
  next.createdAt = next.createdAt ?? new Date().toISOString()
  next.updatedAt = next.updatedAt ?? next.createdAt
  next.settings = { ...seed.settings, ...(next.settings ?? {}) }
  next.skills = next.skills ?? seed.skills
  next.templates = next.templates ?? seed.templates
  next.candidates = next.candidates ?? {}
  next.runs = Array.isArray(next.runs) ? next.runs : []
  next.ledger = Array.isArray(next.ledger) ? next.ledger : []
  next.peerKnowledge = next.peerKnowledge && typeof next.peerKnowledge === 'object' ? next.peerKnowledge : {}
  next.audit = Array.isArray(next.audit) ? next.audit : []
  return next
}

export function saveStore(dataDir, db) {
  ensureDir(dataDir)
  db.updatedAt = new Date().toISOString()
  const dbPath = join(dataDir, 'db.json')
  const backupPath = join(dataDir, 'db.backup.json')
  const tmpPath = join(dataDir, 'db.tmp.json')
  if (existsSync(dbPath)) {
    try { copyFileSync(dbPath, backupPath) } catch { /* best effort */ }
  }
  writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8')
  try {
    renameSync(tmpPath, dbPath)
  } catch {
    rmSync(dbPath, { force: true })
    renameSync(tmpPath, dbPath)
  }
  return db
}

export function loadInstance(dataDir) {
  ensureDir(dataDir)
  const path = join(dataDir, 'instance.json')
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8'))
      if (typeof parsed.contributorId === 'string' && typeof parsed.secret === 'string') return parsed
    } catch { /* regenerate below */ }
  }
  const instance = { ...newInstanceIdentity(), createdAt: new Date().toISOString() }
  writeFileSync(path, JSON.stringify(instance, null, 2), 'utf8')
  return instance
}

export function rotateInstance(dataDir) {
  const instance = { ...newInstanceIdentity(), createdAt: new Date().toISOString() }
  writeFileSync(join(dataDir, 'instance.json'), JSON.stringify(instance, null, 2), 'utf8')
  return instance
}

export function resetDemoStore(dataDir, instance) {
  const db = buildSeedDb()
  appendLedger(db, instance, 'genesis', buildGenesisPayload(), '本地匿名交换账本创世记录（重置）')
  saveStore(dataDir, db)
  return db
}

export function audit(db, action, detail = '') {
  const entry = {
    id: `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    action,
    detail: String(detail).slice(0, 500),
  }
  db.audit = [...(db.audit ?? []), entry].slice(-200)
  return entry
}
