import {
    _decorator,
    Button,
    Color,
    Component,
    Graphics,
    ImageAsset,
    Label,
    Layers,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec3,
} from 'cc';
import { EDITOR } from 'cc/env';
import { AppRuntime } from '../../app/AppRuntime';
import { HOME_HAND_DRAWN as C } from '../DesignTokens';

const { ccclass, executeInEditMode } = _decorator;

type RankingMode = 'brawl' | 'trial';

interface RankingEntry {
    readonly name: string;
    readonly brawl: number;
    readonly trial: number;
}

const RANKINGS: readonly RankingEntry[] = [
    { name: '小王', brawl: 1280, trial: 96 },
    { name: '阿宁', brawl: 1170, trial: 91 },
    { name: 'Momo', brawl: 1100, trial: 88 },
    { name: '大熊猫', brawl: 980, trial: 82 },
    { name: '奶盖小仙女', brawl: 950, trial: 78 },
    { name: '吃不饱', brawl: 900, trial: 73 },
    { name: '钺', brawl: 860, trial: 69 },
    { name: '泡泡龙', brawl: 820, trial: 65 },
    { name: '小宇宙', brawl: 780, trial: 61 },
    { name: '咸鱼翻身', brawl: 720, trial: 56 },
] as const;

const ROW_Y = [-28, -104, -180, -256, -332, -408, -484] as const;

/** Runtime-built ranking page that shares Home's header and bottom navigation. */
@ccclass('RankingPage')
@executeInEditMode(true)
export class RankingPage extends Component {
    private mode: RankingMode = 'brawl';
    private trialSelection: Node | null = null;
    private scoreLabels: Label[] = [];
    private selfRankLabel: Label | null = null;
    private selfScoreLabel: Label | null = null;

    protected onLoad(): void {
        this.buildView();
        this.refreshScores();
    }

    public selectMode(mode: RankingMode): void {
        if (this.mode === mode) return;
        this.mode = mode;
        if (this.trialSelection) this.trialSelection.active = mode === 'trial';
        this.refreshScores();
        if (!EDITOR) AppRuntime.audio.play('ui');
    }

    private buildView(): void {
        this.node.name = 'RankingPage';
        this.node.layer = Layers.Enum.UI_2D;
        this.node.getComponent(UITransform)?.setContentSize(C.designWidth, 1450);

        const title = this.makeNode(this.node, 'RankingTitle', 0, 505, 590, 308);
        this.attachTexture(title, 'textures/rank/ui/ranking_title');

        // The paper reaches behind the tabs. Create it first so its opaque top
        // edge cannot cover the tab artwork and touch targets.
        const paper = this.makeNode(this.node, 'RankingPaper', 0, -58, 842, 1052);
        this.attachTexture(paper, 'textures/rank/ui/ranking_paper');

        const tabs = this.makeNode(this.node, 'RankingTabs', 0, 345, 820, 188);
        this.attachTexture(tabs, 'textures/rank/ui/ranking_tabs');
        this.buildTrialSelection(tabs);

        const brawlButton = this.makeNode(tabs, 'BrawlTabButton', -205, 4, 380, 132);
        const trialButton = this.makeNode(tabs, 'TrialTabButton', 205, 4, 380, 132);
        this.bindButton(brawlButton, () => this.selectMode('brawl'));
        this.bindButton(trialButton, () => this.selectMode('trial'));

        this.buildPodium(this.node);
        this.buildRows(this.node);
        this.buildSelfRanking(this.node);
    }

    private buildTrialSelection(parent: Node): void {
        const overlay = this.makeNode(parent, 'TrialSelectedOverlay', 0, 9, 790, 120);
        const left = this.graphics(overlay, 'LeftPaperCover', -203, 0, 336, 100);
        left.fillColor = new Color(0xfb, 0xf5, 0xe9, 0xf2);
        left.roundRect(-168, -50, 336, 100, 24);
        left.fill();
        const right = this.graphics(overlay, 'RightCrayon', 203, 0, 336, 100);
        right.fillColor = new Color(C.yellow.r, C.yellow.g, C.yellow.b, 0xe8);
        right.roundRect(-168, -50, 336, 100, 24);
        right.fill();
        this.label(overlay, 'BrawlLabel', '乱斗榜', -203, 0, 320, 84, 44, C.ink);
        this.label(overlay, 'TrialLabel', '试炼榜', 203, 0, 320, 84, 44, C.ink);
        overlay.active = false;
        this.trialSelection = overlay;
    }

    private buildPodium(parent: Node): void {
        const podium: Array<{ entry: RankingEntry; asset: string; x: number; y: number; size: [number, number]; faceY: number }> = [
            { entry: RANKINGS[1], asset: 'ranking_silver', x: -250, y: 207, size: [186, 190], faceY: 203 },
            { entry: RANKINGS[0], asset: 'ranking_gold', x: 0, y: 232, size: [212, 236], faceY: 222 },
            { entry: RANKINGS[2], asset: 'ranking_bronze', x: 250, y: 207, size: [186, 190], faceY: 203 },
        ];

        podium.forEach((item, index) => {
            const medal = this.makeNode(parent, `PodiumMedal_${index + 1}`, item.x, item.y, item.size[0], item.size[1]);
            this.attachTexture(medal, `textures/rank/ui/${item.asset}`);
            this.drawAvatar(parent, `PodiumAvatar_${index + 1}`, item.x, item.faceY, index === 1 ? 72 : 66, index);
            this.label(parent, `PodiumName_${index + 1}`, item.entry.name, item.x, 101, 210, 46, 31, C.ink);
            const score = this.label(parent, `PodiumScore_${index + 1}`, '', item.x, 59, 180, 44, 30, C.ink);
            this.scoreLabels.push(score);
        });
    }

    private buildRows(parent: Node): void {
        RANKINGS.slice(3).forEach((entry, index) => {
            const y = ROW_Y[index];
            this.label(parent, `Rank_${index + 4}`, `${index + 4}`, -318, y, 60, 56, 29, C.ink);
            this.drawAvatar(parent, `RowAvatar_${index + 4}`, -236, y, 48, index + 3);
            this.label(parent, `Name_${index + 4}`, entry.name, -115, y, 260, 56, 27, C.ink, 'left');
            const score = this.label(parent, `Score_${index + 4}`, '', 318, y, 125, 56, 28, C.ink);
            this.scoreLabels.push(score);
        });
    }

    private buildSelfRanking(parent: Node): void {
        const card = this.makeNode(parent, 'MyRankingCard', 0, -638, 842, 300);
        this.attachTexture(card, 'textures/rank/ui/ranking_self');
        this.selfRankLabel = this.label(card, 'MyRank', '', -333, -5, 92, 92, 42, C.ink);
        this.drawAvatar(card, 'MyAvatar', -250, -5, 74, 6);
        this.label(card, 'MyName', '钺', -30, -3, 280, 70, 34, C.ink);
        this.selfScoreLabel = this.label(card, 'MyScore', '', 304, -4, 170, 72, 35, C.ink);
    }

    private refreshScores(): void {
        const ordered = [RANKINGS[1], RANKINGS[0], RANKINGS[2], ...RANKINGS.slice(3)];
        ordered.forEach((entry, index) => {
            const label = this.scoreLabels[index];
            if (label) label.string = `${entry[this.mode]}`;
        });
        if (this.selfRankLabel) this.selfRankLabel.string = this.mode === 'brawl' ? '7' : '12';
        if (this.selfScoreLabel) this.selfScoreLabel.string = this.mode === 'brawl' ? '860' : '52';
    }

    private attachTexture(parent: Node, resourcePath: string): void {
        const size = parent.getComponent(UITransform)?.contentSize;
        if (!size) return;
        const visual = this.makeNode(parent, 'TextureSprite', 0, 0, size.width, size.height);
        const sprite = visual.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        sprite.trim = false;
        resources.load(resourcePath, ImageAsset, (error, image) => {
            if (error || !image || !visual.isValid) {
                console.warn(`[Ranking] Texture failed to load: ${resourcePath}`, error);
                return;
            }
            const frame = SpriteFrame.createWithImage(image);
            frame.packable = false;
            sprite.spriteFrame = frame;
        });
    }

    private drawAvatar(parent: Node, name: string, x: number, y: number, size: number, variant: number): void {
        const g = this.graphics(parent, name, x, y, size, size);
        const radius = size * 0.35;
        g.fillColor = C.paperRaised;
        g.strokeColor = C.ink;
        g.lineWidth = Math.max(2, size * 0.04);
        g.circle(0, -size * 0.04, radius);
        g.fill();
        g.stroke();
        g.moveTo(-radius, size * 0.08);
        if (variant % 3 === 0) {
            g.lineTo(-radius * 0.55, radius * 0.92);
            g.lineTo(-radius * 0.15, radius * 0.64);
            g.lineTo(radius * 0.2, radius * 1.02);
            g.lineTo(radius * 0.58, radius * 0.68);
        } else if (variant % 3 === 1) {
            g.quadraticCurveTo(0, radius * 1.2, radius, size * 0.06);
        } else {
            g.lineTo(-radius * 0.45, radius * 0.88);
            g.lineTo(0, radius * 0.58);
            g.lineTo(radius * 0.45, radius * 0.9);
            g.lineTo(radius, size * 0.06);
        }
        g.stroke();
        g.fillColor = C.ink;
        g.circle(-radius * 0.36, -size * 0.06, Math.max(1.5, size * 0.035));
        g.circle(radius * 0.36, -size * 0.06, Math.max(1.5, size * 0.035));
        g.fill();
    }

    private makeNode(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);
        return node;
    }

    private graphics(parent: Node, name: string, x: number, y: number, width: number, height: number): Graphics {
        return this.makeNode(parent, name, x, y, width, height).addComponent(Graphics);
    }

    private label(
        parent: Node,
        name: string,
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize: number,
        color: Color,
        align: 'left' | 'center' | 'right' = 'center',
    ): Label {
        const label = this.makeNode(parent, name, x, y, width, height).addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.18);
        label.color = color;
        label.useSystemFont = true;
        label.fontFamily = 'Arial, Microsoft YaHei, sans-serif';
        label.isBold = true;
        label.enableWrapText = false;
        label.overflow = Label.Overflow.SHRINK;
        label.horizontalAlign = align === 'left' ? Label.HorizontalAlign.LEFT
            : align === 'right' ? Label.HorizontalAlign.RIGHT : Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }

    private bindButton(node: Node, callback: () => void): void {
        const button = node.addComponent(Button);
        button.transition = Button.Transition.SCALE;
        button.zoomScale = 0.98;
        node.on(Button.EventType.CLICK, callback, this);
        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.98, 0.98, 1), this);
        const release = (): void => node.setScale(Vec3.ONE);
        node.on(Node.EventType.TOUCH_END, release, this);
        node.on(Node.EventType.TOUCH_CANCEL, release, this);
    }
}
