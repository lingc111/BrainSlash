import { dailyRecipeById, type LocalDailyRecord } from '../domain/DailyChallenge';
import { DEFAULT_FRIEND_CHALLENGE_CONFIG, normalizeFriendChallengeConfig } from '../domain/FriendChallenge';
import { emptyBrawlRecord, type BrawlLeaderboardRecord } from '../domain/Leaderboard';
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

export interface SaveLeaderboard {
    brawlBestScore: number;
}

export interface SaveDataV4 {
    schemaVersion: 4;
    player: PlayerProgress;
    settings: SaveSettings;
    tutorials: Partial<Record<RuleId, boolean>>;
    daily?: LocalDailyRecord;
    tower: TowerProgress;
    lastFriendChallengeConfig: FriendChallengeConfig;
    leaderboard: SaveLeaderboard;
}

export interface SaveLeaderboardV5 {
    brawlBest: BrawlLeaderboardRecord;
    trialAnsweredCount: number;
    trialCorrectCount: number;
}

export interface SaveDataV5 {
    schemaVersion: 5;
    player: PlayerProgress;
    settings: SaveSettings;
    tutorials: Partial<Record<RuleId, boolean>>;
    daily?: LocalDailyRecord;
    tower: TowerProgress;
    lastFriendChallengeConfig: FriendChallengeConfig;
    leaderboard: SaveLeaderboardV5;
    recentQuestionIds: string[];
    recentQuestionSignatures: string[];
}

export interface SaveDataV6 {
    schemaVersion: 6;
    player: PlayerProgress;
    settings: SaveSettings;
    tutorials: Partial<Record<RuleId, boolean>>;
    daily?: LocalDailyRecord;
    tower: TowerProgress;
    lastFriendChallengeConfig: FriendChallengeConfig;
    leaderboard: SaveLeaderboardV5;
    recentQuestionIds: string[];
    recentQuestionSignatures: string[];
}

const DEFAULT_SETTINGS: SaveSettings = { music: true, sfx: true, vibration: true, quality: 'auto' };

export function createDefaultSave(): SaveDataV6 {
    return {
        schemaVersion: 6,
        player: { level: 1, xp: 0, bestScore: 0 },
        settings: { ...DEFAULT_SETTINGS },
        tutorials: {},
        tower: clone(DEFAULT_TOWER_PROGRESS),
        lastFriendChallengeConfig: clone(DEFAULT_FRIEND_CHALLENGE_CONFIG),
        leaderboard: { brawlBest: emptyBrawlRecord(), trialAnsweredCount: 0, trialCorrectCount: 0 },
        recentQuestionIds: [],
        recentQuestionSignatures: [],
    };
}

export function migrateV5ToV6(value: Partial<SaveDataV5>): SaveDataV6 {
    const v5 = normalizeV5(value);
    return {
        ...v5,
        schemaVersion: 6,
        tower: clone(DEFAULT_TOWER_PROGRESS),
        leaderboard: { ...v5.leaderboard, trialAnsweredCount: 0, trialCorrectCount: 0 },
    };
}

export function migrateV4ToV6(value: Partial<SaveDataV4>): SaveDataV6 { return migrateV5ToV6(migrateV4ToV5(value)); }
export function migrateV3ToV6(value: Partial<SaveDataV3>): SaveDataV6 { return migrateV5ToV6(migrateV3ToV5(value)); }
export function migrateV2ToV6(value: Partial<SaveDataV2>): SaveDataV6 { return migrateV5ToV6(migrateV2ToV5(value)); }
export function migrateV1ToV6(value: Partial<SaveDataV1>): SaveDataV6 { return migrateV5ToV6(migrateV1ToV5(value)); }

export function normalizeV6(parsed: Partial<SaveDataV6>): SaveDataV6 {
    const v5 = normalizeV5({ ...parsed, schemaVersion: 5 });
    return {
        ...v5,
        schemaVersion: 6,
        tower: normalizeTowerProgress(parsed.tower),
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

export function migrateV3ToV4(value: Partial<SaveDataV3>): SaveDataV4 {
    const v3 = normalizeV3(value);
    return normalizeV4({
        ...v3,
        schemaVersion: 4,
        // V3 only had one best-score field, so preserve it as the initial
        // brawl record instead of discarding a player's existing achievement.
        leaderboard: { brawlBestScore: v3.player.bestScore },
    });
}

export function migrateV2ToV4(value: Partial<SaveDataV2>): SaveDataV4 {
    return migrateV3ToV4(migrateV2ToV3(value));
}

export function migrateV1ToV4(value: Partial<SaveDataV1>): SaveDataV4 {
    return migrateV3ToV4(migrateV1ToV3(value));
}

export function migrateV4ToV5(value: Partial<SaveDataV4>): SaveDataV5 {
    const v4 = normalizeV4(value);
    return normalizeV5({
        ...v4,
        schemaVersion: 5,
        leaderboard: {
            brawlBest: emptyBrawlRecord(v4.leaderboard.brawlBestScore),
            trialAnsweredCount: 0,
            trialCorrectCount: 0,
        },
    });
}

export function migrateV3ToV5(value: Partial<SaveDataV3>): SaveDataV5 { return migrateV4ToV5(migrateV3ToV4(value)); }
export function migrateV2ToV5(value: Partial<SaveDataV2>): SaveDataV5 { return migrateV4ToV5(migrateV2ToV4(value)); }
export function migrateV1ToV5(value: Partial<SaveDataV1>): SaveDataV5 { return migrateV4ToV5(migrateV1ToV4(value)); }

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

export function normalizeV4(parsed: Partial<SaveDataV4>): SaveDataV4 {
    const v3 = normalizeV3({ ...parsed, schemaVersion: 3 });
    return {
        ...v3,
        schemaVersion: 4,
        leaderboard: { brawlBestScore: finiteNonNegative(parsed.leaderboard?.brawlBestScore) },
    };
}

export function normalizeV5(parsed: Partial<SaveDataV5>): SaveDataV5 {
    const v3 = normalizeV3({ ...parsed, schemaVersion: 3 });
    const answered = finiteNonNegative(parsed.leaderboard?.trialAnsweredCount);
    return {
        ...v3,
        schemaVersion: 5,
        leaderboard: {
            brawlBest: normalizeBrawlRecord(parsed.leaderboard?.brawlBest),
            trialAnsweredCount: answered,
            trialCorrectCount: Math.min(answered, finiteNonNegative(parsed.leaderboard?.trialCorrectCount)),
        },
        recentQuestionIds: normalizeRecentQuestionIds(parsed.recentQuestionIds),
        recentQuestionSignatures: normalizeRecentQuestionSignatures(parsed.recentQuestionSignatures),
    };
}

function normalizeRecentQuestionIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const result: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || !item.trim()) continue;
        const id = item.trim().slice(0, 120);
        const existing = result.indexOf(id);
        if (existing >= 0) result.splice(existing, 1);
        result.push(id);
    }
    return result.slice(-300);
}

function normalizeRecentQuestionSignatures(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const result: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || !item.trim()) continue;
        const signature = item.trim().slice(0, 240);
        const existing = result.indexOf(signature);
        if (existing >= 0) result.splice(existing, 1);
        result.push(signature);
    }
    return result.slice(-300);
}

function normalizeBrawlRecord(value: Partial<BrawlLeaderboardRecord> | undefined): BrawlLeaderboardRecord {
    return {
        survivalMs: finiteNonNegative(value?.survivalMs),
        answeredCount: finiteNonNegative(value?.answeredCount),
        maxCombo: finiteNonNegative(value?.maxCombo),
        accuracy: finiteRatio(value?.accuracy),
        masterSlashCount: finiteNonNegative(value?.masterSlashCount),
        rankScore: finiteNonNegative(value?.rankScore),
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

function finiteRatio(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
