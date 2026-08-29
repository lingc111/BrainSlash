import {
    _decorator, Color, Component, EventTouch, Graphics, Label, Node, NodePool,
    ResolutionPolicy, Sprite, SpriteFrame, tween, UIOpacity, UITransform,
    Tween, Vec2, Vec3, view, resources,
} from 'cc';
import { EDITOR } from 'cc/env';
import { GameplayTarget, GameplayTargetData, TargetContentType } from './GameplayTarget';
import { GameplayMVP } from './GameplayMVP';
import { ACTIVE_TARGET_SKINS } from './TargetSkinSizing';
import { applyGameFont } from './GameFont';

const { ccclass, executeInEditMode } = _decorator;

export interface GameplayHUDState {
    combo: number;
    remainingTime: number;
    life: number;
    maxLife: number;
    instruction: string;
}


type LayoutPoint = { x: number; y: number };

const SLASH_EFFECT_KEYS = [
    'bomb', ...ACTIVE_TARGET_SKINS,
] as const;
type SlashEffectKey = typeof SLASH_EFFECT_KEYS[number];

const INK = new Color(45, 43, 39, 255);
const PAPER = new Color(255, 250, 236, 255);
const RED = new Color(174, 69, 61, 255);
const BLUE = new Color(91, 133, 156, 255);
const YELLOW = new Color(226, 184, 67, 255);
const GREEN = new Color(109, 152, 106, 255);
const PURPLE = new Color(137, 111, 158, 255);
const ORANGE = new Color(207, 132, 70, 255);

function ui(node: Node, width: number, height: number): UITransform {
    const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
    transform.setContentSize(width, height);
    transform.setAnchorPoint(0.5, 0.5);
    return transform;
}

function makeNode(name: string, parent: Node, width = 0, height = 0): Node {
    const node = new Node(name);
    parent.addChild(node);
    ui(node, width, height);
    return node;
}

function label(parent: Node, name: string, text: string, size: number, color = INK): Label {
    const node = makeNode(name, parent, Math.max(90, text.length * size * 1.2), size * 1.5);
    const result = node.addComponent(Label);
    result.string = text;
    result.fontSize = size;
    result.lineHeight = size * 1.2;
    result.color = color;
    result.horizontalAlign = Label.HorizontalAlign.CENTER;
    result.verticalAlign = Label.VerticalAlign.CENTER;
    result.enableWrapText = false;
    return applyGameFont(result);
}

function graphics(parent: Node, name: string, width: number, height: number): Graphics {
    return makeNode(name, parent, width, height).addComponent(Graphics);
}

function polygon(g: Graphics, points: Vec2[], fill: Color, stroke = INK, width = 4): void {
    g.clear();
    g.fillColor = fill;
    g.strokeColor = stroke;
    g.lineWidth = width;
    g.lineJoin = Graphics.LineJoin.ROUND;
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
    g.close();
    g.fill();
    g.stroke();
}


@ccclass('GameplayHUD')
@executeInEditMode(true)
export class GameplayHUD extends Component {
    private state: GameplayHUDState = { combo: 17, remainingTime: 15, life: 3, maxLife: 3, instruction: '斩偶数' };
    private reverse = true;
    private gameplayLayer!: Node;
    private targetContainer!: Node;
    private trail!: Graphics;
    private comboValue!: Label;
    private timerValue!: Label;
    private lifeValue!: Label;
    private touchPoints: Vec2[] = [];
    private readonly targetSlashEffects = new Map<Node, SlashEffectKey>();
    private readonly slashFrames = new Map<SlashEffectKey, SpriteFrame>();
    private readonly slashEffectPool = new NodePool();
    private trailAge = 1;
    private started = false;
    private elapsed = 0;
    private layoutWidth = 750;
    private layoutHeight = 1624;

    protected onLoad(): void {
        if (!EDITOR) {
            this.enabled = false;
            if (!this.getComponent(GameplayMVP)) this.node.addComponent(GameplayMVP);
            return;
        }
        if (!EDITOR) view.setDesignResolutionSize(750, 1624, ResolutionPolicy.SHOW_ALL);
        this.rebuildGameplay();
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        this.slashEffectPool.clear();
    }

    protected update(dt: number): void {
        if (this.started && this.state.remainingTime > 0) {
            this.elapsed += dt;
            if (this.elapsed >= 1) {
                const seconds = Math.floor(this.elapsed);
                this.elapsed -= seconds;
                this.state.remainingTime = Math.max(0, this.state.remainingTime - seconds);
                this.refreshHUD();
            }
        }
        if (this.trailAge < 0.14) {
            this.trailAge += dt;
            this.drawTrail(Math.max(0, 1 - this.trailAge / 0.14));
        } else if (this.trail && this.touchPoints.length) {
            this.touchPoints.length = 0;
            this.trail.clear();
        }
    }

    public rebuildGameplay(): void {
        for (const child of [...this.node.children]) {
            child.removeFromParent();
            child.destroy();
        }
        const oldAdapter = this.getComponent('GameplayScreenAdapter');
        if (oldAdapter) oldAdapter.enabled = false;

        const visible = view.getVisibleSize();
        this.layoutWidth = EDITOR ? 750 : Math.max(750, visible.width);
        this.layoutHeight = EDITOR ? 1624 : Math.max(1624, visible.height);
        ui(this.node, this.layoutWidth, this.layoutHeight);

        const background = makeNode('BackgroundLayer', this.node, this.layoutWidth, this.layoutHeight);
        const base = graphics(background, 'WarmPaperBase', this.layoutWidth, this.layoutHeight);
        base.fillColor = new Color(246, 238, 218, 255);
        base.rect(-this.layoutWidth / 2, -this.layoutHeight / 2, this.layoutWidth, this.layoutHeight); base.fill();
        this.addTexture(background, 'GraphPaper', 'textures/home/paper/bg_graph_paper/spriteFrame', this.layoutWidth, this.layoutHeight);

        const safeRoot = makeNode('SafeAreaRoot', this.node, this.layoutWidth, this.layoutHeight);
        this.buildReverseFrame(safeRoot);
        this.gameplayLayer = makeNode('GameplayLayer', safeRoot, this.layoutWidth, this.layoutHeight);
        this.targetContainer = makeNode('TargetContainer', this.gameplayLayer, this.layoutWidth, this.layoutHeight);
        this.trail = graphics(this.gameplayLayer, 'SlashTrailLayer', this.layoutWidth, this.layoutHeight);
        makeNode('HitEffectLayer', this.gameplayLayer, this.layoutWidth, this.layoutHeight);
        makeNode('FragmentLayer', this.gameplayLayer, this.layoutWidth, this.layoutHeight);
        makeNode('FloatingTextLayer', this.gameplayLayer, this.layoutWidth, this.layoutHeight);

        this.targetSlashEffects.clear();
        this.preloadSlashEffects();

        const hud = makeNode('HUDLayer', safeRoot, this.layoutWidth, this.layoutHeight);
        this.buildHUD(hud);
        makeNode('BottomSafeArea', safeRoot, this.layoutWidth, 52).setPosition(0, -this.layoutHeight / 2 + 26);
        this.spawnTargets();
        this.applyRandomTargetSkins();
        this.bindInput();
        this.refreshHUD();
    }

    private buildHUD(hud: Node): void {
        const top = this.layoutHeight / 2 - this.getTopInset() - 112;

        const combo = makeNode('ComboDisplay', hud, 170, 158);
        combo.setPosition(-this.layoutWidth / 2 + 112, top - 18);
        this.paperShadow(combo, 'PaperShadow', 154, 128, 7, -10, -2);
        const comboBacking = this.addTexture(combo, 'BackingPaper', 'textures/home/paper/daily_paper/spriteFrame', 154, 130);
        comboBacking.color = new Color(230, 218, 188, 255); comboBacking.node.setPosition(4, -5); comboBacking.node.angle = -2.2;
        const comboPaper = this.addTexture(combo, 'Paper', 'textures/home/paper/daily_paper/spriteFrame', 158, 134);
        comboPaper.node.setPosition(-2, 2); comboPaper.node.angle = 1;
        this.comboValue = label(combo, 'ComboValue', '17', 60).getComponent(Label)!;
        this.comboValue.node.setPosition(0, 19);
        const comboText = label(combo, 'ComboLabel', 'COMBO', 22, RED); comboText.node.setPosition(0, -36);
        const underline = graphics(combo, 'MarkerUnderline', 86, 10);
        underline.strokeColor = RED; underline.lineWidth = 7; underline.moveTo(-39, 0); underline.bezierCurveTo(-10, -3, 17, 3, 42, 0); underline.stroke(); underline.node.setPosition(0, -60);

        const instruction = makeNode('InstructionDisplay', hud, 344, 150);
        instruction.setPosition(0, top);
        this.paperShadow(instruction, 'PaperShadow', 322, 120, 9, -11, 1);
        const noteBacking = this.addTexture(instruction, 'BackingPaper', 'textures/home/paper/daily_paper/spriteFrame', 322, 122);
        noteBacking.color = new Color(228, 216, 187, 255); noteBacking.node.setPosition(7, -6); noteBacking.node.angle = 1.6;
        const notePaper = this.addTexture(instruction, 'PaperBackground', 'textures/home/paper/daily_paper/spriteFrame', 324, 126);
        notePaper.node.setPosition(-3, 2); notePaper.node.angle = -0.8;
        const tapeShadow = this.paperShadow(instruction, 'TapeShadow', 110, 26, 4, 55, 0);
        tapeShadow.node.setScale(1, 0.65, 1);
        const tape = this.addTexture(instruction, 'Tape', 'textures/home/paper/tape_red/spriteFrame', 114, 35);
        tape.node.setPosition(0, 61); tape.node.angle = 1.5;
        label(instruction, 'InstructionLabel', this.state.instruction, 53).isBold = true;

        const badges = makeNode('RuleBadgeGroup', hud, 340, 82);
        badges.setPosition(0, top - 119);
        this.paperBadge(badges, 'ReverseBadge', '↔  反向', RED, -86);
        this.paperBadge(badges, 'MultiTargetBadge', '◎  多选', BLUE, 86);

        const timer = makeNode('TimerLifeGroup', hud, 176, 158);
        timer.setPosition(this.layoutWidth / 2 - 112, top - 18);
        this.paperShadow(timer, 'PaperShadow', 160, 128, 8, -10, 2);
        const timerBacking = this.addTexture(timer, 'BackingPaper', 'textures/home/paper/daily_paper/spriteFrame', 160, 130);
        timerBacking.color = new Color(230, 218, 188, 255); timerBacking.node.setPosition(5, -5); timerBacking.node.angle = 2;
        const timerPaper = this.addTexture(timer, 'Paper', 'textures/home/paper/daily_paper/spriteFrame', 166, 134);
        timerPaper.node.setPosition(-2, 2); timerPaper.node.angle = -1;
        this.timerValue = label(timer, 'TimerLabel', '15s', 45).getComponent(Label)!;
        this.timerValue.node.setPosition(0, 22);
        this.lifeValue = label(timer, 'LifeContainer', '♥ ♥ ♥', 31, RED).getComponent(Label)!;
        this.lifeValue.node.setPosition(0, -34);
    }

    private paperBadge(parent: Node, name: string, text: string, color: Color, x: number): void {
        const badge = makeNode(name, parent, 164, 72);
        badge.setPosition(x, 0);
        const points = [new Vec2(-77, -28), new Vec2(-72, 28), new Vec2(73, 31), new Vec2(78, -26)];
        const shadow = graphics(badge, 'ContactShadow', 164, 72);
        shadow.node.setPosition(6, -7);
        polygon(shadow, points, new Color(65, 50, 36, 48), new Color(65, 50, 36, 10), 2);
        const thickness = graphics(badge, 'PaperThickness', 164, 72);
        thickness.node.setPosition(2, -3);
        polygon(thickness, points, new Color(224, 210, 178, 255), new Color(82, 70, 54, 160), 3);
        const g = graphics(badge, 'MarkerPaper', 158, 65);
        polygon(g, points, new Color(color.r, color.g, color.b, name === 'ReverseBadge' ? 235 : 210), INK, 3);
        const texture = graphics(badge, 'MarkerTexture', 120, 44);
        texture.strokeColor = new Color(255, 248, 224, 32); texture.lineWidth = 2;
        texture.moveTo(-45, 12); texture.bezierCurveTo(-12, 8, 15, 15, 46, 10);
        texture.moveTo(-39, -11); texture.bezierCurveTo(-10, -15, 20, -8, 39, -12); texture.stroke();
        label(badge, 'Label', text, 27, PAPER).isBold = true;
    }

    private paperShadow(parent: Node, name: string, width: number, height: number, x: number, y: number, angle = 0): Graphics {
        const shadow = graphics(parent, name, width + 18, height + 18);
        shadow.node.setPosition(x, y); shadow.node.angle = angle;
        polygon(shadow, [
            new Vec2(-width / 2, -height / 2 + 3), new Vec2(-width / 2 + 5, height / 2),
            new Vec2(width / 2 - 4, height / 2 - 2), new Vec2(width / 2, -height / 2),
        ], new Color(68, 52, 36, 48), new Color(68, 52, 36, 8), 2);
        return shadow;
    }

    private buildReverseFrame(root: Node): void {
        const frame = graphics(root, 'ReverseFrame', this.layoutWidth - 24, this.layoutHeight - 28);
        frame.strokeColor = new Color(174, 69, 61, 155);
        frame.lineWidth = 7;
        const w = this.layoutWidth / 2 - 17, h = this.layoutHeight / 2 - 18;
        frame.moveTo(-w + 4, -h); frame.lineTo(w, -h + 3); frame.lineTo(w - 3, h); frame.lineTo(-w, h - 4); frame.close(); frame.stroke();
        const opacity = frame.node.addComponent(UIOpacity); opacity.opacity = 155;
        tween(opacity).repeatForever(tween().to(0.6, { opacity: 178 }).to(0.6, { opacity: 145 })).start();
    }

    private spawnTargets(): void {
        const topHudBottom = this.layoutHeight / 2 - this.getTopInset() - 270;
        const gameplayBottom = -this.layoutHeight / 2 + this.getBottomInset() + 90;
        const areaHeight = topHudBottom - gameplayBottom;
        const centerY = (topHudBottom + gameplayBottom) / 2;
        const positions: LayoutPoint[] = [
            { x: 0, y: centerY + areaHeight * 0.34 },
            { x: -205, y: centerY + areaHeight * 0.12 },
            { x: 205, y: centerY + areaHeight * 0.10 },
            { x: 28, y: centerY - areaHeight * 0.14 },
            { x: -205, y: centerY - areaHeight * 0.36 },
            { x: 205, y: centerY - areaHeight * 0.37 },
        ];
        const data: GameplayTargetData[] = [
            { id: 'eight', contentType: TargetContentType.TEXT, text: '8', value: 8, shape: 'roundedSquare', color: YELLOW },
            { id: 'seven', contentType: TargetContentType.TEXT, text: '7', value: 7, shape: 'circle', color: GREEN },
            { id: 'twelve', contentType: TargetContentType.TEXT, text: '12', value: 12, shape: 'hexagon', color: BLUE },
            { id: 'three', contentType: TargetContentType.TEXT, text: '3', value: 3, shape: 'circle', color: PURPLE },
            { id: 'fourteen', contentType: TargetContentType.TEXT, text: '14', value: 14, shape: 'roundedSquare', color: ORANGE },
            { id: 'bomb', contentType: TargetContentType.ICON, shape: 'circle', isBomb: true, color: INK },
        ];
        data.forEach((item, index) => {
            const node = makeNode(item.isBomb ? 'BombTarget' : `GameplayTarget_${item.id}`, this.targetContainer, 168, 168);
            node.setPosition(positions[index].x, positions[index].y);
            node.angle = [-3, 2, -2, 3, -1, 2][index];
            const target = node.addComponent(GameplayTarget);
            target.configure(item);
            const delay = index * 0.12;
            tween(node).delay(delay).repeatForever(tween().by(1.15 + index * 0.08, { position: new Vec3(0, 3 + index % 3, 0), angle: 1 }).by(1.15 + index * 0.08, { position: new Vec3(0, -3 - index % 3, 0), angle: -1 })).start();
        });
    }

    private applyRandomTargetSkins(): void {
        const skinNames = ACTIVE_TARGET_SKINS;
        const targets = this.targetContainer.children.filter((node) => node.name !== 'BombTarget');
        targets.forEach((node, index) => {
            const skinName = skinNames[index] as SlashEffectKey;
            this.targetSlashEffects.set(node, skinName);
            const path = 'textures/gameplay/targets/' + skinName + '/spriteFrame';
            resources.load(path, SpriteFrame, (error, frame) => {
                const target = node.getComponent(GameplayTarget);
                if (!error && target?.isValid) target.applySkin(frame);
            });
        });

        const bombNode = this.targetContainer.getChildByName('BombTarget');
        if (bombNode) this.targetSlashEffects.set(bombNode, 'bomb');
        resources.load('textures/gameplay/targets/bomb/spriteFrame', SpriteFrame, (error, frame) => {
            const bomb = bombNode?.getComponent(GameplayTarget);
            if (!error && bomb?.isValid) bomb.applySkin(frame);
        });
    }

    private bindInput(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private onTouchStart(event: EventTouch): void {
        this.started = true;
        this.touchPoints = [this.touchPoint(event)];
        this.trailAge = 0;
        this.drawTrail(1);
    }

    private onTouchMove(event: EventTouch): void {
        const point = this.touchPoint(event);
        const previous = this.touchPoints[this.touchPoints.length - 1];
        if (!previous || Vec2.distance(previous, point) < 4) return;
        this.touchPoints.push(point);
        if (this.touchPoints.length > 18) this.touchPoints.shift();
        this.sweep(previous, point);
        this.trailAge = 0;
        this.drawTrail(1);
    }

    private onTouchEnd(): void {
        this.trailAge = 0;
    }

    private touchPoint(event: EventTouch): Vec2 {
        const location = event.getUILocation();
        const visible = view.getVisibleSize();
        return new Vec2(location.x - visible.width * 0.5, location.y - visible.height * 0.5);
    }

    private drawTrail(alpha: number): void {
        if (!this.trail) return;
        this.trail.clear();
        if (this.touchPoints.length < 2 || alpha <= 0) return;
        const draw = (width: number, color: Color): void => {
            this.trail.lineCap = Graphics.LineCap.ROUND;
            this.trail.lineJoin = Graphics.LineJoin.ROUND;
            this.trail.lineWidth = width;
            this.trail.strokeColor = color;
            this.trail.moveTo(this.touchPoints[0].x, this.touchPoints[0].y);
            for (let i = 1; i < this.touchPoints.length; i++) this.trail.lineTo(this.touchPoints[i].x, this.touchPoints[i].y);
            this.trail.stroke();
        };
        draw(16, new Color(148, 187, 199, Math.round(95 * alpha)));
        draw(8, new Color(255, 253, 241, Math.round(235 * alpha)));
    }

    private sweep(a: Vec2, b: Vec2): void {
        for (const node of [...this.targetContainer.children]) {
            const target = node.getComponent(GameplayTarget);
            if (!target || target.hit || !target.segmentHit(a, b)) continue;
            target.hit = true;
            if (target.data.isBomb || !this.isCorrect(target.data.value)) this.wrongHit(target, a, b);
            else this.correctHit(target, a, b);
        }
    }

    private isCorrect(value: unknown): boolean {
        if (typeof value !== 'number') return false;
        const matchesInstruction = value % 2 === 0;
        return this.reverse ? !matchesInstruction : matchesInstruction;
    }

    private correctHit(target: GameplayTarget, a: Vec2, b: Vec2): void {
        this.state.combo += 1;
        this.refreshHUD();
        tween(this.comboValue.node).to(0.1, { scale: new Vec3(1.12, 1.12, 1) }).to(0.1, { scale: Vec3.ONE }).start();
        this.playSlashEffect(target, a, b);
        this.floatingText(target.node.position, '+1', GREEN);
        this.scheduleOnce(() => this.respawn(target), 0.28);
    }

    private wrongHit(target: GameplayTarget, a: Vec2, b: Vec2): void {
        this.state.combo = 0;
        this.state.life = Math.max(0, this.state.life - 1);
        this.refreshHUD();
        const ring = graphics(this.gameplayLayer.getChildByName('HitEffectLayer')!, 'ErrorMarkerRing', 190, 190);
        ring.node.setPosition(target.node.position);
        ring.strokeColor = new Color(181, 55, 49, 220); ring.lineWidth = 12; ring.circle(0, 0, 80); ring.stroke();
        const opacity = ring.node.addComponent(UIOpacity);
        tween(ring.node).to(0.18, { scale: new Vec3(1.18, 1.18, 1) }).start();
        tween(opacity).to(0.24, { opacity: 0 }).call(() => ring.node.destroy()).start();
        const wxApi = (globalThis as { wx?: { vibrateShort?: (options?: object) => void } }).wx;
        wxApi?.vibrateShort?.({ type: 'light' });
        this.playSlashEffect(target, a, b);
        this.scheduleOnce(() => this.respawn(target), 0.28);
    }

    private preloadSlashEffects(): void {
        for (const key of SLASH_EFFECT_KEYS) {
            if (this.slashFrames.has(key)) continue;
            resources.load(`textures/gameplay/effects/slash/${key}_slash/spriteFrame`, SpriteFrame, (error, frame) => {
                if (!error && frame?.isValid) this.slashFrames.set(key, frame);
            });
        }
    }

    private playSlashEffect(target: GameplayTarget, a: Vec2, b: Vec2): void {
        const key = this.targetSlashEffects.get(target.node);
        const frame = key ? this.slashFrames.get(key) : undefined;
        target.node.active = false;
        if (!frame) {
            this.playFallbackBurst(target.node.position);
            return;
        }

        const layer = this.gameplayLayer.getChildByName('HitEffectLayer')!;
        const effectNode = this.slashEffectPool.size() > 0
            ? this.slashEffectPool.get()!
            : makeNode('SlashBurst', layer, 310, 310);
        if (!effectNode.parent) layer.addChild(effectNode);
        effectNode.name = `SlashBurst_${key}`;
        effectNode.active = true;
        effectNode.setPosition(target.node.position);
        effectNode.setScale(0.76, 0.76, 1);
        const direction = b.clone().subtract(a);
        effectNode.angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI - 45;

        const transform = effectNode.getComponent(UITransform) ?? effectNode.addComponent(UITransform);
        transform.setContentSize(310, 310);
        const sprite = effectNode.getComponent(Sprite) ?? effectNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        const opacity = effectNode.getComponent(UIOpacity) ?? effectNode.addComponent(UIOpacity);
        opacity.opacity = 255;
        Tween.stopAllByTarget(effectNode);
        Tween.stopAllByTarget(opacity);
        tween(effectNode)
            .to(0.06, { scale: new Vec3(1.02, 1.02, 1) }, { easing: 'backOut' })
            .to(0.16, { scale: new Vec3(1.10, 1.10, 1) }, { easing: 'quadOut' })
            .start();
        tween(opacity)
            .delay(0.08)
            .to(0.14, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                if (effectNode.isValid) this.slashEffectPool.put(effectNode);
            })
            .start();
    }

    private playFallbackBurst(position: Readonly<Vec3>): void {
        const layer = this.gameplayLayer.getChildByName('HitEffectLayer')!;
        for (let i = 0; i < 4; i++) {
            const bit = graphics(layer, `FallbackPaperBit_${i}`, 14, 14);
            bit.node.setPosition(position);
            bit.fillColor = i % 2 ? YELLOW : PAPER;
            bit.rect(-5, -5, 10, 10);
            bit.fill();
            const angle = i * Math.PI / 2 + 0.35;
            tween(bit.node)
                .to(0.18, {
                    position: new Vec3(position.x + Math.cos(angle) * 55, position.y + Math.sin(angle) * 55, 0),
                    angle: 45 + i * 25,
                })
                .call(() => bit.node.destroy())
                .start();
        }
    }

    private floatingText(position: Readonly<Vec3>, text: string, color: Color): void {
        const layer = this.gameplayLayer.getChildByName('FloatingTextLayer')!;
        const score = label(layer, 'FloatingScore', text, 34, color);
        score.node.setPosition(position.x, position.y + 44);
        const opacity = score.node.addComponent(UIOpacity);
        tween(score.node).to(0.24, { position: new Vec3(position.x, position.y + 95, 0) }).start();
        tween(opacity).delay(0.08).to(0.16, { opacity: 0 }).call(() => score.node.destroy()).start();
    }

    private respawn(target: GameplayTarget): void {
        target.node.active = true;
        target.node.setScale(Vec3.ZERO);
        target.hit = false;
        tween(target.node).to(0.16, { scale: Vec3.ONE }).start();
    }

    private refreshHUD(): void {
        if (this.comboValue) this.comboValue.string = String(this.state.combo);
        if (this.timerValue) this.timerValue.string = `${Math.ceil(this.state.remainingTime)}s`;
        if (this.lifeValue) this.lifeValue.string = Array.from({ length: this.state.maxLife }, (_, i) => i < this.state.life ? '♥' : '♡').join(' ');
    }

    private addTexture(parent: Node, name: string, path: string, width: number, height: number): Sprite {
        const sprite = makeNode(name, parent, width, height).addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = Color.WHITE;
        resources.load(path, SpriteFrame, (error, frame) => {
            if (!error && sprite.isValid) sprite.spriteFrame = frame;
        });
        return sprite;
    }

    private getTopInset(): number {
        const visible = view.getVisibleSize();
        let inset = 88;
        const wxApi = (globalThis as { wx?: { getSystemInfoSync?: () => { screenHeight: number; safeArea?: { top: number } }; getMenuButtonBoundingClientRect?: () => { bottom: number } } }).wx;
        try {
            const info = wxApi?.getSystemInfoSync?.();
            const capsule = wxApi?.getMenuButtonBoundingClientRect?.();
            if (info && capsule && info.screenHeight > 0) inset = capsule.bottom * visible.height / info.screenHeight;
            else if (info?.safeArea && info.screenHeight > 0) inset = info.safeArea.top * visible.height / info.screenHeight;
        } catch { /* Preview uses the documented fallback. */ }
        return inset;
    }

    private getBottomInset(): number {
        const visible = view.getVisibleSize();
        const safe = (view as unknown as { getSafeAreaRect?: () => { y: number; height: number } }).getSafeAreaRect?.();
        return safe ? Math.max(64, visible.height - safe.height - safe.y) : 64;
    }
}
