import type { LocalLeaderboardRecords } from '../domain/Leaderboard';
import type { FriendChallengePayload } from '../domain/Models';
import { encodeFriendChallengeQuery, friendChallengeConfigSummary, parseFriendChallengeQuery, type FriendChallengeParseResult } from '../domain/FriendChallenge';

type WxApi = {
    vibrateShort?: (options?: { type?: 'light' | 'medium' | 'heavy' }) => void;
    shareAppMessage?: (options: { title: string; query: string }) => void;
    getLaunchOptionsSync?: () => { query?: Record<string, string> };
    onShow?: (listener: (options: { query?: Record<string, string> }) => void) => void;
    getUserProfile?: (options: {
        desc: string;
        success: (result: { userInfo?: { nickName?: string; avatarUrl?: string } }) => void;
        fail: (error: unknown) => void;
    }) => void;
    setUserCloudStorage?: (options: {
        KVDataList: Array<{ key: string; value: string }>;
        success?: () => void;
        fail?: (error: unknown) => void;
    }) => void;
    getOpenDataContext?: () => { postMessage: (message: unknown) => void };
    getStorageSync?: (key: string) => unknown;
    setStorageSync?: (key: string, value: string) => void;
    removeStorageSync?: (key: string) => void;
    getSystemInfoSync?: () => { screenWidth: number; screenHeight: number };
    createUserInfoButton?: (options: {
        type: 'text';
        text: string;
        lang: 'zh_CN';
        withCredentials: boolean;
        style: Record<string, string | number>;
    }) => {
        onTap: (listener: (result: { userInfo?: { nickName?: string; avatarUrl?: string } }) => void) => void;
        destroy: () => void;
    };
};

interface AuthorizationButtonRect {
    readonly centerX: number;
    readonly centerY: number;
    readonly width: number;
    readonly height: number;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
}

const PROFILE_STORAGE_KEY = 'brain-slash.wechat-profile.v1';

export const LEADERBOARD_CLOUD_KEYS = {
    brawlScore: 'bs_brawl_score',
    brawlDetail: 'bs_brawl_detail',
    trialFloor: 'bs_trial_floor',
    trialDetail: 'bs_trial_detail',
} as const;

export interface AuthorizedUserProfile {
    readonly nickName: string;
    readonly avatarUrl: string;
}

export interface AuthorizationResult {
    readonly status: 'authorized' | 'cancelled' | 'unsupported';
    readonly profile?: AuthorizedUserProfile;
}

export class PlatformService {
    private userProfile: AuthorizedUserProfile | null = this.readStoredProfile();
    private readonly userProfileListeners = new Set<() => void>();
    private userInfoButton: ReturnType<NonNullable<WxApi['createUserInfoButton']>> | null = null;
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
    public authorizeUserProfile(): Promise<AuthorizationResult> {
        const getUserProfile = this.wx?.getUserProfile;
        if (!getUserProfile) return Promise.resolve({ status: 'unsupported' });
        return new Promise((resolve) => {
            getUserProfile({
                desc: '用于在好友排行榜中展示头像和昵称',
                success: (result) => {
                    const nickName = result.userInfo?.nickName?.trim() ?? '';
                    const avatarUrl = result.userInfo?.avatarUrl?.trim() ?? '';
                    if (!avatarUrl) {
                        resolve({ status: 'cancelled' });
                        return;
                    }
                    const profile = { nickName: nickName || '我', avatarUrl };
                    this.setAuthorizedUserProfile(profile);
                    resolve({ status: 'authorized', profile });
                },
                fail: () => resolve({ status: 'cancelled' }),
            });
        });
    }

    /** Places WeChat's required native authorization button over a Cocos UI row. */
    public showUserAuthorizationButton(rect: AuthorizationButtonRect, listener: (result: AuthorizationResult) => void): boolean {
        this.hideUserAuthorizationButton();
        const createButton = this.wx?.createUserInfoButton;
        const info = this.wx?.getSystemInfoSync?.();
        if (!createButton || !info || rect.viewportWidth <= 0 || rect.viewportHeight <= 0) return false;
        const left = (rect.centerX + rect.viewportWidth / 2 - rect.width / 2) / rect.viewportWidth * info.screenWidth;
        const top = (rect.viewportHeight / 2 - rect.centerY - rect.height / 2) / rect.viewportHeight * info.screenHeight;
        const button = createButton({
            type: 'text', text: '微信头像授权', lang: 'zh_CN', withCredentials: true,
            style: {
                left, top,
                width: rect.width / rect.viewportWidth * info.screenWidth,
                height: rect.height / rect.viewportHeight * info.screenHeight,
                lineHeight: rect.height / rect.viewportHeight * info.screenHeight,
                backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0,
                borderRadius: 0, color: 'rgba(0,0,0,0)', fontSize: 1, textAlign: 'center',
            },
        });
        this.userInfoButton = button;
        button.onTap((result) => {
            const nickName = result.userInfo?.nickName?.trim() ?? '';
            const avatarUrl = result.userInfo?.avatarUrl?.trim() ?? '';
            if (!avatarUrl) {
                listener({ status: 'cancelled' });
                return;
            }
            const profile = { nickName: nickName || '我', avatarUrl };
            this.setAuthorizedUserProfile(profile);
            this.hideUserAuthorizationButton();
            listener({ status: 'authorized', profile });
        });
        return true;
    }

    public hideUserAuthorizationButton(): void {
        try { this.userInfoButton?.destroy(); } catch { /* The native button may already be destroyed by WeChat. */ }
        this.userInfoButton = null;
    }

    public setAuthorizedUserProfile(profile: AuthorizedUserProfile | null): void {
        const normalized = profile && profile.avatarUrl.trim()
            ? { nickName: profile.nickName.trim(), avatarUrl: profile.avatarUrl.trim() }
            : null;
        if (this.userProfile?.nickName === normalized?.nickName && this.userProfile?.avatarUrl === normalized?.avatarUrl) return;
        this.userProfile = normalized;
        try {
            if (normalized) this.writeProfileStorage(JSON.stringify(normalized));
            else this.removeProfileStorage();
        } catch { /* Storage can be unavailable in preview. */ }
        this.userProfileListeners.forEach((listener) => listener());
    }
    public authorizedUserProfile(): AuthorizedUserProfile | null {
        return this.userProfile ? { ...this.userProfile } : null;
    }
    public onAuthorizedUserProfileChanged(listener: () => void): () => void {
        this.userProfileListeners.add(listener);
        return () => this.userProfileListeners.delete(listener);
    }

    public supportsFriendLeaderboard(): boolean {
        return typeof this.wx?.getOpenDataContext === 'function';
    }

    public postLeaderboardMessage(message: unknown): void {
        try { this.wx?.getOpenDataContext?.().postMessage(message); } catch (error) {
            console.warn('[Platform] Failed to message open data context', error);
        }
    }

    public uploadLeaderboard(records: LocalLeaderboardRecords): Promise<boolean> {
        const upload = this.wx?.setUserCloudStorage;
        if (!upload) return Promise.resolve(false);
        const brawl = records.brawl;
        const trial = records.trial;
        const KVDataList = [
            { key: LEADERBOARD_CLOUD_KEYS.brawlScore, value: String(Math.max(0, Math.floor(brawl.rankScore))) },
            { key: LEADERBOARD_CLOUD_KEYS.brawlDetail, value: JSON.stringify({ s: brawl.survivalMs, a: brawl.answeredCount, c: brawl.maxCombo, r: brawl.accuracy }) },
            { key: LEADERBOARD_CLOUD_KEYS.trialFloor, value: String(Math.max(0, Math.floor(trial.highestFloor))) },
            { key: LEADERBOARD_CLOUD_KEYS.trialDetail, value: JSON.stringify({ a: trial.answeredCount, r: trial.accuracy }) },
        ];
        return new Promise((resolve) => upload({
            KVDataList,
            success: () => resolve(true),
            fail: (error) => { console.warn('[Platform] Leaderboard upload failed', error); resolve(false); },
        }));
    }

    private readStoredProfile(): AuthorizedUserProfile | null {
        try {
            const raw = this.wx?.getStorageSync?.(PROFILE_STORAGE_KEY)
                ?? (globalThis as { localStorage?: Storage }).localStorage?.getItem(PROFILE_STORAGE_KEY);
            if (typeof raw !== 'string' || !raw) return null;
            const value = JSON.parse(raw) as Partial<AuthorizedUserProfile>;
            return typeof value.nickName === 'string' && typeof value.avatarUrl === 'string' && value.avatarUrl.trim()
                ? { nickName: value.nickName.trim() || '我', avatarUrl: value.avatarUrl.trim() }
                : null;
        } catch { return null; }
    }

    private writeProfileStorage(value: string): void {
        if (this.wx?.setStorageSync) this.wx.setStorageSync(PROFILE_STORAGE_KEY, value);
        else (globalThis as { localStorage?: Storage }).localStorage?.setItem(PROFILE_STORAGE_KEY, value);
    }

    private removeProfileStorage(): void {
        if (this.wx?.removeStorageSync) this.wx.removeStorageSync(PROFILE_STORAGE_KEY);
        else (globalThis as { localStorage?: Storage }).localStorage?.removeItem(PROFILE_STORAGE_KEY);
    }
}
