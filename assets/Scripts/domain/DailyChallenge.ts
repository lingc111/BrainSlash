import type { DailyChallengeResult, GameEntryParams, RuleId, RunResult, ThemeId } from './Models';
export type DailyRecipeId =
    | 'daily-math' | 'daily-vision' | 'daily-hanzi' | 'daily-english'
    | 'daily-life' | 'daily-geography' | 'daily-knowledge' | 'daily-history';

export interface DailyRecipe {
    id: DailyRecipeId;
    title: string;
    accent: string;
    theme: ThemeId;
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
    { id: 'daily-math', title: '今日主题 · 数学', accent: '数', theme: 'math', targetScore: 1500 },
    { id: 'daily-vision', title: '今日主题 · 眼力', accent: '眼', theme: 'vision', targetScore: 1400 },
    { id: 'daily-hanzi', title: '今日主题 · 汉字', accent: '字', theme: 'hanzi', targetScore: 1200 },
    { id: 'daily-english', title: '今日主题 · 英语', accent: '译', theme: 'english', targetScore: 1300 },
    { id: 'daily-life', title: '今日主题 · 生活', accent: '生', theme: 'life', targetScore: 1300 },
    { id: 'daily-geography', title: '今日主题 · 地理', accent: '地', theme: 'geography', targetScore: 1200 },
    { id: 'daily-knowledge', title: '今日主题 · 常识', accent: '知', theme: 'knowledge', targetScore: 1300 },
    { id: 'daily-history', title: '今日主题 · 历史', accent: '史', theme: 'history', targetScore: 1200 },
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
    const recipe = RECIPES[stableIndex(`${contentVersion}:${dateKey}`, RECIPES.length)];
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
            dailyTheme: recipe.theme,
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

function stableIndex(value: string, count: number): number {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    return (hash >>> 0) % count;
}

function positiveTarget(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function dateKeyFromSeed(seed: string): string | undefined {
    return /^daily:[^:]+:(\d{4}-\d{2}-\d{2}):/.exec(seed)?.[1];
}
