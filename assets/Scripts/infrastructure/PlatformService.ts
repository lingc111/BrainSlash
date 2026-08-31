import type { LocalLeaderboardRecords } from '../domain/Leaderboard';
import type { FriendChallengePayload } from '../domain/Models';
import { encodeFriendChallengeQuery, friendChallengeConfigSummary, parseFriendChallengeQuery, type FriendChallengeParseResult } from '../domain/FriendChallenge';

type WxApi = {
    vibrateShort?: (options?: { type?: 'light' | 'medium' | 'heavy' }) => void;
    shareAppMessage?: (options: { title: string; query: string }) => void;
    getLaunchOptionsSync?: () => { query?: Record<string, unknown> };
    getEnterOptionsSync?: () => { query?: Record<string, unknown> };
    onShow?: (listener: (options: { query?: Record<string, unknown> }) => void) => void;
    getUserProfile?: (options: {
        desc: string;
        success: (result: { userInfo?: { nickName?: string; avatarUrl?: string } }) => void;
        fail: (error: unknown) => void;
    }) => void;
    getSetting?: (options: {
        success: (result: { authSetting?: Record<string, boolean> }) => void;
        fail?: (error: unknown) => void;
    }) => void;
    authorize?: (options: {
        scope: 'scope.WxFriendInteraction';
        success: () => void;
        fail: (error: unknown) => void;
    }) => void;
    getUserInfo?: (options: {
        lang: 'zh_CN';
        withCredentials: boolean;
        success: (result: { userInfo?: { nickName?: string; avatarUrl?: string } }) => void;
        fail?: (error: unknown) => void;
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
        onTap: (listener: (result: { errMsg?: string; userInfo?: { nickName?: string; avatarUrl?: string } }) => void) => void;
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
    readonly reason?: string;
}

export class PlatformService {
    private userProfile: AuthorizedUserProfile | null = this.readStoredProfile();
    private readonly userProfileListeners = new Set<() => void>();
    private userInfoButton: ReturnType<NonNullable<WxApi['createUserInfoButton']>> | null = null;
    private authorizationSession = 0;
    private get wx(): WxApi | undefined { return (globalThis as { wx?: WxApi }).wx; }
    public vibrate(enabled: boolean, type: 'light' | 'medium' | 'heavy' = 'light'): void { if (enabled) this.wx?.vibrateShort?.({ type }); }
    public share(payload: FriendChallengePayload): void {
        const query = encodeFriendChallengeQuery(payload);
        const suffix = payload.v === 2 ? ` · ${friendChallengeConfigSummary(payload.config).duration}` : '';
        this.wx?.shareAppMessage?.({ title: `我在脑斩拿到 ${payload.targetScore} 分${suffix}，敢来挑战吗？`, query });
    }
    public readChallenge(contentVersion: string): FriendChallengeParseResult {
        const wxApi = this.wx;
        // getEnterOptionsSync represents both cold and warm entry and must be
        // preferred. Some base-library/device combinations expose it but throw
        // while the game is starting, so only then fall back to launch options.
        if (wxApi?.getEnterOptionsSync) {
            try {
                return parseFriendChallengeQuery(normalizeWechatQuery(wxApi.getEnterOptionsSync().query), contentVersion);
            } catch { /* Fall back to the cold-launch API below. */ }
        }
        try {
            return parseFriendChallengeQuery(normalizeWechatQuery(wxApi?.getLaunchOptionsSync?.().query), contentVersion);
        } catch { return { status: 'none' }; }
    }
    public onChallengeOpened(contentVersion: string, listener: (result: FriendChallengeParseResult) => void): void {
        this.wx?.onShow?.((options) => {
            const result = parseFriendChallengeQuery(normalizeWechatQuery(options.query), contentVersion);
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

    /** Required before friend-cloud APIs are used in the open data context. */
    public authorizeFriendInteraction(): Promise<AuthorizationResult> {
        const wxApi = this.wx;
        if (!wxApi?.authorize) return Promise.resolve({ status: 'unsupported', reason: '微信朋友信息授权接口不可用' });
        return new Promise((resolve) => {
            wxApi.authorize!({
                scope: 'scope.WxFriendInteraction',
                success: () => resolve({ status: 'authorized' }),
                fail: (error) => {
                    const reason = wxErrorMessage(error) || '微信朋友信息授权失败';
                    console.warn('[Platform] scope.WxFriendInteraction authorization failed:', reason);
                    resolve({ status: 'cancelled', reason: normalizeAuthorizationFailure(reason) });
                },
            });
        });
    }

    /** Places WeChat's required native authorization button over a Cocos UI row. */
    public showUserAuthorizationButton(rect: AuthorizationButtonRect, listener: (result: AuthorizationResult) => void): boolean {
        this.hideUserAuthorizationButton();
        const wxApi = this.wx;
        if (!wxApi?.createUserInfoButton || !wxApi.getSystemInfoSync || rect.viewportWidth <= 0 || rect.viewportHeight <= 0) {
            console.warn('[Platform] wx.createUserInfoButton is unavailable');
            return false;
        }
        const session = this.authorizationSession;
        const finish = (result: { errMsg?: string; userInfo?: { nickName?: string; avatarUrl?: string } }): void => {
            if (session !== this.authorizationSession) return;
            const nickName = result.userInfo?.nickName?.trim() ?? '';
            const avatarUrl = result.userInfo?.avatarUrl?.trim() ?? '';
            if (!avatarUrl) {
                const reason = result.errMsg || '微信未返回头像信息';
                console.warn('[Platform] WeChat user authorization did not return a profile:', reason);
                listener({ status: 'cancelled', reason: normalizeAuthorizationFailure(reason) });
                return;
            }
            const profile = { nickName: nickName || '我', avatarUrl };
            this.setAuthorizedUserProfile(profile);
            this.hideUserAuthorizationButton();
            listener({ status: 'authorized', profile });
        };
        const createNativeButton = (): void => {
            if (session !== this.authorizationSession) return;
            try {
                const info = wxApi.getSystemInfoSync!();
                const left = (rect.centerX + rect.viewportWidth / 2 - rect.width / 2) / rect.viewportWidth * info.screenWidth;
                const top = (rect.viewportHeight / 2 - rect.centerY - rect.height / 2) / rect.viewportHeight * info.screenHeight;
                const height = rect.height / rect.viewportHeight * info.screenHeight;
                const button = wxApi.createUserInfoButton!({
                    type: 'text', text: '微信头像　点击授权', lang: 'zh_CN', withCredentials: true,
                    style: {
                        left, top,
                        width: rect.width / rect.viewportWidth * info.screenWidth,
                        height, lineHeight: height,
                        backgroundColor: '#fffaf0', borderColor: '#1f1d19', borderWidth: 1,
                        borderRadius: 6, color: '#1f1d19', fontSize: Math.max(14, Math.round(height * 0.38)), textAlign: 'center',
                    },
                });
                this.userInfoButton = button;
                button.onTap(finish);
                console.info('[Platform] WeChat user-info button created', { left, top, height });
            } catch (error) {
                console.error('[Platform] Failed to create WeChat user-info button', error);
                listener({ status: 'unsupported', reason: String(error) });
            }
        };
        if (wxApi.getSetting && wxApi.getUserInfo) {
            wxApi.getSetting({
                success: (setting) => {
                    if (session !== this.authorizationSession) return;
                    if (setting.authSetting?.['scope.userInfo']) {
                        wxApi.getUserInfo!({
                            lang: 'zh_CN', withCredentials: true,
                            success: finish,
                            fail: (error) => {
                                const reason = wxErrorMessage(error);
                                if (isPrivacyUsageUndeclared(reason)) {
                                    console.error('[Platform] WeChat privacy usage is not declared in mp.weixin.qq.com:', reason);
                                    listener({ status: 'cancelled', reason: normalizeAuthorizationFailure(reason) });
                                } else {
                                    console.warn('[Platform] wx.getUserInfo failed; showing authorization button', error);
                                    createNativeButton();
                                }
                            },
                        });
                    } else createNativeButton();
                },
                fail: (error) => {
                    console.warn('[Platform] wx.getSetting failed; showing authorization button', error);
                    createNativeButton();
                },
            });
        } else createNativeButton();
        return true;
    }

    public hideUserAuthorizationButton(): void {
        this.authorizationSession += 1;
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

/** WeChat has returned both decoded query values and raw percent-encoded values
 * across runtimes. Normalize either shape before applying strict validation. */
function normalizeWechatQuery(query: Readonly<Record<string, unknown>> | undefined): Record<string, string> | undefined {
    if (!query) return undefined;
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
        if (typeof value !== 'string' && typeof value !== 'number') continue;
        const text = String(value);
        try { normalized[key] = decodeURIComponent(text); }
        catch { normalized[key] = text; }
    }
    return normalized;
}

function wxErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'errMsg' in error) return String((error as { errMsg?: unknown }).errMsg ?? '');
    return String(error ?? '');
}

function isPrivacyUsageUndeclared(reason: string): boolean {
    const normalized = reason.toLowerCase();
    return normalized.includes('announce your privacy usage') || normalized.includes('privacy usage');
}

function normalizeAuthorizationFailure(reason: string): string {
    return isPrivacyUsageUndeclared(reason) ? '请先在微信公众平台配置隐私保护指引' : reason;
}
