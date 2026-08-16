// Rebuilds the Gameplay scene through Funplay Cocos MCP's scene context.
// This file is intentionally plain JavaScript so it can run inside Creator's renderer.

return (() => {
const currentScene = cc.director.getScene();
const canvasNode = cc.find('Canvas');
const oldPage = cc.find('Canvas/HomePage');
const roundedFrame = cc.find('Canvas/HomePage/ChallengeCard_Today/__VisualBase')
    ?.getComponent(cc.Sprite)?.spriteFrame;
const solidFrame = cc.find('Canvas/HomePage/Background/__VisualBase')
    ?.getComponent(cc.Sprite)?.spriteFrame || roundedFrame;

if (!currentScene || !canvasNode || !roundedFrame) {
    throw new Error('Gameplay builder requires the cloned Home scene and its UI sprite frames.');
}

const C = {
    bg: new cc.Color(0x17, 0x11, 0x2f, 0xff),
    bg2: new cc.Color(0x6f, 0x53, 0xfd, 0xff),
    surface: new cc.Color(0x25, 0x1b, 0x4a, 0xff),
    raised: new cc.Color(0x30, 0x24, 0x5c, 0xff),
    cyan: new cc.Color(0x55, 0xe6, 0xd2, 0xff),
    cyanDeep: new cc.Color(0x16, 0x9b, 0x89, 0xff),
    white: new cc.Color(0xff, 0xfe, 0xff, 0xff),
    shadow: new cc.Color(0x0d, 0x08, 0x21, 0xff),
    violet: new cc.Color(0xa7, 0x7d, 0xfe, 0xff),
    green: new cc.Color(0x70, 0xe8, 0x8b, 0xff),
    red: new cc.Color(0xff, 0x4d, 0x6d, 0xff),
    yellow: new cc.Color(0xff, 0xd1, 0x66, 0xff),
    text: new cc.Color(0xf7, 0xfa, 0xff, 0xff),
    muted: new cc.Color(0x9a, 0xa7, 0xc2, 0xff),
};

function node(parent, name, x, y, w, h) {
    const n = new cc.Node(name);
    n.layer = 1 << 25;
    n.parent = parent;
    n.setPosition(x, y, 0);
    n.addComponent(cc.UITransform).setContentSize(w, h);
    return n;
}

function sprite(parent, name, x, y, w, h, color, frame = roundedFrame) {
    const n = node(parent, name, x, y, w, h);
    const s = n.addComponent(cc.Sprite);
    s.spriteFrame = frame;
    s.type = cc.Sprite.Type.SLICED;
    s.sizeMode = cc.Sprite.SizeMode.CUSTOM;
    s.color = color;
    n.getComponent(cc.UITransform).setContentSize(w, h);
    return n;
}

function label(parent, name, text, x, y, w, h, size, color, options = {}) {
    const n = node(parent, name, x, y, w, h);
    const l = n.addComponent(cc.Label);
    l.string = text;
    l.fontSize = size;
    l.lineHeight = options.lineHeight || Math.round(size * 1.12);
    l.color = color;
    l.horizontalAlign = options.align === 'left' ? cc.Label.HorizontalAlign.LEFT
        : options.align === 'right' ? cc.Label.HorizontalAlign.RIGHT
        : cc.Label.HorizontalAlign.CENTER;
    l.verticalAlign = cc.Label.VerticalAlign.CENTER;
    l.overflow = cc.Label.Overflow.SHRINK;
    l.isBold = options.bold !== false;
    if (options.outline) {
        const outline = n.addComponent(cc.LabelOutline);
        outline.color = options.outlineColor || C.shadow;
        outline.width = options.outline;
    }
    n.getComponent(cc.UITransform).setContentSize(w, h);
    return n;
}

function arcadePanel(parent, name, x, y, w, h, fill, depth = 8, outline = 4) {
    const root = node(parent, name, x, y, w, h);
    sprite(root, '__ArcadeDepth', 0, -depth, w, h, C.shadow);
    sprite(root, '__VisualBase', 0, 0, w, h, C.white);
    sprite(root, '__VisualFill', 0, 0, w - outline * 2, h - outline * 2, fill);
    return root;
}

function chip(parent, name, text, x, y, w, fill, textColor = C.text, size = 24) {
    const p = arcadePanel(parent, name, x, y, w, 52, fill, 5, 3);
    label(p, `${name}Label`, text, 0, 1, w - 20, 42, size, textColor, { outline: 2 });
    return p;
}

function target(parent, name, value, x, y, fill, rotation = 0, subtitle = '') {
    const p = arcadePanel(parent, name, x, y, 150, 132, fill, 10, 5);
    p.setRotationFromEuler(0, 0, rotation);
    label(p, `${name}Value`, value, 0, subtitle ? 12 : 0, 122, 74, 56, C.text, { outline: 5 });
    if (subtitle) label(p, `${name}Hint`, subtitle, 0, -38, 118, 26, 17, C.text, { outline: 2 });
    return p;
}

oldPage.removeFromParent();
oldPage.destroy();

const root = node(canvasNode, 'GameplayPage', 0, 0, 750, 1624);

const background = node(root, 'Background', 0, 0, 750, 1624);
sprite(background, '__VisualBase', 0, 0, 750, 1624, C.bg, solidFrame);
sprite(background, 'PurpleGlowTop', 40, 560, 920, 520, new cc.Color(0x6f, 0x53, 0xfd, 0x72), solidFrame).setRotationFromEuler(0, 0, -8);
sprite(background, 'PurpleGlowBottom', -100, -590, 860, 390, new cc.Color(0xa6, 0x59, 0xfe, 0x35), solidFrame).setRotationFromEuler(0, 0, 10);
for (const [i, spec] of [[-280, 410, 100], [250, 300, 120], [-300, -40, 84], [265, -230, 110], [-250, -520, 96]].entries()) {
    const [x, y, w] = spec;
    const line = sprite(background, `SpeedLine_${i + 1}`, x, y, w, 5, new cc.Color(0x55, 0xe6, 0xd2, 0x55), solidFrame);
    line.setRotationFromEuler(0, 0, -18);
}

const danger = node(root, 'DangerFrame', 0, 0, 750, 1624);
sprite(danger, 'DangerLeft', -369, 0, 12, 1624, new cc.Color(0xff, 0x4d, 0x6d, 0x88), solidFrame);
sprite(danger, 'DangerRight', 369, 0, 12, 1624, new cc.Color(0xff, 0x4d, 0x6d, 0x88), solidFrame);
sprite(danger, 'DangerTop', 0, 806, 750, 12, new cc.Color(0xff, 0x4d, 0x6d, 0x88), solidFrame);
sprite(danger, 'DangerBottom', 0, -806, 750, 12, new cc.Color(0xff, 0x4d, 0x6d, 0x88), solidFrame);

const topHud = node(root, 'TopHUD', 0, 598, 670, 220);
const safeClass = cc.js.getClassByName('WechatSafeArea');
if (safeClass) {
    const safe = topHud.addComponent(safeClass);
    safe.topPadding = 14;
    safe.fallbackTopInset = 88;
}

const combo = arcadePanel(topHud, 'ComboChip', -263, 34, 144, 104, C.surface, 7, 4);
label(combo, 'ComboCaption', 'COMBO', 0, 25, 116, 26, 18, C.cyan, { outline: 2 });
label(combo, 'ComboValue', '17', 0, -14, 112, 60, 48, C.text, { outline: 4 });

chip(topHud, 'RuleBadge', '反向  ·  多目标 ×2', 0, 72, 310, C.red, C.white, 23);
label(topHud, 'PromptLabel', '斩错误项', 0, 6, 330, 68, 50, C.text, { outline: 5 });
label(topHud, 'ReverseHint', '基础条件：偶数', 0, -50, 330, 36, 20, C.yellow, { outline: 2 });

const status = arcadePanel(topHud, 'StatusChip', 263, 34, 144, 104, C.surface, 7, 4);
label(status, 'TimerLabel', '00:15', 0, 22, 120, 42, 28, C.yellow, { outline: 3 });
label(status, 'LivesLabel', '♥♥♥', 0, -22, 120, 34, 24, C.red, { outline: 2 });

label(root, 'PlayfieldCaption', 'SLASH ZONE  ·  连续划动判定', 0, 430, 520, 36, 19, C.muted, { outline: 2 });

const playfield = node(root, 'Playfield', 0, -22, 690, 860);
target(playfield, 'Target_12', '12', -198, 252, C.cyanDeep, -6);
target(playfield, 'Target_7', '7', 176, 212, C.bg2, 7);
target(playfield, 'Target_18', '18', 228, -72, C.violet, -5);
target(playfield, 'Target_5', '5', -178, -118, new cc.Color(0xef, 0x7a, 0x45, 0xff), 5);

const bomb = arcadePanel(playfield, 'BombTarget', 34, -322, 156, 142, C.shadow, 10, 5);
label(bomb, 'BombIcon', '✹', 0, 13, 110, 72, 54, C.red, { outline: 5 });
label(bomb, 'BombLabel', '禁区', 0, -41, 110, 30, 20, C.yellow, { outline: 2 });
sprite(bomb, 'BombStripeLeft', -58, 0, 10, 108, C.red, solidFrame).setRotationFromEuler(0, 0, -12);
sprite(bomb, 'BombStripeRight', 58, 0, 10, 108, C.red, solidFrame).setRotationFromEuler(0, 0, -12);

const slash = node(playfield, 'SlashTrail_Preview', 0, 34, 360, 130);
for (const [i, spec] of [[-115, -35, 250, 10], [-34, 5, 220, 7], [58, 42, 170, 5]].entries()) {
    const [x, y, w, h] = spec;
    const trail = sprite(slash, `Trail_${i + 1}`, x, y, w, h, i === 0 ? C.white : C.cyan, solidFrame);
    trail.setRotationFromEuler(0, 0, 24);
}

const feedback = arcadePanel(root, 'MasterFeedback', 100, -30, 214, 66, C.yellow, 6, 3);
feedback.setRotationFromEuler(0, 0, -5);
label(feedback, 'MasterText', 'MASTER +240', 0, 1, 192, 48, 24, C.shadow, { outline: 0 });

const chaos = arcadePanel(root, 'ChaosBar', 0, -692, 646, 112, C.surface, 8, 4);
label(chaos, 'ChaosTitle', 'CHAOS  ·  扩展机制', -205, 25, 210, 30, 18, C.violet, { align: 'left', outline: 2 });
label(chaos, 'ChaosValue', '78%', 246, 25, 92, 30, 21, C.yellow, { align: 'right', outline: 2 });
const chaosTrack = sprite(chaos, 'ChaosTrack', 0, -24, 566, 26, C.shadow);
const chaosFill = sprite(chaosTrack, 'ChaosFill', -62, 0, 438, 18, C.violet);
chaosFill.getComponent(cc.UITransform).anchorX = 0;
chaosFill.setPosition(-283, 0, 0);
sprite(chaosTrack, 'ChaosHot', 126, 0, 120, 18, C.red).getComponent(cc.UITransform).anchorX = 0;
chaosTrack.getChildByName('ChaosHot').setPosition(103, 0, 0);

// Keep the editor camera centered on the 750 × 1624 design frame.
const editorCamera = cc.find('Editor Scene Background/Editor Camera');
if (editorCamera) {
    editorCamera.setPosition(375, 812, 5000);
    const camera = editorCamera.getComponent(cc.Camera);
    if (camera) camera.orthoHeight = 900;
}

return {
    scene: currentScene.name,
    root: root.name,
    targetCount: 5,
    rule: '反向 + 多目标',
    chaos: 'extension',
};
})();
