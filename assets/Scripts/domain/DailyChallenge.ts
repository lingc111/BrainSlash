import type { DailyChallengeResult, GameEntryParams, RuleId, RunResult, ThemeId } from './Models';
import type { ContentFamilyKind } from './ContentCatalog';

export type DailyRecipeId =
    | 'number-lab'
    | 'logic-detective'
    | 'word-case'
    | 'world-tour'
    | 'common-knowledge'
    | 'history-adventure'
    | 'english-sprint';

export interface DailyRecipe {
    id: DailyRecipeId;
    title: string;
    accent: string;
    themeWeights: Readonly<Record<ThemeId, number>>;
    familyKinds: readonly ContentFamilyKind[];
    allowedRules: readonly RuleId[];
    speedMultiplier: number;
    targetScore: number;
}

export interface LocalDailyRecord {
    dateKey: string;
    recipeId: DailyRecipeId;
    attempts: number;
    bestScore: number;
    lastScore: number;
    completed: boolean;
    targetScore: number;
    targetAchieved: boolean;
    achievedAt?: number;
    tutorialBaseline: Exclude<RuleId, 'standard'>[];
}

export interface DailyChallengeDefinition {
    dateKey: string;
    endTime: number;
    recipe: DailyRecipe;
    targetScore: number;
    entry: GameEntryParams;
}

export interface DailyHomePresentation {
    accent: string;
    title: string;
    status: string;
    goal: string;
    achieved: boolean;
    endTime: number;
}

const RECIPES: readonly DailyRecipe[] = [
    {
        id: 'number-lab', title: '数字训练营', accent: '数', themeWeights: weights({ math: 8 }),
        familyKinds: ['math-add', 'math-subtract', 'math-multiply', 'math-property', 'math-compare', 'math-sequence'],
        allowedRules: ['standard', 'bomb', 'multi', 'order', 'reverse', 'rotate'], speedMultiplier: 1.04, targetScore: 1600,
    },
    {
        id: 'logic-detective', title: '逻辑侦探社', accent: '探', themeWeights: weights({ math: 4, vision: 6 }),
        familyKinds: ['math-property', 'math-compare', 'math-sequence', 'vision-odd', 'vision-count', 'vision-stroop', 'vision-pattern'],
        allowedRules: ['standard', 'bomb', 'multi', 'order', 'reverse', 'rotate'], speedMultiplier: 1, targetScore: 1500,
    },
    {
        id: 'word-case', title: '文字谜案局', accent: '字', themeWeights: weights({ hanzi: 8 }),
        familyKinds: ['hanzi-fill', 'hanzi-order', 'hanzi-antonym', 'hanzi-synonym'],
        allowedRules: ['standard', 'bomb', 'order', 'reverse', 'rotate'], speedMultiplier: 0.92, targetScore: 1200,
    },
    {
        id: 'world-tour', title: '世界漫游记', accent: '游', themeWeights: weights({ geography: 8 }),
        familyKinds: ['geography-capital', 'geography-country'],
        allowedRules: ['standard', 'bomb', 'reverse', 'rotate'], speedMultiplier: 0.94, targetScore: 1200,
    },
    {
        id: 'common-knowledge', title: '常识万花筒', accent: '知', themeWeights: weights({ knowledge: 8 }),
        familyKinds: ['knowledge-science', 'knowledge-nature', 'knowledge-culture', 'knowledge-civic'],
        allowedRules: ['standard', 'bomb', 'reverse', 'rotate'], speedMultiplier: 0.96, targetScore: 1300,
    },
    {
        id: 'history-adventure', title: '历史奇遇记', accent: '史', themeWeights: weights({ history: 8 }),
        familyKinds: ['history-modern-opening', 'history-modern-awakening', 'history-modern-resistance', 'history-ancient', 'history-myth'],
        allowedRules: ['standard', 'bomb', 'reverse', 'rotate'], speedMultiplier: 0.92, targetScore: 1200,
    },
    {
        id: 'english-sprint', title: '双语快问', accent: '译', themeWeights: weights({ english: 8 }),
        familyKinds: ['english-meaning', 'english-category', 'english-antonym'],
        allowedRules: ['standard', 'bomb', 'multi', 'reverse', 'rotate'], speedMultiplier: 0.96, targetScore: 1400,
    },
];

export function localDateKey(now: Date): string {
    const two = (value: number): string => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

export function nextLocalDayStart(now: Date): number {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
}

export function dailyRecipeById(id?: string): DailyRecipe | undefined {
    return RECIPES.find((recipe) => recipe.id === id);
}

export function createDailyChallenge(now: Date, contentVersion: string): DailyChallengeDefinition {
    const dateKey = localDateKey(now);
    const dayNumber = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
    const recipe = RECIPES[((dayNumber % RECIPES.length) + RECIPES.length) % RECIPES.length];
    return {
        dateKey,
        endTime: nextLocalDayStart(now),
        recipe,
        targetScore: recipe.targetScore,
        entry: {
            mode: 'daily',
            seed: `daily:${contentVersion}:${dateKey}:${recipe.id}`,
            contentVersion,
            recipeId: recipe.id,
            dailyDate: dateKey,
            dailyTargetScore: recipe.targetScore,
        },
    };
}

export function recordDailyRun(previous: LocalDailyRecord | undefined, run: RunResult): { record: LocalDailyRecord; result: DailyChallengeResult } | null {
    if (run.entry.mode !== 'daily') return null;
    const dateKey = run.entry.dailyDate ?? dateKeyFromSeed(run.entry.seed);
    const recipe = dailyRecipeById(run.entry.recipeId);
    if (!dateKey || !recipe) return null;
    const current = previous?.dateKey === dateKey && previous.recipeId === recipe.id ? previous : undefined;
    const previousBestScore = current?.bestScore ?? 0;
    const attempts = (current?.attempts ?? 0) + 1;
    const bestScore = Math.max(previousBestScore, run.score);
    const isNewBest = !current?.completed || run.score > previousBestScore;
    const targetScore = positiveTarget(run.entry.dailyTargetScore) ?? recipe.targetScore;
    const targetAchieved = run.score >= targetScore;
    const firstAchievement = targetAchieved && !current?.targetAchieved;
    const achievedAt = current?.achievedAt ?? (targetAchieved ? Date.now() : undefined);
    return {
        record: {
            dateKey, recipeId: recipe.id, attempts, bestScore, lastScore: run.score, completed: true,
            targetScore, targetAchieved: !!current?.targetAchieved || targetAchieved,
            ...(achievedAt === undefined ? {} : { achievedAt }),
            tutorialBaseline: current?.tutorialBaseline ?? [],
        },
        result: { dateKey, recipeId: recipe.id, attempts, previousBestScore, bestScore, isNewBest, targetScore, targetAchieved, firstAchievement },
    };
}

export function beginDailyRun(
    previous: LocalDailyRecord | undefined,
    entry: GameEntryParams,
    _learned: Readonly<Partial<Record<RuleId, boolean>>>,
): LocalDailyRecord | null {
    if (entry.mode !== 'daily') return null;
    const dateKey = entry.dailyDate ?? dateKeyFromSeed(entry.seed);
    const recipe = dailyRecipeById(entry.recipeId);
    if (!dateKey || !recipe) return null;
    if (previous?.dateKey === dateKey && previous.recipeId === recipe.id) return previous;
    return {
        dateKey, recipeId: recipe.id, attempts: 0, bestScore: 0, lastScore: 0, completed: false,
        targetScore: positiveTarget(entry.dailyTargetScore) ?? recipe.targetScore,
        targetAchieved: false, tutorialBaseline: [],
    };
}

export function createDailyHomePresentation(challenge: DailyChallengeDefinition, record?: LocalDailyRecord): DailyHomePresentation {
    const current = record?.dateKey === challenge.dateKey && record.recipeId === challenge.recipe.id ? record : undefined;
    const targetScore = current?.targetScore ?? challenge.targetScore;
    const achieved = !!current?.targetAchieved;
    const status = !current?.completed
        ? '今日固定题 · 首战待斩'
        : achieved ? `已达标 · 最佳 ${current.bestScore}`
        : `最佳 ${current.bestScore} · 还差 ${Math.max(0, targetScore - current.bestScore)}`;
    return {
        accent: challenge.recipe.accent,
        title: challenge.recipe.title,
        status,
        goal: `目标 ${targetScore} 分`,
        achieved,
        endTime: challenge.endTime,
    };
}

function weights(preferred: Partial<Record<ThemeId, number>>): Readonly<Record<ThemeId, number>> {
    return {
        math: preferred.math ?? 1,
        vision: preferred.vision ?? 1,
        english: preferred.english ?? 1,
        hanzi: preferred.hanzi ?? 1,
        geography: preferred.geography ?? 1,
        life: preferred.life ?? 1,
        knowledge: preferred.knowledge ?? 1,
        history: preferred.history ?? 1,
    };
}

function positiveTarget(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function dateKeyFromSeed(seed: string): string | undefined {
    return /^daily:[^:]+:(\d{4}-\d{2}-\d{2}):/.exec(seed)?.[1];
}
