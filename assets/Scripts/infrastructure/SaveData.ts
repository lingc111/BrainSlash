import { dailyRecipeById, type LocalDailyRecord } from '../domain/DailyChallenge';
import type { PlayerProgress, RuleId } from '../domain/Models';
import { DEFAULT_TOWER_PROGRESS, normalizeTowerProgress, type TowerProgress } from '../domain/TowerMode';

export interface SaveSettings {
    music: boolean;
    sfx: boolean;
    vibration: boolean;
    quality: 'auto' | 'low' | 'medium' | 'high';
}

export interface SaveDataV1 {
    schemaVersion: 1;
    player: PlayerProgress;
    settings: SaveSettings;
    tutorials: Partial<Record<RuleId, boolean>>;
    daily?: LocalDailyRecord;
}

export interface SaveDataV2 {
    schemaVersion: 2;
    player: PlayerProgress;
    settings: SaveSettings;
    tutorials: Partial<Record<RuleId, boolean>>;
    daily?: LocalDailyRecord;
    tower: TowerProgress;
}

const DEFAULT_SETTINGS: SaveSettings = { music: true, sfx: true, vibration: true, quality: 'auto' };

export function createDefaultSave(): SaveDataV2 {
    return {
        schemaVersion: 2,
        player: { level: 1, xp: 0, bestScore: 0 },
        settings: { ...DEFAULT_SETTINGS },
        tutorials: {},
        tower: clone(DEFAULT_TOWER_PROGRESS),
    };
}

export function migrateV1ToV2(value: Partial<SaveDataV1>): SaveDataV2 {
    return normalizeV2({ ...value, schemaVersion: 2, tower: clone(DEFAULT_TOWER_PROGRESS) });
}

export function normalizeV2(parsed: Partial<SaveDataV2>): SaveDataV2 {
    const defaults = createDefaultSave();
    return {
        ...defaults,
        ...parsed,
        schemaVersion: 2,
        player: normalizePlayer(parsed.player),
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        tutorials: validTutorials(parsed.tutorials),
        daily: validDailyRecord(parsed.daily) ? { ...parsed.daily, tutorialBaseline: normalizeTutorialBaseline(parsed.daily.tutorialBaseline) } : undefined,
        tower: normalizeTowerProgress(parsed.tower),
    };
}

function normalizePlayer(value: Partial<PlayerProgress> | undefined): PlayerProgress {
    const xp = finiteNonNegative(value?.xp);
    return {
        level: Math.max(1, Math.floor(value?.level && Number.isFinite(value.level) ? value.level : 1)),
        xp,
        bestScore: finiteNonNegative(value?.bestScore),
    };
}

function validTutorials(value: unknown): Partial<Record<RuleId, boolean>> {
    const candidate = value as Partial<Record<RuleId, unknown>> | null | undefined;
    const result: Partial<Record<RuleId, boolean>> = {};
    if (!candidate) return result;
    for (const rule of ['reverse', 'rotate', 'multi', 'order', 'bomb'] as const) if (candidate[rule] === true) result[rule] = true;
    return result;
}

function validDailyRecord(value: unknown): value is LocalDailyRecord {
    const record = value as Partial<LocalDailyRecord> | null | undefined;
    return !!record
        && /^\d{4}-\d{2}-\d{2}$/.test(record.dateKey ?? '')
        && typeof record.recipeId === 'string' && !!dailyRecipeById(record.recipeId)
        && typeof record.attempts === 'number' && Number.isInteger(record.attempts) && record.attempts >= 0
        && typeof record.bestScore === 'number' && Number.isFinite(record.bestScore) && record.bestScore >= 0
        && typeof record.lastScore === 'number' && Number.isFinite(record.lastScore) && record.lastScore >= 0
        && typeof record.completed === 'boolean'
        && (record.tutorialBaseline === undefined || Array.isArray(record.tutorialBaseline));
}

function normalizeTutorialBaseline(value: unknown): Exclude<RuleId, 'standard'>[] {
    if (!Array.isArray(value)) return [];
    const valid = new Set<Exclude<RuleId, 'standard'>>(['reverse', 'rotate', 'multi', 'order', 'bomb']);
    return value.filter((rule): rule is Exclude<RuleId, 'standard'> => valid.has(rule as Exclude<RuleId, 'standard'>));
}

function finiteNonNegative(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
