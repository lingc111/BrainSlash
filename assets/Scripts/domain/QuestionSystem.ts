import type { GameplayConfig } from '../configs/GameConfig';
import { targetCountForTemplate, templateSupportsRules, type BrawlPhaseId, type QuestionCompileDirective } from './QuestionPolicy';
import type { GameEntryParams, QuestionInstance, RuleId, ThemeId } from './Models';
import { QuestionCompilerEngine, compilerOptionsForEntry, type QuestionCompilerEngineOptions } from './QuestionCompilerEngine';
import { QUESTION_TEMPLATES, type DifficultyBand, type QuestionCapability, type QuestionTemplate, type QuestionTemplateId } from './QuestionTemplateCatalog';
import { SeededRng } from './SeededRng';

export { QUESTION_TEMPLATES } from './QuestionTemplateCatalog';
export type { DifficultyBand, QuestionCapability, QuestionTemplate, QuestionTemplateId } from './QuestionTemplateCatalog';

export interface QuestionRequest {
    templateIds?: readonly QuestionTemplateId[];
    themes?: readonly ThemeId[];
    requiredCapabilities?: readonly QuestionCapability[];
    forbiddenCapabilities?: readonly QuestionCapability[];
    requiredTags?: readonly string[];
    rules: readonly RuleId[];
    difficulty: DifficultyBand;
    targetCount: number;
    questionTimeMs: number;
    speed: number;
    phase: BrawlPhaseId;
}

export function templatesForRequest(request: QuestionRequest): QuestionTemplate[] {
    return QUESTION_TEMPLATES.filter((template) => template.enabled
        && (!request.templateIds?.length || request.templateIds.includes(template.id))
        && (!request.themes?.length || request.themes.includes(template.theme))
        && (!request.requiredCapabilities?.some((capability) => !template.capabilities.includes(capability)))
        && (!request.forbiddenCapabilities?.some((capability) => template.capabilities.includes(capability)))
        && (!request.requiredTags?.some((tag) => !template.tags.includes(tag)))
        && template.difficultyBands.includes(request.difficulty)
        && templateSupportsRules(template, request.rules));
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
        const directive: QuestionCompileDirective = {
            phase: request.phase,
            difficultyStage: request.difficulty <= 1 ? 0 : request.difficulty <= 3 ? 1 : 2,
            difficulty: request.difficulty,
            targetCount: targetCountForTemplate(request.targetCount, template, request.rules),
            questionTimeMs: request.questionTimeMs,
            speed: request.speed,
            template,
            rules: [...request.rules],
            contentVersion,
            bombEnabled: request.rules.includes('bomb'),
        };
        return this.engine.compile(directive);
    }
}
