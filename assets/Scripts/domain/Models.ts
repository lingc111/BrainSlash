export type GameMode = 'brawl60' | 'daily' | 'friendChallenge' | 'tower';
export type ThemeId = 'math' | 'vision' | 'english' | 'hanzi' | 'geography' | 'life' | 'knowledge' | 'history';
export type RuleId = 'standard' | 'reverse' | 'rotate' | 'multi' | 'order' | 'bomb';
export type GameplayEngineId =
    | 'single' | 'multi' | 'double' | 'inverse' | 'odd-one-out' | 'same'
    | 'pair' | 'order' | 'sequence' | 'fill' | 'truth' | 'compare'
    | 'count' | 'condition';
export type FriendChallengeDurationMs = 60_000 | 90_000 | 120_000;
export type FriendChallengeRole = 'creator' | 'responder';
export type SessionPhase = 'ready' | 'playing' | 'resolving' | 'finished';

export interface FriendChallengeConfig {
    themeIds: ThemeId[];
    enabledRules: RuleId[];
    durationMs: FriendChallengeDurationMs;
}
export interface GameEntryParams {
    mode: GameMode; seed: string; contentVersion: string; recipeId?: string; targetScore?: number;
    challengeConfig?: FriendChallengeConfig; challengeRole?: FriendChallengeRole;
    dailyDate?: string; dailyTheme?: ThemeId; dailyTargetScore?: number; towerFloor?: number;
}
export interface PromptSpec { text: string; }
export type TargetAttributeValue = string | number | boolean;
export interface TargetSpec {
    id: string;
    text: string;
    value?: string | number;
    colorName?: string;
    isBomb?: boolean;
    /** Semantic attributes are compiled into answer ids before gameplay starts. */
    attributes?: Readonly<Record<string, TargetAttributeValue>>;
}
export interface QuestionInstance {
    id: string; templateId: string; contentVersion: string; engineId: GameplayEngineId; theme: ThemeId; factIds: string[]; prompt: PromptSpec; targets: TargetSpec[];
    baseCorrectTargetIds: string[]; orderedTargetIds?: string[]; activeRules: RuleId[];
    timeLimitMs: number;
}
export interface ActionConstraint { requiredTargetIds: string[]; forbiddenTargetIds: string[]; matchMode: 'any' | 'all'; ordered: boolean; allowExtraHits: boolean; }
export interface GameSessionState {
    sessionId: string; seed: string; mode: GameMode; contentVersion: string;
    elapsedMs: number; remainingMs: number; life: number; maxLife: number; score: number; combo: number; maxCombo: number;
    correctCount: number; errorCount: number; bestReactionMs?: number; masterSlashCount: number; phase: SessionPhase;
}
export type FailureKind = 'wrong' | 'bomb' | 'miss' | 'orderError';
export interface MistakeRecord {
    questionId: string;
    prompt: string;
    ruleLabel: string;
    failureKind: FailureKind;
    selectedAnswer: string;
    correctAnswer: string;
}
export type HitResult =
    | { kind: 'correct' | 'master' | 'masterSlash'; scoreDelta: number; reactionMs: number; lifeDelta: 0 | 1; masterHit: boolean; masterSlash: boolean }
    | { kind: FailureKind; lifeDelta: -1 };
export interface PlayerProgress { level: number; xp: number; bestScore: number; }
export interface RunResult {
    entry: GameEntryParams; score: number; maxCombo: number; correctCount: number; errorCount: number;
    accuracy: number; bestReactionMs?: number; remainingMs?: number; elapsedMs?: number; masterSlashCount?: number; mistakes?: MistakeRecord[];
}
export interface ResultGrowth {
    xpGained: number; levelBefore: number; levelAfter: number;
    levelProgressBefore: number; levelProgressAfter: number; levelTarget: number;
}
export interface FriendChallengeResult {
    targetScore: number; scoreDelta: number; outcome: 'won' | 'tied' | 'lost';
}
export interface DailyChallengeResult {
    dateKey: string; recipeId: string; attempts: number; previousBestScore: number; bestScore: number; isNewBest: boolean;
    targetScore: number; targetAchieved: boolean; firstAchievement: boolean;
}
export interface GameResult extends RunResult {
    previousBestScore: number; isNewRecord: boolean; growth: ResultGrowth;
    challenge?: FriendChallengeResult;
    daily?: DailyChallengeResult;
}
export interface FriendChallengePayloadV1 {
    v: 1; seed: string; contentVersion: string; mode: 'brawl60'; recipeId: string; targetScore: number;
}
export interface FriendChallengePayloadV2 {
    v: 2; seed: string; contentVersion: string; mode: 'friendChallenge'; config: FriendChallengeConfig; targetScore: number;
}
export type FriendChallengePayload = FriendChallengePayloadV1 | FriendChallengePayloadV2;
