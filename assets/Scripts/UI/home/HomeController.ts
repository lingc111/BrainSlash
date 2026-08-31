import {
    _decorator,
    BlockInputEvents,
    Button,
    Camera,
    Color,
    Component,
    Graphics,
    ImageAsset,
    Label,
    Layers,
    Mask,
    Node,
    ResolutionPolicy,
    resources,
    screen,
    Sprite,
    SpriteFrame,
    tween,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    view,
} from 'cc';
import { EDITOR } from 'cc/env';
import { HOME_HAND_DRAWN as C } from '../DesignTokens';
import { CONTENT_VERSION } from '../../configs/GameConfig';
import { createDailyChallenge, createDailyHomePresentation } from '../../domain/DailyChallenge';
import {
    FRIEND_CHALLENGE_DURATIONS,
    FRIEND_CHALLENGE_RULES,
    FRIEND_CHALLENGE_THEMES,
    friendChallengeConfigSummary,
    normalizeFriendChallengeConfig,
} from '../../domain/FriendChallenge';
import type { FriendChallengeConfig, FriendChallengeDurationMs, RuleId, ThemeId } from '../../domain/Models';
import { nextTowerUnlock, towerFloorChallengeSummary, towerFloorDisplayName, towerFloorConfig, towerRuleLabel } from '../../domain/TowerMode';
import { CountdownTimer } from './CountdownTimer';
import { calculateHomePortraitLayout } from './HomePortraitLayout';
import { createMockHomeViewData, HomeViewData } from './HomeViewData';
import { RankingPage } from './RankingPage';
import { AppRuntime } from '../../app/AppRuntime';
import { applyGameFont, gameFontLineHeight } from '../GameFont';
import { loadAvatarFrame } from './AvatarFrameLoader';

const { ccclass, executeInEditMode } = _decorator;

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
@executeInEditMode(true)
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
    private rankingPage: Node | null = null;
    private bottomNavigation: Node | null = null;
    private settingsModal: Node | null = null;
    private friendChallengeModal: Node | null = null;
    private featureNoticeModal: Node | null = null;
    private helpModal: Node | null = null;
    private removePendingChallengeListener: (() => void) | null = null;
    private removeUserProfileListener: (() => void) | null = null;
    private avatarMask: Node | null = null;
    private avatarRequestUrl: string | null = null;

    private levelLabel: Label | null = null;
    private dailyTitleLabel: Label | null = null;
    private dailyStatusLabel: Label | null = null;
    private countdownLabel: Label | null = null;
    private dailyEventTitleLabel: Label | null = null;
    private dailyEventGoalLabel: Label | null = null;
    private progressValueLabel: Label | null = null;
    private progressCells: Node[] = [];
    private navSelectionMarkers: Node[] = [];
    private navIconOpacities: UIOpacity[] = [];

    private readonly handleResize = (): void => this.applyLayout();

    protected onLoad(): void {
        if (!EDITOR) {
            AppRuntime.initialize();
            const save = AppRuntime.save.snapshot();
            const daily = createDailyChallenge(new Date(), CONTENT_VERSION);
            const dailyView = createDailyHomePresentation(daily, save.daily);
            const nextUnlock = nextTowerUnlock(save.tower.currentFloor);
            const floorConfig = towerFloorConfig(save.tower.currentFloor);
            const currentUnlock = floorConfig.unlockedRule ? towerRuleLabel(floorConfig.unlockedRule)
                : floorConfig.unlocksCompoundRules ? '双规则' : undefined;
            this.data = {
                ...createMockHomeViewData(),
                level: save.player.level,
                rankName: save.leaderboard.brawlBest.rankScore > 0
                    ? `最高 ${save.leaderboard.brawlBest.rankScore}` : '新手',
                rankProgress: save.player.xp % 500,
                rankProgressMax: 500,
                dailyAccent: dailyView.accent,
                dailyTitle: dailyView.title,
                dailyStatus: dailyView.status,
                dailyGoal: dailyView.goal,
                dailyAchieved: dailyView.achieved,
                challengeEndTime: dailyView.endTime,
                towerFloor: save.tower.currentFloor,
                towerHighestFloor: save.tower.highestClearedFloor,
                towerPoints: save.tower.totalTowerPoints,
                towerFloorTitle: towerFloorDisplayName(save.tower.currentFloor),
                towerHint: save.tower.towerMvpCompleted ? 'MVP塔巅已突破 · 可重战第50层'
                    : currentUnlock ? `本层解锁${currentUnlock}`
                    : save.tower.currentFloor >= 8 ? `通关：${towerFloorChallengeSummary(save.tower.currentFloor)}`
                    : nextUnlock ? `再过 ${nextUnlock.floor - save.tower.currentFloor} 层解锁${nextUnlock.label}` : '挑战塔巅试炼',
            };
        }
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
        this.finishBuildingView();
    }

    protected onEnable(): void {
        if (EDITOR) {
            this.applyLayout();
            return;
        }
        screen.on('window-resize', this.handleResize, this);
        this.applyLayout();
        this.scheduleOnce(this.applyLayout, 0);
        this.countdown.start(
            this.data.challengeEndTime,
            () => undefined,
            this.onChallengeExpired.bind(this),
        );
    }

    protected onDisable(): void {
        screen.off('window-resize', this.handleResize, this);
        this.countdown.stop();
    }

    protected onDestroy(): void {
        this.countdown.stop();
        if (!EDITOR) AppRuntime.platform.hideUserAuthorizationButton();
        this.removePendingChallengeListener?.();
        this.removePendingChallengeListener = null;
        this.removeUserProfileListener?.();
        this.removeUserProfileListener = null;
        this.avatarRequestUrl = null;
        if (this.dailyChallenge) Tween.stopAllByTarget(this.dailyChallenge);
    }

    public refresh(data: HomeViewData): void {
        this.data = { ...data };
        if (this.levelLabel) this.levelLabel.string = `Lv.${data.level}  ${data.rankName}`;
        if (this.dailyTitleLabel) this.dailyTitleLabel.string = data.towerFloorTitle;
        if (this.dailyStatusLabel) this.dailyStatusLabel.string = `最高 ${data.towerHighestFloor} 层 · 塔积分 ${data.towerPoints}`;
        if (this.countdownLabel) this.countdownLabel.string = data.towerHint;
        if (this.dailyEventTitleLabel) this.dailyEventTitleLabel.string = data.dailyTitle;
        if (this.dailyEventTitleLabel) this.dailyEventTitleLabel.color = data.dailyAchieved ? C.green : C.blue;
        if (this.dailyEventGoalLabel) {
            this.dailyEventGoalLabel.string = data.dailyAchieved
                ? data.dailyStatus
                : data.dailyStatus.startsWith('最佳') ? data.dailyStatus : `${data.dailyGoal} · 首战待斩`;
            this.dailyEventGoalLabel.color = data.dailyAchieved ? C.green : C.inkSoft;
        }
        if (this.progressValueLabel) {
            this.progressValueLabel.string = `${data.rankProgress}/${data.rankProgressMax}`;
        }
        this.refreshProgressCells();

        if (!EDITOR && this.enabled && this.node.activeInHierarchy) {
            this.countdown.start(
                data.challengeEndTime,
                () => undefined,
                this.onChallengeExpired.bind(this),
            );
        }
    }

    public onDailyChallengeClick(): void {
        this.pulseHaptic();
        AppRuntime.start('daily');
    }

    public onTowerClick(): void {
        this.pulseHaptic();
        AppRuntime.start('tower');
    }

    public onBrawlClick(): void {
        this.pulseHaptic();
        AppRuntime.start('brawl60');
    }

    public onReverseDayClick(): void {
        this.pulseHaptic();
        if (AppRuntime.hasPendingFriendChallenge()) this.showPendingFriendChallenge();
        else this.showFriendChallengeSetup();
    }

    public onFlagHunterClick(): void {
        this.onDailyChallengeClick();
    }

    public onHelpClick(): void {
        this.pulseHaptic();
        this.showHelpModal();
    }

    public onHomeClick(): void {
        this.closeSettings();
        this.showPage('home');
    }

    public onTopicClick(): void {
        this.closeSettings();
        this.pulseHaptic();
        this.showFeatureUnavailable();
    }

    public onRankClick(): void {
        this.closeSettings();
        this.showPage('rank');
        void AppRuntime.platform.authorizeFriendInteraction().then((result) => {
            if (result.status === 'authorized') this.rankingPage?.getComponent(RankingPage)?.refreshFriendData();
            else if (result.status !== 'unsupported') console.warn('[Home] Friend leaderboard authorization failed:', result.reason);
        });
    }

    public onProfileClick(): void {
        this.toggleSettings();
    }

    public onChallengeExpired(): void {
        if (!EDITOR) this.scheduleOnce(() => this.refreshLocalDaily(), 0);
    }

    private refreshLocalDaily(): void {
        const challenge = createDailyChallenge(new Date(), CONTENT_VERSION);
        const viewData = createDailyHomePresentation(challenge, AppRuntime.save.snapshot().daily);
        this.refresh({
            ...this.data,
            dailyAccent: viewData.accent,
            dailyTitle: viewData.title,
            dailyStatus: viewData.status,
            dailyGoal: viewData.goal,
            dailyAchieved: viewData.achieved,
            challengeEndTime: viewData.endTime,
        });
    }

    private buildView(): void {
        this.background = this.makeNode(this.node, 'Background', 0, 0, C.designWidth, C.designHeight);
        this.attachResourceTexture(this.background, 'textures/common/background_paper/spriteFrame', false, true);
        this.safeArea = this.makeNode(this.node, 'SafeArea', 0, 0, C.designWidth, C.designHeight);

        this.header = this.buildHeader(this.safeArea);
        this.dailyChallenge = this.buildTowerChallenge(this.safeArea);
        this.brawlButton = this.buildBrawlButton(this.safeArea);
        this.eventArea = this.buildEvents(this.safeArea);
        this.rankProgress = this.buildRankProgress(this.safeArea);
        this.rankingPage = this.makeNode(this.safeArea, 'RankingPage', 0, 0, C.designWidth, 1450);
        this.rankingPage.addComponent(RankingPage);
        this.rankingPage.active = false;
        this.bottomNavigation = this.buildBottomNavigation(this.safeArea);

        this.applyLayout();
        if (!EDITOR) this.startIdleMotion();
    }

    private finishBuildingView(): void {
        if (!this.node.isValid || this.safeArea) return;
        this.buildView();
        this.refresh(this.data);
        if (EDITOR) return;

        this.removePendingChallengeListener = AppRuntime.onPendingFriendChallenge(() => {
            this.scheduleOnce(() => {
                if (AppRuntime.hasPendingFriendChallenge()) this.showPendingFriendChallenge();
                else {
                    const challengeNotice = AppRuntime.consumeChallengeLaunchNotice();
                    if (challengeNotice) this.showChallengeLaunchNotice(challengeNotice);
                }
            }, 0);
        });
        this.updateHeaderAvatar();
        this.removeUserProfileListener = AppRuntime.platform.onAuthorizedUserProfileChanged(() => {
            this.updateHeaderAvatar();
        });
        if (AppRuntime.hasPendingFriendChallenge()) this.scheduleOnce(() => this.showPendingFriendChallenge(), 0);
        else if (AppRuntime.consumeFriendChallengeSetupRequest()) this.scheduleOnce(() => this.showFriendChallengeSetup(), 0);
        else {
            const challengeNotice = AppRuntime.consumeChallengeLaunchNotice();
            if (challengeNotice) this.scheduleOnce(() => this.showChallengeLaunchNotice(challengeNotice), 0);
        }
    }

    private buildHeader(parent: Node): Node {
        const header = this.makeNode(parent, 'Header', 0, 0, 820, 138);

        const avatarGroup = this.makeNode(header, 'Avatar', -342, 0, 116, 116);
        const avatarShadow = this.graphics(avatarGroup, 'PaperShadow', 5, -7, 106, 106);
        this.fillCircle(avatarShadow, 0, 0, 50, C.shadow);
        const avatarPaper = this.graphics(avatarGroup, 'PaperCircle', 0, 0, 106, 106);
        this.fillCircle(avatarPaper, 0, 0, 50, new Color(0xec, 0xe9, 0xe1, 0xff));
        this.strokeCircle(avatarPaper, 0, 0, 50, C.inkSoft, 2.5);
        this.buildAvatarMask(avatarGroup);
        this.drawTape(avatarGroup, 'TapeTop', -18, 50, 70, 26, -12);
        this.drawTape(avatarGroup, 'TapeBottom', 24, -48, 70, 24, 12);

        this.levelLabel = this.label(header, 'LevelLabel', '', -130, 8, 270, 70, 38, C.ink, 'left');
        this.drawUnderline(header, 'LevelUnderline', -112, -32, 265, C.ink, -2);

        const help = this.makeNode(header, 'HelpButton', 340, 0, 118, 118);
        const artwork = this.makeNode(help, 'HelpArtwork', 0, 0, 104, 104);
        this.attachResourceTexture(artwork, 'textures/home/ui/help/spriteFrame');
        this.bindButton(help, this.onHelpClick.bind(this));
        return header;
    }

    private buildTowerChallenge(parent: Node): Node {
        const root = this.makeNode(parent, 'TowerChallenge', 0, 0, 790, 600);
        // Keep the source's 4:3 ratio while enlarging the complete paper by
        // roughly 13%, giving the title and status rows enough breathing room.
        const paper = this.makeNode(root, 'PaperBackground', 0, 0, 890, 668);
        this.attachResourceTexture(paper, 'textures/home/ui/home_slash_paper/spriteFrame');

        const titleGroup = this.makeNode(root, 'TitleImagePlaceholder', -85, 122, 610, 175);
        this.label(titleGroup, 'TitleLine1', '答题试炼塔', -75, 42, 520, 78, 52, C.ink, 'center');
        this.dailyTitleLabel = this.label(titleGroup, 'TitleLine2', '第1层 · 基础试炼', 0, -43, 570, 84, 52, C.ink, 'center');
        this.drawUnderline(titleGroup, 'TitleRedUnderline', -18, -82, 520, C.red, -4);

        const towerIcon = this.makeNode(root, 'TowerIcon', 300, 110, 190, 190);
        this.attachResourceTexture(towerIcon, 'textures/home/ui/tower/spriteFrame');
        const towerSprite = towerIcon.getChildByName('TextureSprite')?.getComponent(Sprite);
        if (towerSprite) towerSprite.trim = false;

        const friend = this.makeNode(root, 'FriendBubble', -120, -42, 480, 78);
        const bubble = this.graphics(friend, 'BubbleOutline', -10, 0, 420, 68);
        this.roundedRect(bubble, -210, -32, 420, 64, C.paperRaised, C.ink, 2.5, 14);
        this.dailyStatusLabel = this.label(friend, 'TowerStatus', '', -9, 0, 386, 56, 24, C.ink, 'center');

        this.countdownLabel = this.label(root, 'TowerHint', '第3层解锁禁区', 255, -42, 270, 58, 25, C.ink, 'center');
        this.drawUnderline(root, 'CountdownUnderline', 255, -76, 230, C.red, -1);

        const start = this.makeNode(root, 'StartButton', 0, -195, 650, 136);
        // The source keeps generous transparent margins around the hand-drawn stroke.
        // Preserve its native ratio so the brush texture and lettering are not squeezed.
        const artwork = this.makeNode(start, 'ButtonArtwork', 0, 0, 610, 226);
        this.attachResourceTexture(artwork, 'textures/home/ui/draw_sword/spriteFrame');
        const artworkSprite = artwork.getChildByName('TextureSprite')?.getComponent(Sprite);
        // The transparent asset is auto-trimmed on import. Render against its
        // original canvas so the trimmed pixels are not stretched to this node.
        if (artworkSprite) artworkSprite.trim = false;
        start.setSiblingIndex(root.children.length - 1);
        this.bindButton(start, this.onTowerClick.bind(this));
        return root;
    }

    private buildBrawlButton(parent: Node): Node {
        // Enlarge the complete artwork and hit target by 15% while preserving
        // the source's long paper-strip aspect ratio.
        const root = this.makeNode(parent, 'BrawlButton', 0, 0, 918, 306);
        const paper = this.makeNode(root, 'YellowPaper', 0, 0, 918, 306);
        this.attachResourceTexture(paper, 'textures/home/ui/home_60s/spriteFrame');
        this.bindButton(root, this.onBrawlClick.bind(this));
        return root;
    }

    private buildEvents(parent: Node): Node {
        const area = this.makeNode(parent, 'EventArea', 0, 0, 820, 476);
        const cardScale = 1.13;

        const reverse = this.makeNode(area, 'ReverseDayCard', -208, 0, 336, 420);
        // Keep the replacement artwork at its native 1182:1330 ratio so its
        // paper edge and baked-in shadow are not stretched.
        const pink = this.makeNode(reverse, 'Paper', 0, 0, 373, 420);
        this.attachResourceTexture(pink, 'textures/home/ui/friend_challenge/spriteFrame');
        const pinkSprite = pink.getChildByName('TextureSprite')?.getComponent(Sprite);
        if (pinkSprite) pinkSprite.trim = false;
        this.bindButton(reverse, this.onReverseDayClick.bind(this));
        reverse.setScale(cardScale, cardScale, 1);

        const flag = this.makeNode(area, 'DailyChallengeCard', 208, 0, 336, 420);
        const polaroid = this.makeNode(flag, 'Polaroid', 0, 0, 373, 420);
        this.attachResourceTexture(polaroid, 'textures/home/ui/limited_activity/spriteFrame');
        const polaroidSprite = polaroid.getChildByName('TextureSprite')?.getComponent(Sprite);
        if (polaroidSprite) polaroidSprite.trim = false;
        this.dailyEventTitleLabel = this.label(flag, 'TitleLabel', '常识万花筒', 0, -108, 300, 40, 27, C.blue, 'center');
        this.dailyEventGoalLabel = this.label(flag, 'ChallengeSummary', '目标 1300 分 · 首战待斩', 0, -149, 304, 30, 18, C.inkSoft, 'center');
        this.bindButton(flag, this.onFlagHunterClick.bind(this));
        flag.setScale(cardScale, cardScale, 1);
        return area;
    }

    private buildRankProgress(parent: Node): Node {
        const root = this.makeNode(parent, 'RankProgress', 0, 0, 810, 112);
        this.label(root, 'TitleLabel', '等级进度', -276, 36, 300, 48, 32, C.ink, 'left');
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

        this.navSelectionMarkers = [];
        this.navIconOpacities = [];
        // The source canvases are equal, but each drawing occupies a different
        // pixel range. Per-item size and baseline offsets normalize the visible
        // icon scale while keeping every caption on the same horizontal line.
        const items: Array<[string, string, number, number, number, () => void]> = [
            ['HomeButton', 'nav_home', -306, 110, 0, this.onHomeClick.bind(this)],
            ['TopicButton', 'nav_topic', -102, 138, 3, this.onTopicClick.bind(this)],
            ['RankButton', 'nav_rank', 102, 134, -2, this.onRankClick.bind(this)],
            ['ProfileButton', 'nav_profile', 306, 152, 5, this.onProfileClick.bind(this)],
        ];
        items.forEach(([name, assetName, x, artworkSize, artworkY, callback], index) => {
            const item = this.makeNode(root, name, x, -4, 176, 120);
            const marker = this.makeNode(item, 'SelectedPaint', 0, 20, 142, 82);
            this.attachResourceTexture(marker, 'textures/home/ui/nav_selected_paint/spriteFrame');
            marker.active = index === 0;
            this.navSelectionMarkers.push(marker);

            const artwork = this.makeNode(item, 'NavArtwork', 0, artworkY, artworkSize, artworkSize);
            if (index === 0) this.drawHomeIconPaperFill(artwork);
            this.attachResourceTexture(artwork, `textures/home/ui/${assetName}/spriteFrame`);
            const artworkSprite = artwork.getChildByName('TextureSprite')?.getComponent(Sprite);
            if (artworkSprite) artworkSprite.trim = false;
            const iconOpacity = artwork.addComponent(UIOpacity);
            iconOpacity.opacity = index === 0 ? 255 : 170;
            this.navIconOpacities.push(iconOpacity);
            this.bindButton(item, () => {
                this.setSelectedNavigation(index);
                callback();
            });
        });
        return root;
    }

    private setSelectedNavigation(selectedIndex: number): void {
        this.navSelectionMarkers.forEach((marker, index) => {
            if (marker.isValid) marker.active = index === selectedIndex;
        });
        this.navIconOpacities.forEach((opacity, index) => {
            if (opacity.isValid) opacity.opacity = index === selectedIndex ? 255 : 170;
        });
    }

    private drawHomeIconPaperFill(parent: Node): void {
        // Unlike the other three source icons, nav_home contains transparent
        // space inside the drawing. Add the same paper fill used by those
        // assets so inactive navigation items share one visual weight.
        const g = this.graphics(parent, 'HomePaperFill', 0, 13, 92, 78);
        g.fillColor = C.paperRaised;
        g.moveTo(-35, 4);
        g.lineTo(0, 34);
        g.lineTo(35, 4);
        g.lineTo(29, 4);
        g.lineTo(29, -28);
        g.lineTo(-29, -28);
        g.lineTo(-29, 4);
        g.close();
        g.fill();
    }

    private showPage(page: 'home' | 'rank'): void {
        const showHome = page === 'home';
        for (const section of [this.dailyChallenge, this.brawlButton, this.eventArea, this.rankProgress]) {
            if (section?.isValid) section.active = showHome;
        }
        if (this.rankingPage?.isValid) this.rankingPage.active = !showHome;
    }

    private applyLayout = (): void => {
        if (!this.background || !this.safeArea) return;

        const frame = EDITOR
            ? { width: C.designWidth, height: C.designHeight }
            : view.getFrameSize();
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
        const backgroundTexture = this.background.getChildByName('TextureSprite');
        if (backgroundTexture) this.resizeCoverTexture(backgroundTexture, visible.width, visible.height);
        this.redrawBackground(visible.width, visible.height);

        const topInset = this.getTopInset(visible.height);
        const bottomInset = this.getBottomInset(visible.height);
        const layout = calculateHomePortraitLayout(visible.height, topInset, bottomInset);

        this.header?.setPosition(0, layout.sectionY.header, 0);
        this.dailyChallenge?.setPosition(0, layout.sectionY.daily, 0);
        this.brawlButton?.setPosition(0, layout.sectionY.brawl, 0);
        this.eventArea?.setPosition(0, layout.sectionY.events, 0);
        this.rankProgress?.setPosition(0, layout.sectionY.rank, 0);
        // Ranking has fewer top-level sections than Home. Lift the complete
        // composition to close the oversized gap below the shared header while
        // preserving the title/tab/paper proportions and bottom-nav clearance.
        this.rankingPage?.setPosition(0, 78, 0);
        this.bottomNavigation?.setPosition(0, layout.navigationY, 0);

        for (const section of [this.header, this.dailyChallenge, this.brawlButton, this.eventArea, this.rankProgress]) {
            section?.setScale(layout.contentScale, layout.contentScale, 1);
        }
        this.rankingPage?.setScale(layout.contentScale, layout.contentScale, 1);
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
        const artwork = start?.getChildByName('ButtonArtwork');
        if (artwork) {
            tween(artwork)
                .repeatForever(
                    tween()
                        .to(0.72, { scale: new Vec3(1.015, 1.03, 1) }, { easing: 'sineInOut' })
                        .to(0.72, { scale: Vec3.ONE }, { easing: 'sineInOut' }),
                )
                .start();
        }
    }

    private toggleSettings(): void {
        if (this.settingsModal?.isValid) {
            this.closeSettings();
            return;
        }
        const modalParent = this.safeArea ?? this.node;
        const visible = modalParent.getComponent(UITransform)?.contentSize ?? { width: C.designWidth, height: C.designHeight };
        const modal = this.makeNode(modalParent, 'SettingsModal', 0, 0, visible.width, visible.height);
        modal.addComponent(BlockInputEvents);
        if (this.bottomNavigation?.parent === modalParent) {
            modal.setSiblingIndex(this.bottomNavigation.getSiblingIndex());
        }
        this.settingsModal = modal;
        const shade = modal.addComponent(Graphics);
        shade.fillColor = new Color(31, 29, 25, 170);
        shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
        shade.fill();
        const panel = this.graphics(modal, 'SettingsPaper', 0, 0, 650, 820);
        this.drawIrregularPaper(panel, 650, 820, C.paperRaised, C.ink, 5);
        this.label(modal, 'SettingsTitle', '设置', 0, 330, 400, 72, 45, C.ink, 'center');
        const addToggle = (name: string, y: number, read: () => boolean, write: (value: boolean) => void): void => {
            const row = this.makeNode(modal, `Setting_${name}`, 0, y, 500, 74);
            const g = row.addComponent(Graphics);
            g.fillColor = C.paper; g.strokeColor = C.ink; g.lineWidth = 3;
            g.roundRect(-250, -37, 500, 74, 12); g.fill(); g.stroke();
            const value = this.label(row, 'Value', '', 0, 0, 450, 60, 28, C.ink, 'center');
            const refresh = (): void => { value.string = `${name}　${read() ? '开' : '关'}`; };
            refresh();
            this.bindButton(row, () => { write(!read()); refresh(); this.pulseHaptic(); });
        };
        addToggle('音乐', 220, () => AppRuntime.save.snapshot().settings.music, (value) => AppRuntime.save.updateSettings({ music: value }));
        addToggle('音效', 125, () => AppRuntime.save.snapshot().settings.sfx, (value) => { AppRuntime.save.updateSettings({ sfx: value }); AppRuntime.audio.enabled = value; });
        addToggle('震动', 30, () => AppRuntime.save.snapshot().settings.vibration, (value) => AppRuntime.save.updateSettings({ vibration: value }));
        const quality = this.makeNode(modal, 'Setting_Quality', 0, -65, 500, 74);
        const qualityG = quality.addComponent(Graphics); qualityG.fillColor = C.paper; qualityG.strokeColor = C.ink; qualityG.lineWidth = 3; qualityG.roundRect(-250, -37, 500, 74, 12); qualityG.fill(); qualityG.stroke();
        const qualityLabel = this.label(quality, 'Value', '', 0, 0, 450, 60, 28, C.ink, 'center');
        const qualities = ['auto', 'low', 'medium', 'high'] as const;
        const refreshQuality = (): void => { qualityLabel.string = `画质　${AppRuntime.save.snapshot().settings.quality.toUpperCase()}`; };
        refreshQuality();
        this.bindButton(quality, () => { const current = AppRuntime.save.snapshot().settings.quality; AppRuntime.save.updateSettings({ quality: qualities[(qualities.indexOf(current) + 1) % qualities.length] }); refreshQuality(); });
        const authorization = this.makeNode(modal, 'WechatAuthorization', 0, -160, 500, 74);
        const authorizationG = authorization.addComponent(Graphics);
        authorizationG.fillColor = C.paper; authorizationG.strokeColor = C.ink; authorizationG.lineWidth = 3;
        authorizationG.roundRect(-250, -37, 500, 74, 12); authorizationG.fill(); authorizationG.stroke();
        const authorizationLabel = this.label(authorization, 'Value', '', 0, 0, 450, 60, 27, C.ink, 'center');
        const refreshAuthorization = (message?: string): void => {
            const profile = AppRuntime.platform.authorizedUserProfile();
            authorizationLabel.string = message ?? (profile ? `微信头像　${profile.nickName || '已授权'}` : '微信头像　点击授权');
        };
        refreshAuthorization();
        const installWechatAuthorization = (): void => {
            if (EDITOR || !authorization.isValid) return;
            authorizationLabel.string = '微信头像　正在准备授权…';
            const installed = AppRuntime.platform.showUserAuthorizationButton({
                centerX: 0, centerY: -160, width: 500, height: 74,
                viewportWidth: visible.width, viewportHeight: visible.height,
            }, (result) => {
                if (!authorization.isValid) return;
                if (result.status === 'authorized') {
                    refreshAuthorization();
                    void AppRuntime.syncLeaderboard();
                } else if (result.status === 'unsupported') refreshAuthorization('微信授权接口不可用，请查看日志');
                else refreshAuthorization(result.reason ?? '微信头像　未授权，点击重试');
            });
            if (!installed) refreshAuthorization('微信授权接口不可用，请真机重试');
        };
        this.bindButton(authorization, installWechatAuthorization);
        if (!EDITOR) this.scheduleOnce(installWechatAuthorization, 0);
        this.label(modal, 'CurrentVersion', `当前版本　${CONTENT_VERSION}`, 0, -232, 500, 40, 21, C.inkSoft, 'center');
        const close = this.makeNode(modal, 'CloseSettings', 0, -300, 300, 76);
        const closeG = close.addComponent(Graphics); closeG.fillColor = C.yellow; closeG.strokeColor = C.ink; closeG.lineWidth = 4; closeG.roundRect(-150, -38, 300, 76, 14); closeG.fill(); closeG.stroke();
        this.label(close, 'Label', '完成', 0, 0, 260, 60, 30, C.ink, 'center');
        this.bindButton(close, () => this.toggleSettings());
    }

    private closeSettings(): void {
        if (!EDITOR) AppRuntime.platform.hideUserAuthorizationButton();
        if (this.settingsModal?.isValid) this.settingsModal.destroy();
        this.settingsModal = null;
    }

    private showFriendChallengeSetup(): void {
        this.closeFriendChallengeModal();
        const saved = AppRuntime.save.snapshot().lastFriendChallengeConfig;
        const draft: FriendChallengeConfig = {
            themeIds: [...saved.themeIds], enabledRules: [...saved.enabledRules], durationMs: saved.durationMs,
        };
        const { modal, panel } = this.makeChallengeModal('FriendChallengeSetup', 820, 1440);
        this.friendChallengeModal = modal;
        this.label(panel, 'Title', '好友挑战', 0, 625, 560, 76, 48, C.ink, 'center');
        this.label(panel, 'Subtitle', '先定规则，再打出你的目标分', 0, 570, 620, 48, 24, C.inkSoft, 'center');
        this.makeChallengeClose(panel, -340, 625);

        this.label(panel, 'ThemeTitle', '1  选择主题', -235, 492, 300, 50, 31, C.ink, 'left');
        const allThemes = this.makeChoiceButton(panel, 'ThemeAll', '乱斗 · 全部题库', 236, 492, 250, 64);
        const themeLabels: Record<ThemeId, string> = { math: '数学', vision: '眼力', english: '英语', hanzi: '汉字', geography: '地理', life: '生活', knowledge: '常识', history: '历史' };
        const themeButtons = new Map<ThemeId, ReturnType<HomeController['makeChoiceButton']>>();
        FRIEND_CHALLENGE_THEMES.forEach((theme, index) => {
            const x = -270 + (index % 4) * 180;
            const y = 395 - Math.floor(index / 4) * 82;
            themeButtons.set(theme, this.makeChoiceButton(panel, `Theme_${theme}`, themeLabels[theme], x, y, 156, 66));
        });

        this.label(panel, 'RuleTitle', '2  选择规则池', -235, 215, 330, 50, 31, C.ink, 'left');
        const allRules = this.makeChoiceButton(panel, 'RuleAll', '全部开启', 236, 215, 250, 64);
        const ruleLabels: Record<RuleId, string> = { standard: '标准', reverse: '反向', rotate: '旋转', multi: '多选', order: '顺序', bomb: '炸弹' };
        const ruleButtons = new Map<RuleId, ReturnType<HomeController['makeChoiceButton']>>();
        FRIEND_CHALLENGE_RULES.forEach((rule, index) => {
            const x = -240 + (index % 3) * 240;
            const y = 125 - Math.floor(index / 3) * 82;
            ruleButtons.set(rule, this.makeChoiceButton(panel, `Rule_${rule}`, ruleLabels[rule], x, y, 205, 66));
        });

        this.label(panel, 'DurationTitle', '3  选择时间', -235, -100, 300, 50, 31, C.ink, 'left');
        const durationButtons = new Map<FriendChallengeDurationMs, ReturnType<HomeController['makeChoiceButton']>>();
        FRIEND_CHALLENGE_DURATIONS.forEach((duration, index) => {
            durationButtons.set(duration, this.makeChoiceButton(panel, `Duration_${duration}`, `${duration / 1_000} 秒`, -240 + index * 240, -180, 205, 70));
        });

        const summary = this.label(panel, 'Summary', '', 0, -335, 680, 126, 24, C.ink, 'center');
        summary.lineHeight = gameFontLineHeight(34);
        const validationLabel = this.label(panel, 'Validation', '', 0, -420, 680, 48, 22, C.red, 'center');
        const start = this.makeChoiceButton(panel, 'StartChallenge', '开始挑战', 0, -535, 560, 94);
        start.setSelected(true);

        const refresh = (): void => {
            themeButtons.forEach((choice, theme) => choice.setSelected(draft.themeIds.includes(theme)));
            ruleButtons.forEach((choice, rule) => choice.setSelected(draft.enabledRules.includes(rule)));
            durationButtons.forEach((choice, duration) => choice.setSelected(draft.durationMs === duration));
            allThemes.setSelected(draft.themeIds.length === FRIEND_CHALLENGE_THEMES.length);
            allRules.setSelected(draft.enabledRules.length === FRIEND_CHALLENGE_RULES.length);
            const validation = normalizeFriendChallengeConfig(draft);
            if (validation.valid) {
                const value = friendChallengeConfigSummary(validation.config);
                const themes = value.themes === '全部题库 · 乱斗' ? '全部题库（乱斗）' : value.themes;
                summary.string = `主题：${themes}\n规则：${value.rules}\n时间：${value.duration}`;
                validationLabel.string = '双方使用相同题序与配置';
                validationLabel.color = C.green;
            } else {
                const reason = 'reason' in validation ? validation.reason : 'duration';
                summary.string = '配置尚未完成';
                validationLabel.string = reason === 'themes' ? '请至少选择一个主题'
                    : reason === 'rules' ? '请至少开启一个规则'
                    : reason === 'incompatible' ? '部分主题不支持当前规则，请调整选择' : '请选择有效时长';
                validationLabel.color = C.red;
            }
            const button = start.node.getComponent(Button);
            if (button) button.interactable = validation.valid;
            const opacity = start.node.getComponent(UIOpacity) ?? start.node.addComponent(UIOpacity);
            opacity.opacity = validation.valid ? 255 : 130;
        };

        this.bindButton(allThemes.node, () => {
            draft.themeIds = [...FRIEND_CHALLENGE_THEMES]; refresh();
        });
        themeButtons.forEach((choice, theme) => this.bindButton(choice.node, () => { toggleToken(draft.themeIds, theme); refresh(); }));
        this.bindButton(allRules.node, () => {
            draft.enabledRules = [...FRIEND_CHALLENGE_RULES]; refresh();
        });
        ruleButtons.forEach((choice, rule) => this.bindButton(choice.node, () => { toggleToken(draft.enabledRules, rule); refresh(); }));
        durationButtons.forEach((choice, duration) => this.bindButton(choice.node, () => { draft.durationMs = duration; refresh(); }));
        this.bindButton(start.node, () => {
            const validation = normalizeFriendChallengeConfig(draft);
            if (!validation.valid) return;
            if (AppRuntime.startConfiguredFriendChallenge(validation.config)) this.closeFriendChallengeModal();
        });
        refresh();
    }

    private showPendingFriendChallenge(): void {
        const entry = AppRuntime.pendingFriendChallengeEntry();
        if (!entry) return;
        this.closeFriendChallengeModal();
        const config = entry.challengeConfig;
        const { modal, panel } = this.makeChallengeModal('PendingFriendChallenge', 760, 980);
        this.friendChallengeModal = modal;
        this.makeChallengeClose(panel, -310, 385, () => AppRuntime.discardPendingFriendChallenge());
        this.label(panel, 'Title', '好友向你发起挑战', 0, 350, 620, 72, 43, C.ink, 'center');
        this.label(panel, 'TargetCaption', '目标分数', 0, 245, 300, 42, 23, C.blue, 'center');
        this.label(panel, 'TargetScore', String(entry.targetScore ?? 0), 0, 160, 500, 110, 82, C.red, 'center');
        if (config) {
            const value = friendChallengeConfigSummary(config);
            this.makeReadOnlyChallengeRow(panel, '主题', value.themes, 55);
            this.makeReadOnlyChallengeRow(panel, '规则', value.rules, -35);
            this.makeReadOnlyChallengeRow(panel, '时间', value.duration, -125);
        } else {
            this.makeReadOnlyChallengeRow(panel, '模式', '经典同题挑战', 10);
            this.makeReadOnlyChallengeRow(panel, '时间', '60 秒', -90);
        }
        this.label(panel, 'Fairness', '双方使用相同题序 · 3 条生命', 0, -235, 620, 50, 23, C.green, 'center');
        const start = this.makeChoiceButton(panel, 'AcceptChallenge', '拔刀应战', 0, -335, 540, 92);
        start.setSelected(true);
        this.bindButton(start.node, () => {
            if (AppRuntime.startPendingFriendChallenge()) this.closeFriendChallengeModal();
        });
    }

    private makeChallengeModal(name: string, panelWidth: number, panelHeight: number): { modal: Node; panel: Node } {
        const visible = this.node.getComponent(UITransform)?.contentSize ?? { width: C.designWidth, height: C.designHeight };
        const modal = this.makeNode(this.node, name, 0, 0, visible.width, visible.height);
        modal.addComponent(BlockInputEvents);
        const shade = modal.addComponent(Graphics);
        shade.fillColor = new Color(31, 29, 25, 205);
        shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
        shade.fill();
        const panel = this.makeNode(modal, 'ChallengePaper', 0, 0, panelWidth, panelHeight);
        const panelGraphic = panel.addComponent(Graphics);
        this.drawIrregularPaper(panelGraphic, panelWidth, panelHeight, C.paperRaised, C.ink, 5);
        const fit = Math.min(1, (visible.width - 32) / panelWidth, (visible.height - this.getTopInset(visible.height) - this.getBottomInset(visible.height) - 24) / panelHeight);
        panel.setScale(fit, fit, 1);
        return { modal, panel };
    }

    private makeChallengeClose(parent: Node, x: number, y: number, beforeClose?: () => void): void {
        const close = this.makeChoiceButton(parent, 'CloseChallenge', '关闭', x, y, 120, 68);
        this.bindButton(close.node, () => {
            beforeClose?.();
            this.closeFriendChallengeModal();
        });
    }

    private closeFriendChallengeModal(): void {
        if (this.friendChallengeModal?.isValid) this.friendChallengeModal.destroy();
        this.friendChallengeModal = null;
    }

    private showFeatureUnavailable(): void {
        this.closeFeatureNotice();
        const { modal, panel } = this.makeChallengeModal('FeatureUnavailable', 560, 400);
        this.featureNoticeModal = modal;
        this.label(panel, 'Title', '主题', 0, 92, 420, 70, 42, C.ink, 'center');
        this.label(panel, 'Message', '功能暂未开放', 0, 18, 440, 56, 28, C.inkSoft, 'center');
        const close = this.makeChoiceButton(panel, 'CloseFeatureNotice', '我知道了', 0, -100, 260, 72);
        close.setSelected(true);
        this.bindButton(close.node, () => this.closeFeatureNotice());
    }

    private showChallengeLaunchNotice(message: string): void {
        this.closeFeatureNotice();
        const { modal, panel } = this.makeChallengeModal('ChallengeLaunchNotice', 620, 430);
        this.featureNoticeModal = modal;
        this.label(panel, 'Title', '好友挑战', 0, 105, 480, 70, 42, C.ink, 'center');
        this.label(panel, 'Message', message, 0, 18, 520, 90, 27, C.inkSoft, 'center');
        const close = this.makeChoiceButton(panel, 'CloseChallengeNotice', '我知道了', 0, -112, 260, 72);
        close.setSelected(true);
        this.bindButton(close.node, () => this.closeFeatureNotice());
    }

    private closeFeatureNotice(): void {
        if (this.featureNoticeModal?.isValid) this.featureNoticeModal.destroy();
        this.featureNoticeModal = null;
    }

    private showHelpModal(): void {
        this.closeHelpModal();
        const { modal, panel } = this.makeChallengeModal('GameplayHelp', 820, 1500);
        this.helpModal = modal;
        this.label(panel, 'Title', '玩法说明', 0, 665, 560, 76, 48, C.ink, 'center');
        this.label(panel, 'Subtitle', '看准规则，一刀入魂', 0, 608, 620, 44, 24, C.inkSoft, 'center');
        const close = this.makeChoiceButton(panel, 'CloseHelpTop', '关闭', -330, 665, 120, 68);
        this.bindButton(close.node, () => this.closeHelpModal());

        this.makeHelpSection(panel, 'TowerHelp', '试炼塔',
            '共50层，每层60秒、5条生命。完成本层的答题、连击或专项目标，并遵守限制即可通关。逐层解锁多选、顺序、反向、旋转和双规则。',
            482, 190, C.red);
        this.makeHelpSection(panel, 'BrawlHelp', '无尽乱斗',
            '没有倒计时，用3条生命挑战生存与高分。失误会掉生命并中断连击；连续答对3题时，若生命未满则回复1条。',
            266, 190, C.yellow);
        this.makeHelpSection(panel, 'FriendHelp', '好友对战',
            '自选主题、规则和60/90/120秒时长。双方使用相同题序与配置，各3条生命；分享自己的目标分，好友达到更高分即挑战成功。',
            50, 190, C.blue);
        this.makeHelpSection(panel, 'DailyHelp', '每日主题',
            '每天轮换一个固定主题与题序，进行60秒挑战。在3条生命内冲击当日目标分，可重复挑战刷新当日最佳成绩。',
            -166, 190, C.green);
        this.makeHelpSection(panel, 'MasterHelp', 'MASTER HIT / MASTER SLASH',
            'MASTER HIT：目标入场稳定后，在650ms内正确出刀，额外+50分。\nMASTER SLASH：多目标题中，一笔不断地斩完全部正确目标，额外+100分。若同时满足快速出刀，两项奖励可叠加。',
            -425, 272, C.yellow);

        const done = this.makeChoiceButton(panel, 'CloseHelp', '我知道了', 0, -657, 300, 76);
        done.setSelected(true);
        this.bindButton(done.node, () => this.closeHelpModal());
    }

    private makeHelpSection(
        parent: Node,
        name: string,
        title: string,
        body: string,
        y: number,
        height: number,
        accent: Color,
    ): void {
        const section = this.makeNode(parent, name, 0, y, 700, height);
        const paper = section.addComponent(Graphics);
        paper.fillColor = C.paper;
        paper.strokeColor = new Color(C.inkSoft.r, C.inkSoft.g, C.inkSoft.b, 120);
        paper.lineWidth = 2;
        paper.roundRect(-350, -height / 2, 700, height, 16);
        paper.fill();
        paper.stroke();
        const marker = this.graphics(section, 'Accent', -320, height / 2 - 34, 18, 46);
        marker.fillColor = accent;
        marker.roundRect(-7, -20, 14, 40, 7);
        marker.fill();
        // label() positions by node center; keep the text box inside the card,
        // then use left alignment for the heading itself.
        this.label(section, 'Heading', title, 20, height / 2 - 34, 590, 48, 30, C.ink, 'left');
        const description = this.label(section, 'Description', body, 0, -18, 630, height - 76, 23, C.inkSoft, 'left');
        description.enableWrapText = true;
        description.overflow = Label.Overflow.SHRINK;
        description.lineHeight = gameFontLineHeight(31);
    }

    private closeHelpModal(): void {
        if (this.helpModal?.isValid) this.helpModal.destroy();
        this.helpModal = null;
    }

    private makeChoiceButton(parent: Node, name: string, value: string, x: number, y: number, width: number, height: number): {
        node: Node; graphic: Graphics; label: Label; setSelected: (selected: boolean) => void;
    } {
        const choice = this.makeNode(parent, name, x, y, width, height);
        const graphic = choice.addComponent(Graphics);
        const label = this.label(choice, 'Label', value, 0, 0, width - 20, height - 8, Math.min(28, height * 0.4), C.ink, 'center');
        const setSelected = (selected: boolean): void => {
            graphic.clear(); graphic.fillColor = selected ? C.yellow : C.paper; graphic.strokeColor = C.ink; graphic.lineWidth = selected ? 4 : 2.5;
            graphic.roundRect(-width / 2, -height / 2, width, height, 14); graphic.fill(); graphic.stroke();
        };
        setSelected(false);
        return { node: choice, graphic, label, setSelected };
    }

    private makeReadOnlyChallengeRow(parent: Node, caption: string, value: string, y: number): void {
        const row = this.makeNode(parent, `Challenge_${caption}`, 0, y, 620, 70);
        const g = row.addComponent(Graphics); g.fillColor = C.paper; g.strokeColor = C.inkSoft; g.lineWidth = 2;
        g.roundRect(-310, -35, 620, 70, 12); g.fill(); g.stroke();
        this.label(row, 'Caption', caption, -245, 0, 90, 52, 23, C.blue, 'left');
        this.label(row, 'Value', value, 45, 0, 470, 52, 24, C.ink, 'center');
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

    private attachPaperTexture(parent: Node, assetName: string, tiled = false): void {
        this.attachResourceTexture(parent, `textures/home/paper/${assetName}/spriteFrame`, tiled);
    }

    private attachResourceTexture(parent: Node, resourcePath: string, tiled = false, cover = false): void {
        const parentTransform = parent.getComponent(UITransform);
        if (!parentTransform) return;

        const visual = this.makeNode(
            parent,
            'TextureSprite',
            0,
            0,
            parentTransform.contentSize.width,
            parentTransform.contentSize.height,
        );
        const sprite = visual.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = tiled ? Sprite.Type.TILED : Sprite.Type.SIMPLE;

        const imagePath = resourcePath.endsWith('/spriteFrame')
            ? resourcePath.slice(0, -'/spriteFrame'.length)
            : resourcePath;
        resources.load(imagePath, ImageAsset, (error, image) => {
            if (error || !image || !visual.isValid) {
                console.warn(`[Home] Paper texture failed to load: ${resourcePath}`, error);
                if (visual.isValid) visual.destroy();
                return;
            }
            // Cocos 3.8.8 can resolve a SpriteFrame sub-asset from a WeChat
            // subpackage without producing a usable texture. Loading the source
            // ImageAsset and constructing the frame here bypasses that mapping.
            const frame = SpriteFrame.createWithImage(image);
            frame.packable = false;
            sprite.spriteFrame = frame;
            if (cover) this.resizeCoverTexture(visual, parentTransform.contentSize.width, parentTransform.contentSize.height);
            const fallback = parent.getComponent(Graphics);
            if (fallback) fallback.enabled = false;
        });
    }

    private resizeCoverTexture(visual: Node, width: number, height: number): void {
        const transform = visual.getComponent(UITransform);
        const frame = visual.getComponent(Sprite)?.spriteFrame;
        if (!transform || !frame) { transform?.setContentSize(width, height); return; }
        const source = frame.originalSize;
        const scale = Math.max(width / Math.max(1, source.width), height / Math.max(1, source.height));
        transform.setContentSize(source.width * scale, source.height * scale);
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
        return applyGameFont(label);
    }

    private bindButton(node: Node, callback: () => void): void {
        const button = node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        node.on(Button.EventType.CLICK, () => {
            callback();
            if (!EDITOR) AppRuntime.audio.play('ui');
        }, this);
        let restingScale = node.scale.clone();
        let pressed = false;
        node.on(Node.EventType.TOUCH_START, () => {
            if (!pressed) restingScale = node.scale.clone();
            pressed = true;
            Tween.stopAllByTarget(node);
            tween(node).to(0.08, {
                scale: new Vec3(restingScale.x * 0.97, restingScale.y * 0.97, restingScale.z),
            }, { easing: 'quadOut' }).start();
        }, this);
        const release = (): void => {
            Tween.stopAllByTarget(node);
            tween(node).to(0.1, { scale: restingScale }, { easing: 'backOut' }).start();
            pressed = false;
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
        assetName = 'tape_beige',
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
        this.attachPaperTexture(tape, assetName);
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

    private buildAvatarMask(parent: Node): void {
        const maskNode = this.makeNode(parent, 'WechatAvatarMask', 0, -3, 92, 92);
        const mask = maskNode.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_ELLIPSE;
        mask.segments = 48;
        const artwork = this.makeNode(maskNode, 'Artwork', 0, 0, 92, 92);
        const sprite = artwork.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = Sprite.Type.SIMPLE;
        maskNode.active = false;
        this.avatarMask = maskNode;
    }

    private updateHeaderAvatar(): void {
        const maskNode = this.avatarMask;
        if (!maskNode?.isValid) return;
        const avatarUrl = AppRuntime.platform.authorizedUserProfile()?.avatarUrl.trim() ?? '';
        this.avatarRequestUrl = avatarUrl || null;
        const sprite = maskNode.getChildByName('Artwork')?.getComponent(Sprite);
        if (!sprite) return;
        if (!avatarUrl) {
            sprite.spriteFrame = null;
            maskNode.active = false;
            return;
        }

        sprite.spriteFrame = null;
        maskNode.active = false;
        loadAvatarFrame(avatarUrl, (error, frame) => {
            if (error || !frame || !maskNode.isValid || this.avatarRequestUrl !== avatarUrl) {
                if (error) console.warn('[Home] Authorized avatar failed to load', error);
                return;
            }
            if (sprite.node.isValid) {
                sprite.spriteFrame = frame;
                maskNode.active = true;
            }
        });
    }

    private drawTowerIcon(parent: Node): void {
        const g = this.graphics(parent, 'TowerSteps', 0, 0, 130, 150);
        g.fillColor = C.paperRaised;
        g.strokeColor = C.ink;
        g.lineWidth = 4;
        const steps: Point[] = [[-50, -62], [50, -62], [50, -34], [26, -34], [26, -6], [2, -6], [2, 22], [-22, 22], [-22, 50], [-50, 50]];
        this.polygon(g, steps, C.paperRaised, C.ink, 4);
        g.strokeColor = C.red;
        g.lineWidth = 5;
        g.moveTo(-38, -48);
        g.lineTo(37, 38);
        g.stroke();
        const flag = this.graphics(parent, 'TopFlag', 0, 0, 90, 70);
        flag.strokeColor = C.ink;
        flag.lineWidth = 4;
        flag.moveTo(-20, 58);
        flag.lineTo(-20, 12);
        flag.stroke();
        flag.fillColor = C.red;
        flag.moveTo(-18, 55);
        flag.lineTo(28, 44);
        flag.lineTo(-18, 30);
        flag.close();
        flag.fill();
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
            if (info && capsule && Number.isFinite(info.screenHeight) && info.screenHeight > 0
                && Number.isFinite(capsule.bottom)) {
                return capsule.bottom * visibleHeight / info.screenHeight + 10;
            }
            if (info?.safeArea && Number.isFinite(info.screenHeight) && info.screenHeight > 0
                && Number.isFinite(info.safeArea.top)) {
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
            if (info?.safeArea && Number.isFinite(info.screenHeight) && info.screenHeight > 0
                && Number.isFinite(info.safeArea.bottom)) {
                const inset = info.screenHeight - info.safeArea.bottom;
                return Math.max(28, inset * visibleHeight / info.screenHeight + 20);
            }
        } catch {
            // Creator preview and App builds use the conservative fallback.
        }
        return 42;
    }

    private pulseHaptic(): void {
        if (!AppRuntime.save.snapshot().settings.vibration) return;
        AppRuntime.platform.vibrate(true, 'light');
    }
}

function toggleToken<T>(values: T[], value: T): void {
    const index = values.indexOf(value);
    if (index >= 0) values.splice(index, 1);
    else values.push(value);
}
