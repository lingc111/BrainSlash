import { sys } from 'cc';
import { beginDailyRun, recordDailyRun } from '../domain/DailyChallenge';
import { normalizeFriendChallengeConfig } from '../domain/FriendChallenge';
import type { FriendChallengeConfig, GameEntryParams, GameResult, RunResult } from '../domain/Models';
import { finalizeResult, XP_PER_CORRECT, XP_PER_LEVEL } from '../domain/ResultSummary';
import { commitTowerFloor, type TowerFloorResult } from '../domain/TowerMode';
import {
    createDefaultSave,
    migrateV1ToV3,
    migrateV2ToV3,
    normalizeV3,
    type SaveDataV1,
    type SaveDataV2,
    type SaveDataV3,
    type SaveSettings,
} from './SaveData';

export type { SaveDataV1, SaveDataV2, SaveDataV3, SaveSettings } from './SaveData';

const KEY_V1 = 'brain-slash.save.v1';
const KEY_V2 = 'brain-slash.save.v2';
const KEY_V3 = 'brain-slash.save.v3';

export class SaveService {
    private data: SaveDataV3 = createDefaultSave();

    public load(): SaveDataV3 {
        const rawV3 = safeParse(sys.localStorage.getItem(KEY_V3));
        if (rawV3 && (rawV3 as Partial<SaveDataV3>).schemaVersion === 3) {
            this.data = normalizeV3(rawV3 as Partial<SaveDataV3>);
            return this.snapshot();
        }
        const rawV2 = safeParse(sys.localStorage.getItem(KEY_V2));
        if (rawV2 && (rawV2 as Partial<SaveDataV2>).schemaVersion === 2) {
            this.data = migrateV2ToV3(rawV2 as Partial<SaveDataV2>);
            this.persist();
            return this.snapshot();
        }
        const rawV1 = safeParse(sys.localStorage.getItem(KEY_V1));
        this.data = rawV1 && (rawV1 as Partial<SaveDataV1>).schemaVersion === 1
            ? migrateV1ToV3(rawV1 as Partial<SaveDataV1>) : createDefaultSave();
        this.persist();
        return this.snapshot();
    }

    public snapshot(): SaveDataV3 { return clone(this.data); }

    public commitResult(run: RunResult): GameResult {
        const committed = finalizeResult(run, this.data.player);
        this.data.player = committed.player;
        const daily = recordDailyRun(this.data.daily, run);
        if (daily) this.data.daily = daily.record;
        this.persist();
        return daily ? { ...committed.result, daily: daily.result } : committed.result;
    }

    public commitTowerResult(run: RunResult, life: number): TowerFloorResult {
        const commit = commitTowerFloor(this.data.tower, run, life);
        this.data.tower = commit.progress;
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

    private persist(): void {
        try { sys.localStorage.setItem(KEY_V3, JSON.stringify(this.data)); } catch { /* Storage can be unavailable in preview. */ }
    }
}

function safeParse(value: string | null): unknown {
    if (!value) return null;
    try { return JSON.parse(value) as unknown; } catch { return null; }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
