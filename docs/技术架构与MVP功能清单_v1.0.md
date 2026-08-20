# 《脑斩 / Brain Slash》技术架构与 MVP 功能清单 v1.0

> 文档状态：开发基线
>
> 适用范围：手机竖屏微信小游戏首个可发布版本
>
> 核心闭环：首页 → Gameplay → Result → 再来一局 / 挑战好友

## 1. 决策摘要

### 1.1 MVP 要实现什么

玩家进入首页后，可以一键开始 60 秒乱斗；在按题型可读性控制的 2–6 个运动目标中，根据当前提示和规则连续划动斩击；系统实时处理正确、错误、Combo、生命、Master Hit 与难度变化；结算后可以立即重开，或把同一局面的挑战分享给好友。

MVP 必须支持六类规则：

1. 标准；
2. 反向；
3. 多目标；
4. 顺序；
5. Stroop；
6. 炸弹 / 禁区。

Chaos 不属于本次 MVP。代码中可以预留扩展接口，但不开发 Chaos 玩法、HUD、数值或特效，不让其影响首发测试与排期。

### 1.2 技术方案一句话

使用 Cocos Creator 3.8.x + TypeScript 构建纯 2D 客户端，以“配置驱动题目 + 可组合规则引擎 + 连续手势轨迹判定 + 确定性关卡种子”为核心；首发好友挑战不依赖自建后端，通过分享参数重建同一题序列。

### 1.3 本阶段明确不做

- 商城、抽卡、宠物、角色养成、签到、任务大厅、公会；
- 实时 PvP、观战、实时房间；
- 自建账号系统和自建排行榜服务；
- 好友开放数据排行榜；
- 广告、支付、复杂货币体系；
- 大型 3D 场景、骨骼角色、昂贵全屏 Shader；
- Chaos 机制；
- 复杂内容后台和热更新平台。

## 2. 前置假设

- 团队规模：2 名程序员，美术/音效资源按阶段提供；
- 引擎：锁定同一 Cocos Creator 3.8.x 补丁版本，不在 MVP 中途升级；
- 语言：TypeScript，开启严格类型检查；
- 参考画布：750 × 1624，运行时适配安全区、微信胶囊和底部手势区；
- 主模式：60 秒，3 点生命，生命耗尽或时间结束进入结算；
- 单次判断：约 1–3 秒；
- 首发采用本地配置和本地存档，无网络也能完成单局；
- “今日挑战”在无服务端时按本地日期 + 内容版本生成固定种子；
- 好友挑战通过分享参数传递 `seed`、`contentVersion`、`mode` 与目标分，防作弊不是首发阻塞项；
- 主题首发包含心算、英语、成语/汉字、国旗/地理、生活常识、眼力/认知，但每个主题只做能支撑核心循环的最小题库。

## 3. 总体架构

```text
┌──────────────────────────────────────────────┐
│ Presentation                                │
│ HomeScene / GameplayScene / ResultScene      │
│ HUD、Prefab、Tween、音效与短反馈             │
├──────────────────────────────────────────────┤
│ Application                                 │
│ AppFlow、GameSession、RoundFlow、教程编排     │
│ 命令、事件、用例、页面数据装配               │
├──────────────────────────────────────────────┤
│ Domain                                      │
│ QuestionGenerator、RuleEngine、HitResolver   │
│ ScoreSystem、DifficultyDirector、Fairness    │
├──────────────────────────────────────────────┤
│ Infrastructure                              │
│ WeChatAdapter、Storage、Share、Audio、Vibrate│
│ Analytics、Clock、RNG、ResourceLoader        │
├──────────────────────────────────────────────┤
│ Data & Assets                                │
│ 题库 JSON、Design Tokens、Prefab、图集、音频  │
└──────────────────────────────────────────────┘
```

依赖只能由上向下。领域层不直接调用 `wx.*`、场景节点或存档 API；微信接口全部封装在平台适配层，便于在浏览器预览和自动测试中替换。

### 3.1 核心架构原则

- Gameplay 逻辑与表现分离：先产生命中结果，再播放视觉反馈；
- 规则组合而非页面硬编码：提示、答案集合和规则修饰器分别计算；
- 轨迹判定与刀光渲染分离：低配机可以减少拖尾，不能降低判定精度；
- 局内权威时间使用单一 `GameClock`，暂停/失焦时统一冻结；
- 所有随机数来自带 seed 的 RNG，不直接使用 `Math.random()`；
- 题目、难度、运动参数和反馈数值配置化；
- 高频对象统一池化，不在战斗热路径频繁实例化和销毁节点；
- 跨模块只发布类型化领域事件，模块内部优先直接调用，避免全局事件总线失控。

## 4. 场景、常驻服务与 Node 结构

### 4.1 场景

只建立三个业务场景：

- `Home.scene`：今日挑战、60 秒乱斗、好友挑战入口、轻量成长摘要；
- `Gameplay.scene`：HUD、目标、轨迹、反馈、暂停/失焦恢复；
- `Result.scene`：分数、主指标、成长、再来一局、挑战好友。

启动 Loading 不单独做复杂页面；用轻量 `Boot` 场景或启动 Prefab 完成配置、存档和核心资源加载后立即进入首页。

### 4.2 常驻服务

`AppRoot` 使用持久节点承载：

- `AppFlowService`：场景流转与进入参数；
- `ConfigService`：加载、校验和索引配置；
- `SaveService`：本地记录、设置、教学状态；
- `PlatformService`：微信 / 浏览器能力适配；
- `AudioService`：BGM、SFX、并发和优先级；
- `HapticService`：震动开关与节流；
- `AssetService`：核心包和主题资源加载；
- `AnalyticsService`：无 SDK 时为空实现，保留统一事件口。

### 4.3 Gameplay Node 建议

```text
Canvas
├─ SafeAreaRoot
│  ├─ BackgroundLayer
│  ├─ GameplayLayer
│  │  ├─ TargetContainer
│  │  ├─ SlashTrailLayer
│  │  ├─ HitEffectLayer
│  │  └─ FloatingTextLayer
│  ├─ HUDLayer
│  │  ├─ ComboDisplay
│  │  ├─ InstructionDisplay
│  │  ├─ RuleBadgeGroup
│  │  └─ TimerLifeGroup
│  └─ TutorialOverlay
└─ SystemOverlayGuard
```

中央游戏区保持无传统底部操作栏。`SafeAreaRoot` 结合 Cocos 安全区与微信胶囊矩形动态计算，不使用截图坐标硬编码。

## 5. 目录结构建议

```text
assets/
├─ scenes/
│  ├─ Boot.scene
│  ├─ Home.scene
│  ├─ Gameplay.scene
│  └─ Result.scene
├─ scripts/
│  ├─ app/                 # 启动、场景流转、依赖装配
│  ├─ domain/
│  │  ├─ question/        # 题目定义、生成、校验
│  │  ├─ rules/           # 六类规则与组合器
│  │  ├─ gameplay/        # Session、Round、难度、计分
│  │  └─ geometry/        # 轨迹与碰撞计算
│  ├─ presentation/
│  │  ├─ home/
│  │  ├─ gameplay/
│  │  ├─ result/
│  │  └─ components/
│  ├─ infrastructure/
│  │  ├─ platform/
│  │  ├─ storage/
│  │  ├─ audio/
│  │  └─ analytics/
│  └─ shared/             # 类型、事件、对象池、工具
├─ prefabs/
│  ├─ common/
│  ├─ gameplay/
│  └─ result/
├─ configs/
│  ├─ design-tokens.json
│  ├─ gameplay.json
│  ├─ difficulty.json
│  ├─ rules.json
│  └─ content/
├─ textures/
├─ audio/
└─ bundles/               # 后续按主题拆分 Asset Bundle
```

## 6. 核心领域模型

### 6.1 单局状态

```ts
interface GameSessionState {
  sessionId: string;
  seed: string;
  mode: 'brawl60' | 'daily' | 'friendChallenge';
  contentVersion: string;
  elapsedMs: number;
  remainingMs: number;
  life: number;
  score: number;
  combo: number;
  maxCombo: number;
  correctCount: number;
  errorCount: number;
  bestReactionMs?: number;
  phase: 'ready' | 'playing' | 'resolving' | 'finished';
}
```

### 6.2 题目定义

```ts
interface QuestionInstance {
  id: string;
  theme: ThemeId;
  prompt: PromptSpec;
  targets: TargetSpec[];
  baseCorrectTargetIds: string[];
  orderedTargetIds?: string[];
  activeRules: RuleId[];
  timeLimitMs: number;
  tutorialSafe: boolean;
}
```

题目生成器先得到“基础正确集合”，规则引擎再应用修饰：

```text
题目语义 → 基础正确集合 → Reverse / Multi / Order / Stroop 修饰
       → 危险目标注入 → 最终动作约束 → 公平性校验 → 出题
```

### 6.3 规则接口

```ts
interface RuleEvaluator {
  readonly id: RuleId;
  apply(context: RuleContext, constraint: ActionConstraint): ActionConstraint;
}

interface ActionConstraint {
  requiredTargetIds: string[];
  forbiddenTargetIds: string[];
  ordered: boolean;
  allowExtraHits: boolean;
}
```

推荐固定执行顺序：

1. 解析题目语义，生成基础正确集合；
2. Stroop 决定采用“文字含义”还是“显示属性”；
3. Reverse 翻转可斩集合；
4. Multi 确定必须命中的多个目标；
5. Order 添加命中顺序；
6. Bomb / 禁区叠加绝对禁止目标。

炸弹永远不能被 Reverse 翻转为正确答案。任一题最多叠加 2 个复杂规则；规则组合白名单写入配置并经过测试，不允许随机产生未经验证的组合。

### 6.4 局内状态机

```text
Boot
  → Ready(600ms)
  → SpawnQuestion
  → AwaitGesture
  → ResolveGesture
      ├─ Correct → Feedback → NextQuestion
      ├─ Master  → HitStop → Feedback → NextQuestion
      └─ Error   → LoseLife → Feedback → NextQuestion / GameOver
  → TimeUp / LifeZero
  → Result
```

规则切换在 `SpawnQuestion` 前发出 0.8–1.2 秒预警。首次出现复杂规则时插入无惩罚教学题；教学完成状态写入本地存档。

## 7. 连续斩击输入与命中判定

### 7.1 输入流程

1. 监听 `TOUCH_START / MOVE / END / CANCEL`；
2. 将触点统一转换到 Gameplay 本地坐标；
3. 每次采样生成“上一点 → 当前点”的连续线段；
4. 使用空间分桶或轻量 broad phase 找出附近目标；
5. 对圆形或凸多边形命中体做线段 sweep test；
6. 记录 `targetId + hitTime + pathDistance`，同一手势内去重；
7. 按轨迹顺序交给 `HitResolver`；
8. 结束手势或满足题目条件后结算。

不能只检测触点终点。渲染层允许对轨迹点降采样，判定层保持原始采样或进行插值，防止高速划动穿透。

### 7.2 判定优先级

- 炸弹 / 禁区命中立即标记错误；
- 顺序题一旦命中错误顺序即失败，不等待手势结束；
- 多目标题在规定窗口内命中全部目标才成功；
- 普通题命中一个正确目标即成功；
- 同一目标一次手势只结算一次；
- 擦边容错由命中体配置，炸弹命中体可比视觉体缩小约 8%；
- 下一题生成前清空旧题碰撞体，避免反馈碎片参与判定。

### 7.3 Master Hit

建议首版条件：

- 从题目进入可操作状态起，在配置的反应窗口内完成；
- 一次连续手势完成所有必需命中；
- 未命中任何禁止项；
- 轨迹总长度不超过“最短可行路径 × 容差系数”；
- 顺序正确。

具体阈值配置化，通过真机测试调参，不写死在组件中。

## 8. 出题、运动与公平性

### 8.1 出题管线

```text
DifficultyDirector
  → 选择主题与规则组合
  → QuestionGenerator 生成语义题
  → TargetFactory 生成候选目标
  → SpawnPlanner 分配位置和运动轨迹
  → FairnessValidator 验证
  → 发布 QuestionReady
```

### 8.2 公平性校验必须检查

- 正确答案数量满足规则；
- 不存在重复或语义歧义答案；
- 目标为 2–6 个，并通过题型上限与复合规则减量策略保证可读性；
- 初始命中区域不重叠；
- 竖屏阵型每行最多两个目标；5 个使用 `2+1+2`，6 个使用 `2×3`；
- 正确连斩路径与炸弹保持安全距离；
- 目标不会进入 HUD、胶囊、底部手势区；
- 顺序题存在可完成路径；
- Stroop 文案、颜色和目标属性具有唯一判定；
- Reverse 后至少有一个正确目标且不会把炸弹变成答案；
- 当前速度和剩余时间允许人类完成。

验证失败时更换布局或重新生成题目，限制最大重试次数；仍失败则退回安全模板，不能把无解题交给玩家。

### 8.3 60 秒节奏

| 时段 | 目标数 | 规则策略 | 运动策略 |
|---|---:|---|---|
| 0–15 秒 | 2–3 | 标准为主，建立手感 | 低速、单轨迹、间距大 |
| 15–40 秒 | 3–5 | 混合主题，引入单个复杂规则 | 中速、可预测交叉 |
| 40–60 秒 | 通常 4–5；纯视觉单规则可到 6 | 最多叠加 2 个复杂规则，双规则减 1 个目标 | 提速但不改变判定公平性 |

难度导演只调整配置参数，不直接操作 HUD 或目标节点。

运动可读性约束：数字、汉字、单词和携带文字的目标禁止持续自转，只允许 `±8°–12°` 入场倾斜并在 180–240ms 内回正；后期速度提升只作用于可预测位移，不叠加旋转阅读压力。

## 9. 计分、生命与反馈

### 9.1 MVP 计分建议

```text
单题得分 = 基础分 × Combo 系数 × 规则系数 + Master Hit 奖励
```

- 正确：增加分数与 Combo；
- Master Hit：额外奖励，并触发更强但短促的反馈；
- 错误目标、漏掉必须目标、顺序错误、炸弹：扣 1 生命，Combo 清零；
- 生命降为 0：立即结束；
- 60 秒到：结束当前输入并进入结算，不再生成新题。

首轮平衡前保持公式简单，所有分值、倍率、反应窗口均配置化。

### 9.2 反馈预算

- 输入响应：0–50ms；
- 普通切割：120–220ms；
- 分数浮字：280–450ms；
- Combo：160–260ms；
- 错误震动：80–120ms；
- Master Hit hit stop：80–150ms；
- 页面转场：220–320ms。

输入、判定和音效优先级高于粒子。错误反馈不得用全屏红叉、长弹窗或阻断下一题。

## 10. MVP 功能清单

### P0：首发阻塞功能

#### A. 启动与平台基础

- [ ] 启动配置加载与版本校验；
- [ ] 本地存档读取、默认值和异常恢复；
- [ ] 750 × 1624 设计分辨率适配；
- [ ] 刘海、状态栏、微信胶囊和底部手势区动态避让；
- [ ] 前后台切换：冻结计时、目标、输入和 Tween，恢复前显示 600ms `READY`；
- [ ] 音效、音乐、震动开关；
- [ ] 微信分享入口与分享启动参数解析；
- [ ] 浏览器预览环境的微信 API 空实现。

#### B. 首页

- [ ] 今日挑战卡：挑战化名称、当日固定 seed、一键开始；
- [ ] 60 秒乱斗主按钮；
- [ ] 好友挑战入口：存在分享参数时显示待挑战分数；
- [ ] 本地最高分 / 轻量等级摘要；
- [ ] 首次进入引导到主 CTA；
- [ ] 不出现学科网格、商城和多货币入口。

#### C. Gameplay 基础循环

- [ ] 60 秒倒计时、3 点生命、分数、Combo；
- [ ] 2–6 个目标按题型限流、使用竖屏每行最多两个目标的阵型并完成移动、回收；
- [ ] 连续手势采样、轨迹渲染、线段命中；
- [ ] 正确、错误、漏斩、炸弹、生命耗尽、时间结束；
- [ ] 普通切割、碎片、浮字、Combo、音效、震动；
- [ ] Master Hit 判断与反馈；
- [ ] 三阶段难度节奏；
- [ ] 局内暂停/失焦恢复；
- [ ] 低端机特效分级。

#### D. 六类规则

- [ ] 标准：斩正确答案；
- [ ] 反向：持续 RuleBadge + 边框 + 音效层，切换前 0.8–1.2 秒预警；
- [ ] 多目标：一条或连续手势命中全部必需目标；
- [ ] 顺序：按指定顺序记录并验证命中序列；
- [ ] Stroop：显示含义与属性冲突，提示明确采用哪一维；
- [ ] 炸弹 / 禁区：形状、图标、轮廓共同区分，误切扣命；
- [ ] 首次复杂规则无惩罚教学题；
- [ ] 每题最多叠加 2 个复杂规则；
- [ ] 规则组合白名单与自动化单元测试。

#### E. 内容

- [ ] 心算：基础整数运算、奇偶、大小比较；
- [ ] 英语：高频词义、大小写或简单类别匹配；
- [ ] 成语 / 汉字：字形、词义或缺字目标；
- [ ] 国旗 / 地理：旗帜与国家/地区的直接匹配；
- [ ] 生活常识：无争议、短提示、可图标化内容；
- [ ] 眼力 / 认知：形状、数量、方向和属性判断；
- [ ] 内容 JSON Schema 校验；
- [ ] 歧义、重复答案、缺图和无解题检查；
- [ ] 至少一套稳定的回归 seed 列表。

具体主题、题型、首发素材库、循环算法与审核标准以 `MVP主题与题库设计_v1.0.md` 为内容基线。内容验收按“模板数量 × 参数组合 × 规则组合”计算，不只看 JSON 条目数；首发要求任意主题连续游玩 5 分钟不出现同签名题。

#### F. Result

- [ ] 总分与新纪录；
- [ ] 最高 Combo、正确率、最快反应，最多 3 项主指标；
- [ ] 本地成长或熟练度单一进展；
- [ ] `再来一局` 与 `挑战好友` 始终可见；
- [ ] 根据结果情境切换主次 CTA；
- [ ] 好友挑战分享携带 seed、内容版本、模式和目标分；
- [ ] 从分享进入时直接落到挑战准备流程，不绕回普通首页。

#### G. 质量与发布

- [ ] 规则引擎、计分、seed RNG、几何判定单元测试；
- [ ] 六类规则和白名单组合的固定 seed 回归测试；
- [ ] 至少覆盖一台低端、一台主流、一台高端真机；
- [ ] 弱网 / 无网、来电或切后台、音频中断恢复；
- [ ] 长宽屏、刘海屏、胶囊区域和底部手势区检查；
- [ ] 首包体积和启动时间检查；
- [ ] 微信开发者工具构建、预览、真机调试和提审配置。

### P1：MVP 上线后优先补充

- 题库扩容与远程配置；
- 好友开放数据排行榜、附近好友名次；
- 更完整的埋点 SDK 与漏斗看板；
- 内容灰度、难度 A/B 和在线活动配置；
- 更多结果分享卡样式；
- Asset Bundle 按主题分包；
- 轻量成就与主题熟练度展示；
- 无障碍选项：色弱辅助纹理、更细的震动和特效开关。

### P2：明确延后

- Chaos；
- 商业化；
- 自建账号、跨设备云存档；
- 全服排行榜和反作弊服务；
- 实时 PvP；
- 复杂角色、美术养成和大型活动系统。

## 11. 好友挑战的无后端 MVP 方案

### 11.1 分享载荷

```ts
interface FriendChallengePayload {
  v: 1;
  seed: string;
  contentVersion: string;
  mode: 'brawl60';
  targetScore: number;
  inviterName?: string;
}
```

分享链接只保存重建挑战所需信息。好友进入时：

1. 校验载荷版本和字段；
2. 检查本地内容版本能否重建；
3. 使用相同 seed 生成题序、目标属性和难度节奏；
4. 展示目标分并直接进入挑战准备；
5. 结算展示“超过 / 未超过目标分”，支持回敬挑战。

运动轨迹如果参与得分公平性，也必须由 seed 和离散时间驱动；纯装饰随机效果使用独立 RNG 流，不能消耗玩法 RNG，防止不同设备题序漂移。

### 11.2 已知限制

- 无服务端无法可信验证目标分，首发定位为社交趣味而非竞技排名；
- 内容版本不兼容时回退为普通 60 秒局，并明确提示挑战已过期；
- 不在分享参数中放昵称以外的敏感信息；
- 后续接服务端时保持 Payload 版本化，用 `challengeId` 替换明文局面数据。

## 12. 存档结构

```ts
interface SaveDataV1 {
  schemaVersion: 1;
  player: {
    level: number;
    xp: number;
    bestScore: number;
  };
  settings: {
    music: boolean;
    sfx: boolean;
    vibration: boolean;
    quality: 'auto' | 'low' | 'medium' | 'high';
  };
  tutorials: Partial<Record<RuleId, boolean>>;
  themeMastery: Partial<Record<ThemeId, number>>;
  lastDailyDate?: string;
}
```

存档需要默认值合并、版本迁移和损坏恢复。每局结束一次性写入主结果；设置变更立即写入；局内热路径不频繁同步存档。

## 13. 性能预算

### 13.1 运行目标

- 主流设备目标 60 FPS，低端设备稳定 30 FPS 以上；
- 触摸到首个可见刀轨反馈目标小于 50ms；
- Gameplay 热路径避免每帧临时数组、字符串拼接和节点创建；
- 同屏目标绝对上限 6 个，常规复合规则上限 5 个；碎片、火花、浮字和刀光均池化；
- 低配档优先关闭背景粒子、速度线、边缘光和多余碎片；
- 不降低输入采样、命中判定和音效触发优先级。

### 13.2 包体策略

首包只放启动、三页闭环、通用 UI 和一组首屏必需资源；主题图片和扩展音频预留 Asset Bundle 拆分。Cocos Creator 官方 3.8 文档支持将 Asset Bundle 构建为微信小游戏分包，项目应从第一天避免跨 Bundle 的无意资源引用。

## 14. 测试策略

### 14.1 可脱离引擎测试的纯逻辑

- seed RNG 相同输入产生相同序列；
- 每类题目的正确集合；
- 六类规则及白名单组合；
- 炸弹永不被 Reverse 变为正确；
- 顺序、多目标和额外命中的结算；
- 分数、Combo、生命、超时；
- 线段与圆 / 凸多边形碰撞；
- 公平性校验和安全模板回退；
- 存档迁移与损坏恢复；
- 分享载荷解析与版本兼容。

### 14.2 场景与真机测试

- 0.2–0.5 秒内能否识别提示和规则；
- 快速划动是否穿透目标；
- 斩击路径经过两个相邻目标时顺序是否稳定；
- 边缘目标、胶囊和底部手势区是否误触；
- 切后台后计时和 Tween 是否完全冻结；
- 连续玩 10 局是否出现对象未回收、音效堆积或帧率持续下降；
- Reverse 是否持续可见且不只依赖颜色；
- 错误反馈是否在下一题前退场；
- 不同设备用同一分享 seed 是否产生相同题序。

## 15. 两人开发分工建议

### 程序员 A：玩法与领域

- QuestionGenerator、RuleEngine、DifficultyDirector；
- 连续轨迹、几何命中、HitResolver；
- GameSession、计分、Combo、Master Hit；
- 确定性 RNG、公平性校验、纯逻辑测试。

### 程序员 B：客户端与平台

- 三个场景、HUD、Prefab、页面状态绑定；
- SafeArea、微信胶囊、前后台、分享和存档；
- 音频、震动、对象池、资源加载和性能档位；
- 构建、真机调试和提审流程。

共同维护接口：`QuestionInstance`、`ActionConstraint`、`HitResult`、`GameSessionState` 和领域事件。先冻结接口和最小纵切，避免两人分别在页面脚本中实现重复玩法逻辑。

## 16. 推荐开发顺序

### M0：工程骨架

- 创建 Cocos 工程、目录、TypeScript 规范与构建配置；
- 建立 `AppRoot`、场景流转、Design Tokens、平台空实现；
- 跑通 Home → Gameplay → Result 空流程。

### M1：一刀可玩纵切

- 单一心算主题 + 标准规则；
- 目标生成、运动、连续轨迹、正确/错误、60 秒、3 生命；
- 基础 HUD、切割反馈和结果页；
- 真机确认输入手感与安全区。

### M2：规则完整

- 加入 Reverse、Multi、Order、Stroop、Bomb；
- 加入教学题、规则预警、组合白名单与自动测试；
- 加入三阶段难度。

### M3：内容与社交闭环

- 补齐六主题最小题库；
- 今日挑战、确定性 seed、分享挑战与回敬；
- 本地成长、结果数据和新纪录。

### M4：优化与发布

- 资源分级、对象池、低端机降级；
- 固定 seed 回归、真机矩阵、包体和启动优化；
- 埋点接口、异常兜底、提审素材与发布构建。

每个里程碑都必须产生可运行包，不能等六类规则和全部内容完成后才第一次真机验证。

## 17. MVP 完成定义

同时满足以下条件才算 MVP 完成：

- 首页、Gameplay、Result、重开和分享挑战形成无断点闭环；
- 六类规则均可由配置生成、正确判定并完成首次安全教学；
- 任一局不会出现无解题、重叠命中区或不可达的必斩路径；
- 快速划动使用连续线段判定，无明显穿透；
- Reverse 在整个持续期间同时有文字、图标 / 边框等冗余提示；
- 正确、错误、炸弹、Master Hit 和 Combo 反馈短促且不会遮挡下一题；
- 三类真机完成 10 局稳定性测试，无持续掉帧和明显资源泄漏；
- 微信胶囊、刘海、状态栏和底部手势区在目标设备上无遮挡；
- 同一 `seed + contentVersion` 在不同设备生成相同题序；
- Chaos、商业化和其他 P2 系统没有混入首发依赖链。

## 18. 需要尽早锁定的产品参数

以下参数不阻塞工程骨架，但必须在 M1 真机测试后冻结第一版：

- 正确基础分、Combo 曲线、规则倍率、Master Hit 奖励；
- Master Hit 反应窗口与轨迹容差；
- 漏斩定义：超时、离场还是两者；
- 多目标题是“一笔完成”还是允许极短间隔的多笔；
- 各阶段目标速度、生成间隔与题目时限；
- 每个主题的首发内容量和审核负责人；
- 今日挑战的日期边界按本地时间还是服务端时间；
- 分享挑战过期策略和内容版本兼容周期。

建议默认：多目标和顺序都要求一笔连续完成，以突出“斩击”而非点选；如果真机测试发现可访问性或手感明显受损，再开放 150–250ms 的续笔宽限。

## 19. 官方技术参考

- [Cocos Creator 3.8 用户手册](https://docs.cocos.com/creator/3.8/manual/en/index.html)
- [Cocos Creator：发布到微信小游戏](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/publish-wechatgame.html)
- [Cocos Creator：小游戏分包](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/subpackage.html)
- [Cocos Creator 3.8 Touch API](https://docs.cocos.com/creator/3.8/api/en/class/Touch)
- [Cocos Creator 3.8 Pool API](https://docs.cocos.com/creator/3.8/api/en/class/Pool)

平台 API 的具体可用性、基础库版本和包体限制在接入与提审前，以微信小游戏官方文档和微信开发者工具当时显示为准；不要把历史数值散落硬编码在业务逻辑中。
