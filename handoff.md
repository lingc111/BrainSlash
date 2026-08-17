# Brain Slash 特效替换 Handoff

更新时间：2026-08-17
工程：`D:\Develop\Cocos\WorkSpace\BrainSlash`
技术栈：Cocos Creator 3.8.8 / TypeScript
GitHub：`https://github.com/lingc111/BrainSlash`

## 1. 当前 Git 状态

- 当前分支：`main`
- 当前 HEAD：`5148f14`（`all MD docs`）
- 特效替换提交：`dcfb3d3`（`Replace gameplay slash effects`）
- 浏览器坐标修复提交：`a84be7a`（`slash opt`）
- 上述提交均已推送到 `origin/main`，本地 `main` 与远程同步。
- 当前未提交内容只有本文件 `handoff.md`。

## 2. 已完成：替换 GameplayTarget 切割特效

旧效果由 `GameplayHUD.paperSplit()` 使用 `Graphics` 即时绘制两块纸片和 4 个碎屑。

现已替换为不同 GameplayTarget 对应的透明 PNG 粉碎特效：

| Target 皮肤 | 特效资源 |
| --- | --- |
| `blue_square` | `blue_square_slash.png` |
| `green_octagon` | `green_octagon_slash.png` |
| `green_triangle` | `green_triangle_slash.png` |
| `orange_circle` | `orange_circle_slash.png` |
| `pink_diamond` | `pink_diamond_slash.png` |
| `purple_hexagon` | `purple_hexagon_slash.png` |
| `red_trapezoid` | `red_trapezoid_slash.png` |
| `yellow_circle` | `yellow_circle_slash.png` |
| 炸弹 | `bomb_slash.png` |

运行时会记录随机 Target 皮肤与特效资源的映射。正确目标、错误目标和炸弹被斩中时都会显示对应 PNG；错误命中仍保留红色错误环、扣生命、断 Combo 和轻震反馈。

## 3. 特效资源与性能处理

原始 PNG 位于：

`D:\Develop\codex\workspaces\BrainSlash\切割粉碎特效`

导入工程的优化版位于：

`assets/resources/textures/gameplay/effects/slash`

处理结果：

- 9 张图片从 `1254 × 1254` 缩放为 `512 × 512`；
- 保留 RGBA 透明通道；
- 预估常驻解码纹理内存从约 54 MB 降至约 9 MB；
- Cocos Asset Database 已刷新，PNG 及 `.meta` 已生成并提交；
- Gameplay 加载时预加载全部 SpriteFrame，避免首次命中才异步加载；
- 特效节点使用 `NodePool` 回收；
- 单次播放约 220 ms：60 ms 快速放大，随后 160 ms 扩散并淡出；
- PNG 整体会根据本次斩击线段旋转，使画面中的斜向刀光与手势方向一致；
- 资源尚未就绪时使用 4 个小纸屑作为降级反馈。

注意：素材中没有 `blue_hexagon_slash.png`。为避免皮肤和粉碎图形不一致，`blue_hexagon` 当前已从随机皮肤列表移除。补充同名资源后，应将它加入 `SLASH_EFFECT_KEYS` 和 `skinNames`。

## 4. 已完成：浏览器鼠标与刀光坐标偏移修复

用户在浏览器预览中发现系统鼠标指针与连续刀光轨迹有明显位置偏差。

根因：`EventTouch.getUILocation()` 已返回经过视口和缩放适配的 UI 坐标，旧实现又把该坐标交给 `GameplayLayer.UITransform.convertToNodeSpaceAR()`，相当于再次应用 Canvas 世界矩阵，在浏览器窗口比例或 Canvas 状态变化时产生二次偏移。

修复已由提交 `a84be7a` 推送到 `origin/main`，位于 `GameplayHUD.touchPoint()`：

```ts
private touchPoint(event: EventTouch): Vec2 {
    const location = event.getUILocation();
    const visible = view.getVisibleSize();
    return new Vec2(location.x - visible.width * 0.5, location.y - visible.height * 0.5);
}
```

这使输入坐标直接转换为以屏幕中心为原点的 `GameplayLayer` 本地坐标，连续刀光和碰撞检测使用同一组点。

用户明确要求：不要增加持续跟随指针的短刀光头。此前尝试的 `SlashCursorLayer` 已完全撤销，当前工作区不存在该节点或相关逻辑。

## 5. 关键代码位置

主文件：`assets/Scripts/UI/GameplayHUD.ts`

- `SLASH_EFFECT_KEYS`：允许加载的特效资源键；
- `targetSlashEffects`：Target Node 到特效键的运行时映射；
- `slashFrames`：预加载后的 SpriteFrame 缓存；
- `slashEffectPool`：PNG 特效节点对象池；
- `applyRandomTargetSkins()`：随机皮肤和特效键绑定；
- `touchPoint()`：浏览器/触屏输入坐标换算；
- `sweep()`：连续手势线段命中检测；
- `playSlashEffect()`：对应 PNG 的播放、旋转、淡出和回收；
- `playFallbackBurst()`：资源未加载时的低成本降级效果；
- `respawn()`：目标在 280 ms 后重新出现。

目标碰撞实现位于：`assets/Scripts/UI/GameplayTarget.ts`

- `segmentHit(a, b)` 使用连续手势线段到目标中心的最近距离判断，不只检测触点终点。

## 6. 已完成验证

- 9 张优化 PNG 均为 `512 × 512`、32 位 RGBA；
- 9 个 PNG 的 Cocos `.meta` 均显示 `imported: true`、`hasAlpha: true`、`type: sprite-frame`；
- `GameplayHUD.ts` 与 `GameplayTarget.ts` 通过定向严格 TypeScript `noEmit` 检查；
- `git diff --check` 通过；
- Cocos Asset Database 已对特效目录和脚本执行刷新。

完整工程的诊断工具会报告 Cocos Creator 3.8.8 引擎声明文件中的既有错误，例如缺少 WebGPU 类型、`pal/*` 模块和动画声明命名空间。这些错误不位于项目 `assets` 脚本中，也不是本次改动引入；定向项目脚本检查通过。

## 7. 接手后的建议操作

1. 在浏览器预览中强制刷新，按横向、纵向和斜向拖动，确认刀光中心与系统鼠标指针重合。
2. 分别斩中正确目标、错误目标和炸弹，确认对应 PNG、错误环、生命和 Combo 状态正常。
3. 在不同浏览器窗口比例下重复测试，尤其是非 9:19.5 的宽窗口和缩放后的窗口。
4. 将本文件 `handoff.md` 纳入版本控制；除此之外当前没有待提交代码修改。
5. 如补充 `blue_hexagon_slash.png`，恢复蓝色六边形随机皮肤并重新验证映射。

## 8. 不应破坏的交互约束

- 刀光必须从实际鼠标/手指轨迹产生；
- 输入、命中和音效时机优先于复杂视觉效果；
- 特效总反馈应短促，不遮挡下一题；
- 不增加 Gameplay 底部操作栏；
- 不用持续跟随指针的额外刀尖或光点；
- 低端设备应优先减少粒子和拖尾，不降低输入响应。

## 9. 2026-08-18 MVP 纵切更新

本轮已在不破坏旧编辑器视觉基线的前提下加入运行时 `GameplayMVP`：

- Home 的今日挑战和 60 秒乱斗按钮已能进入 Gameplay，并传递模式、Seed 与内容版本；
- Gameplay 已接入 60 秒、3 生命、分数、Combo、题目超时、Master Hit 和一次性结算；
- 加入纯 TypeScript 的确定性 RNG、题目生成、规则、手势、计分、难度、公平性和 GameSession 模块；
- 支持标准、反向、多目标、顺序、Stroop 与炸弹，炸弹不会被 Reverse 变为正确项；
- 加入六主题最小纵切内容、首次复杂规则无惩罚教学、本地存档和设置弹窗；
- 结算以 Gameplay 内全屏 Result 覆盖层实现，支持再来一局、挑战好友和返回首页；
- 微信分享载荷包含 `seed/contentVersion/recipeId/targetScore`，版本不兼容时不会恢复挑战；
- 切后台冻结局内逻辑，恢复前显示 600ms `READY`；
- `tests/domain.test.ts` 包含 1000 Seed 确定性与合法性回归。

尚未完成的发布工作：独立 Boot/Result 场景、正式音频资源、每主题 5 个题型族及完整审核素材量、三档真机十局测试、微信开发者工具提审构建。当前实现是可玩的 MVP 纵切，不应将这些发布门禁标记为完成。
