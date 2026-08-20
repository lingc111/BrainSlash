import { sys } from 'cc';
import type { GameResult, PlayerProgress, RuleId, RunResult } from '../domain/Models';
import { finalizeResult } from '../domain/ResultSummary';

export interface SaveDataV1 {
    schemaVersion: 1;
    player: PlayerProgress;
    settings: { music: boolean; sfx: boolean; vibration: boolean; quality: 'auto' | 'low' | 'medium' | 'high' };
    tutorials: Partial<Record<RuleId, boolean>>;
}

const KEY = 'brain-slash.save.v1';
const DEFAULT_SAVE: SaveDataV1 = {
    schemaVersion: 1, player: { level: 1, xp: 0, bestScore: 0 },
    settings: { music: true, sfx: true, vibration: true, quality: 'auto' }, tutorials: {},
};

export class SaveService {
    private data: SaveDataV1 = clone(DEFAULT_SAVE);

    public load(): SaveDataV1 {
        try {
            const parsed = JSON.parse(sys.localStorage.getItem(KEY) ?? 'null') as Partial<SaveDataV1> | null;
            if (!parsed || parsed.schemaVersion !== 1) throw new Error('Unsupported or missing save.');
            this.data = {
                ...clone(DEFAULT_SAVE), ...parsed,
                player: { ...DEFAULT_SAVE.player, ...parsed.player },
                settings: { ...DEFAULT_SAVE.settings, ...parsed.settings }, tutorials: { ...parsed.tutorials },
            };
        } catch { this.data = clone(DEFAULT_SAVE); }
        return this.snapshot();
    }

    public snapshot(): SaveDataV1 { return clone(this.data); }
    public commitResult(run: RunResult): GameResult {
        const committed = finalizeResult(run, this.data.player);
        this.data.player = committed.player;
        this.persist();
        return committed.result;
    }
    public markTutorial(rule: RuleId): void { this.data.tutorials[rule] = true; this.persist(); }
    public updateSettings(patch: Partial<SaveDataV1['settings']>): void { this.data.settings = { ...this.data.settings, ...patch }; this.persist(); }
    private persist(): void { try { sys.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* Storage can be unavailable in preview. */ } }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
