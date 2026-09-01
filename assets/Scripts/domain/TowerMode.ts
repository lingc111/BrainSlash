export * from './TowerModeV2';

/* Legacy 30-floor implementation retained only as migration history.
import type { RuleId, RunResult, ThemeId } from './Models';

export const TOWER_LAST_FLOOR = 30;
export const TOWER_DURATION_MS = 60_000;
export const TOWER_SCORING_VERSION = 3;
export const TOWER_COMPOUND_RULE_FLOOR = 6;

export interface TowerActiveRun {
    startFloor: number;
    totalScore: number;
    maxCombo: number;
}

export interface TowerProgress {
    scoringVersion: number;
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
    timeBonus: number;
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
    unlocksCompoundRules?: boolean;
}

export interface TowerCommit {
    progress: TowerProgress;
    result: TowerFloorResult;
}

export const DEFAULT_TOWER_PROGRESS: TowerProgress = {
    scoringVersion: TOWER_SCORING_VERSION,
    currentFloor: 1,
    highestClearedFloor: 0,
    lastCheckpointFloor: 0,
    totalTowerPoints: 0,
    bestContinuousScore: 0,
    maxCombo: 0,
    chapterOneCompleted: false,
};

const RULE_UNLOCKS: readonly { floor: number; rule: Exclude<RuleId, 'standard'> }[] = [
    { floor: 2, rule: 'multi' },
    { floor: 3, rule: 'order' },
    { floor: 4, rule: 'reverse' },
    { floor: 5, rule: 'rotate' },
];

const DOUBLE_RULES: readonly (readonly RuleId[])[] = [
    ['bomb', 'multi'],
    ['bomb', 'order'],
    ['bomb', 'reverse'],
    ['bomb', 'rotate'],
    ['multi', 'reverse'],
    ['multi', 'rotate'],
    ['order', 'rotate'],
];

export function towerFloorConfig(requestedFloor: number): TowerFloorConfig {
    const floor = clampFloor(requestedFloor);
    if (floor === 1) return makeConfig(floor, 8, 0, 3, 3_000, 0.72, { math: 3, vision: 2 }, [['standard'], ['bomb'], ['standard']]);
    if (floor === 2) return makeConfig(floor, 8, 0, 4, 2_950, 0.76, { math: 3, english: 2, life: 2 }, [['multi'], ['bomb'], ['standard'], ['multi']]);
    if (floor === 3) return makeConfig(floor, 9, 1, 4, 2_900, 0.80, { math: 3, hanzi: 3 }, [['order'], ['bomb'], ['standard'], ['order']]);
    if (floor === 4) return makeConfig(floor, 9, 1, 4, 2_850, 0.84, allThemes(), [['reverse'], ['bomb'], ['standard'], ['reverse']]);
    if (floor === 5) return makeConfig(floor, 9, 1, 4, 2_800, 0.87, allThemes(), [['rotate'], ['bomb'], ['standard'], ['rotate']]);
    if (floor === TOWER_COMPOUND_RULE_FLOOR) return makeConfig(floor, 9, 1, 4, 2_750, 0.88, allThemes(), DOUBLE_RULES);
    if (floor <= 9) return makeConfig(floor, 10, 1, 4, 2_700, 0.90, allThemes(), [...DOUBLE_RULES, ['standard'], ['bomb'], ['multi'], ['order'], ['reverse'], ['rotate']]);
    if (floor <= 13) return makeConfig(floor, 10, 1, 4, 2_600, 1.00, allThemes(), [...DOUBLE_RULES, ['standard'], ['bomb'], ['multi'], ['order'], ['reverse'], ['rotate']]);
    if (floor === 14) return makeConfig(floor, 10, 1, 4, 2_600, 1.00, { vision: 5 }, [['standard'], ['bomb'], ['standard']], ['vision-stroop']);
    if (floor <= 19) return makeConfig(floor, 11, 2, 4, 2_500, 1.05, allThemes(), DOUBLE_RULES);
    if (floor <= 24) return makeConfig(floor, 12, 2, 5, 2_350, 1.12, allThemes(), [...DOUBLE_RULES, ['reverse'], ['rotate'], ['multi'], ['order']]);
    if (floor <= 29) return makeConfig(floor, 13, 2, 5, 2_250, 1.18, allThemes(), [...DOUBLE_RULES, ['bomb', 'reverse'], ['multi', 'reverse']]);
    return makeConfig(floor, 15, 2, 4, 2_100, 1.25, allThemes(), DOUBLE_RULES);
}

export function unlockedRulesForTower(highestClearedFloor: number): RuleId[] {
    // Bombs are a baseline distractor, not a learned slash rule.
    const rules: RuleId[] = ['standard', 'bomb'];
    for (const unlock of RULE_UNLOCKS) if (highestClearedFloor >= unlock.floor) rules.push(unlock.rule);
    return rules;
}

export function allowedBrawlRules(progress: TowerProgress, tutorials: Readonly<Partial<Record<RuleId, boolean>>>): ReadonlySet<RuleId> {
    const result = new Set<RuleId>(unlockedRulesForTower(progress.highestClearedFloor));
    for (const rule of ['reverse', 'rotate', 'multi', 'order'] as const) if (tutorials[rule]) result.add(rule);
    return result;
}

export function nextTowerUnlock(currentFloor: number): { floor: number; label: string } | null {
    const next = RULE_UNLOCKS.find((unlock) => unlock.floor > currentFloor);
    if (next) return { floor: next.floor, label: towerRuleLabel(next.rule) };
    if (currentFloor < TOWER_COMPOUND_RULE_FLOOR) return { floor: TOWER_COMPOUND_RULE_FLOOR, label: '双规则' };
    if (currentFloor < 30) return { floor: 30, label: '首章终点' };
    return null;
}

export function towerRuleLabel(rule: RuleId): string {
    return ({ standard: '单选', reverse: '反向', rotate: '旋转', multi: '多选', order: '顺序', bomb: '禁区' } as const)[rule];
}

export function towerFloorLabel(floor: number): string {
    const config = towerFloorConfig(floor);
    if (floor === 30) return '首章终点';
    if (floor === 14) return '颜色题';
    if (config.unlockedRule) return towerRuleLabel(config.unlockedRule);
    if (floor >= TOWER_COMPOUND_RULE_FLOOR) return floor >= 25 ? '精英混合' : '双规则试炼';
    return config.ruleSequence.some((rules) => rules.includes('order')) ? '顺序试炼'
        : config.ruleSequence.some((rules) => rules.includes('reverse')) ? '反向试炼'
        : config.ruleSequence.some((rules) => rules.includes('rotate')) ? '旋转试炼'
        : config.ruleSequence.some((rules) => rules.includes('multi')) ? '多选试炼' : '基础试炼';
}

export function commitTowerFloor(progressBefore: TowerProgress, run: RunResult, life: number): TowerCommit {
    const floor = clampFloor(run.entry.towerFloor ?? progressBefore.currentFloor);
    const config = towerFloorConfig(floor);
    // Gameplay ends as soon as the target is reached; remaining time is kept
    // on the run result and converted into a clear-speed bonus.
    const cleared = run.correctCount >= config.requiredCorrect;
    const firstClear = cleared && floor > progressBefore.highestClearedFloor;
    const timeBonus = cleared ? towerTimeBonus(run.remainingMs) : 0;
    const towerPointsGained = cleared ? towerPointsForClear(run.score, floor, firstClear, run.remainingMs) : 0;
    const activeRun = progressBefore.activeRun ?? { startFloor: floor, totalScore: 0, maxCombo: 0 };
    // The run summary tracks normalized tower points. Raw battle scores remain
    // useful per floor, but summing them across 30 floors creates unreadable totals.
    const runTotalScore = cleared ? activeRun.totalScore + towerPointsGained : activeRun.totalScore;
    const runMaxCombo = Math.max(activeRun.maxCombo, run.maxCombo);
    const highestClearedFloor = firstClear ? floor : progressBefore.highestClearedFloor;
    const checkpointReached = firstClear && floor % 5 === 0;
    const chapterOneCompleted = progressBefore.chapterOneCompleted || (cleared && floor === TOWER_LAST_FLOOR);
    const runFinished = chapterOneCompleted && cleared && floor === TOWER_LAST_FLOOR;
    const progress: TowerProgress = {
        scoringVersion: TOWER_SCORING_VERSION,
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
            timeBonus,
            totalTowerPoints: progress.totalTowerPoints,
            runTotalScore,
            highestClearedFloor: progress.highestClearedFloor,
            checkpointReached,
            chapterOneCompleted,
            unlockedRule: firstClear ? config.unlockedRule : undefined,
            unlockedLabel: firstClear ? (config.unlocksCompoundRules ? '双规则' : config.unlockedRule ? towerRuleLabel(config.unlockedRule) : undefined) : undefined,
        },
    };
}

export function normalizeTowerProgress(value: unknown): TowerProgress {
    const candidate = value as Partial<TowerProgress> | null | undefined;
    if (!candidate || !integerIn(candidate.currentFloor, 1, TOWER_LAST_FLOOR) || !integerIn(candidate.highestClearedFloor, 0, TOWER_LAST_FLOOR)) {
        return cloneTower(DEFAULT_TOWER_PROGRESS);
    }
    const highest = candidate.highestClearedFloor!;
    const legacyScoring = candidate.scoringVersion !== TOWER_SCORING_VERSION;
    const checkpoint = integerIn(candidate.lastCheckpointFloor, 0, TOWER_LAST_FLOOR)
        ? Math.min(candidate.lastCheckpointFloor!, Math.floor(highest / 5) * 5) : Math.floor(highest / 5) * 5;
    const normalized: TowerProgress = {
        scoringVersion: TOWER_SCORING_VERSION,
        currentFloor: candidate.currentFloor!,
        highestClearedFloor: highest,
        lastCheckpointFloor: checkpoint,
        totalTowerPoints: legacyScoring ? estimatedLegacyPoints(1, highest) : nonNegative(candidate.totalTowerPoints),
        bestContinuousScore: legacyScoring && nonNegative(candidate.bestContinuousScore) > 0
            ? estimatedLegacyPoints(1, highest) : nonNegative(candidate.bestContinuousScore),
        maxCombo: nonNegative(candidate.maxCombo),
        chapterOneCompleted: candidate.chapterOneCompleted === true && highest === TOWER_LAST_FLOOR,
    };
    if (validActiveRun(candidate.activeRun)) {
        normalized.activeRun = {
            ...candidate.activeRun,
            totalScore: legacyScoring ? estimatedLegacyPoints(candidate.activeRun.startFloor, highest) : candidate.activeRun.totalScore,
        };
    }
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
        themeWeights, ruleSequence,
        unlockedRule: RULE_UNLOCKS.find((unlock) => unlock.floor === floor)?.rule,
        unlocksCompoundRules: floor === TOWER_COMPOUND_RULE_FLOOR,
    };
}

function allThemes(): Readonly<Partial<Record<ThemeId, number>>> {
    return { math: 3, vision: 3, hanzi: 2, english: 2, life: 1, geography: 1, knowledge: 2, history: 2 };
}

export function towerTimeBonus(remainingMs: number | undefined): number {
    const seconds = Math.max(0, Math.min(60, Math.floor((remainingMs ?? 0) / 1_000)));
    return seconds * 2;
}

export function towerPointsForClear(score: number, floor: number, firstClear: boolean, remainingMs = 0): number {
    const safeScore = Math.max(0, Math.floor(score));
    const safeFloor = clampFloor(floor);
    const remainingSeconds = Math.max(0, Math.min(60, Math.floor(remainingMs / 1_000)));
    if (!firstClear) return Math.min(30, Math.floor(safeScore / 250)) + Math.min(20, Math.floor(remainingSeconds / 3));
    const performanceBonus = Math.min(50, Math.floor(safeScore / 100));
    return 100 + safeFloor * 10 + performanceBonus + towerTimeBonus(remainingMs);
}

function estimatedLegacyPoints(startFloor: number, highestFloor: number): number {
    const start = clampFloor(startFloor);
    const end = Math.max(0, Math.min(TOWER_LAST_FLOOR, Math.floor(highestFloor || 0)));
    if (end < start) return 0;
    let result = 0;
    // Thirty performance points and sixty time points approximate a healthy clear while
    // preserving cleared-floor progress during the one-time score migration.
    for (let floor = start; floor <= end; floor++) result += 100 + floor * 10 + 30 + 60;
    return result;
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
*/
