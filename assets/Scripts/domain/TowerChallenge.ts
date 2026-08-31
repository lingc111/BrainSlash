import type { FailureKind, GameSessionState, RuleId, ThemeId } from './Models';
import { SeededRng } from './SeededRng';
import type { QuestionCapability } from './QuestionSystem';

export const TOWER_CHALLENGE_VERSION = 1;

export interface TowerQuestionPool {
    themes?: readonly ThemeId[];
    requiredCapabilities?: readonly QuestionCapability[];
    forbiddenCapabilities?: readonly QuestionCapability[];
    requiredTags?: readonly string[];
    allowedRuleSets?: readonly (readonly RuleId[])[];
    requiredRules?: readonly RuleId[];
    forbiddenRules?: readonly RuleId[];
    minimumComplexRuleCount?: number;
    masterSlashEligible?: boolean;
    bombPolicy?: 'required' | 'forbidden' | 'optional';
}

export interface TowerQuotaLane {
    id: string;
    label: string;
    requiredSuccesses: number;
    pool: TowerQuestionPool;
}

export type TowerEncounter =
    | { type: 'pool'; pool: TowerQuestionPool }
    | { type: 'quotaDeck'; order: 'balanced'; lanes: readonly TowerQuotaLane[]; fallbackPool?: TowerQuestionPool };

export type TowerObjective =
    | { type: 'encounterComplete'; label: string }
    | { type: 'correct'; target: number; label: string }
    | { type: 'maxCombo'; target: number; label: string }
    | { type: 'masterSlash'; target: number; label: string };

export type TowerConstraint =
    | { type: 'maxErrors'; limit: number; label: string }
    | { type: 'maxElapsedMs'; limit: number; label: string }
    | { type: 'maxBombHits'; limit: number; label: string }
    | { type: 'maxMisses'; limit: number; label: string }
    | { type: 'maxLifeLost'; limit: number; label: string };

export interface TowerChallengeConfig {
    encounter: TowerEncounter;
    objectives: readonly TowerObjective[];
    constraints?: readonly TowerConstraint[];
    openingHint?: string;
}

export interface TowerQuestionRequest {
    requestId: string;
    laneId?: string;
    pool: TowerQuestionPool;
}

export interface TowerChallengeProgressItem {
    label: string;
    current: number;
    target: number;
    passed: boolean;
    kind: 'objective' | 'constraint';
}

export type TowerChallengeFailureReason = 'constraintViolated' | 'lifeDepleted' | 'timeExpired' | 'objectiveIncomplete';

export interface TowerChallengeSnapshot {
    version: number;
    status: 'active' | 'cleared' | 'failed';
    objectiveProgress: readonly TowerChallengeProgressItem[];
    laneSuccesses: Readonly<Record<string, number>>;
    encounterCompleted: boolean;
    bombHits: number;
    misses: number;
    lifeLost: number;
    failureReason?: TowerChallengeFailureReason;
    failureLabel?: string;
}

export class TowerChallengeRuntime {
    private readonly deck: TowerQuotaLane[];
    private readonly laneSuccesses: Record<string, number> = {};
    private deckIndex = 0;
    private requestIndex = 0;
    private currentRequest?: TowerQuestionRequest;
    private bombHits = 0;
    private misses = 0;
    private lifeLost = 0;
    private terminal?: TowerChallengeSnapshot;

    public constructor(public readonly config: TowerChallengeConfig, rng: SeededRng) {
        this.deck = config.encounter.type === 'quotaDeck' ? balancedDeck(config.encounter.lanes, rng) : [];
        if (config.encounter.type === 'quotaDeck') for (const lane of config.encounter.lanes) this.laneSuccesses[lane.id] = 0;
    }

    public nextRequest(): TowerQuestionRequest {
        if (this.terminal) throw new Error('Tower challenge already finished');
        if (this.currentRequest) return this.currentRequest;
        const encounter = this.config.encounter;
        let lane: TowerQuotaLane | undefined;
        let pool: TowerQuestionPool;
        if (encounter.type === 'pool') pool = encounter.pool;
        else {
            lane = this.deck[this.deckIndex];
            pool = lane?.pool ?? encounter.fallbackPool ?? encounter.lanes[0]?.pool;
            if (!pool) throw new Error('Tower quota encounter has no available question pool');
        }
        this.currentRequest = { requestId: `tower-question-${++this.requestIndex}`, laneId: lane?.id, pool };
        return this.currentRequest;
    }

    public resolve(requestId: string, success: boolean, state: GameSessionState, failureKind?: FailureKind): TowerChallengeSnapshot {
        if (this.terminal) return this.terminal;
        if (!this.currentRequest || this.currentRequest.requestId !== requestId) throw new Error(`Unexpected tower request ${requestId}`);
        if (success && this.currentRequest.laneId && this.deckIndex < this.deck.length) {
            this.laneSuccesses[this.currentRequest.laneId] = (this.laneSuccesses[this.currentRequest.laneId] ?? 0) + 1;
            this.deckIndex += 1;
        }
        if (!success) {
            if (failureKind === 'bomb') this.bombHits += 1;
            if (failureKind === 'miss') this.misses += 1;
        }
        this.lifeLost = Math.max(this.lifeLost, state.maxLife - state.life);
        this.currentRequest = undefined;
        return this.evaluate(state, false);
    }

    public tick(state: GameSessionState): TowerChallengeSnapshot {
        if (this.terminal) return this.terminal;
        this.lifeLost = Math.max(this.lifeLost, state.maxLife - state.life);
        return this.evaluate(state, state.remainingMs <= 0);
    }

    public snapshot(state: GameSessionState): TowerChallengeSnapshot {
        return this.terminal ?? this.evaluate(state, state.remainingMs <= 0);
    }

    private evaluate(state: GameSessionState, timeExpired: boolean): TowerChallengeSnapshot {
        const encounterCompleted = this.config.encounter.type === 'pool' || this.deckIndex >= this.deck.length;
        const objectiveProgress = this.config.objectives.map((objective): TowerChallengeProgressItem => {
            const current = objectiveValue(objective, state, encounterCompleted);
            const target = objective.type === 'encounterComplete' ? 1 : objective.target;
            return { label: objective.label, current, target, passed: current >= target, kind: 'objective' };
        });
        const constraintProgress = (this.config.constraints ?? []).map((constraint): TowerChallengeProgressItem => {
            const rawCurrent = constraintValue(constraint, state, this.bombHits, this.misses, this.lifeLost);
            const current = constraint.type === 'maxElapsedMs' ? Math.ceil(rawCurrent / 1_000) : rawCurrent;
            const target = constraint.type === 'maxElapsedMs' ? Math.ceil(constraint.limit / 1_000) : constraint.limit;
            return { label: constraint.label, current, target, passed: rawCurrent <= constraint.limit, kind: 'constraint' };
        });
        const laneProgress: TowerChallengeProgressItem[] = this.config.encounter.type === 'quotaDeck'
            ? this.config.encounter.lanes.map((lane) => ({
                label: lane.label, current: this.laneSuccesses[lane.id] ?? 0, target: lane.requiredSuccesses,
                passed: (this.laneSuccesses[lane.id] ?? 0) >= lane.requiredSuccesses, kind: 'objective' as const,
            })) : [];
        const progress = [...laneProgress, ...objectiveProgress.filter((item) => item.label !== '完成全部专项题'), ...constraintProgress];
        const violated = constraintProgress.find((item) => !item.passed);
        const cleared = objectiveProgress.every((item) => item.passed) && !violated;
        let status: TowerChallengeSnapshot['status'] = cleared ? 'cleared' : 'active';
        let failureReason: TowerChallengeFailureReason | undefined;
        let failureLabel: string | undefined;
        if (!cleared && violated) {
            status = 'failed'; failureReason = 'constraintViolated'; failureLabel = violated.label;
        } else if (!cleared && state.life <= 0) {
            status = 'failed'; failureReason = 'lifeDepleted'; failureLabel = '生命耗尽';
        } else if (!cleared && timeExpired) {
            status = 'failed'; failureReason = 'timeExpired'; failureLabel = objectiveProgress.find((item) => !item.passed)?.label ?? '目标未完成';
        }
        const snapshot: TowerChallengeSnapshot = {
            version: TOWER_CHALLENGE_VERSION, status, objectiveProgress: progress,
            laneSuccesses: { ...this.laneSuccesses }, encounterCompleted, bombHits: this.bombHits, misses: this.misses, lifeLost: this.lifeLost,
            failureReason, failureLabel,
        };
        if (status !== 'active') this.terminal = snapshot;
        return snapshot;
    }
}

export function towerChallengeSummary(config: TowerChallengeConfig): string {
    const supply = config.encounter.type === 'quotaDeck'
        ? config.encounter.lanes.map((lane) => `${lane.label}${lane.requiredSuccesses}题`) : [];
    const objectives = config.objectives.filter((item) => item.type !== 'encounterComplete').map((item) => item.label);
    const constraints = (config.constraints ?? []).map((item) => item.label);
    return [...supply, ...objectives, ...constraints].join(' · ');
}

export function validateTowerChallenge(config: TowerChallengeConfig, towerMaxLife = 5): string[] {
    const errors: string[] = [];
    if (!config.objectives.length) errors.push('challenge requires at least one objective');
    if (config.encounter.type === 'quotaDeck') {
        if (!config.encounter.lanes.length) errors.push('quota deck requires lanes');
        const ids = new Set<string>();
        for (const lane of config.encounter.lanes) {
            if (!lane.id || ids.has(lane.id)) errors.push(`duplicate or empty lane id: ${lane.id}`);
            ids.add(lane.id);
            if (!Number.isInteger(lane.requiredSuccesses) || lane.requiredSuccesses <= 0) errors.push(`invalid quota for ${lane.id}`);
        }
    }
    for (const constraint of config.constraints ?? []) {
        if (constraint.limit < 0) errors.push(`negative constraint ${constraint.type}`);
        if (constraint.type === 'maxErrors' && constraint.limit >= towerMaxLife) errors.push('maxErrors must be lower than tower life');
    }
    return errors;
}

function objectiveValue(objective: TowerObjective, state: GameSessionState, encounterCompleted: boolean): number {
    switch (objective.type) {
        case 'encounterComplete': return encounterCompleted ? 1 : 0;
        case 'correct': return state.correctCount;
        case 'maxCombo': return state.maxCombo;
        case 'masterSlash': return state.masterSlashCount;
    }
}

function constraintValue(constraint: TowerConstraint, state: GameSessionState, bombHits: number, misses: number, lifeLost: number): number {
    switch (constraint.type) {
        case 'maxErrors': return state.errorCount;
        case 'maxElapsedMs': return state.elapsedMs;
        case 'maxBombHits': return bombHits;
        case 'maxMisses': return misses;
        case 'maxLifeLost': return lifeLost;
    }
}

function balancedDeck(lanes: readonly TowerQuotaLane[], rng: SeededRng): TowerQuotaLane[] {
    const remaining = new Map(lanes.map((lane) => [lane.id, lane.requiredSuccesses]));
    const result: TowerQuotaLane[] = [];
    while ([...remaining.values()].some((count) => count > 0)) {
        const round = rng.shuffle(lanes.filter((lane) => (remaining.get(lane.id) ?? 0) > 0));
        for (const lane of round) {
            result.push(lane);
            remaining.set(lane.id, (remaining.get(lane.id) ?? 0) - 1);
        }
    }
    return result;
}
