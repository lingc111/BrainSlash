import type { GameEntryParams, GameMode } from '../domain/Models';
import { createDailyChallenge } from '../domain/DailyChallenge';

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

/** Creates reproducible daily/friend entries and unique seeds for free-play runs. */
export class RunSeedFactory {
    private sequence = 0;

    public constructor(
        private readonly clock: Clock = () => new Date(),
        private readonly entropy: EntropySource = defaultEntropy,
    ) {}

    public create(mode: GameMode, contentVersion: string): GameEntryParams {
        const now = this.clock();
        if (mode === 'daily') {
            return createDailyChallenge(now, contentVersion).entry;
        }

        this.sequence = (this.sequence + 1) >>> 0;
        const seed = [
            mode,
            now.getTime().toString(36),
            this.sequence.toString(36),
            (this.entropy() >>> 0).toString(36),
        ].join(':');
        return { mode, seed, contentVersion, recipeId: 'mixed' };
    }
}
