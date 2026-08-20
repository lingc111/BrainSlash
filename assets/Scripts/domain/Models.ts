export type GameMode = 'brawl60' | 'daily' | 'friendChallenge';
export type ThemeId = 'math' | 'vision' | 'english' | 'hanzi' | 'geography' | 'life';
export type RuleId = 'standard' | 'reverse' | 'multi' | 'order' | 'stroop' | 'bomb';
export type SessionPhase = 'ready' | 'playing' | 'resolving' | 'finished';

export interface GameEntryParams { mode: GameMode; seed: string; contentVersion: string; recipeId?: string; targetScore?: number; }
export interface PromptSpec { text: string; }
export interface TargetSpec { id: string; text: string; value?: string | number; colorName?: string; isBomb?: boolean; }
export interface QuestionInstance {
    id: string; theme: ThemeId; familyId?: string; factIds?: string[]; prompt: PromptSpec; targets: TargetSpec[];
    baseCorrectTargetIds: string[]; orderedTargetIds?: string[]; activeRules: RuleId[];
    timeLimitMs: number; tutorialSafe: boolean;
}
export interface ActionConstraint { requiredTargetIds: string[]; forbiddenTargetIds: string[]; matchMode: 'any' | 'all'; ordered: boolean; allowExtraHits: boolean; }
export interface GameSessionState {
    sessionId: string; seed: string; mode: GameMode; contentVersion: string;
    elapsedMs: number; remainingMs: number; life: number; score: number; combo: number; maxCombo: number;
    correctCount: number; errorCount: number; bestReactionMs?: number; phase: SessionPhase;
}
export type FailureKind = 'wrong' | 'bomb' | 'miss' | 'orderError';
export type HitResult =
    | { kind: 'correct' | 'master'; scoreDelta: number; reactionMs: number }
    | { kind: FailureKind; lifeDelta: -1 };
export interface PlayerProgress { level: number; xp: number; bestScore: number; }
export interface RunResult {
    entry: GameEntryParams; score: number; maxCombo: number; correctCount: number; errorCount: number;
    accuracy: number; bestReactionMs?: number;
}
export interface ResultGrowth {
    xpGained: number; levelBefore: number; levelAfter: number;
    levelProgressBefore: number; levelProgressAfter: number; levelTarget: number;
}
export interface FriendChallengeResult {
    targetScore: number; scoreDelta: number; outcome: 'won' | 'tied' | 'lost';
}
export interface GameResult extends RunResult {
    previousBestScore: number; isNewRecord: boolean; growth: ResultGrowth;
    challenge?: FriendChallengeResult;
}
export interface FriendChallengePayload {
    v: 1; seed: string; contentVersion: string; mode: 'brawl60'; recipeId: string; targetScore: number;
}
