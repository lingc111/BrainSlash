import { CONTENT_FAMILIES, type ContentFamilyKind, type ContentFamilySpec } from './ContentCatalog';
import { dailyRecipeById } from './DailyChallenge';
import type { RuleId, ThemeId } from './Models';
import { SeededRng } from './SeededRng';

export type BrawlPhaseId = 'warmup' | 'action' | 'twist' | 'climax';
export type DifficultyStage = 0 | 1 | 2;

export interface BrawlPhaseSettings {
    id: BrawlPhaseId;
    startMs: number;
    endMs: number;
    difficultyStage: DifficultyStage;
    targetCount: number;
    questionTimeMs: number;
    speed: number;
    themeWeights: Readonly<Partial<Record<ThemeId, number>>>;
    ruleSequence: readonly (readonly RuleId[])[];
    reuseSeenFamilies: boolean;
}

export interface BrawlQuestionDirective {
    phase: BrawlPhaseId;
    difficultyStage: DifficultyStage;
    targetCount: number;
    questionTimeMs: number;
    speed: number;
    family: ContentFamilySpec;
    rules: RuleId[];
}

export const BRAWL_PHASES: readonly BrawlPhaseSettings[] = [
    {
        id: 'warmup', startMs: 0, endMs: 10_000, difficultyStage: 0,
        targetCount: 3, questionTimeMs: 3_000, speed: 0.72,
        themeWeights: { math: 3, vision: 2 },
        ruleSequence: [['standard']], reuseSeenFamilies: false,
    },
    {
        id: 'action', startMs: 10_000, endMs: 25_000, difficultyStage: 1,
        targetCount: 4, questionTimeMs: 2_600, speed: 0.95,
        themeWeights: { math: 3, vision: 3, hanzi: 1, english: 1, life: 1 },
        ruleSequence: [['multi'], ['bomb'], ['standard'], ['order'], ['bomb']], reuseSeenFamilies: false,
    },
    {
        id: 'twist', startMs: 25_000, endMs: 45_000, difficultyStage: 2,
        targetCount: 5, questionTimeMs: 2_250, speed: 1.15,
        themeWeights: { math: 2, vision: 3, hanzi: 2, english: 2, life: 1, geography: 1 },
        ruleSequence: [['reverse'], ['stroop'], ['standard'], ['reverse'], ['multi'], ['stroop']], reuseSeenFamilies: false,
    },
    {
        id: 'climax', startMs: 45_000, endMs: 60_001, difficultyStage: 2,
        targetCount: 6, questionTimeMs: 1_850, speed: 1.38,
        themeWeights: { math: 3, vision: 3, hanzi: 2, english: 2, life: 1, geography: 1 },
        ruleSequence: [['bomb', 'multi'], ['bomb', 'reverse'], ['bomb', 'order'], ['bomb', 'stroop'], ['multi', 'reverse']], reuseSeenFamilies: true,
    },
];

const RULE_SUPPORT: Readonly<Record<ContentFamilyKind, readonly string[]>> = {
    'math-add': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'math-subtract': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'math-multiply': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'math-property': ['standard', 'multi', 'reverse', 'bomb+multi', 'multi+reverse'],
    'math-compare': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'math-sequence': ['standard', 'reverse', 'bomb', 'order', 'bomb+order'],
    'vision-direction': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'vision-odd': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'vision-count': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'vision-stroop': ['standard', 'stroop', 'bomb+stroop'],
    'vision-pattern': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'hanzi-fill': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'hanzi-valid': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'hanzi-order': ['order', 'bomb+order'],
    'english-meaning': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'english-category': ['standard', 'multi', 'reverse', 'bomb+multi', 'multi+reverse'],
    'english-antonym': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'life-use': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'life-category': ['standard', 'multi', 'reverse', 'bomb+multi', 'multi+reverse'],
    'geography-capital': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'geography-country': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
};

const TARGET_CAP_BY_KIND: Readonly<Record<ContentFamilyKind, number>> = {
    'math-add': 4,
    'math-subtract': 4,
    'math-multiply': 4,
    'math-property': 5,
    'math-compare': 4,
    'math-sequence': 4,
    'vision-direction': 6,
    'vision-odd': 6,
    'vision-count': 6,
    'vision-stroop': 6,
    'vision-pattern': 6,
    'hanzi-fill': 4,
    'hanzi-valid': 4,
    'hanzi-order': 5,
    'english-meaning': 4,
    'english-category': 5,
    'english-antonym': 4,
    'life-use': 4,
    'life-category': 5,
    'geography-capital': 4,
    'geography-country': 4,
};

export function targetCountForFamily(baseCount: number, kind: ContentFamilyKind, rules: readonly RuleId[]): number {
    const complexRuleCount = rules.filter((rule) => rule !== 'standard').length;
    const ruleAdjustedCount = complexRuleCount > 1 ? baseCount - 1 : baseCount;
    const contentMinimum = kind === 'hanzi-order' ? 4 + (rules.includes('bomb') ? 1 : 0) : 2;
    return Math.max(contentMinimum, Math.min(ruleAdjustedCount, TARGET_CAP_BY_KIND[kind]));
}

export function phaseAt(elapsedMs: number): BrawlPhaseSettings {
    const clamped = Math.max(0, Math.min(60_000, elapsedMs));
    return BRAWL_PHASES.find((phase) => clamped >= phase.startMs && clamped < phase.endMs) ?? BRAWL_PHASES[BRAWL_PHASES.length - 1];
}

export function familySupportsRules(family: ContentFamilySpec, rules: readonly RuleId[]): boolean {
    return RULE_SUPPORT[family.kind].includes(ruleKey(rules));
}

export class Brawl60Director {
    private readonly ruleBags = new Map<BrawlPhaseId, RuleId[][]>();
    private readonly lastRuleKeys = new Map<BrawlPhaseId, string>();
    private readonly themeBags = new Map<string, ThemeId[]>();
    private readonly familyBags = new Map<string, ContentFamilySpec[]>();
    private readonly recentThemes: ThemeId[] = [];
    private readonly recentFamilyIds: string[] = [];
    private readonly seenFamilyIds = new Set<string>();

    public constructor(
        private readonly rng: SeededRng,
        private readonly recipeId = 'mixed',
        private readonly allowedRules?: ReadonlySet<RuleId>,
        private readonly allowCompoundRules = true,
    ) {}

    public next(elapsedMs: number): BrawlQuestionDirective {
        const phase = filterPhaseRules(phaseForRecipe(phaseAt(elapsedMs), this.recipeId), this.allowedRules, this.allowCompoundRules);
        const requestedRules = this.pickRules(phase);
        const compatible = CONTENT_FAMILIES.filter((family) =>
            (phase.themeWeights[family.theme] ?? 0) > 0 && familySupportsRules(family, requestedRules),
        );
        const family = this.pickFamily(phase, requestedRules, compatible);
        this.recordSelection(family);
        return {
            phase: phase.id,
            difficultyStage: phase.difficultyStage,
            targetCount: targetCountForFamily(phase.targetCount, family.kind, requestedRules),
            questionTimeMs: phase.questionTimeMs,
            speed: phase.speed,
            family,
            rules: requestedRules,
        };
    }

    private pickRules(phase: BrawlPhaseSettings): RuleId[] {
        let bag = this.ruleBags.get(phase.id);
        if (!bag?.length) {
            bag = this.rng.shuffle(phase.ruleSequence.map((rules) => [...rules]));
            const lastKey = this.lastRuleKeys.get(phase.id);
            const nextIndex = bag.length - 1;
            if (lastKey && bag.length > 1 && ruleKey(bag[nextIndex]) === lastKey) {
                const swapIndex = bag.findIndex((rules) => ruleKey(rules) !== lastKey);
                if (swapIndex >= 0) [bag[swapIndex], bag[nextIndex]] = [bag[nextIndex], bag[swapIndex]];
            }
            this.ruleBags.set(phase.id, bag);
        }
        let nextIndex = bag.length - 1;
        const recentTheme = this.recentThemes[this.recentThemes.length - 1];
        const themeRepeated = recentTheme !== undefined
            && this.recentThemes.length >= 2
            && this.recentThemes[this.recentThemes.length - 2] === recentTheme;
        if (themeRepeated) {
            const alternativeIndex = bag.findIndex((rules) => CONTENT_FAMILIES.some((family) =>
                family.theme !== recentTheme
                && (phase.themeWeights[family.theme] ?? 0) > 0
                && familySupportsRules(family, rules),
            ));
            if (alternativeIndex >= 0) nextIndex = alternativeIndex;
        }
        const rules = bag.splice(nextIndex, 1)[0];
        this.lastRuleKeys.set(phase.id, ruleKey(rules));
        return [...rules];
    }

    private pickFamily(phase: BrawlPhaseSettings, rules: readonly RuleId[], compatible: readonly ContentFamilySpec[]): ContentFamilySpec {
        if (!compatible.length) throw new Error(`No family supports ${phase.id}:${ruleKey(rules)}`);
        const availableThemes = new Set(compatible.map((family) => family.theme));
        const theme = this.pickTheme(phase, rules, availableThemes);
        const familyPool = compatible.filter((family) => family.theme === theme);
        const reusable = phase.reuseSeenFamilies ? familyPool.filter((family) => this.seenFamilyIds.has(family.id)) : familyPool;
        const reusableHasCooledFamily = reusable.some((family) => !this.recentFamilyIds.includes(family.id));
        return this.pickFromFamilyBag(phase, rules, reusableHasCooledFamily ? reusable : familyPool);
    }

    private pickTheme(phase: BrawlPhaseSettings, rules: readonly RuleId[], available: ReadonlySet<ThemeId>): ThemeId {
        const key = `${phase.id}:${ruleKey(rules)}`;
        let bag = this.themeBags.get(key);
        if (!bag?.some((theme) => available.has(theme))) {
            const weighted: ThemeId[] = [];
            for (const theme of Object.keys(phase.themeWeights) as ThemeId[]) {
                if (!available.has(theme)) continue;
                const weight = Math.max(0, Math.round(phase.themeWeights[theme] ?? 0));
                for (let i = 0; i < weight; i++) weighted.push(theme);
            }
            bag = this.rng.shuffle(weighted);
            this.themeBags.set(key, bag);
        }
        const avoidTheme = this.recentThemes[this.recentThemes.length - 1];
        if (avoidTheme && [...available].some((theme) => theme !== avoidTheme) && !bag.some((theme) => available.has(theme) && theme !== avoidTheme)) {
            const weighted: ThemeId[] = [];
            for (const theme of Object.keys(phase.themeWeights) as ThemeId[]) {
                if (!available.has(theme)) continue;
                const weight = Math.max(0, Math.round(phase.themeWeights[theme] ?? 0));
                for (let i = 0; i < weight; i++) weighted.push(theme);
            }
            bag = this.rng.shuffle(weighted);
            this.themeBags.set(key, bag);
        }
        let index = bag.length - 1;
        while (index >= 0 && (!available.has(bag[index]) || (bag[index] === avoidTheme && bag.some((theme) => available.has(theme) && theme !== avoidTheme)))) index--;
        if (index < 0) index = bag.findIndex((theme) => available.has(theme));
        return bag.splice(index, 1)[0];
    }

    private pickFromFamilyBag(phase: BrawlPhaseSettings, rules: readonly RuleId[], pool: readonly ContentFamilySpec[]): ContentFamilySpec {
        const key = `${phase.id}:${ruleKey(rules)}:${pool[0].theme}`;
        const allowedIds = new Set(pool.map((family) => family.id));
        let bag = this.familyBags.get(key);
        if (!bag?.some((family) => allowedIds.has(family.id))) {
            bag = this.rng.shuffle(pool);
            this.familyBags.set(key, bag);
        }
        let index = bag.length - 1;
        while (index >= 0 && (!allowedIds.has(bag[index].id) || this.recentFamilyIds.includes(bag[index].id))) index--;
        if (index < 0) {
            bag = this.rng.shuffle(pool);
            this.familyBags.set(key, bag);
            index = bag.findIndex((family) => !this.recentFamilyIds.includes(family.id));
            if (index < 0) index = 0;
        }
        return bag.splice(index, 1)[0];
    }

    private recordSelection(family: ContentFamilySpec): void {
        this.recentThemes.push(family.theme);
        if (this.recentThemes.length > 2) this.recentThemes.shift();
        this.recentFamilyIds.push(family.id);
        if (this.recentFamilyIds.length > 5) this.recentFamilyIds.shift();
        this.seenFamilyIds.add(family.id);
    }
}

function ruleKey(rules: readonly RuleId[]): string {
    return [...rules].sort().join('+');
}

function phaseForRecipe(phase: BrawlPhaseSettings, recipeId: string): BrawlPhaseSettings {
    const recipe = dailyRecipeById(recipeId);
    if (!recipe || phase.id === 'warmup') return phase;
    let ruleSequence = phase.ruleSequence;
    if (recipe.preferredRule && recipe.preferredRule !== 'bomb') {
        const preferred = recipe.preferredRule;
        ruleSequence = phase.id === 'climax'
            ? [[preferred], ['bomb', preferred], ['standard'], [preferred], ['bomb', preferred]]
            : phase.ruleSequence.map((rules, index) => index % 2 === 0 ? [preferred] : rules);
    } else if (recipe.preferredRule === 'bomb') {
        ruleSequence = phase.ruleSequence.map((rules, index) => index % 2 === 0 ? ['bomb'] : rules);
    }
    return {
        ...phase,
        speed: phase.speed * recipe.speedMultiplier,
        themeWeights: recipe.themeWeights,
        ruleSequence,
    };
}

function filterPhaseRules(phase: BrawlPhaseSettings, allowedRules?: ReadonlySet<RuleId>, allowCompoundRules = true): BrawlPhaseSettings {
    if (!allowedRules) return phase;
    const ruleSequence = phase.ruleSequence.filter((rules) =>
        (allowCompoundRules || rules.filter((rule) => rule !== 'standard').length <= 1)
        && rules.every((rule) => rule === 'standard' || allowedRules.has(rule)),
    );
    return { ...phase, ruleSequence: ruleSequence.length ? ruleSequence : [['standard']] };
}
