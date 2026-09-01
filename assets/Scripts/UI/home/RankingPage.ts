import {
    _decorator,
    Button,
    Color,
    Component,
    Graphics,
    ImageAsset,
    Label,
    Layers,
    Mask,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    SubContextView,
    UITransform,
    Vec3,
} from 'cc';
import { EDITOR } from 'cc/env';
import { AppRuntime } from '../../app/AppRuntime';
import { createLocalLeaderboard, emptyBrawlRecord, type LeaderboardEntry, type LeaderboardMode } from '../../domain/Leaderboard';
import { HOME_HAND_DRAWN as C } from '../DesignTokens';
import { applyGameFont } from '../GameFont';
import { loadAvatarFrame } from './AvatarFrameLoader';

const { ccclass, executeInEditMode } = _decorator;

const ROW_Y = [-28, -104, -180, -256, -332, -408, -484] as const;
const DISPLAY_ORDER = [1, 0, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const BOARD_SCALE = 1.08;
// Keep the paper's upper edge in place and let the enlarged board grow downwards.
const BOARD_Y = -38;

/** Runtime-built ranking page that shares Home's header and bottom navigation. */
@ccclass('RankingPage')
@executeInEditMode(true)
export class RankingPage extends Component {
    private mode: LeaderboardMode = 'brawl';
    private brawlSelection: Node | null = null;
    private trialSelection: Node | null = null;
    private scoreLabels: Label[] = [];
    private nameLabels: Label[] = [];
    private detailLabels: Label[] = [];
    private avatarSlots: Node[] = [];
    private selfAvatar: Node | null = null;
    private selfRankLabel: Label | null = null;
    private selfScoreLabel: Label | null = null;
    private selfDetailLabel: Label | null = null;
    private removeProfileListener: (() => void) | null = null;
    private openDataView: Node | null = null;
    private readonly localDataNodes: Node[] = [];
    private readonly avatarRequests = new Map<Node, string>();

    protected onLoad(): void {
        this.buildView();
        if (!EDITOR) this.removeProfileListener = AppRuntime.platform.onAuthorizedUserProfileChanged(() => {
            this.refreshScores();
            this.refreshOpenDataLeaderboard();
        });
        this.refreshScores();
    }

    protected onDestroy(): void {
        if (!EDITOR) AppRuntime.platform.postLeaderboardMessage({ type: 'brainSlashLeaderboard', action: 'hide' });
        this.removeProfileListener?.();
        this.removeProfileListener = null;
        this.avatarRequests.clear();
    }

    protected onEnable(): void {
        if (this.scoreLabels.length > 0) {
            this.refreshScores();
            this.refreshOpenDataLeaderboard();
        }
    }

    public selectMode(mode: LeaderboardMode): void {
        if (this.mode === mode) return;
        this.mode = mode;
        if (this.brawlSelection) this.brawlSelection.active = mode === 'brawl';
        if (this.trialSelection) this.trialSelection.active = mode === 'trial';
        this.refreshScores();
        // All leaderboard keys are fetched together. Switching tabs only
        // changes the projection/sort of the current friend snapshot; asking
        // WeChat for the same data again can return a transient empty list.
        this.refreshOpenDataLeaderboard(false);
        if (!EDITOR) AppRuntime.audio.play('ui');
    }

    public refreshFriendData(): void {
        this.refreshScores();
        this.refreshOpenDataLeaderboard();
    }

    private buildView(): void {
        this.node.name = 'RankingPage';
        this.node.layer = Layers.Enum.UI_2D;
        this.node.getComponent(UITransform)?.setContentSize(C.designWidth, 1450);

        const title = this.makeNode(this.node, 'RankingTitle', 0, 505, 590, 308);
        this.attachTexture(title, 'textures/rank/ui/ranking_title');

        const board = this.makeNode(this.node, 'RankingBoard', 0, BOARD_Y, C.designWidth, 1250);
        board.setScale(BOARD_SCALE, BOARD_SCALE, 1);

        // The paper reaches behind the tabs. Create it first so its opaque top
        // edge cannot cover the tab artwork and touch targets.
        const paper = this.makeNode(board, 'RankingPaper', 0, -58, 842, 1052);
        this.attachTexture(paper, 'textures/rank/ui/ranking_paper');

        const tabs = this.makeNode(board, 'RankingTabs', 0, 345, 820, 188);
        this.attachTexture(tabs, 'textures/rank/ui/ranking_tabs');
        this.brawlSelection = tabs.getChildByName('TextureSprite');
        this.buildTrialSelection(tabs);

        const brawlButton = this.makeNode(tabs, 'BrawlTabButton', -205, 4, 380, 132);
        const trialButton = this.makeNode(tabs, 'TrialTabButton', 205, 4, 380, 132);
        this.bindButton(brawlButton, () => this.selectMode('brawl'));
        this.bindButton(trialButton, () => this.selectMode('trial'));

        this.buildPodium(board);
        this.buildRows(board);
        this.buildSelfRanking(board);
        this.setupOpenDataLeaderboard(board);
    }

    private buildTrialSelection(parent: Node): void {
        // Use a pixel-preserving variant of the original artwork. It moves
        // only the yellow brush and scales the baked-in Trial text slightly,
        // so no system-font labels or replacement tab shapes are introduced.
        const overlay = this.makeNode(parent, 'TrialSelectedOverlay', 0, 0, 820, 188);
        this.attachTexture(overlay, 'textures/rank/ui/ranking_tabs_trial');
        overlay.active = false;
        this.trialSelection = overlay;
    }

    private buildPodium(parent: Node): void {
        const podium = [
            { asset: 'ranking_silver', x: -250, y: 207, size: [156, 190] as [number, number], faceX: -248, faceY: 212, avatarSize: 104 },
            { asset: 'ranking_gold', x: 0, y: 232, size: [210, 236] as [number, number], faceX: -3, faceY: 223, avatarSize: 112 },
            { asset: 'ranking_bronze', x: 250, y: 207, size: [156, 190] as [number, number], faceX: 250, faceY: 212, avatarSize: 104 },
        ];

        podium.forEach((item, index) => {
            const medal = this.makeNode(parent, `PodiumMedal_${index + 1}`, item.x, item.y, item.size[0], item.size[1]);
            this.attachTexture(medal, `textures/rank/ui/${item.asset}`);
            const avatar = this.drawAvatar(parent, `PodiumAvatar_${index + 1}`, item.faceX, item.faceY, item.avatarSize);
            this.avatarSlots.push(avatar);
            this.localDataNodes.push(avatar);
            const name = this.label(parent, `PodiumName_${index + 1}`, '', item.x, 101, 210, 46, 31, C.ink);
            this.nameLabels.push(name);
            this.localDataNodes.push(name.node);
            const score = this.label(parent, `PodiumScore_${index + 1}`, '', item.x, 59, 180, 44, 30, C.ink);
            this.scoreLabels.push(score);
            this.localDataNodes.push(score.node);
            const detail = this.label(parent, `PodiumDetail_${index + 1}`, '', item.x + 12, 27, 242, 32, 20, C.inkSoft);
            this.detailLabels.push(detail);
            this.localDataNodes.push(detail.node);
        });
    }

    private buildRows(parent: Node): void {
        ROW_Y.forEach((y, index) => {
            const rank = this.label(parent, `Rank_${index + 4}`, `${index + 4}`, -300, y, 60, 56, 29, C.ink);
            const avatar = this.drawAvatar(parent, `RowAvatar_${index + 4}`, -242, y, 40, true);
            const name = this.label(parent, `Name_${index + 4}`, '', -78, y + 13, 258, 34, 25, C.ink, 'left');
            const detail = this.label(parent, `Detail_${index + 4}`, '', -42, y - 16, 330, 28, 20, C.inkSoft, 'left');
            this.avatarSlots.push(avatar);
            this.nameLabels.push(name);
            this.detailLabels.push(detail);
            this.localDataNodes.push(rank.node, avatar, name.node, detail.node);
            const score = this.label(parent, `Score_${index + 4}`, '', 244, y, 154, 56, 25, C.ink);
            this.scoreLabels.push(score);
            this.localDataNodes.push(score.node);
        });
    }

    private buildSelfRanking(parent: Node): void {
        const card = this.makeNode(parent, 'MyRankingCard', 0, -638, 842, 252);
        this.attachTexture(card, 'textures/rank/ui/ranking_self');
        this.selfRankLabel = this.label(card, 'MyRank', '', -333, -5, 92, 92, 42, C.ink);
        this.selfAvatar = this.drawAvatar(card, 'MyAvatar', -253, -42, 114);
        const selfName = this.label(card, 'MyName', '我', -30, 18, 280, 52, 34, C.ink);
        this.selfDetailLabel = this.label(card, 'MyDetail', '', -5, -33, 390, 36, 22, C.inkSoft);
        this.selfScoreLabel = this.label(card, 'MyScore', '', 244, -38, 182, 72, 31, C.ink);
        this.localDataNodes.push(this.selfRankLabel.node, this.selfAvatar, selfName.node, this.selfDetailLabel.node, this.selfScoreLabel.node);
    }

    private setupOpenDataLeaderboard(parent: Node): void {
        if (EDITOR || !AppRuntime.platform.supportsFriendLeaderboard()) return;
        // Shift the shared-canvas node down while its drawing coordinates are
        // compensated upwards in openDataContext. Screen positions stay fixed,
        // but the self avatar gains room below the former clipping boundary.
        const viewNode = this.makeNode(parent, 'WechatFriendLeaderboard', 0, -20, C.designWidth, 1450);
        const view = viewNode.addComponent(SubContextView);
        view.fps = 10;
        this.openDataView = viewNode;
        this.localDataNodes.forEach((node) => { node.active = false; });
        // onEnable owns the initial request. Scheduling a second request here
        // created two concurrent cloud reads on first entry and allowed a later
        // transient empty response to supersede the valid one.
    }

    private refreshOpenDataLeaderboard(refreshCloudData = true): void {
        if (EDITOR || !this.openDataView?.activeInHierarchy) return;
        const save = AppRuntime.save.snapshot();
        const answeredCount = save.leaderboard.trialAnsweredCount;
        AppRuntime.platform.postLeaderboardMessage({
            type: 'brainSlashLeaderboard',
            action: 'show',
            mode: this.mode,
            refreshCloudData,
            profile: AppRuntime.platform.authorizedUserProfile(),
            localRecord: {
                brawl: save.leaderboard.brawlBest,
                trial: {
                    highestFloor: save.tower.highestClearedFloor,
                    answeredCount,
                    accuracy: answeredCount > 0 ? save.leaderboard.trialCorrectCount / answeredCount : 0,
                },
            },
        });
    }

    private refreshScores(): void {
        const save = EDITOR ? null : AppRuntime.save.snapshot();
        const trialAnswered = save?.leaderboard.trialAnsweredCount ?? 0;
        const snapshot = createLocalLeaderboard(this.mode, {
            brawl: save?.leaderboard.brawlBest ?? emptyBrawlRecord(),
            trial: {
                highestFloor: save?.tower.highestClearedFloor ?? 0,
                answeredCount: trialAnswered,
                accuracy: trialAnswered > 0 ? (save?.leaderboard.trialCorrectCount ?? 0) / trialAnswered : 0,
            },
        });
        const authorizedAvatar = EDITOR ? undefined : AppRuntime.platform.authorizedUserProfile()?.avatarUrl;
        const usesOpenData = Boolean(this.openDataView);
        DISPLAY_ORDER.forEach((rankIndex, displayIndex) => {
            const entry = snapshot.top[rankIndex];
            const scoreLabel = this.scoreLabels[displayIndex];
            const nameLabel = this.nameLabels[displayIndex];
            const detailLabel = this.detailLabels[displayIndex];
            if (scoreLabel) scoreLabel.string = entry ? this.scoreText(entry) : '—';
            if (nameLabel) nameLabel.string = entry?.name ?? '—';
            if (detailLabel) detailLabel.string = entry ? this.detailText(entry) : '';
            const avatarUrl = entry?.avatarUrl ?? (entry?.isSelf ? authorizedAvatar : undefined);
            const avatarSlot = this.avatarSlots[displayIndex];
            if (avatarSlot && !usesOpenData) this.updateAvatar(avatarSlot, avatarUrl);
        });
        if (this.selfRankLabel) this.selfRankLabel.string = `${snapshot.self.rank}`;
        if (this.selfScoreLabel) this.selfScoreLabel.string = this.scoreText(snapshot.self);
        if (this.selfDetailLabel) this.selfDetailLabel.string = this.detailText(snapshot.self);
        if (this.selfAvatar && !usesOpenData) this.updateAvatar(this.selfAvatar, snapshot.self.avatarUrl ?? authorizedAvatar);
    }

    private scoreText(entry: LeaderboardEntry): string {
        return this.mode === 'brawl' ? `综合 ${entry.score}` : `第 ${entry.score} 层`;
    }

    private detailText(entry: LeaderboardEntry): string {
        if (this.mode === 'trial') return `${entry.trial?.answeredCount ?? 0}题 · ${percent(entry.trial?.accuracy ?? 0)}`;
        const data = entry.brawl!;
        return `答对${Math.round(data.answeredCount * data.accuracy)}题 · C${data.maxCombo} · ${percent(data.accuracy)}`;
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

    private drawAvatar(parent: Node, name: string, x: number, y: number, size: number, drawOutline = false): Node {
        const slot = this.makeNode(parent, name, x, y, size, size);
        if (drawOutline) {
            const placeholder = this.graphics(slot, 'CircularPlaceholder', 0, 0, size, size);
            placeholder.fillColor = C.paperRaised;
            placeholder.strokeColor = C.inkSoft;
            placeholder.lineWidth = 2;
            placeholder.circle(0, 0, size * 0.46);
            placeholder.fill();
            placeholder.stroke();
        }

        // This node records the exact future avatar bounds. Do not add a Mask
        // until an actual avatar exists: an empty GraphicsEllipse mask renders
        // as an extra paper-colored disk on some WeChat devices.
        const placeholder = this.makeNode(slot, 'AvatarPlaceholder', 0, 0, size, size);
        placeholder.active = false;
        return slot;
    }

    private updateAvatar(slot: Node, avatarUrl: string | undefined): void {
        const placeholder = slot.getChildByName('AvatarPlaceholder');
        if (!placeholder) return;
        if (!avatarUrl) {
            this.avatarRequests.delete(slot);
            placeholder.active = false;
            return;
        }
        placeholder.active = true;
        let mask = placeholder.getComponent(Mask);
        if (!mask) {
            mask = placeholder.addComponent(Mask);
            mask.type = Mask.Type.GRAPHICS_ELLIPSE;
            mask.segments = 48;
        }
        let artwork = placeholder.getChildByName('Artwork');
        if (!artwork) {
            const size = placeholder.getComponent(UITransform)!.contentSize;
            artwork = this.makeNode(placeholder, 'Artwork', 0, 0, size.width, size.height);
            const artworkSprite = artwork.addComponent(Sprite);
            artworkSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            artworkSprite.type = Sprite.Type.SIMPLE;
        }
        const sprite = artwork.getComponent(Sprite)!;
        this.avatarRequests.set(slot, avatarUrl);
        sprite.spriteFrame = null;
        loadAvatarFrame(avatarUrl, (error, frame) => {
            if (error || !frame || !slot.isValid || this.avatarRequests.get(slot) !== avatarUrl) {
                if (error) console.warn('[Ranking] Authorized avatar failed to load', error);
                return;
            }
            if (sprite.node.isValid) sprite.spriteFrame = frame;
        });
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
        return applyGameFont(label);
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

function percent(value: number): string { return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`; }
