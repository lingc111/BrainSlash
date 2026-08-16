import {
    _decorator,
    Button,
    Camera,
    Color,
    Component,
    Graphics,
    Label,
    Layers,
    Node,
    ResolutionPolicy,
    screen,
    tween,
    Tween,
    UITransform,
    Vec3,
    view,
} from 'cc';
import { HOME_HAND_DRAWN as C } from '../DesignTokens';
import { CountdownTimer } from './CountdownTimer';
import { createMockHomeViewData, HomeViewData } from './HomeViewData';

const { ccclass } = _decorator;

type WechatApi = {
    getSystemInfoSync?: () => {
        screenHeight: number;
        safeArea?: { top: number; bottom: number };
    };
    getMenuButtonBoundingClientRect?: () => { bottom: number };
    vibrateShort?: (options?: { type?: 'light' | 'medium' | 'heavy' }) => void;
};

type Point = readonly [number, number];

@ccclass('HomeController')
export class HomeController extends Component {
    private data: HomeViewData = createMockHomeViewData();
    private readonly countdown = new CountdownTimer();

    private background: Node | null = null;
    private safeArea: Node | null = null;
    private header: Node | null = null;
    private dailyChallenge: Node | null = null;
    private brawlButton: Node | null = null;
    private eventArea: Node | null = null;
    private rankProgress: Node | null = null;
    private bottomNavigation: Node | null = null;

    private levelLabel: Label | null = null;
    private energyLabel: Label | null = null;
    private friendMessageLabel: Label | null = null;
    private countdownLabel: Label | null = null;
    private progressValueLabel: Label | null = null;
    private progressCells: Node[] = [];

    private readonly handleResize = (): void => this.applyLayout();

    protected onLoad(): void {
        // Preview and device must share one coordinate system; otherwise the
        // legacy 750-wide scene camera crops the 941-wide hand-drawn layout.
        view.setDesignResolutionSize(C.designWidth, C.designHeight, ResolutionPolicy.SHOW_ALL);

        this.node.name = 'HomePage';
        // Detach immediately so editor-side scene generation never serializes
        // the legacy home nodes beside the rebuilt hand-drawn hierarchy.
        for (const child of [...this.node.children]) {
            child.removeFromParent();
            child.destroy();
        }
        this.buildView();
        this.refresh(this.data);
    }

    protected onEnable(): void {
        screen.on('window-resize', this.handleResize, this);
        this.applyLayout();
        this.scheduleOnce(this.applyLayout, 0);
        this.countdown.start(
            this.data.challengeEndTime,
            (formatted) => {
                if (this.countdownLabel?.isValid) this.countdownLabel.string = formatted;
            },
            this.onChallengeExpired.bind(this),
        );
    }

    protected onDisable(): void {
        screen.off('window-resize', this.handleResize, this);
        this.countdown.stop();
    }

    protected onDestroy(): void {
        this.countdown.stop();
        Tween.stopAllByTarget(this.dailyChallenge);
    }

    public refresh(data: HomeViewData): void {
        this.data = { ...data };
        if (this.levelLabel) this.levelLabel.string = `Lv.${data.level}  ${data.rankName}`;
        if (this.energyLabel) this.energyLabel.string = `${data.energy}/${data.maxEnergy}`;
        if (this.friendMessageLabel) this.friendMessageLabel.string = data.friendMessage;
        if (this.progressValueLabel) {
            this.progressValueLabel.string = `${data.rankProgress}/${data.rankProgressMax}`;
        }
        this.refreshProgressCells();

        if (this.enabled && this.node.activeInHierarchy) {
            this.countdown.start(
                data.challengeEndTime,
                (formatted) => {
                    if (this.countdownLabel?.isValid) this.countdownLabel.string = formatted;
                },
                this.onChallengeExpired.bind(this),
            );
        }
    }

    public onDailyChallengeClick(): void {
        this.pulseHaptic();
        console.log('[Home] Daily challenge: 成语斩·百词破晓');
    }

    public onBrawlClick(): void {
        this.pulseHaptic();
        console.log('[Home] 60-second brawl');
    }

    public onReverseDayClick(): void {
        console.log('[Home] Friend challenge: 反向日');
    }

    public onFlagHunterClick(): void {
        console.log('[Home] Limited event: 国旗猎人');
    }

    public onHomeClick(): void {
        console.log('[Home] Home');
    }

    public onTopicClick(): void {
        console.log('[Home] Topic');
    }

    public onRankClick(): void {
        console.log('[Home] Rank');
    }

    public onProfileClick(): void {
        console.log('[Home] Profile');
    }

    public onChallengeExpired(): void {
        if (this.countdownLabel) this.countdownLabel.string = '00:00:00';
        console.log('[Home] Daily challenge expired');
    }

    private buildView(): void {
        this.background = this.makeNode(this.node, 'Background', 0, 0, C.designWidth, C.designHeight);
        this.safeArea = this.makeNode(this.node, 'SafeArea', 0, 0, C.designWidth, C.designHeight);

        this.header = this.buildHeader(this.safeArea);
        this.dailyChallenge = this.buildDailyChallenge(this.safeArea);
        this.brawlButton = this.buildBrawlButton(this.safeArea);
        this.eventArea = this.buildEvents(this.safeArea);
        this.rankProgress = this.buildRankProgress(this.safeArea);
        this.bottomNavigation = this.buildBottomNavigation(this.safeArea);

        this.applyLayout();
        this.startIdleMotion();
    }

    private buildHeader(parent: Node): Node {
        const header = this.makeNode(parent, 'Header', 0, 0, 820, 138);

        const avatarGroup = this.makeNode(header, 'Avatar', -342, 0, 116, 116);
        const avatarShadow = this.graphics(avatarGroup, 'PaperShadow', 5, -7, 106, 106);
        this.fillCircle(avatarShadow, 0, 0, 50, C.shadow);
        const avatarPaper = this.graphics(avatarGroup, 'PaperCircle', 0, 0, 106, 106);
        this.fillCircle(avatarPaper, 0, 0, 50, new Color(0xec, 0xe9, 0xe1, 0xff));
        this.strokeCircle(avatarPaper, 0, 0, 50, C.inkSoft, 2.5);
        this.drawAvatar(avatarGroup);
        this.drawTape(avatarGroup, 'TapeTop', -18, 50, 70, 26, -12);
        this.drawTape(avatarGroup, 'TapeBottom', 24, -48, 70, 24, 12);

        this.levelLabel = this.label(header, 'LevelLabel', '', -130, 8, 270, 70, 38, C.ink, 'left');
        this.drawUnderline(header, 'LevelUnderline', -112, -32, 265, C.ink, -2);

        const energy = this.makeNode(header, 'Energy', 276, 0, 300, 118);
        this.drawLightning(energy, -92, 10, 74);
        this.energyLabel = this.label(energy, 'EnergyLabel', '', 48, 8, 190, 64, 38, C.ink, 'center');
        this.drawUnderline(energy, 'EnergyUnderline', 45, -32, 190, C.ink, 2);
        return header;
    }

    private buildDailyChallenge(parent: Node): Node {
        const root = this.makeNode(parent, 'DailyChallenge', 0, 0, 790, 500);
        const shadow = this.graphics(root, 'PaperShadow', 8, -12, 788, 490);
        this.drawIrregularPaper(shadow, 780, 472, C.shadow, new Color(0, 0, 0, 0), 0);

        const paper = this.graphics(root, 'PaperBackground', 0, 0, 788, 490);
        this.drawIrregularPaper(paper, 780, 472, C.paperRaised, new Color(0x75, 0x70, 0x66, 0xb0), 2);
        this.drawPaperHoles(paper, -370, 150, 7, 50);
        this.drawTape(root, 'RedTape', 0, 239, 250, 62, -1, C.red);

        const titleGroup = this.makeNode(root, 'TitleImagePlaceholder', -100, 104, 450, 162);
        this.label(titleGroup, 'AccentCharacter', '成', -176, 42, 92, 76, 58, C.red, 'center');
        this.label(titleGroup, 'TitleLine1', '语斩：', -34, 42, 220, 76, 58, C.ink, 'left');
        this.label(titleGroup, 'TitleLine2', '百词破晓', -14, -43, 430, 84, 66, C.ink, 'center');
        this.drawUnderline(titleGroup, 'TitleRedUnderline', 0, -82, 430, C.red, -4);

        const hourglass = this.makeNode(root, 'HourglassIcon', 263, 98, 110, 140);
        this.drawHourglass(hourglass);

        const friend = this.makeNode(root, 'FriendBubble', -105, -54, 440, 78);
        this.drawSmallFriend(friend, -188, 0);
        const bubble = this.graphics(friend, 'BubbleOutline', 30, 0, 360, 68);
        this.roundedRect(bubble, -180, -32, 360, 64, C.paperRaised, C.ink, 2.5, 14);
        this.friendMessageLabel = this.label(friend, 'FriendMessage', '', 31, 0, 326, 56, 26, C.ink, 'center');

        this.countdownLabel = this.label(root, 'CountdownLabel', '00:00:00', 266, -60, 220, 58, 34, C.ink, 'center');
        this.drawUnderline(root, 'CountdownUnderline', 266, -94, 210, C.red, -1);

        const start = this.makeNode(root, 'StartButton', 0, -172, 520, 108);
        const brush = this.graphics(start, 'BrushBackground', 0, 0, 520, 108);
        this.drawBrushStroke(brush, 510, 94, C.orange);
        this.drawPlayIcon(start, -108, 0, 42);
        this.label(start, 'StartLabel', '拔刀', 40, 2, 250, 80, 56, C.ink, 'center');
        this.bindButton(start, this.onDailyChallengeClick.bind(this));
        return root;
    }

    private buildBrawlButton(parent: Node): Node {
        const root = this.makeNode(parent, 'BrawlButton', 0, 0, 800, 188);
        const shadow = this.graphics(root, 'PaperShadow', 8, -10, 798, 180);
        this.drawRibbon(shadow, 790, 170, C.shadow);
        const paper = this.graphics(root, 'YellowPaper', 0, 0, 798, 180);
        this.drawRibbon(paper, 790, 170, C.yellow);

        this.drawDashedCutLine(root, -292, 44, 584);
        this.drawScissors(root, 0, 46, 64);
        this.label(root, 'BrawlLabel', '60秒  乱斗', 0, -30, 650, 92, 62, C.ink, 'center');
        this.bindButton(root, this.onBrawlClick.bind(this));
        return root;
    }

    private buildEvents(parent: Node): Node {
        const area = this.makeNode(parent, 'EventArea', 0, 0, 790, 294);

        const reverse = this.makeNode(area, 'ReverseDayCard', -210, 0, 342, 280);
        const reverseShadow = this.graphics(reverse, 'PaperShadow', 8, -10, 334, 270);
        this.drawStickyNote(reverseShadow, 328, 264, C.shadow);
        const pink = this.graphics(reverse, 'Paper', 0, 0, 334, 270);
        this.drawStickyNote(pink, 328, 264, C.pink);
        this.drawTape(reverse, 'Tape', -55, 137, 120, 38, 2);
        this.drawReverseFace(reverse, 0, 58, 68);
        this.label(reverse, 'TypeLabel', '好友挑战', 0, -32, 250, 40, 27, C.ink, 'center');
        this.label(reverse, 'TitleLabel', '反向日', 0, -88, 260, 64, 46, C.ink, 'center');
        this.drawUnderline(reverse, 'TitleUnderline', 0, -121, 190, C.red, -2);
        this.bindButton(reverse, this.onReverseDayClick.bind(this));

        const flag = this.makeNode(area, 'FlagHunterCard', 210, 0, 342, 284);
        flag.setRotationFromEuler(0, 0, -1.5);
        const flagShadow = this.graphics(flag, 'PaperShadow', 10, -12, 334, 278);
        this.drawPolaroid(flagShadow, 326, 270, C.shadow, false);
        const polaroid = this.graphics(flag, 'Polaroid', 0, 0, 334, 278);
        this.drawPolaroid(polaroid, 326, 270, C.paperRaised, true);
        this.drawThumbtack(flag, 72, 135);
        this.drawGlobe(flag, 0, 54, 72);
        this.label(flag, 'TypeLabel', '限时活动', 0, -44, 250, 38, 27, C.ink, 'center');
        this.label(flag, 'TitleLabel', '国旗猎人', 0, -96, 280, 58, 43, C.blue, 'center');
        this.drawUnderline(flag, 'TitleUnderline', 0, -126, 225, C.blue, 2);
        this.bindButton(flag, this.onFlagHunterClick.bind(this));
        return area;
    }

    private buildRankProgress(parent: Node): Node {
        const root = this.makeNode(parent, 'RankProgress', 0, 0, 810, 112);
        this.label(root, 'TitleLabel', '今日段位进度', -276, 36, 300, 48, 32, C.ink, 'left');
        const cells = this.makeNode(root, 'ProgressCells', -55, -20, 620, 54);
        for (let i = 0; i < 10; i += 1) {
            const cell = this.makeNode(cells, `ProgressCell_${i + 1}`, -274 + i * 61, 0, 46, 46);
            cell.addComponent(Graphics);
            this.progressCells.push(cell);
        }
        this.progressValueLabel = this.label(root, 'ValueLabel', '', 330, -18, 110, 48, 32, C.ink, 'center');
        return root;
    }

    private buildBottomNavigation(parent: Node): Node {
        const root = this.makeNode(parent, 'BottomNavigation', 0, 0, C.designWidth, 128);
        const separator = this.graphics(root, 'PaperLine', 0, 62, 860, 12);
        separator.strokeColor = new Color(0x42, 0x3d, 0x36, 0x88);
        separator.lineWidth = 2;
        separator.moveTo(-430, 0);
        separator.bezierCurveTo(-160, 2, 130, -3, 430, 0);
        separator.stroke();

        const items: Array<[string, string, number, () => void]> = [
            ['HomeButton', '首页', -306, this.onHomeClick.bind(this)],
            ['TopicButton', '主题', -102, this.onTopicClick.bind(this)],
            ['RankButton', '排行', 102, this.onRankClick.bind(this)],
            ['ProfileButton', '我的', 306, this.onProfileClick.bind(this)],
        ];
        items.forEach(([name, text, x, callback], index) => {
            const item = this.makeNode(root, name, x as number, -4, 176, 120);
            if (index === 0) {
                const marker = this.graphics(item, 'ActiveMarker', 0, 22, 104, 70);
                this.drawBrushStroke(marker, 98, 58, C.yellow);
            }
            this.drawNavIcon(item, index, 0, 25);
            this.label(item, 'Label', text as string, 0, -34, 140, 42, 28, C.ink, 'center');
            this.bindButton(item, callback as () => void);
        });
        return root;
    }

    private applyLayout = (): void => {
        if (!this.background || !this.safeArea) return;

        const frame = view.getFrameSize();
        const designAspect = C.designWidth / C.designHeight;
        const frameAspect = frame.height > 0 ? frame.width / frame.height : designAspect;
        const visible = frameAspect < designAspect
            ? { width: C.designWidth, height: C.designWidth / frameAspect }
            : { width: C.designHeight * frameAspect, height: C.designHeight };
        this.node.parent?.getComponent(UITransform)?.setContentSize(visible.width, visible.height);
        const camera = this.node.parent?.getChildByName('Camera')?.getComponent(Camera);
        if (camera) camera.orthoHeight = visible.height * 0.5;
        this.node.getComponent(UITransform)?.setContentSize(visible.width, visible.height);
        this.background.getComponent(UITransform)?.setContentSize(visible.width, visible.height);
        this.safeArea.getComponent(UITransform)?.setContentSize(visible.width, visible.height);
        this.redrawBackground(visible.width, visible.height);

        const extraHeight = Math.max(0, visible.height - C.designHeight);
        const gapBoost = Math.min(96, extraHeight / 4);
        const topInset = this.getTopInset(visible.height);
        const bottomInset = this.getBottomInset(visible.height);
        const topEdge = visible.height * 0.5;
        const bottomEdge = -visible.height * 0.5;

        const headerY = topEdge - topInset - 60;
        const dailyY = headerY - 69 - 22 - gapBoost * 0.15 - 250;
        const brawlY = dailyY - 250 - (28 + gapBoost) - 94;
        const eventY = brawlY - 94 - (28 + gapBoost) - 147;
        const progressY = eventY - 147 - (24 + gapBoost * 0.72) - 56;
        const navY = bottomEdge + bottomInset + 64;

        this.header?.setPosition(0, headerY, 0);
        this.dailyChallenge?.setPosition(0, dailyY, 0);
        this.brawlButton?.setPosition(0, brawlY, 0);
        this.eventArea?.setPosition(0, eventY, 0);
        this.rankProgress?.setPosition(0, progressY, 0);
        this.bottomNavigation?.setPosition(0, navY, 0);

        // Only compact genuinely shorter-than-reference previews; never stretch paper art.
        const contentScale = Math.max(0.9, Math.min(1, visible.height / C.designHeight));
        for (const section of [
            this.header,
            this.dailyChallenge,
            this.brawlButton,
            this.eventArea,
            this.rankProgress,
        ]) {
            section?.setScale(contentScale, contentScale, 1);
        }
    };

    private redrawBackground(width: number, height: number): void {
        if (!this.background) return;
        const g = this.background.getComponent(Graphics) ?? this.background.addComponent(Graphics);
        g.clear();
        g.fillColor = C.paper;
        g.rect(-width * 0.5, -height * 0.5, width, height);
        g.fill();

        const grid = 38;
        const startX = Math.floor(-width * 0.5 / grid) * grid;
        const startY = Math.floor(-height * 0.5 / grid) * grid;
        for (let x = startX, index = 0; x <= width * 0.5; x += grid, index += 1) {
            g.strokeColor = index % 5 === 0 ? C.gridStrong : C.gridThin;
            g.lineWidth = index % 5 === 0 ? 1.5 : 1;
            g.moveTo(x, -height * 0.5);
            g.lineTo(x, height * 0.5);
            g.stroke();
        }
        for (let y = startY, index = 0; y <= height * 0.5; y += grid, index += 1) {
            g.strokeColor = index % 5 === 0 ? C.gridStrong : C.gridThin;
            g.lineWidth = index % 5 === 0 ? 1.5 : 1;
            g.moveTo(-width * 0.5, y);
            g.lineTo(width * 0.5, y);
            g.stroke();
        }

        // A few quiet paper fibers break the digital-perfect grid without competing with cards.
        g.strokeColor = new Color(0x8b, 0x7c, 0x67, 0x22);
        g.lineWidth = 1;
        const fibers: Point[] = [
            [-390, 610], [-318, 248], [352, 430], [408, -330], [-366, -590], [224, -746],
        ];
        fibers.forEach(([x, y], index) => {
            g.moveTo(x, y);
            g.bezierCurveTo(x + 18, y + (index % 2 ? 3 : -3), x + 38, y - 2, x + 58, y + 1);
            g.stroke();
        });
    }

    private refreshProgressCells(): void {
        const total = Math.max(1, this.data.rankProgressMax);
        const filled = Math.max(0, Math.min(total, this.data.rankProgress));
        this.progressCells.forEach((cell, index) => {
            const g = cell.getComponent(Graphics);
            if (!g) return;
            g.clear();
            const active = index < Math.round((filled / total) * this.progressCells.length);
            g.fillColor = active ? new Color(0x75, 0xae, 0x5a, 0x44) : new Color(0xff, 0xff, 0xff, 0x44);
            g.strokeColor = C.ink;
            g.lineWidth = 2.2;
            g.rect(-20, -20, 40, 40);
            g.fill();
            g.stroke();
            if (active) {
                g.strokeColor = C.green;
                g.lineWidth = 3;
                for (let line = -14; line <= 15; line += 8) {
                    g.moveTo(-16, line - 5);
                    g.lineTo(15, line + 6);
                    g.stroke();
                }
            }
        });
    }

    private startIdleMotion(): void {
        const start = this.dailyChallenge?.getChildByName('StartButton');
        const brush = start?.getChildByName('BrushBackground');
        if (brush) {
            tween(brush)
                .repeatForever(
                    tween()
                        .to(0.72, { scale: new Vec3(1.015, 1.03, 1) }, { easing: 'sineInOut' })
                        .to(0.72, { scale: Vec3.ONE }, { easing: 'sineInOut' }),
                )
                .start();
        }
    }

    private makeNode(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.parent = parent;
        node.setPosition(x, y, 0);
        const transform = node.addComponent(UITransform);
        transform.setContentSize(width, height);
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
        align: 'left' | 'center' | 'right',
    ): Label {
        const node = this.makeNode(parent, name, x, y, width, height);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.18);
        label.color = color;
        label.useSystemFont = true;
        label.fontFamily = 'Arial, Microsoft YaHei, sans-serif';
        label.isBold = true;
        label.enableWrapText = false;
        label.overflow = Label.Overflow.SHRINK;
        label.horizontalAlign = align === 'left'
            ? Label.HorizontalAlign.LEFT
            : align === 'right'
                ? Label.HorizontalAlign.RIGHT
                : Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }

    private bindButton(node: Node, callback: () => void): void {
        const button = node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        node.on(Button.EventType.CLICK, callback, this);
        node.on(Node.EventType.TOUCH_START, () => {
            Tween.stopAllByTarget(node);
            tween(node).to(0.08, { scale: new Vec3(0.97, 0.97, 1) }, { easing: 'quadOut' }).start();
        }, this);
        const release = (): void => {
            Tween.stopAllByTarget(node);
            tween(node).to(0.1, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
        };
        node.on(Node.EventType.TOUCH_END, release, this);
        node.on(Node.EventType.TOUCH_CANCEL, release, this);
    }

    private drawIrregularPaper(g: Graphics, width: number, height: number, fill: Color, stroke: Color, lineWidth: number): void {
        const x = width * 0.5;
        const y = height * 0.5;
        const points: Point[] = [
            [-x + 7, y - 5], [-x + 90, y], [-x + 174, y - 4], [-40, y + 2],
            [x - 120, y - 3], [x - 4, y - 8], [x, 116], [x - 4, 22],
            [x + 1, -94], [x - 8, -y + 5], [190, -y], [62, -y + 4],
            [-90, -y - 2], [-238, -y + 4], [-x + 10, -y + 9], [-x + 4, -70],
            [-x + 8, 54], [-x + 2, 158],
        ];
        this.polygon(g, points, fill, stroke, lineWidth);
    }

    private drawRibbon(g: Graphics, width: number, height: number, fill: Color): void {
        const x = width * 0.5;
        const y = height * 0.5;
        this.polygon(g, [
            [-x + 8, y - 3], [-x + 50, y + 8], [-220, y], [45, y + 4], [x - 12, y],
            [x - 42, 48], [x - 8, 25], [x - 46, -3], [x - 10, -35], [x - 54, -y + 4],
            [166, -y], [-92, -y + 5], [-x + 18, -y], [-x + 48, -45], [-x + 8, -18],
            [-x + 44, 14], [-x + 4, 44],
        ], fill, C.inkSoft, 1.4);
    }

    private drawStickyNote(g: Graphics, width: number, height: number, fill: Color): void {
        const x = width * 0.5;
        const y = height * 0.5;
        this.polygon(g, [
            [-x + 2, y], [x - 3, y - 4], [x, -y + 44], [x - 46, -y + 4],
            [80, -y], [-x, -y + 7], [-x + 3, 18],
        ], fill, new Color(0x75, 0x65, 0x5a, 0x70), 1.5);
        if (fill !== C.shadow) {
            g.fillColor = new Color(0xff, 0xe1, 0xe4, 0xe8);
            g.moveTo(x - 46, -y + 4);
            g.lineTo(x, -y + 44);
            g.lineTo(x - 5, -y + 2);
            g.close();
            g.fill();
        }
    }

    private drawPolaroid(g: Graphics, width: number, height: number, fill: Color, details: boolean): void {
        const x = width * 0.5;
        const y = height * 0.5;
        this.polygon(g, [
            [-x + 7, y], [x - 2, y - 4], [x, -y + 3], [30, -y], [-x, -y + 7], [-x + 4, 42],
        ], fill, details ? new Color(0x67, 0x61, 0x58, 0xa0) : new Color(0, 0, 0, 0), details ? 1.7 : 0);
        if (details) {
            g.strokeColor = new Color(0x4d, 0x49, 0x42, 0x88);
            g.lineWidth = 1.6;
            g.rect(-132, -5, 264, 112);
            g.stroke();
        }
    }

    private drawBrushStroke(g: Graphics, width: number, height: number, fill: Color): void {
        const x = width * 0.5;
        const y = height * 0.5;
        this.polygon(g, [
            [-x + 18, y - 7], [-x + 72, y], [-74, y - 3], [64, y + 2], [x - 20, y - 10],
            [x, 22], [x - 8, -4], [x - 2, -y + 12], [108, -y + 5], [-38, -y + 11],
            [-x + 34, -y], [-x + 5, -24], [-x + 14, 4], [-x, 27],
        ], fill, new Color(0, 0, 0, 0), 0);
        g.strokeColor = new Color(0xc9, 0x69, 0x14, 0x88);
        g.lineWidth = 3;
        for (const offset of [-25, 18, 31]) {
            g.moveTo(-x + 26, offset);
            g.bezierCurveTo(-80, offset + 3, 120, offset - 4, x - 30, offset + 1);
            g.stroke();
        }
    }

    private drawTape(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        rotation: number,
        color = C.tape,
    ): Node {
        const tape = this.makeNode(parent, name, x, y, width, height);
        tape.setRotationFromEuler(0, 0, rotation);
        const g = tape.addComponent(Graphics);
        this.polygon(g, [
            [-width * 0.5 + 4, height * 0.5], [width * 0.5 - 7, height * 0.5 - 2],
            [width * 0.5, 3], [width * 0.5 - 5, -height * 0.5], [-width * 0.5 + 3, -height * 0.5 + 2],
            [-width * 0.5, -2],
        ], color, new Color(0x86, 0x69, 0x3d, 0x30), 1);
        g.strokeColor = new Color(0xff, 0xff, 0xff, 0x32);
        g.lineWidth = 1;
        g.moveTo(-width * 0.42, height * 0.2);
        g.lineTo(width * 0.38, height * 0.12);
        g.stroke();
        return tape;
    }

    private drawPaperHoles(g: Graphics, x: number, startY: number, count: number, spacing: number): void {
        g.fillColor = C.paper;
        for (let i = 0; i < count; i += 1) {
            g.circle(x + (i % 2 ? 1 : -1), startY - i * spacing, 14);
            g.fill();
            g.strokeColor = new Color(0x78, 0x71, 0x68, 0x40);
            g.lineWidth = 1;
            g.circle(x + (i % 2 ? 1 : -1), startY - i * spacing, 14);
            g.stroke();
        }
    }

    private polygon(g: Graphics, points: readonly Point[], fill: Color, stroke: Color, lineWidth: number): void {
        if (points.length === 0) return;
        g.fillColor = fill;
        g.strokeColor = stroke;
        g.lineWidth = lineWidth;
        g.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i += 1) g.lineTo(points[i][0], points[i][1]);
        g.close();
        g.fill();
        if (lineWidth > 0) g.stroke();
    }

    private roundedRect(
        g: Graphics,
        x: number,
        y: number,
        width: number,
        height: number,
        fill: Color,
        stroke: Color,
        lineWidth: number,
        radius: number,
    ): void {
        g.fillColor = fill;
        g.strokeColor = stroke;
        g.lineWidth = lineWidth;
        g.roundRect(x, y, width, height, radius);
        g.fill();
        g.stroke();
    }

    private fillCircle(g: Graphics, x: number, y: number, radius: number, color: Color): void {
        g.fillColor = color;
        g.circle(x, y, radius);
        g.fill();
    }

    private strokeCircle(g: Graphics, x: number, y: number, radius: number, color: Color, width: number): void {
        g.strokeColor = color;
        g.lineWidth = width;
        g.circle(x, y, radius);
        g.stroke();
    }

    private drawUnderline(parent: Node, name: string, x: number, y: number, width: number, color: Color, tilt: number): void {
        const line = this.graphics(parent, name, x, y, width, 16);
        line.node.setRotationFromEuler(0, 0, tilt);
        line.strokeColor = color;
        line.lineWidth = 3;
        line.moveTo(-width * 0.5, 1);
        line.bezierCurveTo(-width * 0.16, 5, width * 0.18, -4, width * 0.5, 2);
        line.stroke();
        line.lineWidth = 1.4;
        line.moveTo(-width * 0.42, -4);
        line.bezierCurveTo(-30, -1, 45, -7, width * 0.42, -3);
        line.stroke();
    }

    private drawDashedCutLine(parent: Node, x: number, y: number, width: number): void {
        const g = this.graphics(parent, 'CutLine', x + width * 0.5, y, width, 16);
        g.strokeColor = C.ink;
        g.lineWidth = 2.5;
        for (let offset = -width * 0.5; offset < width * 0.5; offset += 30) {
            g.moveTo(offset, 0);
            g.lineTo(Math.min(offset + 17, width * 0.5), 0);
            g.stroke();
        }
    }

    private drawAvatar(parent: Node): void {
        const g = this.graphics(parent, 'HandDrawnAvatar', 0, -3, 88, 88);
        g.strokeColor = C.ink;
        g.lineWidth = 3;
        g.fillColor = C.paperRaised;
        g.circle(0, -5, 31);
        g.fill();
        g.stroke();
        g.moveTo(-32, 8);
        g.lineTo(-21, 29);
        g.lineTo(-10, 21);
        g.lineTo(0, 36);
        g.lineTo(10, 22);
        g.lineTo(24, 31);
        g.lineTo(31, 8);
        g.stroke();
        g.fillColor = C.ink;
        g.circle(-11, -7, 2.5);
        g.circle(11, -7, 2.5);
        g.fill();
        g.moveTo(-7, -20);
        g.quadraticCurveTo(0, -24, 7, -20);
        g.stroke();
    }

    private drawSmallFriend(parent: Node, x: number, y: number): void {
        const g = this.graphics(parent, 'FriendAvatar', x, y, 64, 64);
        g.strokeColor = C.ink;
        g.lineWidth = 2.4;
        g.fillColor = C.paperRaised;
        g.circle(0, -3, 25);
        g.fill();
        g.stroke();
        g.moveTo(-24, 7);
        g.lineTo(-14, 24);
        g.lineTo(-3, 18);
        g.lineTo(8, 27);
        g.lineTo(20, 12);
        g.stroke();
        g.fillColor = C.ink;
        g.circle(-8, -5, 2);
        g.circle(8, -5, 2);
        g.fill();
    }

    private drawLightning(parent: Node, x: number, y: number, size: number): void {
        const shadow = this.graphics(parent, 'LightningMarker', x - 4, y, size + 34, size + 32);
        this.polygon(shadow, [
            [-30, 8], [-5, 42], [11, 38], [4, 13], [29, 12], [-12, -44], [-7, -10], [-28, -12],
        ], C.yellow, new Color(0, 0, 0, 0), 0);
        const g = this.graphics(parent, 'EnergyIcon', x, y, size, size + 16);
        this.polygon(g, [
            [-20, 34], [12, 34], [4, 8], [25, 8], [-12, -40], [-6, -9], [-26, -9],
        ], C.yellow, C.ink, 5);
    }

    private drawHourglass(parent: Node): void {
        const g = this.graphics(parent, 'HourglassDrawing', 0, 0, 96, 132);
        g.strokeColor = C.ink;
        g.lineWidth = 5;
        g.moveTo(-34, 54);
        g.lineTo(34, 54);
        g.moveTo(-34, -54);
        g.lineTo(34, -54);
        g.moveTo(-27, 48);
        g.bezierCurveTo(-24, 18, 22, 8, 24, -45);
        g.moveTo(27, 48);
        g.bezierCurveTo(24, 18, -22, 8, -24, -45);
        g.stroke();
        g.fillColor = C.inkSoft;
        g.moveTo(-18, -28);
        g.lineTo(18, -28);
        g.lineTo(0, -5);
        g.close();
        g.fill();
        for (const offset of [-1, -9, -18]) {
            g.circle(offset * 0.25, offset - 2, 2);
            g.fill();
        }
    }

    private drawPlayIcon(parent: Node, x: number, y: number, size: number): void {
        const g = this.graphics(parent, 'PlayIcon', x, y, size, size);
        this.polygon(g, [[-14, 20], [23, 0], [-14, -20]], C.ink, C.ink, 2);
        g.strokeColor = C.paperRaised;
        g.lineWidth = 2;
        g.moveTo(-7, 10);
        g.lineTo(9, 0);
        g.stroke();
    }

    private drawScissors(parent: Node, x: number, y: number, size: number): void {
        const g = this.graphics(parent, 'ScissorsIcon', x, y, size, size);
        g.strokeColor = C.ink;
        g.lineWidth = 5;
        g.circle(-18, 15, 10);
        g.circle(-18, -14, 10);
        g.stroke();
        g.moveTo(-10, 9);
        g.lineTo(27, -24);
        g.moveTo(-10, -8);
        g.lineTo(27, 24);
        g.stroke();
        g.fillColor = C.ink;
        g.circle(-1, 0, 3);
        g.fill();
    }

    private drawReverseFace(parent: Node, x: number, y: number, size: number): void {
        const g = this.graphics(parent, 'ReverseIcon', x, y, size * 2, size * 2);
        g.strokeColor = C.ink;
        g.lineWidth = 4;
        g.circle(0, 0, size * 0.68);
        g.stroke();
        for (const eyeX of [-18, 18]) {
            g.moveTo(eyeX - 6, 18);
            g.lineTo(eyeX + 6, 6);
            g.moveTo(eyeX + 6, 18);
            g.lineTo(eyeX - 6, 6);
            g.stroke();
        }
        g.moveTo(-24, -12);
        g.bezierCurveTo(-4, -26, 9, -2, 29, -17);
        g.stroke();
        g.moveTo(2, -18);
        g.lineTo(4, -42);
        g.quadraticCurveTo(17, -46, 21, -22);
        g.stroke();
    }

    private drawThumbtack(parent: Node, x: number, y: number): void {
        const g = this.graphics(parent, 'Thumbtack', x, y, 40, 50);
        g.strokeColor = C.ink;
        g.lineWidth = 2;
        g.fillColor = new Color(0x21, 0x79, 0xbf, 0xff);
        g.circle(0, 5, 13);
        g.fill();
        g.stroke();
        g.moveTo(0, -8);
        g.lineTo(-2, -25);
        g.stroke();
    }

    private drawGlobe(parent: Node, x: number, y: number, radius: number): void {
        const g = this.graphics(parent, 'Globe', x, y, radius * 2 + 12, radius * 2 + 12);
        g.fillColor = new Color(0x65, 0xba, 0xde, 0xff);
        g.strokeColor = C.ink;
        g.lineWidth = 4;
        g.circle(0, 0, radius);
        g.fill();
        g.stroke();
        g.fillColor = new Color(0x69, 0xa9, 0x45, 0xff);
        const land: Point[][] = [
            [[-50, 26], [-34, 45], [-9, 37], [-17, 18], [-36, 12]],
            [[14, 46], [43, 35], [52, 16], [27, 11], [16, 26]],
            [[-8, -2], [18, 5], [33, -18], [15, -42], [-4, -31], [-22, -12]],
            [[-55, -18], [-37, -8], [-30, -38], [-46, -45]],
        ];
        land.forEach((shape) => this.polygon(g, shape, g.fillColor, C.inkSoft, 1.8));
        g.strokeColor = new Color(0xff, 0xff, 0xff, 0xaa);
        g.lineWidth = 2;
        g.arc(0, 0, radius * 0.58, -1.25, 1.25, false);
        g.stroke();
    }

    private drawNavIcon(parent: Node, index: number, x: number, y: number): void {
        const g = this.graphics(parent, 'HandDrawnIcon', x, y, 92, 72);
        g.strokeColor = C.ink;
        g.lineWidth = 4;
        if (index === 0) {
            g.moveTo(-34, 1);
            g.lineTo(0, 31);
            g.lineTo(34, 1);
            g.moveTo(-26, 7);
            g.lineTo(-26, -29);
            g.lineTo(26, -29);
            g.lineTo(26, 7);
            g.stroke();
            g.rect(-8, -28, 16, 24);
            g.stroke();
        } else if (index === 1) {
            g.moveTo(-29, 28);
            g.lineTo(30, -27);
            g.moveTo(-30, -26);
            g.lineTo(28, 29);
            g.stroke();
            g.circle(-31, 31, 5);
            g.circle(31, 31, 5);
            g.stroke();
        } else if (index === 2) {
            g.moveTo(-30, 22);
            g.lineTo(-15, -15);
            g.lineTo(0, 11);
            g.lineTo(15, -16);
            g.lineTo(31, 22);
            g.lineTo(24, -28);
            g.lineTo(-24, -28);
            g.close();
            g.stroke();
            g.circle(-31, 27, 5);
            g.circle(0, 17, 5);
            g.circle(32, 27, 5);
            g.stroke();
        } else {
            g.rect(-28, -29, 56, 58);
            g.stroke();
            g.moveTo(-20, 7);
            g.lineTo(-3, 7);
            g.moveTo(5, 7);
            g.lineTo(22, 7);
            g.stroke();
            g.moveTo(-15, -11);
            g.quadraticCurveTo(0, -21, 15, -11);
            g.stroke();
        }
    }

    private getTopInset(visibleHeight: number): number {
        const wxApi = (globalThis as { wx?: WechatApi }).wx;
        try {
            const info = wxApi?.getSystemInfoSync?.();
            const capsule = wxApi?.getMenuButtonBoundingClientRect?.();
            if (info && capsule && info.screenHeight > 0) {
                return capsule.bottom * visibleHeight / info.screenHeight + 10;
            }
            if (info?.safeArea && info.screenHeight > 0) {
                return info.safeArea.top * visibleHeight / info.screenHeight + 18;
            }
        } catch {
            // Creator preview and App builds use the conservative fallback.
        }
        return 54;
    }

    private getBottomInset(visibleHeight: number): number {
        const wxApi = (globalThis as { wx?: WechatApi }).wx;
        try {
            const info = wxApi?.getSystemInfoSync?.();
            if (info?.safeArea && info.screenHeight > 0) {
                const inset = info.screenHeight - info.safeArea.bottom;
                return Math.max(28, inset * visibleHeight / info.screenHeight + 20);
            }
        } catch {
            // Creator preview and App builds use the conservative fallback.
        }
        return 42;
    }

    private pulseHaptic(): void {
        try {
            (globalThis as { wx?: WechatApi }).wx?.vibrateShort?.({ type: 'light' });
        } catch {
            // Haptics are optional on desktop preview and unsupported devices.
        }
    }
}
