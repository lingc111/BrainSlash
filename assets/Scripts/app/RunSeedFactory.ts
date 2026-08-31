import type { FriendChallengeConfig, GameEntryParams, GameMode } from '../domain/Models';
import { createDailyChallenge } from '../domain/DailyChallenge';
import { TOWER_LAST_FLOOR } from '../domain/TowerMode';

type Clock = () => Date;
type EntropySource = () => number;

function defaultEntropy(): number {
    const cryptoApi = (globalThis as {
        crypto?: { getRandomValues?: (values: Uint32Array) => Uint32Array };
    }).crypto;
    try {
        const values = new Uint32Array(1);
        if (cryptoApi?.getRandomValues) return cryptoApi.getRandomValues(values)[0] >>> 0;
    } catch {
        // Some mini-game runtimes expose crypto without getRandomValues support.
    }
    return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

/** Keeps the daily recipe stable while giving every playable attempt a fresh seed. */
export class RunSeedFactory {
    private sequence = 0;

    public constructor(
        private readonly clock: Clock = () => new Date(),
        private readonly entropy: EntropySource = defaultEntropy,
    ) {}

    public create(mode: GameMode, contentVersion: string, towerFloor?: number): GameEntryParams {
        const now = this.clock();
        if (mode === 'daily') {
            const challenge = createDailyChallenge(now, contentVersion);
            this.sequence = (this.sequence + 1) >>> 0;
            return {
                ...challenge.entry,
                seed: [
                    challenge.entry.seed,
                    'attempt',
                    now.getTime().toString(36),
                    this.sequence.toString(36),
                    (this.entropy() >>> 0).toString(36),
                ].join(':'),
            };
        }

        this.sequence = (this.sequence + 1) >>> 0;
        const floor = mode === 'tower'
            ? Math.max(1, Math.min(TOWER_LAST_FLOOR, Math.floor(towerFloor ?? 1)))
            : undefined;
        const seed = [
            mode,
            ...(floor === undefined ? [] : [`floor-${floor}`]),
            now.getTime().toString(36),
            this.sequence.toString(36),
            (this.entropy() >>> 0).toString(36),
        ].join(':');
        return { mode, seed, contentVersion, recipeId: 'mixed', towerFloor: floor };
    }

    public createFriendChallenge(config: FriendChallengeConfig, contentVersion: string): GameEntryParams {
        const entry = this.create('friendChallenge', contentVersion);
        return { ...entry, recipeId: undefined, challengeConfig: clone(config), challengeRole: 'creator' };
    }

    /** Friend challenges replay the exact shared question sequence; other modes start a fresh attempt. */
    public createReplay(entry: GameEntryParams, contentVersion: string): GameEntryParams {
        if (entry.mode === 'friendChallenge') {
            return {
                ...entry,
                ...(entry.challengeConfig ? { challengeConfig: clone(entry.challengeConfig) } : {}),
            };
        }
        return this.create(entry.mode, contentVersion, entry.towerFloor);
    }
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
