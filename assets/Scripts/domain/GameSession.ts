import type { GameplayConfig } from '../configs/GameConfig';
import type { FailureKind, GameEntryParams, GameSessionState, HitResult, QuestionInstance } from './Models';
import { calculateScore } from './ScoreSystem';

export class GameSession {
    public readonly state: GameSessionState;
    private questionStartedAt = 0;
    private questionResolved = true;
    public constructor(public readonly entry: GameEntryParams, private readonly config: GameplayConfig) {
        this.state = { sessionId: `${entry.seed}-${Date.now()}`, seed: entry.seed, mode: entry.mode, contentVersion: entry.contentVersion, elapsedMs: 0, remainingMs: config.durationMs, life: config.maxLife, score: 0, combo: 0, maxCombo: 0, correctCount: 0, errorCount: 0, phase: 'ready' };
    }
    public start(): void { if (this.state.phase === 'ready') this.state.phase = 'playing'; }
    public tick(deltaMs: number): boolean {
        if (this.state.phase !== 'playing' && this.state.phase !== 'resolving') return false;
        this.state.elapsedMs += deltaMs;
        this.state.remainingMs = Math.max(0, this.config.durationMs - this.state.elapsedMs);
        if (!this.state.remainingMs) this.finish();
        return this.state.remainingMs === 0;
    }
    public beginQuestion(): void { if (this.state.phase === 'playing') { this.questionStartedAt = this.state.elapsedMs; this.questionResolved = false; } }
    public questionElapsedMs(): number { return this.state.elapsedMs - this.questionStartedAt; }
    public isQuestionResolved(): boolean { return this.questionResolved; }
    public resolveSuccess(question: QuestionInstance): Extract<HitResult, { kind: 'correct' | 'master' }> | null {
        if (this.questionResolved || this.state.phase !== 'playing') return null;
        this.questionResolved = true;
        const reactionMs = this.questionElapsedMs(), master = reactionMs <= this.config.masterWindowMs;
        const scoreDelta = calculateScore(this.config, this.state.combo, question.activeRules.filter((rule) => rule !== 'standard').length, master);
        this.state.score += scoreDelta; this.state.combo++; this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo); this.state.correctCount++;
        this.state.bestReactionMs = Math.min(this.state.bestReactionMs ?? reactionMs, reactionMs); this.state.phase = 'resolving';
        return { kind: master ? 'master' : 'correct', scoreDelta, reactionMs };
    }
    public resolveFailure(kind: FailureKind): Extract<HitResult, { kind: FailureKind }> | null {
        if (this.questionResolved || this.state.phase !== 'playing') return null;
        this.questionResolved = true; this.state.combo = 0; this.state.errorCount++; this.state.life = Math.max(0, this.state.life - 1);
        this.state.phase = this.state.life ? 'resolving' : 'finished';
        return { kind, lifeDelta: -1 };
    }
    public continueAfterFeedback(): void { if (this.state.phase === 'resolving') this.state.phase = 'playing'; }
    public cancelQuestion(): void { if (!this.questionResolved && this.state.phase === 'playing') { this.questionResolved = true; this.state.phase = 'resolving'; } }
    public retryQuestion(): boolean {
        if (this.state.phase !== 'resolving' || !this.questionResolved) return false;
        this.state.phase = 'playing'; this.questionStartedAt = this.state.elapsedMs; this.questionResolved = false;
        return true;
    }
    public finish(): void { this.state.phase = 'finished'; this.questionResolved = true; }
}
