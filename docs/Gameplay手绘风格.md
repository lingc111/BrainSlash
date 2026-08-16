你是一名资深 Cocos Creator 3.x 游戏客户端工程师。

当前项目已经完成首页 UI，并且已经建立统一的视觉方向：

**手绘 + 剪纸 + 草稿纸 + 马克笔 + 文具拼贴**

现在请实现真正的 Gameplay 游戏场景。

本次 Gameplay 视觉参考图应放入项目，例如：
    design-reference/gameplay-reference.png

这张图片是：

**视觉、布局、比例、信息层级参考图。**

不要：

* 把整张图片作为 Gameplay 背景

* 用一张全屏 PNG 伪装成可交互游戏

* 根据图片坐标硬编码全部元素

需要将其拆解成真正的 Cocos UI + Gameplay 节点。

* * *

1. Gameplay 基础状态
   ================

当前参考场景：
    模式：60 秒乱斗

    当前阶段：
    高压阶段

    当前提示：
    斩偶数

    规则：
    反向
    多目标

    当前正确目标：
    7
    3

    干扰目标：
    8
    12
    14

    危险元素：
    炸弹

    Combo：
    17

    生命：
    3

    剩余时间：
    15 秒

    Chaos：
    78%

这里最重要的逻辑是：
    提示 = 斩偶数
    规则 = 反向

所以玩家实际上需要斩：
    奇数

但 UI **绝对不能直接显示“斩奇数”**。

玩家必须自己完成：
    斩偶数
    +
    反向
    ↓
    选择奇数

这个认知过程是玩法本身的一部分。

* * *

2. 第一视觉原则
   =========

玩家进入高压 Gameplay 后，应在大约：
    0.5 秒

内识别：
    我需要做什么？
    ↓
    斩偶数

    当前有什么特殊规则？
    ↓
    反向 + 多目标

    我要在哪里操作？
    ↓
    中央目标区域

信息优先级：
    1. 斩偶数
    2. 反向
    3. 场上的目标
    4. 剩余时间 / 生命
    5. Combo
    6. Chaos

不要让：
    纸张装饰
    颜色
    粒子
    动画
    阴影
    边框

抢走玩家注意力。

* * *

3. 设计分辨率
   ========

Gameplay 使用竖屏微信小游戏。

参考设计分辨率：
    750 × 1624

不要把所有节点按照固定像素直接铺死。

继续使用项目现有：
    Canvas
    SafeArea
    Widget
    Anchor

适配体系。

至少测试：
    9:16
    9:19.5
    9:20

三个屏幕比例。

* * *

4. 微信安全区
   ========

Gameplay 必须考虑：
    微信顶部胶囊
    刘海 / 灵动岛
    底部手势区域

顶部系统安全区域不要放核心交互。

需要结合：
    view.getSafeAreaRect()

以及微信环境：
    wx.getMenuButtonBoundingClientRect()

进行避让。

不要把：
    15s
    生命
    斩偶数

放到微信胶囊下面。

* * *

5. Scene Node 结构
   ================

优先采用：
    GameplayScene

    Canvas
    │
    └── SafeAreaRoot
        │
        ├── BackgroundLayer
        │
        │   └── GraphPaper
        │
        ├── ReverseFrame
        │
        ├── GameplayLayer
        │   │
        │   ├── TargetContainer
        │   │
        │   ├── SlashTrailLayer
        │   │
        │   ├── HitEffectLayer
        │   │
        │   ├── FragmentLayer
        │   │
        │   └── FloatingTextLayer
        │   │
        ├── HUDLayer
        │   │
        │   ├── ComboDisplay
        │   │
        │   ├── InstructionDisplay
        │   │
        │   ├── RuleBadgeGroup
        │   │
        │   └── TimerLifeGroup
        │   │
        └── ChaosLayer
        │
        └── BottomSafeArea

如果当前项目已有 Gameplay Scene：

优先复用。

不要为了匹配这个示例重新创建无意义结构。

* * *

6. Background
   =============

Gameplay 背景延续首页：
    暖米白色网格草稿纸

必须让玩家感觉：

首页和 Gameplay 属于同一个游戏。

优先复用现有：
    GraphPaper

资源。

视觉：
    warm off-white
    very subtle grid
    light paper fiber

不要：
    深色背景
    霓虹街机背景
    渐变
    星空
    黑色科技 UI

* * *

7. Gameplay 主区域
   ===============

Gameplay 区应该占画面的绝大多数。

大约：
    65% ～ 70%

页面中央应该非常空。

不要放：
    操作按钮
    技能栏
    摇杆
    说明文字
    任务列表
    头像
    货币

玩家唯一主要操作：
    手指划动 / 斩击

* * *

8. HUD：Combo
   ============

左上区域：
    17
    COMBO

视觉参考当前稿：

一张小型撕纸。

特点：
    白色纸张
    轻微撕裂
    手绘黑字
    下面一条红色马克笔下划线

不要使用：
    发光数字
    3D 数字
    霓虹数字

Combo 数字需要是动态 Label。

结构：
    ComboDisplay
    ├── Paper
    ├── ComboValue
    └── ComboLabel

数据：
    combo = 17

Combo 更新时：
    Scale 1.0
    → 1.12
    → 1.0

总时长：
    180 ～ 240ms

不要使用大范围粒子。

* * *

9. 中央规则区域
   =========

页面顶部最重要区域：
    斩偶数

使用横向撕下来的笔记本纸。

视觉：
    white notebook paper
    torn edge
    red masking tape
    marker handwriting

结构：
    InstructionDisplay
    ├── PaperBackground
    ├── Tape
    └── InstructionLabel

内容：
    斩偶数

必须非常明显。

不要添加：
    当前题目：
    规则：
    请斩击：

这种说明性文案。

只显示：
    斩偶数

* * *

10. Rule Badge
    ==============

Instruction 下方：
    反向
    多目标

两个纸质 Badge。
反向
--

更强视觉权重。

使用：
    砖红色 / muted red

可以有：
    双向翻转箭头

但整体仍然是：
    手绘图标

而不是现代 Icon Library。
多目标
---

使用：
    低饱和蓝色

可以带一个简单：
    target / bullseye

手绘图标。

两者都不要发光。

不要有：
    外发光
    渐变
    霓虹
    玻璃拟态

* * *

11. 时间与生命
    =========

右上区域：
    15s
    ♥ ♥ ♥

继续使用小型撕纸。

结构：
    TimerLifeGroup
    ├── Paper
    ├── TimerIcon
    ├── TimerLabel
    └── LifeContainer

Timer：
    15s

动态 Label。

生命：
    3

对应三个手绘红心。

手绘红心颜色：
    muted red / marker red

不要做：
    渐变红心
    发光红心
    3D 宝石红心

* * *

12. 最重要：Target 重新定义
    ===================

这一点必须严格执行。

目前 Gameplay 目标不能设计成：
    “数字专属按钮”

因为未来里面可能出现：
    数字
    汉字
    英文
    成语
    符号
    图形
    旗帜
    颜色块
    图标
    简笔画
    图片

所以目标必须定义为：
Generic Target Container
========================

而不是：
    TargetNumber

如果当前代码叫：
    TargetNumber

建议逐步重构为：
    GameplayTarget

* * *

13. 禁止使用中间镂空 Target
    ===================

绝对不要出现参考早期设计里的：
    圆环
    甜甜圈
    中间镂空形状

例如之前：
    14

被画在一个圆环下面。

这种设计禁止使用。

原因：

未来如果内容是：
    国
    猫
    A
    △
    🇨🇳
    图片

中间镂空会破坏内容承载能力。

所有 Target：

**中央区域必须完整、连续、无遮挡。**

* * *

14. Target 视觉结构
    ===============

每个 Target 可以拥有不同外轮廓：
    圆形
    三角形
    圆角矩形
    五边形
    六边形
    不规则剪纸

但是：

内部内容区必须完整。

例如：
         /\
        /  \
       / 7  \
      /______\

或者：
      ______
     /      \
    |   8    |
     \______/

而不能：
       _____
      /     \
     |       |
     |   ○   |
     |  14   |
      \_____/

* * *

15. Target Prefab
    =================

建议：
    GameplayTarget.prefab

结构：
    GameplayTarget
    │
    ├── Shadow
    ├── PaperShape
    ├── ContentRoot
    │   ├── TextContent
    │   ├── IconContent
    │   └── ImageContent
    │
    └── Collider

ContentRoot 必须允许未来动态切换：
    type TargetContentType =
        | 'text'
        | 'icon'
        | 'image';

例如：
    interface GameplayTargetData {
        id: string;

        contentType:
            | 'text'
            | 'icon'
            | 'image';

        text?: string;

        spriteFrame?: SpriteFrame;

        shape:
            | 'circle'
            | 'triangle'
            | 'roundedSquare'
            | 'pentagon'
            | 'hexagon';

        isDangerous?: boolean;
    }

不要将：
    数字

写死为唯一内容类型。

* * *

16. Target 颜色
    =============

当前参考截图里：
    8  = yellow
    7  = green
    12 = blue
    3  = purple
    14 = orange

这里颜色：

**仅仅用于增加视觉识别度。**

绝对不能让颜色表示：
    正确 / 错误

Gameplay 逻辑不能出现：
    绿色 = 正确
    红色 = 错误

否则玩家会跳过规则判断。

Target 颜色应该随机或根据主题配置。

例如：
    Muted Yellow
    Muted Green
    Muted Blue
    Muted Purple
    Muted Orange

全部降低饱和度。

材质表现：
    彩色铅笔 / 蜡笔 / 马克笔

不要纯色 Fill。

* * *

17. Target 边缘
    =============

Target 应该像：
    从卡纸上手工剪出来

所以：

* 黑色手绘轮廓

* 暖白色纸边

* 非完全规则边缘

* 轻微纸张阴影

不要：
    标准 UI Border
    完美 Vector Stroke
    玻璃边框
    发光 Stroke

视觉允许略微歪斜：
    rotation ±2° ～ ±5°

但不要影响可读性。

* * *

18. Target 内容
    =============

当前测试内容：
    8
    7
    12
    3
    14

全部使用：
    ContentRoot/TextContent

而不是图片。

未来代码应该能直接变成：
    中国
    日本
    猫
    狗
    蓝色
    △

而无需重新制作 Target Prefab。

内容必须：
    水平居中
    垂直居中

并留足安全 Padding。

* * *

19. 非常重要：取消目标之间所有常驻连线
    =====================

当前最终视觉方案：
Target 之间没有任何连接关系线
==================

不要绘制：
    虚线箭头
    连接线
    引导路径
    A → B
    节点之间的线
    预判刀轨

静态 Gameplay 状态：
    所有 Target 完全独立漂浮

玩家必须自己判断并划动。

因此删除或关闭任何：
    GuideLine
    ConnectionLine
    HintArrow
    SuggestedPath
    TargetLink

如果当前代码存在这些节点：

不要显示。

* * *

20. Slash Trail 与连接线不是一回事
    =========================

注意：

玩家真正触摸屏幕并划动时：

仍然需要：
    SlashTrail

但是 SlashTrail：

只在玩家真实输入期间出现。

生命周期：
    Touch Start
    ↓
    显示

    Touch Move
    ↓
    跟随

    Touch End
    ↓
    100 ～ 160ms 内消失

绝对不能：

在玩家没有操作时，

提前显示：
    7 → 3

的路径。

也就是说：
    静态连线 = 禁止
    玩家输入刀轨 = 保留

* * *

21. 取消三点光效
    ==========

最终视觉不要在 Target 周围绘制：
    三个短线
    三颗点
    放射线
    闪光线
    强调三角
    漫画式 attention marks

例如：
      ///
     [ 7 ]

或者：
    • • •
     [3]

全部取消。

Target 默认状态应该：
    干净
    安静
    容易识别

视觉反馈只发生在：
    目标出生
    被斩击
    错误命中

这些实际事件上。

* * *

22. Target 默认动画
    ===============

Target 可以有非常轻微的运动。

例如：
    上下浮动：
    2 ～ 5px

    Rotation：
    ±1° ～ ±2°

    周期：
    1.5 ～ 3 秒

不同 Target 略微错开时间。

不要：
    持续闪光
    持续 Scale
    持续跳动
    持续旋转

目标应该是动态的，

但不能“焦躁”。

* * *

23. Target 布局
    =============

参考当前状态放置：
    8
    上方中央

    7
    左侧中上

    12
    右侧中上

    3
    中间偏下

    14
    左下

    Bomb
    右下

但是不要硬编码这些坐标作为永久 Gameplay。

需要建立：
    TargetSpawnArea

约束。

要求：

目标：
    互不重叠
    距离屏幕边缘 > 40px
    命中区域互不重叠
    远离 HUD
    远离 ChaosBar

建议最小目标视觉距离：
    48px

* * *

24. Bomb
    ========

炸弹不是普通 GameplayTarget 的颜色变体。

建立：
    BombTarget.prefab

视觉：
    黑色手绘炸弹
    骷髅
    短引线
    暖白纸边
    红色危险外轮廓

但：

删除当前参考图中炸弹旁边的：
    警告三角
    三点
    放射线
    额外感叹号

因为炸弹自身：
    黑色
    骷髅
    引线
    红边

已经足够明显。

不要继续堆视觉提示。

* * *

25. Reverse Frame
    =================

Gameplay 区外围可以保留：
    红色手绘边框

用于持续提示：
    反向模式开启

视觉像：
    红色马克笔手画矩形

不是完美矩形。

但是必须非常轻。

Opacity：
    约 55% ～ 70%

可以进行低频呼吸：
    1200ms

但：
    不闪烁
    不发光
    不抖动

* * *

26. Chaos Bar
    =============

底部：
    CHAOS                       78%

使用：
    黄色撕纸

或者：
    暖白纸 + 彩色手绘方格

保持当前参考图风格。

Chaos 使用：
    12 格

视觉刻度。

78%：

大约：
    9 ～ 10 格

处于激活状态。

颜色：
    低值：
    Muted Green

    中值：
    Warm Yellow

    高值：
    Orange

接近 100% 时才允许：
    Danger Red

当前：
    78%

不要表现得像已经爆炸。

* * *

27. Chaos 不要制造大量装饰
    ==================

当前版本不要实现：
    满屏粒子
    纸屑
    屏幕扭曲
    抖屏常驻
    背景爆炸
    持续速度线

Chaos 78% 只表现：
    ChaosBar 已经偏高
    +
    轻微 Reverse 红框压力

Gameplay 本身保持清楚。

* * *

28. Input System
    ================

支持：
    Touch Start
    Touch Move
    Touch End

记录手指轨迹。

每次移动形成：
    segment

然后检测：
    segment
    vs
    target collider

使用 Sweep Test。

不要只检测：
    当前 Touch Point

否则快速划动容易漏判。

* * *

29. Slash Trail
    ===============

Slash Trail 使用：
    白色中心
    +
    非常浅的蓝色边缘

但是需要转换成当前手绘风格。

更像：
    一笔快速白色马克笔 / 刀锋笔触

而不是：
    激光
    霓虹
    光剑

持续：
    100 ～ 160ms

快速消失。

* * *

30. 正确切割
    ========

本例正确目标：
    7
    3

如果一次滑动连续经过：
    7 → 3

应该：

1. 判断 7

2. 判断 3

3. Target 分裂

4. Combo 增加

5. 生成很短的 Floating Score

6. 回收 Target

分裂：

沿玩家真实刀轨方向。

不要提前显示切割线。

* * *

31. Target Split
    ================

目标被切开后：

分成：
    2 个纸片

感觉应该像：
    真的把一张卡纸剪开

不是：
    爆炸
    碎成几十块

两个半片：

沿切面法线方向移动。

持续：
    180 ～ 260ms

然后回收。

* * *

32. Hit Effect
    ==============

正确命中：

允许：
    极少量纸屑
    短促马克笔火花

数量：
    2 ～ 5 个

不要出现“三点固定光效”。

Hit Effect 必须是：
    瞬时反馈

而不是：
    Target 默认装饰

* * *

33. 错误命中
    ========

例如玩家斩：
    8
    12
    14

因为：
    反向

所以这些属于错误。

错误反馈：
    局部红色 marker flash
    Combo break
    生命 -1
    轻震

不要：
    弹窗
    解释框
    “你应该斩奇数”

游戏继续。

* * *

34. Bomb 命中
    ===========

斩到炸弹：
    生命 -1
    Combo break

效果：
    黑色 / 红色手绘冲击圈
    少量碎纸
    短震动

控制在局部。

不要全屏爆炸。

* * *

35. 数据结构
    ========

Gameplay UI 不要直接读取散落变量。

建议：
    interface GameHUDState {
        combo: number;
        remainingTime: number;
        life: number;
        maxLife: number;
        instruction: string;
    }

    interface RuleState {
        reverse: boolean;
        multiTarget: boolean;
    }

    interface ChaosState {
        value: number;
    }

当前：
    const hud = {
        combo: 17,
        remainingTime: 15,
        life: 3,
        maxLife: 3,
        instruction: '斩偶数',
    };

    const rules = {
        reverse: true,
        multiTarget: true,
    };

    const chaos = {
        value: 0.78,
    };

* * *

36. GameplayTarget 数据
    =====================

建立通用内容能力。

例如：
    export enum TargetContentType {
        TEXT,
        ICON,
        IMAGE,
    }

以及：
    export interface GameplayTargetData {
        id: string;

        contentType: TargetContentType;

        text?: string;

        spriteFrame?: SpriteFrame;

        shape: TargetShape;

        value?: unknown;

        isBomb?: boolean;
    }

UI 只负责显示。

判断正确与否应该由：
    Gameplay Rule System

负责。

不要让 Target 自己知道：
    我是正确答案

* * *

37. 不通过颜色泄露答案
    =============

这是强规则。

不要：
    正确目标 = 绿色
    错误目标 = 红色

本例：
    7 是绿色
    3 是紫色

只是视觉随机结果。

下一轮完全可能：
    8 = 绿色
    7 = 蓝色

不能影响逻辑。

* * *

38. Asset Strategy
    ==================

尽量复用首页已经存在的：
    Graph Paper
    White Torn Paper
    Red Tape
    Beige Tape
    Marker Texture
    Paper Shadow

不要重新创建另一套纸张语言。

Gameplay 新增：
    target_circle.png
    target_triangle.png
    target_rounded_square.png
    target_pentagon.png
    target_hexagon.png

    bomb.png

    reverse_frame.png

    chaos_paper.png
    heart.png
    timer_icon.png

如果目前没有这些资源：

可以使用 Graphics 暂时实现结构。

但是必须：
    Graphics Placeholder
    ↓
    未来 Sprite

可直接替换。

不要通过复杂代码生成最终纸张纹理。

* * *

39. Target Shape 素材原则
    =====================

非常重要。

Target Shape 图片只包含：
    纸张
    彩色笔触
    黑色外轮廓
    纸边
    轻阴影

绝对不要包含：
    7
    8
    12
    3
    14

数字。

数字全部由：
    TextContent

显示。

这样未来才能支持任意内容。

* * *

40. 文字
    ======

动态文本：
    17
    COMBO
    斩偶数
    反向
    多目标
    15s
    CHAOS
    78%
    7
    8
    12
    3
    14

全部使用 Label。

不要烤进 PNG。

如果当前没有合适的手写字体：

第一阶段允许使用接近的系统字体。

但是统一通过项目 Font Resource 管理。

以后可以一次替换。

* * *

41. 页面不要增加以下内容
    ==============

禁止自行增加：
    暂停按钮
    头像
    积分总数
    金币
    商店
    任务
    排行榜
    技能按钮
    教程
    底部操作按钮
    摇杆
    广告入口
    Logo
    模式名称
    闪电心算标题

Gameplay 信息越少越好。

* * *

42. Prefab
    ==========

建议：
    GameplayHUD.prefab
    ComboDisplay.prefab
    InstructionDisplay.prefab
    RuleBadge.prefab
    TimerLifeDisplay.prefab

    GameplayTarget.prefab
    BombTarget.prefab

    SlashTrail.prefab
    TargetFragment.prefab
    HitEffect.prefab

    ChaosBar.prefab
    ReverseFrame.prefab

但是不要为了形式创建大量空 Prefab。

有明显复用价值才创建。

* * *

43. Object Pool
    ===============

以下对象可能频繁生成：
    GameplayTarget
    BombTarget
    Fragment
    HitEffect
    FloatingText

可以使用简单 Object Pool。

不要引入复杂 Pool Framework。

* * *

44. 本轮性能要求
    ==========

目标平台：
    微信小游戏

不要使用：
    全屏 Shader
    动态 Blur
    大量 ParticleSystem
    复杂 Post Processing
    实时阴影

主要视觉技术：
    Sprite
    Label
    Graphics
    Tween
    简单 Trail
    Object Pool

* * *

45. 当前最终视觉状态
    ============

最终静态 Gameplay 截图应该接近：
                17                 斩偶数                15s
              COMBO             [反向][多目标]           ♥♥♥


                                  8


                    7                           12



                                  3



                   14                      Bomb




            CHAOS  ■■■■■■■■■□□□             78%

但注意：
    Target 之间没有线
    Target 周围没有三点光效
    没有预先显示刀轨

只有：
    玩家真实划动时

才产生 Slash Trail。

* * *

46. 视觉关键词
    =========

始终遵守：
    handmade
    paper cut
    hand drawn
    graph paper
    marker
    colored pencil
    rough edge
    stationery
    indie game
    minimal
    clear
    dynamic
    playful but not childish

避免：
    cyberpunk
    neon
    glassmorphism
    mobile RPG
    education app
    cute preschool
    3D
    photorealistic

* * *

47. 本轮执行步骤
    ==========

首先读取当前项目。

告诉我：
    1. 当前 Gameplay 相关 Scene / Script 是否已经存在
    2. 当前已有的通用 UI / Paper Assets
    3. 首页哪些素材可以直接复用
    4. 当前设计分辨率
    5. 当前 SafeArea 实现方式

然后给出不超过 10 条的实施计划。

之后开始编码。

推荐顺序：
    1. Gameplay Scene / SafeArea
    2. Background
    3. HUD
    4. Generic GameplayTarget
    5. BombTarget
    6. Target Spawn Area
    7. Touch Input
    8. Sweep Hit Detection
    9. Slash Trail
    10. Hit / Split Feedback
    11. Chaos Bar
    12. Responsive Test

* * *

48. 本轮验收
    ========

完成后必须满足：

### UI

    “斩偶数”

是第一视觉信息。
    “反向”

持续可见。

* * *

### Gameplay

屏幕有：
    8
    7
    12
    3
    14
    Bomb

但 Target 系统不依赖这些具体数字。

* * *

### Target 通用性

把：
    7

改为：
    苹果

或者一个 SpriteFrame，

不需要修改 Prefab 结构。

* * *

### 禁止项

页面不存在：
    目标连接线
    虚线箭头
    预判路径
    Target 周围三点光效
    中空圆环 Target

* * *

### Input

只有玩家真实划动时：
    Slash Trail

才出现。

* * *

### Style

与现有首页明显属于同一个游戏：
    米白网格纸
    撕纸
    剪纸
    马克笔
    彩色铅笔
    手绘黑色线稿
    低饱和颜色

* * *

### Adaptation

测试：
    750 × 1624
    9:16
    9:19.5
    9:20

微信胶囊和底部手势区不遮挡关键信息。

* * *

49. 最终原则
    ========

这不是：
    一张问答题页面

也不是：
    传统教育游戏

而应该像：

> 玩家把一堆手工剪下来的纸片扔在草稿纸桌面上，然后用手指像刀一样快速把正确纸片斩开。

UI 的核心不是“精致”。

核心是：
    一眼懂规则
    一眼看到目标
    一划就有爽感
    规则叠加时仍然清楚

在此基础上，再使用手绘剪纸风格建立《BrainSlash》的视觉辨识度。

请先检查现有工程和可复用素材，再实施，不要进行与 Gameplay 无关的大规模项目重构。
