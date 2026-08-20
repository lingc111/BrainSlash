# Gameplay UI 设计规格：反向 × 多目标 × Chaos 78%

## 1. 页面设计目标

让玩家在高压阶段仍能于 0.5 秒内读懂“提示是斩偶数，但当前规则为反向，因此要斩错误项”，随后用一条干净轨迹连续命中 7 和 3，同时避开 8、12 与炸弹。

## 2. 前置假设

- 模式：60 秒乱斗；
- 时间点：第 45 秒，进入高压阶段；
- 主题：闪电心算；
- 当前提示：斩偶数；
- 叠加规则：反向 + 多目标；
- 正确动作：连续斩击奇数 7、3；
- Combo：17；
- 生命：3；
- 剩余时间：15 秒；
- Chaos：78%；
- 参考画布：750 × 1624；
- 玩家已完成反向规则的新手教学；
- Chaos 是扩展机制，不是原 PRD v1.0 的既定 MVP 功能。

## 3. 信息优先级

1. 当前提示“斩偶数”与持续规则“反向”；
2. 场上目标、炸弹和可用斩击路径；
3. 剩余时间 15s 与 3 点生命；
4. Combo 17；
5. Chaos 78%。

弱化内容：模式名、主题名、累计分数、头像、暂停按钮和教学文字均不在主视野出现。若必须提供暂停入口，只能放在微信系统胶囊之外的设置层或系统返回流程中。

## 4. 页面布局

参考坐标以左上角为原点。

### 4.1 安全区

- 顶部系统安全区：y = 0–88；
- 微信胶囊避让区：按 `wx.getMenuButtonBoundingClientRect()` 动态计算，设计稿参考 x = 500–718、y = 24–80；
- 底部手势安全区：y = 1536–1624；
- 所有关键文字、目标和 Chaos 条体不得进入以上区域。

### 4.2 HUD 区

- 范围：y = 88–292，约占可用高度 15%；
- 左上 Combo：x = 32–174，y = 112–208；
- 中央提示：x = 190–560，y = 104–184；
- 规则徽标：x = 230–522，y = 196–260；
- 右上时间/生命：x = 578–718，y = 106–222；
- HUD 不使用完整大面板，仅使用局部深色承载面与细描边，避免压缩游戏区域。

### 4.3 游戏区

- 范围：x = 24–726，y = 300–1390；
- 占画面约 67%；
- 目标视觉尺寸 96–128 px；
- 命中区域 112–144 px；
- 目标间视觉间距不小于 48 px，命中区域不重叠；
- 目标距离屏幕边缘不小于 40 px；
- 斩击路径不得穿过 HUD、Chaos Bar 或底部手势区。

建议初始位置：

- 7：三角形，中心约 (230, 480)；
- 8：圆形，中心约 (520, 480)；
- 12：圆角方块，中心约 (375, 710)；
- 3：六边形，中心约 (230, 940)；
- 炸弹：黑色尖刺圆形，中心约 (520, 940)。

5 个目标采用竖屏 `2+1+2` 阵型，7 与 3 之间形成一条自然纵向连斩路径；8、12 和炸弹与该轨迹保持明显距离。实际运行时位置可以移动，但生成器必须先验证可达路径与危险目标间距。

### 4.4 Chaos 区

- 范围：x = 32–718，y = 1432–1518；
- 左侧标签 `CHAOS`，右侧数值 `78%`；
- 条体高 24–32 px，分为 12 个视觉刻度；
- 78% 时填充约 9.4 格，末端处于 Highlight 黄橙色，尚未进入 100% Danger 爆发；
- y = 1536 以下保持空白，避让底部手势区。

## 5. 元素规格

### ComboDisplay

- 文案：`17` + `COMBO`；
- 数字 56–64 pt，白色或 Positive；
- 标签 18–20 pt，Text Secondary；
- 左对齐，不使用卡片；
- Combo 上升时数字向上跳 8 px，颜色短暂变为 Positive。

### 当前提示

- 文案：`斩偶数`；
- 字号 38–44 pt，H2，粗体；
- 白色，居中；
- 只显示一行；
- 不改写成“斩奇数”，避免替玩家完成反向判断。

### RuleBadge

- `反向`：Danger 背景或描边，带双向翻转箭头；
- `多目标`：Primary 描边，深色 Surface 背景；
- 高 48–56 px，内边距左右 16–24 px；
- 反向徽标始终位于第一位，视觉权重高于多目标；
- 持续期间不消失。

### TimerDisplay / LifeDisplay

- `15s`：36–42 pt 等宽数字，白色；
- 3 个生命图标：每个 24–28 px，间距 8 px；
- 时间低于 10 秒后才进入 Danger 色，本场景 15 秒仍保持白色；
- 生命为满，不播放受击状态。

### Target

- Surface：#161D32；
- 主描边：Primary 或浅灰白，不表示答案；
- 数字：48–60 pt，白色粗体；
- 轮廓宽 4–6 px；
- 通过圆、三角、圆角方、六边形、圆环形成快速区分；
- 正确性不通过颜色泄露。
- 数字层始终保持正向可读；目标仅以 `±8°–12°` 入场，并在 180–240ms 内回正，之后不持续自转。

### Bomb

- 黑色尖刺圆形轮廓；
- Danger 红色外描边；
- 中央危险图标、短引线和两个小警告三角；
- 命中体比视觉体缩小约 8%，减少擦边误判；
- 与普通目标同时依靠形状、图标、轮廓区分。

### Reverse 边框

- 屏幕内容区内缩 6–8 px 的 Danger 细边框；
- 透明度 55–70%；
- 不覆盖安全区和目标；
- 每 1.2 秒完成一次低频明暗呼吸，不闪烁。

### ChaosBar

- 低值段 Primary，中段 Highlight，接近满值转 Danger；
- 当前末端显示受控脉冲和少量光屑；
- 不播放 `CHAOS MODE` 标题，因为当前仅为 78%。

## 6. 组件清单

- `GameplayHUD.prefab`
- `ComboDisplay.prefab`
- `InstructionDisplay.prefab`
- `RuleBadge.prefab`
- `TimerDisplay.prefab`
- `LifeDisplay.prefab`
- `TargetNumber.prefab`
- `BombTarget.prefab`
- `SlashTrail.prefab`
- `FloatingScore.prefab`
- `ChaosBar.prefab`
- `ReverseFrame.prefab`
- `HitSpark.prefab`

`RuleBadge`、`TargetNumber`、`ChaosBar` 和 `FloatingScore` 应通过配置复用，不为该页面建立一次性组件。

## 7. 状态变化

### 默认进行中

- 目标以可预测轨迹运动；
- 目标入场倾斜在 240ms 内回正，后续只做位移，不持续自转；
- 反向边框低频呼吸；
- Chaos 边缘压力持续但不扰动内容；
- 规则文字和徽标保持稳定位置。

### 正确连斩 7、3

- 轨迹依次命中 7 和 3；
- 两个目标沿切面分裂，碎片向轨迹法线方向分离；
- Combo 17 更新为 18；
- 显示短时得分浮字；
- 若满足快速、干净、不碰干扰项，触发 Master Hit。

### 误斩 8、12

- 因反向规则，它们属于错误命中；
- Combo 断裂，生命减少 1；
- 命中位置局部 Danger 闪光；
- HUD 不改变布局，不弹出解释框。

### 命中炸弹

- 使用比普通错误更重的低频音和局部冲击环；
- 扣 1 条生命并断 Combo；
- 炸弹爆裂效果控制在半径 160 px 内，120–220ms 后快速清场。

### Chaos 80% 临界

- Chaos 条体进入更加明显的刻度脉冲；
- 背景速度线略增；
- 不改变目标速度、位置或命中区域，实际难度变化由玩法系统决定。

### 暂停/失焦

- 微信切后台时冻结目标、计时器和输入轨迹；
- 恢复后提供 600ms 的 `READY` 节奏提示再继续；
- 本场景画面不展示暂停按钮。

## 8. 动效、音效与震动

- 输入轨迹：触发延迟 0–16ms，拖尾保留 100–160ms；
- 普通正确切割：140–200ms，`quadOut`；
- 目标分裂：初速度沿切面法线，180–260ms 后回收；
- Combo 跳字：180–240ms，先放大至 1.12，再回到 1.0；
- Reverse 边框：1200ms 正弦呼吸；
- Chaos 78% 条体脉冲：900ms，幅度不超过 6%；
- 错误震动：80–120ms，位移不超过 8 px，仅震动局部内容层；
- Master Hit：80–120ms hit stop，刀光加宽 30%，Highlight 浮字 320–420ms；
- 正确音效：清脆高频切割 + 短确认音；
- 错误音效：短低频冲击；
- 炸弹：更重但短促的爆破音；
- 震动：正确轻震一次，Master Hit 中震一次，错误/炸弹中震一次；遵循用户系统震动设置。

## 9. Cocos Creator 实现

### 推荐 Node 层级

```text
Canvas
├─ SafeAreaRoot
│  ├─ BackgroundLayer
│  ├─ ReverseFrame
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
│  └─ ChaosLayer
└─ SystemOverlayGuard
```

### 适配

- 参考分辨率 750 × 1624；
- Canvas 使用统一设计分辨率，按实际长宽比调整上下留白；
- `Widget` 负责左右与顶部锚定；
- 结合 `view.getSafeAreaRect()` 与 `wx.getMenuButtonBoundingClientRect()` 计算胶囊避让；
- 顶部中央提示的最大宽度由左侧 Combo、右侧时间生命和胶囊占位共同决定；
- 底部 Chaos 层锚定到手势安全区上方。

### 状态系统

- `GameHUDState`：combo、time、life、instruction；
- `RuleState`：normal、reverse、multi、order、stroop、bomb；
- `ChaosState`：stable、building、pressure、warning、active；
- 本页面状态为 `reverse + multi + pressure(0.78)`；
- 所有颜色、字号、间距和时长从 Design Tokens 读取。

### 输入与判定

- 每帧记录触点采样点并形成连续线段；
- 使用线段与圆形/凸多边形碰撞体做 sweep test；
- 按轨迹时间顺序生成命中序列；
- 同一目标一次手势仅命中一次；
- 炸弹优先级与普通目标一致，避免视觉轨迹命中但逻辑漏判；
- 轨迹渲染与命中判定分离，低端机降低拖尾节点数但不降低判定采样精度。

### 性能

- 目标、碎片、浮字、火花和刀光使用对象池；
- HUD 使用图集与九宫格；
- 高配：完整拖尾、碎片和边缘粒子；
- 中配：减少 50% 粒子与拖尾采样；
- 低配：关闭边缘粒子和背景速度线，仅保留刀轨、音效、必要震动；
- 不使用全屏动态模糊或昂贵后处理 Shader。

## 10. 最终视觉生成提示词

```text
Use case: ui-mockup. Create a polished production-ready full-screen Gameplay UI for a portrait WeChat mini game, 750x1624 reference, front view, edge-to-edge, no phone frame. Premium minimal 2D arcade action game, never an education or quiz app.

Deep navy #0B1020 background, restrained geometric motion texture. Reserve top safe area and unobstructed top-right WeChat capsule region. HUD occupies top 17%, huge clean playfield about 70%, bottom Chaos meter only.

Top-left: exact "17" large, exact "COMBO" small. Top-center focal instruction exact Chinese "斩偶数" in bold white, with persistent badges exact "反向" in Danger red #FF4D6D plus reverse-arrow icon, and exact "多目标" in cyan #55E6D2. Top-right below safe region: exact "15s" and three full heart icons.

Persistent Reverse mode: thin red inner screen border and restrained red HUD accent, no flashing, do not reveal the answer with any wording such as 斩奇数.

Central playfield: exactly five large separated touch targets in a portrait 2+1+2 formation, each 90-130px, neutral dark surfaces with bright crisp outlines. Four numeral targets include exactly once: "8", "7", "12", "3"; add exactly one distinct black spiked bomb with red outline, hazard icon and fuse. Use simple circle, triangle, rounded square and hexagon silhouettes. Do not color-code correctness. Arrange a clean vertical-curved cyan-white slash trail through only 7 and 3, with tiny controlled split sparks, never touching 8, 12 or bomb. Keep every numeral upright and readable; no continuous target spinning.

Chaos is 78%, not full Chaos Mode. Add restrained amber/red pressure only at screen edges and subtle speed lines, never distort UI or target positions. Bottom has exact "CHAOS" left, exact "78%" right, one segmented near-full bar colored cyan to amber to red. No buttons, joystick or bottom operation bar. Bottom gesture-safe space clear.

Visual system: Surface #161D32, Primary #55E6D2, Positive #70E88B, Danger #FF4D6D, Highlight #FFD166, text #F7FAFF and #9AA7C2. Crisp Chinese typography, bold condensed numeric typography, disciplined spacing, restrained glow, flat 2D with slight premium depth, feasible in Cocos Creator.

Render these strings verbatim with no extra text: "17", "COMBO", "斩偶数", "反向", "多目标", "15s", "CHAOS", "78%", "8", "7", "12", "3".
```

## 11. Negative Prompt

```text
education app, school, classroom, blackboard, textbook, exam paper, answer card, traditional four-option quiz, children’s learning style, cute mascot, anime character, character illustration, dense panels, tiny text, tiny targets, garbled Chinese, extra text, extra numbers, duplicated numbers, color-coded answers, excessive neon, rainbow gradients, cyberpunk overload, heavy 3D, photorealism, full-screen distortion, excessive particles, bottom buttons, joystick, operation bar, store, currency, quests, leaderboard, watermark, logo, phone device mockup, perspective view
```

## 12. 自检结论

- 第一眼操作目标：通过“斩偶数”与持续“反向”徽标明确；
- 游戏感：使用街机 HUD、运动目标、刀轨和 Chaos 压力，未使用教育视觉；
- 规则识别：主提示、反向和多目标固定在顶部中央；
- 游戏空间：中央约 67%，无底部操作栏；
- 斩击干扰：目标路径与 HUD、炸弹、Chaos 区分离；
- Reverse：同时使用徽标、边框、颜色、图标与呼吸动效；
- Chaos：78% 有压力但未冒充 100% 爆发；
- 反馈：正确、Master Hit、普通错误和炸弹均短促可解释；
- 安全区：顶部胶囊和底部手势区均预留；
- 组件复用：HUD、规则徽标、目标、Chaos 和反馈均为 Prefab；
- 可实现性：主要依靠 2D Sprite、九宫格、Tween、对象池与轨迹碰撞，两名程序员可实现。
