import { director } from 'cc';
import { CONTENT_VERSION } from '../configs/GameConfig';
import { canStartFriendChallenge, createFriendChallengePayload, type FriendChallengeParseResult } from '../domain/FriendChallenge';
import type { GameEntryParams, GameResult, GameMode, RunResult } from '../domain/Models';
import type { TowerFloorResult } from '../domain/TowerMode';
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
    private gameplayLaunchAuthorized = false;

    public initialize(): void {
        const data = this.save.load();
        this.audio.enabled = data.settings.sfx;
        this.applyLaunchChallenge(this.platform.readChallenge(CONTENT_VERSION));
        if (!this.challengeListenerRegistered) {
            this.challengeListenerRegistered = true;
            this.platform.onChallengeOpened(CONTENT_VERSION, (challenge) => {
                if (!this.applyLaunchChallenge(challenge) || this.transitioning) return;
                this.consumePendingFriendChallenge();
                this.start('friendChallenge');
            });
        }
    }
    private applyLaunchChallenge(challenge: FriendChallengeParseResult): boolean {
        if (challenge.status === 'valid') {
            const key = JSON.stringify([challenge.entry.seed, challenge.entry.targetScore ?? 0, challenge.entry.contentVersion, challenge.entry.recipeId ?? 'mixed']);
            if (key !== this.lastLaunchChallengeKey) {
                this.entry = challenge.entry;
                this.pendingFriendChallenge = true;
                this.lastLaunchChallengeKey = key;
                this.launchNotice = null;
                return true;
            }
            this.launchNotice = null;
        } else if (challenge.status === 'expired') {
            this.launchNotice = '好友挑战版本已过期，请发起新挑战';
        } else if (challenge.status === 'invalid') {
            this.launchNotice = '好友挑战链接无效，已返回普通模式';
        }
        return false;
    }
    public hasPendingFriendChallenge(): boolean { return this.pendingFriendChallenge; }
    public consumePendingFriendChallenge(): boolean {
        if (!this.pendingFriendChallenge) return false;
        this.pendingFriendChallenge = false;
        return true;
    }
    public challengeLaunchNotice(): string | null { return this.launchNotice; }
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
        director.loadScene('Gameplay', () => { this.transitioning = false; });
    }
    public replay(): void {
        if (this.transitioning) return;
        // Free-play, tower and daily theme battles all refresh their attempt seed.
        // Daily still keeps the local-day recipe and target score unchanged.
        if (this.entry.mode === 'brawl60' || this.entry.mode === 'daily' || this.entry.mode === 'tower') {
            this.entry = this.seedFactory.create(this.entry.mode, CONTENT_VERSION, this.entry.towerFloor);
            if (this.entry.mode === 'daily') this.save.beginDaily(this.entry);
        }
        this.result = null; this.towerResult = null;
        this.transitioning = true; this.gameplayLaunchAuthorized = true;
        this.analytics.track('game_start', { mode: this.entry.mode, seed: this.entry.seed });
        director.loadScene('Gameplay', () => { this.transitioning = false; });
    }
    public home(): void { if (!this.transitioning) { this.transitioning = true; director.loadScene('Home', () => { this.transitioning = false; }); } }
    public finish(run: RunResult): GameResult {
        this.result = this.save.commitResult(run);
        this.analytics.track('game_finish', { score: run.score, mode: run.entry.mode });
        return this.result;
    }
    public finishTower(run: RunResult, life: number): TowerFloorResult {
        this.towerResult = this.save.commitTowerResult(run, life);
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
            ? Math.min(30, this.towerResult.floor + 1)
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
        director.loadScene('Gameplay', () => { this.transitioning = false; });
    }
    public share(): void {
        if (!this.result) return;
        const payload = createFriendChallengePayload(this.result);
        this.platform.share(payload); this.analytics.track('share', { score: payload.targetScore });
    }
}

export const AppRuntime = new AppRuntimeState();
