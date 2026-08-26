import type {
    FriendChallengeConfig,
    FriendChallengeDurationMs,
    FriendChallengePayload,
    GameEntryParams,
    RuleId,
    RunResult,
    ThemeId,
} from './Models';
import { legalRuleSetsForTheme } from './Brawl60Director';

const MAX_SEED_LENGTH = 256;
const MAX_TOKEN_LENGTH = 64;
const MAX_TARGET_SCORE = 100_000_000;

export const FRIEND_CHALLENGE_THEMES: readonly ThemeId[] = [
    'math', 'vision', 'english', 'hanzi', 'geography', 'life', 'knowledge', 'history',
];
export const FRIEND_CHALLENGE_RULES: readonly RuleId[] = ['standard', 'reverse', 'rotate', 'multi', 'order', 'bomb'];
export const FRIEND_CHALLENGE_DURATIONS: readonly FriendChallengeDurationMs[] = [60_000, 90_000, 120_000];
export const DEFAULT_FRIEND_CHALLENGE_CONFIG: Readonly<FriendChallengeConfig> = {
    themeIds: [...FRIEND_CHALLENGE_THEMES], enabledRules: [...FRIEND_CHALLENGE_RULES], durationMs: 60_000,
};

export type FriendChallengeConfigValidation =
    | { valid: true; config: FriendChallengeConfig }
    | { valid: false; reason: 'themes' | 'rules' | 'duration' | 'incompatible' };

export type FriendChallengeParseResult =
    | { status: 'none' }
    | { status: 'invalid' }
    | { status: 'expired' }
    | { status: 'valid'; entry: GameEntryParams };

export interface FriendTargetPresentation {
    text: string;
    tone: 'behind' | 'tied' | 'ahead';
    scoreDelta: number;
}

export function normalizeFriendChallengeConfig(value: unknown): FriendChallengeConfigValidation {
    const candidate = value as Partial<FriendChallengeConfig> | null | undefined;
    const themes = normalizeTokens(candidate?.themeIds, FRIEND_CHALLENGE_THEMES);
    if (!themes) return { valid: false, reason: 'themes' };
    const rules = normalizeTokens(candidate?.enabledRules, FRIEND_CHALLENGE_RULES);
    if (!rules) return { valid: false, reason: 'rules' };
    if (!FRIEND_CHALLENGE_DURATIONS.includes(candidate?.durationMs as FriendChallengeDurationMs)) return { valid: false, reason: 'duration' };
    if (themes.some((theme) => legalRuleSetsForTheme(theme, rules).length === 0)) return { valid: false, reason: 'incompatible' };
    return { valid: true, config: { themeIds: themes, enabledRules: rules, durationMs: candidate!.durationMs! } };
}

export function createFriendChallengePayload(result: Pick<RunResult, 'entry' | 'score'>): FriendChallengePayload {
    if (!result.entry.challengeConfig) {
        return {
            v: 1, seed: result.entry.seed, contentVersion: result.entry.contentVersion, mode: 'brawl60',
            recipeId: result.entry.recipeId ?? 'mixed', targetScore: Math.max(0, Math.floor(result.score)),
        };
    }
    const normalized = normalizeFriendChallengeConfig(result.entry.challengeConfig);
    if (!normalized.valid) throw new Error(`Cannot share invalid friend challenge config: ${'reason' in normalized ? normalized.reason : 'unknown'}`);
    return {
        v: 2, seed: result.entry.seed, contentVersion: result.entry.contentVersion, mode: 'friendChallenge',
        config: normalized.config, targetScore: Math.max(0, Math.floor(result.score)),
    };
}

export function encodeFriendChallengeQuery(payload: FriendChallengePayload): string {
    const entries: ReadonlyArray<readonly [string, string | number]> = payload.v === 1
        ? [
            ['v', payload.v], ['mode', payload.mode], ['seed', payload.seed], ['contentVersion', payload.contentVersion],
            ['recipeId', payload.recipeId], ['targetScore', payload.targetScore],
        ]
        : [
            ['v', payload.v], ['mode', payload.mode], ['seed', payload.seed], ['contentVersion', payload.contentVersion],
            ['themes', payload.config.themeIds.join(',')], ['rules', payload.config.enabledRules.join(',')],
            ['duration', payload.config.durationMs], ['targetScore', payload.targetScore],
        ];
    return entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
}

export function parseFriendChallengeQuery(query: Readonly<Record<string, string>> | undefined, currentContentVersion: string): FriendChallengeParseResult {
    if (!query || !looksLikeChallenge(query)) return { status: 'none' };
    if (!validToken(query.contentVersion, MAX_TOKEN_LENGTH)) return { status: 'invalid' };
    if (query.contentVersion !== currentContentVersion) return { status: 'expired' };
    if (!validToken(query.seed, MAX_SEED_LENGTH) || !validTargetScore(query.targetScore)) return { status: 'invalid' };
    if (query.v === '1') return parseV1(query, currentContentVersion);
    if (query.v === '2') return parseV2(query, currentContentVersion);
    return { status: 'invalid' };
}

export function friendTargetPresentation(score: number, targetScore: number): FriendTargetPresentation {
    const normalizedScore = Math.max(0, Math.floor(score));
    const normalizedTarget = Math.max(0, Math.floor(targetScore));
    const scoreDelta = normalizedScore - normalizedTarget;
    if (scoreDelta > 0) return { text: `好友 ${normalizedTarget} · 已超过 ${scoreDelta}`, tone: 'ahead', scoreDelta };
    if (scoreDelta === 0) return { text: `好友 ${normalizedTarget} · 已追平`, tone: 'tied', scoreDelta };
    return { text: `好友目标 ${normalizedTarget} · 还差 ${Math.abs(scoreDelta)}`, tone: 'behind', scoreDelta };
}

export function canStartFriendChallenge(entry: GameEntryParams): boolean {
    if (entry.mode !== 'friendChallenge' || !validToken(entry.seed, MAX_SEED_LENGTH) || !validToken(entry.contentVersion, MAX_TOKEN_LENGTH)) return false;
    if (!entry.challengeConfig) return (entry.challengeRole === undefined || entry.challengeRole === 'responder') && validNumericTarget(entry.targetScore);
    if (!normalizeFriendChallengeConfig(entry.challengeConfig).valid) return false;
    return entry.challengeRole === 'creator'
        ? entry.targetScore === undefined
        : entry.challengeRole === 'responder' && validNumericTarget(entry.targetScore);
}

export function friendChallengeConfigSummary(config: FriendChallengeConfig): { themes: string; rules: string; duration: string } {
    const themeLabels: Record<ThemeId, string> = { math: '数学', vision: '眼力', english: '英语', hanzi: '汉字', geography: '地理', life: '生活', knowledge: '常识', history: '历史' };
    const ruleLabels: Record<RuleId, string> = { standard: '标准', reverse: '反向', rotate: '旋转', multi: '多选', order: '顺序', bomb: '炸弹' };
    return {
        themes: config.themeIds.length === FRIEND_CHALLENGE_THEMES.length ? '全部题库 · 乱斗' : config.themeIds.map((theme) => themeLabels[theme]).join('、'),
        rules: config.enabledRules.length === FRIEND_CHALLENGE_RULES.length ? '全部规则' : config.enabledRules.map((rule) => ruleLabels[rule]).join('、'),
        duration: `${config.durationMs / 1_000} 秒`,
    };
}

function parseV1(query: Readonly<Record<string, string>>, contentVersion: string): FriendChallengeParseResult {
    if (query.mode !== 'brawl60') return { status: 'invalid' };
    const recipeId = query.recipeId ?? 'mixed';
    if (!validToken(recipeId, MAX_TOKEN_LENGTH)) return { status: 'invalid' };
    return { status: 'valid', entry: {
        mode: 'friendChallenge', seed: query.seed, contentVersion, recipeId,
        targetScore: Math.floor(Number(query.targetScore)), challengeRole: 'responder',
    } };
}

function parseV2(query: Readonly<Record<string, string>>, contentVersion: string): FriendChallengeParseResult {
    if (query.mode !== 'friendChallenge') return { status: 'invalid' };
    const validation = normalizeFriendChallengeConfig({
        themeIds: splitTokens(query.themes), enabledRules: splitTokens(query.rules), durationMs: Number(query.duration),
    });
    if (!validation.valid) return { status: 'invalid' };
    return { status: 'valid', entry: {
        mode: 'friendChallenge', seed: query.seed, contentVersion, challengeConfig: validation.config,
        challengeRole: 'responder', targetScore: Math.floor(Number(query.targetScore)),
    } };
}

function normalizeTokens<T extends string>(value: unknown, order: readonly T[]): T[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string')) return null;
    const selected = value as string[];
    if (new Set(selected).size !== selected.length || selected.some((item) => !order.includes(item as T))) return null;
    return order.filter((item) => selected.includes(item));
}

function splitTokens(value: string | undefined): string[] | null {
    if (!value || value.trim() !== value) return null;
    const tokens = value.split(',');
    return tokens.some((token) => !token) ? null : tokens;
}

function looksLikeChallenge(query: Readonly<Record<string, string>>): boolean {
    return query.v !== undefined || query.targetScore !== undefined || query.mode === 'friendChallenge' || (query.mode === 'brawl60' && query.seed !== undefined);
}

function validToken(value: string | undefined, maxLength: number): value is string {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function validTargetScore(value: string | undefined): boolean {
    return value !== undefined && value.trim() !== '' && validNumericTarget(Number(value));
}

function validNumericTarget(value: number | undefined): value is number {
    return value !== undefined && Number.isInteger(value) && value >= 0 && value <= MAX_TARGET_SCORE;
}
