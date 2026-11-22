/**
 * Seed content for the talent workbench.
 *
 * Every person below is fictional: the profiles exist only to demonstrate the
 * scoring and weight-calibration flow. No resume, name, phone, email or other
 * real-person datum from the reference folder is copied into the plugin.
 */
import {
  INDUSTRY_SKILL_SEEDS,
  INDUSTRY_TEMPLATE_SEEDS,
  INDUSTRY_CANDIDATE_SEEDS,
} from './seed-industry.js'

const LEVELS_5 = [
  { value: 'high', label: '高', score: 1, definition: '直接命中岗位核心问题，且已有可验证的独立产出。' },
  { value: 'upperMid', label: '中上', score: 0.8, definition: '核心一侧较强，另一侧可迁移，短期补齐成本低。' },
  { value: 'mid', label: '中', score: 0.6, definition: '有可迁移的方法或平台能力，需要换体系验证。' },
  { value: 'lowerMid', label: '中下', score: 0.4, definition: '只有工具级或间接相关经验，独立支撑能力弱。' },
  { value: 'low', label: '低', score: 0.2, definition: '与岗位问题链没有可用接口。' },
]

const LEVELS_BOOL = [
  { value: 'yes', label: '是', score: 1, definition: '存在明确、可命名的能力接口。' },
  { value: 'no', label: '否', score: 0, definition: '不存在该接口，或属于团队已有核心方向。' },
]

const LEVELS_PARTIAL = [
  { value: 'yes', label: '是', score: 1, definition: '有上线/现场交付级证据，且能说明个人负责范围。' },
  { value: 'partial', label: '部分', score: 0.5, definition: '有中试、原型或集成经验，尚未到生产环境。' },
  { value: 'no', label: '否', score: 0, definition: '只有实验室或课程级经历，无可验证落地。' },
]

const LEVELS_FOCUS = [
  { value: 'high', label: '高', score: 1, definition: '无实质占用，或占用很轻，产出节奏与投入匹配。' },
  { value: 'mid', label: '中', score: 0.7, definition: '有 1—2 项中等强度职务，产出正常。' },
  { value: 'lowerMid', label: '中下', score: 0.4, definition: '现任党团/学生主要负责人，且一作产出偏低。' },
  { value: 'low', label: '低', score: 0.1, definition: '准全职行政/党务占用，且几乎没有一作产出。' },
]

export const SKILL_SEEDS = [
  {
    id: 'tech-stack-match',
    key: 'talent-dimension-tech-stack',
    name: '技术栈匹配度',
    shortName: '技术栈',
    order: 1,
    defaultWeight: 22,
    description: '判断候选人的技能与「AI + 高纯稀土 / 湿法冶金」技术栈是直接命中、可迁移，还是只有工具级关联。',
    whenToUse: '岗位需要同时理解材料/冶金过程与数据/模型，或需要 LLM/Agent 工程能力时使用；技术栈是主权重维度，但不可只看专业名称。',
    scale: LEVELS_5,
    method: [
      '先把岗位拆成三层锚点：对象层（稀土冶金、永磁、储氢、抛光、萃取、高纯金属等）、方法层（第一性原理、分子动力学、CFD、过程建模、时序模型、强化学习、RAG、Agent 等）、交付层（产线、装置、控制系统、软件平台、现场验证）。',
      '从简历中逐条抽取「问题 → 方法 → 结果」证据链；每条证据必须能回答做了什么、数据/对象是什么、规模多大、结果如何、本人负责哪一部分。',
      '把证据归入四类：同对象同方法（直接）、同方法换对象（可迁移）、同对象换方法（可迁移）、只有工具或课程（弱相关）。',
      '按分级标准判级；证据只来自课程、自学或团队成果时降一档，并写明缺失证据。',
      '给出置信度：结构化字段齐全且有一手项目证据为高；只有简历文字为中；只有关键词为低。',
    ],
    evidence: [
      '项目：对象、数据量、模型/算法、上线或验证结果、个人负责模块。',
      '论文/专利：方法是否本人实现，是否与岗位对象同源。',
      '实习/工程：系统规模、部署环境、指标、故障处理。',
      '技能：能说明在哪个项目里用过，而不是仅列名词。',
    ],
    redFlags: [
      '关键词堆砌：列了 PyTorch、LangChain、VASP，却没有任何对应项目。',
      '把团队成果写成个人成果，或把「参与」写成「负责」。',
      '专业名称直接等同匹配度：机械/控制不等于天然高匹配，AI 也不等于懂材料。',
      '论文方向与岗位对象无关，却用 IF 高低替代相关性判断。',
      '把课程作业、竞赛 demo 当成生产级交付。',
    ],
    probes: [
      '你解决的预测/控制/设计问题，具体输入输出是什么？数据从哪里来、多少条、怎么清洗？',
      '如果把材料体系换成稀土，你的方法哪一步必须重做？哪一步可以直接复用？',
      '你负责的模块上线后，用什么指标衡量有效？失败案例是什么？',
      '请挑一个项目，说明从问题定义到结果验证你独立做了哪三件事。',
    ],
    antiBias: '本维度最容易把「专业标签」当成匹配度。必须按问题链证据判级，并明确区分直接、可迁移、弱相关；机械、控制、计算机不会因为专业名称自动加分，材料/化学也不会自动高分。',
    output: '等级（高/中上/中/中下/低）、证据链、可迁移点、缺失证据、置信度。',
    calibration: '若岗位已有多名机械/控制背景成员，本维度权重不宜超过 25%；若团队缺的是领域知识，则优先看对象层证据而不是工具列表。',
    extra: {
      anchors: ['稀土冶金', '永磁/储氢/抛光', '湿法萃取', '高纯金属', '过程建模', '过程控制', '材料预测', 'LLM/Agent 工程'],
    },
  },
  {
    id: 'cross-discipline',
    key: 'talent-dimension-cross-discipline',
    name: '跨学科',
    shortName: '跨学科',
    order: 2,
    defaultWeight: 5,
    description: '判断候选人是否带来团队现有体系之外、且可命名的学科能力；属于「补充能力」信号，不是人才质量分。',
    whenToUse: '团队需要补一个明确缺口（如控制、机械、数学、计算机）时使用；若该缺口已有人覆盖，把权重调低甚至设为 0。',
    scale: LEVELS_BOOL,
    method: [
      '先写下本岗位的核心学科集合。示例模板的核心集合是：稀土材料、冶金、化学/化工、物理。',
      '识别候选人的主学科与第二学科，不要只看毕业专业，也要看实际训练与产出。',
      '用一句话命名他带来的能力，例如「多智能体编排与评测」「第一性原理计算」「工业控制回路整定」，不能只写「跨学科」。',
      '判断该能力是否填补团队已命名的缺口；若没有缺口，判「否」并标注其核心方向。',
      '检查是否与技术栈、落地短板重复计分；同一证据只能支撑一个维度。',
    ],
    evidence: [
      '学位/课程训练与项目中的实际方法。',
      '能说明「团队现在做不了、他能做」的具体任务。',
      '与核心方向的分工边界，而不是简单的专业名称差异。',
    ],
    redFlags: [
      '把「专业不同」直接当成跨学科价值。',
      '跨学科与落地/技术栈重复计分，导致机械、控制被系统性放大。',
      '无法命名具体能力，只能说「背景多元」。',
      '团队已有同能力成员，却仍然给高权重。',
    ],
    probes: [
      '你的学科训练能解决我们哪个现有短板？请举一个我们团队目前做不了的具体任务。',
      '这项能力和团队里已有的某个人如何分工？为什么还需要你？',
      '如果只保留一项跨学科能力，你希望是哪一项？为什么？',
    ],
    antiBias: '这是最容易被「专业多样性」绑架的维度。参考案例中，跨学科权重过高会把结果系统性推向机械/控制专业。建议默认权重不超过 8%，并在偏差诊断中检查专业集中度。',
    output: '是/否、学科、具体能力、填补的缺口、与核心方向的重叠、置信度。',
    calibration: '若偏差诊断显示本维度入选者的机械/控制占比超过 60%，先下调权重，再复核判级是否把「专业不同」误当能力。',
    extra: { coreDisciplines: ['材料', '冶金', '化学', '化工', '物理'] },
  },
  {
    id: 'academic-level',
    key: 'talent-dimension-academic-level',
    name: '学术水平预估',
    shortName: '学术水平',
    order: 3,
    defaultWeight: 18,
    description: '按已发表/已接收成果的层级与作者位次，预估当前学术水位；在投、在审单独列出，不计入已发表。',
    whenToUse: '研究型岗位、需要独立课题能力或学术能见度的岗位；工程执行岗可降低权重。',
    scale: LEVELS_5,
    method: [
      '只统计已发表或已接收成果；在投、在审、在修、返修全部单列，不折算为已发表。',
      '只统计第一作者与共同第一作者；导师一作、学生二作、三作单列为「参与」。共同一作按 0.5 篇折算，并在证据中注明。',
      '把期刊/会议映射到层级：CNS 及子刊/顶刊、JCR Q1 TOP、Q1、Q2、CCF-A/B/C、EI、北大核心。以简历自述为线索，标注「待核验」。',
      '用「最好的 2—3 篇 + 总量」判级，不用简单 IF 求和；不同学科的影响因子不可直接横比。',
      '记录核验缺口：作者位次、接收函、DOI、预警期刊、增刊等。',
    ],
    evidence: [
      '论文题目、期刊/会议、年份、作者位次、发表状态。',
      '接收函/DOI/预印本链接（本地记录即可，不上链）。',
      '共同一作的署名说明与个人贡献。',
      '专利、标准、软件著作权作为补充，不替代论文层级。',
    ],
    redFlags: [
      '把在投/在审说成已发表。',
      '把共同一作说成独立一作。',
      '把导师一作、学生二作算成自己的代表作。',
      '只看影响因子，不看学科差异与期刊预警名单。',
      '把会议摘要、预印本、增刊当成正式成果。',
    ],
    probes: [
      '请给出三篇代表作的具体作者位次、投稿状态和你的贡献；在投的请出示投稿系统截图。',
      '这篇共同一作中，你和另一位一作分别负责什么？',
      '为什么选择这个期刊？它在你所在领域的实际层级如何？',
    ],
    antiBias: '学术水平只回答「已经发表到什么层级」，不回答「未来能不能成长」。不要把平台、导师名气、学校层级折算成个人学术水平；也不要用年龄或第一学历替代成果证据。',
    output: '等级、已发表一作数、共同一作数、最佳刊物、在投清单、核验缺口。',
    calibration: '若岗位核心是工程交付，本维度权重可降到 10% 以下；若岗位需要课题负责人，建议保持在 18%—25%。',
    extra: {
      tiers: ['CNS/子刊', 'JCR Q1 TOP', 'JCR Q1', 'JCR Q2', 'CCF-A/B/C', 'EI', '北大核心'],
    },
  },
  {
    id: 'engineering-gap',
    key: 'talent-dimension-engineering-gap',
    name: '补齐落地短板',
    shortName: '落地短板',
    order: 4,
    defaultWeight: 10,
    description: '判断候选人能否把模型/数据真正部署到产线与装置：软件平台、控制系统、自动化、系统集成、现场交付。',
    whenToUse: '团队缺工程化、缺现场交付、缺装置集成时使用；若已有成熟工程团队，降低权重，避免工程型候选人过度占位。',
    scale: LEVELS_PARTIAL,
    method: [
      '按证据强度排序：生产系统在线运行（有指标、有用户/设备）> 中试/现场验证 > 实验室原型/集成 > 课程或竞赛 demo。',
      '每条证据必须写清：部署在哪里、规模多大、运行多久、本人负责哪一层、结果指标、是否仍在运行。',
      '区分「会写软件」与「能把模型落到工业约束里」：实时性、可靠性、异常处理、运维交接、数据闭环。',
      '检查是否有现场故障处理、版本迭代、用户培训等落地细节。',
      '只有实验室设备或仿真平台时判「部分」或「否」，不能因为专业是机械/控制就自动判「是」。',
    ],
    evidence: [
      '上线系统名称、部署环境、用户/设备规模、运行时长。',
      '个人负责模块与代码/配置/现场调试证据。',
      '指标：准确率、时延、稳定性、良率、能耗等。',
      '故障处理、运维交接、版本迭代记录。',
    ],
    redFlags: [
      '把实验室平台说成产线系统。',
      '把「参与部署」说成「主导上线」。',
      '只列技术栈，没有部署对象和指标。',
      '机械/控制专业直接判「是」，造成专业偏置。',
      '把仿真结果当成现场验证。',
    ],
    probes: [
      '上线了什么系统？多少用户/设备/数据？运行了多久？',
      '你负责哪一层？遇到过最难的现场故障是什么，怎么处理？',
      '模型/算法在工业约束下做了哪些妥协？谁维护？',
    ],
    antiBias: '参考案例中，本维度权重偏高会让机械、控制专业占据多数名额。建议默认不超过 12%，并与技术栈分开计分；如果团队已有工程负责人，可降到 5% 以下。',
    output: '是/部分/否、部署清单、个人负责范围、指标、证据缺口。',
    calibration: '偏差诊断中若本维度入选者的机械/控制占比超过 60%，优先下调权重，再复核「实验室 vs 产线」的判级。',
    extra: {},
  },
  {
    id: 'theory-depth',
    key: 'talent-dimension-theory-depth',
    name: '补齐理论深度',
    shortName: '理论深度',
    order: 5,
    defaultWeight: 12,
    description: '判断候选人能否在数学/物理/材料理论层面提升建模深度：第一性原理、分子动力学、数值算法、热力学/相图等。',
    whenToUse: '需要从机理层提升预测模型、需要判断近似条件与误差来源时使用；纯工程岗可降低权重。',
    scale: LEVELS_BOOL,
    method: [
      '识别候选人使用的方法层级：第一性原理、分子动力学、相图/热力学、数值 PDE、优化理论、统计学习理论等。',
      '区分「会用软件」与「能建模」：能否写出方程、说明近似、选择边界条件、推导误差、用实验/更高精度计算验证。',
      '判断该理论能力是否对准团队的建模瓶颈（例如稀土永磁的电子结构、萃取界面、过程场预测）。',
      '记录证据：推导、代码、验证对象、精度/误差、独立负责部分。',
      '只有课程、只会点软件、或理论工作与岗位对象无关时判「否」。',
    ],
    evidence: [
      '理论方法、方程/模型、近似条件、数值实现。',
      '与实验或高精度计算的对照验证。',
      '本人在推导/代码/验证中的独立贡献。',
      '与岗位建模瓶颈的具体接口。',
    ],
    redFlags: [
      '把高影响因子论文等同于理论深度。',
      '把「会用 VASP/LAMMPS/COMSOL」当成「能建模」。',
      '数学专业但理论工作与材料/过程无关。',
      '只给结果，不给近似条件与误差来源。',
    ],
    probes: [
      '你推导或实现了哪部分方程？近似条件是什么？换体系后哪些假设会失效？',
      '你如何验证计算/模型的误差？和实验对上了吗？',
      '如果让你把机理层接入我们的材料预测模型，第一步做什么？',
    ],
    antiBias: '理论深度不等于学历或专业名称。数学、物理背景只有在能对接岗位建模瓶颈时才计分；材料/化学背景也不能因为「做过计算」就自动判「是」。',
    output: '是/否、方法清单、推导/实现证据、验证方式、与瓶颈的接口、置信度。',
    calibration: '若团队已有理论计算负责人，本维度可降到 5% 以下；若当前最缺机理层，可提高到 15% 左右，但需配合学术水平一起看。',
    extra: {},
  },
  {
    id: 'long-term-potential',
    key: 'talent-dimension-long-term-potential',
    name: '长期学术潜力',
    shortName: '长期潜力',
    order: 6,
    defaultWeight: 12,
    description: '结合产出节奏、独立性、平台、选题与成长曲线，判断长期学术成长性；禁止用年龄、性别、第一学历做替代判断。',
    whenToUse: '需要培养型岗位、需要判断 3—5 年成长空间时使用；成熟即战力岗位可降低权重。',
    scale: LEVELS_5,
    method: [
      '看轨迹而不是单点：一作产出是否逐年增加、是否从执行走向独立选题、是否形成连续方向。',
      '看平台与协作：是否有稳定的数据/实验/计算条件，是否能获得导师以外的合作。',
      '看选题天花板：问题是否足够重要、是否有可扩展的方法论、是否只是跟随热点。',
      '看奖项与同行认可，但只作为辅助；不把学校层级、导师名气直接折算成个人潜力。',
      '数据不足时置信度标低，默认「中」，并在面试中追问未来三年计划。',
    ],
    evidence: [
      '按年份排列的一作成果与角色变化。',
      '独立提出的问题、方法或系统。',
      '平台、数据、合作网络与可持续性。',
      '未来研究计划与岗位方向的交集。',
    ],
    redFlags: [
      '用年龄、性别、婚育、第一学历推断潜力。',
      '只看学校/导师名气，不看个人轨迹。',
      '把一篇高影响因子论文当成长期潜力。',
      '把「年轻」直接等同于「潜力高」。',
    ],
    probes: [
      '未来三年你准备解决什么问题？与博士课题是什么关系？',
      '你独立负责过哪一步？如果导师不给方向，你会怎么选题？',
      '你觉得自己目前最大的能力缺口是什么？准备怎么补？',
    ],
    antiBias: '年龄、性别、婚育、籍贯、第一学历都不是潜力证据。只使用可核验的产出轨迹与自主性证据；若信息不足，降低置信度而不是给极端分。',
    output: '等级、轨迹证据、独立性证据、风险、置信度。',
    calibration: '培养型岗位可保持 12%—18%；急需即战力时降到 5% 以下，把权重让给技术栈与经历深度。',
    extra: {},
  },
  {
    id: 'research-depth',
    key: 'talent-dimension-research-depth',
    name: '科研经历深度',
    shortName: '经历深度',
    order: 7,
    defaultWeight: 13,
    description: '判断课题的完整性、独立负责程度，以及是否经历放大/现场验证；区分「参与大项目」与「真正负责一段研究」。',
    whenToUse: '研究型、课题负责人或需要独立推进项目时使用；工程执行岗可降低权重。',
    scale: LEVELS_5,
    method: [
      '还原完整链条：问题定义 → 方法/实验设计 → 数据/样品 → 验证 → 放大/现场 → 结论/交接。',
      '标记角色：主导、核心、参与；记录持续时间和团队规模。',
      '寻找个人决策点：哪一步是他独立定的？失败过什么？如何修正？',
      '区分项目名头与个人深度：国家级项目里的边缘参与不等于高深度。',
      '检查放大/现场验证：从实验室到中试、产线、装置的经历是强证据。',
    ],
    evidence: [
      '项目链条各环节的个人贡献。',
      '独立决策、失败与修正记录。',
      '放大/现场验证的规模与结果。',
      '成果交接、复用与后续影响。',
    ],
    redFlags: [
      '把「参与国家项目」直接当成高深度。',
      '只列项目名，不说个人负责哪一段。',
      '把团队规模当成个人能力。',
      '把重复性实验当成完整研究链条。',
    ],
    probes: [
      '项目里哪一步是你独立决策的？失败过什么，怎么解决？',
      '从实验室到现场，你经历了哪几步？最大的不确定性是什么？',
      '如果让你重新做一遍，你会改哪一步？',
    ],
    antiBias: '大项目、名导师、重点实验室都不是深度本身。只看个人决策点、完整链条与验证强度；参与度高但没有独立段的，判「中」或「中下」。',
    output: '等级、链条完成度、角色、个人决策点、验证强度、缺口。',
    calibration: '需要独立课题负责人时保持 15% 左右；若岗位是执行型，可降到 8%。',
    extra: {},
  },
  {
    id: 'research-focus',
    key: 'talent-dimension-research-focus',
    name: '科研专注度',
    shortName: '专注度',
    order: 8,
    defaultWeight: 8,
    description: '识别党务、学生干部、行政岗对科研投入的挤占程度。它是风险提示维度，不是道德评价，也不能单独作为淘汰理由。',
    whenToUse: '候选人有较多党团/学生/行政职务，且一作产出与投入不匹配时使用；作为面试追问线索，而非硬门槛。',
    scale: LEVELS_FOCUS,
    method: [
      '逐条记录职务：类型（党务/学生/行政）、起止时间、是否在任、每周实际投入（若可知）。',
      '计算与科研关键期的重叠：硕士/博士前几年、论文冲刺期、毕业前 12 个月。',
      '对照一作产出与产出节奏；职务重但产出仍稳定，不应判低。',
      '区分职务强度：主席/书记/部长/班长/普通干事，持续年限与是否在任权重不同。',
      '证据不足时标「需核实」，面试追问任期、每周投入、入职前是否卸任。',
    ],
    evidence: [
      '职务名称、起止时间、是否在任。',
      '每周投入或活动频次（自述需核实）。',
      '同期一作产出与论文状态。',
      '面试中关于时间分配的追问记录。',
    ],
    redFlags: [
      '只看职务名称，不看时长与强度。',
      '把任何学生工作都当成负面信号。',
      '用专注度单独淘汰候选人，忽略产出与能力。',
      '把性别、婚育、家庭责任纳入判断。',
      '把「在任」与「已卸任」混为一谈。',
    ],
    probes: [
      '任期到什么时候？每周实际投入多少小时？入职前是否卸任？',
      '过去 12 个月你的科研时间怎么分配？有没有连续的大块时间？',
      '如果入职后需要全时投入，你准备怎么安排？',
    ],
    antiBias: '本维度是风险提示，不是道德分。不得使用性别、婚育、家庭责任等信息；不得因普通学生职务扣分；必须与一作产出一起看，并在结论中注明「需核实」。',
    output: '等级、职务清单、重叠期、产出信号、需核实项、置信度。',
    calibration: '建议权重不超过 10%，且不设硬门槛；若偏差诊断显示它压低了某类专业，复核是否把「学生工作多」误当成「科研不专注」。',
    extra: {},
  },
]

export const TEMPLATE_SEEDS = [
  {
    id: 'tpl-ai-rare-earth-calibrated',
    name: 'AI + 稀土研究岗（校准版）',
    family: 'ai-rare-earth',
    description: '按参考案例校准：技术栈与学术水平为主，跨学科与落地短板降权，避免机械/控制专业被系统性放大。人物与数据均为虚构示例。',
    dimensions: [
      { skillId: 'tech-stack-match', weight: 22, gate: false, gateMin: 'mid' },
      { skillId: 'cross-discipline', weight: 5, gate: false, gateMin: 'yes' },
      { skillId: 'academic-level', weight: 18, gate: false, gateMin: 'mid' },
      { skillId: 'engineering-gap', weight: 10, gate: false, gateMin: 'yes' },
      { skillId: 'theory-depth', weight: 12, gate: false, gateMin: 'yes' },
      { skillId: 'long-term-potential', weight: 12, gate: false, gateMin: 'mid' },
      { skillId: 'research-depth', weight: 13, gate: false, gateMin: 'mid' },
      { skillId: 'research-focus', weight: 8, gate: false, gateMin: 'mid' },
    ],
    hitMinScore: 0.6,
    decision: { recommend: 78, backup: 60 },
    tieBreak: ['research-focus', 'academic-level', 'research-depth'],
  },
  {
    id: 'tpl-ai-rare-earth-legacy',
    name: 'AI + 稀土研究岗（旧口径对照）',
    family: 'ai-rare-earth',
    description: '复现参考案例中「跨学科 + 落地短板」权重偏高的口径，用于对照观察专业分布变化。不是推荐模板。',
    dimensions: [
      { skillId: 'tech-stack-match', weight: 18, gate: false, gateMin: 'mid' },
      { skillId: 'cross-discipline', weight: 15, gate: false, gateMin: 'yes' },
      { skillId: 'academic-level', weight: 15, gate: false, gateMin: 'mid' },
      { skillId: 'engineering-gap', weight: 20, gate: false, gateMin: 'yes' },
      { skillId: 'theory-depth', weight: 8, gate: false, gateMin: 'yes' },
      { skillId: 'long-term-potential', weight: 10, gate: false, gateMin: 'mid' },
      { skillId: 'research-depth', weight: 8, gate: false, gateMin: 'mid' },
      { skillId: 'research-focus', weight: 6, gate: false, gateMin: 'mid' },
    ],
    hitMinScore: 0.6,
    decision: { recommend: 70, backup: 55 },
    tieBreak: ['research-focus', 'academic-level', 'research-depth'],
  },
]

/** Fictional demo candidates. No real people, schools, labs or projects. */
export const CANDIDATE_SEEDS = [
  {
    id: 'cand-a',
    alias: '候选人 A',
    major: '材料科学与工程',
    degree: '博士',
    school: '示例大学 A',
    stage: '博士四年级',
    direction: '稀土永磁材料的第一性原理与机器学习筛选',
    publications: [
      { role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊·计算材料（一区）' },
      { role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊·磁性与材料（一区）' },
      { role: 'cofirst', status: 'accepted', tier: 'top', venue: '示例顶刊·材料（共同一作）' },
      { role: 'first', status: 'review', tier: 'sci1', venue: '示例期刊·稀土材料（在投）' },
    ],
    projects: [
      { name: '无重稀土永磁成分高通量筛选（虚构）', role: 'lead', level: 'national', validation: 'lab' },
    ],
    engineering: [],
    theory: [
      { kind: 'first-principles', desc: 'EMTO-CPA 高通量计算与 XGBoost 联合筛选（虚构）' },
      { kind: 'ml', desc: '小样本材料性能预测与不确定性评估（虚构）' },
    ],
    roles: [],
    skills: ['Python', 'VASP', 'XGBoost', '高通量计算'],
    awards: ['示例学会优秀报告（虚构）'],
    notes: '虚构示例：学术强、理论强、工程落地弱。',
  },
  {
    id: 'cand-b',
    alias: '候选人 B',
    major: '控制科学与工程',
    degree: '硕士',
    school: '示例大学 B',
    stage: '硕士三年级',
    direction: '流程工业过程建模与强化学习优化',
    publications: [
      { role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊·过程工程（一区）' },
      { role: 'first', status: 'accepted', tier: 'sci2', venue: '示例期刊·控制工程（二区）' },
      { role: 'first', status: 'review', tier: 'sci1', venue: '示例期刊·智能制造（在投）' },
    ],
    projects: [
      { name: '浓密—脱水过程协同调度（虚构）', role: 'core', level: 'national', validation: 'industrial' },
      { name: '流程优化平台（虚构）', role: 'lead', level: 'enterprise', validation: 'pilot' },
    ],
    engineering: [
      { kind: 'deployment', desc: '优化算法接入现场 DCS，连续运行 6 个月（虚构）' },
      { kind: 'control', desc: '数据驱动回路整定与抗扰测试（虚构）' },
    ],
    theory: [{ kind: 'numerical', desc: '过程机理与数据混合建模（虚构）' }],
    roles: [],
    skills: ['Python', '强化学习', '过程建模', 'DCS'],
    awards: ['示例竞赛一等奖（虚构）'],
    notes: '虚构示例：方向同构、学术与落地兼顾。',
  },
  {
    id: 'cand-c',
    alias: '候选人 C',
    major: '机械工程',
    degree: '硕士',
    school: '示例大学 C',
    stage: '硕士三年级',
    direction: '设备状态监测与产线数据采集',
    publications: [],
    projects: [
      { name: '压缩机状态监测与健康预测（虚构）', role: 'lead', level: 'enterprise', validation: 'industrial' },
    ],
    engineering: [
      { kind: 'deployment', desc: '多源数据采集链路与健康预测平台上线（虚构）' },
      { kind: 'integration', desc: '传感器布置、PLC 接入与现场调试（虚构）' },
      { kind: 'field', desc: '三地工厂现场交付与培训（虚构）' },
    ],
    theory: [],
    roles: [{ title: '班级生活委员', kind: 'student', start: '2023', end: '至今', current: true }],
    skills: ['MATLAB', 'Python', 'PLC', '信号处理'],
    awards: ['示例专利两项（虚构）'],
    notes: '虚构示例：工程落地强、学术弱；在旧口径下会被跨学科+落地权重推高。',
  },
  {
    id: 'cand-d',
    alias: '候选人 D',
    major: '计算机科学与技术',
    degree: '硕士',
    school: '示例大学 D',
    stage: '硕士三年级',
    direction: 'LLM 应用、RAG 与多智能体工程',
    publications: [
      { role: 'first', status: 'published', tier: 'ccfB', venue: '示例会议·信息检索（CCF-B）' },
      { role: 'first', status: 'review', tier: 'ccfA', venue: '示例会议·人工智能（在投）' },
    ],
    projects: [
      { name: '企业知识库 RAG 与工单智能体（虚构）', role: 'lead', level: 'enterprise', validation: 'industrial' },
    ],
    engineering: [
      { kind: 'software', desc: '多智能体编排、检索评测与容器化部署（虚构）' },
      { kind: 'deployment', desc: '月均万次调用，召回率 88%（虚构）' },
    ],
    theory: [],
    roles: [],
    skills: ['Python', 'LangGraph', 'RAG', '评测', 'Docker'],
    awards: ['示例黑客松金奖（虚构）'],
    notes: '虚构示例：智能体工程强、材料领域弱。',
  },
  {
    id: 'cand-e',
    alias: '候选人 E',
    major: '数学',
    degree: '博士',
    school: '示例大学 E',
    stage: '博士三年级',
    direction: '偏微分方程数值算法与科学机器学习',
    publications: [
      { role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊·数值分析（一区）' },
      { role: 'first', status: 'review', tier: 'sci1', venue: '示例期刊·科学计算（在投）' },
    ],
    projects: [
      { name: '高精度守恒算子与代理模型（虚构）', role: 'core', level: 'national', validation: 'lab' },
    ],
    engineering: [],
    theory: [
      { kind: 'numerical', desc: 'PDE 数值格式设计与误差分析（虚构）' },
      { kind: 'ml', desc: '物理约束神经网络（虚构）' },
    ],
    roles: [],
    skills: ['Python', 'PyTorch', '数值分析', 'PDE'],
    awards: ['示例数学建模竞赛特等奖（虚构）'],
    notes: '虚构示例：理论深、领域接口需要迁移。',
  },
  {
    id: 'cand-f',
    alias: '候选人 F',
    major: '化学',
    degree: '博士',
    school: '示例大学 F',
    stage: '博士四年级',
    direction: '界面化学与溶剂萃取分离',
    publications: [
      { role: 'first', status: 'published', tier: 'top', venue: '示例顶刊·综合（一区 TOP）' },
      { role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊·胶体与界面（一区）' },
    ],
    projects: [
      { name: '液—液界面调控与萃取机理（虚构）', role: 'lead', level: 'national', validation: 'lab' },
    ],
    engineering: [],
    theory: [{ kind: 'md', desc: '界面分子动力学与表征联合分析（虚构）' }],
    roles: [],
    skills: ['分子动力学', '界面表征', 'Python'],
    awards: ['示例青年论坛最佳报告（虚构）'],
    notes: '虚构示例：学术强、方向与萃取相关、工程弱。',
  },
  {
    id: 'cand-g',
    alias: '候选人 G',
    major: '材料工程',
    degree: '硕士',
    school: '示例大学 G',
    stage: '硕士三年级',
    direction: '电池材料与机器学习辅助改性',
    publications: [
      { role: 'first', status: 'review', tier: 'sci2', venue: '示例期刊·储能（在投）' },
    ],
    projects: [
      { name: '正极材料掺杂改性（虚构）', role: 'participant', level: 'provincial', validation: 'lab' },
    ],
    engineering: [],
    theory: [],
    roles: [
      { title: '党支部书记', kind: 'party', start: '2024', end: '至今', current: true },
      { title: '院研究生会部长', kind: 'student', start: '2023', end: '2024', current: false },
    ],
    skills: ['Python', '电化学测试'],
    awards: ['示例优秀学生干部（虚构）'],
    notes: '虚构示例：专注度低、产出偏弱。',
  },
  {
    id: 'cand-h',
    alias: '候选人 H',
    major: '机械工程',
    degree: '硕士',
    school: '示例大学 H',
    stage: '硕士三年级',
    direction: '固液两相流 CFD 与设备流场优化',
    publications: [
      { role: 'first', status: 'published', tier: 'sci2', venue: '示例期刊·流体工程（二区）' },
    ],
    projects: [
      { name: '萃取混合澄清器流场优化（虚构）', role: 'core', level: 'enterprise', validation: 'pilot' },
    ],
    engineering: [{ kind: 'software', desc: 'Fluent 自动化仿真与参数扫描脚本（虚构）' }],
    theory: [{ kind: 'numerical', desc: '两相流模型与网格无关性分析（虚构）' }],
    roles: [],
    skills: ['Fluent', 'Python', 'CFD'],
    awards: [],
    notes: '虚构示例：方法与对象有接口，但深度中等。',
  },
  {
    id: 'cand-i',
    alias: '候选人 I',
    major: '机械工程',
    degree: '硕士',
    school: '示例大学 I',
    stage: '硕士三年级',
    direction: '产线自动化改造与设备集成',
    publications: [],
    projects: [
      { name: '稀土冶炼产线自动化改造（虚构）', role: 'lead', level: 'enterprise', validation: 'industrial' },
    ],
    engineering: [
      { kind: 'integration', desc: 'PLC、机器人与上位机系统集成（虚构）' },
      { kind: 'field', desc: '两条产线现场调试与验收（虚构）' },
      { kind: 'deployment', desc: '产线数据采集与看板上线（虚构）' },
    ],
    theory: [],
    roles: [{ title: '院研会体育部部长', kind: 'student', start: '2023', end: '2024', current: false }],
    skills: ['PLC', 'SolidWorks', 'Python'],
    awards: ['示例机械创新大赛二等奖（虚构）'],
    notes: '虚构示例：工程落地极强、无论文；旧口径下会被两个维度同时推高。',
  },
  {
    id: 'cand-j',
    alias: '候选人 J',
    major: '控制科学与工程',
    degree: '硕士',
    school: '示例大学 J',
    stage: '硕士三年级',
    direction: '过程控制回路辨识与优化',
    publications: [
      { role: 'first', status: 'published', tier: 'sci2', venue: '示例期刊·控制与决策（二区）' },
    ],
    projects: [
      { name: '萃取槽液位与流量控制优化（虚构）', role: 'core', level: 'provincial', validation: 'pilot' },
    ],
    engineering: [
      { kind: 'control', desc: '回路辨识与 PID 参数自动整定（虚构）' },
      { kind: 'software', desc: '整定工具软件（虚构）' },
    ],
    theory: [{ kind: 'numerical', desc: '系统辨识与鲁棒性分析（虚构）' }],
    roles: [],
    skills: ['MATLAB', 'Python', 'PID'],
    awards: [],
    notes: '虚构示例：控制器工程能力可用，学术中等。',
  },
  {
    id: 'cand-k',
    alias: '候选人 K',
    major: '机械工程',
    degree: '博士',
    school: '示例大学 K',
    stage: '博士五年级',
    direction: '结构数字孪生与降阶代理模型',
    publications: [
      { role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊·机械工程学报（一区）' },
      { role: 'first', status: 'published', tier: 'sci2', venue: '示例期刊·振动与冲击（二区）' },
      { role: 'cofirst', status: 'published', tier: 'sci1', venue: '示例期刊·结构与多物理场（一区，共同一作）' },
    ],
    projects: [
      { name: '热等静压装备数字孪生（虚构）', role: 'lead', level: 'national', validation: 'industrial' },
    ],
    engineering: [
      { kind: 'deployment', desc: 'POD-XGBoost 降阶模型 ONNX 部署（虚构）' },
      { kind: 'software', desc: '批量提数与可视化工具链（虚构）' },
    ],
    theory: [{ kind: 'numerical', desc: '降阶模型误差分析与网格无关性（虚构）' }],
    roles: [{ title: '学院研究生会主席', kind: 'student', start: '2024', end: '至今', current: true }],
    skills: ['Python', 'ANSYS', 'ONNX'],
    awards: ['示例优秀博士论文培育（虚构）'],
    notes: '虚构示例：工程与学术都在线，但学生工作占用明显。',
  },
  {
    id: 'cand-l',
    alias: '候选人 L',
    major: '控制科学与工程',
    degree: '博士',
    school: '示例大学 L',
    stage: '博士四年级',
    direction: '强化学习决策与无人系统',
    publications: [
      { role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊·自动化学报（一区）' },
      { role: 'first', status: 'accepted', tier: 'sci2', venue: '示例期刊·控制理论与应用（二区）' },
    ],
    projects: [
      { name: '多工序调度强化学习决策（虚构）', role: 'lead', level: 'national', validation: 'pilot' },
    ],
    engineering: [{ kind: 'software', desc: '仿真与策略部署平台（虚构）' }],
    theory: [{ kind: 'ml', desc: '策略梯度与样本效率分析（虚构）' }],
    roles: [{ title: '党支部书记', kind: 'party', start: '2023', end: '至今', current: true }],
    skills: ['Python', 'PyTorch', '强化学习'],
    awards: ['示例学会优秀论文（虚构）'],
    notes: '虚构示例：方向同构、学术不错，党务占用需核实。',
  },
  {
    id: 'cand-m',
    alias: '候选人 M',
    major: '材料科学与工程',
    degree: '硕士',
    school: '示例大学 M',
    stage: '硕士三年级',
    direction: '稀土抛光粉制备与粒度控制',
    publications: [
      { role: 'first', status: 'published', tier: 'core', venue: '示例期刊·稀土（中文核心）' },
    ],
    projects: [
      { name: '抛光粉粒径与形貌调控（虚构）', role: 'core', level: 'enterprise', validation: 'pilot' },
    ],
    engineering: [],
    theory: [],
    roles: [],
    skills: ['XRD', 'SEM', 'Python'],
    awards: [],
    notes: '虚构示例：对象非常对口，但方法与成果都偏弱。',
  },
  {
    id: 'cand-n',
    alias: '候选人 N',
    major: '化学工程',
    degree: '博士',
    school: '示例大学 N',
    stage: '博士四年级',
    direction: '溶剂萃取工艺放大与传质建模',
    publications: [
      { role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊·分离与纯化技术（一区）' },
      { role: 'first', status: 'published', tier: 'sci1', venue: '示例期刊·化工学报（一区）' },
      { role: 'first', status: 'review', tier: 'sci1', venue: '示例期刊·湿法冶金（在投）' },
    ],
    projects: [
      { name: '萃取塔中试放大与传质模型（虚构）', role: 'lead', level: 'national', validation: 'pilot' },
    ],
    engineering: [{ kind: 'integration', desc: '中试装置搭建与在线分析（虚构）' }],
    theory: [{ kind: 'thermodynamics', desc: '萃取平衡与传质系数模型（虚构）' }],
    roles: [],
    skills: ['Aspen', 'Python', '萃取实验'],
    awards: [],
    notes: '虚构示例：方向与放大能力都强，工程验证只到中试。',
  },
]

export const ALL_SKILL_SEEDS = [...SKILL_SEEDS, ...INDUSTRY_SKILL_SEEDS]
export const ALL_TEMPLATE_SEEDS = [...TEMPLATE_SEEDS, ...INDUSTRY_TEMPLATE_SEEDS]

/**
 * Display-only sample candidates.
 *
 * They are NOT written to the database: the Client renders them as a preview
 * while the real candidate pool is empty, and they disappear as soon as a real
 * resume is imported or a candidate is added by hand. Kept here so the same
 * definitions can drive tests and the generated Client payload.
 */
export const DEMO_CANDIDATES = [...CANDIDATE_SEEDS, ...INDUSTRY_CANDIDATE_SEEDS]

export function buildSeedDb() {
  const now = new Date().toISOString()
  const skills = {}
  for (const spec of ALL_SKILL_SEEDS) {
    skills[spec.id] = {
      id: spec.id,
      currentVersion: 1,
      versions: [{
        version: 1,
        createdAt: now,
        note: '内置初始规范',
        spec: { ...spec, version: 1 },
      }],
    }
  }
  const templates = {}
  for (const spec of ALL_TEMPLATE_SEEDS) {
    templates[spec.id] = {
      id: spec.id,
      currentVersion: 1,
      versions: [{
        version: 1,
        createdAt: now,
        note: '内置示例模板',
        definition: { ...spec, version: 1 },
      }],
    }
  }
  return {
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    settings: {
      activeTemplateId: ALL_TEMPLATE_SEEDS[0].id,
      showRealNames: false,
      anonymizeByDefault: true,
      activeTab: 'overview',
    },
    skills,
    templates,
    candidates: {},
    runs: [],
    ledger: [],
    peerKnowledge: {},
    audit: [],
  }
}

/**
 * Add seed content that a stored database does not have yet, so a new release
 * can ship new dimensions and templates without touching the user's edits.
 * Sample candidates are never written to the database: they are display-only,
 * and any previously stored sample rows are removed here.
 */
export function mergeSeedContent(db) {
  const now = new Date().toISOString()
  const added = { skills: [], templates: [], candidates: [], removedSamples: 0 }
  db.skills = db.skills ?? {}
  db.templates = db.templates ?? {}
  db.candidates = db.candidates ?? {}
  for (const spec of ALL_SKILL_SEEDS) {
    if (db.skills[spec.id] !== undefined) continue
    db.skills[spec.id] = {
      id: spec.id,
      currentVersion: 1,
      versions: [{ version: 1, createdAt: now, note: '内置规范（升级新增）', spec: { ...spec, version: 1 } }],
    }
    added.skills.push(spec.name)
  }
  for (const spec of ALL_TEMPLATE_SEEDS) {
    if (db.templates[spec.id] !== undefined) continue
    db.templates[spec.id] = {
      id: spec.id,
      currentVersion: 1,
      versions: [{ version: 1, createdAt: now, note: '内置模板（升级新增）', definition: { ...spec, version: 1 } }],
    }
    added.templates.push(spec.name)
  }
  // Earlier releases seeded sample candidates into the database. They are
  // display-only data, so drop them; real candidates are untouched.
  for (const [id, candidate] of Object.entries(db.candidates)) {
    if (candidate.source !== 'demo') continue
    delete db.candidates[id]
    added.removedSamples += 1
  }
  if (added.removedSamples > 0) {
    db.audit = [...(db.audit ?? []), {
      id: `audit-${Date.now().toString(36)}`,
      at: now,
      action: 'data.purgeSamples',
      detail: `移除 ${added.removedSamples} 条内置示例候选人（示例数据改为仅前端展示）`,
    }].slice(-200)
  }
  return added
}

export function renderSkillMarkdown(spec) {
  const scaleRows = spec.scale.map(level =>
    `| ${level.label} | ${level.score} | ${level.definition} |`).join('\n')
  const numbered = (items) => items.map((item, index) => `${index + 1}. ${item}`).join('\n')
  const bullets = (items) => items.map(item => `- ${item}`).join('\n')
  const anchors = spec.extra?.anchors?.length
    ? `\n## 岗位锚点（示例）\n\n${bullets(spec.extra.anchors)}\n`
    : ''
  return `# ${spec.name}

> 维度技能 \`${spec.key}\` · 版本 v${spec.version ?? 1} · 本地存储 · 可回溯

## 考察目标

${spec.description}

## 何时使用

${spec.whenToUse}

## 判定方法

${numbered(spec.method)}

## 证据清单

${bullets(spec.evidence)}

## 分级标准

| 等级 | 分值 | 判定口径 |
|---|---|---|
${scaleRows}

## 反偏差与反幻觉

${spec.antiBias}

## 面试追问

${bullets(spec.probes)}

## 输出格式

${spec.output}

## 校准建议

${spec.calibration}
${anchors}
## 使用约束

本技能只服务于本地筛选与面试准备，不得把候选人姓名、联系方式、简历原文或任何可识别个人的信息写入交换包。判级必须引用证据；证据不足时降低置信度，不得编造。
`
}
