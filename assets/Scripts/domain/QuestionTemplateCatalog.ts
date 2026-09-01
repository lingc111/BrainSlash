import type { GameplayEngineId, RuleId, ThemeId } from './Models';

export type QuestionTemplateId =
    | 'math-add' | 'math-subtract' | 'math-multiply' | 'math-property'
    | 'math-compare' | 'math-sequence' | 'math-missing' | 'math-equation'
    | 'vision-direction' | 'vision-odd' | 'vision-count' | 'vision-stroop' | 'vision-pattern' | 'vision-match'
    | 'hanzi-fill' | 'hanzi-order' | 'hanzi-antonym' | 'hanzi-synonym'
    | 'english-meaning' | 'english-category' | 'english-antonym'
    | 'life-category' | 'geography-capital' | 'geography-country'
    | 'knowledge-science' | 'knowledge-nature' | 'knowledge-culture' | 'knowledge-civic'
    | 'history-modern-opening' | 'history-modern-awakening' | 'history-modern-resistance'
    | 'history-ancient' | 'history-myth';

export type QuestionCapability =
    | 'single' | 'multi' | 'order' | 'reverse' | 'rotate' | 'bomb'
    | 'master-slash' | 'stroop' | 'category' | 'numeric' | 'short-text';

export type DifficultyBand = 1 | 2 | 3 | 4 | 5;

export interface QuestionTemplate {
    id: QuestionTemplateId;
    theme: ThemeId;
    engine: GameplayEngineId;
    capabilities: readonly QuestionCapability[];
    sourceKind: 'algorithmic' | 'reviewed-facts';
    tags: readonly string[];
    difficultyBands: readonly DifficultyBand[];
    supportedRuleSets: readonly (readonly RuleId[])[];
    targetCap: number;
    directionSensitive?: boolean;
    enabled: boolean;
}

const DIFFICULTIES: readonly DifficultyBand[] = [1, 2, 3, 4, 5];
const CHOICE_RULES: readonly (readonly RuleId[])[] = [['standard'], ['reverse'], ['bomb'], ['bomb', 'reverse']];
const MULTI_RULES: readonly (readonly RuleId[])[] = [['standard'], ['multi'], ['reverse'], ['bomb', 'multi'], ['multi', 'reverse']];
const SEQUENCE_RULES: readonly (readonly RuleId[])[] = [['standard'], ['reverse'], ['bomb'], ['order'], ['bomb', 'order']];
const ORDER_RULES: readonly (readonly RuleId[])[] = [['order'], ['bomb', 'order']];
const STROOP_RULES: readonly (readonly RuleId[])[] = [['standard'], ['bomb']];

function define(
    id: QuestionTemplateId,
    theme: ThemeId,
    engine: GameplayEngineId,
    capabilities: readonly QuestionCapability[],
    sourceKind: QuestionTemplate['sourceKind'],
    tags: readonly string[],
    supportedRuleSets: readonly (readonly RuleId[])[] = CHOICE_RULES,
    targetCap = 4,
    directionSensitive = false,
): QuestionTemplate {
    return { id, theme, engine, capabilities, sourceKind, tags, difficultyBands: DIFFICULTIES,
        supportedRuleSets, targetCap, directionSensitive, enabled: true };
}

export const QUESTION_TEMPLATES: readonly QuestionTemplate[] = [
    define('math-add', 'math', 'single', ['single', 'numeric'], 'algorithmic', ['arithmetic']),
    define('math-subtract', 'math', 'single', ['single', 'numeric'], 'algorithmic', ['arithmetic']),
    define('math-multiply', 'math', 'single', ['single', 'numeric'], 'algorithmic', ['arithmetic']),
    define('math-property', 'math', 'condition', ['single', 'multi', 'master-slash', 'numeric'], 'algorithmic', ['property'], MULTI_RULES, 5),
    define('math-compare', 'math', 'compare', ['single', 'numeric'], 'algorithmic', ['compare']),
    define('math-sequence', 'math', 'sequence', ['single', 'order', 'numeric'], 'algorithmic', ['sequence'], SEQUENCE_RULES),
    define('math-missing', 'math', 'fill', ['single', 'numeric'], 'algorithmic', ['fill']),
    define('math-equation', 'math', 'single', ['single', 'numeric'], 'algorithmic', ['equation']),
    define('vision-direction', 'vision', 'single', ['single'], 'algorithmic', ['direction'], CHOICE_RULES, 6, true),
    define('vision-odd', 'vision', 'odd-one-out', ['single'], 'algorithmic', ['odd-one-out'], CHOICE_RULES, 6),
    define('vision-count', 'vision', 'count', ['single', 'numeric'], 'algorithmic', ['count'], CHOICE_RULES, 6),
    define('vision-stroop', 'vision', 'single', ['single', 'stroop'], 'algorithmic', ['stroop'], STROOP_RULES, 6),
    define('vision-pattern', 'vision', 'sequence', ['single'], 'algorithmic', ['pattern'], CHOICE_RULES, 6, true),
    define('vision-match', 'vision', 'same', ['single'], 'algorithmic', ['match'], CHOICE_RULES, 6),
    define('hanzi-fill', 'hanzi', 'fill', ['single', 'short-text'], 'reviewed-facts', ['idiom', 'fill']),
    define('hanzi-order', 'hanzi', 'order', ['order', 'short-text'], 'reviewed-facts', ['idiom', 'order'], ORDER_RULES, 5),
    define('hanzi-antonym', 'hanzi', 'pair', ['single', 'short-text'], 'reviewed-facts', ['antonym']),
    define('hanzi-synonym', 'hanzi', 'pair', ['single', 'short-text'], 'reviewed-facts', ['synonym']),
    define('english-meaning', 'english', 'pair', ['single', 'short-text'], 'reviewed-facts', ['meaning']),
    define('english-category', 'english', 'condition', ['single', 'multi', 'master-slash', 'category', 'short-text'], 'reviewed-facts', ['category'], MULTI_RULES, 5),
    define('english-antonym', 'english', 'pair', ['single', 'short-text'], 'reviewed-facts', ['antonym']),
    define('life-category', 'life', 'condition', ['single', 'multi', 'master-slash', 'category', 'short-text'], 'reviewed-facts', ['category'], MULTI_RULES, 5),
    define('geography-capital', 'geography', 'pair', ['single', 'short-text'], 'reviewed-facts', ['capital']),
    define('geography-country', 'geography', 'pair', ['single', 'short-text'], 'reviewed-facts', ['country']),
    define('knowledge-science', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['science']),
    define('knowledge-nature', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['nature']),
    define('knowledge-culture', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['culture']),
    define('knowledge-civic', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['civic']),
    define('history-modern-opening', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['modern-opening']),
    define('history-modern-awakening', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['modern-awakening']),
    define('history-modern-resistance', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['modern-resistance']),
    define('history-ancient', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['ancient']),
    define('history-myth', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['myth']),
];

const TEMPLATE_BY_ID = new Map(QUESTION_TEMPLATES.map((template) => [template.id, template]));

export function questionTemplateById(id: QuestionTemplateId): QuestionTemplate {
    const template = TEMPLATE_BY_ID.get(id);
    if (!template) throw new Error(`Unknown question template: ${id}`);
    return template;
}
