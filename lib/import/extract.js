/**
 * Resume text extraction for the local talent workbench.
 *
 * Formats: .docx (OOXML), .doc (Word 97-2003), .pdf (text layer, with an OCR
 * fallback for scans), images (.png/.jpg/.jpeg/.webp/.bmp/.tif/.tiff via
 * Windows OCR), and plain text (.txt/.md). Everything runs locally; the only
 * external programs used are poppler's pdftotext/pdftoppm when present.
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { docText } from './ole.js'
import { docxText } from './zip.js'
import { pdfPageImages, pdfText } from './pdf.js'
import { ocrAvailable, ocrImage } from './ocr.js'

export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'])
export const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.rtf', '.txt', '.md',
  ...IMAGE_EXTENSIONS,
])

/** Text shorter than this after PDF extraction is treated as a scan. */
const PDF_TEXT_THRESHOLD = 120
const MAX_TEXT = 60_000

const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/

/**
 * Normalize extracted text: unify newlines, drop zero-width characters,
 * remove spaces OCR inserts between CJK characters, and collapse blank runs.
 */
export function normalizeText(value) {
  const text = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
    .replace(/\u00a0/g, ' ')
  const lines = text.split('\n').map((line) => {
    const chars = [...line]
    const kept = []
    for (let index = 0; index < chars.length; index += 1) {
      const char = chars[index]
      if (char === ' ' || char === '\t') {
        const previous = kept[kept.length - 1]
        const next = chars[index + 1]
        if (previous !== undefined && next !== undefined && CJK.test(previous) && CJK.test(next)) continue
      }
      kept.push(char)
    }
    return kept.join('').replace(/[ \t]+$/g, '')
  })
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trim()
}

const OCR_FIXES = [
  [/水磁/g, '永磁'],
  [/亻乍/g, '作'],
  [/[忄「]生/g, '性'],
  [/亻匕/g, '化'],
  [/VAS\s*P/g, 'VASP'],
  [/XGBoost[0O]/g, 'XGBoost'],
]

function applyOcrFixes(text) {
  let output = text
  for (const [pattern, replacement] of OCR_FIXES) output = output.replace(pattern, replacement)
  return output
}

function formatOf(name) {
  return extname(String(name ?? '')).toLowerCase()
}

function decodePlainText(buffer) {
  const utf8 = buffer.toString('utf8')
  if (!utf8.includes('\ufffd')) return utf8
  try {
    return new TextDecoder('gbk', { fatal: false }).decode(buffer)
  } catch {
    return buffer.toString('latin1')
  }
}

function stripRtf(text) {
  return text
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, code) => String.fromCharCode(Number(code) < 0 ? Number(code) + 65536 : Number(code)))
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
}

/**
 * Recognised majors, longest first so `材料科学与工程` wins over `材料`.
 * The bare forms (材料 / 化学 / 物理 …) are ordinary words that also appear in
 * prose ("…可为材料科学中的建模提供支撑"), so they are only accepted inside a
 * degree line, an explicit field, or the file name — never from loose body text.
 */
const MAJORS = [
  '材料科学与工程', '材料成型及控制工程', '材料物理与化学', '材料物理', '材料化学', '材料工程', '材料学', '材料',
  '化学工程与技术', '化学工程与工艺', '化学工程', '物理化学', '分析化学', '有机化学', '无机化学', '化学',
  '控制科学与工程', '控制理论与控制工程', '控制工程', '控制',
  '计算机科学与技术', '计算机技术', '计算机应用', '计算机',
  '软件工程', '网络空间安全', '信息安全',
  '信息与通信工程', '通信与信息系统', '通信工程', '电子信息工程', '电子科学与技术', '电子信息', '电子',
  '机械设计制造及其自动化', '机械设计及理论', '机械制造及其自动化', '机械工程', '机械电子工程', '机械',
  '应用数学', '金融数学', '计算数学', '基础数学', '概率论与数理统计', '数学与应用数学', '数学',
  '理论物理', '凝聚态物理', '光学', '声学', '物理学', '物理',
  '工程力学', '固体力学', '流体力学', '力学',
  '电气工程及其自动化', '电气工程', '自动化',
  '冶金工程', '冶金物理化学', '冶金', '有色金属冶金',
  '动力工程及工程热物理', '动力工程', '能源动力', '新能源科学与工程', '新能源',
  '环境科学与工程', '环境工程', '资源与环境', '环境',
  '仪器科学与技术', '测试计量技术及仪器', '仪器仪表工程', '仪器',
  '光学工程', '生物医学工程', '生物工程', '生物技术', '生物学',
  '安全工程', '安全科学与工程', '工业工程', '储能科学与工程', '遥感科学与技术',
  '人工智能', '数据科学与大数据技术', '模式识别与智能系统', '信号与信息处理',
  '统计学', '应用统计', '数量经济', '金融工程', '管理科学与工程', '工商管理', '市场营销', '经济学',
].sort((a, b) => b.length - a.length)

/** Majors that are ordinary words; only trusted inside a degree/field/file context. */
const WEAK_MAJORS = new Set([
  '材料', '化学', '物理', '数学', '力学', '控制', '电子', '机械', '环境', '仪器', '冶金',
  '自动化', '计算机', '通信', '统计学', '经济学', '市场营销',
])

const SCHOOL_HINT = /(大学|学院|研究院|研究所|科学院|中心|实验室)/

const DEGREE_RANK = [['博士', 3], ['硕士', 2], ['学士', 1], ['本科', 1]]
/** Lines that talk ABOUT a degree or an interest without being an education record. */
const EDUCATION_LABEL = /^(研究领域|研究方向|研究兴趣|参研项目|参与项目|项目|技能|论文|成果|获奖|荣誉|求职|意向|个人|自我|教育经历|教育背景)/
const TEXT_NOISE = /(强化学习|机器学习|深度学习|优化学习|学习)/g

/** Longest major named inside `segment`; weak majors only when `trusted`. */
export function majorIn(segment, trusted) {
  if (typeof segment !== 'string' || segment === '') return ''
  const masked = segment.replace(TEXT_NOISE, '\u3000')
  for (const major of MAJORS) {
    if (!masked.includes(major)) continue
    if (!trusted && WEAK_MAJORS.has(major)) continue
    // A bare weak major must not be the tail of a longer known major
    // (e.g. "材料物理" already matched by the longer entry above).
    return major
  }
  return ''
}

/**
 * Education records, highest degree first.
 *
 * A record is either a row that names a degree AND carries a date range or a
 * school ("2018.09-2022.06 博士 … 软件工程"), or a header-style line that pairs
 * the 专业 token with a degree ("材料科学与工程专业｜工学博士"). Lines that merely
 * talk about a degree or a research interest are excluded, which is what used to
 * let "研究领域：… 生成式人工智能" outrank the real education table.
 */
export function educationRecords(text) {
  const records = []
  const rows = String(text ?? '').split('\n')
  for (const [index, raw] of rows.entries()) {
    const line = raw.replace(/[\s\u3000]+/g, ' ').trim()
    if (line === '' || EDUCATION_LABEL.test(line)) continue
    const degree = DEGREE_RANK.find(([word]) => line.includes(word))
    if (degree === undefined) continue
    const hasDate = /(19|20)\d{2}\s*[.\-/年]/.test(line)
    const hasSchool = SCHOOL_HINT.test(line)
    const hasFieldToken = /(专业|学科|学位)/.test(line)
    const kind = hasDate || hasSchool ? 'row' : hasFieldToken ? 'label' : ''
    if (kind === '') continue
    records.push({ line, rank: degree[1], degree: degree[0], kind, index })
  }
  return records.sort((a, b) => b.rank - a.rank || (a.kind === b.kind ? 0 : a.kind === 'row' ? -1 : 1) || a.index - b.index)
}

/**
 * Strip everything in an education row except the field of study: the date
 * range, the school, the advisor and the degree word itself. A bare 导师/老师
 * label is kept — only a title attached to a name marks the advisor.
 */
export function fieldOfEducationRecord(line) {
  return line
    .replace(/(19|20)\d{2}\s*[.\-/年]?\s*\d{0,2}\s*[.\-/月]?\s*[–—\-~至]\s*((19|20)\d{2}\s*[.\-/年]?\s*\d{0,2}|至今|今|现在)/g, ' ')
    .replace(/(19|20)\d{2}\s*[.\-/年]\s*\d{0,2}\s*[.\-/月]?/g, ' ')
    .replace(/[\u4e00-\u9fa5（）()·]{2,30}(?:大学|学院|研究院|研究所|科学院|中学|学校)/g, ' ')
    .replace(/[\u4e00-\u9fa5]{2,4}\s*(?:讲席教授|副教授|教授|副研究员|研究员|院士)/g, ' ')
    .replace(/博士研究生|硕士研究生|博士|硕士|学士|本科|研究生/g, ' ')
    .trim()
}

/** Field of study of the highest degree the resume lists. */
function pickEducationMajor(text) {
  for (const record of educationRecords(text)) {
    const found = majorIn(fieldOfEducationRecord(record.line), true)
    if (found !== '') return { major: found, record }
  }
  return null
}

/**
 * School of the highest degree the resume lists. A university name wins over a
 * department or a college inside it ("示例工业大学 航天学院" → the university).
 */
function pickEducationSchool(text) {
  for (const record of educationRecords(text)) {
    const matches = [...record.line.matchAll(/([\u4e00-\u9fa5（）()·]{2,30}(?:大学|学院|研究院|研究所|科学院))/g)].map(match => match[1])
    if (matches.length === 0) continue
    const university = matches.find(name => name.includes('大学'))
    return university ?? matches[0]
  }
  return ''
}

/**
 * Guess the major. The highest listed degree is authoritative: a PhD in
 * software engineering who studies knowledge graphs is a software-engineering
 * candidate, not an "artificial intelligence" one.
 */
function pickMajor(text, fileBase = '') {
  const body = String(text ?? '')
  const files = String(fileBase ?? '')

  // 1. The field of study on the highest education record.
  const fromEducation = pickEducationMajor(body)
  if (fromEducation !== null) return fromEducation.major

  // 2. An explicit labelled field ("专业：…", "学科：…").
  const labeled = body.match(/(?:所学专业|学科专业|专\s*业|学\s*科|二级学科)\s*[:：]\s*([^\n]{2,60})/)
  if (labeled !== null) {
    const found = majorIn(labeled[1], true)
    if (found !== '') return found
  }

  // 3. The file name, which the recruiter curated: "401_数学_示例甲.pdf".
  const fromFile = majorIn(files, true)
  if (fromFile !== '') return fromFile

  // 4. Only now the header (never the whole body).
  return majorIn(body.slice(0, 400), false)
}

/**
 * Some uploaded files are not a single resume: a review memo, a shortlist table
 * or a batch spreadsheet lists many people. Detect that shape so the importer can
 * warn instead of silently inventing one candidate out of the whole file.
 */
export function looksLikeMultiPersonDoc(text) {
  const body = String(text ?? '')
  const numbered = (body.match(/^[ \t]*\d{2,4}[_\-—][^\n：:]{2,24}[：:]/gm) ?? []).length
  const labelled = (body.match(/姓\s*名\s*[:：]/g) ?? []).length
  const degrees = (body.match(/(博士|硕士|本科)/g) ?? []).length
  if (numbered >= 3) return { multi: true, count: numbered, reason: 'numbered-entries' }
  if (labelled >= 3) return { multi: true, count: labelled, reason: 'name-labels' }
  if (labelled >= 2 && degrees >= 4) return { multi: true, count: labelled, reason: 'name-and-degrees' }
  return { multi: false, count: 0, reason: '' }
}

/** Section headings and form labels that a bare-line name regex must not accept. */
const NAME_STOP_WORDS = new Set([
  '教育经历', '教育背景', '个人信息', '基本信息', '求职意向', '工作经历', '实习经历', '项目经历',
  '科研经历', '研究经历', '论文专利', '发表论文', '技能特长', '专业技能', '获奖情况', '荣誉奖项',
  '自我评价', '个人评价', '联系方式', '姓名性别', '出生年月', '政治面貌', '婚姻状况', '籍贯民族',
  '应试者', '候选人', '简历', '个人简历', '求职简历', '附件', '目录', '声明', '备注',
])

function pickName(text) {
  const explicit = text.match(/姓\s*名\s*[:：]\s*([\u4e00-\u9fa5·]{2,6})/)
  if (explicit !== null && !NAME_STOP_WORDS.has(explicit[1])) return explicit[1]
  // A bare short line is only a name if it is not a section heading and the
  // surrounding lines look like resume metadata.
  for (const match of text.matchAll(/^\s*([\u4e00-\u9fa5]{2,4})\s*$/gm)) {
    const candidate = match[1]
    if (NAME_STOP_WORDS.has(candidate)) continue
    const before = text.slice(Math.max(0, match.index - 80), match.index)
    const looksLikeHeader = /简历|信息|个人|求职|应聘/.test(before)
    if (looksLikeHeader) return candidate
  }
  return ''
}

function pickDegree(text) {
  // The highest education record is authoritative when the resume has one.
  const records = educationRecords(text)
  if (records.length > 0) {
    const top = records[0].degree
    return top === '学士' ? '本科' : top
  }
  if (/(博士|Ph\.?D|Doctor)/i.test(text)) return '博士'
  if (/(硕士|研究生|Master)/i.test(text)) return '硕士'
  if (/(本科|学士|Bachelor)/i.test(text)) return '本科'
  return ''
}

function pickSchool(text) {
  const explicit = text.match(/(?:院\s*校|学\s*校|毕业院校|所在院校)\s*[:：]\s*([^\n，,；;]{2,40})/)
  if (explicit !== null) return explicit[1].trim()
  // The school on the highest education record, even when that row is long.
  const fromEducation = pickEducationSchool(text)
  if (fromEducation !== '') return fromEducation
  // Prefer a university over a department name when both appear.
  let fallback = ''
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/[\s\u3000]+/g, ' ').trim()
    if (trimmed.length < 4 || trimmed.length > 80) continue
    if (!SCHOOL_HINT.test(trimmed)) continue
    const match = trimmed.match(/([\u4e00-\u9fa5（）()·]{2,30}(?:大学|学院|研究院|研究所|科学院))/)
    if (match === null) continue
    if (match[1].includes('大学')) return match[1]
    if (fallback === '') fallback = match[1]
  }
  return fallback
}

function pickDirection(text) {
  const explicit = text.match(/(?:研究\s*方向|研究\s*领域|求职\s*方向|求职\s*意向|应聘\s*方向|意向\s*岗位)\s*[:：]\s*([^\n]{2,120})/)
  if (explicit !== null) return explicit[1].trim()
  return ''
}

/**
 * Suggest candidate fields from the file name and the extracted text. These are
 * only suggestions; the user reviews them before committing the import.
 */
export function suggestFields(name, text) {
  const base = String(name ?? '').replace(/\.[^.]+$/, '')
  const tokens = base.split(/[_\-—·\s()（）\[\]]+/).filter(Boolean)
  const nameFromFile = tokens.find(token => /^[\u4e00-\u9fa5·]{2,4}$/.test(token)
    && !MAJORS.includes(token)
    && !NAME_STOP_WORDS.has(token)
    && !SCHOOL_HINT.test(token)
    && !/简历|resume|批次|面试|硕|博|其他|约面试|本科|硕士|博士|应届/i.test(token))
  const schoolFromFile = (base.match(/([\u4e00-\u9fa5]{2,20}(?:大学|学院|研究院|研究所))/) ?? [])[1] ?? ''
  const realName = pickName(text) || nameFromFile || ''
  return {
    alias: realName === '' ? '' : realName,
    realName,
    major: pickMajor(text, base),
    degree: pickDegree(text),
    school: pickSchool(text) || schoolFromFile,
    direction: pickDirection(text),
    sourceFile: base,
  }
}

/**
 * @param {{ name: string, buffer: Buffer, workDir: string, config?: object }} input
 */
export async function extractResume({ name, buffer, workDir, config = {} }) {
  const format = formatOf(name)
  const warnings = []
  const pages = []
  mkdirSync(workDir, { recursive: true })
  let engine = ''
  let text = ''
  let ocrFallbackLanguage = false

  if (format === '.docx') {
    engine = 'docx-ooxml'
    text = docxText(buffer)
  } else if (format === '.doc') {
    engine = 'doc-ole'
    text = docText(buffer)
  } else if (format === '.pdf') {
    let extracted
    try {
      extracted = await pdfText(buffer, { configured: config.poppler ?? {} })
    } catch (error) {
      // A damaged or encrypted PDF makes poppler exit non-zero; fall through to OCR.
      warnings.push(`PDF 文字层读取失败（${firstLine(error)}），已改用 OCR`)
      extracted = { ok: false, reason: 'read-failed' }
    }
    if (!extracted.ok) {
      if (extracted.reason === 'missing-pdftotext') warnings.push('未找到 pdftotext，改用 OCR 识别（较慢）')
      text = ''
    } else {
      text = normalizeText(extracted.text)
    }
    if (normalizeText(text).length < PDF_TEXT_THRESHOLD) {
      if (text.trim() !== '') warnings.push('PDF 文字层内容很少，可能是扫描件，已改用 OCR')
      const raster = await pdfPageImages(buffer, join(workDir, 'pages'), {
        configured: config.poppler ?? {},
        scaleTo: config.ocrScaleTo ?? 2400,
        maxPages: config.maxOcrPages ?? 6,
      })
      if (!raster.ok) throw new Error('PDF 没有可提取的文字层，且本机缺少 pdftoppm，无法做 OCR')
      const availability = await ocrAvailable()
      if (!availability.available) throw new Error(`扫描件需要 OCR，但本机 OCR 不可用：${availability.reason}`)
      const chunks = []
      for (const [index, file] of raster.files.entries()) {
        const recognized = await ocrImage(file, { language: config.ocrLanguage ?? 'zh-Hans-CN' })
        chunks.push(recognized.text)
        pages.push(file)
        if (recognized.languageTag !== '' && recognized.languageTag !== recognized.requested) {
          warnings.push(`本机未安装 ${recognized.requested} 语言包，实际使用 ${recognized.languageTag}，识别结果可能不可用`)
          ocrFallbackLanguage = true
        }
        if (index === 0 && raster.files.length > 1) warnings.push(`只识别了前 ${raster.files.length} 页，更多页请单独导入`)
      }
      text = normalizeText(chunks.join('\n\n'))
      engine = 'pdf-ocr'
      warnings.push('OCR 结果可能有错字，请核对')
    } else {
      engine = 'pdf-text'
    }
  } else if (IMAGE_EXTENSIONS.has(format)) {
    const availability = await ocrAvailable()
    if (!availability.available) throw new Error(`图片需要 OCR，但本机 OCR 不可用：${availability.reason}`)
    const target = join(workDir, `image${format === '.tif' || format === '.tiff' ? '.tif' : format}`)
    writeFileSync(target, buffer)
    const recognized = await ocrImage(target, { language: config.ocrLanguage ?? 'zh-Hans-CN' })
    if (recognized.languageTag !== '' && recognized.languageTag !== recognized.requested) {
      warnings.push(`本机未安装 ${recognized.requested} 语言包，实际使用 ${recognized.languageTag}，识别结果可能不可用`)
      ocrFallbackLanguage = true
    }
    text = normalizeText(recognized.text)
    if (/\.tiff?$/i.test(format)) warnings.push('多页 TIFF 只识别第一页')
    pages.push(target)
    engine = 'image-ocr'
    warnings.push('OCR 结果可能有错字，请核对')
  } else if (format === '.rtf') {
    engine = 'rtf-text'
    text = normalizeText(stripRtf(decodePlainText(buffer)))
  } else if (format === '.txt' || format === '.md') {
    engine = 'plain-text'
    text = normalizeText(decodePlainText(buffer))
  } else {
    throw new Error(`不支持的格式：${format || '未知'}`)
  }

  if (engine.endsWith('-ocr')) text = normalizeText(applyOcrFixes(text))
  if (text.length > MAX_TEXT) {
    text = text.slice(0, MAX_TEXT)
    warnings.push(`文本超过 ${MAX_TEXT} 字，已截断`)
  }
  if (text.trim().length === 0) throw new Error('没有提取到任何文本')
  const multi = looksLikeMultiPersonDoc(text)
  if (multi.multi) {
    warnings.push(multi.reason === 'numbered-entries'
      ? `这份文件看起来是多位候选人的名单/评审记录（检测到 ${multi.count} 条编号条目），不是单份简历；建议拆分或逐份导入`
      : `这份文件里出现了 ${multi.count} 处「姓名」标签，可能包含多位候选人；建议拆分或逐份导入`)
  }
  return {
    ok: true,
    format: format.replace('.', ''),
    engine,
    text,
    chars: text.length,
    pages,
    warnings,
    needsReview: engine.endsWith('-ocr'),
    multiCandidate: multi.multi,
    ocrFallbackLanguage,
  }
}

function firstLine(error) {
  return String(error?.message ?? error).split('\n')[0].slice(0, 120)
}

/** Remove a scan workspace (page images, temporary copies). */
export function cleanupWorkDir(workDir) {
  try { rmSync(workDir, { recursive: true, force: true }) } catch { /* best effort */ }
}

export function moveFile(from, to) {
  mkdirSync(join(to, '..'), { recursive: true })
  renameSync(from, to)
}
