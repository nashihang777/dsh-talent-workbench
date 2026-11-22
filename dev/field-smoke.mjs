import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStore } from '../lib/store.js'
import { TalentWorkbench } from '../lib/workbench.js'
import { looksLikeMultiPersonDoc, suggestFields } from '../lib/import/extract.js'

let failures = 0
const check = (label, ok, detail = '') => { if (ok) console.log('ok  ', label); else { failures += 1; console.log('FAIL', label, detail) } }

// 1. The memo shape that produced the junk record.
const memo = '269_物理_温某：其研究方向与我方高度契合。\n351_材料_张某某：成果较少。\n400_力学_姜某某：水平较高。\n401_数学_王某某：方向不契合。\n'
check('memo detected as multi-person', looksLikeMultiPersonDoc(memo).multi === true)
check('single resume not flagged', looksLikeMultiPersonDoc('姓名：张三\n教育背景\n某大学 材料科学与工程 博士').multi === false)

// 2. Major inference: prose must not decide the major.
const maths = '王某某\n示例工业大学 · 应用数学博士 | 数学建模\n求职方向：数学建模 / 数值仿真\n项目描述：可为材料科学中的建模提供支撑。\n'
check('maths PhD is not called 材料', suggestFields('401_数学_王某某.pdf', maths).major === '应用数学', suggestFields('401_数学_王某某.pdf', maths).major)
const mats = '张某某\n教育背景\n某大学 材料科学与工程｜工学博士\n技能：数学建模\n'
check('materials PhD keeps 材料科学与工程', suggestFields('351_材料_张某某.pdf', mats).major === '材料科学与工程', suggestFields('351_材料_张某某.pdf', mats).major)
check('prose-only mention yields nothing', suggestFields('resume.pdf', '个人简介\n本工作可为材料科学、化学与物理领域提供参考。\n').major === '')

// 3. The highest education row decides the field, even when a research-interest
//    line inside 教育经历 mentions a different domain first (reported case).
const tableResume = `教育经历

   研究领域：知识图谱表示学习与推理，大语言模型及生成式人工智能。
   研究方向：大语言模型与知识图谱双向增强，生成式人工智能。

        时间    学历            毕业学校                  专业         导师
2018.09-2022.06 博士   示例市，示例大学              软件工程       示例教授
2015.09-2018.06 硕士   示例市，示例大学          计算机科学与技术       示例教授
2014.09-2018.06 学士   示例市，示例师范学院             材料成型及控制工程       示例教授
`
const t = suggestFields('604_软件工程_示例乙.pdf', tableResume)
check('education table: field of the highest degree', t.major === '软件工程', t.major)
check('education table: degree', t.degree === '博士', t.degree)
check('education table: school without a city prefix', t.school === '示例大学', t.school)

// 4. A header line that pairs 专业 with the degree also counts.
const headerField = '材料科学与工程专业｜工学博士｜AI for Materials\n2016.09—2022.06 某大学 新材料技术研究院 工学博士（导师：某教授）'
check('header-style degree line', suggestFields('x.pdf', headerField).major === '材料科学与工程', suggestFields('x.pdf', headerField).major)

// 5. A university beats a college inside it; advisor titles are not fields.
const nested = '2021.09—至今 示例工业大学 力学(A+学科) 工学博士\n航天学院 博士 发表 SCI 论文 4 篇'
const nestedFields = suggestFields('400_力学_某.pdf', nested)
check('university preferred over college', nestedFields.school === '示例工业大学', nestedFields.school)
check('advisor title is not a field', nestedFields.major === '力学', nestedFields.major)

// 6. A multi-person document is skipped unless explicitly allowed.
const dir = mkdtempSync(join(tmpdir(), 'tw-multi-'))
const { db, instance } = loadStore(dir)
const wb = new TalentWorkbench({ dataDir: dir, db, instance, config: {}, onSkillsChanged: () => {} })
const fx = join(dir, 'fx')
const { mkdirSync } = await import('node:fs')
mkdirSync(fx, { recursive: true })
writeFileSync(join(fx, '评审记录.txt'), memo, 'utf8')
writeFileSync(join(fx, '单份简历.txt'), '姓名：李四\n教育背景\n某大学 控制科学与工程 博士\n研究方向：过程控制\n', 'utf8')
const scan = await wb.scanResumes({ path: fx, recursive: false })
check('scan flags the memo', scan.summary.multiCandidate === 1, JSON.stringify(scan.summary))
const memoItem = scan.items.find(item => item.name.includes('评审记录'))
check('memo item warns', (memoItem?.warnings ?? []).some(w => w.includes('多位候选人')))
const all = scan.items.filter(item => item.ok).map(item => item.key)
wb.commitScan({ scanId: scan.scanId, keys: all })
const aliases = wb.snapshot().candidates.map(c => c.alias)
check('memo not imported by default', aliases.length === 1 && !aliases.includes('269_物理_温某'), aliases.join(','))
rmSync(dir, { recursive: true, force: true })
console.log(failures === 0 ? '\nfield smoke: all checks passed' : `\nfield smoke: ${failures} failed`)
process.exitCode = failures === 0 ? 0 : 1
