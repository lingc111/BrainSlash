import { director } from 'cc';
import { CONTENT_VERSION } from '../configs/GameConfig';
import { canStartFriendChallenge, createFriendChallengePayload, normalizeFriendChallengeConfig, type FriendChallengeParseResult } from '../domain/FriendChallenge';
import type { FriendChallengeConfig, GameEntryParams, GameResult, GameMode, RunResult } from '../domain/Models';
import type { TowerChallengeSnapshot } from '../domain/TowerChallenge';
import { TOWER_LAST_FLOOR, type TowerFloorResult } from '../domain/TowerMode';
import { AnalyticsService } from '../infrastructure/AnalyticsService';
import { AudioService } from '../infrastructure/AudioService';
import { PlatformService } from '../infrastructure/PlatformService';
import { SaveService } from '../infrastructure/SaveService';
import { RunSeedFactory } from './RunSeedFactory';

class AppRuntimeState {
    public readonly save = new SaveService();
    public readonly platform = new PlatformService();
    public readonly audio = new AudioService();
    public readonly analytics = new AnalyticsService();
    private readonly seedFactory = new RunSeedFactory();
    public entry: GameEntryParams = this.seedFactory.create('brawl60', CONTENT_VERSION);
    public result: GameResult | null = null;
    public towerResult: TowerFloorResult | null = null;
    private transitioning = false;
    private pendingFriendChallenge = false;
    private lastLaunchChallengeKey: string | null = null;
    private launchNotice: string | null = null;
    private challengeListenerRegistered = false;
    private launchOptionsRead = false;
    private readonly pendingChallengeListeners = new Set<() => void>();
    private friendChallengeSetupRequested = false;
    private gameplayLaunchAuthorized = false;

    public initialize(): void {
        const data = this.save.load();
        this.audio.enabled = data.settings.sfx;
        void this.syncLeaderboard();
        if (!this.launchOptionsRead) {
            this.launchOptionsRead = true;
            this.applyLaunchChallenge(this.platform.readChallenge(CONTENT_VERSION));
        }
        if (!this.challengeListenerRegistered) {
            this.challengeListenerRegistered = true;
            this.platform.onChallengeOpened(CONTENT_VERSION, (challenge) => {
                if (!this.applyLaunchChallenge(challenge) || this.transitioning) return;
                this.pendingChallengeListeners.forEach((listener) => listener());
                if (director.getScene()?.name !== 'Home') this.home();
            });
        }
    }
    private applyLaunchChallenge(challenge: FriendChallengeParseResult): boolean {
        if (challenge.status === 'valid') {
            const key = JSON.stringify([
                challenge.entry.seed, challenge.entry.targetScore ?? 0, challenge.entry.contentVersion,
                challenge.entry.recipeId ?? 'mixed', challenge.entry.challengeConfig ?? null,
            ]);
            if (key !== this.lastLaunchChallengeKey || !this.pendingFriendChallenge) {
                this.entry = challenge.entry;
                this.pendingFriendChallenge = true;
                this.lastLaunchChallengeKey = key;
                this.launchNotice = null;
                return true;
            }
            this.launchNotice = null;
        } else if (challenge.status === 'expired') {
            this.pendingFriendChallenge = false;
            this.launchNotice = '好友挑战版本已过期，请发起新挑战';
            return true;
        } else if (challenge.status === 'invalid') {
            this.pendingFriendChallenge = false;
            this.launchNotice = '好友挑战链接无效，已返回普通模式';
            return true;
        }
        return false;
    }
    public hasPendingFriendChallenge(): boolean { return this.pendingFriendChallenge; }
    public pendingFriendChallengeEntry(): GameEntryParams | null {
        return this.pendingFriendChallenge ? clone(this.entry) : null;
    }
    public onPendingFriendChallenge(listener: () => void): () => void {
        this.pendingChallengeListeners.add(listener);
        return () => this.pendingChallengeListeners.delete(listener);
    }
    public consumePendingFriendChallenge(): boolean {
        if (!this.pendingFriendChallenge) return false;
        this.pendingFriendChallenge = false;
        return true;
    }
    public discardPendingFriendChallenge(): boolean {
        if (!this.pendingFriendChallenge) return false;
        this.pendingFriendChallenge = false;
        this.entry = this.seedFactory.create('brawl60', CONTENT_VERSION);
        return true;
    }
    public challengeLaunchNotice(): string | null { return this.launchNotice; }
    public consumeChallengeLaunchNotice(): string | null {
        const notice = this.launchNotice;
        this.launchNotice = null;
        return notice;
    }
    public consumeFriendChallengeSetupRequest(): boolean {
        const requested = this.friendChallengeSetupRequested;
        this.friendChallengeSetupRequested = false;
        return requested;
    }
    public startConfiguredFriendChallenge(config: FriendChallengeConfig): boolean {
        if (this.transitioning) return false;
        const normalized = normalizeFriendChallengeConfig(config);
        if (!normalized.valid || !this.save.updateLastFriendChallengeConfig(normalized.config)) return false;
        this.pendingFriendChallenge = false;
        this.entry = this.seedFactory.createFriendChallenge(normalized.config, CONTENT_VERSION);
        this.start('friendChallenge');
        return true;
    }
    public startPendingFriendChallenge(): boolean {
        if (!this.pendingFriendChallenge || !canStartFriendChallenge(this.entry)) return false;
        this.consumePendingFriendChallenge();
        this.start('friendChallenge');
        return true;
    }
    public consumeGameplayLaunch(): boolean {
        if (!this.gameplayLaunchAuthorized) return false;
        this.gameplayLaunchAuthorized = false;
        return true;
    }
    public start(mode: GameMode): void {
        if (this.transitioning) return;
        if (mode === 'friendChallenge') {
            if (!canStartFriendChallenge(this.entry)) return;
            this.pendingFriendChallenge = false;
        } else {
            this.pendingFriendChallenge = false;
            const towerFloor = mode === 'tower' ? this.save.snapshot().tower.currentFloor : undefined;
            this.entry = this.seedFactory.create(mode, CONTENT_VERSION, towerFloor);
            if (mode === 'daily') this.save.beginDaily(this.entry);
        }
        this.result = null; this.towerResult = null; this.transitioning = true; this.gameplayLaunchAuthorized = true; this.analytics.track('game_start', { mode, seed: this.entry.seed, floor: this.entry.towerFloor });
        this.loadGameplayScene();
    }
    public replay(): void {
        if (this.transitioning) return;
        // Friend challenges must replay the shared seed so creator and responder
        // always see the same question sequence. Other modes get a fresh attempt.
        this.entry = this.seedFactory.createReplay(this.entry, CONTENT_VERSION);
        if (this.entry.mode === 'daily') this.save.beginDaily(this.entry);
        this.result = null; this.towerResult = null;
        this.transitioning = true; this.gameplayLaunchAuthorized = true;
        this.analytics.track('game_start', { mode: this.entry.mode, seed: this.entry.seed });
        this.loadGameplayScene();
    }
    public home(): void { if (!this.transitioning) { this.transitioning = true; director.loadScene('Home', () => { this.transitioning = false; }); } }
    public finish(run: RunResult): GameResult {
        this.result = this.save.commitResult(run);
        if (run.entry.mode === 'brawl60') void this.syncLeaderboard();
        this.analytics.track('game_finish', { score: this.result.score, mode: run.entry.mode });
        return this.result;
    }
    public finishTower(run: RunResult, life: number, challenge?: TowerChallengeSnapshot): TowerFloorResult {
        this.towerResult = this.save.commitTowerResult(run, life, challenge);
        void this.syncLeaderboard();
        this.analytics.track('tower_floor_finish', {
            floor: this.towerResult.floor,
            cleared: this.towerResult.cleared,
            score: run.score,
            seed: run.entry.seed,
        });
        return this.towerResult;
    }
    public nextTowerFloor(): void {
        const floor = this.towerResult?.cleared
            ? Math.min(TOWER_LAST_FLOOR, this.towerResult.floor + 1)
            : this.save.snapshot().tower.currentFloor;
        this.launchTowerFloor(floor);
    }
    public retryTowerFloor(): void {
        this.launchTowerFloor(this.entry.towerFloor ?? this.save.snapshot().tower.currentFloor);
    }
    private launchTowerFloor(floor: number): void {
        if (this.transitioning) return;
        this.pendingFriendChallenge = false;
        this.entry = this.seedFactory.create('tower', CONTENT_VERSION, floor);
        this.result = null; this.towerResult = null; this.transitioning = true; this.gameplayLaunchAuthorized = true;
        this.analytics.track('game_start', { mode: 'tower', seed: this.entry.seed, floor });
        this.loadGameplayScene();
    }
    private loadGameplayScene(): void {
        director.loadScene('Gameplay', () => { this.transitioning = false; });
    }
    public share(): void {
        if (!this.result) return;
        if (this.result.entry.mode !== 'friendChallenge') {
            this.friendChallengeSetupRequested = true;
            this.home();
            return;
        }
        const payload = createFriendChallengePayload(this.result);
        this.platform.share(payload); this.analytics.track('share', { score: payload.targetScore });
    }

    public syncLeaderboard(): Promise<boolean> {
        const save = this.save.snapshot();
        const answeredCount = save.leaderboard.trialAnsweredCount;
        return this.platform.uploadLeaderboard({
            brawl: save.leaderboard.brawlBest,
            trial: {
                highestFloor: save.tower.highestClearedFloor,
                answeredCount,
                accuracy: answeredCount > 0 ? save.leaderboard.trialCorrectCount / answeredCount : 0,
            },
        });
    }
}

export const AppRuntime = new AppRuntimeState();

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
