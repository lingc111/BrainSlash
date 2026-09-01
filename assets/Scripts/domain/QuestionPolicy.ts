import { RULE_PAIR_WHITELIST, validateRuleSet } from '../configs/GameConfig';
import { QUESTION_TEMPLATES, type QuestionTemplate } from './QuestionTemplateCatalog';
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
}

/** Internal parameters passed from the unified compiler to one concrete template algorithm. */
export interface QuestionCompileDirective {
    phase: BrawlPhaseId;
    difficultyStage: DifficultyStage;
    difficulty: 1 | 2 | 3 | 4 | 5;
    targetCount: number;
    questionTimeMs: number;
    speed: number;
    template: QuestionTemplate;
    rules: RuleId[];
    contentVersion: string;
    /** Bomb is a gameplay hazard, independent from the selectable slash rules. */
    bombEnabled?: boolean;
}

/** Target share of all questions that should be direct mental arithmetic. */
export const BRAWL_ARITHMETIC_RATIOS: Readonly<Record<BrawlPhaseId, number>> = {
    warmup: 0.6,
    action: 0.45,
    twist: 0.4,
    climax: 0.4,
};

export const BRAWL_PHASES: readonly BrawlPhaseSettings[] = [
    {
        id: 'warmup', startMs: 0, endMs: 10_000, difficultyStage: 0,
        targetCount: 3, questionTimeMs: 3_000, speed: 0.72,
        // Arithmetic is injected by the rolling quota. Remaining warmup slots
        // intentionally use vision so math does not crowd out the full catalog.
        themeWeights: { vision: 2 },
        ruleSequence: [['standard']],
    },
    {
        id: 'action', startMs: 10_000, endMs: 25_000, difficultyStage: 1,
        targetCount: 4, questionTimeMs: 2_600, speed: 0.95,
        themeWeights: { math: 1, vision: 4, hanzi: 3, english: 2, life: 2, geography: 2, knowledge: 4, history: 2 },
        ruleSequence: [
            ['multi'], ['bomb'], ['standard'], ['order'], ['bomb'], ['reverse'], ['rotate'],
            ['standard'], ['bomb'], ['standard'],
        ],
    },
    {
        id: 'twist', startMs: 25_000, endMs: 45_000, difficultyStage: 2,
        targetCount: 5, questionTimeMs: 2_250, speed: 1.15,
        themeWeights: { math: 1, vision: 4, hanzi: 3, english: 3, life: 3, geography: 3, knowledge: 4, history: 3 },
        ruleSequence: [
            ['rotate'], ['standard'], ['multi'], ['standard'], ['bomb'], ['order'], ['bomb'], ['reverse'],
            ['standard'], ['bomb'], ['standard'],
        ],
    },
    {
        id: 'climax', startMs: 45_000, endMs: 60_001, difficultyStage: 2,
        targetCount: 5, questionTimeMs: 1_850, speed: 1.38,
        themeWeights: { math: 1, vision: 4, hanzi: 3, english: 3, life: 3, geography: 3, knowledge: 4, history: 3 },
        ruleSequence: [
            ['bomb', 'multi'], ['bomb', 'reverse'], ['bomb', 'order'], ['bomb', 'rotate'],
            ['multi', 'reverse'], ['multi', 'rotate'], ['order', 'rotate'],
            ['standard'], ['rotate'], ['bomb'], ['bomb', 'rotate'],
            ['standard'], ['bomb'], ['standard'], ['bomb'],
        ],
    },
];

export function targetCountForTemplate(
    baseCount: number,
    template: QuestionTemplate,
    rules: readonly RuleId[],
    bombEnabled = rules.includes('bomb'),
): number {
    const activeSlashRuleCount = slashRuleCount(rules);
    const contentMinimum = template.capabilities.includes('order') || (rules.includes('multi') && rules.includes('reverse')) ? 4 : 2;
    const bombCap = bombEnabled ? 5 : template.targetCap;
    const dualRuleCap = activeSlashRuleCount >= 2 ? 4 : template.targetCap;
    return Math.max(contentMinimum, Math.min(baseCount, template.targetCap, bombCap, dualRuleCap));
}
export function phaseAt(elapsedMs: number): BrawlPhaseSettings {
    const clamped = Math.max(0, Math.min(60_000, elapsedMs));
    return BRAWL_PHASES.find((phase) => clamped >= phase.startMs && clamped < phase.endMs) ?? BRAWL_PHASES[BRAWL_PHASES.length - 1];
}

export function templateSupportsRules(template: QuestionTemplate, rules: readonly RuleId[]): boolean {
    if (rules.includes('rotate')) {
        if (rules.includes('reverse') || template.directionSensitive || !template.rotationSafe) return false;
        const underlyingRules = rules.filter((rule) => rule !== 'rotate' && rule !== 'standard');
        return template.supportedRuleSets.some((supported) => ruleKey(supported) === ruleKey(underlyingRules.length ? underlyingRules : ['standard']));
    }
    return template.supportedRuleSets.some((supported) => ruleKey(supported) === ruleKey(rules));
}

export function isDirectionSensitiveTemplate(template: QuestionTemplate): boolean {
    return template.directionSensitive === true;
}
const RULE_ORDER: readonly RuleId[] = ['standard', 'reverse', 'rotate', 'multi', 'order', 'bomb'];

/** Returns every enabled rule set that at least one template in the theme can safely generate. */
export function legalRuleSetsForTheme(theme: ThemeId, enabledRules: readonly RuleId[]): RuleId[][] {
    const enabled = new Set(enabledRules);
    const candidates: RuleId[][] = [];
    if (enabled.has('standard')) candidates.push(['standard']);
    for (const rule of RULE_ORDER) if (rule !== 'standard' && enabled.has(rule)) candidates.push([rule]);
    for (const pair of RULE_PAIR_WHITELIST) {
        const rules = pair.split('+') as RuleId[];
        if (rules.every((rule) => enabled.has(rule))) candidates.push(rules);
    }
    const templates = QUESTION_TEMPLATES.filter((template) => template.enabled && template.theme === theme);
    return candidates
        .filter((rules) => validateRuleSet(rules) && templates.some((template) => templateSupportsRules(template, rules)))
        .map((rules) => [...rules].sort((a, b) => RULE_ORDER.indexOf(a) - RULE_ORDER.indexOf(b)));
}

function ruleKey(rules: readonly RuleId[]): string {
    return [...rules].sort().join('+');
}

