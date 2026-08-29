import type { RunResult } from './Models';

export type LeaderboardMode = 'brawl' | 'trial';

export interface BrawlLeaderboardRecord {
    readonly survivalMs: number;
    readonly answeredCount: number;
    readonly maxCombo: number;
    readonly accuracy: number;
    readonly masterSlashCount: number;
    readonly rankScore: number;
}

export interface TrialLeaderboardRecord {
    readonly highestFloor: number;
    readonly answeredCount: number;
    readonly accuracy: number;
}

export interface LeaderboardEntry {
    readonly id: string;
    readonly name: string;
    readonly avatarUrl?: string;
    readonly score: number;
    readonly rank: number;
    readonly isSelf: boolean;
    readonly brawl?: BrawlLeaderboardRecord;
    readonly trial?: TrialLeaderboardRecord;
}

export interface LeaderboardSnapshot {
    readonly mode: LeaderboardMode;
    readonly top: readonly LeaderboardEntry[];
    readonly self: LeaderboardEntry;
}

export interface LocalLeaderboardRecords {
    readonly brawl: BrawlLeaderboardRecord;
    readonly trial: TrialLeaderboardRecord;
}

interface Rival {
    readonly id: string;
    readonly name: string;
    readonly brawl: BrawlLeaderboardRecord;
    readonly trial: TrialLeaderboardRecord;
}

const LOCAL_RIVALS: readonly Rival[] = [
    rival('xiaowang', '小王', 188, 92, 24, .94, 8, 30, 368, .92),
    rival('aning', '阿宁', 172, 86, 21, .93, 7, 28, 342, .91),
    rival('momo', 'Momo', 158, 80, 19, .91, 6, 26, 315, .89),
    rival('panda', '大熊猫', 143, 74, 18, .89, 5, 23, 286, .88),
    rival('milkcap', '奶盖小仙女', 132, 69, 16, .90, 5, 21, 264, .90),
    rival('hungry', '吃不饱', 121, 64, 15, .87, 4, 19, 239, .86),
    rival('paopao', '泡泡龙', 108, 58, 13, .86, 3, 16, 210, .85),
    rival('universe', '小宇宙', 96, 52, 12, .84, 3, 13, 178, .82),
    rival('fish', '咸鱼翻身', 84, 47, 10, .81, 2, 10, 145, .80),
    rival('knife', '刀刀见纸', 73, 41, 9, .80, 2, 8, 119, .78),
    rival('quickeye', '眼疾手快', 62, 35, 8, .77, 1, 6, 92, .75),
    rival('onecut', '一刀流', 51, 29, 6, .72, 1, 4, 64, .70),
] as const;

export function calculateBrawlRankScore(record: Omit<BrawlLeaderboardRecord, 'rankScore'>): number {
    const seconds = Math.floor(normalize(record.survivalMs) / 1_000);
    const accuracyPercent = Math.round(normalizeAccuracy(record.accuracy) * 100);
    return seconds * 10
        + normalize(record.answeredCount) * 20
        + normalize(record.maxCombo) * 15
        + accuracyPercent * 5;
}

export function brawlRecordFromRun(run: RunResult): BrawlLeaderboardRecord {
    const base = {
        survivalMs: normalize(run.elapsedMs),
        answeredCount: normalize(run.correctCount) + normalize(run.errorCount),
        maxCombo: normalize(run.maxCombo),
        accuracy: normalizeAccuracy(run.accuracy),
        masterSlashCount: normalize(run.masterSlashCount),
    };
    return { ...base, rankScore: calculateBrawlRankScore(base) };
}

export function isBetterBrawlRecord(candidate: BrawlLeaderboardRecord, current: BrawlLeaderboardRecord): boolean {
    return compareBrawl(candidate, current) < 0;
}

export function createLocalLeaderboard(mode: LeaderboardMode, records: LocalLeaderboardRecords, limit = 10): LeaderboardSnapshot {
    const candidates: LeaderboardEntry[] = LOCAL_RIVALS.map((item) => entry(item.id, item.name, false, item.brawl, item.trial));
    candidates.push(entry('self', '我', true, records.brawl, records.trial));
    candidates.sort(mode === 'brawl'
        ? (a, b) => compareBrawl(a.brawl!, b.brawl!) || selfAndId(a, b)
        : (a, b) => compareTrial(a.trial!, b.trial!) || selfAndId(a, b));
    const ranked = candidates.map((item, index) => ({ ...item, score: mode === 'brawl' ? item.brawl!.rankScore : item.trial!.highestFloor, rank: index + 1 }));
    return { mode, top: ranked.slice(0, Math.max(1, Math.floor(limit))), self: ranked.find((item) => item.isSelf)! };
}

export function emptyBrawlRecord(legacyRankScore = 0): BrawlLeaderboardRecord {
    return { survivalMs: 0, answeredCount: 0, maxCombo: 0, accuracy: 0, masterSlashCount: 0, rankScore: normalize(legacyRankScore) };
}

function rival(id: string, name: string, seconds: number, answeredCount: number, maxCombo: number, accuracy: number, masterSlashCount: number, highestFloor: number, trialAnswered: number, trialAccuracy: number): Rival {
    const base = { survivalMs: seconds * 1_000, answeredCount, maxCombo, accuracy, masterSlashCount };
    return { id, name, brawl: { ...base, rankScore: calculateBrawlRankScore(base) }, trial: { highestFloor, answeredCount: trialAnswered, accuracy: trialAccuracy } };
}

function entry(id: string, name: string, isSelf: boolean, brawl: BrawlLeaderboardRecord, trial: TrialLeaderboardRecord): LeaderboardEntry {
    return { id, name, isSelf, brawl, trial, score: 0, rank: 0 };
}

function compareBrawl(a: BrawlLeaderboardRecord, b: BrawlLeaderboardRecord): number {
    return b.rankScore - a.rankScore || b.survivalMs - a.survivalMs || b.answeredCount - a.answeredCount || b.accuracy - a.accuracy;
}

function compareTrial(a: TrialLeaderboardRecord, b: TrialLeaderboardRecord): number {
    return b.highestFloor - a.highestFloor || b.accuracy - a.accuracy || b.answeredCount - a.answeredCount;
}

function selfAndId(a: LeaderboardEntry, b: LeaderboardEntry): number {
    return Number(b.isSelf) - Number(a.isSelf) || a.id.localeCompare(b.id);
}

function normalize(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeAccuracy(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}
