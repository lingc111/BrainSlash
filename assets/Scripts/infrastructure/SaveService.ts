import { sys } from 'cc';
import { beginDailyRun, recordDailyRun } from '../domain/DailyChallenge';
import { normalizeFriendChallengeConfig } from '../domain/FriendChallenge';
import { applyBrawlFinalScore, brawlRecordFromRun, isBetterBrawlRecord } from '../domain/Leaderboard';
import type { FriendChallengeConfig, GameEntryParams, GameResult, RunResult } from '../domain/Models';
import type { TowerChallengeSnapshot } from '../domain/TowerChallenge';
import { finalizeResult, XP_PER_CORRECT, XP_PER_LEVEL } from '../domain/ResultSummary';
import { commitTowerFloor, type TowerFloorResult } from '../domain/TowerMode';
import {
    createDefaultSave,
    migrateV1ToV6,
    migrateV2ToV6,
    migrateV3ToV6,
    migrateV4ToV6,
    migrateV5ToV6,
    migrateV6ToV7,
    normalizeV7,
    type SaveDataV1,
    type SaveDataV2,
    type SaveDataV3,
    type SaveDataV4,
    type SaveDataV5,
    type SaveDataV6,
    type SaveDataV7,
    type SaveSettings,
    RECENT_QUESTION_HISTORY_LIMIT,
} from './SaveData';

export type { SaveDataV1, SaveDataV2, SaveDataV3, SaveDataV4, SaveDataV5, SaveDataV6, SaveDataV7, SaveSettings } from './SaveData';

const KEY_V1 = 'brain-slash.save.v1';
const KEY_V2 = 'brain-slash.save.v2';
const KEY_V3 = 'brain-slash.save.v3';
const KEY_V4 = 'brain-slash.save.v4';
const KEY_V5 = 'brain-slash.save.v5';
const KEY_V6 = 'brain-slash.save.v6';
const KEY_V7 = 'brain-slash.save.v7';

export class SaveService {
    private data: SaveDataV7 = createDefaultSave();

    public load(): SaveDataV7 {
        const rawV7 = safeParse(sys.localStorage.getItem(KEY_V7));
        if (rawV7 && (rawV7 as Partial<SaveDataV7>).schemaVersion === 7) {
            this.data = normalizeV7(rawV7 as Partial<SaveDataV7>);
            return this.snapshot();
        }
        const rawV6 = safeParse(sys.localStorage.getItem(KEY_V6));
        if (rawV6 && (rawV6 as Partial<SaveDataV6>).schemaVersion === 6) {
            this.data = migrateV6ToV7(rawV6 as Partial<SaveDataV6>);
            this.persist();
            return this.snapshot();
        }
        const rawV5 = safeParse(sys.localStorage.getItem(KEY_V5));
        if (rawV5 && (rawV5 as Partial<SaveDataV5>).schemaVersion === 5) {
            this.data = migrateV6ToV7(migrateV5ToV6(rawV5 as Partial<SaveDataV5>));
            this.persist();
            return this.snapshot();
        }
        const rawV4 = safeParse(sys.localStorage.getItem(KEY_V4));
        if (rawV4 && (rawV4 as Partial<SaveDataV4>).schemaVersion === 4) {
            this.data = migrateV6ToV7(migrateV4ToV6(rawV4 as Partial<SaveDataV4>));
            this.persist();
            return this.snapshot();
        }
        const rawV3 = safeParse(sys.localStorage.getItem(KEY_V3));
        if (rawV3 && (rawV3 as Partial<SaveDataV3>).schemaVersion === 3) {
            this.data = migrateV6ToV7(migrateV3ToV6(rawV3 as Partial<SaveDataV3>));
            this.persist();
            return this.snapshot();
        }
        const rawV2 = safeParse(sys.localStorage.getItem(KEY_V2));
        if (rawV2 && (rawV2 as Partial<SaveDataV2>).schemaVersion === 2) {
            this.data = migrateV6ToV7(migrateV2ToV6(rawV2 as Partial<SaveDataV2>));
            this.persist();
            return this.snapshot();
        }
        const rawV1 = safeParse(sys.localStorage.getItem(KEY_V1));
        this.data = rawV1 && (rawV1 as Partial<SaveDataV1>).schemaVersion === 1
            ? migrateV6ToV7(migrateV1ToV6(rawV1 as Partial<SaveDataV1>)) : createDefaultSave();
        this.persist();
        return this.snapshot();
    }

    public snapshot(): SaveDataV7 { return clone(this.data); }

    public commitResult(run: RunResult): GameResult {
        const scoredRun = applyBrawlFinalScore(run);
        const committed = finalizeResult(scoredRun, this.data.player);
        this.data.player = committed.player;
        if (scoredRun.entry.mode === 'brawl60') {
            const record = brawlRecordFromRun(scoredRun);
            if (isBetterBrawlRecord(record, this.data.leaderboard.brawlBest)) this.data.leaderboard.brawlBest = record;
        }
        const daily = recordDailyRun(this.data.daily, scoredRun);
        if (daily) this.data.daily = daily.record;
        this.persist();
        return daily ? { ...committed.result, daily: daily.result } : committed.result;
    }

    public commitTowerResult(run: RunResult, life: number, challenge?: TowerChallengeSnapshot): TowerFloorResult {
        const commit = commitTowerFloor(this.data.tower, run, life, challenge);
        this.data.tower = commit.progress;
        this.data.leaderboard.trialAnsweredCount += Math.max(0, Math.floor(run.correctCount + run.errorCount));
        this.data.leaderboard.trialCorrectCount += Math.max(0, Math.floor(run.correctCount));
        const xp = this.data.player.xp + Math.max(0, Math.floor(run.correctCount)) * XP_PER_CORRECT;
        this.data.player = { ...this.data.player, xp, level: 1 + Math.floor(xp / XP_PER_LEVEL) };
        this.persist();
        return commit.result;
    }

    public beginDaily(entry: GameEntryParams): void {
        const record = beginDailyRun(this.data.daily, entry, this.data.tutorials);
        if (!record || record === this.data.daily) return;
        this.data.daily = record;
        this.persist();
    }

    public updateSettings(patch: Partial<SaveSettings>): void {
        this.data.settings = { ...this.data.settings, ...patch };
        this.persist();
    }

    public updateLastFriendChallengeConfig(config: FriendChallengeConfig): boolean {
        const normalized = normalizeFriendChallengeConfig(config);
        if (!normalized.valid) return false;
        this.data.lastFriendChallengeConfig = normalized.config;
        this.persist();
        return true;
    }

    public rememberQuestion(ids: readonly string[], semanticSignature: string): void {
        for (const raw of ids) {
            const id = raw.trim();
            if (!id) continue;
            const existing = this.data.recentQuestionIds.indexOf(id);
            if (existing >= 0) this.data.recentQuestionIds.splice(existing, 1);
            this.data.recentQuestionIds.push(id);
        }
        if (this.data.recentQuestionIds.length > RECENT_QUESTION_HISTORY_LIMIT) {
            this.data.recentQuestionIds.splice(0, this.data.recentQuestionIds.length - RECENT_QUESTION_HISTORY_LIMIT);
        }
        const existingSignature = this.data.recentQuestionSignatures.indexOf(semanticSignature);
        if (existingSignature >= 0) this.data.recentQuestionSignatures.splice(existingSignature, 1);
        this.data.recentQuestionSignatures.push(semanticSignature);
        if (this.data.recentQuestionSignatures.length > RECENT_QUESTION_HISTORY_LIMIT) {
            this.data.recentQuestionSignatures.splice(0, this.data.recentQuestionSignatures.length - RECENT_QUESTION_HISTORY_LIMIT);
        }
    }

    private persist(): void {
        try { sys.localStorage.setItem(KEY_V7, JSON.stringify(this.data)); } catch { /* Storage can be unavailable in preview. */ }
    }
}

function safeParse(value: string | null): unknown {
    if (!value) return null;
    try { return JSON.parse(value) as unknown; } catch { return null; }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
