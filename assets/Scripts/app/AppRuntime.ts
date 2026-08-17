import { director } from 'cc';
import { CONTENT_VERSION } from '../configs/GameConfig';
import type { FriendChallengePayload, GameEntryParams, GameResult, GameMode } from '../domain/Models';
import { AnalyticsService } from '../infrastructure/AnalyticsService';
import { AudioService } from '../infrastructure/AudioService';
import { PlatformService } from '../infrastructure/PlatformService';
import { SaveService } from '../infrastructure/SaveService';

function randomSeed(prefix: string): string { return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 0x7fffffff).toString(36)}`; }
function dailyKey(now = new Date()): string { return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`; }

class AppRuntimeState {
    public readonly save = new SaveService();
    public readonly platform = new PlatformService();
    public readonly audio = new AudioService();
    public readonly analytics = new AnalyticsService();
    public entry: GameEntryParams = { mode: 'brawl60', seed: 'preview-seed', contentVersion: CONTENT_VERSION };
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
            const seed = mode === 'daily' ? `daily:${CONTENT_VERSION}:${dailyKey()}:daily-default` : randomSeed(mode);
            this.entry = { mode, seed, contentVersion: CONTENT_VERSION, recipeId: mode === 'daily' ? 'daily-default' : 'mixed' };
        }
        this.result = null; this.transitioning = true; this.analytics.track('game_start', { mode, seed: this.entry.seed });
        director.loadScene('Gameplay', () => { this.transitioning = false; });
    }
    public replay(): void { if (!this.transitioning) { this.transitioning = true; director.loadScene('Gameplay', () => { this.transitioning = false; }); } }
    public home(): void { if (!this.transitioning) { this.transitioning = true; director.loadScene('Home', () => { this.transitioning = false; }); } }
    public finish(result: GameResult): void {
        const isNewRecord = this.save.commitResult(result);
        this.result = { ...result, isNewRecord };
        this.analytics.track('game_finish', { score: result.score, mode: result.entry.mode });
    }
    public share(): void {
        if (!this.result) return;
        const payload: FriendChallengePayload = { v: 1, seed: this.result.entry.seed, contentVersion: this.result.entry.contentVersion, mode: 'brawl60', recipeId: this.result.entry.recipeId ?? 'mixed', targetScore: this.result.score };
        this.platform.share(payload); this.analytics.track('share', { score: payload.targetScore });
    }
}

export const AppRuntime = new AppRuntimeState();
