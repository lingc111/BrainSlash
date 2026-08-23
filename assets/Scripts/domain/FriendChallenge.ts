import type { FriendChallengePayload, GameEntryParams, RunResult } from './Models';

const PAYLOAD_VERSION = '1';
const MAX_SEED_LENGTH = 256;
const MAX_TOKEN_LENGTH = 64;
const MAX_TARGET_SCORE = 100_000_000;

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

export function createFriendChallengePayload(result: Pick<RunResult, 'entry' | 'score'>): FriendChallengePayload {
    return {
        v: 1,
        seed: result.entry.seed,
        contentVersion: result.entry.contentVersion,
        mode: 'brawl60',
        recipeId: result.entry.recipeId ?? 'mixed',
        targetScore: Math.max(0, Math.floor(result.score)),
    };
}

export function encodeFriendChallengeQuery(payload: FriendChallengePayload): string {
    const entries: ReadonlyArray<readonly [string, string | number]> = [
        ['v', payload.v],
        ['mode', payload.mode],
        ['seed', payload.seed],
        ['contentVersion', payload.contentVersion],
        ['recipeId', payload.recipeId],
        ['targetScore', payload.targetScore],
    ];
    return entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&');
}

export function parseFriendChallengeQuery(
    query: Readonly<Record<string, string>> | undefined,
    currentContentVersion: string,
): FriendChallengeParseResult {
    if (!query || !looksLikeChallenge(query)) return { status: 'none' };
    if (query.v !== PAYLOAD_VERSION || query.mode !== 'brawl60') return { status: 'invalid' };
    if (query.contentVersion !== currentContentVersion) return { status: 'expired' };
    if (!validToken(query.seed, MAX_SEED_LENGTH)) return { status: 'invalid' };
    const recipeId = query.recipeId ?? 'mixed';
    if (!validToken(recipeId, MAX_TOKEN_LENGTH)) return { status: 'invalid' };
    if (query.targetScore === undefined || query.targetScore.trim() === '') return { status: 'invalid' };
    const targetScore = Number(query.targetScore);
    if (!Number.isInteger(targetScore) || targetScore < 0 || targetScore > MAX_TARGET_SCORE) return { status: 'invalid' };
    return {
        status: 'valid',
        entry: {
            mode: 'friendChallenge',
            seed: query.seed,
            contentVersion: currentContentVersion,
            recipeId,
            targetScore: Math.floor(targetScore),
        },
    };
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
    return entry.mode === 'friendChallenge'
        && validToken(entry.seed, MAX_SEED_LENGTH)
        && validToken(entry.contentVersion, MAX_TOKEN_LENGTH)
        && entry.targetScore !== undefined
        && Number.isInteger(entry.targetScore)
        && entry.targetScore >= 0
        && entry.targetScore <= MAX_TARGET_SCORE;
}

function looksLikeChallenge(query: Readonly<Record<string, string>>): boolean {
    return query.v !== undefined || query.targetScore !== undefined || (query.mode === 'brawl60' && query.seed !== undefined);
}

function validToken(value: string | undefined, maxLength: number): value is string {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}
