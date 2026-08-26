import type { FriendChallengePayload } from '../domain/Models';
import { encodeFriendChallengeQuery, friendChallengeConfigSummary, parseFriendChallengeQuery, type FriendChallengeParseResult } from '../domain/FriendChallenge';

type WxApi = {
    vibrateShort?: (options?: { type?: 'light' | 'medium' | 'heavy' }) => void;
    shareAppMessage?: (options: { title: string; query: string }) => void;
    getLaunchOptionsSync?: () => { query?: Record<string, string> };
    onShow?: (listener: (options: { query?: Record<string, string> }) => void) => void;
};

export class PlatformService {
    private get wx(): WxApi | undefined { return (globalThis as { wx?: WxApi }).wx; }
    public vibrate(enabled: boolean, type: 'light' | 'medium' | 'heavy' = 'light'): void { if (enabled) this.wx?.vibrateShort?.({ type }); }
    public share(payload: FriendChallengePayload): void {
        const query = encodeFriendChallengeQuery(payload);
        const suffix = payload.v === 2 ? ` · ${friendChallengeConfigSummary(payload.config).duration}` : '';
        this.wx?.shareAppMessage?.({ title: `我在脑斩拿到 ${payload.targetScore} 分${suffix}，敢来挑战吗？`, query });
    }
    public readChallenge(contentVersion: string): FriendChallengeParseResult {
        try {
            const query = this.wx?.getLaunchOptionsSync?.().query;
            return parseFriendChallengeQuery(query, contentVersion);
        } catch { return { status: 'invalid' }; }
    }
    public onChallengeOpened(contentVersion: string, listener: (result: FriendChallengeParseResult) => void): void {
        this.wx?.onShow?.((options) => {
            const result = parseFriendChallengeQuery(options.query, contentVersion);
            if (result.status !== 'none') listener(result);
        });
    }
}
