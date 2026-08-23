import type { RuleId, RunResult, ThemeId } from './Models';

export const TOWER_LAST_FLOOR = 30;
export const TOWER_DURATION_MS = 60_000;

export interface TowerActiveRun {
    startFloor: number;
    totalScore: number;
    maxCombo: number;
}

export interface TowerProgress {
    currentFloor: number;
    highestClearedFloor: number;
    lastCheckpointFloor: number;
    totalTowerPoints: number;
    bestContinuousScore: number;
    maxCombo: number;
    chapterOneCompleted: boolean;
    activeRun?: TowerActiveRun;
}

export type TowerFloorFailureReason = 'lifeDepleted' | 'targetMissed';

export interface TowerFloorResult extends RunResult {
    floor: number;
    cleared: boolean;
    failureReason?: TowerFloorFailureReason;
    requiredCorrect: number;
    firstClear: boolean;
    towerPointsGained: number;
    totalTowerPoints: number;
    runTotalScore: number;
    highestClearedFloor: number;
    checkpointReached: boolean;
    chapterOneCompleted: boolean;
    unlockedRule?: Exclude<RuleId, 'standard'>;
    unlockedLabel?: string;
}

export interface TowerFloorConfig {
    floor: number;
    durationMs: number;
    requiredCorrect: number;
    difficultyStage: 0 | 1 | 2;
    targetCount: number;
    questionTimeMs: number;
    speed: number;
    themeWeights: Readonly<Partial<Record<ThemeId, number>>>;
    ruleSequence: readonly (readonly RuleId[])[];
    unlockedRule?: Exclude<RuleId, 'standard'>;
}

export interface TowerCommit {
    progress: TowerProgress;
    result: TowerFloorResult;
}

export const DEFAULT_TOWER_PROGRESS: TowerProgress = {
    currentFloor: 1,
    highestClearedFloor: 0,
    lastCheckpointFloor: 0,
    totalTowerPoints: 0,
    bestContinuousScore: 0,
    maxCombo: 0,
    chapterOneCompleted: false,
};

const RULE_UNLOCKS: readonly { floor: number; rule: Exclude<RuleId, 'standard'> }[] = [
    { floor: 3, rule: 'bomb' },
    { floor: 5, rule: 'multi' },
    { floor: 7, rule: 'order' },
    { floor: 10, rule: 'reverse' },
    { floor: 13, rule: 'stroop' },
];

const DOUBLE_RULES: readonly (readonly RuleId[])[] = [
    ['bomb', 'multi'],
    ['bomb', 'order'],
    ['bomb', 'reverse'],
    ['bomb', 'stroop'],
    ['multi', 'reverse'],
];

export function towerFloorConfig(requestedFloor: number): TowerFloorConfig {
    const floor = clampFloor(requestedFloor);
    if (floor <= 2) return makeConfig(floor, 8, 0, 3, 3_000, 0.72, { math: 3, vision: 2 }, [['standard']]);
    if (floor <= 4) return makeConfig(floor, 9, 0, 3, 2_950, 0.78, { math: 3, vision: 2, life: 1 }, [['bomb'], ['standard'], ['bomb']]);
    if (floor <= 6) return makeConfig(floor, 9, 1, 4, 2_800, 0.85, { math: 3, english: 2, life: 2 }, [['multi'], ['bomb'], ['multi']]);
    if (floor <= 9) return makeConfig(floor, 10, 1, 4, 2_700, 0.90, { math: 3, hanzi: 3 }, [['order'], ['multi'], ['bomb'], ['order']]);
    if (floor <= 12) return makeConfig(floor, 10, 1, 4, 2_650, 0.95, allThemes(), [['reverse'], ['bomb'], ['multi'], ['reverse']]);
    if (floor <= 14) return makeConfig(floor, 10, 1, 4, 2_600, 1.00, { vision: 5 }, [['stroop'], ['bomb'], ['stroop']]);
    if (floor <= 19) return makeConfig(floor, 11, 2, 4, 2_500, 1.05, allThemes(), DOUBLE_RULES);
    if (floor <= 24) return makeConfig(floor, 12, 2, 5, 2_350, 1.12, allThemes(), [...DOUBLE_RULES, ['reverse'], ['multi'], ['order'], ['stroop']]);
    if (floor <= 29) return makeConfig(floor, 13, 2, 5, 2_250, 1.18, allThemes(), [...DOUBLE_RULES, ['bomb', 'reverse'], ['multi', 'reverse']]);
    return makeConfig(floor, 15, 2, 4, 2_100, 1.25, allThemes(), DOUBLE_RULES);
}

export function unlockedRulesForTower(highestClearedFloor: number): RuleId[] {
    const rules: RuleId[] = ['standard'];
    for (const unlock of RULE_UNLOCKS) if (highestClearedFloor >= unlock.floor) rules.push(unlock.rule);
    return rules;
}

export function allowedBrawlRules(progress: TowerProgress, tutorials: Readonly<Partial<Record<RuleId, boolean>>>): ReadonlySet<RuleId> {
    const result = new Set<RuleId>(unlockedRulesForTower(progress.highestClearedFloor));
    for (const rule of ['reverse', 'multi', 'order', 'stroop', 'bomb'] as const) if (tutorials[rule]) result.add(rule);
    return result;
}

export function nextTowerUnlock(currentFloor: number): { floor: number; label: string } | null {
    const next = RULE_UNLOCKS.find((unlock) => unlock.floor > currentFloor);
    if (next) return { floor: next.floor, label: towerRuleLabel(next.rule) };
    if (currentFloor < 15) return { floor: 15, label: '双规则' };
    if (currentFloor < 30) return { floor: 30, label: '首章终点' };
    return null;
}

export function towerRuleLabel(rule: RuleId): string {
    return ({ standard: '单选', reverse: '反向', multi: '多选', order: '顺序', stroop: '颜色骗局', bomb: '禁区' } as const)[rule];
}

export function towerFloorLabel(floor: number): string {
    const config = towerFloorConfig(floor);
    if (floor === 30) return '首章终点';
    if (config.unlockedRule) return towerRuleLabel(config.unlockedRule);
    if (floor >= 15) return floor >= 25 ? '精英混合' : '双规则试炼';
    return config.ruleSequence.some((rules) => rules.includes('order')) ? '顺序试炼'
        : config.ruleSequence.some((rules) => rules.includes('reverse')) ? '反向试炼'
        : config.ruleSequence.some((rules) => rules.includes('stroop')) ? '颜色试炼'
        : config.ruleSequence.some((rules) => rules.includes('multi')) ? '多选试炼'
        : config.ruleSequence.some((rules) => rules.includes('bomb')) ? '禁区试炼' : '基础试炼';
}

export function commitTowerFloor(progressBefore: TowerProgress, run: RunResult, life: number): TowerCommit {
    const floor = clampFloor(run.entry.towerFloor ?? progressBefore.currentFloor);
    const config = towerFloorConfig(floor);
    // Reaching the floor target secures the clear. Remaining time is a bonus
    // scoring window, so losing the last life afterwards must not revoke it.
    const cleared = run.correctCount >= config.requiredCorrect;
    const firstClear = cleared && floor > progressBefore.highestClearedFloor;
    const towerPointsGained = cleared ? towerReward(run.score, floor, firstClear) : 0;
    const activeRun = progressBefore.activeRun ?? { startFloor: floor, totalScore: 0, maxCombo: 0 };
    const runTotalScore = cleared ? activeRun.totalScore + run.score : activeRun.totalScore;
    const runMaxCombo = Math.max(activeRun.maxCombo, run.maxCombo);
    const highestClearedFloor = firstClear ? floor : progressBefore.highestClearedFloor;
    const checkpointReached = firstClear && floor % 5 === 0;
    const chapterOneCompleted = progressBefore.chapterOneCompleted || (cleared && floor === TOWER_LAST_FLOOR);
    const runFinished = chapterOneCompleted && cleared && floor === TOWER_LAST_FLOOR;
    const progress: TowerProgress = {
        currentFloor: cleared ? Math.min(TOWER_LAST_FLOOR, floor + 1) : floor,
        highestClearedFloor,
        lastCheckpointFloor: checkpointReached ? floor : progressBefore.lastCheckpointFloor,
        totalTowerPoints: progressBefore.totalTowerPoints + towerPointsGained,
        bestContinuousScore: runFinished ? Math.max(progressBefore.bestContinuousScore, runTotalScore) : progressBefore.bestContinuousScore,
        maxCombo: Math.max(progressBefore.maxCombo, runMaxCombo),
        chapterOneCompleted,
        activeRun: runFinished ? undefined : { ...activeRun, totalScore: runTotalScore, maxCombo: runMaxCombo },
    };
    return {
        progress,
        result: {
            ...run,
            floor,
            cleared,
            failureReason: cleared ? undefined : life <= 0 ? 'lifeDepleted' : 'targetMissed',
            requiredCorrect: config.requiredCorrect,
            firstClear,
            towerPointsGained,
            totalTowerPoints: progress.totalTowerPoints,
            runTotalScore,
            highestClearedFloor: progress.highestClearedFloor,
            checkpointReached,
            chapterOneCompleted,
            unlockedRule: firstClear ? config.unlockedRule : undefined,
            unlockedLabel: firstClear ? (floor === 15 ? '双规则' : config.unlockedRule ? towerRuleLabel(config.unlockedRule) : undefined) : undefined,
        },
    };
}

export function normalizeTowerProgress(value: unknown): TowerProgress {
    const candidate = value as Partial<TowerProgress> | null | undefined;
    if (!candidate || !integerIn(candidate.currentFloor, 1, TOWER_LAST_FLOOR) || !integerIn(candidate.highestClearedFloor, 0, TOWER_LAST_FLOOR)) {
        return cloneTower(DEFAULT_TOWER_PROGRESS);
    }
    const highest = candidate.highestClearedFloor!;
    const checkpoint = integerIn(candidate.lastCheckpointFloor, 0, TOWER_LAST_FLOOR)
        ? Math.min(candidate.lastCheckpointFloor!, Math.floor(highest / 5) * 5) : Math.floor(highest / 5) * 5;
    const normalized: TowerProgress = {
        currentFloor: candidate.currentFloor!,
        highestClearedFloor: highest,
        lastCheckpointFloor: checkpoint,
        totalTowerPoints: nonNegative(candidate.totalTowerPoints),
        bestContinuousScore: nonNegative(candidate.bestContinuousScore),
        maxCombo: nonNegative(candidate.maxCombo),
        chapterOneCompleted: candidate.chapterOneCompleted === true && highest === TOWER_LAST_FLOOR,
    };
    if (validActiveRun(candidate.activeRun)) normalized.activeRun = { ...candidate.activeRun };
    return normalized;
}

function makeConfig(
    floor: number,
    requiredCorrect: number,
    difficultyStage: 0 | 1 | 2,
    targetCount: number,
    questionTimeMs: number,
    speed: number,
    themeWeights: Readonly<Partial<Record<ThemeId, number>>>,
    ruleSequence: readonly (readonly RuleId[])[],
): TowerFloorConfig {
    return {
        floor, durationMs: TOWER_DURATION_MS, requiredCorrect, difficultyStage, targetCount, questionTimeMs, speed,
        themeWeights, ruleSequence, unlockedRule: RULE_UNLOCKS.find((unlock) => unlock.floor === floor)?.rule,
    };
}

function allThemes(): Readonly<Partial<Record<ThemeId, number>>> {
    return { math: 3, vision: 3, hanzi: 2, english: 2, life: 1, geography: 1 };
}

function towerReward(score: number, floor: number, firstClear: boolean): number {
    const safeScore = Math.max(0, Math.floor(score));
    return firstClear ? safeScore + 500 + floor * 50 : Math.min(100, Math.floor(safeScore * 0.1));
}

function clampFloor(floor: number): number { return Math.max(1, Math.min(TOWER_LAST_FLOOR, Math.floor(floor || 1))); }
function nonNegative(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; }
function integerIn(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max; }
function validActiveRun(value: unknown): value is TowerActiveRun {
    const run = value as Partial<TowerActiveRun> | null | undefined;
    return !!run && integerIn(run.startFloor, 1, TOWER_LAST_FLOOR)
        && typeof run.totalScore === 'number' && Number.isFinite(run.totalScore) && run.totalScore >= 0
        && typeof run.maxCombo === 'number' && Number.isFinite(run.maxCombo) && run.maxCombo >= 0;
}
function cloneTower(value: TowerProgress): TowerProgress { return JSON.parse(JSON.stringify(value)) as TowerProgress; }
