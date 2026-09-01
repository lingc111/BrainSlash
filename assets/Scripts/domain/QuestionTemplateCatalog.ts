import type { GameplayEngineId, RuleId, ThemeId } from './Models';

export type QuestionTemplateId =
    | 'math-add' | 'math-subtract' | 'math-multiply' | 'math-property'
    | 'math-compare' | 'math-sequence' | 'math-missing' | 'math-equation'
    | 'math-divide' | 'math-mixed' | 'math-operator' | 'math-digit-reverse' | 'math-remainder' | 'math-fraction-compare'
    | 'vision-direction' | 'vision-odd' | 'vision-count' | 'vision-stroop' | 'vision-pattern' | 'vision-match'
    | 'vision-mirror' | 'vision-symmetry' | 'vision-grid-position' | 'vision-rotation'
    | 'hanzi-fill' | 'hanzi-order' | 'hanzi-antonym' | 'hanzi-synonym' | 'hanzi-pinyin' | 'hanzi-poetry'
    | 'hanzi-radical' | 'hanzi-homophone' | 'hanzi-compose'
    | 'english-meaning' | 'english-category' | 'english-antonym' | 'english-first-letter' | 'english-length'
    | 'english-missing-letter' | 'english-synonym' | 'english-word-order'
    | 'life-category' | 'life-use' | 'life-place' | 'life-public-sign' | 'life-safe-behavior' | 'life-process'
    | 'geography-capital' | 'geography-country' | 'geography-continent' | 'geography-landmark'
    | 'geography-province-capital' | 'geography-relative-position'
    | 'knowledge-science' | 'knowledge-nature' | 'knowledge-culture' | 'knowledge-civic'
    | 'knowledge-astronomy' | 'knowledge-biology' | 'knowledge-physics' | 'knowledge-technology'
    | 'history-modern-opening' | 'history-modern-awakening' | 'history-modern-resistance'
    | 'history-ancient' | 'history-myth' | 'history-chronology' | 'history-person-event';

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
    /** Every generated target stays below the rotation readability cutoff. */
    rotationSafe: boolean;
    enabled: boolean;
}

const DIFFICULTIES: readonly DifficultyBand[] = [1, 2, 3, 4, 5];
const CHOICE_RULES: readonly (readonly RuleId[])[] = [['standard'], ['reverse'], ['bomb'], ['bomb', 'reverse']];
const MULTI_RULES: readonly (readonly RuleId[])[] = [['standard'], ['multi'], ['reverse'], ['bomb', 'multi'], ['multi', 'reverse']];
const SEQUENCE_RULES: readonly (readonly RuleId[])[] = [['standard'], ['reverse'], ['bomb'], ['order'], ['bomb', 'order']];
const ORDER_RULES: readonly (readonly RuleId[])[] = [['order'], ['bomb', 'order']];
const STROOP_RULES: readonly (readonly RuleId[])[] = [['standard'], ['bomb']];
const ROTATION_SAFE_TEMPLATE_IDS = new Set<QuestionTemplateId>([
    'math-property', 'math-compare', 'math-sequence',
    'vision-odd', 'vision-match', 'vision-symmetry',
    'hanzi-fill', 'hanzi-order', 'hanzi-radical', 'hanzi-homophone', 'hanzi-compose',
    'english-first-letter', 'english-length', 'english-missing-letter',
]);

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
        supportedRuleSets, targetCap, directionSensitive, rotationSafe: ROTATION_SAFE_TEMPLATE_IDS.has(id), enabled: true };
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
    define('math-divide', 'math', 'single', ['single', 'numeric'], 'algorithmic', ['arithmetic', 'division']),
    define('math-mixed', 'math', 'single', ['single', 'numeric'], 'algorithmic', ['arithmetic', 'mixed-operation']),
    define('math-operator', 'math', 'fill', ['single', 'short-text'], 'algorithmic', ['arithmetic', 'operator']),
    define('math-digit-reverse', 'math', 'single', ['single', 'numeric'], 'algorithmic', ['digit-reverse']),
    define('math-remainder', 'math', 'single', ['single', 'numeric'], 'algorithmic', ['arithmetic', 'remainder']),
    define('math-fraction-compare', 'math', 'compare', ['single', 'numeric'], 'algorithmic', ['fraction', 'compare']),
    define('vision-direction', 'vision', 'single', ['single'], 'algorithmic', ['direction'], CHOICE_RULES, 6, true),
    define('vision-odd', 'vision', 'odd-one-out', ['single'], 'algorithmic', ['odd-one-out'], CHOICE_RULES, 6),
    define('vision-count', 'vision', 'count', ['single', 'numeric'], 'algorithmic', ['count'], CHOICE_RULES, 6),
    define('vision-stroop', 'vision', 'single', ['single', 'stroop'], 'algorithmic', ['stroop'], STROOP_RULES, 6),
    define('vision-pattern', 'vision', 'sequence', ['single'], 'algorithmic', ['pattern'], CHOICE_RULES, 6, true),
    define('vision-match', 'vision', 'same', ['single'], 'algorithmic', ['match'], CHOICE_RULES, 6),
    define('vision-mirror', 'vision', 'single', ['single'], 'algorithmic', ['mirror'], CHOICE_RULES, 6, true),
    define('vision-symmetry', 'vision', 'odd-one-out', ['single'], 'algorithmic', ['symmetry'], CHOICE_RULES, 6),
    define('vision-grid-position', 'vision', 'single', ['single'], 'algorithmic', ['grid-position'], CHOICE_RULES, 6),
    define('vision-rotation', 'vision', 'single', ['single'], 'algorithmic', ['rotation'], CHOICE_RULES, 6, true),
    define('hanzi-fill', 'hanzi', 'fill', ['single', 'short-text'], 'reviewed-facts', ['idiom', 'fill']),
    define('hanzi-order', 'hanzi', 'order', ['order', 'short-text'], 'reviewed-facts', ['idiom', 'order'], ORDER_RULES, 5),
    define('hanzi-antonym', 'hanzi', 'pair', ['single', 'short-text'], 'reviewed-facts', ['antonym']),
    define('hanzi-synonym', 'hanzi', 'pair', ['single', 'short-text'], 'reviewed-facts', ['synonym']),
    define('hanzi-pinyin', 'hanzi', 'pair', ['single', 'short-text'], 'reviewed-facts', ['pinyin']),
    define('hanzi-poetry', 'hanzi', 'fill', ['single', 'short-text'], 'reviewed-facts', ['poetry', 'fill']),
    define('hanzi-radical', 'hanzi', 'pair', ['single', 'short-text'], 'reviewed-facts', ['radical']),
    define('hanzi-homophone', 'hanzi', 'pair', ['single', 'short-text'], 'reviewed-facts', ['homophone']),
    define('hanzi-compose', 'hanzi', 'pair', ['single', 'short-text'], 'reviewed-facts', ['character-compose']),
    define('english-meaning', 'english', 'pair', ['single', 'short-text'], 'reviewed-facts', ['meaning']),
    define('english-category', 'english', 'condition', ['single', 'multi', 'master-slash', 'category', 'short-text'], 'reviewed-facts', ['category'], MULTI_RULES, 5),
    define('english-antonym', 'english', 'pair', ['single', 'short-text'], 'reviewed-facts', ['antonym']),
    define('english-first-letter', 'english', 'single', ['single', 'short-text'], 'reviewed-facts', ['spelling', 'first-letter']),
    define('english-length', 'english', 'count', ['single', 'numeric'], 'reviewed-facts', ['spelling', 'length']),
    define('english-missing-letter', 'english', 'fill', ['single', 'short-text'], 'reviewed-facts', ['spelling', 'fill']),
    define('english-synonym', 'english', 'pair', ['single', 'short-text'], 'reviewed-facts', ['synonym']),
    define('english-word-order', 'english', 'order', ['order', 'short-text'], 'reviewed-facts', ['sentence', 'order'], ORDER_RULES, 5),
    define('life-category', 'life', 'condition', ['single', 'multi', 'master-slash', 'category', 'short-text'], 'reviewed-facts', ['category'], MULTI_RULES, 5),
    define('life-use', 'life', 'pair', ['single', 'short-text'], 'reviewed-facts', ['item-use']),
    define('life-place', 'life', 'pair', ['single', 'short-text'], 'reviewed-facts', ['item-place']),
    define('life-public-sign', 'life', 'pair', ['single', 'short-text'], 'reviewed-facts', ['public-sign']),
    define('life-safe-behavior', 'life', 'single', ['single', 'short-text'], 'reviewed-facts', ['safe-behavior']),
    define('life-process', 'life', 'order', ['order', 'short-text'], 'reviewed-facts', ['daily-process', 'order'], ORDER_RULES, 5),
    define('geography-capital', 'geography', 'pair', ['single', 'short-text'], 'reviewed-facts', ['capital']),
    define('geography-country', 'geography', 'pair', ['single', 'short-text'], 'reviewed-facts', ['country']),
    define('geography-continent', 'geography', 'pair', ['single', 'short-text'], 'reviewed-facts', ['continent']),
    define('geography-landmark', 'geography', 'pair', ['single', 'short-text'], 'reviewed-facts', ['landmark']),
    define('geography-province-capital', 'geography', 'pair', ['single', 'short-text'], 'reviewed-facts', ['province-capital']),
    define('geography-relative-position', 'geography', 'pair', ['single', 'short-text'], 'reviewed-facts', ['relative-position']),
    define('knowledge-science', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['science']),
    define('knowledge-nature', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['nature']),
    define('knowledge-culture', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['culture']),
    define('knowledge-civic', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['civic']),
    define('knowledge-astronomy', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['astronomy']),
    define('knowledge-biology', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['biology']),
    define('knowledge-physics', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['physics']),
    define('knowledge-technology', 'knowledge', 'single', ['single', 'short-text'], 'reviewed-facts', ['technology']),
    define('history-modern-opening', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['modern-opening']),
    define('history-modern-awakening', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['modern-awakening']),
    define('history-modern-resistance', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['modern-resistance']),
    define('history-ancient', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['ancient']),
    define('history-myth', 'history', 'single', ['single', 'short-text'], 'reviewed-facts', ['myth']),
    define('history-chronology', 'history', 'order', ['order', 'short-text'], 'reviewed-facts', ['chronology', 'order'], ORDER_RULES, 5),
    define('history-person-event', 'history', 'pair', ['single', 'short-text'], 'reviewed-facts', ['person-event']),
];

const TEMPLATE_BY_ID = new Map(QUESTION_TEMPLATES.map((template) => [template.id, template]));

export function questionTemplateById(id: QuestionTemplateId): QuestionTemplate {
    const template = TEMPLATE_BY_ID.get(id);
    if (!template) throw new Error(`Unknown question template: ${id}`);
    return template;
}
