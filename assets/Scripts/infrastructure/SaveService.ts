import { sys } from 'cc';
import { beginDailyRun, dailyRecipeById, recordDailyRun, type LocalDailyRecord } from '../domain/DailyChallenge';
import type { GameEntryParams, GameResult, PlayerProgress, RuleId, RunResult } from '../domain/Models';
import { finalizeResult } from '../domain/ResultSummary';

export interface SaveDataV1 {
    schemaVersion: 1;
    player: PlayerProgress;
    settings: { music: boolean; sfx: boolean; vibration: boolean; quality: 'auto' | 'low' | 'medium' | 'high' };
    tutorials: Partial<Record<RuleId, boolean>>;
    daily?: LocalDailyRecord;
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
                daily: validDailyRecord(parsed.daily) ? { ...parsed.daily, tutorialBaseline: parsed.daily.tutorialBaseline ?? [] } : undefined,
            };
        } catch { this.data = clone(DEFAULT_SAVE); }
        return this.snapshot();
    }

    public snapshot(): SaveDataV1 { return clone(this.data); }
    public commitResult(run: RunResult): GameResult {
        const committed = finalizeResult(run, this.data.player);
        this.data.player = committed.player;
        const daily = recordDailyRun(this.data.daily, run);
        if (daily) this.data.daily = daily.record;
        this.persist();
        return daily ? { ...committed.result, daily: daily.result } : committed.result;
    }
    public markTutorial(rule: RuleId): void { this.data.tutorials[rule] = true; this.persist(); }
    public beginDaily(entry: GameEntryParams): void {
        const record = beginDailyRun(this.data.daily, entry, this.data.tutorials);
        if (!record || record === this.data.daily) return;
        this.data.daily = record; this.persist();
    }
    public updateSettings(patch: Partial<SaveDataV1['settings']>): void { this.data.settings = { ...this.data.settings, ...patch }; this.persist(); }
    private persist(): void { try { sys.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* Storage can be unavailable in preview. */ } }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function validDailyRecord(value: unknown): value is LocalDailyRecord {
    const record = value as Partial<LocalDailyRecord> | null | undefined;
    return !!record
        && /^\d{4}-\d{2}-\d{2}$/.test(record.dateKey ?? '')
        && typeof record.recipeId === 'string' && !!dailyRecipeById(record.recipeId)
        && typeof record.attempts === 'number' && Number.isInteger(record.attempts) && record.attempts >= 0
        && typeof record.bestScore === 'number' && Number.isFinite(record.bestScore) && record.bestScore >= 0
        && typeof record.lastScore === 'number' && Number.isFinite(record.lastScore) && record.lastScore >= 0
        && typeof record.completed === 'boolean'
        && (record.tutorialBaseline === undefined || (Array.isArray(record.tutorialBaseline) && record.tutorialBaseline.every((rule) => ['reverse', 'multi', 'order', 'stroop', 'bomb'].includes(rule))));
}
