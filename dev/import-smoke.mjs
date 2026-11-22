/**
 * Import self-check. Builds its fixtures at runtime in a temp directory, then
 * exercises every extraction path the plugin supports, the scan/commit flow,
 * duplicate detection, and the unsupported-file skip. Nothing from a real
 * resume is used or read.
 *
 * Run: node dev/import-smoke.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'
import { docxText } from '../lib/import/zip.js'
import { docText } from '../lib/import/ole.js'
import { normalizeText, suggestFields } from '../lib/import/extract.js'

/** Minimal DOCX writer: one paragraph per line, no styling. */
export function makeDocx(lines) {
  const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const body = lines.map(line => `<w:p><w:r><w:t xml:space="preserve">${escape(line)}</w:t></w:r></w:p>`).join('')
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml': document,
  }
  return zipStored(files)
}

function zipStored(files) {
  const locals = []
  const central = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content, 'utf8')
    const nameBytes = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30 + nameBytes.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    nameBytes.copy(local, 30)
    locals.push(local, data)
    const entry = Buffer.alloc(46 + nameBytes.length)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(0, 10)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(nameBytes.length, 28)
    entry.writeUInt32LE(offset, 42)
    nameBytes.copy(entry, 46)
    central.push(entry)
    offset += local.length + data.length
  }
  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(central.length, 8)
  end.writeUInt16LE(central.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBuffer, end])
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

let failures = 0
function check(label, condition, detail = '') {
  if (condition) console.log(`ok   ${label}`)
  else { failures += 1; console.log(`FAIL ${label}${detail === '' ? '' : ` — ${detail}`}`) }
}

const workRoot = mkdtempSync(join(tmpdir(), 'tw-import-smoke-'))
const fixtures = join(workRoot, 'fixtures')
mkdirSync(fixtures, { recursive: true })

// 1. DOCX round trip through the plugin's own reader.
const docxLines = [
  '示例简历（虚构）',
  '姓名：测试候选人甲',
  '专业：材料科学与工程　学历：博士',
  '院校：示例大学',
  '研究方向：稀土永磁材料的第一性原理计算与机器学习筛选。',
  '技能：Python、VASP、XGBoost。',
]
const docxBuffer = makeDocx(docxLines)
writeFileSync(join(fixtures, '269_材料科学与工程_测试甲-示例大学.docx'), docxBuffer)
const docxExtracted = docxText(docxBuffer)
check('docx text extraction', docxExtracted.includes('测试候选人甲') && docxExtracted.includes('示例大学'))

// 2. Plain text (with the kind of padding OCR adds).
const txt = '示例简历（虚构）\n姓 名 ： 测 试 候 选 人 丁\n专 业 ： 控 制 科 学 与 工 程\n院 校 ： 示 例 工 业 大 学\n'
writeFileSync(join(fixtures, 'note_控制_测试丁.txt'), txt, 'utf8')
const normalized = normalizeText(txt)
check('ocr padding removed', normalized.includes('姓名：测试候选人丁') && !normalized.includes('\u0000'))

// 3. Unsupported file must be skipped, not fatal.
writeFileSync(join(fixtures, 'not-a-resume.exe'), Buffer.from('MZ'), 'binary')

// 4. Field suggestions from a filename and body.
const suggestion = suggestFields('269_材料科学与工程_测试甲-示例大学.docx', docxExtracted)
check('suggest name', suggestion.realName === '测试候选人甲', suggestion.realName)
check('suggest major', suggestion.major === '材料科学与工程', suggestion.major)
check('suggest degree', suggestion.degree === '博士', suggestion.degree)
check('suggest school', suggestion.school === '示例大学', suggestion.school)

// 5. DOC: needs Word to create the fixture, so only assert when available.
let docChecked = false
try {
  const docPath = join(fixtures, '410_控制_测试丙.doc')
  const ps = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$word = New-Object -ComObject Word.Application',
    '$word.Visible = $false',
    'try {',
    '  $doc = $word.Documents.Add()',
    '  $sel = $word.Selection',
    '  foreach ($line in @("示例简历（虚构）","姓名：测试候选人丙","专业：控制科学与工程   学历：硕士","院校：示例工业大学")) { $sel.TypeText($line); $sel.TypeParagraph() }',
    `  $doc.SaveAs2("${docPath.replace(/\\/g, '\\\\')}", 0)`,
    '  $doc.Close(0)',
    '} finally { $word.Quit() }',
  ].join('; ')
  execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 90_000, windowsHide: true })
  const { readFileSync } = await import('node:fs')
  const text = docText(readFileSync(docPath))
  check('doc text extraction', text.includes('测试候选人丙') && text.includes('控制科学与工程'))
  docChecked = true
} catch (error) {
  console.log(`skip doc extraction — Word COM unavailable (${String(error.message).split('\n')[0]})`)
}

// 6. Scan + commit through the workbench service.
const dataDir = mkdtempSync(join(tmpdir(), 'tw-import-data-'))
const { db, instance } = loadStore(dataDir)
const wb = new TalentWorkbench({ dataDir, db, instance, config: {}, onSkillsChanged: () => {} })
const before = Object.keys(wb.snapshot().candidates).length
const scan = await wb.scanResumes({ path: fixtures, recursive: false })
check('scan found supported files', scan.summary.total >= 2, JSON.stringify(scan.summary))
check('unsupported file not parsed', scan.items.every(item => !item.name.endsWith('.exe')), JSON.stringify(scan.items.map(item => item.name)))
check('docx item ready', scan.items.some(item => item.ok && item.engine === 'docx-ooxml'))
check('duplicate flagged inside one batch', scan.items.some(item => item.duplicateOf !== '') || scan.summary.duplicate === 0)
const keys = scan.items.filter(item => item.ok && item.duplicateOf === '').map(item => item.key)
const commit = wb.commitScan({ scanId: scan.scanId, keys, overrides: { [keys[0]]: { alias: '导入测试甲' } } })
check('commit created candidates', commit.created.length === keys.length, `${commit.created.length}/${keys.length}`)
const snapshot = wb.snapshot()
check('candidate count grew', snapshot.candidates.length === before + commit.created.length)
const imported = snapshot.candidates.find(item => item.alias === '导入测试甲')
check('imported profile text stored', (imported?.profileText ?? '').length > 20)
check('imported candidate auto-assessed', Object.keys(imported?.assessments ?? {}).length === snapshot.skills.length)
check('scan workspace removed after commit', wb.scanForTool(scan.scanId) === undefined)

// 7. Re-scanning the same file must be flagged as duplicate against the library.
const rescan = await wb.scanResumes({ path: fixtures, recursive: false })
check('library duplicate detected on rescan', rescan.items.some(item => item.duplicateOf !== ''), JSON.stringify(rescan.summary))
wb.discardScan(rescan.scanId)

// 8. Multi-page scans that arrive one file per page collapse into one item.
const pages = join(fixtures, 'multi')
mkdirSync(pages, { recursive: true })
const pageBody = (page) => ['示例简历（虚构）', '姓名：测试候选人戊', '专业：材料科学与工程', `第 ${page} 页内容：项目经历与技能。`]
writeFileSync(join(pages, '测试戊（第一页）.jpg.txt'), pageBody(1).join('\n'), 'utf8')
// Images are needed for a realistic test; use tiny PNGs written from a base64 constant.
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
writeFileSync(join(pages, '测试戊（第一页）.png'), tinyPng)
writeFileSync(join(pages, '测试戊（第二页）.png'), tinyPng)
writeFileSync(join(pages, '测试戊（第三页）.png'), tinyPng)
const grouped = await wb.scanResumes({ path: pages, recursive: false })
const groupItem = grouped.items.find(item => item.files !== undefined && item.files.length === 3)
check('three page files grouped into one item', groupItem !== undefined, JSON.stringify(grouped.items.map(item => [item.name, item.files])))
check('grouped item counts all pages', grouped.summary.total === 2, JSON.stringify(grouped.summary))
wb.discardScan(grouped.scanId)

rmSync(dataDir, { recursive: true, force: true })
rmSync(workRoot, { recursive: true, force: true })
console.log(docChecked ? '' : '(doc path skipped)')
console.log(failures === 0 ? '\nimport smoke: all checks passed' : `\nimport smoke: ${failures} check(s) failed`)
process.exitCode = failures === 0 ? 0 : 1
