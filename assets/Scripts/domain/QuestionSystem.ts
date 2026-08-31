import type { GameplayConfig } from '../configs/GameConfig';
import { CONTENT_FAMILIES, type ContentFamilyKind, type ContentFamilySpec } from './ContentCatalog';
import { familySupportsRules, targetCountForFamily, type BrawlPhaseId, type TemplateCompileDirective } from './QuestionPolicy';
import type { GameEntryParams, GameplayEngineId, QuestionInstance, RuleId, ThemeId } from './Models';
import { QuestionCompilerEngine, compilerOptionsForEntry, type QuestionCompilerEngineOptions } from './QuestionCompilerEngine';
import { SeededRng } from './SeededRng';

export type QuestionCapability = 'single' | 'multi' | 'order' | 'reverse' | 'rotate' | 'bomb' | 'master-slash' | 'stroop' | 'category' | 'numeric' | 'short-text';

export interface QuestionTemplate {
    id: string;
    theme: ThemeId;
    family: ContentFamilyKind;
    engine: GameplayEngineId;
    capabilities: readonly QuestionCapability[];
    sourceKind: 'algorithmic' | 'reviewed-facts';
    tags: readonly string[];
    difficultyBands: readonly (1 | 2 | 3 | 4 | 5)[];
    enabled: boolean;
}

export interface QuestionRequest {
    templateIds?: readonly string[];
    themes?: readonly ThemeId[];
    requiredCapabilities?: readonly QuestionCapability[];
    forbiddenCapabilities?: readonly QuestionCapability[];
    requiredTags?: readonly string[];
    rules: readonly RuleId[];
    difficulty: 1 | 2 | 3 | 4 | 5;
    targetCount: number;
    questionTimeMs: number;
    speed: number;
    phase: BrawlPhaseId;
}

const META: Readonly<Record<ContentFamilyKind, Pick<QuestionTemplate, 'engine' | 'capabilities' | 'sourceKind' | 'tags'>>> = {
    'math-add': { engine: 'single', capabilities: ['single', 'numeric'], sourceKind: 'algorithmic', tags: ['arithmetic'] },
    'math-subtract': { engine: 'single', capabilities: ['single', 'numeric'], sourceKind: 'algorithmic', tags: ['arithmetic'] },
    'math-multiply': { engine: 'single', capabilities: ['single', 'numeric'], sourceKind: 'algorithmic', tags: ['arithmetic'] },
    'math-property': { engine: 'condition', capabilities: ['single', 'multi', 'master-slash', 'numeric'], sourceKind: 'algorithmic', tags: ['property'] },
    'math-compare': { engine: 'compare', capabilities: ['single', 'numeric'], sourceKind: 'algorithmic', tags: ['compare'] },
    'math-sequence': { engine: 'sequence', capabilities: ['single', 'order', 'numeric'], sourceKind: 'algorithmic', tags: ['sequence'] },
    'math-missing': { engine: 'fill', capabilities: ['single', 'numeric'], sourceKind: 'algorithmic', tags: ['fill'] },
    'math-equation': { engine: 'single', capabilities: ['single', 'numeric'], sourceKind: 'algorithmic', tags: ['equation'] },
    'vision-direction': { engine: 'single', capabilities: ['single'], sourceKind: 'algorithmic', tags: ['direction'] },
    'vision-odd': { engine: 'odd-one-out', capabilities: ['single'], sourceKind: 'algorithmic', tags: ['odd-one-out'] },
    'vision-count': { engine: 'count', capabilities: ['single', 'numeric'], sourceKind: 'algorithmic', tags: ['count'] },
    'vision-stroop': { engine: 'single', capabilities: ['single', 'stroop'], sourceKind: 'algorithmic', tags: ['stroop'] },
    'vision-pattern': { engine: 'sequence', capabilities: ['single'], sourceKind: 'algorithmic', tags: ['pattern'] },
    'vision-match': { engine: 'same', capabilities: ['single'], sourceKind: 'algorithmic', tags: ['match'] },
    'hanzi-fill': { engine: 'fill', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['idiom', 'fill'] },
    'hanzi-order': { engine: 'order', capabilities: ['order', 'short-text'], sourceKind: 'reviewed-facts', tags: ['idiom', 'order'] },
    'hanzi-antonym': { engine: 'pair', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['antonym'] },
    'hanzi-synonym': { engine: 'pair', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['synonym'] },
    'english-meaning': { engine: 'pair', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['meaning'] },
    'english-category': { engine: 'condition', capabilities: ['single', 'multi', 'master-slash', 'category', 'short-text'], sourceKind: 'reviewed-facts', tags: ['category'] },
    'english-antonym': { engine: 'pair', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['antonym'] },
    'life-category': { engine: 'condition', capabilities: ['single', 'multi', 'master-slash', 'category', 'short-text'], sourceKind: 'reviewed-facts', tags: ['category'] },
    'geography-capital': { engine: 'pair', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['capital'] },
    'geography-country': { engine: 'pair', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['country'] },
    'knowledge-science': { engine: 'single', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['science'] },
    'knowledge-nature': { engine: 'single', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['nature'] },
    'knowledge-culture': { engine: 'single', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['culture'] },
    'knowledge-civic': { engine: 'single', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['civic'] },
    'history-modern-opening': { engine: 'single', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['modern-opening'] },
    'history-modern-awakening': { engine: 'single', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['modern-awakening'] },
    'history-modern-resistance': { engine: 'single', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['modern-resistance'] },
    'history-ancient': { engine: 'single', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['ancient'] },
    'history-myth': { engine: 'single', capabilities: ['single', 'short-text'], sourceKind: 'reviewed-facts', tags: ['myth'] },
};

const FIRST_FAMILY = new Map<ContentFamilyKind, ContentFamilySpec>();
for (const family of CONTENT_FAMILIES) if (!FIRST_FAMILY.has(family.kind)) FIRST_FAMILY.set(family.kind, family);

export const QUESTION_TEMPLATES: readonly QuestionTemplate[] = Array.from(FIRST_FAMILY.values()).map((family) => ({
    id: family.kind,
    theme: family.theme,
    family: family.kind,
    ...META[family.kind],
    difficultyBands: [1, 2, 3, 4, 5],
    enabled: true,
}));

export function templatesForRequest(request: QuestionRequest): QuestionTemplate[] {
    return QUESTION_TEMPLATES.filter((template) => template.enabled
        && (!request.templateIds?.length || request.templateIds.includes(template.id))
        && (!request.themes?.length || request.themes.includes(template.theme))
        && (!request.requiredCapabilities?.some((capability) => !template.capabilities.includes(capability)))
        && (!request.forbiddenCapabilities?.some((capability) => template.capabilities.includes(capability)))
        && (!request.requiredTags?.some((tag) => !template.tags.includes(tag)))
        && template.difficultyBands.includes(request.difficulty)
        && familySupportsRules(FIRST_FAMILY.get(template.family)!, request.rules));
}

export function requestCanGenerate(request: QuestionRequest): boolean { return templatesForRequest(request).length > 0; }

export class QuestionCompiler {
    private readonly engine: QuestionCompilerEngine;
    private readonly bags = new Map<string, QuestionTemplate[]>();
    private readonly recentTemplateIds: string[] = [];

    public constructor(private readonly rng: SeededRng, config: GameplayConfig, entry: GameEntryParams, options: QuestionCompilerEngineOptions = {}) {
        this.engine = new QuestionCompilerEngine(rng.fork('instances'), config, compilerOptionsForEntry(entry, options));
    }

    public next(request: QuestionRequest, contentVersion: string): QuestionInstance {
        const candidates = templatesForRequest(request);
        if (!candidates.length) throw new Error(`No template satisfies ${JSON.stringify(request)}`);
        const key = candidates.map((item) => item.id).sort().join('|');
        let bag = this.bags.get(key);
        if (!bag?.some((item) => candidates.includes(item))) { bag = this.rng.shuffle(candidates); this.bags.set(key, bag); }
        let index = bag.length - 1;
        while (index > 0 && this.recentTemplateIds.includes(bag[index].id)) index -= 1;
        const template = bag.splice(index, 1)[0];
        if (!bag.length) this.bags.delete(key);
        this.recentTemplateIds.push(template.id);
        if (this.recentTemplateIds.length > Math.min(8, Math.max(2, candidates.length - 1))) this.recentTemplateIds.shift();
        const family: ContentFamilySpec = { id: template.id, kind: template.family, theme: template.theme, variant: Math.min(4, request.difficulty - 1) };
        const directive: TemplateCompileDirective = {
            phase: request.phase,
            difficultyStage: request.difficulty <= 1 ? 0 : request.difficulty <= 3 ? 1 : 2,
            targetCount: targetCountForFamily(request.targetCount, family.kind, request.rules),
            questionTimeMs: request.questionTimeMs,
            speed: request.speed,
            family,
            rules: [...request.rules],
            bombEnabled: request.rules.includes('bomb'),
        };
        const question = this.engine.compile(directive);
        question.templateId = template.id;
        question.typeId = template.id;
        question.engineId = template.engine;
        question.contentVersion = contentVersion;
        return question;
    }
}
