import { RULE_PAIR_WHITELIST, validateRuleSet } from '../configs/GameConfig';
import { CONTENT_FAMILIES, type ContentFamilyKind, type ContentFamilySpec } from './ContentCatalog';
import type { RuleId, ThemeId } from './Models';
import { slashRuleCount } from './Rules';

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

/** Internal parameters passed from the unified compiler to one concrete template algorithm. */
export interface TemplateCompileDirective {
    phase: BrawlPhaseId;
    difficultyStage: DifficultyStage;
    targetCount: number;
    questionTimeMs: number;
    speed: number;
    family: ContentFamilySpec;
    rules: RuleId[];
    /** Omitted for the legacy/static path; present for a registered expanded type. */
    typeId?: string;
    /** Bomb is a gameplay hazard, independent from the selectable slash rules. */
    bombEnabled?: boolean;
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
        themeWeights: { math: 4, vision: 4, hanzi: 3, english: 2, life: 2, geography: 2, knowledge: 4, history: 2 },
        ruleSequence: [['multi'], ['bomb'], ['standard'], ['order'], ['bomb'], ['reverse'], ['rotate']], reuseSeenFamilies: false,
    },
    {
        id: 'twist', startMs: 25_000, endMs: 45_000, difficultyStage: 2,
        targetCount: 5, questionTimeMs: 2_250, speed: 1.15,
        themeWeights: { math: 4, vision: 4, hanzi: 3, english: 3, life: 3, geography: 3, knowledge: 4, history: 3 },
        ruleSequence: [['reverse'], ['rotate'], ['standard'], ['reverse'], ['multi'], ['standard'], ['bomb']], reuseSeenFamilies: false,
    },
    {
        id: 'climax', startMs: 45_000, endMs: 60_001, difficultyStage: 2,
        targetCount: 5, questionTimeMs: 1_850, speed: 1.38,
        themeWeights: { math: 4, vision: 4, hanzi: 3, english: 3, life: 3, geography: 3, knowledge: 4, history: 3 },
        ruleSequence: [
            ['bomb', 'multi'], ['bomb', 'reverse'], ['bomb', 'order'], ['bomb', 'rotate'],
            ['multi', 'reverse'], ['multi', 'rotate'], ['order', 'rotate'],
            ['standard'], ['reverse'], ['rotate'], ['bomb'], ['bomb', 'reverse'], ['bomb', 'rotate'],
        ], reuseSeenFamilies: true,
    },
];

const RULE_SUPPORT: Readonly<Record<ContentFamilyKind, readonly string[]>> = {
    'math-add': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'math-subtract': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'math-multiply': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'math-property': ['standard', 'multi', 'reverse', 'bomb+multi', 'multi+reverse'],
    'math-compare': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'math-sequence': ['standard', 'reverse', 'bomb', 'order', 'bomb+order'],
    'math-missing': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'math-equation': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'vision-direction': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'vision-odd': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'vision-count': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'vision-stroop': ['standard', 'bomb'],
    'vision-pattern': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'vision-match': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'hanzi-fill': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'hanzi-order': ['order', 'bomb+order'],
    'hanzi-antonym': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'hanzi-synonym': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'english-meaning': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'english-category': ['standard', 'multi', 'reverse', 'bomb+multi', 'multi+reverse'],
    'english-antonym': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'life-category': ['standard', 'multi', 'reverse', 'bomb+multi', 'multi+reverse'],
    'geography-capital': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'geography-country': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'knowledge-science': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'knowledge-nature': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'knowledge-culture': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'knowledge-civic': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'history-modern-opening': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'history-modern-awakening': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'history-modern-resistance': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'history-ancient': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
    'history-myth': ['standard', 'reverse', 'bomb', 'bomb+reverse'],
};

const TARGET_CAP_BY_KIND: Readonly<Record<ContentFamilyKind, number>> = {
    'math-add': 4,
    'math-subtract': 4,
    'math-multiply': 4,
    'math-property': 5,
    'math-compare': 4,
    'math-sequence': 4,
    'math-missing': 4,
    'math-equation': 4,
    'vision-direction': 6,
    'vision-odd': 6,
    'vision-count': 6,
    'vision-stroop': 6,
    'vision-pattern': 6,
    'vision-match': 6,
    'hanzi-fill': 4,
    'hanzi-order': 5,
    'hanzi-antonym': 4,
    'hanzi-synonym': 4,
    'english-meaning': 4,
    'english-category': 5,
    'english-antonym': 4,
    'life-category': 5,
    'geography-capital': 4,
    'geography-country': 4,
    'knowledge-science': 4,
    'knowledge-nature': 4,
    'knowledge-culture': 4,
    'knowledge-civic': 4,
    'history-modern-opening': 4,
    'history-modern-awakening': 4,
    'history-modern-resistance': 4,
    'history-ancient': 4,
    'history-myth': 4,
};

export function targetCountForFamily(
    baseCount: number,
    kind: ContentFamilyKind,
    rules: readonly RuleId[],
    bombEnabled = rules.includes('bomb'),
): number {
    const activeSlashRuleCount = slashRuleCount(rules);
    const contentMinimum = kind === 'hanzi-order' || (rules.includes('multi') && rules.includes('reverse')) ? 4 : 2;
    // Reserve one of the six portrait slots for an additive bomb while
    // retaining the requested number of answer candidates.
    const bombCap = bombEnabled ? 5 : TARGET_CAP_BY_KIND[kind];
    const dualRuleCap = activeSlashRuleCount >= 2 ? 4 : TARGET_CAP_BY_KIND[kind];
    const readabilityCap = Math.min(TARGET_CAP_BY_KIND[kind], bombCap, dualRuleCap);
    return Math.max(contentMinimum, Math.min(baseCount, readabilityCap));
}

export function phaseAt(elapsedMs: number): BrawlPhaseSettings {
    const clamped = Math.max(0, Math.min(60_000, elapsedMs));
    return BRAWL_PHASES.find((phase) => clamped >= phase.startMs && clamped < phase.endMs) ?? BRAWL_PHASES[BRAWL_PHASES.length - 1];
}

export function familySupportsRules(family: ContentFamilySpec, rules: readonly RuleId[]): boolean {
    if (rules.includes('rotate')) {
        if (rules.includes('reverse') || isDirectionSensitiveFamily(family.kind)) return false;
        const underlyingRules = rules.filter((rule) => rule !== 'rotate' && rule !== 'standard');
        return RULE_SUPPORT[family.kind].includes(ruleKey(underlyingRules.length ? underlyingRules : ['standard']));
    }
    return RULE_SUPPORT[family.kind].includes(ruleKey(rules));
}

export function isDirectionSensitiveFamily(kind: ContentFamilyKind): boolean {
    return kind === 'vision-direction' || kind === 'vision-pattern';
}

const RULE_ORDER: readonly RuleId[] = ['standard', 'reverse', 'rotate', 'multi', 'order', 'bomb'];

/** Returns every enabled rule set that at least one family in the theme can safely generate. */
export function legalRuleSetsForTheme(theme: ThemeId, enabledRules: readonly RuleId[]): RuleId[][] {
    const enabled = new Set(enabledRules);
    const candidates: RuleId[][] = [];
    if (enabled.has('standard')) candidates.push(['standard']);
    for (const rule of RULE_ORDER) if (rule !== 'standard' && enabled.has(rule)) candidates.push([rule]);
    for (const pair of RULE_PAIR_WHITELIST) {
        const rules = pair.split('+') as RuleId[];
        if (rules.every((rule) => enabled.has(rule))) candidates.push(rules);
    }
    const families = CONTENT_FAMILIES.filter((family) => family.theme === theme);
    return candidates
        .filter((rules) => validateRuleSet(rules) && families.some((family) => familySupportsRules(family, rules)))
        .map((rules) => [...rules].sort((a, b) => RULE_ORDER.indexOf(a) - RULE_ORDER.indexOf(b)));
}

function ruleKey(rules: readonly RuleId[]): string {
    return [...rules].sort().join('+');
}

