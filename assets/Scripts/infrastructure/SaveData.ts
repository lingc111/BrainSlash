import { dailyRecipeById, type LocalDailyRecord } from '../domain/DailyChallenge';
import { DEFAULT_FRIEND_CHALLENGE_CONFIG, normalizeFriendChallengeConfig } from '../domain/FriendChallenge';
import type { FriendChallengeConfig, PlayerProgress, RuleId } from '../domain/Models';
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

export interface SaveDataV3 {
    schemaVersion: 3;
    player: PlayerProgress;
    settings: SaveSettings;
    tutorials: Partial<Record<RuleId, boolean>>;
    daily?: LocalDailyRecord;
    tower: TowerProgress;
    lastFriendChallengeConfig: FriendChallengeConfig;
}

const DEFAULT_SETTINGS: SaveSettings = { music: true, sfx: true, vibration: true, quality: 'auto' };

export function createDefaultSave(): SaveDataV3 {
    return {
        schemaVersion: 3,
        player: { level: 1, xp: 0, bestScore: 0 },
        settings: { ...DEFAULT_SETTINGS },
        tutorials: {},
        tower: clone(DEFAULT_TOWER_PROGRESS),
        lastFriendChallengeConfig: clone(DEFAULT_FRIEND_CHALLENGE_CONFIG),
    };
}

export function migrateV1ToV2(value: Partial<SaveDataV1>): SaveDataV2 {
    return normalizeV2({ ...value, schemaVersion: 2, tower: clone(DEFAULT_TOWER_PROGRESS) });
}

export function normalizeV2(parsed: Partial<SaveDataV2>): SaveDataV2 {
    return {
        schemaVersion: 2,
        player: normalizePlayer(parsed.player),
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        tutorials: validTutorials(parsed.tutorials),
        daily: validDailyRecord(parsed.daily) ? normalizeDailyRecord(parsed.daily) : undefined,
        tower: normalizeTowerProgress(parsed.tower),
    };
}

export function migrateV2ToV3(value: Partial<SaveDataV2>): SaveDataV3 {
    return normalizeV3({ ...normalizeV2(value), schemaVersion: 3 });
}

export function migrateV1ToV3(value: Partial<SaveDataV1>): SaveDataV3 {
    return migrateV2ToV3(migrateV1ToV2(value));
}

export function normalizeV3(parsed: Partial<SaveDataV3>): SaveDataV3 {
    const challenge = normalizeFriendChallengeConfig(parsed.lastFriendChallengeConfig ?? DEFAULT_FRIEND_CHALLENGE_CONFIG);
    return {
        schemaVersion: 3,
        player: normalizePlayer(parsed.player),
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        tutorials: validTutorials(parsed.tutorials),
        daily: validDailyRecord(parsed.daily) ? normalizeDailyRecord(parsed.daily) : undefined,
        tower: normalizeTowerProgress(parsed.tower),
        lastFriendChallengeConfig: challenge.valid ? challenge.config : clone(DEFAULT_FRIEND_CHALLENGE_CONFIG),
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

function normalizeDailyRecord(record: LocalDailyRecord): LocalDailyRecord {
    const recipe = dailyRecipeById(record.recipeId);
    const targetScore = finitePositive(record.targetScore) ?? recipe?.targetScore ?? 1200;
    return {
        ...record,
        targetScore,
        targetAchieved: record.targetAchieved === true || record.bestScore >= targetScore,
        achievedAt: typeof record.achievedAt === 'number' && Number.isFinite(record.achievedAt) ? record.achievedAt : undefined,
        tutorialBaseline: normalizeTutorialBaseline(record.tutorialBaseline),
    };
}

function normalizeTutorialBaseline(value: unknown): Exclude<RuleId, 'standard'>[] {
    if (!Array.isArray(value)) return [];
    const valid = new Set<Exclude<RuleId, 'standard'>>(['reverse', 'rotate', 'multi', 'order', 'bomb']);
    return value.filter((rule): rule is Exclude<RuleId, 'standard'> => valid.has(rule as Exclude<RuleId, 'standard'>));
}

function finiteNonNegative(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function finitePositive(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
