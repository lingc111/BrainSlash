import { director } from 'cc';
import { CONTENT_VERSION } from '../configs/GameConfig';
import type { FriendChallengePayload, GameEntryParams, GameResult, GameMode, RunResult } from '../domain/Models';
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
    private transitioning = false;

    public initialize(): void {
        const data = this.save.load();
        this.audio.enabled = data.settings.sfx;
        this.entry = this.platform.readChallenge(CONTENT_VERSION) ?? this.entry;
    }
    public start(mode: GameMode): void {
        if (this.transitioning) return;
        if (mode !== 'friendChallenge' || this.entry.mode !== 'friendChallenge') {
            this.entry = this.seedFactory.create(mode, CONTENT_VERSION);
        }
        this.result = null; this.transitioning = true; this.analytics.track('game_start', { mode, seed: this.entry.seed });
        director.loadScene('Gameplay', () => { this.transitioning = false; });
    }
    public replay(): void {
        if (this.transitioning) return;
        // Free-play should feel fresh on every run. Daily and friend challenges
        // deliberately retain their shared seed so scores remain comparable.
        if (this.entry.mode === 'brawl60') this.entry = this.seedFactory.create('brawl60', CONTENT_VERSION);
        this.result = null;
        this.transitioning = true;
        this.analytics.track('game_start', { mode: this.entry.mode, seed: this.entry.seed });
        director.loadScene('Gameplay', () => { this.transitioning = false; });
    }
    public home(): void { if (!this.transitioning) { this.transitioning = true; director.loadScene('Home', () => { this.transitioning = false; }); } }
    public finish(run: RunResult): GameResult {
        this.result = this.save.commitResult(run);
        this.analytics.track('game_finish', { score: run.score, mode: run.entry.mode });
        return this.result;
    }
    public share(): void {
        if (!this.result) return;
        const payload: FriendChallengePayload = { v: 1, seed: this.result.entry.seed, contentVersion: this.result.entry.contentVersion, mode: 'brawl60', recipeId: this.result.entry.recipeId ?? 'mixed', targetScore: this.result.score };
        this.platform.share(payload); this.analytics.track('share', { score: payload.targetScore });
    }
}

export const AppRuntime = new AppRuntimeState();
