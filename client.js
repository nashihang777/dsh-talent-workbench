/**
 * Client half of the talent workbench: a dedicated right-side panel with the
 * screening derivation, weighted templates, dimension skills, anonymous
 * exchange ledger and local backup controls.
 */
window.__ModuleLoader__.load({
  id: '@nashihang777/dsh-talent-workbench',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef } = React

    const NS = 'talentWorkbench'
    const PANEL_ID = 'talent-workbench'
    const API = '/dsh-talent/api'

    const zh = {
      'tab.title': '人才匹配工作台',
      'guide.title': '人才匹配工作台',
      'guide.description': '调权重、看推导、本地筛选与匿名交换',
      'button.open': '人才匹配',
      'button.openHint': '打开人才匹配工作台（本地数据）',
      'app.title': '人才匹配工作台',
      'app.subtitle': '可解释的简历筛选 · 可调权重的岗位模板 · 维度技能规范',
      'app.local': '本地数据库',
      'app.noNetwork': '仅本机服务',
      'app.private': '隐私保护',
      'app.refresh': '刷新',
      'app.loading': '正在读取本地工作台…',
      'app.loadError': '无法读取本地工作台。请确认插件已启用，并刷新页面重试。',
      'app.retry': '重试',
      'app.noticeSaved': '已保存',
      'app.noticeFailed': '操作失败',
      'common.save': '保存',
      'common.cancel': '取消',
      'common.delete': '删除',
      'common.edit': '编辑',
      'common.add': '新增',
      'common.remove': '移除',
      'common.reset': '还原',
      'common.show': '展开',
      'common.hide': '收起',
      'common.close': '关闭',
      'common.confirm': '确认',
      'common.version': '版本',
      'common.current': '当前',
      'common.all': '全部',
      'common.search': '搜索',
      'common.export': '导出',
      'common.import': '导入',
      'common.apply': '应用',
      'common.preview': '预览',
      'common.restore': '回溯',
      'common.copy': '复制',
      'common.open': '打开',
      'common.none': '暂无',
      'common.optional': '可选',
      'common.notes': '备注',
      'common.download': '下载',
      'common.upload': '选择文件',
      'common.confirmDelete': '确认删除？该操作会写入本地审计记录。',
      'common.weigh': '权重',
      'common.rank': '排名',
      'common.score': '得分',
      'common.major': '专业',
      'common.degree': '学历',
      'common.school': '院校',
      'common.direction': '方向',
      'common.decision': '结论',
      'common.recommend': '推荐面试',
      'common.backup': '备选',
      'common.hold': '暂缓',
      'common.hits': '命中维度',
      'common.unknown': '未填写',
      'tab.overview': '总览',
      'tab.screening': '筛选推导',
      'tab.templates': '岗位模板',
      'tab.skills': '维度技能',
      'tab.exchange': '匿名交换',
      'tab.data': '数据备份',
      'overview.title': '把筛选过程变成可检查的推导，而不是一个黑箱分数',
      'overview.body': '每个维度都有独立的考察规范、可调权重和证据链。调权重时排序会实时变化；每个结论都能回到「哪条证据、哪一档、贡献多少分」。',
      'overview.step1': '选模板或调权重',
      'overview.step1body': '岗位模板由多个维度技能组合，权重按相对值归一化。',
      'overview.step2': '录入或选择候选人',
      'overview.step2body': '规则初筛给出可校正的等级，人工复核后重新计算。',
      'overview.step3': '看推导并校准偏差',
      'overview.step3body': '检查专业集中度、维度影响力和旧口径差异，再决定是否调整。',
      'overview.activeTemplate': '当前模板',
      'overview.openScreening': '打开筛选推导',
      'overview.editTemplate': '编辑模板',
      'overview.stats.candidates': '本地候选人',
      'overview.stats.templates': '岗位模板',
      'overview.stats.skills': '维度技能',
      'overview.stats.recommended': '当前推荐',
      'overview.stats.ledger': '账本记录',
      'overview.stats.avg': '平均加权分',
      'overview.warnings': '偏差与校准提示',
      'overview.noWarnings': '当前没有明显的专业集中或低区分度信号。',
      'overview.recentRuns': '最近筛选快照',
      'overview.privacyTitle': '隐私边界',
      'overview.privacyBody': '候选人姓名、简历原文、联系方式与评估证据只写入本机数据目录；面板只调用本机 DSH 服务的同源接口（127.0.0.1），不向外部网络发送数据。匿名交换只允许维度均值、权重分布、等级占比与样本量分级。示例候选人只存在于本页面，不写入数据库。',
      'demo.badge': '示例预览',
      'demo.banner': '当前没有本地候选人，正在展示内置示例（仅前端预览，不写入数据库）。导入或新增第一位候选人后，示例会自动消失。',
      'demo.hint': '示例候选人不能编辑、改判级或生成快照；这些操作只对真实候选人开放。',
      'demo.overview': '内置示例候选人只用于预览界面与权重效果，不存在于本地数据库；导入真实简历后自动隐藏。',
      'demo.readOnly': '示例数据不可编辑',
      'demo.noRun': '示例数据不能生成快照或报告',
      'demo.short': '示例数据',
      'screening.title': '筛选推导',
      'screening.subtitle': '证据 → 判级 → 权重贡献 → 排序与结论',
      'screening.search': '搜索候选人 / 专业 / 方向',
      'screening.addCandidate': '新增候选人',
      'screening.empty': '还没有候选人。新增一位，或批量导入简历文件 / 文件夹。',
      'screening.emptyBody': '支持 PDF、DOC、DOCX、RTF、TXT 与图片；扫描件和图片用本机 OCR 识别，导入前可逐份核对字段。',
      'screening.selectHint': '从左侧选择一位候选人查看推导。',
      'screening.profile': '候选人资料',
      'screening.evidence': '证据与判级',
      'screening.derivation': '逐维推导',
      'screening.contribution': '贡献',
      'screening.level': '等级',
      'screening.confidence': '置信度',
      'screening.source.auto': '规则初筛',
      'screening.source.manual': '人工复核',
      'screening.viewSkill': '查看规范',
      'screening.autoAssess': '重新自动评估',
      'screening.newRun': '生成筛选快照',
      'screening.exportReport': '导出报告',
      'screening.resultTable': '全部候选人结果',
      'screening.legacy': '旧口径命中',
      'screening.rankShift': '位次变化',
      'screening.gateFail': '未过门槛',
      'screening.why': '为什么是这个结果',
      'screening.whyBody': '加权分 = Σ（维度分值 × 归一化权重）× 100。结论按模板阈值与门槛判定；同等分数再按专注度、学术水平、经历深度排序。',
      'screening.noResult': '该候选人在当前模板下没有有效维度。',
      'screening.draftBanner': '正在预览未保存草稿：排序与推导都按草稿权重计算，保存后才会写入本地数据库。',
      'screening.thresholds': '判定线（来自当前模板）',
      'screening.hitLineHint': '命中线：单个维度分值 ≥ {v} 记为一次命中（0—1 分制，与加权总分不同尺度）。',
      'screening.showEvidence': '展开证据',
      'screening.hideEvidence': '收起证据',
      'screening.import': '批量导入简历',
      'import.title': '批量导入简历',
      'import.subtitle': '支持 PDF、DOC、DOCX、RTF、TXT 与图片（PNG/JPEG/WebP/BMP/TIFF）。文字与 OCR 全部在本机完成（不上传文件）；字段识别默认交给智能体完成，见下方说明。',
      'import.hint': 'OCR 结果可能有错字，导入前请在下方核对姓名、专业、学历与院校；导入后仍可在候选人资料里修改。',
      'import.byAgent': '智能体解析',
      'import.byRule': '规则解析',
      'import.agentNotice': '字段（姓名/专业/学历/院校/方向/论文/项目等）由你配置的模型读取简历文本后给出；文本只发往该模型，不上传任何文件。可在插件配置 import.useAgent=false 关闭，关闭后回退本地规则。',
      'import.agentUnavailable': '智能体解析不可用（{reason}），已使用本地规则；规则对姓名与专业容易出错，建议导入后核对。',
      'import.pickFiles': '选择简历文件',
      'import.pickFolder': '选择文件夹',
      'import.pathTitle': '从本机路径导入（可选）',
      'import.pathHint': '输入本机文件或文件夹的绝对路径，由主机侧直接读取；适合批量目录或智能体代跑。',
      'import.recursive': '含子文件夹',
      'import.scanPath': '扫描路径',
      'import.phaseRead': '正在读取文件',
      'import.phaseExtract': '正在提取文本并识别字段（扫描件逐页 OCR + 智能体解析，可能需要一会儿）',
      'import.phaseCommit': '正在写入本地数据库',
      'import.selectAll': '全选',
      'import.clearAll': '全不选',
      'import.select': '选中',
      'import.commit': '导入选中',
      'import.alias': '别名',
      'import.major': '专业',
      'import.degree': '学历',
      'import.school': '院校',
      'import.direction': '研究方向',
      'import.preview': '查看提取文本',
      'import.pageImages': 'OCR 页图路径（可用 read_image 复核）',
      'import.failed': '失败',
      'import.duplicate': '疑似重复',
      'import.duplicateBlocked': '与已有简历内容相同，不能重复导入',
      'import.lowQuality': '文本过少',
      'import.multiCandidate': '疑似多人文件',
      'import.multiCandidateHint': '这份文件像名单/评审记录，默认不导入；确认后仍可手动勾选。',
      'import.skipped': '已跳过的文件',
      'import.skipTooBig': '单个文件超过 30 MB',
      'import.skipBatch': '超出单批 40 MB',
      'import.nothingReadable': '没有可解析的文件',
      'import.limits': '单批最多 40 份、合计 40 MB；单个文件最大 30 MB；扫描版 PDF 默认只识别前 6 页。',
      'import.reselect': '重新选择',
      'import.phaseList': '正在读取文件列表',
      'import.phaseExtractProgress': '正在解析文本（{done}/{total} 份）',
      'import.phaseAgent': '智能体正在识别字段（{done}/{total} 份）',
      'import.jobDone': '解析完成，可以核对并导入',
      'import.jobFailed': '解析失败',
      'import.jobCancelled': '解析已取消',
      'import.backgroundHint': '任务在后台继续；关闭这个窗口、切换标签页甚至刷新页面都不会中断。',
      'import.jobFinishedHint': '结果已保留在本机，随时可以回到这里核对并导入。',
      'import.closeKeepRunning': '关闭窗口（后台继续）',
      'import.cancelJob': '取消任务',
      'import.viewProgress': '查看进度',
      'import.reviewResult': '核对结果',
      'import.extractedSoFar': '已提取',
      'import.keepOpen': '解析期间请保持窗口打开；关闭会在解析完成后自动清理本次临时文件。',
      'import.closeAfterScan': '解析完成后关闭',
      'import.noneSelected': '请至少选中一份简历',
      'screening.profileText': '简历原文 / 备注（仅本地）',
      'screening.publications': '论文与成果',
      'screening.projects': '项目',
      'screening.engineering': '工程落地',
      'screening.theory': '理论方法',
      'screening.roles': '职务与投入',
      'screening.skills': '技能',
      'screening.awards': '奖项',
      'screening.editCandidate': '编辑资料',
      'screening.deleteCandidate': '删除候选人',
      'screening.template': '模板',
      'screening.total': '加权分',
      'screening.hitsOf': '命中',
      'screening.legacyCompare': '旧口径（命中数）对照',
      'template.title': '岗位模板',
      'template.subtitle': '选择维度、设置相对权重与门槛，组合成岗位考察模板',
      'template.new': '新建模板',
      'template.copy': '复制当前模板',
      'template.name': '模板名称',
      'template.family': '岗位族（英文标识，用于匿名交换聚合）',
      'template.description': '模板说明',
      'template.focusIndustry': '目标行业（可空）',
      'template.focusIndustryHint': '如「医疗器械」「量化金融」；仅用于展示与诊断说明',
      'template.focusKeywords': '行业关键词（可空）',
      'template.focusKeywordsHint': '命中任一关键词才认可「领域知识」；不命中时该维度按上限 0.4 计。留空则不校验。',
      'template.dimensions': '考察维度与权重',
      'template.weightSum': '权重合计',
      'template.normalized': '归一化后',
      'template.gate': '设门槛',
      'template.gateMin': '门槛',
      'template.recommendLine': '推荐线',
      'template.backupLine': '备选线',
      'template.hitLine': '命中线（分值 ≥）',
      'template.saveVersion': '保存为新版本',
      'template.versionNote': '版本说明',
      'template.history': '版本历史',
      'template.livePreview': '实时预览',
      'template.compare': '与另一模板对比',
      'template.compareHint': '选择另一个模板，查看同一批候选人的位次变化。',
      'template.bias': '维度偏差诊断',
      'template.majorMix': '推荐名单专业分布',
      'template.createFirst': '从左侧选择模板，或新建一个。',
      'template.delete': '删除模板',
      'template.professional': '专业集中度',
      'template.rankA': '当前模板',
      'template.rankB': '对照模板',
      'template.delta': '位次差',
      'template.noCompare': '暂无其他模板可对比。',
      'template.draft': '未保存草稿',
      'template.newHint': '新建模板，保存后成为当前模板',
      'template.editHint': '修改保存后会生成新版本，旧版本保留',
      'template.historyHint': '回溯会以旧版本内容创建新版本，不覆盖历史',
      'template.setActive': '设为当前模板',
      'template.isActive': '当前模板',
      'template.biasHelp': '「最大贡献」表示该维度是几位候选人的主导得分项；专业集中或维度主导过多，说明权重可能把结果推向单一背景。',
      'template.noBias': '当前没有明显的专业集中或维度主导信号。',
      'template.colDimension': '维度',
      'template.colWeight': '归一化',
      'template.colHits': '命中',
      'template.colDominant': '主导专业',
      'template.colContribution': '最大贡献',
      'template.colSignal': '信号',
      'template.discard': '放弃草稿',
      'template.unsavedTitle': '有未保存的草稿',
      'template.unsavedBody': '切换模板会丢弃当前草稿。可以先返回保存，或确认丢弃后继续。',
      'template.discardContinue': '丢弃并继续',
      'template.saved': '已保存版本',
      'template.weightHelp': '权重是相对值：系统按合计归一化。调 0 表示本模板不考察该维度。',
      'skill.title': '维度技能库',
      'skill.subtitle': '每个维度是一份独立的考察规范，已注册到 DSH 技能目录',
      'skill.registered': '已注册为 DSH skill',
      'skill.defaultWeight': '默认权重',
      'skill.currentVersion': '当前版本',
      'skill.method': '考察方法',
      'skill.evidence': '证据清单',
      'skill.scale': '分级标准',
      'skill.antiBias': '反偏差与反幻觉',
      'skill.probes': '面试追问',
      'skill.output': '输出格式',
      'skill.calibration': '校准建议',
      'skill.history': '版本历史',
      'skill.edit': '编辑并发布新版本',
      'skill.copy': '复制为新维度',
      'skill.copyPrompt': '新维度名称',
      'skill.objective': '考察目标',
      'skill.when': '何时使用',
      'skill.note': '版本说明',
      'skill.save': '发布新版本',
      'skill.editHint': '修改后会生成新版本；旧版本保留，可回溯。',
      'skill.lineHint': '每行一条',
      'exchange.title': '匿名交换账本',
      'exchange.subtitle': '只交换维度与模板的匿名聚合；不交换任何人才信息',
      'exchange.localOnly': '本地哈希链 · 仅本机服务 · 手动文件交换',
      'exchange.verify': '校验账本',
      'exchange.verified': '校验通过',
      'exchange.broken': '校验失败',
      'exchange.chainLength': '记录数',
      'exchange.lastHash': '最新哈希',
      'exchange.exportTitle': '生成匿名交换包',
      'exchange.exportBody': '聚合当前本地候选人的维度均值、等级占比、模板权重与样本量分级。生成后写入本地账本，可下载给同行。',
      'exchange.preview': '预览交换包',
      'exchange.export': '生成并写入账本',
      'exchange.download': '下载 JSON',
      'exchange.importTitle': '导入同行交换包',
      'exchange.importBody': '粘贴或选择 .json。导入前会执行字段白名单、隐私特征扫描与完整性哈希校验。',
      'exchange.import': '校验并导入',
      'exchange.importPlaceholder': '在此粘贴匿名交换包 JSON…',
      'exchange.demoPeer': '载入演示同行包',
      'exchange.paste': '粘贴 JSON',
      'exchange.file': '选择文件',
      'exchange.suggestions': '协同进化建议',
      'exchange.applySuggestion': '应用建议',
      'exchange.peers': '同行知识包',
      'exchange.ledger': '账本记录',
      'exchange.privacyChecks': '交换包只包含',
      'exchange.privacyFields': '维度均值 / 等级占比 / 归一化权重 / 样本量分级 / 岗位族',
      'exchange.noPeers': '还没有导入同行交换包。',
      'exchange.noSuggestions': '导入交换包后会显示权重与维度建议。',
      'exchange.duplicate': '该交换包已在本地账本中，未重复写入。',
      'exchange.selfEcho': '这是本机导出的交换包，不会作为同行证据回流。',
      'exchange.kAnonymity': '候选人数少于 5 人时，均值与等级占比接近个人画像；导出仍会执行，但请先确认对方无法反推具体个人。',
      'exchange.prototype': '说明：这是"本地哈希链 + 手动文件交换"的隐私安全原型，用于演示协同进化机制；它没有连接公链，也不会自动联网。',
      'exchange.payload': '载荷',
      'exchange.hash': '哈希',
      'exchange.kind': '类型',
      'exchange.time': '时间',
      'exchange.contributor': '匿名实例',
      'data.title': '数据与备份',
      'data.subtitle': '本地数据库、版本历史、显示模式与完整备份',
      'data.path': '数据目录',
      'data.instance': '匿名实例标识',
      'data.counts': '数据量',
      'data.showRealNames': '显示实名（仅本机）',
      'data.showRealNamesHint': '默认只显示匿名别名；开启后界面会显示本地录入的姓名。交换包永远不包含姓名。',
      'data.exportBackup': '导出完整备份',
      'data.exportBackupHint': '备份包含姓名、简历原文与评估证据，只能保存在本机，禁止上传。',
      'data.importBackup': '导入完整备份',
      'data.importBackupHint': '会覆盖当前本地数据库。输入 REPLACE 确认。',
      'data.reset': '恢复内置示例',
      'data.resetHint': '清空本地候选人、模板、技能版本、账本与快照，恢复内置维度技能与模板。示例候选人只在页面预览中出现，不会被写入。',
      'data.showSamples': '示例候选人仅用于首次预览，导入或新增真实候选人后自动隐藏，不占用数据库。',
      'data.refreshFields': '核对导入字段',
      'data.refreshFieldsHint': '用本地已存的简历文本和来源文件名重新推算专业/学历/院校/方向，只修正与当前结果不一致的字段。',
      'data.refreshFieldsBody': '下面列出重新解析后与当前记录不同的字段。专业优先取「专业/学科」字段与学历行，其次取文件名，不再从正文段落里猜。应用后会写入本地审计，可回溯。',
      'data.refreshSource': '来源文件',
      'data.refreshSuspects': '以下记录来自多人名单/评审文件，字段无法对应到单个人，建议删除后逐份重新导入',
      'data.refreshApply': '应用修正',
      'data.refreshApplied': '已修正 {n} 位候选人的字段',
      'data.refreshNone': '所有导入记录的字段都与重新解析结果一致，无需修正',
      'data.agentRefresh': '用智能体复核',
      'data.agentRefreshHint': '把已存的简历文本交给当前模型重读，修正姓名/专业/学历/院校/方向，并在结构化证据为空时补录论文、项目、工程经历。比规则更准，会消耗模型额度。',
      'data.agentRefreshNone': '模型复核后没有需要修改的字段',
      'data.agentRefreshApply': '应用模型复核结果',
      'data.agentRefreshBody': '下面列出模型重读后与当前记录不同的字段；只写入模型确实返回的值，结构化证据仅在原本为空时补录。应用后重跑规则初筛并记审计。',
      'data.agent': '模型',
      'data.rotate': '更换匿名实例标识',
      'data.rotateHint': '仅影响之后的交换包署名；历史账本仍可校验。',
      'data.audit': '本地审计记录',
      'data.privacyTitle': '隐私设计',
      'data.privacyBody': '人才信息只写入本地 JSON 数据库；插件不调用外部网络，也不把候选人信息写进交换包。完整备份属于敏感文件，请自行加密保存。',
      'data.confirmReset': '输入 RESET 确认恢复示例',
      'data.confirmImport': '输入 REPLACE 确认覆盖',
      'candidate.createTitle': '新增候选人',
      'candidate.editTitle': '编辑候选人资料',
      'candidate.alias': '匿名别名',
      'candidate.realName': '姓名（仅本机）',
      'candidate.realNameHidden': '实名已隐藏（仅本机保存）',
      'candidate.major': '专业',
      'candidate.degree': '学历',
      'candidate.school': '院校',
      'candidate.stage': '年级/阶段',
      'candidate.direction': '研究方向',
      'candidate.profileText': '简历文本 / 备注（仅本机）',
      'candidate.publications': '论文与成果',
      'candidate.projects': '科研项目',
      'candidate.engineering': '工程落地',
      'candidate.theory': '理论方法',
      'candidate.roles': '职务',
      'candidate.skills': '技能（逗号分隔）',
      'candidate.awards': '奖项（逗号分隔）',
      'candidate.addRow': '添加一行',
      'candidate.save': '保存候选人',
      'candidate.reassess': '保存并重新自动评估',
      'candidate.structured': '结构化证据（用于规则初筛）',
      'candidate.confirmDelete': '确认删除该候选人？',
      'candidate.role': '角色',
      'candidate.status': '状态',
      'candidate.tier': '层级',
      'candidate.venue': '期刊/会议',
      'candidate.projectName': '项目名称',
      'candidate.level': '级别',
      'candidate.validation': '验证阶段',
      'candidate.kind': '类型',
      'candidate.desc': '说明',
      'candidate.title': '职务名称',
      'candidate.current': '在任',
      'candidate.published': '已发表',
      'candidate.accepted': '已接收',
      'candidate.review': '在投/在审',
      'candidate.first': '一作',
      'candidate.cofirst': '共同一作',
      'candidate.other': '其他',
      'candidate.lead': '主导',
      'candidate.core': '核心',
      'candidate.participant': '参与',
      'candidate.national': '国家级',
      'candidate.provincial': '省部级',
      'candidate.enterprise': '企业',
      'candidate.lab': '实验室',
      'candidate.industrial': '产线/现场',
      'candidate.pilot': '中试',
      'candidate.party': '党务',
      'candidate.student': '学生干部',
      'candidate.admin': '行政',
      'candidate.deployment': '部署上线',
      'candidate.software': '软件平台',
      'candidate.control': '控制系统',
      'candidate.integration': '系统集成',
      'candidate.field': '现场交付',
      'candidate.firstPrinciples': '第一性原理',
      'candidate.md': '分子动力学',
      'candidate.numerical': '数值算法',
      'candidate.thermodynamics': '热力学/相图',
      'candidate.ml': '机器学习',
      'tab.batches': "批次与反馈",
      'batch.title': "面试批次",
      'batch.subtitle': "同一批次的简历才会互相比较。建议按面试时间划分：同一天，或相近的两三天。",
      'batch.suggest': "按面试日期建议",
      'batch.suggestNone': "没有可用的面试日期，先在候选人里补录日期",
      'batch.suggested': "已按面试日期给出 {n} 组建议",
      'batch.suggestResult': "{n} 组建议（点击展开）",
      'batch.createFrom': "按此建批次",
      'batch.none': "还没有批次",
      'batch.noneBody': "建立第一个批次，再把简历分配进来",
      'batch.name': "批次名称",
      'batch.namePlaceholder': "例如：9 月 12 日面试",
      'batch.from': "面试开始",
      'batch.to': "面试结束",
      'batch.note': "批次备注（可留空）",
      'batch.create': "新建批次",
      'batch.created': "批次已创建",
      'batch.deleted': "批次已删除",
      'batch.people': "人",
      'batch.interview': "面试",
      'batch.noDate': "未填日期",
      'batch.current': "当前比较",
      'batch.assignTitle': "把简历分配进批次",
      'batch.assignHint': "勾选候选人后分配到所选批次；移动后立即按新批次比较",
      'batch.pickBatch': "选择批次…",
      'batch.selected': "位已勾选",
      'batch.assign': "分配",
      'batch.assigned': "已分配 {n} 位候选人",
      'batch.noneSelected': "请先勾选候选人并选择批次",
      'batch.unassigned': "未分批",
      'batch.compareIn': "当前比较批次",
      'batch.manage': "管理批次",
      'feedback.title': "招聘者反馈",
      'feedback.subtitle': "针对某份简历或某个批次写下判断，攒够几条后可以让智能体据此调整模板的维度与权重。",
      'feedback.pending': "条待处理",
      'feedback.askAgent': "让智能体调整模板",
      'feedback.scope': "反馈对象",
      'feedback.scopeCandidate': "某份简历",
      'feedback.scopeBatch': "某个批次",
      'feedback.scopeTask': "整个任务",
      'feedback.target': "具体对象",
      'feedback.pickTarget': "请选择…",
      'feedback.kind': "反馈类型",
      'feedback.kindPositive': "认可",
      'feedback.kindNegative': "不认可",
      'feedback.kindAdjust': "希望调整",
      'feedback.kindNote': "备注",
      'feedback.message': "写一句具体原因，例如：这位的工程落地证据少，不应排在技术栈强但无交付的人前面",
      'feedback.add': "记录反馈",
      'feedback.added': "反馈已记录",
      'feedback.none': "还没有反馈。反馈越具体，智能体调权重时越有依据。",
      'feedback.appliedTo': "已应用 v",
      'feedback.agentTitle': "智能体建议的模板调整",
      'feedback.apply': "应用并生成新版本",
      'feedback.applyHint': "应用后会生成模板的新版本，旧版本随时可回溯；已应用的反馈会被标记。",
      'feedback.applied': "已生成模板新版本 v{v}",
      'feedback.noChange': "这次没有产生调整",
      'feedback.colDimension': "维度",
      'feedback.colFrom': "原权重",
      'feedback.colTo': "新权重",
      'feedback.newDimension': "新增",
      'feedback.removed': "移除",
      'candidate.interviewDate': "面试日期",
      'candidate.interviewDateHint': "用于自动建议批次划分",
      'task.onlyEntry': "招聘任务是进入筛选流程的唯一入口",
      'task.listTitle': "招聘任务",
      'task.listSubtitle': "每个任务一个岗位、一个模板；简历必须先进任务，再划分批次。",
      'task.batchUnit': "个批次",
      'batch.includeOther': "也显示其他任务的候选人（用于重新归位）",
      'task.label': "招聘任务",
      'task.none': "还没有招聘任务",
      'task.gateTitle': "先建立一个招聘任务",
      'task.gateBody': "所有简历都归属于某个招聘任务下的某个面试批次，不同批次的简历不会混在一起比较。先建任务，再选模板，最后把简历分成批次。",
      'task.gateStep1': "建立招聘任务",
      'task.gateStep1Body': "一个岗位一个任务，例如「算法工程师 · 2026 春招」。",
      'task.gateStep2': "选择初始模板",
      'task.gateStep2Body': "从 13 个岗位模板里挑一个，或之后在模板页自己写。",
      'task.gateStep3': "上传简历并分批",
      'task.gateStep3Body': "按面试日期分组，同一天或相近两三天的简历放进同一个批次。",
      'task.create': "建立招聘任务",
      'task.name': "任务名称",
      'task.namePlaceholder': "例如：算法工程师 · 2026 春招",
      'task.nameRequired': "请填写任务名称",
      'task.description': "任务说明",
      'task.descriptionPlaceholder': "招聘背景、HC、面试节奏等（可留空）",
      'task.initialTemplate': "初始模板",
      'task.initialTemplateHint': "任务建好后仍可随时切换模板，切换只影响之后的计算，历史版本会保留。",
      'task.created': "招聘任务已建立",
      'task.current': "当前招聘任务",
      'task.saved': "任务已保存",
      'task.archive': "归档任务",
      'task.unarchive': "恢复任务",
      'task.archived': "任务状态已更新",
      'task.archivedState': "已归档",
      'task.activeState': "进行中",
      'task.templateSwitched': "已切换任务模板（生成新版本前不影响历史）",
      'task.searchPlaceholder': "搜索任务名称、模板或说明…",
      'task.groupActive': "进行中",
      'task.groupArchived': "已归档",
      'task.noMatch': "没有匹配的任务",
      'task.total': "个任务",
    }

    const enOverrides = {
      'tab.title': 'Talent workbench',
      'guide.title': 'Talent workbench',
      'guide.description': 'Adjustable weights, visible reasoning, local screening and anonymous exchange',
      'button.open': 'Talent',
      'button.openHint': 'Open the local talent workbench',
      'app.title': 'Talent workbench',
      'app.subtitle': 'Explainable resume screening · weighted role templates · dimension skills',
      'app.local': 'Local database',
      'app.noNetwork': 'Local service only',
      'demo.badge': 'Sample preview',
      'demo.banner': 'No local candidates yet, so built-in samples are shown (preview only, never written to the database). They disappear once you import or add the first real candidate.',
      'demo.hint': 'Sample candidates cannot be edited, re-levelled or snapshotted; those actions need real candidates.',
      'demo.overview': 'Built-in sample candidates exist only in this page for previewing the UI and weight effects; they are not in the local database and are hidden after the first real import.',
      'demo.readOnly': 'Sample data is read-only',
      'demo.noRun': 'Sample data cannot produce a snapshot or report',
      'demo.short': 'sample data',
      'app.private': 'Privacy-safe',
      'app.refresh': 'Refresh',
      'app.loading': 'Loading the local workbench…',
      'app.loadError': 'Cannot read the local workbench. Check that the plugin is enabled and refresh the page.',
      'app.retry': 'Retry',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.edit': 'Edit',
      'common.add': 'Add',
      'common.reset': 'Revert',
      'common.show': 'Show',
      'common.hide': 'Hide',
      'common.close': 'Close',
      'common.export': 'Export',
      'common.import': 'Import',
      'common.rank': 'Rank',
      'common.score': 'Score',
      'common.major': 'Major',
      'common.decision': 'Decision',
      'common.recommend': 'Interview',
      'common.backup': 'Backup',
      'common.hold': 'Hold',
      'tab.overview': 'Overview',
      'tab.screening': 'Screening',
      'tab.templates': 'Templates',
      'tab.skills': 'Skills',
      'tab.exchange': 'Exchange',
      'tab.data': 'Data',
      'screening.title': 'Screening derivation',
      'screening.addCandidate': 'Add candidate',
      'screening.import': 'Import resumes',
      'import.title': 'Import resumes',
      'import.subtitle': 'PDF, DOC, DOCX, RTF, TXT and images (PNG/JPEG/WebP/BMP/TIFF). Everything is parsed locally: text layers directly, scans and images with the Windows OCR engine. Nothing is uploaded.',
      'import.pickFiles': 'Choose files',
      'import.pickFolder': 'Choose folder',
      'import.commit': 'Import selected',
      'import.byAgent': 'Agent parsed',
      'import.byRule': 'Rule parsed',
      'import.agentNotice': 'Fields (name, major, degree, school, direction, publications, projects…) are read by the model you configured. Only the extracted text is sent to that model; no files are uploaded. Set import.useAgent=false to use the local rules instead.',
      'import.agentUnavailable': 'Agent parsing unavailable ({reason}); local rules were used. Rules are unreliable for names and majors — please review after importing.',
      'import.preview': 'Show extracted text',
      'import.failed': 'Failed',
      'import.duplicate': 'Possible duplicate',
      'import.duplicateBlocked': 'Same content as an existing resume; will not be imported again',
      'import.lowQuality': 'Too little text',
      'import.multiCandidate': 'Multiple people?',
      'import.skipped': 'Skipped files',
      'import.reselect': 'Choose again',
      'import.alias': 'Alias',
      'import.major': 'Major',
      'import.degree': 'Degree',
      'import.school': 'School',
      'import.direction': 'Research direction',
      'import.pathTitle': 'Import from a local path (optional)',
      'import.pathHint': 'Enter an absolute file or folder path; the Host reads it directly. Useful for bulk folders or agent runs.',
      'import.recursive': 'Include subfolders',
      'import.scanPath': 'Scan path',
      'import.select': 'select',
      'import.selectAll': 'Select all',
      'import.clearAll': 'Clear all',
      'import.hint': 'OCR text can contain errors; check name, major, degree and school below before importing. Imported data can still be edited later.',
      'import.limits': 'Up to 40 files and 40 MB per batch; 30 MB per file; scanned PDFs are OCRed for the first 6 pages only.',
      'import.phaseList': 'Listing files',
      'import.phaseExtractProgress': 'Extracting text ({done}/{total})',
      'import.phaseAgent': 'Agent reading fields ({done}/{total})',
      'import.jobDone': 'Finished — review and import',
      'import.jobFailed': 'Parsing failed',
      'import.jobCancelled': 'Parsing cancelled',
      'import.backgroundHint': 'Runs in the background: closing this dialog, switching tabs or even reloading the page will not stop it.',
      'import.jobFinishedHint': 'The result is kept on this machine; come back any time to review and import.',
      'import.closeKeepRunning': 'Close (keeps running)',
      'import.cancelJob': 'Cancel task',
      'import.viewProgress': 'View progress',
      'import.reviewResult': 'Review result',
      'import.extractedSoFar': 'Extracted',
      'import.keepOpen': 'Keep this window open while parsing; closing it cleans up the temporary files once parsing finishes.',
      'import.closeAfterScan': 'Close when done',
      'import.noneSelected': 'Select at least one resume',
      'screening.autoAssess': 'Re-run first pass',
      'screening.newRun': 'Snapshot results',
      'screening.exportReport': 'Export report',
      'template.title': 'Role templates',
      'template.new': 'New template',
      'template.saveVersion': 'Save as new version',
      'template.draft': 'Unsaved draft',
      'template.newHint': 'New template; saving makes it the active one',
      'template.editHint': 'Saving creates a new version and keeps the old ones',
      'template.setActive': 'Set as active',
      'template.isActive': 'Active',
      'template.discard': 'Discard draft',
      'template.unsavedTitle': 'Unsaved draft',
      'template.unsavedBody': 'Switching templates discards the current draft. Save it first, or confirm to discard.',
      'template.discardContinue': 'Discard and continue',
      'screening.draftBanner': 'Previewing an unsaved draft: ranking and derivation use the draft weights until you save.',
      'screening.thresholds': 'Decision thresholds (current template)',
      'template.colDimension': 'Dimension',
      'template.colWeight': 'Normalized',
      'template.colHits': 'Hits',
      'template.colDominant': 'Dominant major',
      'template.colContribution': 'Top contributions',
      'template.colSignal': 'Signals',
      'template.bias': 'Dimension bias diagnostics',
      'template.focusIndustry': 'Target industry (optional)',
      'template.focusIndustryHint': 'e.g. Medical devices, Quant finance; shown in diagnostics',
      'template.focusKeywords': 'Industry keywords (optional)',
      'template.focusKeywordsHint': 'Domain knowledge only counts when one keyword matches; otherwise it is capped at 0.4. Empty disables the check.',
      'template.noBias': 'No concentration or dominant-dimension signal right now.',
      'skill.title': 'Dimension skill library',
      'exchange.title': 'Anonymous exchange ledger',
      'exchange.demoPeer': 'Load demo peer pack',
      'data.title': 'Data and backup',
      'data.refreshFields': 'Re-check imported fields',
      'data.refreshFieldsHint': 'Re-derive major/degree/school/direction from the stored resume text and source file name; only fields that differ are changed.',
      'data.refreshFieldsBody': 'These fields differ from the re-parsed result. Major comes from an explicit field or degree line first, then the file name — no longer from prose in the body. Applying writes a local audit entry.',
      'data.agentRefresh': 'Re-check with the model',
      'data.agentRefreshApply': 'Apply model result',
      'data.agentRefreshNone': 'The model found nothing to change',
      'data.refreshSource': 'Source file',
      'data.refreshSuspects': 'These records came from a multi-person document, so their fields cannot describe one person; delete and re-import per resume',
      'data.refreshApply': 'Apply',
      'data.refreshApplied': 'Updated {n} candidate(s)',
      'data.refreshNone': 'All imported records already match the re-parsed result',
      'tab.batches': "Batches & feedback",
      'batch.title': "Interview batches",
      'batch.subtitle': "Only resumes in the same batch are compared. Group by interview time: the same day, or two or three close days.",
      'batch.suggest': "Suggest from interview dates",
      'batch.suggestNone': "No interview dates yet — add them on the candidates first",
      'batch.suggested': "{n} suggested groups",
      'batch.suggestResult': "{n} suggested groups (expand)",
      'batch.createFrom': "Create this batch",
      'batch.none': "No batches yet",
      'batch.noneBody': "Create the first batch, then assign resumes to it",
      'batch.name': "Batch name",
      'batch.namePlaceholder': "e.g. Interviews on 12 September",
      'batch.from': "Interview from",
      'batch.to': "Interview to",
      'batch.note': "Batch note (optional)",
      'batch.create': "New batch",
      'batch.created': "Batch created",
      'batch.deleted': "Batch deleted",
      'batch.people': "people",
      'batch.interview': "interviews",
      'batch.noDate': "no date",
      'batch.current': "comparing",
      'batch.assignTitle': "Assign resumes to a batch",
      'batch.assignHint': "Tick candidates, then assign them; rankings update immediately",
      'batch.pickBatch': "Pick a batch…",
      'batch.selected': "selected",
      'batch.assign': "Assign",
      'batch.assigned': "Assigned {n} candidate(s)",
      'batch.noneSelected': "Tick candidates and pick a batch first",
      'batch.unassigned': "unassigned",
      'batch.compareIn': "Comparing batch",
      'batch.manage': "Manage batches",
      'feedback.title': "Reviewer feedback",
      'feedback.subtitle': "Record a judgement on one resume or a whole batch; once you have a few, the agent can adjust the template dimensions and weights.",
      'feedback.pending': "pending",
      'feedback.askAgent': "Ask the agent to adjust",
      'feedback.scope': "Feedback on",
      'feedback.scopeCandidate': "One resume",
      'feedback.scopeBatch': "One batch",
      'feedback.scopeTask': "Whole task",
      'feedback.target': "Which one",
      'feedback.pickTarget': "Pick one…",
      'feedback.kind': "Kind",
      'feedback.kindPositive': "Agree",
      'feedback.kindNegative': "Disagree",
      'feedback.kindAdjust': "Needs adjusting",
      'feedback.kindNote': "Note",
      'feedback.message': "One concrete reason, e.g. “thin delivery evidence, should not outrank strong tech stack without shipping”",
      'feedback.add': "Record feedback",
      'feedback.added': "Feedback recorded",
      'feedback.none': "No feedback yet. The more specific it is, the better the agent can justify a change.",
      'feedback.appliedTo': "applied in v",
      'feedback.agentTitle': "Suggested template adjustment",
      'feedback.apply': "Apply as a new version",
      'feedback.applyHint': "Applying creates a new template version; old versions remain rollback-able and applied feedback is marked.",
      'feedback.applied': "Created template version v{v}",
      'feedback.noChange': "No adjustment this time",
      'feedback.colDimension': "Dimension",
      'feedback.colFrom': "From",
      'feedback.colTo': "To",
      'feedback.newDimension': "new",
      'feedback.removed': "removed",
      'candidate.interviewDate': "Interview date",
      'candidate.interviewDateHint': "Used to suggest batch boundaries",
      'task.onlyEntry': "A recruiting task is the only way into the screening flow",
      'task.listTitle': "Recruiting tasks",
      'task.listSubtitle': "One role and one template per task; resumes must enter a task before they can be batched.",
      'task.batchUnit': "batches",
      'batch.includeOther': "Also show candidates from other tasks (to re-file them here)",
      'task.label': "Recruiting task",
      'task.none': "No recruiting task yet",
      'task.gateTitle': "Create a recruiting task first",
      'task.gateBody': "Every resume belongs to one interview batch of one recruiting task, and different batches are never compared together. Create the task, pick a template, then split the resumes into batches.",
      'task.gateStep1': "Create the task",
      'task.gateStep1Body': "One role, one task — e.g. “Algorithm engineer · 2026 spring”.",
      'task.gateStep2': "Pick an initial template",
      'task.gateStep2Body': "Start from one of the 13 role templates, or write your own later.",
      'task.gateStep3': "Upload and batch",
      'task.gateStep3Body': "Group by interview date: the same day, or a run of two or three days.",
      'task.create': "Create task",
      'task.name': "Task name",
      'task.namePlaceholder': "e.g. Algorithm engineer · 2026 spring",
      'task.nameRequired': "Give the task a name",
      'task.description': "Description",
      'task.descriptionPlaceholder': "Headcount, interview cadence, anything useful (optional)",
      'task.initialTemplate': "Initial template",
      'task.initialTemplateHint': "You can switch templates later; the switch only affects new calculations and old versions are kept.",
      'task.created': "Recruiting task created",
      'task.current': "Current task",
      'task.saved': "Task saved",
      'task.archive': "Archive",
      'task.unarchive': "Restore",
      'task.archived': "Task status updated",
      'task.archivedState': "archived",
      'task.activeState': "active",
      'task.templateSwitched': "Task template switched (history is preserved)",
      'task.searchPlaceholder': "Search by task name, template or note…",
      'task.groupActive': "Active",
      'task.groupArchived': "Archived",
      'task.noMatch': "No matching task",
      'task.total': "tasks",
    }
    const en = { ...zh, ...enOverrides }

    const CSS = `
/* ---------- design tokens (local aliases over host theme tokens) ---------- */
.tw-root{
  --tw-radius:12px;
  --tw-radius-sm:8px;
  --tw-border:1px solid var(--dsw-alias-border-l1);
  --tw-border-strong:1px solid var(--dsw-alias-border-l2);
  --tw-surface:var(--dsw-alias-bg-layer-1);
  --tw-surface-2:var(--dsw-alias-bg-layer-2);
  --tw-shadow-sm:0 1px 2px color-mix(in srgb,var(--dsw-alias-label-primary) 8%,transparent);
  --tw-shadow-md:0 8px 24px color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent);
  --tw-tint-brand:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);
  --tw-tint-brand-strong:color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent);
  --tw-tint-warn:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent);
  --tw-tint-error:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);
  --tw-tint-success:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);
  position:relative;
  container-type:inline-size;
  height:100%;
  min-height:0;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  color:var(--dsw-alias-label-primary);
  background:var(--dsw-alias-bg-base);
  font:inherit;
  font-size:14.5px;
  line-height:1.55;
  box-sizing:border-box;
}
.tw-root *{box-sizing:border-box}

/* ---------- page chrome ---------- */
.tw-header{
  flex:0 0 auto;
  display:flex;
  flex-direction:column;
  gap:12px;
  padding:18px 24px 14px;
  border-bottom:var(--tw-border);
  background:var(--dsw-alias-bg-base);
}
.tw-headrow{display:flex;align-items:flex-start;gap:12px;min-width:0}
.tw-logo{
  flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;
  background:var(--tw-tint-brand);color:var(--dsw-alias-brand-primary);
}
.tw-headtext{flex:1;min-width:0}
.tw-title{margin:0;font-size:19px;font-weight:650;line-height:1.35;letter-spacing:-0.01em}
.tw-sub{margin-top:2px;font-size:13.5px;color:var(--dsw-alias-label-secondary)}
.tw-headactions{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.tw-badges{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.tw-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}

/* ---------- badges ---------- */
.tw-badge{
  display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px;
  font-size:12.5px;line-height:1.6;font-weight:500;white-space:nowrap;
  border:1px solid var(--dsw-alias-border-l1);background:var(--tw-surface-2);
  color:var(--dsw-alias-label-secondary);
}
.tw-badge.brand{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent);background:var(--tw-tint-brand)}
.tw-badge.success{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 32%,transparent);background:var(--tw-tint-success)}
.tw-badge.warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 34%,transparent);background:var(--tw-tint-warn)}
.tw-badge.error{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 34%,transparent);background:var(--tw-tint-error)}
.tw-badge.idle{color:var(--dsw-alias-state-idle-primary)}

/* ---------- tabs: segmented control ---------- */
.tw-tabs{
  flex:0 0 auto;display:flex;flex-wrap:wrap;gap:4px;
  padding:8px 24px 10px;border-bottom:var(--tw-border);background:var(--dsw-alias-bg-base);
}
.tw-tab{
  appearance:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:14px;font-weight:500;line-height:1.2;border-radius:9px;padding:8px 14px;
  cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:7px;
  transition:background .12s ease,color .12s ease,border-color .12s ease;
}
.tw-tab:hover{background:var(--tw-surface);color:var(--dsw-alias-label-primary)}
.tw-tab:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.tw-tab.active{
  background:var(--tw-surface);color:var(--dsw-alias-label-primary);
  border-color:var(--dsw-alias-border-l2);font-weight:600;box-shadow:var(--tw-shadow-sm);
}
.tw-tab .count{
  font-size:12px;font-weight:600;line-height:1.4;padding:0 6px;border-radius:999px;
  background:var(--tw-surface-2);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;
}
.tw-tab.active .count{background:var(--tw-tint-brand);color:var(--dsw-alias-brand-primary)}

/* ---------- content ---------- */
.tw-content{flex:1 1 auto;min-height:0;overflow:auto;padding:18px 24px 56px;scrollbar-width:thin}
.tw-content > *{max-width:1360px;margin-left:auto;margin-right:auto;width:100%}

/* ---------- buttons ---------- */
.tw-btn{
  appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  border:1px solid var(--dsw-alias-border-l2);background:var(--tw-surface);color:var(--dsw-alias-label-primary);
  border-radius:9px;font:inherit;font-size:14px;font-weight:550;line-height:1.2;padding:8px 14px;
  min-height:34px;cursor:pointer;white-space:nowrap;text-decoration:none;
  transition:background .12s ease,border-color .12s ease,color .12s ease,filter .12s ease;
  box-shadow:var(--tw-shadow-sm);
}
.tw-btn:hover{background:var(--tw-surface-2);border-color:color-mix(in srgb,var(--dsw-alias-label-secondary) 40%,var(--dsw-alias-border-l2))}
.tw-btn:active{transform:translateY(0.5px)}
.tw-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tw-btn.primary{
  background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);
  color:var(--dsw-alias-bg-base);font-weight:650;box-shadow:0 1px 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent);
}
.tw-btn.primary:hover{filter:brightness(1.07)}
.tw-btn.soft{background:var(--tw-tint-brand);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);color:var(--dsw-alias-brand-primary);font-weight:600}
.tw-btn.soft:hover{background:var(--tw-tint-brand-strong)}
.tw-btn.ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary);box-shadow:none;padding:7px 10px}
.tw-btn.ghost:hover{background:var(--tw-surface);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l1)}
.tw-btn.danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 42%,transparent);background:transparent;box-shadow:none}
.tw-btn.danger:hover{background:var(--tw-tint-error)}
.tw-btn.sm{font-size:13px;padding:6px 10px;min-height:30px;border-radius:8px}
.tw-btn.icon{padding:7px;min-height:32px;min-width:32px}
.tw-btn:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;filter:none}

/* ---------- form controls ---------- */
.tw-input,.tw-select,.tw-textarea{
  width:100%;min-width:0;border:var(--tw-border-strong);border-radius:9px;
  background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
  font:inherit;font-size:14px;line-height:1.45;padding:8px 11px;min-height:34px;
  transition:border-color .12s ease,box-shadow .12s ease;
}
.tw-input:hover,.tw-select:hover,.tw-textarea:hover{border-color:color-mix(in srgb,var(--dsw-alias-label-secondary) 45%,var(--dsw-alias-border-l2))}
.tw-input:focus,.tw-select:focus,.tw-textarea:focus{
  outline:none;border-color:var(--dsw-alias-brand-primary);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent);
}
.tw-input:disabled,.tw-select:disabled,.tw-textarea:disabled{opacity:.55;cursor:not-allowed;background:var(--tw-surface)}
.tw-textarea{resize:vertical;min-height:72px}
.tw-select{appearance:auto;padding-right:8px}
.tw-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.tw-label{font-size:13px;color:var(--dsw-alias-label-secondary);font-weight:600}
.tw-hint{font-size:12.5px;color:var(--dsw-alias-label-secondary);line-height:1.5}

/* ---------- cards ---------- */
.tw-card{
  border:var(--tw-border);background:var(--tw-surface);border-radius:var(--tw-radius);
  padding:15px 18px;box-shadow:var(--tw-shadow-sm);
}
.tw-card.pad0{padding:0;overflow:hidden}
.tw-card-head{display:flex;align-items:flex-start;gap:10px;justify-content:space-between;margin-bottom:10px}
.tw-card-title{font-size:14.5px;font-weight:650;line-height:1.35}
.tw-card-sub{font-size:13px;color:var(--dsw-alias-label-secondary);margin-top:2px}
.tw-muted{color:var(--dsw-alias-label-secondary)}
.tw-small{font-size:13px}
.tw-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px}
.tw-grid{display:grid;gap:12px}
.tw-grid.cols2{grid-template-columns:repeat(2,minmax(0,1fr))}
.tw-grid.cols3{grid-template-columns:repeat(3,minmax(0,1fr))}
.tw-grid.cols4{grid-template-columns:repeat(4,minmax(0,1fr))}
.tw-row{display:flex;align-items:center;gap:8px;min-width:0}
.tw-row.wrap{flex-wrap:wrap}
.tw-spacer{flex:1}
.tw-divider{height:1px;background:var(--dsw-alias-border-l1);margin:12px 0}
.tw-empty{
  padding:36px 20px;text-align:center;border:1px dashed var(--dsw-alias-border-l2);
  border-radius:var(--tw-radius);color:var(--dsw-alias-label-secondary);font-size:14px;line-height:1.7;
  background:var(--tw-surface);
}
.tw-empty strong{display:block;color:var(--dsw-alias-label-primary);font-size:15.5px;margin-bottom:4px}

/* ---------- notices ---------- */
.tw-notice{
  display:flex;align-items:flex-start;gap:8px;border-radius:10px;padding:10px 12px;font-size:14px;
  border:var(--tw-border);background:var(--tw-surface);margin-bottom:12px;box-shadow:var(--tw-shadow-sm);
}
.tw-notice.ok{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 34%,transparent);background:var(--tw-tint-success);color:var(--dsw-alias-label-primary)}
.tw-notice.err{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 34%,transparent);background:var(--tw-tint-error);color:var(--dsw-alias-label-primary)}
.tw-notice.warn{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent);background:var(--tw-tint-warn);color:var(--dsw-alias-label-primary)}
.tw-notice.tw-toast{position:absolute;right:24px;bottom:20px;left:auto;top:auto;margin:0;z-index:60;pointer-events:none;box-shadow:var(--tw-shadow-md);max-width:460px}
.tw-notice.tw-toast button{pointer-events:auto}
.tw-info{
  border-left:3px solid var(--dsw-alias-brand-primary);padding:8px 12px;border-radius:0 var(--tw-radius-sm) var(--tw-radius-sm) 0;
  background:var(--tw-tint-brand);font-size:13.5px;line-height:1.6;margin:6px 0;
}
.tw-warning{
  border-left:3px solid var(--dsw-alias-state-warn-primary);padding:8px 12px;border-radius:0 var(--tw-radius-sm) var(--tw-radius-sm) 0;
  background:var(--tw-tint-warn);font-size:13.5px;line-height:1.6;margin:6px 0;
}
.tw-draftbar{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:10px;padding:9px 12px;font-size:13.5px;
  border:1px dashed color-mix(in srgb,var(--dsw-alias-state-warn-primary) 60%,transparent);
  background:var(--tw-tint-warn);color:var(--dsw-alias-label-primary);
}
.tw-legend{font-size:13.5px;color:var(--dsw-alias-label-secondary)}
.tw-flagdot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-warn-primary);margin-left:3px}
.tw-chips{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.tw-chip{font-size:12px;line-height:1.55;padding:2px 8px;border-radius:999px;background:var(--tw-surface-2);color:var(--dsw-alias-label-secondary);white-space:nowrap}
.tw-chip.warn{background:var(--tw-tint-warn);color:var(--dsw-alias-state-warn-primary)}

/* ---------- stat tiles ---------- */
.tw-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px}
.tw-stat{border:var(--tw-border);background:var(--tw-surface);border-radius:var(--tw-radius);padding:13px 15px;box-shadow:var(--tw-shadow-sm)}
.tw-stat .v{font-size:24px;font-weight:650;line-height:1.15;letter-spacing:-0.02em;font-variant-numeric:tabular-nums}
.tw-stat .k{font-size:12.5px;color:var(--dsw-alias-label-secondary);margin-top:3px}

/* ---------- hero ---------- */
.tw-hero{
  border:var(--tw-border);background:
    linear-gradient(135deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent),transparent 62%),
    var(--tw-surface);
  border-radius:14px;padding:20px 22px;box-shadow:var(--tw-shadow-sm);
}
.tw-hero h2{margin:0 0 6px;font-size:19px;line-height:1.35;letter-spacing:-0.01em}
.tw-hero p{margin:0;font-size:14px;color:var(--dsw-alias-label-secondary);line-height:1.7;max-width:80ch}
.tw-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px}
.tw-step{border:var(--tw-border);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-base)}
.tw-step .n{display:inline-flex;width:18px;height:18px;border-radius:50%;align-items:center;justify-content:center;
  background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-size:12px;font-weight:700;margin-right:6px}
.tw-step .tw-t{font-size:13.5px;font-weight:650}
.tw-step .tw-b{font-size:12.5px;color:var(--dsw-alias-label-secondary);margin-top:3px;line-height:1.55}

/* ---------- screening layout ---------- */
.tw-screening{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
.tw-col-list{flex:1 1 260px;min-width:230px;max-width:330px}
.tw-col-main{flex:3 1 420px;min-width:300px}
.tw-col-side{flex:1 1 280px;min-width:250px;max-width:350px}
.tw-cand-list{display:flex;flex-direction:column;gap:3px;max-height:min(64vh,660px);overflow:auto;padding:2px}
.tw-cand{
  appearance:none;text-align:left;border:1px solid transparent;background:transparent;color:inherit;
  border-radius:9px;padding:9px 11px;cursor:pointer;display:flex;flex-direction:column;gap:3px;min-width:0;
  border-left:3px solid transparent;transition:background .12s ease,border-color .12s ease;
}
.tw-cand:hover{background:var(--tw-surface-2)}
.tw-cand:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.tw-cand.active{background:var(--tw-surface-2);border-color:var(--dsw-alias-border-l1);border-left-color:var(--dsw-alias-brand-primary)}
.tw-cand .line1{display:flex;align-items:baseline;gap:8px;min-width:0}
.tw-cand .rank{flex:0 0 auto;font-size:12px;min-width:22px;text-align:center;padding:0 4px;border-radius:6px;background:var(--tw-surface-2);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.tw-cand .name{flex:1;min-width:0;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tw-cand .meta{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--dsw-alias-label-secondary);padding-left:26px;min-width:0}
.tw-cand .meta span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tw-cand .score{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:650;font-size:13.5px}

/* ---------- dimension rows ---------- */
.tw-dim{border:var(--tw-border);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-base);margin-bottom:8px}
.tw-dim-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tw-dim-name{font-size:14px;font-weight:650;min-width:96px}
.tw-dim-weight{font-size:12.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;
  padding:0 7px;border-radius:999px;background:var(--tw-surface-2)}
.tw-dim-score{margin-left:auto;font-size:13px;font-weight:650;font-variant-numeric:tabular-nums}
.tw-bar{height:6px;border-radius:999px;background:var(--tw-surface-2);overflow:hidden;margin-top:7px}
.tw-bar > i{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width .18s ease}
.tw-bar.warn > i{background:var(--dsw-alias-state-warn-primary)}
.tw-bar.err > i{background:var(--dsw-alias-state-error-primary)}
.tw-bar.ok > i{background:var(--dsw-alias-state-success-primary)}
.tw-dim-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:7px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.tw-dim-evidence{margin-top:8px;font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.65;
  border-top:1px dashed var(--dsw-alias-border-l1);padding-top:8px}
.tw-dim-evidence ul{margin:4px 0 0;padding-left:16px}
.tw-dim-evidence li{margin:2px 0}

/* ---------- score card ---------- */
.tw-scorecard{position:sticky;top:0;display:flex;flex-direction:column;gap:12px}
.tw-bigscore{font-size:36px;font-weight:700;line-height:1;letter-spacing:-0.03em;font-variant-numeric:tabular-nums}
.tw-scoremeta{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.tw-why{font-size:13px;line-height:1.65;color:var(--dsw-alias-label-secondary)}

/* ---------- thresholds ---------- */
.tw-threshold{margin-top:8px}
.tw-threshold-track{position:relative;height:8px;border-radius:999px;background:var(--tw-surface-2)}
.tw-threshold-track > i{position:absolute;inset:0 auto 0 0;border-radius:999px;
  background:linear-gradient(90deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent),var(--dsw-alias-brand-primary))}
.tw-threshold-mark{position:absolute;top:-3px;bottom:-3px;width:1.5px;background:var(--dsw-alias-label-secondary);opacity:.65}
.tw-threshold-mark.strong{opacity:1;background:var(--dsw-alias-state-error-primary);width:2px}

/* ---------- tables ---------- */
.tw-table-wrap{overflow:auto;border:var(--tw-border);border-radius:10px;background:var(--dsw-alias-bg-base)}
.tw-table{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px;min-width:640px}
.tw-table th,.tw-table td{text-align:left;padding:9px 12px;border-bottom:var(--tw-border);vertical-align:middle}
.tw-table th{
  font-size:12.5px;color:var(--dsw-alias-label-secondary);font-weight:600;background:var(--tw-surface);
  position:sticky;top:0;white-space:nowrap;z-index:1;
}
.tw-table tr:last-child td{border-bottom:0}
.tw-table tbody tr{cursor:pointer;transition:background .1s ease}
.tw-table tbody tr:hover{background:var(--tw-surface-2)}
.tw-table tbody tr:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.tw-table .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.tw-table .nowrap{white-space:nowrap}

/* ---------- master/detail split ---------- */
.tw-split{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
.tw-split > .tw-listpane{flex:1 1 250px;min-width:220px;max-width:330px}
.tw-split > .tw-editpane{flex:3 1 460px;min-width:300px}
.tw-listitem{
  appearance:none;text-align:left;border:1px solid transparent;background:transparent;color:inherit;
  border-radius:9px;padding:10px 11px;cursor:pointer;display:flex;flex-direction:column;gap:3px;width:100%;
  border-left:3px solid transparent;transition:background .12s ease,border-color .12s ease;
}
.tw-listitem:hover{background:var(--tw-surface-2)}
.tw-listitem.active{background:var(--tw-surface-2);border-color:var(--dsw-alias-border-l1);border-left-color:var(--dsw-alias-brand-primary)}
.tw-listitem .name{font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tw-listitem .meta{font-size:12.5px;color:var(--dsw-alias-label-secondary);display:flex;gap:8px;flex-wrap:wrap;align-items:center}

/* ---------- weight editor ---------- */
.tw-weight-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 0;border-bottom:var(--tw-border)}
.tw-weight-row:last-child{border-bottom:0}
.tw-weight-row .name{flex:1 1 130px;min-width:100px;font-size:13.5px;display:flex;align-items:center;gap:7px;font-weight:550}
.tw-weight-row input[type=range]{flex:1 1 110px;min-width:90px;accent-color:var(--dsw-alias-brand-primary);height:24px;cursor:pointer}
.tw-weight-row input[type=range]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:3px;border-radius:999px}
.tw-weight-row input[type=checkbox],.tw-row input[type=checkbox]{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}
.tw-weight-row .winput{width:66px;flex:0 0 auto;text-align:right}
.tw-weight-row .pct{width:44px;text-align:right;font-size:12.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.tw-scale-row{display:grid;grid-template-columns:84px 60px minmax(150px,1fr) 28px;gap:7px;align-items:center;margin-bottom:7px}

/* ---------- version lists ---------- */
.tw-version{display:flex;gap:8px;align-items:center;padding:7px 0;border-bottom:var(--tw-border);font-size:13px;flex-wrap:wrap}
.tw-version:last-child{border-bottom:0}
.tw-version .v{font-weight:650;min-width:32px;font-variant-numeric:tabular-nums}
.tw-version .note{flex:1;min-width:140px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ---------- skill grid ---------- */
.tw-skillgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:12px}
.tw-skillcard{
  appearance:none;text-align:left;border:var(--tw-border);background:var(--tw-surface);color:inherit;
  border-radius:var(--tw-radius);padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:7px;min-width:0;
  box-shadow:var(--tw-shadow-sm);transition:border-color .12s ease,box-shadow .12s ease,transform .12s ease;
}
.tw-skillcard:hover{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,var(--dsw-alias-border-l1));box-shadow:var(--tw-shadow-md);transform:translateY(-1px)}
.tw-skillcard:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tw-skillcard .top{display:flex;align-items:center;gap:8px;min-width:0}
.tw-skillcard .idx{
  flex:0 0 auto;width:24px;height:24px;border-radius:8px;display:grid;place-items:center;
  background:var(--tw-tint-brand);color:var(--dsw-alias-brand-primary);font-size:12px;font-weight:700;
}
.tw-skillcard .nm{font-size:14.5px;font-weight:650;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tw-skillcard .desc{
  font-size:13px;color:var(--dsw-alias-label-secondary);line-height:1.6;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
}
.tw-skillcard .foot{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;color:var(--dsw-alias-label-secondary);margin-top:auto}

/* ---------- code / details ---------- */
.tw-code{
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;
  background:var(--tw-surface-2);border:var(--tw-border);border-radius:9px;padding:10px;
  white-space:pre-wrap;word-break:break-word;max-height:280px;overflow:auto;
}
.tw-details{border:var(--tw-border);border-radius:9px;padding:8px 10px;background:var(--dsw-alias-bg-base);margin-top:8px}
.tw-details summary{cursor:pointer;font-size:13px;color:var(--dsw-alias-label-secondary);font-weight:600}
.tw-details summary:hover{color:var(--dsw-alias-label-primary)}
.tw-details[open] summary{margin-bottom:8px}

/* ---------- ledger ---------- */
.tw-ledger-row{display:grid;grid-template-columns:48px 80px minmax(0,1fr) 68px;gap:8px;align-items:center;padding:7px 0;border-bottom:var(--tw-border);font-size:12.5px}
.tw-ledger-row:last-child{border-bottom:0}
.tw-ledger-row .idx{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}
.tw-ledger-row .hash{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary)}

/* ---------- background import job ---------- */
.tw-importbar{
  margin-top:4px;border-radius:10px;padding:8px 11px;font-size:13.5px;
  border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 32%,transparent);
  background:var(--tw-tint-brand);display:flex;flex-direction:column;gap:6px;
}
.tw-importbar.ok{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 36%,transparent);background:var(--tw-tint-success)}
.tw-importbar.err{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 36%,transparent);background:var(--tw-tint-error)}
.tw-importbar-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.tw-importbar-text{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 160px}
.tw-importbar-track,.tw-progress-track{height:5px;border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-label-primary) 12%,transparent);overflow:hidden}
.tw-importbar-track > i,.tw-progress-track > i{display:block;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary);transition:width .35s ease}
.tw-importbar.ok .tw-importbar-track > i{background:var(--dsw-alias-state-success-primary)}
.tw-importbar.err .tw-importbar-track > i{background:var(--dsw-alias-state-error-primary)}
.tw-progressbox{border:var(--tw-border);border-radius:10px;padding:10px 12px;background:var(--tw-surface);margin-bottom:10px;display:flex;flex-direction:column;gap:7px}
.tw-progressbox.ok{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 32%,transparent)}
.tw-progressbox.err{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 36%,transparent)}
.tw-spin{
  width:12px;height:12px;border-radius:50%;flex:0 0 auto;
  border:2px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);
  border-top-color:var(--dsw-alias-brand-primary);
  animation:tw-spin .8s linear infinite;display:inline-block;
}
@keyframes tw-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){.tw-spin{animation-duration:2.4s}}

/* ---------- task picker ---------- */
.tw-picker{position:relative;display:inline-flex;flex:0 1 260px;min-width:0}
.tw-picker-trigger{
  appearance:none;display:inline-flex;align-items:center;gap:7px;min-width:0;max-width:100%;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);
  color:var(--dsw-alias-label-primary);border-radius:9px;padding:8px 11px;min-height:34px;
  font:inherit;font-size:13.5px;line-height:1.2;cursor:pointer;width:100%;
  transition:border-color .12s ease,background .12s ease;
}
.tw-picker-trigger:hover{background:var(--tw-surface)}
.tw-picker-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tw-picker-trigger.open{border-color:var(--dsw-alias-brand-primary);background:var(--tw-surface)}
.tw-picker-trigger .nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;font-weight:600}
.tw-picker-trigger .ct{
  flex:0 0 auto;font-size:10.5px;font-variant-numeric:tabular-nums;border-radius:999px;
  background:var(--tw-surface-2);color:var(--dsw-alias-label-secondary);padding:0 6px;
}
.tw-picker-trigger .chev{flex:0 0 auto;font-size:10px;color:var(--dsw-alias-label-secondary)}
.tw-picker-panel{
  position:absolute;top:calc(100% + 6px);left:0;z-index:70;width:min(420px,90vw);
  display:flex;flex-direction:column;max-height:min(60vh,460px);
  border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-overlay);
  box-shadow:0 18px 48px color-mix(in srgb,var(--dsw-alias-label-primary) 24%,transparent);
  overflow:hidden;
}
.tw-picker-search{display:flex;align-items:center;gap:7px;padding:9px 10px;border-bottom:var(--tw-border);color:var(--dsw-alias-label-secondary)}
.tw-picker-search .tw-input{min-height:30px;font-size:13px}
.tw-picker-list{flex:1 1 auto;min-height:0;overflow:auto;padding:5px}
.tw-picker-group{
  font-size:11px;font-weight:700;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);
  padding:7px 8px 4px;text-transform:none;
}
.tw-pick-row{
  appearance:none;display:flex;align-items:center;gap:8px;width:100%;min-width:0;text-align:left;
  border:1px solid transparent;background:transparent;color:inherit;border-radius:8px;
  padding:7px 9px;cursor:pointer;font:inherit;font-size:13px;line-height:1.35;
}
.tw-pick-row:hover,.tw-pick-row.cursor{background:var(--tw-surface-2)}
.tw-pick-row.active{background:var(--tw-tint-brand);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 42%,transparent)}
.tw-pick-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.tw-pick-row .nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.tw-pick-row .meta{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:10.5px;
  color:var(--dsw-alias-label-secondary);margin-top:2px;
}
.tw-picker-empty{padding:18px 10px;text-align:center;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.tw-picker-foot{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:8px 10px;border-top:var(--tw-border);background:var(--tw-surface);
}

/* ---------- task + batch chrome ---------- */
.tw-h3{margin:16px 0 8px;font-size:15px;font-weight:650}
.tw-h4{margin:12px 0 6px;font-size:13.5px;font-weight:650}
.tw-batchbar{
  display:flex;flex-wrap:wrap;gap:8px;align-items:center;
  border:var(--tw-border);border-radius:12px;background:var(--tw-surface);
  padding:9px 12px;box-shadow:var(--tw-shadow-sm);
}
.tw-batchchip{
  appearance:none;display:inline-flex;align-items:center;gap:7px;cursor:pointer;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);
  color:var(--dsw-alias-label-secondary);border-radius:999px;padding:5px 12px;
  font:inherit;font-size:12.5px;line-height:1.4;transition:background .12s ease,border-color .12s ease,color .12s ease;
}
.tw-batchchip:hover{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,var(--dsw-alias-border-l2));color:var(--dsw-alias-label-primary)}
.tw-batchchip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.tw-batchchip .nm{font-weight:600}
.tw-batchchip .ct{
  font-size:10.5px;font-variant-numeric:tabular-nums;border-radius:999px;
  background:var(--tw-surface-2);padding:0 6px;color:var(--dsw-alias-label-secondary);
}
.tw-batchchip .dt{font-size:10.5px;color:var(--dsw-alias-label-secondary);opacity:.85}
.tw-batchchip.active{
  background:var(--tw-tint-brand);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent);
  color:var(--dsw-alias-brand-primary);font-weight:600;
}
.tw-batchchip.active .ct{background:var(--tw-tint-brand-strong);color:var(--dsw-alias-brand-primary)}

/* ---------- import rows ---------- */
.tw-import-row{display:flex;align-items:flex-start;gap:8px;border:var(--tw-border);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-base)}
.tw-import-row.selected{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 50%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,var(--dsw-alias-bg-base))}
.tw-import-row.failed{border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 42%,transparent);background:var(--tw-tint-error)}

/* ---------- modal ---------- */
.tw-modal-backdrop{position:absolute;inset:0;z-index:40;background:color-mix(in srgb,var(--dsw-alias-label-primary) 28%,transparent);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)}
.tw-modal{
  width:min(94%,820px);max-height:100%;display:flex;flex-direction:column;
  border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-overlay);
  box-shadow:0 24px 64px color-mix(in srgb,var(--dsw-alias-label-primary) 26%,transparent);outline:none;
}
.tw-modal.wide{width:min(98%,1120px)}
.tw-modal.slim{width:min(92%,540px)}
.tw-modal-head{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:var(--tw-border)}
.tw-modal-head h3{margin:0;font-size:15.5px;font-weight:650;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tw-modal-body{flex:1 1 auto;min-height:0;overflow:auto;padding:16px}
.tw-modal-foot{flex:0 0 auto;display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:var(--tw-border);flex-wrap:wrap;background:var(--tw-surface)}

.tw-skeleton{height:14px;border-radius:6px;background:var(--tw-surface-2);animation:tw-pulse 1.2s ease-in-out infinite}
.tw-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
.tw-btn:focus-within{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
@keyframes tw-pulse{0%,100%{opacity:.55}50%{opacity:1}}

@container (max-width:1000px){
  .tw-grid.cols3,.tw-grid.cols4{grid-template-columns:repeat(2,minmax(0,1fr))}
  .tw-screening{flex-direction:column}
  .tw-col-list,.tw-col-main,.tw-col-side{flex:1 1 auto;width:100%;max-width:none;min-width:0}
  .tw-col-side{order:-1}
  .tw-cand-list{max-height:240px}
  .tw-split{flex-direction:column}
  .tw-split > .tw-listpane,.tw-split > .tw-editpane{flex:1 1 auto;width:100%;max-width:none;min-width:0}
  .tw-scorecard{position:static}
}
@container (max-width:640px){
  .tw-grid.cols2,.tw-grid.cols3,.tw-grid.cols4{grid-template-columns:minmax(0,1fr)}
  .tw-root{font-size:14px}
  .tw-headrow{flex-wrap:wrap}
  .tw-headactions{flex:1 1 100%;justify-content:flex-end;flex-wrap:wrap}
  .tw-header{padding:14px 14px 10px}
  .tw-tabs{padding:4px 14px 8px}
  .tw-content{padding:14px 14px 40px}
  .tw-tab{font-size:13.5px;padding:6px 9px}
  .tw-weight-row .name{flex-basis:100%}
  .tw-scale-row{grid-template-columns:64px 52px minmax(90px,1fr) 24px}
  .tw-notice.tw-toast{left:14px;right:14px}
  .tw-modal-backdrop{padding:8px}
}
`


    function tFactory(dicts, localeId) {
      return (key) => {
        const table = dicts[localeId] ?? dicts.zh
        return table[key] ?? dicts.zh[key] ?? key
      }
    }

    function apiFetch(path, options = {}) {
      return fetch(`${API}${path}`, { cache: 'no-store', ...options }).then(async (response) => {
        let body
        try { body = await response.json() } catch { body = null }
        if (!response.ok || body === null || body.ok === false) {
          throw new Error(body?.error ?? `HTTP ${response.status}`)
        }
        return body
      })
    }

    function downloadText(filename, text, type = 'application/json') {
      const blob = new Blob([text], { type: `${type};charset=utf-8` })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1200)
    }

    function readTextFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsText(file, 'utf-8')
      })
    }

    function decisionMeta(decision, t) {
      if (decision === 'recommend') return { label: t('common.recommend'), tone: 'success' }
      if (decision === 'backup') return { label: t('common.backup'), tone: 'warn' }
      return { label: t('common.hold'), tone: 'idle' }
    }

    function levelTone(value) {
      if (value === 'high' || value === 'yes') return 'success'
      if (value === 'upperMid') return 'brand'
      if (value === 'mid') return 'idle'
      if (value === 'lowerMid' || value === 'partial') return 'warn'
      return 'error'
    }

    function scoreForLevel(skill, levelValue) {
      const level = (skill?.scale ?? []).find(item => item.value === levelValue)
      return level?.score ?? 0
    }

    function levelLabel(skill, levelValue) {
      const level = (skill?.scale ?? []).find(item => item.value === levelValue)
      return level?.label ?? levelValue
    }

    function skillsById(skills) {
      const map = new Map()
      for (const record of skills ?? []) map.set(record.id, record.current)
      return map
    }

    function computeRows(candidates, skillMap, template) {
      const dimensions = (template?.dimensions ?? []).filter(item => item.weight > 0)
      const totalWeight = dimensions.reduce((sum, item) => sum + Number(item.weight || 0), 0)
      const rows = (candidates ?? []).map((candidate) => {
        let total = 0
        let hits = 0
        const gateFailures = []
        const derivation = []
        for (const dimension of dimensions) {
          const skill = skillMap.get(dimension.skillId)
          if (skill === undefined) continue
          const assessment = candidate.assessments?.[dimension.skillId]
          const level = assessment?.level ?? (skill.scale?.[skill.scale.length - 1]?.value ?? 'low')
          const score = scoreForLevel(skill, level)
          const normalized = totalWeight > 0 ? Number(dimension.weight) / totalWeight : 0
          const contribution = score * normalized * 100
          total += contribution
          if (score >= (template.hitMinScore ?? 0.6)) hits += 1
          const gateMinScore = scoreForLevel(skill, dimension.gateMin)
          const gateFailed = dimension.gate === true && score < gateMinScore
          if (gateFailed) gateFailures.push(skill.name)
          derivation.push({ skillId: dimension.skillId, name: skill.name, shortName: skill.shortName, weight: dimension.weight, normalized, level, levelLabel: levelLabel(skill, level), score, contribution, assessment, gateFailed })
        }
        total = Math.round(total * 10) / 10
        const decision = gateFailures.length > 0
          ? 'hold'
          : total >= (template.decision?.recommend ?? 70)
            ? 'recommend'
            : total >= (template.decision?.backup ?? 55)
              ? 'backup'
              : 'hold'
        return { candidate, candidateId: candidate.id, alias: candidate.alias, major: candidate.major, total, hits, decision, gateFailures, derivation }
      })
      rows.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        if (b.hits !== a.hits) return b.hits - a.hits
        const tie = (row, skillId) => row.derivation.find(item => item.skillId === skillId)?.score ?? 0
        for (const skillId of template?.tieBreak ?? []) {
          const diff = tie(b, skillId) - tie(a, skillId)
          if (diff !== 0) return diff
        }
        return String(a.alias).localeCompare(String(b.alias), 'zh')
      })
      rows.forEach((row, index) => { row.rank = index + 1 })
      const legacy = [...rows].sort((a, b) => (b.hits - a.hits) || (b.total - a.total) || String(a.alias).localeCompare(String(b.alias), 'zh'))
      const legacyRank = new Map(legacy.map((row, index) => [row.candidateId, index + 1]))
      for (const row of rows) {
        row.legacyHits = row.hits
        row.legacyRank = legacyRank.get(row.candidateId) ?? row.rank
        row.rankShift = row.legacyRank - row.rank
      }
      return rows
    }

    function majorMix(rows, decision) {
      const filtered = decision === undefined ? rows : rows.filter(row => row.decision === decision)
      const map = new Map()
      for (const row of filtered) map.set(row.major || '—', (map.get(row.major || '—') ?? 0) + 1)
      return [...map.entries()].map(([major, count]) => ({ major, count, share: filtered.length === 0 ? 0 : count / filtered.length })).sort((a, b) => b.count - a.count)
    }

    function computeBias(rows, template, skillMap) {
      const dimensions = (template?.dimensions ?? []).filter(item => item.weight > 0)
      const totalWeight = dimensions.reduce((sum, item) => sum + Number(item.weight || 0), 0) || 1
      const dominantOf = (row) => {
        let best = null
        for (const item of row.derivation) {
          if (best === null || item.contribution > best.contribution) best = item
        }
        return best?.skillId ?? ''
      }
      const items = []
      for (const dimension of dimensions) {
        const skill = skillMap.get(dimension.skillId)
        if (skill === undefined) continue
        const passers = rows.filter(row => (row.derivation.find(item => item.skillId === dimension.skillId)?.score ?? 0) >= (template.hitMinScore ?? 0.6))
        const mix = majorMix(passers)
        const top = mix[0] ?? { major: '—', share: 0, count: 0 }
        const avg = rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + (row.derivation.find(item => item.skillId === dimension.skillId)?.score ?? 0), 0) / rows.length
        const weight = Number(dimension.weight) / totalWeight
        const dominantRows = rows.filter(row => dominantOf(row) === dimension.skillId)
        const dominantMixList = majorMix(dominantRows)
        const dominantTop = dominantMixList[0] ?? { major: '—', share: 0, count: 0 }
        const flags = []
        if (top.share >= 0.6 && weight >= 0.1 && passers.length >= 2) flags.push(`入选者中「${top.major}」占 ${Math.round(top.share * 100)}%，权重 ${Math.round(weight * 100)}%。`)
        if (dominantTop.share >= 0.5 && dominantRows.length >= 3 && weight >= 0.08 && dominantTop.major !== '—') {
          flags.push(`该维度是 ${dominantRows.length} 位候选人的最大贡献项，「${dominantTop.major}」占 ${Math.round(dominantTop.share * 100)}%，容易系统性放大这一类背景。`)
        }
        if (dominantRows.length >= 3 && rows.length > 0 && dominantRows.length / rows.length >= 0.5) {
          flags.push(`该维度是 ${dominantRows.length}/${rows.length} 位候选人的最大贡献项，实际上主导了本次排序。`)
        }
        if (rows.length > 1) {
          const max = Math.max(...rows.map(row => row.derivation.find(item => item.skillId === dimension.skillId)?.score ?? 0))
          const min = Math.min(...rows.map(row => row.derivation.find(item => item.skillId === dimension.skillId)?.score ?? 0))
          if (max - min < 0.15) flags.push('区分度低，几乎不改变排序。')
        }
        items.push({ skillId: dimension.skillId, name: skill.name, weight, avg, topMajor: top.major, topShare: top.share, passCount: passers.length, dominantCount: dominantRows.length, dominantMajor: dominantTop.major, flags })
      }
      return items
    }

    function Icon({ name, size = 14 }) {
      // Icons scale with the text around them: the call sites keep saying
      // "12–14px", and the type scale decides what that means visually.
      const edge = Math.round(size * 1.15)
      const common = { width: edge, height: edge, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
      const paths = {
        logo: [h('path', { key: 'a', d: 'M8 1.5 13.6 4.7v6.6L8 14.5 2.4 11.3V4.7L8 1.5Z' }), h('circle', { key: 'b', cx: 8, cy: 6.2, r: 1.5 }), h('path', { key: 'c', d: 'M5.6 11.2c.3-1.4 1.3-2.2 2.4-2.2s2.1.8 2.4 2.2' })],
        search: [h('circle', { key: 'a', cx: 7, cy: 7, r: 4 }), h('path', { key: 'b', d: 'm10.2 10.2 3.3 3.3' })],
        plus: [h('path', { key: 'a', d: 'M8 3v10M3 8h10' })],
        refresh: [h('path', { key: 'a', d: 'M13.2 8a5.2 5.2 0 1 1-1.5-3.7' }), h('path', { key: 'b', d: 'M13.2 2.8v3.4h-3.4' })],
        download: [h('path', { key: 'a', d: 'M8 2.5v7.2M5 7.3 8 10.3l3-3M2.8 12.5h10.4' })],
        upload: [h('path', { key: 'a', d: 'M8 10.5V3.3M5 6.1 8 3.1l3 3M2.8 12.5h10.4' })],
        shield: [h('path', { key: 'a', d: 'M8 1.8 13 3.5v4.3c0 3-2 5-5 6.2-3-1.2-5-3.2-5-6.2V3.5L8 1.8Z' }), h('path', { key: 'b', d: 'm5.8 8 1.5 1.5 2.9-3' })],
        chain: [h('rect', { key: 'a', x: 2, y: 2.5, width: 5, height: 5, rx: 1 }), h('rect', { key: 'b', x: 9, y: 8.5, width: 5, height: 5, rx: 1 }), h('path', { key: 'c', d: 'M7 4.5h2.2a1.8 1.8 0 0 1 1.8 1.8v2.2M9 11.5H6.8A1.8 1.8 0 0 1 5 9.7V7.5' })],
        sliders: [h('path', { key: 'a', d: 'M2.5 4h11M2.5 8h11M2.5 12h11' }), h('circle', { key: 'b', cx: 6, cy: 4, r: 1.4, fill: 'var(--dsw-alias-bg-base)' }), h('circle', { key: 'c', cx: 10, cy: 8, r: 1.4, fill: 'var(--dsw-alias-bg-base)' }), h('circle', { key: 'd', cx: 5, cy: 12, r: 1.4, fill: 'var(--dsw-alias-bg-base)' })],
        check: [h('path', { key: 'a', d: 'm3 8.5 3 3 7-7' })],
        alert: [h('path', { key: 'a', d: 'M8 2 14 13H2L8 2Z' }), h('path', { key: 'b', d: 'M8 6v3.2M8 11.4v.2' })],
        x: [h('path', { key: 'a', d: 'm3.5 3.5 9 9M12.5 3.5l-9 9' })],
        edit: [h('path', { key: 'a', d: 'm10.8 2.8 2.4 2.4L5.6 12.8H3.2v-2.4l7.6-7.6Z' }), h('path', { key: 'b', d: 'm9.4 4.2 2.4 2.4' })],
        trash: [h('path', { key: 'a', d: 'M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.5 9h5l.5-9M7 7v4M9 7v4' })],
        copy: [h('rect', { key: 'a', x: 5, y: 5, width: 8, height: 8, rx: 1.2 }), h('path', { key: 'b', d: 'M3 11V4.2C3 3.5 3.5 3 4.2 3H11' })],
        chevron: [h('path', { key: 'a', d: 'm5 3.5 4.5 4.5L5 12.5' })],
        play: [h('path', { key: 'a', d: 'M5 3.2v9.6l7.2-4.8L5 3.2Z' })],
        flag: [h('path', { key: 'a', d: 'M4 14V2.5M4 3h8l-1.8 2.6L12 8.5H4' })],
        book: [h('path', { key: 'a', d: 'M2.8 3.2h4.3c.5 0 .9.4.9.9v8.7c0-.5-.4-.9-.9-.9H2.8V3.2ZM13.2 3.2H8.9c-.5 0-.9.4-.9.9v8.7c0-.5.4-.9.9-.9h4.3V3.2Z' })],
      }
      return h('svg', common, paths[name] ?? paths.logo)
    }

    function Badge({ tone = '', children }) {
      return h('span', { className: `tw-badge ${tone}` }, children)
    }

    function Button({ variant = '', size = '', onClick, disabled, title, children, type = 'button' }) {
      return h('button', {
        type,
        className: `tw-btn ${variant} ${size}`.trim(),
        onClick,
        disabled,
        title,
      }, children)
    }

    function Field({ label, hint, children }) {
      return h('label', { className: 'tw-field' },
        h('span', { className: 'tw-label' }, label),
        children,
        hint ? h('span', { className: 'tw-hint' }, hint) : null)
    }

    function Modal({ title, onClose, children, footer, width = '', dirty = false }) {
      const ref = useRef(null)
      const [confirming, setConfirming] = useState(false)
      const requestClose = () => {
        if (dirty === true) setConfirming(true)
        else onClose()
      }
      useEffect(() => {
        const previous = document.activeElement
        const focusables = () => {
          const root = ref.current
          if (root === null) return []
          return Array.from(root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
            .filter(element => element.disabled !== true && element.offsetParent !== null)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation()
            requestClose()
            return
          }
          if (event.key !== 'Tab') return
          const items = focusables()
          if (items.length === 0) return
          const first = items[0]
          const last = items[items.length - 1]
          if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        document.addEventListener('keydown', onKey, true)
        const timer = setTimeout(() => {
          try {
            const preferred = ref.current?.querySelector('[autofocus], [data-autofocus]')
            const items = focusables()
            if (preferred) preferred.focus()
            else if (items.length > 1) items[1].focus()
            else if (items.length > 0) items[0].focus()
            else ref.current?.focus()
          } catch { /* ignore */ }
        }, 0)
        return () => {
          document.removeEventListener('keydown', onKey, true)
          clearTimeout(timer)
          if (previous && typeof previous.focus === 'function') {
            try { previous.focus() } catch { /* ignore */ }
          }
        }
      }, [onClose, dirty, confirming])
      const effectiveFooter = confirming
        ? [
            h(Button, { key: 'keep', onClick: () => setConfirming(false) }, '继续编辑'),
            h(Button, { key: 'discard', variant: 'danger', onClick: onClose }, '放弃并关闭'),
          ]
        : footer
      return h('div', {
        className: 'tw-modal-backdrop',
        onMouseDown: (event) => { if (event.target === event.currentTarget) requestClose() },
      }, h('div', {
        className: `tw-modal ${width}`,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'tw-modal-title',
        tabIndex: -1,
        ref,
      },
      h('div', { className: 'tw-modal-head' },
        h('h3', { id: 'tw-modal-title' }, title),
        h('button', { type: 'button', className: 'tw-btn ghost sm', onClick: requestClose, 'aria-label': '关闭' }, h(Icon, { name: 'x' }))),
      confirming ? h('div', { className: 'tw-modal-body' }, h('div', { className: 'tw-warning' }, '有未保存的修改，确定放弃并关闭吗？')) : null,
      h('div', { className: 'tw-modal-body', style: confirming ? { display: 'none' } : undefined }, children),
      effectiveFooter ? h('div', { className: 'tw-modal-foot' }, effectiveFooter) : null))
    }

    function Empty({ title, body, action }) {
      return h('div', { className: 'tw-empty' },
        h('strong', null, title),
        body ? h('div', null, body) : null,
        action ? h('div', { style: { marginTop: 8 } }, action) : null)
    }

    function ScoreBar({ value, max = 100, tone = '' }) {
      const pct = Math.max(0, Math.min(100, max === 0 ? 0 : value / max * 100))
      return h('div', { className: `tw-bar ${tone}` }, h('i', { style: { width: `${pct}%` } }))
    }

    function Notice({ notice, onClose }) {
      if (!notice) return null
      const tone = notice.kind === 'error' ? 'err' : notice.kind === 'warn' ? 'warn' : 'ok'
      return h('div', {
        className: `tw-notice tw-toast ${tone}`,
        role: 'status',
        'aria-live': 'polite',
      },
      h(Icon, { name: notice.kind === 'ok' ? 'check' : 'alert' }),
      h('div', { style: { flex: 1, minWidth: 0 } }, notice.text),
      h('button', { type: 'button', className: 'tw-btn ghost sm', onClick: onClose, 'aria-label': '关闭提示' }, h(Icon, { name: 'x', size: 12 })))
    }

    function Workbench({ t }) {
      const [state, setState] = useState(null)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [tab, setTab] = useState('overview')
      const [notice, setNotice] = useState(null)
      const [busy, setBusy] = useState('')
      const [selectedCandidateId, setSelectedCandidateId] = useState('')
      const [query, setQuery] = useState('')
      const [candidateModal, setCandidateModal] = useState(null)
      const [skillModal, setSkillModal] = useState(null)
      const [deleteCandidateId, setDeleteCandidateId] = useState('')
      const [draft, setDraft] = useState(null)
      const [pendingGuard, setPendingGuard] = useState(null)
      const [copyTarget, setCopyTarget] = useState(null)
      const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState(null)
      const [importOpen, setImportOpen] = useState(false)
      const [taskModal, setTaskModal] = useState(false)
      // The scan job itself lives on the Host, so closing this dialog (or the
      // whole page) never stops it. Only its id and the review rows live here.
      const [importJob, setImportJob] = useState(null)
      const [importRows, setImportRows] = useState([])
      const [importSkips, setImportSkips] = useState([])

      const notify = (text, kind = 'ok') => {
        setNotice({ text, kind, at: Date.now() })
      }
      useEffect(() => {
        if (!notice) return undefined
        const timer = setTimeout(() => setNotice(null), 8000)
        return () => clearTimeout(timer)
      }, [notice])

      const load = async () => {
        setLoading(true)
        setError('')
        try {
          const body = await apiFetch('/state')
          setState(body)
          setTab(body.settings?.activeTab && ['overview', 'screening', 'batches', 'templates', 'skills', 'exchange', 'data'].includes(body.settings.activeTab) ? body.settings.activeTab : 'overview')
          if (body.candidates.length > 0) {
            setSelectedCandidateId((current) => current || body.results?.[0]?.candidateId || body.candidates[0].id)
          }
        } catch (err) {
          setError(String(err?.message ?? err))
        } finally {
          setLoading(false)
        }
      }
      useEffect(() => { load() }, [])

      const call = async (type, payload = {}) => {
        setBusy(type)
        try {
          const body = await apiFetch('/action', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, payload }),
          })
          const next = body.snapshot ?? (Array.isArray(body.results) && body.settings !== undefined ? body : null)
          if (next !== null) {
            setState(next)
            if (next.candidates.length > 0 && !next.candidates.some(item => item.id === selectedCandidateId)) {
              setSelectedCandidateId(next.results?.[0]?.candidateId ?? next.candidates[0].id)
            }
          }
          return body
        } catch (err) {
          notify(String(err?.message ?? err), 'error')
          throw err
        } finally {
          setBusy('')
        }
      }

      const jobFetch = async (type, payload) => {
        const body = await apiFetch('/action', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type, payload }),
        })
        return body
      }
      const startImport = async (payload) => {
        const body = await call('resumes.startScan', payload)
        if (payload?.skipped !== undefined) setImportSkips(payload.skipped)
        setImportRows([])
        setImportJob({ jobId: body.jobId, scanId: body.scanId, status: 'running', phase: 'listing', total: 0, extracted: 0, agentTotal: 0, agentDone: 0, items: [], skipped: [], startedAt: Date.now() })
        setImportOpen(true)
        return body
      }
      const resetImport = async () => {
        const job = importJob
        setImportJob(null)
        setImportRows([])
        setImportSkips([])
        if (job?.jobId !== undefined) { try { await jobFetch('resumes.discardJob', { jobId: job.jobId }) } catch { /* already gone */ } }
      }
      const openImport = () => setImportOpen(true)

      // Poll while a job runs. This effect belongs to the page, not the dialog,
      // so the progress keeps updating after the dialog is closed.
      useEffect(() => {
        const jobId = importJob?.jobId
        if (jobId === undefined || importJob?.status !== 'running') return undefined
        let stopped = false
        const tick = async () => {
          if (stopped) return
          try {
            const body = await jobFetch('resumes.job', { jobId })
            if (stopped) return
            if (body.ok !== true) {
              setImportJob(prev => prev === null ? prev : { ...prev, status: 'error', error: body.error ?? '任务不存在' })
              return
            }
            const job = body.job
            setImportJob(job)
            if (job.status === 'done') {
              setImportRows(buildImportRows(job))
              notify(`已解析 ${job.summary?.ready ?? 0}/${job.summary?.total ?? 0} 份简历，请核对后导入`)
            } else if (job.status === 'error') {
              notify(`解析失败：${job.error ?? '未知原因'}`, 'error')
            } else if (job.status === 'cancelled') {
              notify(t('import.jobCancelled'), 'warn')
            }
          } catch { /* a dropped poll is retried on the next tick */ }
        }
        tick()
        const timer = setInterval(tick, 900)
        return () => { stopped = true; clearInterval(timer) }
      }, [importJob?.jobId, importJob?.status])

      // Recover a job after a page reload: a running one resumes polling, a
      // finished one keeps its review list available.
      useEffect(() => {
        let stopped = false
        const recover = async () => {
          try {
            const body = await jobFetch('resumes.jobs', {})
            if (stopped || body.ok !== true) return
            const jobs = body.jobs ?? []
            const running = jobs.find(job => job.status === 'running')
            const finished = jobs.find(job => job.status === 'done' && (job.items ?? []).length > 0)
            const pick = running ?? finished
            if (pick === undefined) return
            setImportJob(pick)
            if (pick.status === 'done') setImportRows(buildImportRows(pick))
          } catch { /* no recovery is fine */ }
        }
        recover()
        return () => { stopped = true }
      }, [])

      const switchTab = (next) => {
        setTab(next)
        if (state) {
          apiFetch('/action', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type: 'settings.update', payload: { activeTab: next } }),
          }).catch(() => { /* tab persistence is best effort */ })
        }
      }

      if (loading) {
        return h('div', { className: 'tw-root' },
          h('style', null, CSS),
          h('div', { className: 'tw-header' },
            h('div', { className: 'tw-headrow' },
              h('div', { className: 'tw-logo' }, h(Icon, { name: 'logo', size: 18 })),
              h('div', { className: 'tw-headtext' }, h('h1', { className: 'tw-title' }, t('app.title')), h('div', { className: 'tw-sub' }, t('app.subtitle'))))),
          h('div', { className: 'tw-content' },
            h('div', { className: 'tw-empty' }, h('strong', null, t('app.loading')), h('div', { className: 'tw-skeleton', style: { width: '72%', margin: '10px auto 0' } }))))
      }

      if (error || state === null) {
        return h('div', { className: 'tw-root' },
          h('style', null, CSS),
          h('div', { className: 'tw-header' },
            h('div', { className: 'tw-headrow' },
              h('div', { className: 'tw-logo' }, h(Icon, { name: 'logo', size: 18 })),
              h('div', { className: 'tw-headtext' }, h('h1', { className: 'tw-title' }, t('app.title')))),
          ),
          h('div', { className: 'tw-content' },
            h('div', { className: 'tw-empty' },
              h('strong', null, t('app.loadError')),
              h('div', { className: 'tw-mono', style: { marginTop: 6 } }, error || 'no data'),
              h('div', { style: { marginTop: 10 } }, h(Button, { variant: 'primary', onClick: load }, t('app.retry'))))))
      }

      const activeTemplate = state.templates.find(item => item.id === state.activeTemplateId)?.current
        ?? state.templates[0]?.current
      const skillMap = skillsById(state.skills)
      // Sample candidates live only in this bundle. They are shown while the
      // real pool is empty and vanish as soon as one real resume exists.
      const demoMode = state.candidates.length === 0
      const displayCandidates = demoMode ? DEMO_CANDIDATES.map(toDisplayCandidate) : state.candidates
      const savedDraftTemplate = draft ? state.templates.find(item => item.id === draft.templateId)?.current ?? null : null
      const isDirty = draft !== null && (draft.isNew === true || JSON.stringify(draft.definition) !== JSON.stringify(savedDraftTemplate))
      const isDraft = isDirty
      // A clean draft is just an editor buffer: the active template still drives screening.
      const effectiveTemplate = draft !== null && isDirty ? draft.definition : activeTemplate
      const rows = computeRows(displayCandidates, skillMap, effectiveTemplate)
      const selectedCandidate = displayCandidates.find(item => item.id === selectedCandidateId) ?? null
      const selectedResult = rows.find(item => item.candidateId === selectedCandidateId) ?? null
      const tabs = [
        { id: 'overview', label: t('tab.overview'), count: null },
        { id: 'screening', label: t('tab.screening'), count: displayCandidates.length },
        { id: 'batches', label: t('tab.batches'), count: (state.batches ?? []).length },
        { id: 'templates', label: t('tab.templates'), count: state.templates.length },
        { id: 'skills', label: t('tab.skills'), count: state.skills.length },
        { id: 'exchange', label: t('tab.exchange'), count: state.exchange.chainLength },
        { id: 'data', label: t('tab.data'), count: null },
      ]
      const guard = (action) => {
        if (isDirty) setPendingGuard({ action })
        else {
          setDraft(null)
          action()
        }
      }
      const discardDraft = () => {
        setDraft(null)
        notify('已放弃未保存草稿')
      }
      const saveDraft = async () => {
        if (draft === null) return
        const payload = { ...draft.definition, note: draft.note || undefined }
        const body = draft.isNew
          ? await call('template.create', payload)
          : await call('template.update', { templateId: draft.templateId, ...payload })
        const savedId = body?.templateId ?? draft.templateId
        const saved = body?.snapshot?.templates?.find(item => item.id === savedId)
        if (saved !== undefined) setDraft({ templateId: savedId, isNew: false, definition: saved.current, note: '' })
        else setDraft(null)
        notify(draft.isNew ? `已创建模板「${draft.definition.name}」并设为当前模板` : `已保存模板新版本 v${body?.version ?? ''}`)
      }
      const openSkill = (skillId) => setSkillModal(state.skills.find(item => item.id === skillId) ?? null)
      const copySkill = (skill) => setCopyTarget({ skill, name: `${skill.current?.name ?? skill.id}（自定义）` })
      const handleSaveCandidate = async (payload, candidateId, reassess) => {
        if (candidateId) {
          await call('candidate.update', { candidateId, ...payload, reassess: reassess === true })
          notify(reassess ? '已保存并重新自动评估' : '候选人资料已保存')
        } else {
          const result = await call('candidate.create', payload)
          if (result.candidateId) setSelectedCandidateId(result.candidateId)
          notify('已新增候选人并完成规则初筛')
        }
        setCandidateModal(null)
      }
      const handleLevelChange = async (candidateId, skillId, level, assessment) => {
        await call('assessment.set', {
          candidateId,
          skillId,
          level,
          evidence: assessment?.evidence ?? [],
          confidence: 'medium',
          rationale: '在筛选工作台中人工校正',
        })
        notify('已保存人工校正，排序即时更新')
      }

      return h('div', { className: 'tw-root' },
        h('style', null, CSS),
        h('div', { className: 'tw-header' },
          h('div', { className: 'tw-headrow' },
            h('div', { className: 'tw-logo' }, h(Icon, { name: 'logo', size: 18 })),
            h('div', { className: 'tw-headtext' },
              h('h1', { className: 'tw-title' }, t('app.title')),
              h('div', { className: 'tw-sub' }, t('app.subtitle'))),
            h('div', { className: 'tw-headactions' },
              h(Button, { variant: 'ghost', size: 'sm', onClick: load, title: t('app.refresh'), 'aria-label': t('app.refresh') }, h(Icon, { name: 'refresh', size: 14 })),
              h(Button, { variant: 'soft', onClick: () => setTaskModal(true) }, h(Icon, { name: 'plus', size: 13 }), t('task.create')),
              h(Button, { variant: 'soft', onClick: () => setImportOpen(true) }, h(Icon, { name: 'upload', size: 13 }), t('screening.import')),
              h(Button, { variant: 'primary', onClick: () => setCandidateModal({ mode: 'create' }) }, h(Icon, { name: 'plus', size: 13 }), t('screening.addCandidate')))),
          h('div', { className: 'tw-badges' },
            h(Badge, { tone: 'brand' }, h(Icon, { name: 'shield', size: 11 }), t('app.local')),
            h(Badge, { tone: 'success' }, t('app.noNetwork')),
            demoMode ? h(Badge, { tone: 'warn' }, t('demo.badge')) : null,
            isDirty ? h(Badge, { tone: 'warn' }, t('template.draft')) : null,
            activeTemplate ? h(Badge, { tone: '' }, `${activeTemplate.name} · v${activeTemplate.version}`) : null),
          h(ImportBanner, {
            t,
            job: importJob,
            onOpen: openImport,
            onCancel: resetImport,
          }),
          h('div', { className: 'tw-toolbar' },
            h(TaskPicker, {
              t,
              tasks: state.tasks ?? [],
              activeTaskId: state.activeTaskId ?? '',
              onSelect: (taskId) => { call('context.select', { taskId }).catch(() => {}) },
              onNewTask: () => setTaskModal(true),
            }),
            h('span', { className: 'tw-label' }, t('screening.template')),
            h('select', {
              className: 'tw-select',
              style: { flex: '1 1 220px', maxWidth: 380 },
              'aria-label': t('screening.template'),
              value: state.activeTemplateId,
              onChange: (event) => {
                const nextId = event.target.value
                const apply = () => {
                  const request = state.activeTaskId
                    ? call('task.update', { taskId: state.activeTaskId, templateId: nextId })
                    : call('settings.update', { activeTemplateId: nextId })
                  request.catch(() => {})
                }
                guard(apply)
              },
            }, state.templates.map(item => h('option', { key: item.id, value: item.id }, `${item.current?.name ?? item.id} · v${item.currentVersion}`))),
            h('div', { className: 'tw-spacer' }),
            state.candidates.length > 0
              ? h('span', { className: 'tw-small tw-muted' }, `${t('overview.stats.candidates')} ${state.candidates.length} · ${t('overview.stats.recommended')} ${state.stats.recommended}`)
              : h('span', { className: 'tw-small tw-muted' }, t('demo.short')))),
        h('div', { className: 'tw-tabs', role: 'tablist' },
          tabs.map(item => h('button', {
            key: item.id,
            type: 'button',
            role: 'tab',
            'aria-selected': tab === item.id,
            className: `tw-tab ${tab === item.id ? 'active' : ''}`,
            onClick: () => switchTab(item.id),
          }, item.label, item.count === null ? null : h('span', { className: 'count' }, item.count)))),
        h(Notice, { notice, onClose: () => setNotice(null) }),
        h('div', { className: 'tw-content' },
          (state.tasks ?? []).length === 0
            ? h(TaskGate, { t, state, call, notify })
            : h('div', { className: 'tw-grid', style: { gap: 12 } },
          demoMode ? h('div', { className: 'tw-draftbar' },
            h(Icon, { name: 'book', size: 13 }),
            h('div', { style: { flex: 1, minWidth: 0 } }, t('demo.banner')),
            h(Button, { size: 'sm', onClick: () => setImportOpen(true) }, h(Icon, { name: 'upload', size: 12 }), t('screening.import')),
            h(Button, { size: 'sm', variant: 'primary', onClick: () => setCandidateModal({ mode: 'create' }) }, t('screening.addCandidate'))) : null,
          tab === 'batches' ? h(TasksPanel, { state, t, call, notify, busy, onNewTask: () => setTaskModal(true) }) : null,
          tab === 'overview' ? h(Overview, { state, t, activeTemplate, demoMode, onGo: switchTab, onEditTemplate: () => switchTab('templates') }) : null,
          tab === 'screening' ? h(Screening, {
            state, t, template: effectiveTemplate, isDraft, rows, skillMap, query, setQuery, demoMode,
            selectedCandidate, selectedResult, selectedCandidateId, setSelectedCandidateId,
            onAddCandidate: () => setCandidateModal({ mode: 'create' }),
            onImportResumes: () => setImportOpen(true),
            onSelectBatch: (batchId) => { call('context.select', { batchId }).catch(() => {}) },
            onManageBatches: () => switchTab('batches'),
            onEditCandidate: (candidate) => { if (demoMode) return; setCandidateModal({ mode: 'edit', candidate }) },
            onDeleteCandidate: (candidateId) => { if (demoMode) return; setDeleteCandidateId(candidateId) },
            onLevelChange: async (candidateId, skillId, level, assessment) => {
              if (demoMode) { notify(t('demo.readOnly'), 'warn'); return }
              await handleLevelChange(candidateId, skillId, level, assessment)
            },
            onOpenSkill: openSkill,
            onNewRun: async () => {
              if (demoMode) { notify(t('demo.noRun'), 'warn'); return }
              if (isDraft) { notify('请先保存或放弃草稿，再生成筛选快照', 'error'); return }
              const body = await call('run.create', { templateId: state.activeTemplateId })
              notify(`已生成筛选快照（${body.run?.templateName ?? ''} v${body.run?.templateVersion ?? ''}）`)
            },
            onExportReport: () => {
              if (demoMode) { notify(t('demo.noRun'), 'warn'); return }
              if (isDraft) { notify('报告按已保存的当前模板生成；请先保存草稿', 'error'); return }
              const name = state.reportTemplate?.name ?? 'template'
              downloadText(`talent-report-${name}-v${state.reportTemplate?.version ?? ''}-${Date.now()}.md`, state.reportMarkdown, 'text/markdown')
              notify('报告已导出为 Markdown（本地生成）')
            },
            onAutoAssess: async (candidateId) => {
              if (demoMode) { notify(t('demo.readOnly'), 'warn'); return }
              await call('candidate.autoAssess', { candidateId })
              notify('已重新运行规则初筛（人工复核项保留）')
            },
            onSaveDraft: saveDraft,
            onDiscardDraft: discardDraft,
            busy,
          }) : null,
          tab === 'templates' ? h(Templates, {
            state, t, skillMap, rows, draft, setDraft, isDirty, demoMode,
            onSaveDraft: saveDraft,
            onDiscardDraft: discardDraft,
            onGuard: guard,
            onRequestDelete: (templateId, name) => setPendingDeleteTemplate({ templateId, name }),
            call, notify, busy,
          }) : null,
          tab === 'skills' ? h(Skills, {
            state, t,
            onOpenSkill: (skill) => setSkillModal(skill),
            onCopySkill: copySkill,
            busy,
          }) : null,
          tab === 'exchange' ? h(Exchange, { state, t, call, notify, busy }) : null,
          tab === 'data' ? h(Data, { state, t, call, notify, busy, load }) : null),
        candidateModal ? h(CandidateModal, {
          t,
          mode: candidateModal.mode,
          candidate: candidateModal.candidate,
          onClose: () => setCandidateModal(null),
          onSave: handleSaveCandidate,
          busy,
          realNameHidden: state.settings.showRealNames !== true && candidateModal.mode === 'edit',
        }) : null,
        skillModal ? h(SkillModal, {
          t,
          skill: skillModal,
          onClose: () => setSkillModal(null),
          onSave: async (skillId, patch, note) => {
            await call('skill.saveVersion', { skillId, ...patch, note })
            setSkillModal(null)
            notify('已发布维度技能新版本，并更新 DSH 技能目录')
          },
          onRestore: async (skillId, version) => {
            await call('skill.restore', { skillId, version })
            setSkillModal(null)
            notify('已回溯维度技能版本（会生成新版本）')
          },
          onCopy: (skill) => { setSkillModal(null); copySkill(skill) },
          busy,
        }) : null,
        pendingGuard ? h(Modal, {
          title: t('template.unsavedTitle'),
          onClose: () => setPendingGuard(null),
          width: 'slim',
          footer: [
            h(Button, { key: 'cancel', onClick: () => setPendingGuard(null) }, t('common.cancel')),
            h(Button, { key: 'discard', variant: 'danger', onClick: () => {
              const action = pendingGuard.action
              setPendingGuard(null)
              setDraft(null)
              action()
            } }, t('template.discardContinue')),
          ],
        }, h('div', { className: 'tw-small' }, t('template.unsavedBody'))) : null,
        pendingDeleteTemplate ? h(Modal, {
          title: t('template.delete'),
          onClose: () => setPendingDeleteTemplate(null),
          width: 'slim',
          footer: [
            h(Button, { key: 'cancel', onClick: () => setPendingDeleteTemplate(null) }, t('common.cancel')),
            h(Button, { key: 'delete', variant: 'danger', disabled: busy !== '', onClick: async () => {
              try {
                await call('template.delete', { templateId: pendingDeleteTemplate.templateId })
                setPendingDeleteTemplate(null)
                setDraft(null)
                notify('模板已删除')
              } catch { /* noticed by call */ }
            } }, t('common.delete')),
          ],
        }, h('div', { className: 'tw-small' }, `${t('common.confirmDelete')}「${pendingDeleteTemplate.name}」`)) : null,
        copyTarget ? h(Modal, {
          title: t('skill.copy'),
          onClose: () => setCopyTarget(null),
          width: 'slim',
          footer: [
            h(Button, { key: 'cancel', onClick: () => setCopyTarget(null) }, t('common.cancel')),
            h(Button, { key: 'ok', variant: 'primary', disabled: busy !== '' || String(copyTarget.name).trim() === '', onClick: async () => {
              try {
                await call('skill.copy', { skillId: copyTarget.skill.id, name: copyTarget.name })
                setCopyTarget(null)
                notify('已复制为新维度，可在模板中使用')
                switchTab('skills')
              } catch { /* noticed by call */ }
            } }, t('common.save')),
          ],
        }, h(Field, { label: t('skill.copyPrompt') },
          h('input', {
            className: 'tw-input',
            value: copyTarget.name,
            autoFocus: true,
            onChange: (event) => setCopyTarget({ ...copyTarget, name: event.target.value }),
          }))) : null,
        deleteCandidateId ? h(Modal, {
          title: t('screening.deleteCandidate'),
          onClose: () => setDeleteCandidateId(''),
          width: 'slim',
          footer: [
            h(Button, { key: 'cancel', onClick: () => setDeleteCandidateId('') }, t('common.cancel')),
            h(Button, { key: 'delete', variant: 'danger', disabled: busy !== '', onClick: async () => {
              try {
                await call('candidate.delete', { candidateId: deleteCandidateId })
                setDeleteCandidateId('')
                notify('候选人已删除（本地）')
              } catch { /* noticed by call */ }
            } }, t('common.delete')),
          ],
        }, h('div', { className: 'tw-small' }, t('candidate.confirmDelete'))) : null,
        taskModal ? h(TaskModal, {
          t,
          state,
          call,
          notify,
          onClose: () => setTaskModal(false),
        }) : null,
        importOpen ? h(ImportModal, {
          t,
          call,
          notify,
          onClose: () => setImportOpen(false),
          onImported: (created) => {
            if (Array.isArray(created) && created.length > 0) setSelectedCandidateId(created[0].candidateId)
            switchTab('screening')
          },
          job: importJob,
          rows: importRows,
          setRows: setImportRows,
          clientSkips: importSkips,
          setClientSkips: setImportSkips,
          startImport,
          resetImport,
        }) : null))
    }


    /**
     * Task picker: search, recent-first list and keyboard navigation.
     *
     * A <select> stops working once a recruiter runs more than a handful of
     * tasks, so the header uses a popover with a filter box instead.
     */
    function TaskPicker({ t, tasks, activeTaskId, onSelect, onNewTask }) {
      const [open, setOpen] = useState(false)
      const [query, setQuery] = useState('')
      const [cursor, setCursor] = useState(0)
      const wrapRef = useRef(null)
      const inputRef = useRef(null)

      const active = tasks.find(item => item.id === activeTaskId) ?? null
      const needle = query.trim().toLowerCase()
      const matches = (item) => {
        if (needle === '') return true
        return [item.name, item.description, item.templateName]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(needle))
      }
      const live = tasks.filter(item => item.status !== 'archived' && matches(item))
      const archived = tasks.filter(item => item.status === 'archived' && matches(item))
      const flat = [...live, ...archived]

      // Close on outside click / Escape so the popover never traps the page.
      useEffect(() => {
        if (!open) return undefined
        const onPointer = (event) => {
          const node = wrapRef.current
          if (node !== null && node.contains(event.target)) return
          setOpen(false)
        }
        const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('mousedown', onPointer)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      useEffect(() => {
        if (!open) return
        setQuery('')
        setCursor(0)
        const input = inputRef.current
        if (input !== null && typeof input.focus === 'function') input.focus()
      }, [open])

      const choose = (id) => {
        setOpen(false)
        if (id !== activeTaskId) onSelect(id)
      }
      const onKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setCursor(prev => Math.min(prev + 1, Math.max(0, flat.length - 1)))
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setCursor(prev => Math.max(prev - 1, 0))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          const picked = flat[cursor]
          if (picked !== undefined) choose(picked.id)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setOpen(false)
        }
      }

      const row = (item) => {
        const index = flat.indexOf(item)
        const isActive = item.id === activeTaskId
        return h('button', {
          key: item.id,
          type: 'button',
          role: 'option',
          'aria-selected': isActive,
          className: `tw-pick-row ${isActive ? 'active' : ''} ${index === cursor ? 'cursor' : ''}`,
          onMouseEnter: () => setCursor(index),
          onClick: () => choose(item.id),
        },
        h('span', { className: 'nm' }, item.name),
        h('span', { className: 'meta' },
          h('span', null, `${item.templateName ?? '—'} v${item.templateVersion ?? '—'}`),
          h('span', null, `${item.batchCount ?? 0} ${t('task.batchUnit')}`),
          h('span', null, `${item.candidateCount ?? 0} ${t('batch.people')}`),
          (item.feedbackPending ?? 0) > 0 ? h('span', { className: 'tw-chip warn' }, `${item.feedbackPending} ${t('feedback.pending')}`) : null),
        isActive ? h(Icon, { name: 'check', size: 12 }) : null)
      }

      return h('div', { className: 'tw-picker', ref: wrapRef },
        h('button', {
          type: 'button',
          className: `tw-picker-trigger ${open ? 'open' : ''}`,
          'aria-haspopup': 'listbox',
          'aria-expanded': open,
          'aria-label': t('task.label'),
          title: t('task.label'),
          onClick: () => setOpen(prev => !prev),
        },
        h(Icon, { name: 'sliders', size: 12 }),
        h('span', { className: 'nm' }, active?.name ?? t('task.none')),
        active !== null ? h('span', { className: 'ct' }, `${active.candidateCount ?? 0}`) : null,
        h('span', { className: 'chev', 'aria-hidden': true }, open ? '▴' : '▾')),
        open ? h('div', { className: 'tw-picker-panel', role: 'listbox', 'aria-label': t('task.label') },
          h('div', { className: 'tw-picker-search' },
            h(Icon, { name: 'search', size: 12 }),
            h('input', {
              ref: inputRef,
              className: 'tw-input',
              value: query,
              placeholder: t('task.searchPlaceholder'),
              'aria-label': t('task.searchPlaceholder'),
              onChange: (event) => { setQuery(event.target.value); setCursor(0) },
              onKeyDown,
            })),
          h('div', { className: 'tw-picker-list' },
            live.length > 0 ? h('div', { className: 'tw-picker-group' }, t('task.groupActive')) : null,
            live.map(row),
            archived.length > 0 ? h('div', { className: 'tw-picker-group' }, t('task.groupArchived')) : null,
            archived.map(row),
            flat.length === 0
              ? h('div', { className: 'tw-picker-empty' }, tasks.length === 0 ? t('task.none') : t('task.noMatch'))
              : null),
          h('div', { className: 'tw-picker-foot' },
            h('span', { className: 'tw-small tw-muted' }, `${tasks.length} ${t('task.total')}`),
            h(Button, { size: 'sm', variant: 'soft', onClick: () => { setOpen(false); onNewTask() } },
              h(Icon, { name: 'plus', size: 12 }), t('task.create')))) : null)
    }

    /** The fields shared by the first-run gate and the "new task" dialog. */
    function TaskForm({ t, state, call, notify, onDone }) {
      const [name, setName] = useState('')
      const [description, setDescription] = useState('')
      const [templateId, setTemplateId] = useState(state.activeTemplateId ?? state.templates[0]?.id ?? '')
      const [busy, setBusy] = useState(false)
      const create = async () => {
        if (name.trim() === '') { notify(t('task.nameRequired'), 'error'); return }
        setBusy(true)
        try {
          await call('task.create', { name: name.trim(), description: description.trim(), templateId })
          notify(t('task.created'))
          setName('')
          setDescription('')
          if (typeof onDone === 'function') onDone()
        } catch { /* call() reported it */ } finally { setBusy(false) }
      }
      return h('div', { className: 'tw-grid', style: { gap: 10 } },
        h(Field, { label: t('task.name') },
          h('input', {
            className: 'tw-input',
            value: name,
            autoFocus: true,
            placeholder: t('task.namePlaceholder'),
            onChange: event => setName(event.target.value),
            onKeyDown: event => { if (event.key === 'Enter') create() },
          })),
        h(Field, { label: t('task.description') },
          h('textarea', {
            className: 'tw-textarea',
            rows: 2,
            value: description,
            placeholder: t('task.descriptionPlaceholder'),
            onChange: event => setDescription(event.target.value),
          })),
        h(Field, { label: t('task.initialTemplate') },
          h('select', { className: 'tw-select', value: templateId, onChange: event => setTemplateId(event.target.value) },
            state.templates.map(item => h('option', { key: item.id, value: item.id }, `${item.current?.name ?? item.id} · v${item.currentVersion}`)))),
        h('div', { className: 'tw-hint' }, t('task.initialTemplateHint')),
        h('div', { className: 'tw-row', style: { justifyContent: 'flex-end' } },
          h(Button, { variant: 'primary', disabled: busy, onClick: create }, h(Icon, { name: 'plus', size: 13 }), t('task.create'))))
    }

    /** First-run screen: nothing works until a recruiting task exists. */
    function TaskGate({ t, state, call, notify }) {
      return h('div', { className: 'tw-grid', style: { gap: 14, maxWidth: 820, margin: '32px auto 0' } },
        h('div', { className: 'tw-hero' },
          h('h2', null, t('task.gateTitle')),
          h('p', null, t('task.gateBody')),
          h('div', { className: 'tw-steps' },
            h('div', { className: 'tw-step' }, h('div', { className: 'tw-t' }, h('span', { className: 'n' }, '1'), t('task.gateStep1')), h('div', { className: 'tw-b' }, t('task.gateStep1Body'))),
            h('div', { className: 'tw-step' }, h('div', { className: 'tw-t' }, h('span', { className: 'n' }, '2'), t('task.gateStep2')), h('div', { className: 'tw-b' }, t('task.gateStep2Body'))),
            h('div', { className: 'tw-step' }, h('div', { className: 'tw-t' }, h('span', { className: 'n' }, '3'), t('task.gateStep3')), h('div', { className: 'tw-b' }, t('task.gateStep3Body'))))),
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-card-head' },
            h('div', { className: 'tw-card-title' }, t('task.create')),
            h(Badge, { tone: 'warn' }, t('task.onlyEntry'))),
          h(TaskForm, { t, state, call, notify })))
    }

    /** "New task" dialog, reachable from the header and the batches page. */
    function TaskModal({ t, state, call, notify, onClose }) {
      return h(Modal, {
        title: t('task.create'),
        onClose,
        width: 'slim',
        footer: [h(Button, { key: 'close', onClick: onClose }, t('common.close'))],
      },
      h('div', { className: 'tw-hint', style: { marginBottom: 10 } }, t('task.onlyEntry')),
      h(TaskForm, { t, state, call, notify, onDone: onClose }))
    }

    /** Task switcher, batch board and the feedback -> template loop. */
    function TasksPanel({ state, t, call, notify, busy, onNewTask }) {
      const task = state.activeTask
      const batches = state.batches ?? []
      const all = state.allCandidates ?? []
      const feedback = state.feedback ?? []
      const taskCandidates = task === null ? [] : all.filter(candidate => candidate.taskId === task.id)
      const [showForeign, setShowForeign] = useState(false)
      const foreignCandidates = task === null ? [] : all.filter(candidate => candidate.taskId !== task.id)
      const assignable = showForeign ? [...taskCandidates, ...foreignCandidates] : taskCandidates
      const taskNameById = new Map((state.tasks ?? []).map(item => [item.id, item.name]))
      const [name, setName] = useState(task?.name ?? '')
      const [description, setDescription] = useState(task?.description ?? '')
      const [batchName, setBatchName] = useState('')
      const [from, setFrom] = useState('')
      const [to, setTo] = useState('')
      const [batchNote, setBatchNote] = useState('')
      const [assignTarget, setAssignTarget] = useState(state.activeBatchId ?? '')
      const [checked, setChecked] = useState([])
      const [scope, setScope] = useState('candidate')
      const [kind, setKind] = useState('adjust')
      const [targetId, setTargetId] = useState('')
      const [message, setMessage] = useState('')
      const [preview, setPreview] = useState(null)
      const [suggestion, setSuggestion] = useState(null)

      if (task === null) return h(Empty, { title: t('task.none'), body: t('task.gateBody') })

      const pending = feedback.filter(item => item.appliedAt === '')
      const batchNameById = new Map(batches.map(batch => [batch.id, batch.name]))
      const targetOptions = scope === 'candidate'
        ? taskCandidates.map(candidate => ({ id: candidate.id, label: `${candidate.alias} · ${batchNameById.get(candidate.batchId) ?? t('batch.unassigned')}` }))
        : scope === 'batch'
          ? batches.map(batch => ({ id: batch.id, label: `${batch.name} · ${batch.candidateCount} ${t('batch.people')}` }))
          : []

      const doSave = async () => {
        try { await call('task.update', { taskId: task.id, name, description }); notify(t('task.saved')) } catch { /* shown by call() */ }
      }
      const doArchive = async () => {
        try { await call('task.update', { taskId: task.id, status: task.status === 'archived' ? 'active' : 'archived' }); notify(t('task.archived')) } catch { /* shown */ }
      }
      const doCreateBatch = async () => {
        try {
          await call('batch.create', { taskId: task.id, name: batchName.trim(), interviewFrom: from, interviewTo: to, note: batchNote.trim() })
          setBatchName(''); setFrom(''); setTo(''); setBatchNote('')
          notify(t('batch.created'))
        } catch { /* shown */ }
      }
      const doSuggest = async () => {
        try {
          const body = await call('batch.suggest', { gapDays: 2 })
          setSuggestion(body)
          notify((body.groups ?? []).length === 0 ? t('batch.suggestNone') : t('batch.suggested').replace('{n}', String(body.groups.length)))
        } catch { /* shown */ }
      }
      const doCreateFromSuggestion = async (group) => {
        try {
          await call('batch.create', {
            taskId: task.id,
            name: `${group.from}${group.to === group.from ? '' : `~${group.to}`}`,
            interviewFrom: group.from,
            interviewTo: group.to,
            candidateIds: group.candidateIds,
          })
          notify(t('batch.created'))
        } catch { /* shown */ }
      }
      const doAssign = async () => {
        if (assignTarget === '' || checked.length === 0) { notify(t('batch.noneSelected'), 'error'); return }
        try {
          const body = await call('batch.assign', { batchId: assignTarget, candidateIds: checked })
          setChecked([])
          notify(t('batch.assigned').replace('{n}', String(body.moved ?? 0)))
        } catch { /* shown */ }
      }
      const doAddFeedback = async () => {
        try {
          const chosen = taskCandidates.find(candidate => candidate.id === targetId)
          await call('feedback.add', {
            taskId: task.id,
            scope,
            kind,
            candidateId: scope === 'candidate' ? targetId : '',
            batchId: scope === 'candidate' ? (chosen?.batchId ?? '') : scope === 'batch' ? targetId : '',
            message,
          })
          setMessage('')
          notify(t('feedback.added'))
        } catch { /* shown */ }
      }
      const doReview = async (apply) => {
        try {
          const body = await call('feedback.review', { taskId: task.id, apply })
          if (body.ok !== true) { notify(String(body.error ?? t('feedback.noChange')), 'warn'); return }
          if (apply) { setPreview(null); notify(t('feedback.applied').replace('{v}', String(body.version))) } else setPreview(body)
        } catch { /* shown */ }
      }

      const taskRows = (state.tasks ?? []).map(item => h('div', {
        key: item.id,
        className: `tw-listitem ${item.id === state.activeTaskId ? 'active' : ''}`,
        role: 'button',
        tabIndex: 0,
        onClick: () => { call('context.select', { taskId: item.id }).catch(error => notify(String(error?.message ?? error), 'error')) },
        onKeyDown: event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            call('context.select', { taskId: item.id }).catch(error => notify(String(error?.message ?? error), 'error'))
          }
        },
      },
      h('div', { className: 'tw-row wrap' },
        h('span', { className: 'name' }, item.name),
        h(Badge, { tone: item.status === 'archived' ? 'idle' : 'success' },
          item.status === 'archived' ? t('task.archivedState') : t('task.activeState')),
        h('span', { className: 'tw-small tw-muted' }, `${item.templateName} v${item.templateVersion ?? '—'}`),
        h('span', { className: 'tw-small tw-muted' }, `${item.batchCount} ${t('task.batchUnit')}`),
        h('span', { className: 'tw-small tw-muted' }, `${item.candidateCount} ${t('batch.people')}`),
        item.feedbackPending > 0 ? h('span', { className: 'tw-chip warn' }, `${item.feedbackPending} ${t('feedback.pending')}`) : null,
        h('span', { className: 'tw-spacer' }),
        item.id === state.activeTaskId ? h(Badge, { tone: 'brand' }, t('task.current')) : null)))

      const taskListCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-head' },
          h('div', null,
            h('div', { className: 'tw-card-title' }, t('task.listTitle')),
            h('div', { className: 'tw-card-sub' }, t('task.listSubtitle'))),
          h(Button, { size: 'sm', variant: 'primary', onClick: onNewTask },
            h(Icon, { name: 'plus', size: 12 }), t('task.create'))),
        (state.tasks ?? []).length === 0
          ? h('div', { className: 'tw-empty' }, h('strong', null, t('task.none')), t('task.gateBody'))
          : h('div', { className: 'tw-grid', style: { gap: 6 } }, taskRows))

      const taskCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-head' },
          h('div', null,
            h('div', { className: 'tw-card-title' }, t('task.current')),
            h('div', { className: 'tw-card-sub' }, `${task.name} · ${new Date(task.createdAt).toLocaleDateString()}`)),
          h('div', { className: 'tw-row' },
            h(Badge, { tone: task.status === 'archived' ? 'idle' : 'success' }, task.status === 'archived' ? t('task.archivedState') : t('task.activeState')),
            h(Button, { size: 'sm', variant: 'ghost', disabled: busy !== '', onClick: doArchive },
              task.status === 'archived' ? t('task.unarchive') : t('task.archive')))),
        h('div', { className: 'tw-grid cols2', style: { gap: 10 } },
          h(Field, { label: t('task.name') }, h('input', { className: 'tw-input', value: name, onChange: event => setName(event.target.value) })),
          h(Field, { label: t('task.initialTemplate') },
            h('select', {
              className: 'tw-select',
              value: task.templateId,
              onChange: async event => {
                try { await call('task.update', { taskId: task.id, templateId: event.target.value }); notify(t('task.templateSwitched')) } catch { /* shown */ }
              },
            }, state.templates.map(item => h('option', { key: item.id, value: item.id }, `${item.current?.name ?? item.id} · v${item.currentVersion}`)))),
          h(Field, { label: t('task.description') },
            h('input', { className: 'tw-input', value: description, onChange: event => setDescription(event.target.value) }))),
        h('div', { className: 'tw-row', style: { marginTop: 10, justifyContent: 'flex-end' } },
          h(Button, { size: 'sm', variant: 'primary', disabled: busy !== '', onClick: doSave }, t('common.save'))))

      const batchRows = batches.map(batch => h('div', {
        key: batch.id,
        className: `tw-listitem ${batch.id === state.activeBatchId ? 'active' : ''}`,
        role: 'button',
        tabIndex: 0,
        onClick: () => { call('context.select', { batchId: batch.id }).catch(() => {}) },
        onKeyDown: event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); call('context.select', { batchId: batch.id }).catch(() => {}) }
        },
      },
      h('div', { className: 'tw-row wrap' },
        h('span', { className: 'name' }, batch.name),
        h('span', { className: 'tw-small tw-muted' }, `${batch.candidateCount} ${t('batch.people')}`),
        batch.interviewFrom
          ? h('span', { className: 'tw-small tw-muted' }, `${t('batch.interview')} ${batch.interviewFrom}${batch.interviewTo && batch.interviewTo !== batch.interviewFrom ? ` ~ ${batch.interviewTo}` : ''}`)
          : h('span', { className: 'tw-chip' }, t('batch.noDate')),
        h('span', { className: 'tw-spacer' }),
        batch.id === state.activeBatchId ? h(Badge, { tone: 'brand' }, t('batch.current')) : null,
        h(Button, {
          size: 'sm',
          variant: 'ghost',
          onClick: event => {
            event.stopPropagation()
            call('batch.delete', { batchId: batch.id })
              .then(() => notify(t('batch.deleted')))
              .catch(error => notify(String(error?.message ?? error), 'error'))
          },
        }, h(Icon, { name: 'trash', size: 12 }))),
      batch.note ? h('div', { className: 'tw-small tw-muted' }, batch.note) : null))

      const suggestBlock = suggestion === null || (suggestion.groups ?? []).length === 0 ? null : h('div', { className: 'tw-details', style: { marginTop: 10 } },
        h('summary', null, t('batch.suggestResult').replace('{n}', String(suggestion.groups.length))),
        h('div', { className: 'tw-grid', style: { gap: 6, marginTop: 8 } }, suggestion.groups.map(group => h('div', { key: group.index, className: 'tw-row wrap' },
          h('span', { className: 'tw-small' }, `${group.from}${group.to === group.from ? '' : ` ~ ${group.to}`}`),
          h('span', { className: 'tw-small tw-muted' }, `${group.candidateIds.length} ${t('batch.people')}：${(group.aliases ?? []).slice(0, 6).join('、')}`),
          h('span', { className: 'tw-spacer' }),
          h(Button, { size: 'sm', onClick: () => doCreateFromSuggestion(group) }, t('batch.createFrom'))))))

      const assignBlock = h('div', null,
        h('div', { className: 'tw-divider' }),
        h('div', { className: 'tw-h4' }, t('batch.assignTitle')),
        h('div', { className: 'tw-row wrap' },
          h('select', { className: 'tw-select', style: { maxWidth: 260 }, value: assignTarget, onChange: event => setAssignTarget(event.target.value) },
            h('option', { value: '' }, t('batch.pickBatch')),
            batches.map(batch => h('option', { key: batch.id, value: batch.id }, batch.name))),
          h('span', { className: 'tw-small tw-muted' }, t('batch.assignHint'))),
        h('label', { className: 'tw-row tw-small', style: { marginTop: 6 } },
          h('input', { type: 'checkbox', checked: showForeign, onChange: event => { setShowForeign(event.target.checked); setChecked([]) } }),
          h('span', null, t('batch.includeOther')),
          h('span', { className: 'tw-small tw-muted' }, `${foreignCandidates.length} ${t('batch.people')}`)),
        h('div', { className: 'tw-grid cols3', style: { gap: 4, marginTop: 8 } },
          assignable.map(candidate => h('label', { key: candidate.id, className: 'tw-row tw-small' },
            h('input', {
              type: 'checkbox',
              checked: checked.includes(candidate.id),
              onChange: event => setChecked(prev => event.target.checked ? [...prev, candidate.id] : prev.filter(id => id !== candidate.id)),
            }),
            h('span', null, candidate.alias),
            h('span', { className: 'tw-small tw-muted' },
              `${taskNameById.get(candidate.taskId) ?? t('batch.unassigned')} · ${batchNameById.get(candidate.batchId) ?? ''}`)))),
        h('div', { className: 'tw-row', style: { marginTop: 8 } },
          h('span', { className: 'tw-small tw-muted' }, `${checked.length} ${t('batch.selected')}`),
          h('span', { className: 'tw-spacer' }),
          h(Button, { size: 'sm', variant: 'primary', disabled: busy !== '' || checked.length === 0, onClick: doAssign }, t('batch.assign'))))

      const batchCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-head' },
          h('div', null,
            h('div', { className: 'tw-card-title' }, t('batch.title')),
            h('div', { className: 'tw-card-sub' }, t('batch.subtitle'))),
          h(Button, { size: 'sm', variant: 'ghost', disabled: busy !== '', onClick: doSuggest },
            h(Icon, { name: 'sliders', size: 12 }), t('batch.suggest'))),
        batches.length === 0
          ? h('div', { className: 'tw-empty' }, h('strong', null, t('batch.none')), t('batch.noneBody'))
          : h('div', { className: 'tw-grid', style: { gap: 6 } }, batchRows),
        h('div', { className: 'tw-grid cols3', style: { gap: 8, marginTop: 12 } },
          h(Field, { label: t('batch.name') },
            h('input', { className: 'tw-input', value: batchName, placeholder: t('batch.namePlaceholder'), onChange: event => setBatchName(event.target.value) })),
          h(Field, { label: t('batch.from') }, h('input', { className: 'tw-input', type: 'date', value: from, onChange: event => setFrom(event.target.value) })),
          h(Field, { label: t('batch.to') }, h('input', { className: 'tw-input', type: 'date', value: to, onChange: event => setTo(event.target.value) }))),
        h('div', { className: 'tw-row wrap', style: { marginTop: 8 } },
          h('input', { className: 'tw-input', style: { flex: '1 1 260px' }, value: batchNote, placeholder: t('batch.note'), onChange: event => setBatchNote(event.target.value) }),
          h(Button, { size: 'sm', variant: 'soft', disabled: busy !== '', onClick: doCreateBatch },
            h(Icon, { name: 'plus', size: 12 }), t('batch.create'))),
        suggestBlock,
        assignBlock)

      const kindLabel = { positive: t('feedback.kindPositive'), negative: t('feedback.kindNegative'), adjust: t('feedback.kindAdjust'), note: t('feedback.kindNote') }
      const feedbackRows = feedback.map(item => h('div', { key: item.id, className: 'tw-import-row' },
        h('div', { style: { minWidth: 64 } }, h(Badge, { tone: item.kind === 'negative' ? 'error' : item.kind === 'positive' ? 'success' : 'idle' }, kindLabel[item.kind] ?? item.kind)),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { className: 'tw-small' },
            `${item.scope === 'candidate' ? (item.candidateAlias || item.candidateId) : item.scope === 'batch' ? (item.batchName || item.batchId) : t('feedback.scopeTask')} · ${new Date(item.createdAt).toLocaleString()}`),
          h('div', { className: 'tw-small tw-muted' }, item.message)),
        item.appliedAt ? h(Badge, { tone: 'success' }, `${t('feedback.appliedTo')} v${item.appliedTemplateVersion}`) : h(Badge, { tone: 'warn' }, t('feedback.pending')),
        h(Button, {
          size: 'sm',
          variant: 'ghost',
          onClick: () => { call('feedback.delete', { feedbackId: item.id }).catch(error => notify(String(error?.message ?? error), 'error')) },
        }, h(Icon, { name: 'x', size: 12 }))))

      const feedbackCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-head' },
          h('div', null,
            h('div', { className: 'tw-card-title' }, t('feedback.title')),
            h('div', { className: 'tw-card-sub' }, t('feedback.subtitle'))),
          h('div', { className: 'tw-row' },
            h(Badge, { tone: pending.length > 0 ? 'warn' : 'idle' }, `${pending.length} ${t('feedback.pending')}`),
            h(Button, { size: 'sm', variant: 'primary', disabled: busy !== '' || pending.length === 0, onClick: () => doReview(false) },
              h(Icon, { name: 'refresh', size: 12 }), t('feedback.askAgent')))),
        h('div', { className: 'tw-grid cols2', style: { gap: 8 } },
          h(Field, { label: t('feedback.scope') },
            h('select', { className: 'tw-select', value: scope, onChange: event => { setScope(event.target.value); setTargetId('') } },
              h('option', { value: 'candidate' }, t('feedback.scopeCandidate')),
              h('option', { value: 'batch' }, t('feedback.scopeBatch')),
              h('option', { value: 'task' }, t('feedback.scopeTask')))),
          scope === 'task' ? null : h(Field, { label: t('feedback.target') },
            h('select', { className: 'tw-select', value: targetId, onChange: event => setTargetId(event.target.value) },
              h('option', { value: '' }, t('feedback.pickTarget')),
              targetOptions.map(option => h('option', { key: option.id, value: option.id }, option.label)))),
          h(Field, { label: t('feedback.kind') },
            h('select', { className: 'tw-select', value: kind, onChange: event => setKind(event.target.value) },
              h('option', { value: 'positive' }, t('feedback.kindPositive')),
              h('option', { value: 'negative' }, t('feedback.kindNegative')),
              h('option', { value: 'adjust' }, t('feedback.kindAdjust')),
              h('option', { value: 'note' }, t('feedback.kindNote'))))),
        h('div', { className: 'tw-row wrap', style: { marginTop: 8 } },
          h('input', {
            className: 'tw-input',
            style: { flex: '1 1 320px' },
            value: message,
            placeholder: t('feedback.message'),
            onChange: event => setMessage(event.target.value),
            onKeyDown: event => { if (event.key === 'Enter') doAddFeedback() },
          }),
          h(Button, { size: 'sm', variant: 'soft', disabled: busy !== '', onClick: doAddFeedback }, t('feedback.add'))),
        feedback.length === 0
          ? h('div', { className: 'tw-small tw-muted', style: { marginTop: 10 } }, t('feedback.none'))
          : h('div', { className: 'tw-grid', style: { gap: 6, marginTop: 12 } }, feedbackRows))

      const previewRows = (preview?.changes ?? []).map(change => h('tr', { key: `${change.skillId}-${change.kind}` },
        h('td', null, change.name),
        h('td', { className: 'tw-small tw-muted' }, change.from === null ? t('feedback.newDimension') : String(change.from)),
        h('td', null, change.to === null ? t('feedback.removed') : h(Badge, { tone: 'brand' }, String(change.to)))))

      const previewModal = preview === null ? null : h(Modal, {
        title: t('feedback.agentTitle'),
        onClose: () => setPreview(null),
        width: 'wide',
        footer: [
          h(Button, { key: 'cancel', onClick: () => setPreview(null) }, t('common.cancel')),
          h(Button, { key: 'apply', variant: 'primary', disabled: busy !== '', onClick: () => doReview(true) }, t('feedback.apply')),
        ],
      },
      h('div', { className: 'tw-small tw-muted', style: { marginBottom: 8 } }, preview.summary),
      previewRows.length === 0
        ? h('div', { className: 'tw-small tw-muted' }, t('feedback.noChange'))
        : h('div', { className: 'tw-table-wrap' }, h('table', { className: 'tw-table' },
          h('thead', null, h('tr', null,
            h('th', null, t('feedback.colDimension')),
            h('th', null, t('feedback.colFrom')),
            h('th', null, t('feedback.colTo')))),
          h('tbody', null, previewRows))),
      preview.rationale ? h('div', { className: 'tw-info', style: { marginTop: 10 } }, preview.rationale) : null,
      h('div', { className: 'tw-small tw-muted', style: { marginTop: 8 } }, t('feedback.applyHint')))

      return h('div', { className: 'tw-grid', style: { gap: 14 } }, taskListCard, taskCard, batchCard, feedbackCard, previewModal)
    }

    function Overview({ state, t, activeTemplate, demoMode, onGo, onEditTemplate }) {
      const stats = state.stats
      const warnings = state.diagnostics?.warnings ?? []
      const weights = (activeTemplate?.dimensions ?? []).map(dimension => ({
        ...dimension,
        name: skillMapName(state, dimension.skillId),
      }))
      const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0) || 1
      const templateCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-head' },
          h('div', null,
            h('div', { className: 'tw-card-title' }, t('overview.activeTemplate')),
            h('div', { className: 'tw-card-sub' }, `${activeTemplate?.name ?? '—'} · v${activeTemplate?.version ?? '—'} · ${activeTemplate?.dimensions?.length ?? 0} 维`)),
          h('div', { className: 'tw-row' },
            h(Button, { size: 'sm', onClick: () => onGo('screening') }, t('overview.openScreening')),
            h(Button, { size: 'sm', variant: 'soft', onClick: onEditTemplate }, t('overview.editTemplate')))),
        h('div', { className: 'tw-grid', style: { gap: 8 } },
          weights.map(item => h('div', { key: item.skillId, className: 'tw-row' },
            h('div', { style: { flex: '0 0 104px', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item.name),
            h('div', { style: { flex: 1 } }, h(ScoreBar, { value: item.weight, max: totalWeight, tone: '' })),
            h('div', { className: 'tw-small tw-muted', style: { width: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }, `${Math.round(item.weight / totalWeight * 100)}%`)))))
      const warningsCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-head' },
          h('div', { className: 'tw-card-title' }, t('overview.warnings')),
          h(Badge, { tone: warnings.length > 0 ? 'warn' : 'success' }, warnings.length > 0 ? `${warnings.length} 条` : 'OK')),
        warnings.length === 0
          ? h('div', { className: 'tw-small tw-muted' }, t('overview.noWarnings'))
          : h('div', { className: 'tw-grid', style: { gap: 6 } }, warnings.slice(0, 5).map((warning, index) => h('div', { key: index, className: 'tw-warning' }, warning))))
      const runsCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-head' }, h('div', { className: 'tw-card-title' }, t('overview.recentRuns'))),
        state.runs.length === 0
          ? h('div', { className: 'tw-small tw-muted' }, t('common.none'))
          : h('div', { className: 'tw-grid', style: { gap: 6 } },
            state.runs.slice(-5).reverse().map(run => h('div', { key: run.id, className: 'tw-row' },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { style: { fontSize: 13.5, fontWeight: 600 } }, run.templateName),
                h('div', { className: 'tw-small tw-muted' }, `${new Date(run.generatedAt).toLocaleString()} · 推荐 ${run.summary.recommended} / 备选 ${run.summary.backup} / 暂缓 ${run.summary.hold}`)),
              h(Badge, { tone: 'brand' }, `v${run.templateVersion}`)))))
      const privacyCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-head' },
          h('div', { className: 'tw-card-title' }, t('overview.privacyTitle')),
          h(Badge, { tone: 'success' }, h(Icon, { name: 'shield', size: 11 }), t('app.private'))),
        h('div', { className: 'tw-small tw-muted', style: { lineHeight: 1.7 } }, t('overview.privacyBody')))
      return h('div', { className: 'tw-grid', style: { gap: 14 } },
        h('div', { className: 'tw-hero' },
          h('h2', null, t('overview.title')),
          h('p', null, t('overview.body')),
          h('div', { className: 'tw-steps' },
            h('div', { className: 'tw-step' }, h('div', { className: 'tw-t' }, h('span', { className: 'n' }, '1'), t('overview.step1')), h('div', { className: 'tw-b' }, t('overview.step1body'))),
            h('div', { className: 'tw-step' }, h('div', { className: 'tw-t' }, h('span', { className: 'n' }, '2'), t('overview.step2')), h('div', { className: 'tw-b' }, t('overview.step2body'))),
            h('div', { className: 'tw-step' }, h('div', { className: 'tw-t' }, h('span', { className: 'n' }, '3'), t('overview.step3')), h('div', { className: 'tw-b' }, t('overview.step3body'))))),
        demoMode ? h('div', { className: 'tw-info' }, t('demo.overview')) : null,
        h('div', { className: 'tw-stats' },
          h('div', { className: 'tw-stat' }, h('div', { className: 'v' }, stats.candidates), h('div', { className: 'k' }, t('overview.stats.candidates'))),
          h('div', { className: 'tw-stat' }, h('div', { className: 'v' }, stats.templates), h('div', { className: 'k' }, t('overview.stats.templates'))),
          h('div', { className: 'tw-stat' }, h('div', { className: 'v' }, stats.skills), h('div', { className: 'k' }, t('overview.stats.skills'))),
          h('div', { className: 'tw-stat' }, h('div', { className: 'v' }, stats.recommended), h('div', { className: 'k' }, t('overview.stats.recommended'))),
          h('div', { className: 'tw-stat' }, h('div', { className: 'v' }, stats.ledgerLength), h('div', { className: 'k' }, t('overview.stats.ledger'))),
          h('div', { className: 'tw-stat' }, h('div', { className: 'v' }, stats.avgScore), h('div', { className: 'k' }, t('overview.stats.avg')))),
        h('div', { className: 'tw-grid cols2' }, templateCard, warningsCard),
        h('div', { className: 'tw-grid cols2' }, runsCard, privacyCard))
    }

    function skillMapName(state, skillId) {
      return state.skills.find(item => item.id === skillId)?.current?.name ?? skillId
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result ?? '')
          const comma = result.indexOf(',')
          resolve(comma >= 0 ? result.slice(comma + 1) : result)
        }
        reader.onerror = () => reject(new Error(`读取失败：${file.name}`))
        reader.readAsDataURL(file)
      })
    }

    /**
     * Display-only sample candidates. They are never written to the database:
     * the panel shows them while the real pool is empty and drops them as soon
     * as a real resume is imported. Levels are the engine's rule-based first
     * pass at build time; dev/industry-smoke.mjs checks they stay in sync.
     */
    const DEMO_CANDIDATES = [
      {"id":"cand-a","alias":"候选人 A","major":"材料科学与工程","degree":"博士","school":"示例大学 A","stage":"博士四年级","direction":"稀土永磁材料的第一性原理与机器学习筛选","skills":["Python","VASP","XGBoost","高通量计算"],"publications":[{"role":"first","status":"published","tier":"sci1","venue":"示例期刊·计算材料（一区）"},{"role":"first","status":"published","tier":"sci1","venue":"示例期刊·磁性与材料（一区）"},{"role":"cofirst","status":"accepted","tier":"top","venue":"示例顶刊·材料（共同一作）"},{"role":"first","status":"review","tier":"sci1","venue":"示例期刊·稀土材料（在投）"}],"projects":[{"name":"无重稀土永磁成分高通量筛选（虚构）","role":"lead","level":"national","validation":"lab"}],"engineering":[],"theory":[{"kind":"first-principles","desc":"EMTO-CPA 高通量计算与 XGBoost 联合筛选（虚构）"},{"kind":"ml","desc":"小样本材料性能预测与不确定性评估（虚构）"}],"roles":[],"awards":["示例学会优秀报告（虚构）"],"assessments":{"tech-stack-match":"high","cross-discipline":"no","academic-level":"high","engineering-gap":"no","theory-depth":"yes","long-term-potential":"high","research-depth":"high","research-focus":"high","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"lowerMid","product-sense":"low","domain-knowledge":"lowerMid","collaboration":"low","outcome-delivery":"low","learning-agility":"lowerMid","field-implementation":"no","compliance-risk":"low"}},
      {"id":"cand-b","alias":"候选人 B","major":"控制科学与工程","degree":"硕士","school":"示例大学 B","stage":"硕士三年级","direction":"流程工业过程建模与强化学习优化","skills":["Python","强化学习","过程建模","DCS"],"publications":[{"role":"first","status":"published","tier":"sci1","venue":"示例期刊·过程工程（一区）"},{"role":"first","status":"accepted","tier":"sci2","venue":"示例期刊·控制工程（二区）"},{"role":"first","status":"review","tier":"sci1","venue":"示例期刊·智能制造（在投）"}],"projects":[{"name":"浓密—脱水过程协同调度（虚构）","role":"core","level":"national","validation":"industrial"},{"name":"流程优化平台（虚构）","role":"lead","level":"enterprise","validation":"pilot"}],"engineering":[{"kind":"deployment","desc":"优化算法接入现场 DCS，连续运行 6 个月（虚构）"},{"kind":"control","desc":"数据驱动回路整定与抗扰测试（虚构）"}],"theory":[{"kind":"numerical","desc":"过程机理与数据混合建模（虚构）"}],"roles":[],"awards":["示例竞赛一等奖（虚构）"],"assessments":{"tech-stack-match":"high","cross-discipline":"yes","academic-level":"upperMid","engineering-gap":"yes","theory-depth":"yes","long-term-potential":"upperMid","research-depth":"high","research-focus":"high","engineering-quality":"lowerMid","system-design":"lowerMid","data-experiment":"low","modeling-tuning":"mid","product-sense":"low","domain-knowledge":"lowerMid","collaboration":"lowerMid","outcome-delivery":"lowerMid","learning-agility":"lowerMid","field-implementation":"partial","compliance-risk":"low"}},
      {"id":"cand-c","alias":"候选人 C","major":"机械工程","degree":"硕士","school":"示例大学 C","stage":"硕士三年级","direction":"设备状态监测与产线数据采集","skills":["MATLAB","Python","PLC","信号处理"],"publications":[],"projects":[{"name":"压缩机状态监测与健康预测（虚构）","role":"lead","level":"enterprise","validation":"industrial"}],"engineering":[{"kind":"deployment","desc":"多源数据采集链路与健康预测平台上线（虚构）"},{"kind":"integration","desc":"传感器布置、PLC 接入与现场调试（虚构）"},{"kind":"field","desc":"三地工厂现场交付与培训（虚构）"}],"theory":[],"roles":[{"title":"班级生活委员","kind":"student","start":"2023","end":"至今","current":true}],"awards":["示例专利两项（虚构）"],"assessments":{"tech-stack-match":"lowerMid","cross-discipline":"yes","academic-level":"low","engineering-gap":"yes","theory-depth":"no","long-term-potential":"mid","research-depth":"high","research-focus":"high","engineering-quality":"low","system-design":"low","data-experiment":"lowerMid","modeling-tuning":"low","product-sense":"low","domain-knowledge":"lowerMid","collaboration":"lowerMid","outcome-delivery":"lowerMid","learning-agility":"lowerMid","field-implementation":"partial","compliance-risk":"low"}},
      {"id":"cand-d","alias":"候选人 D","major":"计算机科学与技术","degree":"硕士","school":"示例大学 D","stage":"硕士三年级","direction":"LLM 应用、RAG 与多智能体工程","skills":["Python","LangGraph","RAG","评测","Docker"],"publications":[{"role":"first","status":"published","tier":"ccfB","venue":"示例会议·信息检索（CCF-B）"},{"role":"first","status":"review","tier":"ccfA","venue":"示例会议·人工智能（在投）"}],"projects":[{"name":"企业知识库 RAG 与工单智能体（虚构）","role":"lead","level":"enterprise","validation":"industrial"}],"engineering":[{"kind":"software","desc":"多智能体编排、检索评测与容器化部署（虚构）"},{"kind":"deployment","desc":"月均万次调用，召回率 88%（虚构）"}],"theory":[],"roles":[],"awards":["示例黑客松金奖（虚构）"],"assessments":{"tech-stack-match":"mid","cross-discipline":"yes","academic-level":"mid","engineering-gap":"yes","theory-depth":"no","long-term-potential":"upperMid","research-depth":"high","research-focus":"high","engineering-quality":"lowerMid","system-design":"lowerMid","data-experiment":"low","modeling-tuning":"mid","product-sense":"low","domain-knowledge":"low","collaboration":"low","outcome-delivery":"lowerMid","learning-agility":"lowerMid","field-implementation":"partial","compliance-risk":"low"}},
      {"id":"cand-e","alias":"候选人 E","major":"数学","degree":"博士","school":"示例大学 E","stage":"博士三年级","direction":"偏微分方程数值算法与科学机器学习","skills":["Python","PyTorch","数值分析","PDE"],"publications":[{"role":"first","status":"published","tier":"sci1","venue":"示例期刊·数值分析（一区）"},{"role":"first","status":"review","tier":"sci1","venue":"示例期刊·科学计算（在投）"}],"projects":[{"name":"高精度守恒算子与代理模型（虚构）","role":"core","level":"national","validation":"lab"}],"engineering":[],"theory":[{"kind":"numerical","desc":"PDE 数值格式设计与误差分析（虚构）"},{"kind":"ml","desc":"物理约束神经网络（虚构）"}],"roles":[],"awards":["示例数学建模竞赛特等奖（虚构）"],"assessments":{"tech-stack-match":"mid","cross-discipline":"yes","academic-level":"mid","engineering-gap":"no","theory-depth":"yes","long-term-potential":"upperMid","research-depth":"high","research-focus":"high","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"lowerMid","product-sense":"low","domain-knowledge":"low","collaboration":"low","outcome-delivery":"low","learning-agility":"mid","field-implementation":"no","compliance-risk":"low"}},
      {"id":"cand-f","alias":"候选人 F","major":"化学","degree":"博士","school":"示例大学 F","stage":"博士四年级","direction":"界面化学与溶剂萃取分离","skills":["分子动力学","界面表征","Python"],"publications":[{"role":"first","status":"published","tier":"top","venue":"示例顶刊·综合（一区 TOP）"},{"role":"first","status":"published","tier":"sci1","venue":"示例期刊·胶体与界面（一区）"}],"projects":[{"name":"液—液界面调控与萃取机理（虚构）","role":"lead","level":"national","validation":"lab"}],"engineering":[],"theory":[{"kind":"md","desc":"界面分子动力学与表征联合分析（虚构）"}],"roles":[],"awards":["示例青年论坛最佳报告（虚构）"],"assessments":{"tech-stack-match":"upperMid","cross-discipline":"no","academic-level":"high","engineering-gap":"no","theory-depth":"yes","long-term-potential":"high","research-depth":"high","research-focus":"high","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"lowerMid","product-sense":"low","domain-knowledge":"low","collaboration":"low","outcome-delivery":"low","learning-agility":"low","field-implementation":"no","compliance-risk":"low"}},
      {"id":"cand-g","alias":"候选人 G","major":"材料工程","degree":"硕士","school":"示例大学 G","stage":"硕士三年级","direction":"电池材料与机器学习辅助改性","skills":["Python","电化学测试"],"publications":[{"role":"first","status":"review","tier":"sci2","venue":"示例期刊·储能（在投）"}],"projects":[{"name":"正极材料掺杂改性（虚构）","role":"participant","level":"provincial","validation":"lab"}],"engineering":[],"theory":[],"roles":[{"title":"党支部书记","kind":"party","start":"2024","end":"至今","current":true},{"title":"院研究生会部长","kind":"student","start":"2023","end":"2024","current":false}],"awards":["示例优秀学生干部（虚构）"],"assessments":{"tech-stack-match":"upperMid","cross-discipline":"no","academic-level":"low","engineering-gap":"no","theory-depth":"no","long-term-potential":"lowerMid","research-depth":"mid","research-focus":"low","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"low","product-sense":"low","domain-knowledge":"lowerMid","collaboration":"low","outcome-delivery":"low","learning-agility":"low","field-implementation":"no","compliance-risk":"low"}},
      {"id":"cand-h","alias":"候选人 H","major":"机械工程","degree":"硕士","school":"示例大学 H","stage":"硕士三年级","direction":"固液两相流 CFD 与设备流场优化","skills":["Fluent","Python","CFD"],"publications":[{"role":"first","status":"published","tier":"sci2","venue":"示例期刊·流体工程（二区）"}],"projects":[{"name":"萃取混合澄清器流场优化（虚构）","role":"core","level":"enterprise","validation":"pilot"}],"engineering":[{"kind":"software","desc":"Fluent 自动化仿真与参数扫描脚本（虚构）"}],"theory":[{"kind":"numerical","desc":"两相流模型与网格无关性分析（虚构）"}],"roles":[],"awards":[],"assessments":{"tech-stack-match":"upperMid","cross-discipline":"yes","academic-level":"lowerMid","engineering-gap":"partial","theory-depth":"yes","long-term-potential":"lowerMid","research-depth":"upperMid","research-focus":"high","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"low","product-sense":"low","domain-knowledge":"low","collaboration":"low","outcome-delivery":"low","learning-agility":"low","field-implementation":"no","compliance-risk":"low"}},
      {"id":"cand-i","alias":"候选人 I","major":"机械工程","degree":"硕士","school":"示例大学 I","stage":"硕士三年级","direction":"产线自动化改造与设备集成","skills":["PLC","SolidWorks","Python"],"publications":[],"projects":[{"name":"稀土冶炼产线自动化改造（虚构）","role":"lead","level":"enterprise","validation":"industrial"}],"engineering":[{"kind":"integration","desc":"PLC、机器人与上位机系统集成（虚构）"},{"kind":"field","desc":"两条产线现场调试与验收（虚构）"},{"kind":"deployment","desc":"产线数据采集与看板上线（虚构）"}],"theory":[],"roles":[{"title":"院研会体育部部长","kind":"student","start":"2023","end":"2024","current":false}],"awards":["示例机械创新大赛二等奖（虚构）"],"assessments":{"tech-stack-match":"mid","cross-discipline":"yes","academic-level":"low","engineering-gap":"yes","theory-depth":"no","long-term-potential":"mid","research-depth":"high","research-focus":"mid","engineering-quality":"low","system-design":"low","data-experiment":"lowerMid","modeling-tuning":"low","product-sense":"low","domain-knowledge":"lowerMid","collaboration":"low","outcome-delivery":"lowerMid","learning-agility":"low","field-implementation":"partial","compliance-risk":"low"}},
      {"id":"cand-j","alias":"候选人 J","major":"控制科学与工程","degree":"硕士","school":"示例大学 J","stage":"硕士三年级","direction":"过程控制回路辨识与优化","skills":["MATLAB","Python","PID"],"publications":[{"role":"first","status":"published","tier":"sci2","venue":"示例期刊·控制与决策（二区）"}],"projects":[{"name":"萃取槽液位与流量控制优化（虚构）","role":"core","level":"provincial","validation":"pilot"}],"engineering":[{"kind":"control","desc":"回路辨识与 PID 参数自动整定（虚构）"},{"kind":"software","desc":"整定工具软件（虚构）"}],"theory":[{"kind":"numerical","desc":"系统辨识与鲁棒性分析（虚构）"}],"roles":[],"awards":[],"assessments":{"tech-stack-match":"upperMid","cross-discipline":"yes","academic-level":"lowerMid","engineering-gap":"yes","theory-depth":"yes","long-term-potential":"lowerMid","research-depth":"upperMid","research-focus":"high","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"low","product-sense":"low","domain-knowledge":"low","collaboration":"low","outcome-delivery":"low","learning-agility":"low","field-implementation":"no","compliance-risk":"low"}},
      {"id":"cand-k","alias":"候选人 K","major":"机械工程","degree":"博士","school":"示例大学 K","stage":"博士五年级","direction":"结构数字孪生与降阶代理模型","skills":["Python","ANSYS","ONNX"],"publications":[{"role":"first","status":"published","tier":"sci1","venue":"示例期刊·机械工程学报（一区）"},{"role":"first","status":"published","tier":"sci2","venue":"示例期刊·振动与冲击（二区）"},{"role":"cofirst","status":"published","tier":"sci1","venue":"示例期刊·结构与多物理场（一区，共同一作）"}],"projects":[{"name":"热等静压装备数字孪生（虚构）","role":"lead","level":"national","validation":"industrial"}],"engineering":[{"kind":"deployment","desc":"POD-XGBoost 降阶模型 ONNX 部署（虚构）"},{"kind":"software","desc":"批量提数与可视化工具链（虚构）"}],"theory":[{"kind":"numerical","desc":"降阶模型误差分析与网格无关性（虚构）"}],"roles":[{"title":"学院研究生会主席","kind":"student","start":"2024","end":"至今","current":true}],"awards":["示例优秀博士论文培育（虚构）"],"assessments":{"tech-stack-match":"lowerMid","cross-discipline":"yes","academic-level":"upperMid","engineering-gap":"yes","theory-depth":"yes","long-term-potential":"high","research-depth":"high","research-focus":"mid","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"upperMid","product-sense":"low","domain-knowledge":"low","collaboration":"low","outcome-delivery":"low","learning-agility":"low","field-implementation":"partial","compliance-risk":"low"}},
      {"id":"cand-l","alias":"候选人 L","major":"控制科学与工程","degree":"博士","school":"示例大学 L","stage":"博士四年级","direction":"强化学习决策与无人系统","skills":["Python","PyTorch","强化学习"],"publications":[{"role":"first","status":"published","tier":"sci1","venue":"示例期刊·自动化学报（一区）"},{"role":"first","status":"accepted","tier":"sci2","venue":"示例期刊·控制理论与应用（二区）"}],"projects":[{"name":"多工序调度强化学习决策（虚构）","role":"lead","level":"national","validation":"pilot"}],"engineering":[{"kind":"software","desc":"仿真与策略部署平台（虚构）"}],"theory":[{"kind":"ml","desc":"策略梯度与样本效率分析（虚构）"}],"roles":[{"title":"党支部书记","kind":"party","start":"2023","end":"至今","current":true}],"awards":["示例学会优秀论文（虚构）"],"assessments":{"tech-stack-match":"upperMid","cross-discipline":"yes","academic-level":"upperMid","engineering-gap":"partial","theory-depth":"yes","long-term-potential":"high","research-depth":"high","research-focus":"mid","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"mid","product-sense":"low","domain-knowledge":"lowerMid","collaboration":"low","outcome-delivery":"lowerMid","learning-agility":"low","field-implementation":"partial","compliance-risk":"low"}},
      {"id":"cand-m","alias":"候选人 M","major":"材料科学与工程","degree":"硕士","school":"示例大学 M","stage":"硕士三年级","direction":"稀土抛光粉制备与粒度控制","skills":["XRD","SEM","Python"],"publications":[{"role":"first","status":"published","tier":"core","venue":"示例期刊·稀土（中文核心）"}],"projects":[{"name":"抛光粉粒径与形貌调控（虚构）","role":"core","level":"enterprise","validation":"pilot"}],"engineering":[],"theory":[],"roles":[],"awards":[],"assessments":{"tech-stack-match":"mid","cross-discipline":"no","academic-level":"lowerMid","engineering-gap":"no","theory-depth":"no","long-term-potential":"lowerMid","research-depth":"upperMid","research-focus":"high","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"low","product-sense":"low","domain-knowledge":"lowerMid","collaboration":"low","outcome-delivery":"low","learning-agility":"low","field-implementation":"no","compliance-risk":"low"}},
      {"id":"cand-n","alias":"候选人 N","major":"化学工程","degree":"博士","school":"示例大学 N","stage":"博士四年级","direction":"溶剂萃取工艺放大与传质建模","skills":["Aspen","Python","萃取实验"],"publications":[{"role":"first","status":"published","tier":"sci1","venue":"示例期刊·分离与纯化技术（一区）"},{"role":"first","status":"published","tier":"sci1","venue":"示例期刊·化工学报（一区）"},{"role":"first","status":"review","tier":"sci1","venue":"示例期刊·湿法冶金（在投）"}],"projects":[{"name":"萃取塔中试放大与传质模型（虚构）","role":"lead","level":"national","validation":"pilot"}],"engineering":[{"kind":"integration","desc":"中试装置搭建与在线分析（虚构）"}],"theory":[{"kind":"thermodynamics","desc":"萃取平衡与传质系数模型（虚构）"}],"roles":[],"awards":[],"assessments":{"tech-stack-match":"upperMid","cross-discipline":"no","academic-level":"upperMid","engineering-gap":"partial","theory-depth":"yes","long-term-potential":"high","research-depth":"high","research-focus":"high","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"lowerMid","product-sense":"low","domain-knowledge":"lowerMid","collaboration":"low","outcome-delivery":"low","learning-agility":"low","field-implementation":"no","compliance-risk":"low"}},
      {"id":"cand-ind-algo","alias":"候选人 R","major":"信号与信息处理","degree":"硕士","school":"示例理工大学","stage":"工作 4 年","direction":"语音前端算法：阵列信号处理与神经网络降噪","skills":["Python","C++","波束成形","降噪","ONNX"],"publications":[],"projects":[{"name":"端侧语音前端算法自研（虚构）","role":"lead","level":"enterprise","validation":"industrial"}],"engineering":[{"kind":"deployment","desc":"端侧推理部署与性能优化（虚构）"},{"kind":"software","desc":"算法回归测试集与评测脚本（虚构）"}],"theory":[{"kind":"numerical","desc":"阵列信号处理与自适应滤波推导（虚构）"}],"roles":[{"title":"算法组小组长","kind":"other","start":"2023","end":"至今","current":true}],"awards":["示例公司技术创新奖（虚构）"],"assessments":{"tech-stack-match":"mid","cross-discipline":"yes","academic-level":"low","engineering-gap":"yes","theory-depth":"yes","long-term-potential":"mid","research-depth":"high","research-focus":"high","engineering-quality":"upperMid","system-design":"lowerMid","data-experiment":"lowerMid","modeling-tuning":"high","product-sense":"lowerMid","domain-knowledge":"upperMid","collaboration":"upperMid","outcome-delivery":"mid","learning-agility":"lowerMid","field-implementation":"partial","compliance-risk":"lowerMid"}},
      {"id":"cand-ind-backend","alias":"候选人 S","major":"计算机科学与技术","degree":"本科","school":"示例工业大学","stage":"工作 6 年","direction":"Node.js / Go 后端与高并发交易系统","skills":["Go","Node.js","MySQL","Redis","Kubernetes"],"publications":[],"projects":[{"name":"交易订单服务拆分（虚构）","role":"lead","level":"enterprise","validation":"industrial"}],"engineering":[{"kind":"deployment","desc":"灰度发布与回滚流程（虚构）"},{"kind":"software","desc":"CI/CD 与自动化测试体系（虚构）"},{"kind":"control","desc":"限流熔断与容量规划（虚构）"}],"theory":[],"roles":[{"title":"后端小组负责人","kind":"other","start":"2022","end":"至今","current":true}],"awards":[],"assessments":{"tech-stack-match":"lowerMid","cross-discipline":"yes","academic-level":"low","engineering-gap":"yes","theory-depth":"no","long-term-potential":"lowerMid","research-depth":"high","research-focus":"high","engineering-quality":"high","system-design":"upperMid","data-experiment":"lowerMid","modeling-tuning":"low","product-sense":"lowerMid","domain-knowledge":"lowerMid","collaboration":"upperMid","outcome-delivery":"upperMid","learning-agility":"lowerMid","field-implementation":"no","compliance-risk":"lowerMid"}},
      {"id":"cand-ind-data","alias":"候选人 T","major":"统计学","degree":"硕士","school":"示例财经大学","stage":"工作 3 年","direction":"数据分析与指标体系、AB 实验","skills":["SQL","Python","AB 实验","指标体系"],"publications":[],"projects":[{"name":"增长指标体系与实验平台（虚构）","role":"core","level":"enterprise","validation":"industrial"}],"engineering":[{"kind":"software","desc":"指标口径文档与校验脚本（虚构）"}],"theory":[{"kind":"ml","desc":"统计推断与实验设计（虚构）"}],"roles":[],"awards":[],"assessments":{"tech-stack-match":"lowerMid","cross-discipline":"yes","academic-level":"low","engineering-gap":"yes","theory-depth":"yes","long-term-potential":"low","research-depth":"high","research-focus":"high","engineering-quality":"lowerMid","system-design":"low","data-experiment":"high","modeling-tuning":"low","product-sense":"lowerMid","domain-knowledge":"low","collaboration":"lowerMid","outcome-delivery":"mid","learning-agility":"lowerMid","field-implementation":"no","compliance-risk":"low"}},
      {"id":"cand-ind-quant","alias":"候选人 U","major":"金融工程","degree":"硕士","school":"示例大学","stage":"工作 5 年","direction":"期权波动率策略与实盘风控","skills":["Python","C++","随机分析","期权定价"],"publications":[{"role":"first","status":"published","tier":"core","venue":"示例期刊·金融工程（中文核心）"}],"projects":[{"name":"期权波动率策略实盘（虚构）","role":"lead","level":"enterprise","validation":"industrial"}],"engineering":[{"kind":"software","desc":"回测与风控系统（虚构）"}],"theory":[{"kind":"numerical","desc":"随机波动率与数值定价（虚构）"}],"roles":[],"awards":[],"assessments":{"tech-stack-match":"lowerMid","cross-discipline":"yes","academic-level":"lowerMid","engineering-gap":"yes","theory-depth":"yes","long-term-potential":"mid","research-depth":"high","research-focus":"high","engineering-quality":"lowerMid","system-design":"lowerMid","data-experiment":"lowerMid","modeling-tuning":"high","product-sense":"lowerMid","domain-knowledge":"upperMid","collaboration":"mid","outcome-delivery":"lowerMid","learning-agility":"lowerMid","field-implementation":"no","compliance-risk":"lowerMid"}},
      {"id":"cand-ind-product","alias":"候选人 V","major":"自动化","degree":"硕士","school":"示例大学","stage":"工作 7 年","direction":"工业能源软件产品经理（智慧电厂）","skills":["需求分析","原型","数据分析","行业调研"],"publications":[],"projects":[{"name":"智慧电厂设备预警产品（虚构）","role":"lead","level":"enterprise","validation":"industrial"}],"engineering":[],"theory":[],"roles":[{"title":"产品负责人","kind":"other","start":"2021","end":"至今","current":true}],"awards":[],"assessments":{"tech-stack-match":"lowerMid","cross-discipline":"yes","academic-level":"low","engineering-gap":"partial","theory-depth":"no","long-term-potential":"lowerMid","research-depth":"high","research-focus":"high","engineering-quality":"low","system-design":"lowerMid","data-experiment":"low","modeling-tuning":"low","product-sense":"high","domain-knowledge":"high","collaboration":"mid","outcome-delivery":"upperMid","learning-agility":"lowerMid","field-implementation":"partial","compliance-risk":"low"}},
      {"id":"cand-ind-implementation","alias":"候选人 W","major":"软件工程","degree":"本科","school":"示例学院","stage":"工作 5 年","direction":"企业应用实施与运维项目经理","skills":["项目管理","SQL","Linux","客户沟通"],"publications":[],"projects":[{"name":"多工厂 ERP 实施（虚构）","role":"lead","level":"enterprise","validation":"industrial"}],"engineering":[{"kind":"field","desc":"现场部署、数据迁移与培训（虚构）"}],"theory":[],"roles":[{"title":"实施项目经理","kind":"other","start":"2022","end":"至今","current":true}],"awards":[],"assessments":{"tech-stack-match":"lowerMid","cross-discipline":"yes","academic-level":"low","engineering-gap":"yes","theory-depth":"no","long-term-potential":"lowerMid","research-depth":"high","research-focus":"high","engineering-quality":"mid","system-design":"upperMid","data-experiment":"lowerMid","modeling-tuning":"mid","product-sense":"lowerMid","domain-knowledge":"lowerMid","collaboration":"upperMid","outcome-delivery":"upperMid","learning-agility":"upperMid","field-implementation":"yes","compliance-risk":"low"}},
      {"id":"cand-ind-qa","alias":"候选人 X","major":"生物医学工程","degree":"硕士","school":"示例医科大学","stage":"工作 4 年","direction":"医疗器械质量与注册（IVD）","skills":["ISO 13485","GxP","注册申报","风险管理"],"publications":[],"projects":[{"name":"IVD 产品质量体系与注册（虚构）","role":"core","level":"enterprise","validation":"industrial"}],"engineering":[],"theory":[],"roles":[{"title":"质量工程师","kind":"other","start":"2022","end":"至今","current":true}],"awards":[],"assessments":{"tech-stack-match":"lowerMid","cross-discipline":"yes","academic-level":"low","engineering-gap":"partial","theory-depth":"no","long-term-potential":"low","research-depth":"high","research-focus":"high","engineering-quality":"low","system-design":"low","data-experiment":"low","modeling-tuning":"low","product-sense":"low","domain-knowledge":"high","collaboration":"mid","outcome-delivery":"lowerMid","learning-agility":"lowerMid","field-implementation":"no","compliance-risk":"high"}},
      {"id":"cand-ind-sales","alias":"候选人 Y","major":"市场营销","degree":"本科","school":"示例大学","stage":"工作 6 年","direction":"工业软件大客户销售","skills":["大客户销售","方案沟通","商机管理"],"publications":[],"projects":[{"name":"华东区工业软件大客户拓展（虚构）","role":"lead","level":"enterprise","validation":"industrial"}],"engineering":[],"theory":[],"roles":[{"title":"区域销售负责人","kind":"other","start":"2021","end":"至今","current":true}],"awards":["示例年度销售冠军（虚构）"],"assessments":{"tech-stack-match":"lowerMid","cross-discipline":"yes","academic-level":"low","engineering-gap":"partial","theory-depth":"no","long-term-potential":"mid","research-depth":"high","research-focus":"high","engineering-quality":"low","system-design":"lowerMid","data-experiment":"low","modeling-tuning":"low","product-sense":"upperMid","domain-knowledge":"lowerMid","collaboration":"upperMid","outcome-delivery":"high","learning-agility":"low","field-implementation":"yes","compliance-risk":"low"}},
    ]
    const DEMO_LEVEL_NOTES = '示例数据：等级由内置规则预计算，仅用于展示推导结构，未写入数据库。'

    /** Wrap a sample row in the candidate shape the panel already renders. */
    function toDisplayCandidate(sample) {
      const assessments = {}
      for (const [skillId, level] of Object.entries(sample.assessments ?? {})) {
        assessments[skillId] = {
          level,
          confidence: 'low',
          source: 'demo',
          evidence: [DEMO_LEVEL_NOTES],
          rationale: '示例候选人，仅用于前端预览。',
          method: 'demo',
          annotation: '',
        }
      }
      return {
        ...sample,
        assessments,
        source: 'demo',
        tags: ['示例'],
        profileText: '',
        notes: '示例候选人，仅用于前端预览。',
      }
    }

    const ACCEPT_RESUME = '.pdf,.doc,.docx,.rtf,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff'

    /** Turn a finished job into editable review rows. */
    function buildImportRows(job) {
      return (job?.items ?? []).map(item => ({
        key: item.key,
        jobId: job.jobId,
        ok: item.ok === true,
        selected: item.ok === true && item.duplicateOf === '' && item.lowQuality !== true && item.multiCandidate !== true,
        alias: item.suggestion?.alias ?? '',
        major: item.suggestion?.major ?? '',
        degree: item.suggestion?.degree ?? '',
        school: item.suggestion?.school ?? '',
        direction: item.suggestion?.direction ?? '',
      }))
    }

    /** 0–100 for the progress bar; the model pass owns the last third. */
    function importProgress(job) {
      if (job === null || job === undefined) return 0
      if (job.status === 'done') return 100
      if (job.status === 'cancelled') return 100
      if (job.status === 'error') return 100
      if (job.phase === 'listing') return 4
      if (job.phase === 'agent') {
        const share = (job.agentTotal ?? 0) === 0 ? 0 : (job.agentDone ?? 0) / job.agentTotal
        return Math.round(62 + share * 36)
      }
      const total = job.total ?? 0
      if (total === 0) return 6
      return Math.round(4 + ((job.extracted ?? 0) / total) * 58)
    }

    function importPhaseText(t, job) {
      if (job === null || job === undefined) return ''
      if (job.status === 'cancelled') return t('import.jobCancelled')
      if (job.status === 'error') return `${t('import.jobFailed')}：${job.error ?? ''}`
      if (job.status === 'done') return t('import.jobDone')
      if (job.phase === 'listing') return t('import.phaseList')
      if (job.phase === 'agent') return t('import.phaseAgent')
        .replace('{done}', String(job.agentDone ?? 0))
        .replace('{total}', String(job.agentTotal ?? 0))
      return t('import.phaseExtractProgress')
        .replace('{done}', String(job.extracted ?? 0))
        .replace('{total}', String(job.total ?? 0))
    }

    /** Page-level progress so closing the dialog never hides the work. */
    function ImportBanner({ t, job, onOpen, onCancel }) {
      if (job === null || job === undefined) return null
      const running = job.status === 'running'
      const failed = job.status === 'error'
      const done = job.status === 'done'
      const tone = failed ? 'err' : done ? 'ok' : 'warn'
      const seconds = Math.max(0, Math.round(((job.finishedAt ?? Date.now()) - (job.startedAt ?? Date.now())) / 1000))
      return h('div', { className: `tw-importbar ${tone}`, role: 'status', 'aria-live': 'polite' },
        h('div', { className: 'tw-importbar-top' },
          running
            ? h('span', { className: 'tw-spin', 'aria-hidden': true })
            : h(Icon, { name: done ? 'check' : 'alert', size: 13 }),
          h('span', { className: 'tw-importbar-text' }, importPhaseText(t, job)),
          h('span', { className: 'tw-spacer' }),
          h('span', { className: 'tw-small tw-muted' }, `${seconds}s`),
          h(Button, { size: 'sm', variant: done ? 'primary' : 'ghost', onClick: onOpen }, done ? t('import.reviewResult') : t('import.viewProgress')),
          running ? h(Button, { size: 'sm', variant: 'danger', onClick: onCancel }, t('import.cancelJob')) : null),
        h('div', { className: 'tw-importbar-track' }, h('i', { style: { width: `${importProgress(job)}%` } })))
    }

    function ImportModal({ t, call, notify, onClose, onImported, job, rows, setRows, clientSkips, setClientSkips, startImport, resetImport }) {
      const [busy, setBusy] = useState(false)
      const [phase, setPhase] = useState('')
      const [reading, setReading] = useState(false)
      const [pathText, setPathText] = useState('')
      const [recursive, setRecursive] = useState(true)
      const fileRef = useRef(null)
      const folderRef = useRef(null)

      const running = job !== null && job !== undefined && job.status === 'running'
      const done = job !== null && job !== undefined && job.status === 'done'
      const engineLabel = {
        'pdf-text': 'PDF 文字层',
        'pdf-ocr': 'PDF 扫描件 · OCR',
        'docx-ooxml': 'DOCX',
        'doc-ole': 'DOC',
        'image-ocr': '图片 · OCR',
        'rtf-text': 'RTF',
        'plain-text': '纯文本',
      }

      const onPickedFiles = async (fileList) => {
        if (running || reading) return
        const files = Array.from(fileList ?? [])
        if (files.length === 0) return
        setReading(true)
        setPhase(t('import.phaseRead'))
        const skipped = []
        try {
          let total = 0
          const payload = []
          for (const file of files) {
            const name = file.webkitRelativePath || file.name
            if (file.size > 30 * 1024 * 1024) { skipped.push({ name, reason: t('import.skipTooBig') }); continue }
            if (total + file.size > 40 * 1024 * 1024) { skipped.push({ name, reason: t('import.skipBatch') }); continue }
            total += file.size
            payload.push({ name, data: await fileToBase64(file) })
          }
          if (payload.length === 0) {
            setClientSkips(skipped)
            notify(t('import.nothingReadable'), 'error')
            return
          }
          await startImport({ files: payload, skipped })
        } catch (error) {
          notify(String(error?.message ?? error), 'error')
        } finally {
          setReading(false)
          setPhase('')
        }
      }

      const commit = async () => {
        const chosen = rows.filter(row => row.selected)
        if (chosen.length === 0) { notify(t('import.noneSelected'), 'error'); return }
        setBusy(true)
        setPhase(t('import.phaseCommit'))
        try {
          const overrides = {}
          for (const row of chosen) {
            overrides[row.key] = {
              alias: row.alias,
              major: row.major,
              degree: row.degree,
              school: row.school,
              direction: row.direction,
            }
          }
          const body = await call('resumes.commit', { scanId: job.scanId, keys: chosen.map(row => row.key), overrides })
          const skipped = body.skippedDuplicate?.length ?? 0
          notify(`已导入 ${body.created.length} 位候选人${skipped > 0 ? `，跳过重复 ${skipped} 份` : ''}`)
          resetImport()
          onImported(body.created, body.snapshot)
          onClose()
        } catch {
          /* call() already reported the failure */
        } finally {
          setBusy(false)
          setPhase('')
        }
      }

      const setRow = (key, patch) => setRows(prev => prev.map(row => row.key === key ? { ...row, ...patch } : row))
      const items = job?.items ?? []
      const selectableKeys = new Set(items.filter(item => item.ok === true && item.duplicateOf === '').map(item => item.key))
      const selectableRows = rows.filter(row => row.ok !== false && selectableKeys.has(row.key))
      const allSelected = selectableRows.length > 0 && selectableRows.every(row => row.selected)
      const selectedCount = rows.filter(row => row.selected).length
      const skippedAll = [...(job?.skipped ?? []), ...clientSkips]

      const progressPanel = job === null || job === undefined ? null : h('div', { className: `tw-progressbox ${job.status === 'error' ? 'err' : job.status === 'done' ? 'ok' : ''}` },
        h('div', { className: 'tw-row wrap' },
          running ? h('span', { className: 'tw-spin', 'aria-hidden': true }) : h(Icon, { name: job.status === 'error' ? 'alert' : 'check', size: 14 }),
          h('div', { style: { flex: '1 1 220px', minWidth: 0 } },
            h('div', { className: 'tw-small', style: { fontWeight: 600 } }, importPhaseText(t, job)),
            h('div', { className: 'tw-hint' }, running ? t('import.backgroundHint') : t('import.jobFinishedHint'))),
          running ? h(Button, { size: 'sm', variant: 'danger', onClick: resetImport }, t('import.cancelJob')) : null),
        h('div', { className: 'tw-progress-track' }, h('i', { style: { width: `${importProgress(job)}%` } })),
        running && items.length > 0
          ? h('div', { className: 'tw-small tw-muted', style: { marginTop: 6 } },
            `${t('import.extractedSoFar')}：${items.map(item => item.name).join('、')}`)
          : null)

      const review = done ? h('div', { className: 'tw-grid', style: { gap: 8 } },
        h('div', { className: 'tw-row wrap' },
          h(Badge, { tone: 'brand' }, `${job.summary.total} 份`),
          h(Badge, { tone: 'success' }, `可导入 ${job.summary.ready}`),
          job.summary.ocr > 0 ? h(Badge, { tone: 'warn' }, `OCR ${job.summary.ocr}`) : null,
          job.summary.duplicate > 0 ? h(Badge, { tone: 'warn' }, `疑似重复 ${job.summary.duplicate}`) : null,
          job.summary.failed > 0 ? h(Badge, { tone: 'error' }, `失败 ${job.summary.failed}`) : null,
          (job.summary.multiCandidate ?? 0) > 0 ? h(Badge, { tone: 'error' }, `${t('import.multiCandidate')} ${job.summary.multiCandidate}`) : null,
          h(Badge, { tone: (job.summary.agentParsed ?? 0) > 0 ? 'brand' : 'warn' }, `${t('import.byAgent')} ${job.summary.agentParsed ?? 0}/${job.summary.ready ?? 0}`),
          h('span', { className: 'tw-spacer' }),
          h(Button, { size: 'sm', variant: 'ghost', disabled: busy, onClick: resetImport }, t('import.reselect')),
          h('button', {
            type: 'button',
            className: 'tw-btn ghost sm',
            'aria-pressed': allSelected,
            disabled: selectableRows.length === 0,
            onClick: () => setRows(prev => prev.map(row => row.ok === false || !selectableKeys.has(row.key) ? row : { ...row, selected: !allSelected })),
          }, allSelected ? t('import.clearAll') : t('import.selectAll'))),
        skippedAll.length > 0 ? h('details', { className: 'tw-details' },
          h('summary', null, `${t('import.skipped')}（${skippedAll.length}）`),
          h('ul', { style: { margin: '4px 0 0', paddingLeft: 16, fontSize: 12.5, lineHeight: 1.6, maxHeight: 140, overflow: 'auto' } },
            skippedAll.map((item, index) => h('li', { key: `${item.name}-${index}` }, `${item.name} — ${item.reason}`)))) : null,
        h('div', { className: 'tw-grid', style: { gap: 6 } },
          items.map(item => {
            const row = rows.find(entry => entry.key === item.key)
            if (row === undefined) return null
            if (item.ok !== true) {
              return h('div', { key: item.key, className: 'tw-import-row failed' },
                h(Icon, { name: 'alert', size: 13 }),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { className: 'tw-small', style: { fontWeight: 600 } }, item.name),
                  h('div', { className: 'tw-small tw-muted' }, item.error)),
                h(Badge, { tone: 'error' }, t('import.failed')))
            }
            const blocked = item.duplicateOf !== ''
            return h('div', { key: item.key, className: `tw-import-row ${row.selected ? 'selected' : ''}` },
              h('input', {
                type: 'checkbox',
                checked: row.selected,
                disabled: blocked,
                title: blocked ? t('import.duplicateBlocked') : '',
                'aria-label': `${item.name} ${t('import.select')}`,
                onChange: event => setRow(item.key, { selected: event.target.checked }),
              }),
              h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 } },
                h('div', { className: 'tw-row wrap' },
                  h('span', { className: 'tw-small', style: { fontWeight: 600, wordBreak: 'break-all' } }, item.name),
                  h(Badge, { tone: item.needsReview ? 'warn' : 'idle' }, engineLabel[item.engine] ?? item.engine),
                  h('span', { className: 'tw-small tw-muted' }, `${item.chars} 字`),
                  item.lowQuality ? h(Badge, { tone: 'error' }, t('import.lowQuality')) : null,
                  item.multiCandidate ? h(Badge, { tone: 'error' }, t('import.multiCandidate')) : null,
                  h(Badge, { tone: item.extractionSource === 'agent' ? 'brand' : 'idle' }, item.extractionSource === 'agent' ? t('import.byAgent') : t('import.byRule')),
                  item.duplicateOf ? h(Badge, { tone: 'warn' }, `${t('import.duplicate')}：${item.duplicateOf}`) : null),
                h('div', { className: 'tw-grid cols2' },
                  h('input', { className: 'tw-input', value: row.alias, placeholder: t('import.alias'), 'aria-label': `${item.name} ${t('import.alias')}`, onChange: event => setRow(item.key, { alias: event.target.value }) }),
                  h('input', { className: 'tw-input', value: row.major, placeholder: t('import.major'), 'aria-label': `${item.name} ${t('import.major')}`, onChange: event => setRow(item.key, { major: event.target.value }) }),
                  h('input', { className: 'tw-input', value: row.degree, placeholder: t('import.degree'), 'aria-label': `${item.name} ${t('import.degree')}`, onChange: event => setRow(item.key, { degree: event.target.value }) }),
                  h('input', { className: 'tw-input', value: row.school, placeholder: t('import.school'), 'aria-label': `${item.name} ${t('import.school')}`, onChange: event => setRow(item.key, { school: event.target.value }) })),
                h('input', { className: 'tw-input', style: { marginTop: 4 }, value: row.direction, placeholder: t('import.direction'), 'aria-label': `${item.name} ${t('import.direction')}`, onChange: event => setRow(item.key, { direction: event.target.value }) }),
                (item.warnings ?? []).length > 0 ? h('div', { className: 'tw-small', style: { color: 'var(--dsw-alias-state-warn-primary)' } }, item.warnings.join('；')) : null,
                h('details', { className: 'tw-details' },
                  h('summary', null, `${t('import.preview')}（${item.chars} 字）`),
                  h('div', { className: 'tw-code', style: { maxHeight: 200 } }, item.preview),
                  item.pages !== undefined && item.pages.length > 0
                    ? h('div', { className: 'tw-small tw-muted', style: { marginTop: 4, wordBreak: 'break-all' } }, `${t('import.pageImages')}：${item.pages.join('；')}`)
                    : null)))
          }))) : null

      const picker = job !== null && job !== undefined ? null : h('div', { className: 'tw-grid', style: { gap: 10 } },
        h('div', { className: 'tw-info' }, t('import.hint')),
        h('div', { className: 'tw-hint' }, t('import.limits')),
        h('div', { className: 'tw-row wrap' },
          h('label', { className: 'tw-btn primary sm', style: { cursor: 'pointer', opacity: running || reading ? 0.5 : 1 } },
            h(Icon, { name: 'upload', size: 12 }), t('import.pickFiles'),
            h('input', {
              ref: fileRef,
              type: 'file',
              multiple: true,
              accept: ACCEPT_RESUME,
              disabled: running || reading,
              className: 'tw-sr',
              onChange: async event => {
                const files = Array.from(event.target.files ?? [])
                event.target.value = ''
                await onPickedFiles(files)
              },
            })),
          h('label', { className: 'tw-btn sm', style: { cursor: 'pointer', opacity: running || reading ? 0.5 : 1 } },
            h(Icon, { name: 'book', size: 12 }), t('import.pickFolder'),
            h('input', {
              ref: folderRef,
              type: 'file',
              webkitdirectory: '',
              directory: '',
              multiple: true,
              disabled: running || reading,
              className: 'tw-sr',
              onChange: async event => {
                const files = Array.from(event.target.files ?? [])
                event.target.value = ''
                await onPickedFiles(files)
              },
            }))),
        h('details', { className: 'tw-details' },
          h('summary', null, t('import.pathTitle')),
          h('div', { className: 'tw-hint', style: { marginBottom: 4 } }, t('import.pathHint')),
          h('div', { className: 'tw-row wrap' },
            h('input', {
              className: 'tw-input',
              style: { flex: '1 1 220px' },
              placeholder: 'D:\\resumes',
              value: pathText,
              disabled: running || reading,
              'aria-label': t('import.pathTitle'),
              onChange: event => setPathText(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter' && pathText.trim() !== '' && !running && !reading) startImport({ path: pathText.trim(), recursive })
              },
            }),
            h('label', { className: 'tw-row tw-small' }, h('input', { type: 'checkbox', checked: recursive, onChange: event => setRecursive(event.target.checked) }), t('import.recursive')),
            h(Button, { size: 'sm', disabled: running || reading || pathText.trim() === '', onClick: () => startImport({ path: pathText.trim(), recursive }) }, t('import.scanPath')))))

      const progress = phase === '' ? null : h('div', { className: 'tw-info', role: 'status', 'aria-live': 'polite' }, `${phase}…`)

      return h(Modal, {
        title: t('import.title'),
        onClose,
        width: 'wide',
        dirty: done,
        footer: [
          h(Button, { key: 'cancel', onClick: onClose }, done ? t('common.cancel') : t('import.closeKeepRunning')),
          done ? h(Button, { key: 'commit', variant: 'primary', onClick: commit, disabled: busy || selectedCount === 0 }, `${t('import.commit')}（${selectedCount}）`) : null,
        ],
      },
      h('div', { className: 'tw-small tw-muted', style: { marginBottom: 8 } }, t('import.subtitle')),
      progress,
      h('div', { className: 'tw-info', style: { marginBottom: 10 } }, t('import.agentNotice')),
      job !== null && job !== undefined && job.agent !== undefined && job.agent !== null && job.agent.available === true && (job.agent.used ?? 0) === 0
        ? h('div', { className: 'tw-warning', style: { marginBottom: 10 } }, t('import.agentUnavailable').replace('{reason}', (job.agent.errors ?? ['未知'])[0] || '未知'))
        : null,
      job !== null && job !== undefined && job.agent !== undefined && job.agent !== null && job.agent.available === false
        ? h('div', { className: 'tw-warning', style: { marginBottom: 10 } }, t('import.agentUnavailable').replace('{reason}', job.agent.reason || '未知'))
        : null,
      progressPanel,
      picker,
      review)
    }

    function Screening({ state, t, template, isDraft, rows, skillMap, query, setQuery, demoMode, selectedCandidate, selectedResult, selectedCandidateId, setSelectedCandidateId, onAddCandidate, onImportResumes, onEditCandidate, onDeleteCandidate, onLevelChange, onOpenSkill, onNewRun, onExportReport, onAutoAssess, onSaveDraft, onDiscardDraft, onSelectBatch, onManageBatches, busy }) {
      const lowerQuery = query.trim().toLowerCase()
      const candidateById = new Map(rows.map(row => [row.candidateId, row.candidate]))
      const matches = (row) => {
        if (lowerQuery === '') return true
        const candidate = candidateById.get(row.candidateId)
        return [row.alias, row.major, candidate?.direction, row.candidateId].filter(Boolean).some(value => String(value).toLowerCase().includes(lowerQuery))
      }
      const filtered = rows.filter(matches)
      const selectedCandidateData = selectedCandidate
      const result = selectedResult
      const thresholdRows = [
        [t('template.recommendLine'), template?.decision?.recommend ?? 70],
        [t('template.backupLine'), template?.decision?.backup ?? 55],
        [t('template.hitLine'), template?.hitMinScore ?? 0.6],
      ]
      return h('div', { className: 'tw-grid', style: { gap: 10 } },
        isDraft ? h('div', { className: 'tw-draftbar' },
          h(Icon, { name: 'sliders', size: 13 }),
          h('div', { style: { flex: 1, minWidth: 0 } }, t('screening.draftBanner')),
          h(Button, { size: 'sm', variant: 'primary', onClick: onSaveDraft, disabled: busy !== '' }, t('template.saveVersion')),
          h(Button, { size: 'sm', onClick: onDiscardDraft, disabled: busy !== '' }, t('template.discard'))) : null,
        h('div', { className: 'tw-batchbar' },
          h('span', { className: 'tw-label' }, t('batch.compareIn')),
          (state.batches ?? []).map(batch => h('button', {
            key: batch.id,
            type: 'button',
            className: `tw-batchchip ${batch.id === state.activeBatchId ? 'active' : ''}`,
            'aria-pressed': batch.id === state.activeBatchId,
            onClick: () => onSelectBatch(batch.id),
          },
          h('span', { className: 'nm' }, batch.name),
          h('span', { className: 'ct' }, String(batch.candidateCount ?? 0)),
          batch.interviewFrom ? h('span', { className: 'dt' }, batch.interviewFrom) : null)),
          h('button', { type: 'button', className: 'tw-btn ghost sm', onClick: onManageBatches }, t('batch.manage'))),
        h('div', { className: 'tw-row wrap' },
          h('div', { style: { flex: '1 1 200px', position: 'relative' } },
            h('span', { style: { position: 'absolute', left: 7, top: 6, color: 'var(--dsw-alias-label-secondary)' } }, h(Icon, { name: 'search', size: 13 })),
            h('input', { className: 'tw-input', style: { paddingLeft: 25 }, placeholder: t('screening.search'), 'aria-label': t('screening.search'), value: query, onChange: event => setQuery(event.target.value) })),
          h(Button, { size: 'sm', variant: 'soft', onClick: onNewRun, disabled: busy !== '' }, h(Icon, { name: 'flag', size: 12 }), t('screening.newRun')),
          h(Button, { size: 'sm', onClick: onImportResumes, disabled: busy !== '' }, h(Icon, { name: 'upload', size: 12 }), t('screening.import')),
          h(Button, { size: 'sm', variant: 'ghost', onClick: onExportReport }, h(Icon, { name: 'download', size: 12 }), t('screening.exportReport'))),
        h('div', { className: 'tw-hint tw-legend' }, t('screening.subtitle')),
        demoMode ? h('div', { className: 'tw-info' }, t('demo.hint')) : null,
        state.candidates.length === 0 && !demoMode
          ? h(Empty, {
            title: t('screening.empty'),
            body: t('screening.emptyBody'),
            action: h('div', { className: 'tw-row', style: { justifyContent: 'center', flexWrap: 'wrap' } },
              h(Button, { variant: 'primary', size: 'sm', onClick: onImportResumes }, h(Icon, { name: 'upload', size: 12 }), t('screening.import')),
              h(Button, { size: 'sm', onClick: onAddCandidate }, t('screening.addCandidate'))),
          })
          : h('div', { className: 'tw-screening' },
            h('div', { className: 'tw-col-list' },
              h('div', { className: 'tw-card pad0', style: { padding: 6 } },
                filtered.length === 0 ? h(Empty, { title: t('common.none') }) : h('div', { className: 'tw-cand-list' },
                  filtered.map(item => {
                    const meta = decisionMeta(item.decision, t)
                    return h('button', {
                      key: item.candidateId,
                      type: 'button',
                      className: `tw-cand ${item.candidateId === selectedCandidateId ? 'active' : ''}`,
                      onClick: () => setSelectedCandidateId(item.candidateId),
                    },
                    h('div', { className: 'line1' },
                      h('span', { className: 'rank' }, item.rank),
                      h('span', { className: 'name' }, item.alias),
                      h('span', { className: 'score' }, item.total)),
                    h('div', { className: 'meta' },
                      h('span', null, item.major || '—'),
                      h('span', { style: { marginLeft: 'auto' } }, h(Badge, { tone: meta.tone }, meta.label))))
                  })))),
            h('div', { className: 'tw-col-main' },
              selectedCandidateData === null
                ? h(Empty, { title: t('screening.selectHint') })
                : h(CandidateDetail, {
                  t,
                  candidate: selectedCandidateData,
                  result,
                  template,
                  skillMap,
                  demoMode,
                  onEdit: () => onEditCandidate(selectedCandidateData),
                  onDelete: () => onDeleteCandidate(selectedCandidateData.id),
                  onLevelChange,
                  onOpenSkill,
                  onAutoAssess,
                  busy,
                })),
            h('div', { className: 'tw-col-side' },
              result
                ? h(ScoreCard, { t, result, candidate: selectedCandidateData, template, thresholds: thresholdRows })
                : h(Empty, { title: t('screening.noResult') }))),
        rows.length === 0 ? null : h('div', { className: 'tw-card pad0' },
          h('div', { className: 'tw-card-head', style: { padding: '8px 10px 0' } },
            h('div', { className: 'tw-card-title' }, t('screening.resultTable')),
            h('div', { className: 'tw-small tw-muted' }, `${rows.length} 人 · ${template?.name ?? ''}${isDraft ? ` · ${t('template.draft')}` : ''}`)),
          h('div', { className: 'tw-table-wrap', style: { margin: 8 } },
            h('table', { className: 'tw-table' },
              h('thead', null, h('tr', null,
                h('th', null, t('common.rank')),
                h('th', null, '候选人'),
                h('th', null, t('common.major')),
                h('th', { className: 'num' }, t('common.score')),
                h('th', { className: 'num' }, t('common.hits')),
                h('th', { className: 'num' }, t('screening.legacy')),
                h('th', { className: 'num' }, t('screening.rankShift')),
                h('th', null, t('common.decision')))),
              h('tbody', null, filtered.map(item => {
                const meta = decisionMeta(item.decision, t)
                return h('tr', {
                  key: item.candidateId,
                  tabIndex: 0,
                  onClick: () => setSelectedCandidateId(item.candidateId),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedCandidateId(item.candidateId)
                    }
                  },
                },
                h('td', { className: 'num' }, item.rank),
                h('td', { className: 'nowrap' }, item.alias),
                h('td', null, item.major || '—'),
                h('td', { className: 'num' }, item.total),
                h('td', { className: 'num' }, `${item.hits}/${item.derivation.length}`),
                h('td', { className: 'num' }, item.legacyHits),
                h('td', { className: 'num' }, item.rankShift === 0 ? '—' : (item.rankShift > 0 ? `↑${item.rankShift}` : `↓${Math.abs(item.rankShift)}`)),
                h('td', null, h(Badge, { tone: meta.tone }, meta.label)))
              })))))
      )
    }

    function CandidateDetail({ t, candidate, result, template, skillMap, demoMode, onEdit, onDelete, onLevelChange, onOpenSkill, onAutoAssess, busy }) {
      const [openEvidence, setOpenEvidence] = useState({})
      const assessment = (skillId) => candidate.assessments?.[skillId]
      const confidenceLabel = { high: '高', medium: '中', low: '低' }
      const tierLabel = { top: '顶刊/CNS 子刊', sci1: 'JCR 一区', sci2: 'JCR 二区', ccfA: 'CCF-A', ccfB: 'CCF-B', ccfC: 'CCF-C', ei: 'EI', core: '北大核心', other: '其他' }
      const roleLabel = { first: '一作', cofirst: '共同一作', other: '其他' }
      const statusLabel = { published: '已发表', accepted: '已接收', review: '在投/在审', inReview: '在投/在审', revise: '返修' }
      const projectRole = { lead: '主导', core: '核心', participant: '参与' }
      const projectLevel = { national: '国家级', provincial: '省部级', enterprise: '企业', lab: '实验室' }
      const validationLabel = { industrial: '产线/现场', pilot: '中试', lab: '实验室' }
      const engineeringLabel = { deployment: '部署上线', software: '软件平台', control: '控制系统', integration: '系统集成', field: '现场交付' }
      const theoryLabel = { 'first-principles': '第一性原理', md: '分子动力学', numerical: '数值算法', thermodynamics: '热力学/相图', ml: '机器学习', other: '其他' }
      const roleKindLabel = { party: '党务', student: '学生干部', admin: '行政', other: '其他' }
      return h('div', { className: 'tw-grid', style: { gap: 10 } },
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-card-head' },
            h('div', { style: { minWidth: 0 } },
              h('div', { className: 'tw-row' },
                h('div', { style: { fontSize: 17.5, fontWeight: 650 } }, candidate.alias),
                candidate.realName ? h(Badge, { tone: 'idle' }, candidate.realName) : null,
                h(Badge, { tone: 'brand' }, candidate.degree || '—'),
                h(Badge, { tone: 'idle' }, candidate.major || '—')),
              h('div', { className: 'tw-small tw-muted', style: { marginTop: 2 } }, [candidate.school, candidate.stage, candidate.direction].filter(Boolean).join(' · '))),
            h('div', { className: 'tw-row' },
              demoMode
                ? h(Badge, { tone: 'warn' }, t('demo.readOnly'))
                : h('div', { className: 'tw-row' },
                  h(Button, { size: 'sm', onClick: onEdit }, h(Icon, { name: 'edit', size: 12 }), t('common.edit')),
                  h(Button, { size: 'sm', variant: 'ghost', onClick: () => onAutoAssess(candidate.id), disabled: busy !== '' }, h(Icon, { name: 'refresh', size: 12 }), t('screening.autoAssess')),
                  h('button', { type: 'button', className: 'tw-btn ghost sm', style: { color: 'var(--dsw-alias-state-error-primary)' }, onClick: onDelete, title: t('screening.deleteCandidate'), 'aria-label': t('screening.deleteCandidate') }, h(Icon, { name: 'trash', size: 13 }))))),
          h('div', { className: 'tw-chips' },
            (candidate.skills ?? []).slice(0, 18).map(skill => h('span', { key: skill, className: 'tw-chip' }, skill))),
          candidate.profileText ? h('details', { className: 'tw-details' },
            h('summary', null, t('screening.profileText')),
            h('div', { className: 'tw-small tw-muted', style: { whiteSpace: 'pre-wrap', marginTop: 4, maxHeight: 180, overflow: 'auto' } }, candidate.profileText)) : null),
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-card-head' },
            h('div', null, h('div', { className: 'tw-card-title' }, t('screening.derivation')), h('div', { className: 'tw-card-sub' }, `${template?.name ?? ''} · 权重自动归一化`)),
            h(Badge, { tone: 'brand' }, `${result?.hits ?? 0}/${result?.derivation?.length ?? 0} 命中`)),
          (result?.derivation ?? []).map((item) => {
            const skill = skillMap.get(item.skillId)
            const current = assessment(item.skillId)
            const open = openEvidence[item.skillId] === true
            return h('div', { key: item.skillId, className: 'tw-dim' },
              h('div', { className: 'tw-dim-head' },
                h('span', { className: 'tw-dim-name' }, item.name),
                h('span', { className: 'tw-dim-weight' }, `${Math.round(item.normalized * 100)}% · 权重 ${item.weight}`),
                h('span', { className: 'tw-dim-score' }, `${item.levelLabel} · 贡献 ${item.contribution.toFixed(1)}`)),
              h('div', { className: 'tw-row', style: { marginTop: 4 } },
                h('select', {
                  className: 'tw-select',
                  style: { width: 92 },
                  'aria-label': `${item.name} 等级`,
                  disabled: demoMode === true,
                  value: current?.level ?? item.level,
                  onChange: event => onLevelChange(candidate.id, item.skillId, event.target.value, current),
                }, (skill?.scale ?? []).map(level => h('option', { key: level.value, value: level.value }, level.label))),
                h('div', { style: { flex: 1 } }, h(ScoreBar, { value: item.contribution, max: Math.max(1, Number(item.weight) || 1), tone: levelTone(item.level) })),
                h(Badge, { tone: levelTone(item.level) }, `${Math.round(item.score * 100)} 分`),
                h(Button, { size: 'sm', variant: 'ghost', onClick: () => onOpenSkill(item.skillId) }, t('screening.viewSkill'))),
              h('div', { className: 'tw-dim-foot' },
                h(Badge, { tone: current?.source === 'manual' ? 'brand' : 'idle' }, current?.source === 'manual' ? t('screening.source.manual') : t('screening.source.auto')),
                h('span', null, `${t('screening.confidence')} ${confidenceLabel[current?.confidence ?? 'low'] ?? '低'}`),
                item.gateFailed ? h(Badge, { tone: 'error' }, t('screening.gateFail')) : null,
                h('button', { type: 'button', className: 'tw-btn ghost sm', onClick: () => setOpenEvidence(prev => ({ ...prev, [item.skillId]: !open })) }, open ? t('screening.hideEvidence') : t('screening.showEvidence'))),
              open ? h('div', { className: 'tw-dim-evidence' },
                h('div', { className: 'tw-small tw-muted' }, current?.rationale || ''),
                h('ul', null, (current?.evidence ?? []).slice(0, 8).map((line, index) => h('li', { key: index }, line))),
                h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, current?.method ?? '')) : null)
          }),
          (result?.derivation ?? []).length === 0 ? h('div', { className: 'tw-small tw-muted' }, t('screening.noResult')) : null),
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-card-title', style: { marginBottom: 4 } }, t('screening.evidence')),
          h('div', { className: 'tw-grid cols2' },
            h(EvidenceBlock, { title: t('screening.publications'), items: (candidate.publications ?? []).map(item => `${roleLabel[item.role] ?? item.role} · ${statusLabel[item.status] ?? item.status} · ${tierLabel[item.tier] ?? item.tier} · ${item.venue}`) }),
            h(EvidenceBlock, { title: t('screening.projects'), items: (candidate.projects ?? []).map(item => `${item.name}（${projectRole[item.role] ?? item.role} / ${projectLevel[item.level] ?? item.level} / ${validationLabel[item.validation] ?? item.validation}）`) }),
            h(EvidenceBlock, { title: t('screening.engineering'), items: (candidate.engineering ?? []).map(item => `${engineeringLabel[item.kind] ?? item.kind}：${item.desc}`) }),
            h(EvidenceBlock, { title: t('screening.theory'), items: (candidate.theory ?? []).map(item => `${theoryLabel[item.kind] ?? item.kind}：${item.desc}`) }),
            h(EvidenceBlock, { title: t('screening.roles'), items: (candidate.roles ?? []).map(item => `${item.title}（${roleKindLabel[item.kind] ?? item.kind}${item.current ? '，在任' : ''}）`) }),
            h(EvidenceBlock, { title: t('screening.awards'), items: candidate.awards ?? [] }))))
    }

    function EvidenceBlock({ title, items }) {
      return h('div', { style: { minWidth: 0 } },
        h('div', { className: 'tw-small tw-muted', style: { fontWeight: 600 } }, title),
        items.length === 0 ? h('div', { className: 'tw-small tw-muted' }, '—') : h('ul', { style: { margin: '3px 0 0', paddingLeft: 15, fontSize: 12.5, lineHeight: 1.5 } }, items.slice(0, 6).map((item, index) => h('li', { key: index }, item))))
    }

    function ScoreCard({ t, result, candidate, template, thresholds }) {
      const meta = decisionMeta(result.decision, t)
      const top = [...(result.derivation ?? [])].sort((a, b) => b.contribution - a.contribution).slice(0, 3)
      const recommend = template?.decision?.recommend ?? 70
      const backup = template?.decision?.backup ?? 55
      return h('div', { className: 'tw-scorecard' },
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-row' },
            h('div', { style: { flex: 1 } },
              h('div', { className: 'tw-card-sub' }, t('screening.total')),
              h('div', { className: 'tw-bigscore' }, result.total),
              h('div', { className: 'tw-scoremeta' },
                h(Badge, { tone: meta.tone }, meta.label),
                h(Badge, { tone: 'idle' }, `#${result.rank}`))),
            h('div', { style: { width: 54, textAlign: 'center' } },
              h('div', { className: 'tw-bigscore', style: { fontSize: 24 } }, result.hits),
              h('div', { className: 'tw-small tw-muted' }, t('common.hits')))),
          h('div', { className: 'tw-divider' }),
          h('div', { className: 'tw-small tw-muted' }, t('screening.thresholds')),
          h('div', { className: 'tw-chips', style: { marginTop: 3 } },
            h('span', { className: 'tw-chip' }, `${t('template.recommendLine')} ≥ ${recommend}`),
            h('span', { className: 'tw-chip' }, `${t('template.backupLine')} ≥ ${backup}`)),
          h('div', { className: 'tw-threshold' },
            h('div', { className: 'tw-threshold-track' },
              h('i', { style: { width: `${Math.min(100, Math.max(0, result.total))}%` } }),
              h('span', { className: 'tw-threshold-mark', style: { left: `${Math.min(100, backup)}%` } }),
              h('span', { className: 'tw-threshold-mark strong', style: { left: `${Math.min(100, recommend)}%` } }))),
          h('div', { className: 'tw-small tw-muted', style: { marginTop: 4 } }, t('screening.hitLineHint').replace('{v}', String(template?.hitMinScore ?? 0.6))),
          result.gateFailures?.length > 0 ? h('div', { className: 'tw-warning' }, `${t('screening.gateFail')}：${result.gateFailures.join('、')}`) : null),
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-card-title' }, t('screening.why')),
          h('div', { className: 'tw-why' }, t('screening.whyBody')),
          h('div', { className: 'tw-divider' }),
          top.map(item => h('div', { key: item.skillId, style: { marginBottom: 5 } },
            h('div', { className: 'tw-row' }, h('span', { style: { fontSize: 12.5 } }, item.name), h('span', { className: 'tw-spacer' }), h('span', { className: 'tw-small tw-muted' }, `${item.levelLabel} · ${item.contribution.toFixed(1)}`)),
            h(ScoreBar, { value: item.contribution, max: Math.max(1, Number(item.weight) || 1), tone: levelTone(item.level) }))),
          h('div', { className: 'tw-divider' }),
          h('div', { className: 'tw-small tw-muted' }, `${t('screening.legacyCompare')}：旧口径第 ${result.legacyRank} 名（${result.legacyHits} 个命中），当前第 ${result.rank} 名。`),
          h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, `${candidate?.degree ?? ''} · ${candidate?.major ?? ''} · ${candidate?.direction ?? ''}`)))
    }

    function CandidateModal({ t, mode, candidate, onClose, onSave, busy, realNameHidden }) {
      const [form, setForm] = useState(() => ({
        alias: candidate?.alias ?? '',
        realName: candidate?.realName ?? '',
        major: candidate?.major ?? '',
        degree: candidate?.degree ?? '硕士',
        school: candidate?.school ?? '',
        stage: candidate?.stage ?? '',
        interviewDate: candidate?.interviewDate ?? '',
        direction: candidate?.direction ?? '',
        profileText: candidate?.profileText ?? '',
        publications: candidate?.publications ?? [],
        projects: candidate?.projects ?? [],
        engineering: candidate?.engineering ?? [],
        theory: candidate?.theory ?? [],
        roles: candidate?.roles ?? [],
        skillsText: (candidate?.skills ?? []).join('、'),
        awardsText: (candidate?.awards ?? []).join('、'),
        notes: candidate?.notes ?? '',
      }))
      const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
      const [baseline] = useState(() => JSON.stringify(form))
      const dirty = JSON.stringify(form) !== baseline
      const updateRow = (key, index, patch) => setForm(prev => ({ ...prev, [key]: prev[key].map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) }))
      const addRow = (key, row) => setForm(prev => ({ ...prev, [key]: [...prev[key], row] }))
      const removeRow = (key, index) => setForm(prev => ({ ...prev, [key]: prev[key].filter((_, rowIndex) => rowIndex !== index) }))
      const save = (reassess) => {
        const payload = {
          ...form,
          skills: form.skillsText.split(/[、,，;；\n]/).map(item => item.trim()).filter(Boolean),
          awards: form.awardsText.split(/[、,，;；\n]/).map(item => item.trim()).filter(Boolean),
        }
        delete payload.skillsText
        delete payload.awardsText
        onSave(payload, candidate?.id, reassess)
      }
      return h(Modal, {
        title: mode === 'edit' ? t('candidate.editTitle') : t('candidate.createTitle'),
        onClose,
        width: 'wide',
        dirty,
        footer: [
          h(Button, { key: 'cancel', onClick: onClose }, t('common.cancel')),
          mode === 'edit' ? h(Button, { key: 'reassess', onClick: () => save(true), disabled: busy !== '' }, t('candidate.reassess')) : null,
          h(Button, { key: 'save', variant: 'primary', onClick: () => save(false), disabled: busy !== '' }, t('candidate.save')),
        ],
      },
      h('div', { className: 'tw-grid cols2' },
        h(Field, { label: t('candidate.alias') }, h('input', { className: 'tw-input', value: form.alias, placeholder: '候选人 A', onChange: event => set('alias', event.target.value) })),
        h(Field, { label: t('candidate.realName'), hint: realNameHidden ? t('candidate.realNameHidden') : '仅本机可见；交换包永不包含' }, h('input', { className: 'tw-input', value: form.realName, placeholder: realNameHidden ? t('candidate.realNameHidden') : '', onChange: event => set('realName', event.target.value) })),
        h(Field, { label: t('candidate.major') }, h('input', { className: 'tw-input', value: form.major, onChange: event => set('major', event.target.value) })),
        h(Field, { label: t('candidate.degree') }, h('select', { className: 'tw-select', value: form.degree, onChange: event => set('degree', event.target.value) }, ['博士', '硕士', '本科', '其他'].map(item => h('option', { key: item, value: item }, item)))),
        h(Field, { label: t('candidate.school') }, h('input', { className: 'tw-input', value: form.school, onChange: event => set('school', event.target.value) })),
        h(Field, { label: t('candidate.stage') }, h('input', { className: 'tw-input', value: form.stage, placeholder: '博士四年级', onChange: event => set('stage', event.target.value) })),
        h(Field, { label: t('candidate.direction'), hint: '一句话说明研究方向' }, h('input', { className: 'tw-input', value: form.direction, onChange: event => set('direction', event.target.value) }))),
      h('div', { style: { height: 8 } }),
      h(Field, { label: t('candidate.profileText'), hint: '仅供本机阅读；规则初筛主要使用下方结构化证据' },
        h('textarea', { className: 'tw-textarea', rows: 4, value: form.profileText, onChange: event => set('profileText', event.target.value) })),
      h('div', { style: { height: 8 } }),
      h('div', { className: 'tw-row' }, h('div', { className: 'tw-card-title' }, t('candidate.structured')), h('span', { className: 'tw-small tw-muted' }, '不完整也可以，先保存再逐步补充')),
      h('details', { className: 'tw-details', open: true },
        h('summary', null, `${t('candidate.publications')}（${form.publications.length}）`),
        form.publications.map((row, index) => h('div', { key: index, className: 'tw-grid cols4', style: { marginBottom: 4 } },
          h('select', { className: 'tw-select', value: row.role, onChange: event => updateRow('publications', index, { role: event.target.value }) }, [['first', t('candidate.first')], ['cofirst', t('candidate.cofirst')], ['other', t('candidate.other')]].map(([value, label]) => h('option', { key: value, value }, label))),
          h('select', { className: 'tw-select', value: row.status, onChange: event => updateRow('publications', index, { status: event.target.value }) }, [['published', t('candidate.published')], ['accepted', t('candidate.accepted')], ['review', t('candidate.review')]].map(([value, label]) => h('option', { key: value, value }, label))),
          h('select', { className: 'tw-select', value: row.tier, onChange: event => updateRow('publications', index, { tier: event.target.value }) }, [['top', '顶刊'], ['sci1', '一区'], ['sci2', '二区'], ['ccfA', 'CCF-A'], ['ccfB', 'CCF-B'], ['ccfC', 'CCF-C'], ['ei', 'EI'], ['core', '核心'], ['other', '其他']].map(([value, label]) => h('option', { key: value, value }, label))),
          h('div', { className: 'tw-row' }, h('input', { className: 'tw-input', value: row.venue ?? '', placeholder: t('candidate.venue'), onChange: event => updateRow('publications', index, { venue: event.target.value }) }), h('button', { type: 'button', className: 'tw-btn ghost sm', 'aria-label': '移除该行', onClick: () => removeRow('publications', index) }, h(Icon, { name: 'x', size: 11 }))))),
        h(Button, { size: 'sm', onClick: () => addRow('publications', { role: 'first', status: 'published', tier: 'sci1', venue: '' }) }, h(Icon, { name: 'plus', size: 11 }), t('candidate.addRow'))),
      h('details', { className: 'tw-details' },
        h('summary', null, `${t('candidate.projects')}（${form.projects.length}）`),
        form.projects.map((row, index) => h('div', { key: index, className: 'tw-grid cols4', style: { marginBottom: 4 } },
          h('input', { className: 'tw-input', value: row.name, placeholder: t('candidate.projectName'), onChange: event => updateRow('projects', index, { name: event.target.value }) }),
          h('select', { className: 'tw-select', value: row.role, onChange: event => updateRow('projects', index, { role: event.target.value }) }, [['lead', t('candidate.lead')], ['core', t('candidate.core')], ['participant', t('candidate.participant')]].map(([value, label]) => h('option', { key: value, value }, label))),
          h('select', { className: 'tw-select', value: row.level, onChange: event => updateRow('projects', index, { level: event.target.value }) }, [['national', t('candidate.national')], ['provincial', t('candidate.provincial')], ['enterprise', t('candidate.enterprise')], ['lab', t('candidate.lab')]].map(([value, label]) => h('option', { key: value, value }, label))),
          h('div', { className: 'tw-row' }, h('select', { className: 'tw-select', value: row.validation, onChange: event => updateRow('projects', index, { validation: event.target.value }) }, [['industrial', t('candidate.industrial')], ['pilot', t('candidate.pilot')], ['lab', t('candidate.lab')]].map(([value, label]) => h('option', { key: value, value }, label))), h('button', { type: 'button', className: 'tw-btn ghost sm', 'aria-label': '移除该行', onClick: () => removeRow('projects', index) }, h(Icon, { name: 'x', size: 11 }))))),
        h(Button, { size: 'sm', onClick: () => addRow('projects', { name: '', role: 'core', level: 'lab', validation: 'lab' }) }, h(Icon, { name: 'plus', size: 11 }), t('candidate.addRow'))),
      h('details', { className: 'tw-details' },
        h('summary', null, `${t('candidate.engineering')}（${form.engineering.length}）`),
        form.engineering.map((row, index) => h('div', { key: index, className: 'tw-grid cols3', style: { marginBottom: 4 } },
          h('select', { className: 'tw-select', value: row.kind, onChange: event => updateRow('engineering', index, { kind: event.target.value }) }, [['deployment', t('candidate.deployment')], ['software', t('candidate.software')], ['control', t('candidate.control')], ['integration', t('candidate.integration')], ['field', t('candidate.field')]].map(([value, label]) => h('option', { key: value, value }, label))),
          h('input', { className: 'tw-input', value: row.desc, placeholder: t('candidate.desc'), onChange: event => updateRow('engineering', index, { desc: event.target.value }) }),
          h('button', { type: 'button', className: 'tw-btn ghost sm', 'aria-label': '移除该行', onClick: () => removeRow('engineering', index) }, h(Icon, { name: 'x', size: 11 })))),
        h(Button, { size: 'sm', onClick: () => addRow('engineering', { kind: 'deployment', desc: '' }) }, h(Icon, { name: 'plus', size: 11 }), t('candidate.addRow'))),
      h('details', { className: 'tw-details' },
        h('summary', null, `${t('candidate.theory')}（${form.theory.length}）`),
        form.theory.map((row, index) => h('div', { key: index, className: 'tw-grid cols3', style: { marginBottom: 4 } },
          h('select', { className: 'tw-select', value: row.kind, onChange: event => updateRow('theory', index, { kind: event.target.value }) }, [['first-principles', t('candidate.firstPrinciples')], ['md', t('candidate.md')], ['numerical', t('candidate.numerical')], ['thermodynamics', t('candidate.thermodynamics')], ['ml', t('candidate.ml')], ['other', '其他']].map(([value, label]) => h('option', { key: value, value }, label))),
          h('input', { className: 'tw-input', value: row.desc, placeholder: t('candidate.desc'), onChange: event => updateRow('theory', index, { desc: event.target.value }) }),
          h('button', { type: 'button', className: 'tw-btn ghost sm', 'aria-label': '移除该行', onClick: () => removeRow('theory', index) }, h(Icon, { name: 'x', size: 11 })))),
        h(Button, { size: 'sm', onClick: () => addRow('theory', { kind: 'first-principles', desc: '' }) }, h(Icon, { name: 'plus', size: 11 }), t('candidate.addRow'))),
      h('details', { className: 'tw-details' },
        h('summary', null, `${t('candidate.roles')}（${form.roles.length}）`),
        form.roles.map((row, index) => h('div', { key: index, className: 'tw-grid cols4', style: { marginBottom: 4 } },
          h('input', { className: 'tw-input', value: row.title, placeholder: t('candidate.title'), onChange: event => updateRow('roles', index, { title: event.target.value }) }),
          h('select', { className: 'tw-select', value: row.kind, onChange: event => updateRow('roles', index, { kind: event.target.value }) }, [['party', t('candidate.party')], ['student', t('candidate.student')], ['admin', t('candidate.admin')], ['other', '其他']].map(([value, label]) => h('option', { key: value, value }, label))),
          h('label', { className: 'tw-row tw-small' }, h('input', { type: 'checkbox', checked: row.current === true, onChange: event => updateRow('roles', index, { current: event.target.checked }) }), t('candidate.current')),
          h('button', { type: 'button', className: 'tw-btn ghost sm', 'aria-label': '移除该行', onClick: () => removeRow('roles', index) }, h(Icon, { name: 'x', size: 11 })))),
        h(Button, { size: 'sm', onClick: () => addRow('roles', { title: '', kind: 'student', start: '', end: '', current: false }) }, h(Icon, { name: 'plus', size: 11 }), t('candidate.addRow'))),
      h('div', { className: 'tw-grid cols2', style: { marginTop: 8 } },
        h(Field, { label: t('candidate.skills') }, h('input', { className: 'tw-input', value: form.skillsText, onChange: event => set('skillsText', event.target.value) })),
        h(Field, { label: t('candidate.awards') }, h('input', { className: 'tw-input', value: form.awardsText, onChange: event => set('awardsText', event.target.value) }))),
      h('div', { style: { height: 8 } }),
      h(Field, { label: t('common.notes') }, h('textarea', { className: 'tw-textarea', rows: 2, value: form.notes, onChange: event => set('notes', event.target.value) })))
    }

    function Templates({ state, t, skillMap, rows, draft, setDraft, isDirty, demoMode, onSaveDraft, onDiscardDraft, onGuard, onRequestDelete, call, notify, busy }) {
      const [compareId, setCompareId] = useState('')
      const [showHistory, setShowHistory] = useState(false)
      const [showBias, setShowBias] = useState(true)
      const lastActive = useRef(state.activeTemplateId)
      useEffect(() => {
        const record = state.templates.find(item => item.id === state.activeTemplateId) ?? state.templates[0]
        if (record === undefined) return
        const changed = lastActive.current !== state.activeTemplateId
        lastActive.current = state.activeTemplateId
        if (draft === null) {
          setDraft({ templateId: record.id, isNew: false, definition: JSON.parse(JSON.stringify(record.current)), note: '' })
          return
        }
        if (!changed) return
        if (draft.isNew === true || isDirty === true) return
        setDraft({ templateId: record.id, isNew: false, definition: JSON.parse(JSON.stringify(record.current)), note: '' })
      }, [state.activeTemplateId, draft, isDirty])
      const selectedRecord = draft ? state.templates.find(item => item.id === draft.templateId) ?? null : null
      const template = draft?.definition ?? null
      const bias = computeBias(rows, template, skillMap)
      const totalWeight = (template?.dimensions ?? []).reduce((sum, item) => sum + Number(item.weight || 0), 0) || 1
      const included = new Set((template?.dimensions ?? []).map(item => item.skillId))
      const compareTemplate = state.templates.find(item => item.id === compareId)?.current
      const compareRows = compareTemplate ? computeRows(state.candidates, skillMap, compareTemplate) : []
      const compareMap = new Map(compareRows.map(row => [row.candidateId, row]))
      const patch = (fields) => setDraft(prev => ({ ...prev, definition: { ...prev.definition, ...fields } }))
      const setDimension = (skillId, fields) => {
        setDraft(prev => {
          const dimensions = [...(prev.definition.dimensions ?? [])]
          const index = dimensions.findIndex(item => item.skillId === skillId)
          if (index >= 0) dimensions[index] = { ...dimensions[index], ...fields }
          else dimensions.push({ skillId, weight: 0, gate: false, gateMin: 'mid', ...fields })
          return { ...prev, definition: { ...prev.definition, dimensions } }
        })
      }
      const toggleDimension = (skillId, enabled) => {
        setDraft(prev => {
          const dimensions = [...(prev.definition.dimensions ?? [])]
          const index = dimensions.findIndex(item => item.skillId === skillId)
          if (enabled && index < 0) dimensions.push({ skillId, weight: Math.round((skillMap.get(skillId)?.defaultWeight ?? 10)), gate: false, gateMin: 'mid' })
          if (!enabled && index >= 0) dimensions.splice(index, 1)
          return { ...prev, definition: { ...prev.definition, dimensions } }
        })
      }
      const selectTemplate = (record) => {
        if (record.id === draft?.templateId && draft?.isNew !== true) return
        onGuard(() => setDraft({ templateId: record.id, isNew: false, definition: JSON.parse(JSON.stringify(record.current)), note: '' }))
      }
      const createDraft = () => {
        const dimensions = state.skills.map(record => ({ skillId: record.id, weight: record.current?.defaultWeight ?? 10, gate: false, gateMin: 'mid' }))
        onGuard(() => setDraft({
          templateId: null,
          isNew: true,
          note: '',
          definition: {
            name: '新岗位模板',
            family: 'custom-role',
            description: '',
            dimensions,
            hitMinScore: 0.6,
            decision: { recommend: 78, backup: 60 },
            tieBreak: ['research-focus', 'academic-level', 'research-depth'],
            version: 0,
          },
        }))
      }
      const copyDraft = () => {
        if (!template) return
        onGuard(() => setDraft({
          templateId: null,
          isNew: true,
          note: '',
          definition: { ...JSON.parse(JSON.stringify(template)), name: `${template.name}（副本）`, version: 0 },
        }))
      }
      const resetDraft = () => {
        if (selectedRecord === null) return
        setDraft({ templateId: selectedRecord.id, isNew: false, definition: JSON.parse(JSON.stringify(selectedRecord.current)), note: '' })
        notify('已还原为当前保存版本')
      }
      const save = async () => {
        if (template === null) return
        if (String(template.name).trim() === '') { notify('模板名称不能为空', 'error'); return }
        if ((template.dimensions ?? []).length === 0) { notify('模板至少需要一个考察维度', 'error'); return }
        try { await onSaveDraft() } catch { /* noticed by call */ }
      }
      const restoreVersion = async (version) => {
        if (selectedRecord === null) return
        try {
          const body = await call('template.restore', { templateId: selectedRecord.id, version })
          const record = body?.snapshot?.templates?.find(item => item.id === selectedRecord.id)
          setDraft({ templateId: selectedRecord.id, isNew: false, definition: JSON.parse(JSON.stringify(record?.current ?? template)), note: '' })
          notify(`已以 v${version} 的内容创建新版本`)
        } catch { /* noticed by call */ }
      }
      const setActive = async () => {
        if (draft === null || draft.isNew === true) { notify('请先保存模板，再设为当前模板', 'error'); return }
        await call('settings.update', { activeTemplateId: draft.templateId })
        notify('已设为当前模板；筛选推导将使用该模板')
      }
      const activeTemplateId = state.activeTemplateId
      if (template === null) {
        return h('div', { className: 'tw-grid', style: { gap: 10 } },
          h('div', { className: 'tw-row wrap' },
            h('div', { className: 'tw-card-title', style: { flex: 1 } }, t('template.title')),
            h(Button, { size: 'sm', onClick: createDraft }, h(Icon, { name: 'plus', size: 12 }), t('template.new')),
            h(Button, { size: 'sm', onClick: copyDraft }, h(Icon, { name: 'copy', size: 12 }), t('template.copy'))),
          h(Empty, { title: t('template.createFirst'), action: h(Button, { variant: 'primary', size: 'sm', onClick: createDraft }, t('template.new')) }))
      }
      return h('div', { className: 'tw-grid', style: { gap: 10 } },
        h('div', { className: 'tw-row wrap' },
          h('div', { className: 'tw-card-title', style: { flex: 1 } }, t('template.title')),
          h(Button, { size: 'sm', onClick: createDraft }, h(Icon, { name: 'plus', size: 12 }), t('template.new')),
          h(Button, { size: 'sm', onClick: copyDraft }, h(Icon, { name: 'copy', size: 12 }), t('template.copy'))),
        h('div', { className: 'tw-split' },
          h('div', { className: 'tw-listpane' },
            h('div', { className: 'tw-card pad0', style: { padding: 5 } },
              state.templates.map(record => h('button', {
                key: record.id,
                type: 'button',
                className: `tw-listitem ${draft && record.id === draft.templateId && draft.isNew !== true ? 'active' : ''}`,
                onClick: () => selectTemplate(record),
              },
              h('span', { className: 'name' }, record.current?.name ?? record.id),
              h('span', { className: 'meta' },
                h('span', null, `v${record.currentVersion}`),
                h('span', null, `${record.current?.dimensions?.length ?? 0} 维`),
                h('span', null, record.current?.family ?? ''),
                record.id === activeTemplateId ? h(Badge, { tone: 'success' }, t('template.isActive')) : null)))),
            h('div', { className: 'tw-divider' }),
            h('div', { className: 'tw-small tw-muted' }, t('template.weightHelp'))),
          h('div', { className: 'tw-editpane' },
            isDirty ? h('div', { className: 'tw-info' }, `${t('template.draft')}：${draft.isNew ? t('template.newHint') : t('template.editHint')}`) : null,
            h('div', { className: 'tw-card' },
              h('div', { className: 'tw-grid cols2' },
                h(Field, { label: t('template.name') }, h('input', { className: 'tw-input', value: template.name ?? '', onChange: event => patch({ name: event.target.value }) })),
                h(Field, { label: t('template.family'), hint: '小写英文与连字符，用于匿名聚合' }, h('input', { className: 'tw-input', value: template.family ?? '', onChange: event => patch({ family: event.target.value }) }))),
              h('div', { style: { height: 6 } }),
              h(Field, { label: t('template.description') }, h('textarea', { className: 'tw-textarea', rows: 2, value: template.description ?? '', onChange: event => patch({ description: event.target.value }) })),
              h('div', { style: { height: 6 } }),
              h('div', { className: 'tw-grid cols2' },
                h(Field, { label: t('template.focusIndustry'), hint: t('template.focusIndustryHint') },
                  h('input', {
                    className: 'tw-input',
                    value: template.focus?.industry ?? '',
                    onChange: event => patch({ focus: { ...(template.focus ?? {}), industry: event.target.value } }),
                  })),
                h(Field, { label: t('template.focusKeywords'), hint: t('template.focusKeywordsHint') },
                  h('input', {
                    className: 'tw-input',
                    value: (template.focus?.keywords ?? []).join('、'),
                    onChange: event => patch({
                      focus: {
                        ...(template.focus ?? {}),
                        keywords: event.target.value.split(/[、,，;；\s]+/).map(item => item.trim()).filter(Boolean),
                      },
                    }),
                  }))),
              h('div', { className: 'tw-divider' }),
              h('div', { className: 'tw-row' },
                h('div', { className: 'tw-card-title' }, t('template.dimensions')),
                h('div', { className: 'tw-spacer' }),
                h(Badge, { tone: 'idle' }, `${t('template.weightSum')} ${Math.round(totalWeight)}`)),
              h('div', { className: 'tw-small tw-muted', style: { marginBottom: 4 } }, t('template.weightHelp')),
              state.skills.map(record => {
                const dimension = (template.dimensions ?? []).find(item => item.skillId === record.id)
                const enabled = included.has(record.id)
                const normalized = enabled ? Math.round(Number(dimension.weight) / totalWeight * 100) : 0
                const skill = record.current
                const biasItem = bias.find(item => item.skillId === record.id)
                const flagged = enabled && biasItem !== undefined && biasItem.flags.length > 0
                return h('div', { key: record.id, className: 'tw-weight-row' },
                  h('label', { className: 'name' },
                    h('input', { type: 'checkbox', checked: enabled, onChange: event => toggleDimension(record.id, event.target.checked) }),
                    skill?.name ?? record.id,
                    flagged ? h('span', { className: 'tw-flagdot', title: biasItem.flags.join(' ') }) : null),
                  enabled ? h('input', {
                    type: 'range', min: 0, max: 100, step: 1, value: dimension.weight,
                    'aria-label': `${skill?.name ?? record.id} 权重`,
                    onChange: event => setDimension(record.id, { weight: Number(event.target.value) }),
                  }) : h('span', { className: 'tw-small tw-muted', style: { flex: 1 } }, '—'),
                  enabled ? h('input', { className: 'tw-input winput', type: 'number', min: 0, max: 100, value: dimension.weight, 'aria-label': `${skill?.name ?? record.id} 权重数值`, onChange: event => setDimension(record.id, { weight: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }) }) : null,
                  h('span', { className: 'pct' }, enabled ? `${normalized}%` : '0%'),
                  enabled ? h('label', { className: 'tw-row tw-small', style: { gap: 3 } }, h('input', { type: 'checkbox', checked: dimension.gate === true, onChange: event => setDimension(record.id, { gate: event.target.checked }) }), t('template.gate')) : null,
                  enabled && dimension.gate ? h('select', { className: 'tw-select', style: { width: 70 }, 'aria-label': `${skill?.name ?? record.id} 门槛`, value: dimension.gateMin, onChange: event => setDimension(record.id, { gateMin: event.target.value }) }, (skill?.scale ?? []).map(level => h('option', { key: level.value, value: level.value }, level.label))) : null)
              }),
              h('div', { className: 'tw-divider' }),
              h('div', { className: 'tw-grid cols3' },
                h(Field, { label: t('template.hitLine') }, h('input', { className: 'tw-input', type: 'number', min: 0.2, max: 1, step: 0.05, value: template.hitMinScore ?? 0.6, onChange: event => patch({ hitMinScore: Math.max(0, Math.min(1, Number(event.target.value) || 0)) }) })),
                h(Field, { label: t('template.recommendLine') }, h('input', { className: 'tw-input', type: 'number', min: 0, max: 100, value: template.decision?.recommend ?? 78, onChange: event => patch({ decision: { ...template.decision, recommend: Number(event.target.value) || 0 } }) })),
                h(Field, { label: t('template.backupLine') }, h('input', { className: 'tw-input', type: 'number', min: 0, max: 100, value: template.decision?.backup ?? 60, onChange: event => patch({ decision: { ...template.decision, backup: Number(event.target.value) || 0 } }) }))),
              h('div', { style: { height: 6 } }),
              h('div', { className: 'tw-row wrap' },
                h('input', { className: 'tw-input', style: { flex: '1 1 180px' }, placeholder: t('template.versionNote'), 'aria-label': t('template.versionNote'), value: draft.note ?? '', onChange: event => setDraft({ ...draft, note: event.target.value }) }),
                h(Button, { variant: 'primary', onClick: save, disabled: busy !== '' }, t('template.saveVersion')),
                h(Button, { variant: 'ghost', onClick: resetDraft, disabled: busy !== '' || selectedRecord === null }, t('common.reset')),
                draft.isNew !== true ? h(Button, { variant: 'soft', onClick: setActive, disabled: busy !== '' || selectedRecord === null || selectedRecord.id === activeTemplateId }, t('template.setActive')) : null,
                selectedRecord ? h(Button, { variant: 'danger', onClick: () => onRequestDelete(selectedRecord.id, selectedRecord.current?.name ?? selectedRecord.id), disabled: busy !== '' }, t('template.delete')) : null,
                selectedRecord ? h(Button, { variant: 'ghost', onClick: () => setShowHistory(prev => !prev) }, t('template.history')) : null)),
            showHistory && selectedRecord ? h('div', { className: 'tw-card' },
              h('div', { className: 'tw-card-head' }, h('div', { className: 'tw-card-title' }, t('template.history')), h('div', { className: 'tw-small tw-muted' }, t('template.historyHint'))),
              selectedRecord.versions.slice().reverse().map(version => h('div', { key: version.version, className: 'tw-version' },
                h('span', { className: 'v' }, `v${version.version}`),
                h('span', { className: 'note' }, version.note),
                h('span', { className: 'tw-small tw-muted' }, new Date(version.createdAt).toLocaleString()),
                h('span', { className: 'tw-small tw-muted' }, (version.weights ?? []).map(item => `${item.name} ${item.share}%`).join(' · ')),
                version.version !== selectedRecord.currentVersion ? h(Button, { size: 'sm', onClick: () => restoreVersion(version.version), disabled: busy !== '' }, t('common.restore')) : h(Badge, { tone: 'success' }, t('common.current'))))) : null,
            h('div', { className: 'tw-card' },
              h('div', { className: 'tw-card-head' }, h('div', { className: 'tw-card-title' }, t('template.livePreview')), h('div', { className: 'tw-small tw-muted' }, `${rows.length} 人 · 推荐 ${rows.filter(row => row.decision === 'recommend').length}${demoMode ? ` · ${t('demo.short')}` : ''}`)),
              h('div', { className: 'tw-table-wrap' },
                h('table', { className: 'tw-table', style: { minWidth: 460 } },
                  h('thead', null, h('tr', null, h('th', null, t('common.rank')), h('th', null, '候选人'), h('th', null, t('common.major')), h('th', { className: 'num' }, t('common.score')), h('th', null, t('common.decision')))),
                  h('tbody', null, rows.slice(0, 8).map(row => {
                    const meta = decisionMeta(row.decision, t)
                    return h('tr', { key: row.candidateId }, h('td', { className: 'num' }, row.rank), h('td', null, row.alias), h('td', null, row.major), h('td', { className: 'num' }, row.total), h('td', null, h(Badge, { tone: meta.tone }, meta.label)))
                  })))),
              h('div', { className: 'tw-divider' }),
              h('div', { className: 'tw-small tw-muted' }, t('template.majorMix')),
              h('div', { className: 'tw-chips', style: { marginTop: 4 } }, majorMix(rows, 'recommend').map(item => h('span', { key: item.major, className: 'tw-chip' }, `${item.major} ${Math.round(item.share * 100)}%`)))),
            h('div', { className: 'tw-card' },
              h('div', { className: 'tw-card-head' },
                h('div', { className: 'tw-card-title' }, t('template.bias')),
                h(Button, { size: 'sm', onClick: () => setShowBias(prev => !prev) }, showBias ? t('common.hide') : t('common.show'))),
              showBias ? h(DiagnosticTable, { t, rows, bias, template }) : null),
            h('div', { className: 'tw-card' },
              h('div', { className: 'tw-card-head' }, h('div', { className: 'tw-card-title' }, t('template.compare')), h('div', { className: 'tw-small tw-muted' }, t('template.compareHint'))),
              h('select', { className: 'tw-select', style: { maxWidth: 280 }, 'aria-label': t('template.compare'), value: compareId, onChange: event => setCompareId(event.target.value) },
                h('option', { value: '' }, t('common.none')),
                state.templates.filter(item => draft === null || item.id !== draft.templateId).map(item => h('option', { key: item.id, value: item.id }, `${item.current?.name ?? item.id} · v${item.currentVersion}`))),
              compareTemplate ? h('div', { className: 'tw-table-wrap', style: { marginTop: 6 } },
                h('table', { className: 'tw-table', style: { minWidth: 420 } },
                  h('thead', null, h('tr', null, h('th', null, '候选人'), h('th', { className: 'num' }, t('template.rankA')), h('th', { className: 'num' }, t('template.rankB')), h('th', { className: 'num' }, t('template.delta')))),
                  h('tbody', null, rows.map(row => {
                    const other = compareMap.get(row.candidateId)
                    const delta = (row.rank ?? 0) - (other?.rank ?? 0)
                    return h('tr', { key: row.candidateId }, h('td', null, row.alias), h('td', { className: 'num' }, row.rank), h('td', { className: 'num' }, other?.rank ?? '—'), h('td', { className: 'num' }, delta === 0 ? '—' : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`))
                  })))) : null))))
    }

    function DiagnosticTable({ t, rows, bias, template }) {
      const total = rows.length || 1
      return h('div', { className: 'tw-grid', style: { gap: 6 } },
        h('div', { className: 'tw-hint' }, t('template.biasHelp')),
        h('div', { className: 'tw-table-wrap' },
          h('table', { className: 'tw-table', style: { minWidth: 520 } },
            h('thead', null, h('tr', null,
              h('th', null, t('template.colDimension')),
              h('th', { className: 'num' }, t('template.colWeight')),
              h('th', { className: 'num' }, t('template.colHits')),
              h('th', null, t('template.colDominant')),
              h('th', { className: 'num' }, t('template.colContribution')),
              h('th', null, t('template.colSignal')))),
            h('tbody', null, bias.map(item => h('tr', { key: item.skillId },
              h('td', { className: 'nowrap' }, item.name),
              h('td', { className: 'num' }, `${Math.round(item.weight * 100)}%`),
              h('td', { className: 'num' }, `${item.passCount}/${total}`),
              h('td', null, item.dominantMajor ?? '—'),
              h('td', { className: 'num' }, item.dominantCount === 0 ? '—' : `${item.dominantCount} 人`),
              h('td', null, item.flags.length === 0
                ? h('span', { className: 'tw-small tw-muted' }, '—')
                : h('div', { className: 'tw-chips' }, item.flags.map((flag, index) => h('span', { key: index, className: 'tw-chip warn' }, flag))))))))),
        bias.filter(item => item.flags.length > 0).length === 0
          ? h('div', { className: 'tw-small tw-muted' }, t('template.noBias'))
          : null)
    }

    function Skills({ state, t, onOpenSkill, onCopySkill, busy }) {
      return h('div', { className: 'tw-grid', style: { gap: 9 } },
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-card-title' }, t('skill.title')),
          h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, t('skill.subtitle')),
          h('div', { className: 'tw-info', style: { marginTop: 6 } }, '每个维度技能都已经注册到 DSH 技能目录，智能体可以用 skill 工具加载完整规范；本地数据库保留版本历史。')),
        h('div', { className: 'tw-skillgrid' },
          state.skills.map(record => {
            const skill = record.current
            return h('button', { key: record.id, type: 'button', className: 'tw-skillcard', onClick: () => onOpenSkill(record) },
              h('div', { className: 'top' },
                h('span', { className: 'idx' }, skill?.order ?? ''),
                h('span', { className: 'nm' }, skill?.name ?? record.id)),
              h('div', { className: 'desc' }, skill?.description ?? ''),
              h('div', { className: 'chips' }, (skill?.scale ?? []).map(level => h('span', { key: level.value, className: 'tw-chip' }, level.label))),
              h('div', { className: 'foot' },
                h(Badge, { tone: 'brand' }, `v${record.currentVersion}`),
                h('span', null, `${t('skill.defaultWeight')} ${skill?.defaultWeight ?? '—'}`),
                h('span', { className: 'tw-spacer' }),
                h(Icon, { name: 'chevron', size: 12 })))
          })))
    }

    function SkillModal({ t, skill, onClose, onSave, onRestore, onCopy, busy }) {
      const current = skill.current
      const [editing, setEditing] = useState(false)
      const [form, setForm] = useState(() => ({
        name: current?.name ?? '',
        shortName: current?.shortName ?? '',
        description: current?.description ?? '',
        whenToUse: current?.whenToUse ?? '',
        defaultWeight: current?.defaultWeight ?? 10,
        methodText: (current?.method ?? []).join('\n'),
        evidenceText: (current?.evidence ?? []).join('\n'),
        redFlagsText: (current?.redFlags ?? []).join('\n'),
        probesText: (current?.probes ?? []).join('\n'),
        output: current?.output ?? '',
        antiBias: current?.antiBias ?? '',
        calibration: current?.calibration ?? '',
        scale: (current?.scale ?? []).map(level => ({ ...level })),
        note: '',
      }))
      const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))
      const [baseline] = useState(() => JSON.stringify(form))
      const dirty = JSON.stringify(form) !== baseline
      const updateScale = (index, patch) => setForm(prev => ({ ...prev, scale: prev.scale.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row) }))
      const save = () => {
        onSave(skill.id, {
          name: form.name,
          shortName: form.shortName,
          description: form.description,
          whenToUse: form.whenToUse,
          defaultWeight: Number(form.defaultWeight) || 0,
          method: form.methodText.split('\n').map(item => item.trim()).filter(Boolean),
          evidence: form.evidenceText.split('\n').map(item => item.trim()).filter(Boolean),
          redFlags: form.redFlagsText.split('\n').map(item => item.trim()).filter(Boolean),
          probes: form.probesText.split('\n').map(item => item.trim()).filter(Boolean),
          output: form.output,
          antiBias: form.antiBias,
          calibration: form.calibration,
          scale: form.scale.map((level, index) => ({ value: level.value || `level-${index + 1}`, label: level.label, score: Number(level.score) || 0, definition: level.definition })),
          note: form.note,
        }, form.note)
      }
      if (editing) {
        return h(Modal, {
          title: `${t('skill.edit')} · ${current?.name ?? skill.id}`,
          onClose,
          width: 'wide',
          dirty,
          footer: [
            h(Button, { key: 'cancel', onClick: () => setEditing(false) }, t('common.cancel')),
            h(Button, { key: 'save', variant: 'primary', onClick: save, disabled: busy !== '' }, t('skill.save')),
          ],
        },
        h('div', { className: 'tw-info' }, t('skill.editHint')),
        h('div', { className: 'tw-grid cols2', style: { marginTop: 6 } },
          h(Field, { label: '名称' }, h('input', { className: 'tw-input', value: form.name, onChange: event => set('name', event.target.value) })),
          h(Field, { label: '简称' }, h('input', { className: 'tw-input', value: form.shortName, onChange: event => set('shortName', event.target.value) })),
          h(Field, { label: '默认权重' }, h('input', { className: 'tw-input', type: 'number', min: 0, max: 100, value: form.defaultWeight, onChange: event => set('defaultWeight', event.target.value) })),
          h(Field, { label: '版本说明' }, h('input', { className: 'tw-input', value: form.note, onChange: event => set('note', event.target.value) }))),
        h(Field, { label: '考察目标' }, h('textarea', { className: 'tw-textarea', rows: 2, value: form.description, onChange: event => set('description', event.target.value) })),
        h(Field, { label: '何时使用' }, h('textarea', { className: 'tw-textarea', rows: 2, value: form.whenToUse, onChange: event => set('whenToUse', event.target.value) })),
        h('div', { className: 'tw-grid cols2' },
          h(Field, { label: `考察方法（${t('skill.lineHint')}）` }, h('textarea', { className: 'tw-textarea', rows: 5, value: form.methodText, onChange: event => set('methodText', event.target.value) })),
          h(Field, { label: `证据清单（${t('skill.lineHint')}）` }, h('textarea', { className: 'tw-textarea', rows: 5, value: form.evidenceText, onChange: event => set('evidenceText', event.target.value) })),
          h(Field, { label: `反偏差（${t('skill.lineHint')}）` }, h('textarea', { className: 'tw-textarea', rows: 4, value: form.redFlagsText, onChange: event => set('redFlagsText', event.target.value) })),
          h(Field, { label: `面试追问（${t('skill.lineHint')}）` }, h('textarea', { className: 'tw-textarea', rows: 4, value: form.probesText, onChange: event => set('probesText', event.target.value) }))),
        h(Field, { label: '输出格式' }, h('textarea', { className: 'tw-textarea', rows: 2, value: form.output, onChange: event => set('output', event.target.value) })),
        h(Field, { label: '反偏差说明' }, h('textarea', { className: 'tw-textarea', rows: 3, value: form.antiBias, onChange: event => set('antiBias', event.target.value) })),
        h(Field, { label: '校准建议' }, h('textarea', { className: 'tw-textarea', rows: 2, value: form.calibration, onChange: event => set('calibration', event.target.value) })),
        h('div', { className: 'tw-card-title', style: { marginTop: 8 } }, t('skill.scale')),
        form.scale.map((level, index) => h('div', { key: index, className: 'tw-scale-row' },
          h('input', { className: 'tw-input', value: level.label, placeholder: '标签', onChange: event => updateScale(index, { label: event.target.value }) }),
          h('input', { className: 'tw-input', type: 'number', min: 0, max: 1, step: 0.05, value: level.score, onChange: event => updateScale(index, { score: event.target.value }) }),
          h('input', { className: 'tw-input', value: level.definition, placeholder: '判定口径', onChange: event => updateScale(index, { definition: event.target.value }) }),
          h('button', { type: 'button', className: 'tw-btn ghost sm', 'aria-label': '删除该分级', onClick: () => setForm(prev => ({ ...prev, scale: prev.scale.filter((_, rowIndex) => rowIndex !== index) })) }, h(Icon, { name: 'x', size: 11 })))),
        h(Button, { size: 'sm', onClick: () => setForm(prev => ({ ...prev, scale: [...prev.scale, { value: `level-${prev.scale.length + 1}`, label: '', score: 0.5, definition: '' }] })) }, h(Icon, { name: 'plus', size: 11 }), '添加分级'))
      }
      return h(Modal, {
        title: `${current?.name ?? skill.id} · v${skill.currentVersion}`,
        onClose,
        width: 'wide',
        footer: [
          h(Button, { key: 'copy', onClick: () => onCopy(skill) }, t('skill.copy')),
          h(Button, { key: 'edit', variant: 'primary', onClick: () => setEditing(true) }, t('skill.edit')),
        ],
      },
      h('div', { className: 'tw-row wrap' },
        h(Badge, { tone: 'success' }, t('skill.registered')),
        h(Badge, { tone: 'brand' }, current?.key ?? ''),
        h(Badge, { tone: 'idle' }, `${t('skill.defaultWeight')} ${current?.defaultWeight ?? '—'}`)),
      h('div', { className: 'tw-grid', style: { gap: 8, marginTop: 8 } },
        h('div', { className: 'tw-card' }, h('div', { className: 'tw-card-title' }, t('skill.objective')), h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, current?.description ?? '')),
        h('div', { className: 'tw-card' }, h('div', { className: 'tw-card-title' }, t('skill.when')), h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, current?.whenToUse ?? '')),
        h('div', { className: 'tw-card' }, h('div', { className: 'tw-card-title' }, t('skill.method')), h('ol', { style: { margin: '5px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.6 } }, (current?.method ?? []).map((item, index) => h('li', { key: index }, item)))),
        h('div', { className: 'tw-card' }, h('div', { className: 'tw-card-title' }, t('skill.evidence')), h('ul', { style: { margin: '5px 0 0', paddingLeft: 16, fontSize: 13, lineHeight: 1.6 } }, (current?.evidence ?? []).map((item, index) => h('li', { key: index }, item)))),
        h('div', { className: 'tw-card' }, h('div', { className: 'tw-card-title' }, t('skill.scale')),
          h('div', { className: 'tw-table-wrap', style: { marginTop: 4 } }, h('table', { className: 'tw-table', style: { minWidth: 340 } },
            h('thead', null, h('tr', null, h('th', null, '等级'), h('th', { className: 'num' }, '分值'), h('th', null, '判定口径'))),
            h('tbody', null, (current?.scale ?? []).map(level => h('tr', { key: level.value }, h('td', null, h(Badge, { tone: levelTone(level.value) }, level.label)), h('td', { className: 'num' }, level.score), h('td', null, level.definition))))))),
        h('div', { className: 'tw-card' }, h('div', { className: 'tw-card-title' }, t('skill.antiBias')), h('div', { className: 'tw-small tw-muted', style: { marginTop: 3, whiteSpace: 'pre-wrap' } }, current?.antiBias ?? '')),
        h('div', { className: 'tw-card' }, h('div', { className: 'tw-card-title' }, t('skill.probes')), h('ul', { style: { margin: '5px 0 0', paddingLeft: 16, fontSize: 13, lineHeight: 1.6 } }, (current?.probes ?? []).map((item, index) => h('li', { key: index }, item)))),
        h('div', { className: 'tw-card' }, h('div', { className: 'tw-card-title' }, t('skill.calibration')), h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, current?.calibration ?? '')),
        h('div', { className: 'tw-card' }, h('div', { className: 'tw-card-title' }, t('skill.history')),
          skill.versions.slice().reverse().map(version => h('div', { key: version.version, className: 'tw-version' },
            h('span', { className: 'v' }, `v${version.version}`),
            h('span', { className: 'note' }, version.note),
            h('span', { className: 'tw-small tw-muted' }, new Date(version.createdAt).toLocaleString()),
            version.version !== skill.currentVersion ? h(Button, { size: 'sm', onClick: () => onRestore(skill.id, version.version) }, t('common.restore')) : h(Badge, { tone: 'success' }, t('common.current')))))))
    }

    function Exchange({ state, t, call, notify, busy }) {
      const [preview, setPreview] = useState(null)
      const [importText, setImportText] = useState('')
      const [suggestions, setSuggestions] = useState(null)
      const [expandedLedger, setExpandedLedger] = useState('')
      const [importing, setImporting] = useState(false)
      const loadPreview = async () => {
        try {
          const body = await apiFetch('/preview-pack')
          setPreview(body.pack)
          notify('已生成交换包预览（未写入账本）')
        } catch (err) { notify(String(err?.message ?? err), 'error') }
      }
      const loadDemoPeer = async () => {
        try {
          const body = await call('exchange.demoPeer', {})
          setSuggestions(body.suggestions ?? null)
          notify('已载入演示同行包（虚构样本），下方是协同进化建议')
        } catch { /* noticed by call */ }
      }
      const exportPack = async () => {
        const body = await call('exchange.export', {})
        setPreview(body.pack)
        downloadText(`talent-exchange-${Date.now()}.json`, JSON.stringify(body.pack, null, 2))
        notify(body.warning
          ? `已写入本地账本 #${body.ledgerIndex} 并下载交换包。注意：${body.warning}`
          : `已写入本地账本 #${body.ledgerIndex} 并下载交换包`, body.warning ? 'warn' : 'ok')
      }
      const importPack = async () => {
        if (importText.trim() === '') { notify('请先粘贴或选择交换包 JSON', 'error'); return }
        setImporting(true)
        try {
          const parsed = JSON.parse(importText)
          const body = await call('exchange.import', { pack: parsed })
          setSuggestions(body.suggestions ?? null)
          notify(body.duplicate ? t('exchange.duplicate') : body.selfEcho ? t('exchange.selfEcho') : '已导入匿名交换包')
        } catch {
          /* call() already surfaced the failure */
        } finally {
          setImporting(false)
        }
      }
      const verify = async () => {
        const body = await call('exchange.verify', {})
        notify(body.verify.ok ? `账本校验通过（${body.verify.length} 条）` : `账本校验失败：${body.verify.issues.join('；')}`, body.verify.ok ? 'ok' : 'error')
      }
      const ledger = state.exchange.ledger ?? []
      const peersCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-title' }, t('exchange.peers')),
        state.exchange.peers.count === 0
          ? h('div', { className: 'tw-small tw-muted', style: { marginTop: 4 } }, t('exchange.noPeers'))
          : h('div', { className: 'tw-grid', style: { gap: 4, marginTop: 4 } },
            state.exchange.peers.entries.map(peer => h('div', { key: peer.hash, className: 'tw-row' },
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('div', { className: 'tw-small tw-mono' }, peer.contributor),
                h('div', { className: 'tw-small tw-muted' }, `${peer.families.join(', ')} · 样本 ${peer.sampleBucket} · ${new Date(peer.importedAt).toLocaleString()}`)),
              h(Badge, { tone: 'idle' }, `${peer.dimensions} 维`)))))
      const ledgerCard = h('div', { className: 'tw-card' },
        h('div', { className: 'tw-card-title' }, t('exchange.ledger')),
        h('div', { className: 'tw-small tw-muted', style: { marginTop: 2 } }, `${t('exchange.lastHash')}: ${state.exchange.verify.lastHash ? `${state.exchange.verify.lastHash.slice(0, 16)}…` : '—'}`),
        h('div', { style: { marginTop: 4 } }, ledger.slice().reverse().map(entry => h('div', { key: entry.index },
          h('div', { className: 'tw-ledger-row' },
            h('span', { className: 'idx' }, `#${entry.index}`),
            h('span', null, h(Badge, { tone: entry.kind === 'genesis' ? 'idle' : entry.kind === 'import' ? 'warn' : 'brand' }, entry.kind)),
            h('span', { className: 'hash' }, entry.hash),
            h('button', { type: 'button', className: 'tw-btn ghost sm', onClick: () => setExpandedLedger(prev => prev === entry.hash ? '' : entry.hash) }, expandedLedger === entry.hash ? '收起' : '载荷')),
          expandedLedger === entry.hash ? h('pre', { className: 'tw-code', style: { marginBottom: 5 } }, JSON.stringify(entry.payload, null, 2)) : null))),
        h('div', { className: 'tw-small tw-muted', style: { marginTop: 6 } }, t('exchange.prototype')))
      return h('div', { className: 'tw-grid', style: { gap: 10 } },
        h('div', { className: 'tw-hero' },
          h('h2', null, t('exchange.title')),
          h('p', null, t('exchange.subtitle')),
          h('div', { className: 'tw-row wrap', style: { marginTop: 6 } },
            h(Badge, { tone: 'success' }, h(Icon, { name: 'shield', size: 11 }), t('exchange.localOnly')),
            h(Badge, { tone: 'brand' }, `${t('exchange.chainLength')} ${state.exchange.chainLength}`),
            h(Badge, { tone: state.exchange.verify.ok ? 'success' : 'error' }, state.exchange.verify.ok ? t('exchange.verified') : t('exchange.broken')),
            h(Button, { size: 'sm', onClick: verify }, h(Icon, { name: 'check', size: 11 }), t('exchange.verify')))),
        h('div', { className: 'tw-grid cols2' },
          h('div', { className: 'tw-card' },
            h('div', { className: 'tw-card-title' }, t('exchange.exportTitle')),
            h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, t('exchange.exportBody')),
            h('div', { className: 'tw-info', style: { marginTop: 6 } }, `${t('exchange.privacyChecks')}：${t('exchange.privacyFields')}`),
            state.stats.candidates < 5 ? h('div', { className: 'tw-warning' }, t('exchange.kAnonymity')) : null,
            h('div', { className: 'tw-row wrap', style: { marginTop: 6 } },
              h(Button, { size: 'sm', onClick: loadPreview, disabled: busy !== '' }, t('exchange.preview')),
              h(Button, { size: 'sm', variant: 'primary', onClick: exportPack, disabled: busy !== '' }, h(Icon, { name: 'download', size: 12 }), t('exchange.export'))),
            preview ? h('div', { style: { marginTop: 6 } },
              h('div', { className: 'tw-row wrap' },
                h(Badge, { tone: 'brand' }, `样本 ${preview.sample.bucket}`),
                h(Badge, { tone: 'idle' }, `${preview.dimensions.length} 维`),
                h(Badge, { tone: 'idle' }, `${preview.templates.length} 模板`)),
              h('details', { className: 'tw-details' }, h('summary', null, '预览 JSON'), h('pre', { className: 'tw-code' }, JSON.stringify(preview, null, 2)))) : null),
          h('div', { className: 'tw-card' },
            h('div', { className: 'tw-card-title' }, t('exchange.importTitle')),
            h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, t('exchange.importBody')),
            h('textarea', { className: 'tw-textarea', rows: 6, style: { marginTop: 6 }, placeholder: t('exchange.importPlaceholder'), 'aria-label': t('exchange.importTitle'), value: importText, onChange: event => setImportText(event.target.value) }),
            h('div', { className: 'tw-row wrap', style: { marginTop: 6 } },
              h('label', { className: 'tw-btn sm', style: { cursor: 'pointer' } }, h(Icon, { name: 'upload', size: 12 }), t('exchange.file'), h('input', { type: 'file', accept: '.json,application/json', className: 'tw-sr', onChange: async event => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                try { setImportText(await readTextFile(file)) } catch (err) { notify(String(err?.message ?? err), 'error') }
              } })),
              h(Button, { size: 'sm', variant: 'primary', onClick: importPack, disabled: importing || busy !== '' }, t('exchange.import')),
              h(Button, { size: 'sm', onClick: loadDemoPeer, disabled: busy !== '' }, t('exchange.demoPeer'))))),
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-card-head' }, h('div', { className: 'tw-card-title' }, t('exchange.suggestions')), h(Button, { size: 'sm', onClick: () => setSuggestions(null) }, '清空')),
          suggestions === null ? h('div', { className: 'tw-small tw-muted' }, t('exchange.noSuggestions')) : h('div', { className: 'tw-grid', style: { gap: 6 } },
            (suggestions.weightSuggestions ?? []).map(item => h('div', { key: item.templateId, className: 'tw-card', style: { padding: 8 } },
              h('div', { className: 'tw-row' }, h('div', { className: 'tw-card-title' }, item.templateName), h('div', { className: 'tw-spacer' }), h(Badge, { tone: 'brand' }, `${item.sources} 个来源`)),
              h('div', { className: 'tw-small tw-muted' }, item.reason),
              h('div', { className: 'tw-chips', style: { marginTop: 4 } }, item.dimensions.map(dimension => h('span', { key: dimension.skillId, className: 'tw-chip' }, `${skillName(state, dimension.skillId)} ${dimension.direction === 'up' ? '↑' : '↓'} ${Math.round(Math.abs(dimension.delta) * 100)}%`))),
              h('div', { style: { marginTop: 5 } }, h(Button, { size: 'sm', variant: 'primary', onClick: async () => {
                await call('exchange.applyWeights', { templateId: item.templateId, weights: item.suggestedWeights, note: '应用匿名交换建议' })
                notify('已应用建议并生成模板新版本')
              } }, t('exchange.applySuggestion')))),
            (suggestions.dimensionSuggestions ?? []).map(item => h('div', { key: item.skillId, className: 'tw-warning' }, `${skillName(state, item.skillId)}：${item.reason}（均值 ${item.meanScore} / 推荐组均值 ${item.successMean}）`)))),
        h('div', { className: 'tw-grid cols2' },
          peersCard,
          ledgerCard)))
    }

    function skillName(state, skillId) {
      return state.skills.find(item => item.id === skillId)?.current?.name ?? skillId
    }

    const AUDIT_LABELS = {
      'candidate.create': '新增候选人',
      'candidate.update': '修改候选人',
      'candidate.delete': '删除候选人',
      'candidate.autoAssess': '重新规则初筛',
      'assessment.set': '人工复核判级',
      'template.create': '新建模板',
      'template.update': '保存模板版本',
      'template.restore': '回溯模板版本',
      'template.delete': '删除模板',
      'skill.update': '发布维度新版本',
      'skill.restore': '回溯维度版本',
      'skill.copy': '复制维度',
      'run.create': '生成筛选快照',
      'run.delete': '删除筛选快照',
      'exchange.export': '导出匿名交换包',
      'exchange.import': '导入匿名交换包',
      'identity.rotate': '更换匿名实例',
      'backup.import': '导入完整备份',
    }

    function auditLabel(action) {
      return AUDIT_LABELS[action] ?? action
    }

    function Data({ state, t, call, notify, busy, load }) {
      const [resetText, setResetText] = useState('')
      const [refreshPreview, setRefreshPreview] = useState(null)
      const [agentPreview, setAgentPreview] = useState(null)
      const agentRows = agentPreview === null ? [] : (agentPreview.plan ?? []).flatMap((row) => {
        const entries = Object.entries(row.changes)
        const evidence = Object.entries(row.evidence ?? {}).map(([key, value]) => [key, { from: '(空)', to: `补录 ${value.length} 条` }])
        const all = [...entries, ...evidence]
        return all.map(([field, change], index) => h('tr', { key: row.candidateId + field },
          h('td', { className: 'nowrap' }, index === 0 ? row.alias : ''),
          h('td', { className: 'tw-small tw-muted' }, index === 0 ? `${row.confidence === null ? '' : '把握 ' + Math.round(row.confidence * 100) + '%'}` : ''),
          h('td', { className: 'nowrap' }, field),
          h('td', { className: 'tw-small tw-muted' }, change.from || '(空)'),
          h('td', null, h(Badge, { tone: 'brand' }, change.to))))
      })
      const refreshRows = refreshPreview === null ? [] : refreshPreview.candidates.flatMap((row) =>
        Object.entries(row.changes).map(([field, change], index) => h('tr', { key: row.candidateId + field },
          h('td', { className: 'nowrap' }, index === 0 ? row.alias : ''),
          h('td', { className: 'tw-small tw-muted', style: { wordBreak: 'break-all' } }, index === 0 ? row.sourceFile : ''),
          h('td', { className: 'nowrap' }, field),
          h('td', { className: 'tw-small tw-muted' }, change.from || '(空)'),
          h('td', null, h(Badge, { tone: 'brand' }, change.to)))))
      const [importText, setImportText] = useState('')
      const [confirmText, setConfirmText] = useState('')
      return h('div', { className: 'tw-grid', style: { gap: 14 } },
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-card-head' },
            h('div', null,
              h('div', { className: 'tw-card-title' }, t('data.title')),
              h('div', { className: 'tw-card-sub' }, t('data.subtitle'))),
            h(Badge, { tone: 'brand' }, h(Icon, { name: 'shield', size: 11 }), t('app.local'))),
          h('div', { className: 'tw-small tw-muted' }, t('data.showSamples')),
          h('div', { className: 'tw-grid cols2', style: { marginTop: 10 } },
            h(Field, { label: t('data.path') }, h('div', { className: 'tw-mono', style: { wordBreak: 'break-all' } }, state.dataDir)),
            h(Field, { label: t('data.instance') }, h('div', { className: 'tw-mono', style: { wordBreak: 'break-all' } }, state.instance.contributorId)),
            h(Field, { label: t('data.counts') }, h('div', { className: 'tw-small' }, `候选人 ${state.stats.candidates} · 模板 ${state.stats.templates} · 维度 ${state.stats.skills} · 快照 ${state.stats.runs} · 账本 ${state.stats.ledgerLength}`)))),
        h('div', { className: 'tw-grid cols2' },
          h('div', { className: 'tw-card' },
            h('div', { className: 'tw-card-title' }, t('data.showRealNames')),
            h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, t('data.showRealNamesHint')),
            h('div', { className: 'tw-row', style: { marginTop: 8 } },
              h('input', { type: 'checkbox', disabled: state.privacy?.allowRealNames !== true, checked: state.settings.showRealNames === true, onChange: async event => { await call('settings.update', { showRealNames: event.target.checked }); notify('显示模式已更新') } }),
              h('span', { className: 'tw-small' }, state.settings.showRealNames ? '实名（仅本机）' : '匿名别名'),
              state.privacy?.allowRealNames === true ? null : h('span', { className: 'tw-small tw-muted' }, '（需在插件配置中允许）'))),
          h('div', { className: 'tw-card' },
            h('div', { className: 'tw-card-title' }, t('data.rotate')),
            h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, t('data.rotateHint')),
            h('div', { style: { marginTop: 8 } }, h(Button, { size: 'sm', onClick: async () => {
              await call('data.rotateIdentity', {})
              notify('匿名实例标识已更换')
            } }, t('data.rotate'))))),
        h('div', { className: 'tw-grid cols2' },
          h('div', { className: 'tw-card' },
            h('div', { className: 'tw-card-title' }, t('data.exportBackup')),
            h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, t('data.exportBackupHint')),
            h('div', { className: 'tw-row', style: { marginTop: 8 } }, h(Button, { size: 'sm', variant: 'soft', onClick: async () => {
              const body = await call('data.exportBackup', {})
              downloadText(`talent-workbench-backup-${Date.now()}.json`, JSON.stringify(body, null, 2))
              notify('完整备份已下载（含个人信息，请只保存在本机）')
            } }, h(Icon, { name: 'download', size: 12 }), t('common.download')))),
          h('div', { className: 'tw-card' },
            h('div', { className: 'tw-card-title' }, t('data.reset')),
            h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, t('data.resetHint')),
            h('div', { className: 'tw-row wrap', style: { marginTop: 8 } },
              h('input', { className: 'tw-input', style: { width: 150 }, placeholder: t('data.confirmReset'), value: resetText, onChange: event => setResetText(event.target.value) }),
              h(Button, { size: 'sm', variant: 'danger', onClick: async () => {
                if (resetText !== 'RESET') { notify('请输入 RESET 确认', 'error'); return }
                await call('data.reset', {})
                notify('已清空本地数据，并恢复内置模板与维度')
                setResetText('')
                load()
              } }, t('data.reset'))))),
        h('div', { className: 'tw-card' },
          h('div', { className: 'tw-card-title' }, t('data.importBackup')),
          h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, t('data.importBackupHint')),
          h('textarea', { className: 'tw-textarea', rows: 4, style: { marginTop: 8 }, value: importText, onChange: event => setImportText(event.target.value), placeholder: '粘贴完整备份 JSON…' }),
          h('div', { className: 'tw-row wrap', style: { marginTop: 8 } },
            h('label', { className: 'tw-btn sm', style: { cursor: 'pointer' } }, h(Icon, { name: 'upload', size: 12 }), t('common.upload'), h('input', { type: 'file', accept: '.json,application/json', className: 'tw-sr', onChange: async event => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              try { setImportText(await readTextFile(file)) } catch (err) { notify(String(err?.message ?? err), 'error') }
            } })),
            h('input', { className: 'tw-input', style: { width: 150 }, placeholder: t('data.confirmImport'), value: confirmText, onChange: event => setConfirmText(event.target.value) }),
            h(Button, { size: 'sm', variant: 'danger', onClick: async () => {
              if (confirmText !== 'REPLACE') { notify('请输入 REPLACE 确认覆盖', 'error'); return }
              try {
                const backup = JSON.parse(importText)
                await call('data.importBackup', { backup, confirm: 'REPLACE' })
                notify('完整备份已导入')
                setImportText('')
                setConfirmText('')
              } catch { /* call() already surfaced the failure */ }
            } }, t('common.import')))),
        h('div', { className: 'tw-grid cols2' },
          h('div', { className: 'tw-card' },
            h('div', { className: 'tw-card-title' }, t('data.refreshFields')),
            h('div', { className: 'tw-small tw-muted', style: { marginTop: 3 } }, t('data.refreshFieldsHint')),
            h('div', { className: 'tw-row', style: { marginTop: 8 } },
              h(Button, { size: 'sm', variant: 'soft', disabled: busy !== '', onClick: async () => {
                try {
                  const body = await call('candidates.previewRefresh', {})
                  if ((body.total ?? 0) === 0) { notify(t('data.refreshNone')); return }
                  setRefreshPreview(body)
                } catch { /* noticed by call */ }
              } }, h(Icon, { name: 'refresh', size: 12 }), t('data.refreshFields')),
              h(Button, { size: 'sm', variant: 'primary', disabled: busy !== '', onClick: async () => {
                try {
                  const body = await call('candidates.agentRefresh', { apply: false })
                  if (body.ok !== true) { notify(String(body.error ?? '智能体复核失败'), 'error'); return }
                  if ((body.total ?? 0) === 0) { notify(t('data.agentRefreshNone')); return }
                  setAgentPreview(body)
                } catch { /* noticed by call */ }
              } }, h(Icon, { name: 'book', size: 12 }), t('data.agentRefresh')))),
          h('div', { className: 'tw-card' },
            h('div', { className: 'tw-card-title' }, t('data.privacyTitle')),
            h('div', { className: 'tw-small tw-muted', style: { marginTop: 4, lineHeight: 1.7 } }, t('data.privacyBody')))),
        h('div', { className: 'tw-card', style: { maxHeight: 360, overflow: 'auto' } },
          h('div', { className: 'tw-card-title' }, t('data.audit')),
          (state.audit ?? []).slice().reverse().map(entry => h('div', { key: entry.id, className: 'tw-version' },
              h('span', { className: 'v' }, auditLabel(entry.action)),
              h('span', { className: 'note' }, entry.detail),
              h('span', { className: 'tw-small tw-muted' }, new Date(entry.at).toLocaleString())))),
        agentPreview === null ? null : h(Modal, {
          title: t('data.agentRefresh'),
          onClose: () => setAgentPreview(null),
          width: 'wide',
          footer: [
            h(Button, { key: 'cancel', onClick: () => setAgentPreview(null) }, t('common.cancel')),
            h(Button, { key: 'apply', variant: 'primary', disabled: busy !== '', onClick: async () => {
              try {
                const body = await call('candidates.agentRefresh', { apply: true })
                setAgentPreview(null)
                if (body.ok === true) notify(t('data.refreshApplied').replace('{n}', String(body.applied ?? 0)))
                else notify(String(body.error ?? '应用失败'), 'error')
              } catch { /* noticed by call */ }
            } }, t('data.agentRefreshApply')),
          ],
        },
        h('div', { className: 'tw-small tw-muted', style: { marginBottom: 10 } }, t('data.agentRefreshBody')),
        h('div', { className: 'tw-table-wrap' },
          h('table', { className: 'tw-table' },
            h('thead', null,
              h('tr', null, h('th', null, '候选人'), h('th', null, t('data.refreshSource')), h('th', null, '字段'), h('th', null, '当前'), h('th', null, t('data.agent')))),
            h('tbody', null, agentRows)))),
        refreshPreview === null ? null : h(Modal, {
          title: t('data.refreshFields'),
          onClose: () => setRefreshPreview(null),
          width: 'wide',
          footer: [
            h(Button, { key: 'cancel', onClick: () => setRefreshPreview(null) }, t('common.cancel')),
            h(Button, { key: 'apply', variant: 'primary', disabled: busy !== '', onClick: async () => {
              try {
                const body = await call('candidates.applyRefresh', { candidateIds: refreshPreview.candidates.map(row => row.candidateId) })
                setRefreshPreview(null)
                notify(t('data.refreshApplied').replace('{n}', String(body.applied ?? 0)))
              } catch { /* noticed by call */ }
            } }, t('data.refreshApply')),
          ],
        },
        h('div', { className: 'tw-small tw-muted', style: { marginBottom: 10 } }, t('data.refreshFieldsBody')),
        (refreshPreview.suspects ?? []).length > 0
          ? h('div', { className: 'tw-warning', style: { marginBottom: 10 } },
            `${t('data.refreshSuspects')}：${refreshPreview.suspects.map(row => `${row.alias}（${row.sourceFile}）`).join('、')}`)
          : null,
        h('div', { className: 'tw-table-wrap' },
          h('table', { className: 'tw-table' },
            h('thead', null,
              h('tr', null,
                h('th', null, '候选人'),
                h('th', null, t('data.refreshSource')),
                h('th', null, '字段'),
                h('th', null, '当前'),
                h('th', null, '建议'))),
            h('tbody', null, refreshRows)))))
    }

    /** Left-sidebar entry icon; the sidebar owner supplies size and selected state. */
    function PanelIcon({ size = 20, active = false }) {
      const edge = active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)'
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': true,
      },
      h('rect', { x: 3.2, y: 3.6, width: 17.6, height: 16.8, rx: 4.2, stroke: edge, strokeWidth: 1.5 }),
      h('path', { d: 'M9.4 3.6v16.8', stroke: edge, strokeWidth: 1.3, opacity: 0.55 }),
      h('path', { d: 'M12.8 8.6h5.2M12.8 12h3.8M12.8 15.4h4.6', stroke: edge, strokeWidth: 1.3, strokeLinecap: 'round', opacity: 0.75 }),
      h('circle', { cx: 6.3, cy: 8.4, r: 1.15, fill: edge, opacity: 0.9 }),
      h('circle', { cx: 6.3, cy: 12, r: 1.15, fill: edge, opacity: 0.55 }),
      h('circle', { cx: 6.3, cy: 15.6, r: 1.15, fill: edge, opacity: 0.35 }))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'talent workbench: dictionaries')
        const t = ctx.locale.bind(NS)
        // Entry: one icon in the global left rail. The sidebar owns the button and
        // selects the matching main panel by this id.
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 30,
          label: () => t('app.title'),
        }, PanelIcon)), 'talent workbench: sidebar entry')
        // The page itself fills the main column, like other global panels.
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          label: () => t('app.title'),
          locale: NS,
          inject: () => ({ t }),
        }, Workbench)), 'talent workbench: main panel')
      },
    }
  },
})
