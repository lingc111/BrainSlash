import type { DailyChallengeResult, GameEntryParams, RuleId, RunResult, ThemeId } from './Models';

export type DailyRecipeId = 'even-hunt' | 'reverse-day' | 'flag-hunter' | 'idiom-rush' | 'color-trick' | 'life-instinct' | 'speed-mix';

export interface DailyRecipe {
    id: DailyRecipeId;
    title: string;
    accent: string;
    themeWeights: Readonly<Record<ThemeId, number>>;
    preferredRule?: Exclude<RuleId, 'standard'>;
    speedMultiplier: number;
}

export interface LocalDailyRecord {
    dateKey: string;
    recipeId: DailyRecipeId;
    attempts: number;
    bestScore: number;
    lastScore: number;
    completed: boolean;
    tutorialBaseline: Exclude<RuleId, 'standard'>[];
}

export interface DailyChallengeDefinition {
    dateKey: string;
    endTime: number;
    recipe: DailyRecipe;
    entry: GameEntryParams;
}

export interface DailyHomePresentation {
    accent: string;
    title: string;
    status: string;
    actionLabel: '开斩' | '再战今日';
    endTime: number;
}

const RECIPES: readonly DailyRecipe[] = [
    { id: 'even-hunt', title: '偶数猎杀', accent: '偶', themeWeights: weights({ math: 7, vision: 4 }), preferredRule: 'multi', speedMultiplier: 1 },
    { id: 'reverse-day', title: '反向日', accent: '反', themeWeights: weights({ math: 3, vision: 3, english: 2, hanzi: 2, geography: 2, life: 2 }), preferredRule: 'reverse', speedMultiplier: 1 },
    { id: 'flag-hunter', title: '国旗猎人', accent: '旗', themeWeights: weights({ geography: 7, vision: 3 }), preferredRule: 'multi', speedMultiplier: 1 },
    { id: 'idiom-rush', title: '成语连斩', accent: '成', themeWeights: weights({ hanzi: 7, vision: 2 }), preferredRule: 'order', speedMultiplier: 1 },
    { id: 'color-trick', title: '颜色骗局', accent: '色', themeWeights: weights({ vision: 7, english: 3 }), preferredRule: 'stroop', speedMultiplier: 1 },
    { id: 'life-instinct', title: '生活快手', accent: '快', themeWeights: weights({ life: 7, vision: 3 }), preferredRule: 'bomb', speedMultiplier: 1 },
    { id: 'speed-mix', title: '极速混战', accent: '速', themeWeights: weights({ math: 2, vision: 2, english: 2, hanzi: 2, geography: 2, life: 2 }), speedMultiplier: 1.12 },
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
        entry: {
            mode: 'daily',
            seed: `daily:${contentVersion}:${dateKey}:${recipe.id}`,
            contentVersion,
            recipeId: recipe.id,
            dailyDate: dateKey,
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
    return {
        record: { dateKey, recipeId: recipe.id, attempts, bestScore, lastScore: run.score, completed: true, tutorialBaseline: current?.tutorialBaseline ?? [] },
        result: { dateKey, recipeId: recipe.id, attempts, previousBestScore, bestScore, isNewBest },
    };
}

export function beginDailyRun(
    previous: LocalDailyRecord | undefined,
    entry: GameEntryParams,
    learned: Readonly<Partial<Record<RuleId, boolean>>>,
): LocalDailyRecord | null {
    if (entry.mode !== 'daily') return null;
    const dateKey = entry.dailyDate ?? dateKeyFromSeed(entry.seed);
    const recipe = dailyRecipeById(entry.recipeId);
    if (!dateKey || !recipe) return null;
    if (previous?.dateKey === dateKey && previous.recipeId === recipe.id) return previous;
    const tutorialBaseline = (['reverse', 'multi', 'order', 'stroop', 'bomb'] as const).filter((rule) => learned[rule]);
    return { dateKey, recipeId: recipe.id, attempts: 0, bestScore: 0, lastScore: 0, completed: false, tutorialBaseline };
}

export function dailyTutorialProgress(record: LocalDailyRecord | undefined): Partial<Record<RuleId, boolean>> {
    return Object.fromEntries((record?.tutorialBaseline ?? []).map((rule) => [rule, true]));
}

export function createDailyHomePresentation(challenge: DailyChallengeDefinition, record?: LocalDailyRecord): DailyHomePresentation {
    const current = record?.dateKey === challenge.dateKey && record.recipeId === challenge.recipe.id ? record : undefined;
    return {
        accent: challenge.recipe.accent,
        title: challenge.recipe.title,
        status: current?.completed ? `今日最佳 ${current.bestScore} · 已战 ${current.attempts} 次` : '今日首战 · 全员同题',
        actionLabel: current?.completed ? '再战今日' : '开斩',
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
    };
}

function dateKeyFromSeed(seed: string): string | undefined {
    return /^daily:[^:]+:(\d{4}-\d{2}-\d{2}):/.exec(seed)?.[1];
}
