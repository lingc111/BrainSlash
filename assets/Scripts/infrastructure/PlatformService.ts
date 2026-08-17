import type { FriendChallengePayload, GameEntryParams } from '../domain/Models';

type WxApi = {
    vibrateShort?: (options?: { type?: 'light' | 'medium' | 'heavy' }) => void;
    shareAppMessage?: (options: { title: string; query: string }) => void;
    getLaunchOptionsSync?: () => { query?: Record<string, string> };
};

export class PlatformService {
    private get wx(): WxApi | undefined { return (globalThis as { wx?: WxApi }).wx; }
    public vibrate(enabled: boolean, type: 'light' | 'medium' | 'heavy' = 'light'): void { if (enabled) this.wx?.vibrateShort?.({ type }); }
    public share(payload: FriendChallengePayload): void {
        const query = Object.entries(payload).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
        this.wx?.shareAppMessage?.({ title: `我在脑斩拿到 ${payload.targetScore} 分，敢来挑战吗？`, query });
    }
    public readChallenge(contentVersion: string): GameEntryParams | null {
        try {
            const query = this.wx?.getLaunchOptionsSync?.().query;
            if (!query || query.v !== '1' || query.contentVersion !== contentVersion || !query.seed) return null;
            return { mode: 'friendChallenge', seed: query.seed, contentVersion, recipeId: query.recipeId, targetScore: Number(query.targetScore) || 0 };
        } catch { return null; }
    }
}
