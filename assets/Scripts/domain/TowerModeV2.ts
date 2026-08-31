import type { RuleId, RunResult, ThemeId } from './Models';
import { TOWER_CHALLENGE_VERSION, towerChallengeSummary, type TowerChallengeConfig, type TowerChallengeProgressItem, type TowerChallengeSnapshot, type TowerConstraint, type TowerObjective, type TowerQuestionPool, type TowerQuotaLane } from './TowerChallenge';

export const TOWER_LAST_FLOOR = 50;
export const TOWER_DURATION_MS = 60_000;
export const TOWER_SCORING_VERSION = 4;
export const TOWER_COMPOUND_RULE_FLOOR = 7;

export interface TowerActiveRun { startFloor: number; totalScore: number; maxCombo: number; }
export interface TowerProgress {
    scoringVersion: number; currentFloor: number; highestClearedFloor: number; totalTowerPoints: number;
    bestContinuousScore: number; maxCombo: number; towerMvpCompleted: boolean; activeRun?: TowerActiveRun;
}
export type TowerFloorFailureReason = 'constraintViolated' | 'lifeDepleted' | 'timeExpired' | 'objectiveIncomplete';
export interface TowerFloorResult extends RunResult {
    floor: number; floorTitle: string; cleared: boolean; failureReason?: TowerFloorFailureReason; failureLabel?: string;
    challengeVersion: number; challengeSummary: string; objectiveProgress: readonly TowerChallengeProgressItem[];
    firstClear: boolean; towerPointsGained: number; timeBonus: number; totalTowerPoints: number; runTotalScore: number;
    highestClearedFloor: number; towerMvpCompleted: boolean; unlockedRule?: Exclude<RuleId, 'standard'>; unlockedLabel?: string;
}
export interface TowerDifficultyConfig {
    stage: 0 | 1 | 2; targetCount: number; questionTimeMs: number; speed: number;
    themeWeights: Readonly<Partial<Record<ThemeId, number>>>;
}
export interface TowerFloorConfig {
    floor: number; title: string; durationMs: number; difficulty: TowerDifficultyConfig; challenge: TowerChallengeConfig;
    unlockedRule?: Exclude<RuleId, 'standard'>; unlocksCompoundRules?: boolean;
}
export interface TowerCommit { progress: TowerProgress; result: TowerFloorResult; }
export const DEFAULT_TOWER_PROGRESS: TowerProgress = {
    scoringVersion: TOWER_SCORING_VERSION, currentFloor: 1, highestClearedFloor: 0, totalTowerPoints: 0,
    bestContinuousScore: 0, maxCombo: 0, towerMvpCompleted: false,
};

const RULE_UNLOCKS: readonly { floor: number; rule: Exclude<RuleId, 'standard'> }[] = [
    { floor: 2, rule: 'multi' }, { floor: 3, rule: 'order' }, { floor: 4, rule: 'reverse' }, { floor: 5, rule: 'rotate' },
];
export const TOWER_DOUBLE_RULES: readonly (readonly RuleId[])[] = [
    ['bomb', 'multi'], ['bomb', 'order'], ['bomb', 'reverse'], ['bomb', 'rotate'],
    ['multi', 'reverse'], ['multi', 'rotate'], ['order', 'rotate'],
];
const SINGLE_RULES: readonly (readonly RuleId[])[] = [['standard'], ['bomb'], ['multi'], ['order'], ['reverse'], ['rotate']];
const MIXED_RULES: readonly (readonly RuleId[])[] = [...TOWER_DOUBLE_RULES, ...SINGLE_RULES];
const ALL_POOL: TowerQuestionPool = { allowedRuleSets: MIXED_RULES };
const DOUBLE_POOL: TowerQuestionPool = { allowedRuleSets: TOWER_DOUBLE_RULES, minimumComplexRuleCount: 2 };
const MASTER_POOL: TowerQuestionPool = { allowedRuleSets: [['multi'], ['bomb', 'multi'], ['multi', 'reverse'], ['multi', 'rotate']], requiredRules: ['multi'], requiredCapabilities: ['multi', 'master-slash'], masterSlashEligible: true };
const MASTER_DOUBLE_POOL: TowerQuestionPool = { allowedRuleSets: [['bomb', 'multi'], ['multi', 'reverse'], ['multi', 'rotate']], requiredRules: ['multi'], requiredCapabilities: ['multi', 'master-slash'], minimumComplexRuleCount: 2, masterSlashEligible: true };
const STROOP_POOL: TowerQuestionPool = { themes: ['vision'], requiredCapabilities: ['stroop'], allowedRuleSets: [['standard'], ['bomb']] };
const BOMB_POOL: TowerQuestionPool = { allowedRuleSets: [['bomb'], ['bomb', 'multi'], ['bomb', 'order'], ['bomb', 'reverse'], ['bomb', 'rotate']], bombPolicy: 'required' };

const correct = (target: number): TowerObjective => ({ type: 'correct', target, label: `答对${target}题` });
const combo = (target: number): TowerObjective => ({ type: 'maxCombo', target, label: `达成${target}连击` });
const master = (target: number): TowerObjective => ({ type: 'masterSlash', target, label: `Master Slash ${target}次` });
const complete = (label = '完成全部专项题'): TowerObjective => ({ type: 'encounterComplete', label });
const maxErrors = (limit: number): TowerConstraint => ({ type: 'maxErrors', limit, label: `最多${limit}次失误` });
const deadline = (seconds: number): TowerConstraint => ({ type: 'maxElapsedMs', limit: seconds * 1_000, label: `${seconds}秒内完成` });
const noBomb = (): TowerConstraint => ({ type: 'maxBombHits', limit: 0, label: '不能斩中炸弹' });
const noMiss = (): TowerConstraint => ({ type: 'maxMisses', limit: 0, label: '不能出现漏题' });
function poolChallenge(pool: TowerQuestionPool, objectives: readonly TowerObjective[], constraints: readonly TowerConstraint[] = [], openingHint?: string): TowerChallengeConfig { return { encounter: { type: 'pool', pool }, objectives, constraints, openingHint }; }
function lane(id: string, label: string, requiredSuccesses: number, pool: TowerQuestionPool): TowerQuotaLane { return { id, label, requiredSuccesses, pool }; }
function quotaChallenge(lanes: readonly TowerQuotaLane[], constraints: readonly TowerConstraint[] = [], objectives: readonly TowerObjective[] = [complete()]): TowerChallengeConfig { return { encounter: { type: 'quotaDeck', order: 'balanced', lanes, fallbackPool: ALL_POOL }, objectives, constraints }; }
function rulesPool(allowedRuleSets: readonly (readonly RuleId[])[], extra: Omit<TowerQuestionPool, 'allowedRuleSets'> = {}): TowerQuestionPool { return { ...extra, allowedRuleSets }; }
function themePool(themes: readonly ThemeId[], allowedRuleSets: readonly (readonly RuleId[])[] = MIXED_RULES): TowerQuestionPool { return { themes, allowedRuleSets }; }

interface FloorSpec { title: string; challenge: TowerChallengeConfig; }
const F: FloorSpec[] = [];
const add = (title: string, challenge: TowerChallengeConfig): void => { F.push({ title, challenge }); };
add('基础试炼', poolChallenge(rulesPool([['standard'], ['bomb']]), [correct(8)]));
add('多选入门', poolChallenge(rulesPool([['multi']]), [correct(8)]));
add('顺序入门', poolChallenge(rulesPool([['order']]), [correct(8)]));
add('反向入门', poolChallenge(rulesPool([['reverse']]), [correct(8)]));
add('旋转入门', poolChallenge(rulesPool([['rotate']]), [correct(8)]));
add('单律综合', poolChallenge(rulesPool(SINGLE_RULES), [correct(8)]));
add('双律初见', poolChallenge(DOUBLE_POOL, [correct(8)], [], '同时观察两条规则，先判断再出刀'));
add('一笔制敌', poolChallenge(MASTER_POOL, [correct(8), master(1)], [], '一笔连续斩完全部正确目标，即可完成 Master Slash'));
add('双律配额', quotaChallenge([lane('double', '双规则', 6, DOUBLE_POOL), lane('single', '单规则', 4, rulesPool(SINGLE_RULES))]));
add('稳定发挥', poolChallenge(DOUBLE_POOL, [correct(10)], [maxErrors(3)]));
add('连斩试炼', poolChallenge(DOUBLE_POOL, [correct(10), combo(6)]));
add('反向专精', quotaRule('reverse', 6, 4));
add('迅捷试炼', poolChallenge(ALL_POOL, [correct(10)], [deadline(45)]));
add('色彩连斩', poolChallenge(STROOP_POOL, [correct(8), combo(5)]));
add('禁区穿行', poolChallenge(BOMB_POOL, [correct(10)], [noBomb()]));
add('旋转校准', quotaRule('rotate', 6, 4));
add('精准斩击', poolChallenge(DOUBLE_POOL, [correct(10)], [maxErrors(2)]));
add('双律一笔', poolChallenge(MASTER_DOUBLE_POOL, [correct(10), master(2)]));
add('顺序专精', quotaRule('order', 6, 4));
add('不断之刃', poolChallenge(DOUBLE_POOL, [correct(11), combo(8)]));
add('心算冲刺', poolChallenge(themePool(['math'], [['standard'], ['reverse'], ['bomb'], ['bomb', 'reverse']]), [correct(10)], [deadline(48)]));
add('汉字成序', poolChallenge({ themes: ['hanzi'], requiredCapabilities: ['order'], allowedRuleSets: [['order'], ['bomb', 'order']] }, [correct(8), combo(5)]));
add('英语归类', poolChallenge({ themes: ['english'], requiredCapabilities: ['category', 'multi'], allowedRuleSets: [['multi'], ['bomb', 'multi'], ['multi', 'reverse'], ['multi', 'rotate']] }, [correct(10)], [maxErrors(3)]));
add('双律连斩', poolChallenge(DOUBLE_POOL, [correct(10), combo(6)]));
add('三式精通', threePairQuota(3));
add('不容错过', poolChallenge(ALL_POOL, [correct(11)], [noMiss()]));
add('分类一笔', poolChallenge({ ...MASTER_POOL, themes: ['english', 'life'], requiredCapabilities: ['category', 'multi', 'master-slash'] }, [correct(11), master(2)], [maxErrors(3)]));
add('色彩压迫', poolChallenge(STROOP_POOL, [correct(10), combo(6)]));
add('逆势而行', quotaRule('reverse', 8, 3));
add('极速混合', poolChallenge(ALL_POOL, [correct(12)], [deadline(42)]));
add('旋转风暴', quotaRule('rotate', 8, 4));
add('九连之刃', poolChallenge(DOUBLE_POOL, [correct(12), combo(9)]));
add('雷区纵横', poolChallenge(BOMB_POOL, [correct(12)], [noBomb()]));
add('四域巡礼', quotaChallenge([lane('math', '数学', 3, themePool(['math'])), lane('english', '英语', 3, themePool(['english'])), lane('geography', '地理', 3, themePool(['geography'])), lane('history', '历史', 3, themePool(['history']))]));
add('精确混合', poolChallenge(DOUBLE_POOL, [correct(12)], [maxErrors(2)]));
add('大师连斩', poolChallenge(MASTER_POOL, [correct(12), master(3)]));
add('双律不断', poolChallenge(DOUBLE_POOL, [correct(12), combo(8)]));
add('逆向心算', poolChallenge(themePool(['math'], [['reverse'], ['bomb', 'reverse']]), [correct(12)], [maxErrors(3)]));
add('旋转成序', poolChallenge(rulesPool([['order', 'rotate']]), [correct(10), combo(5)]));
add('高速稳定', poolChallenge(DOUBLE_POOL, [correct(13)], [deadline(40), maxErrors(3)]));
add('色彩极限', poolChallenge(STROOP_POOL, [correct(11), combo(7)]));
add('三式循环', threePairQuota(4));
add('大师精确', poolChallenge(MASTER_DOUBLE_POOL, [correct(13), master(3)], [maxErrors(2)]));
add('博闻强记', quotaChallenge([lane('knowledge', '知识', 6, themePool(['knowledge'], [['standard'], ['reverse'], ['bomb'], ['bomb', 'reverse']])), lane('history', '历史', 6, themePool(['history'], [['standard'], ['reverse'], ['bomb'], ['bomb', 'reverse']]))], [noMiss()]));
add('十连之刃', poolChallenge(DOUBLE_POOL, [correct(13), combo(10)]));
add('四式轮转', quotaChallenge([lane('br', '禁区+反向', 3, rulesPool([['bomb', 'reverse']])), lane('mr', '多选+反向', 3, rulesPool([['multi', 'reverse']])), lane('mt', '多选+旋转', 3, rulesPool([['multi', 'rotate']])), lane('ot', '顺序+旋转', 3, rulesPool([['order', 'rotate']]))]));
add('双律不破', poolChallenge(DOUBLE_POOL, [correct(13), combo(10)]));
add('登顶冲刺', poolChallenge(DOUBLE_POOL, [correct(13)], [deadline(36)]));
add('一失之限', poolChallenge(DOUBLE_POOL, [correct(14)], [maxErrors(1)]));
add('塔巅试炼', quotaChallenge([lane('double', '双规则', 10, DOUBLE_POOL), lane('elite', '高难题', 5, ALL_POOL)], [maxErrors(2)], [complete(), combo(10)]));

export const TOWER_FLOORS: readonly TowerFloorConfig[] = F.map((spec, index) => {
    const floor = index + 1;
    return { floor, title: spec.title, durationMs: TOWER_DURATION_MS, difficulty: difficultyFor(floor), challenge: spec.challenge,
        unlockedRule: RULE_UNLOCKS.find((unlock) => unlock.floor === floor)?.rule, unlocksCompoundRules: floor === TOWER_COMPOUND_RULE_FLOOR };
});

export function towerFloorConfig(requestedFloor: number): TowerFloorConfig { return TOWER_FLOORS[clampFloor(requestedFloor) - 1]; }
export function towerFloorTitle(floor: number): string { return towerFloorConfig(floor).title; }
export const towerFloorLabel = towerFloorTitle;
export function towerFloorDisplayName(floor: number): string { return `第${clampFloor(floor)}层 · ${towerFloorTitle(floor)}`; }
export function towerFloorChallengeSummary(floor: number): string { return towerChallengeSummary(towerFloorConfig(floor).challenge); }
export function unlockedRulesForTower(highestClearedFloor: number): RuleId[] { const rules: RuleId[] = ['standard', 'bomb']; for (const unlock of RULE_UNLOCKS) if (highestClearedFloor >= unlock.floor) rules.push(unlock.rule); return rules; }
export function allowedBrawlRules(progress: TowerProgress, tutorials: Readonly<Partial<Record<RuleId, boolean>>>): ReadonlySet<RuleId> { const result = new Set<RuleId>(unlockedRulesForTower(progress.highestClearedFloor)); for (const rule of ['reverse', 'rotate', 'multi', 'order'] as const) if (tutorials[rule]) result.add(rule); return result; }
export function nextTowerUnlock(currentFloor: number): { floor: number; label: string } | null { const next = RULE_UNLOCKS.find((unlock) => unlock.floor > currentFloor); if (next) return { floor: next.floor, label: towerRuleLabel(next.rule) }; if (currentFloor < TOWER_COMPOUND_RULE_FLOOR) return { floor: TOWER_COMPOUND_RULE_FLOOR, label: '双规则' }; if (currentFloor < TOWER_LAST_FLOOR) return { floor: TOWER_LAST_FLOOR, label: '塔巅试炼' }; return null; }
export function towerRuleLabel(rule: RuleId): string { return ({ standard: '单选', reverse: '反向', rotate: '旋转', multi: '多选', order: '顺序', bomb: '禁区' } as const)[rule]; }

export function commitTowerFloor(progressBefore: TowerProgress, run: RunResult, life: number, challenge?: TowerChallengeSnapshot): TowerCommit {
    const floor = clampFloor(run.entry.towerFloor ?? progressBefore.currentFloor), config = towerFloorConfig(floor);
    const cleared = challenge ? challenge.status === 'cleared' : legacyRunMeetsChallenge(config.challenge, run);
    const firstClear = cleared && floor > progressBefore.highestClearedFloor, timeBonus = cleared ? towerTimeBonus(run.remainingMs) : 0;
    const towerPointsGained = cleared ? towerPointsForClear(run.score, floor, firstClear, run.remainingMs) : 0;
    const activeRun = progressBefore.activeRun ?? { startFloor: floor, totalScore: 0, maxCombo: 0 };
    const runTotalScore = cleared ? activeRun.totalScore + towerPointsGained : activeRun.totalScore, runMaxCombo = Math.max(activeRun.maxCombo, run.maxCombo);
    const highestClearedFloor = firstClear ? floor : progressBefore.highestClearedFloor;
    const towerMvpCompleted = progressBefore.towerMvpCompleted || (cleared && floor === TOWER_LAST_FLOOR), runFinished = cleared && floor === TOWER_LAST_FLOOR;
    const progress: TowerProgress = { scoringVersion: TOWER_SCORING_VERSION, currentFloor: cleared ? Math.min(TOWER_LAST_FLOOR, floor + 1) : floor,
        highestClearedFloor, totalTowerPoints: progressBefore.totalTowerPoints + towerPointsGained,
        bestContinuousScore: runFinished ? Math.max(progressBefore.bestContinuousScore, runTotalScore) : progressBefore.bestContinuousScore,
        maxCombo: Math.max(progressBefore.maxCombo, runMaxCombo), towerMvpCompleted,
        activeRun: runFinished ? undefined : { ...activeRun, totalScore: runTotalScore, maxCombo: runMaxCombo } };
    const failureReason = cleared ? undefined : challenge?.failureReason ?? (life <= 0 ? 'lifeDepleted' : 'objectiveIncomplete');
    return { progress, result: { ...run, floor, floorTitle: config.title, cleared, failureReason, failureLabel: cleared ? undefined : challenge?.failureLabel,
        challengeVersion: TOWER_CHALLENGE_VERSION, challengeSummary: towerChallengeSummary(config.challenge), objectiveProgress: challenge?.objectiveProgress ?? [],
        firstClear, towerPointsGained, timeBonus, totalTowerPoints: progress.totalTowerPoints, runTotalScore, highestClearedFloor,
        towerMvpCompleted, unlockedRule: firstClear ? config.unlockedRule : undefined,
        unlockedLabel: firstClear ? (config.unlocksCompoundRules ? '双规则' : config.unlockedRule ? towerRuleLabel(config.unlockedRule) : undefined) : undefined } };
}

export function normalizeTowerProgress(value: unknown): TowerProgress {
    const candidate = value as Partial<TowerProgress> | null | undefined;
    if (!candidate || !integerIn(candidate.currentFloor, 1, TOWER_LAST_FLOOR) || !integerIn(candidate.highestClearedFloor, 0, TOWER_LAST_FLOOR)) return cloneTower(DEFAULT_TOWER_PROGRESS);
    const highest = candidate.highestClearedFloor!, legacy = candidate.scoringVersion !== TOWER_SCORING_VERSION;
    const result: TowerProgress = { scoringVersion: TOWER_SCORING_VERSION, currentFloor: candidate.currentFloor!, highestClearedFloor: highest,
        totalTowerPoints: legacy ? 0 : nonNegative(candidate.totalTowerPoints), bestContinuousScore: legacy ? 0 : nonNegative(candidate.bestContinuousScore),
        maxCombo: nonNegative(candidate.maxCombo), towerMvpCompleted: candidate.towerMvpCompleted === true && highest === TOWER_LAST_FLOOR };
    if (validActiveRun(candidate.activeRun)) result.activeRun = { ...candidate.activeRun };
    return result;
}
export function towerTimeBonus(remainingMs: number | undefined): number { return Math.max(0, Math.min(60, Math.floor((remainingMs ?? 0) / 1_000))) * 2; }
export function towerPointsForClear(score: number, floor: number, firstClear: boolean, remainingMs = 0): number { const safeScore = Math.max(0, Math.floor(score)), safeFloor = clampFloor(floor), seconds = Math.max(0, Math.min(60, Math.floor(remainingMs / 1_000))); if (!firstClear) return Math.min(30, Math.floor(safeScore / 250)) + Math.min(20, Math.floor(seconds / 3)); return 100 + safeFloor * 10 + Math.min(50, Math.floor(safeScore / 100)) + towerTimeBonus(remainingMs); }

function quotaRule(rule: RuleId, special: number, other: number): TowerChallengeConfig { return quotaChallenge([lane(rule, `${towerRuleLabel(rule)}双规则`, special, rulesPool(TOWER_DOUBLE_RULES.filter((set) => set.includes(rule)), { requiredRules: [rule] })), lane('other', '其他规则', other, rulesPool(TOWER_DOUBLE_RULES.filter((set) => !set.includes(rule))))]); }
function threePairQuota(count: number): TowerChallengeConfig { return quotaChallenge([lane('mr', '多选+反向', count, rulesPool([['multi', 'reverse']])), lane('mt', '多选+旋转', count, rulesPool([['multi', 'rotate']])), lane('ot', '顺序+旋转', count, rulesPool([['order', 'rotate']]))]); }
function difficultyFor(floor: number): TowerDifficultyConfig { const stage: 0 | 1 | 2 = floor <= 2 ? 0 : floor <= 15 ? 1 : 2; return { stage, targetCount: floor <= 1 ? 3 : floor <= 20 ? 4 : 5, questionTimeMs: floor <= 7 ? 2_800 : floor <= 20 ? 2_650 : floor <= 35 ? 2_450 : 2_250, speed: floor <= 7 ? .86 : floor <= 20 ? .98 : floor <= 35 ? 1.08 : 1.16, themeWeights: allThemes() }; }
function allThemes(): Readonly<Partial<Record<ThemeId, number>>> { return { math: 3, vision: 3, hanzi: 2, english: 2, life: 1, geography: 1, knowledge: 2, history: 2 }; }
function legacyRunMeetsChallenge(config: TowerChallengeConfig, run: RunResult): boolean { const encounterTarget = config.encounter.type === 'quotaDeck' ? config.encounter.lanes.reduce((sum, item) => sum + item.requiredSuccesses, 0) : 0; return config.objectives.every((objective) => objective.type === 'encounterComplete' ? run.correctCount >= encounterTarget : objective.type === 'correct' ? run.correctCount >= objective.target : objective.type === 'maxCombo' ? run.maxCombo >= objective.target : (run.masterSlashCount ?? 0) >= objective.target) && (config.constraints ?? []).every((constraint) => constraint.type === 'maxErrors' ? run.errorCount <= constraint.limit : constraint.type === 'maxElapsedMs' ? (run.elapsedMs ?? Number.MAX_SAFE_INTEGER) <= constraint.limit : true); }
function clampFloor(floor: number): number { return Math.max(1, Math.min(TOWER_LAST_FLOOR, Math.floor(floor || 1))); }
function nonNegative(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; }
function integerIn(value: unknown, min: number, max: number): value is number { return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max; }
function validActiveRun(value: unknown): value is TowerActiveRun { const run = value as Partial<TowerActiveRun> | null | undefined; return !!run && integerIn(run.startFloor, 1, TOWER_LAST_FLOOR) && nonNegative(run.totalScore) === run.totalScore && nonNegative(run.maxCombo) === run.maxCombo; }
function cloneTower(value: TowerProgress): TowerProgress { return JSON.parse(JSON.stringify(value)) as TowerProgress; }
