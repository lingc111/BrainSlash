import type { GameplayConfig } from '../assets/Scripts/configs/GameConfig.ts';
import type { FriendChallengeConfig, GameEntryParams, QuestionInstance, RuleId } from '../assets/Scripts/domain/Models.ts';
import { ModeQuestionDirector } from '../assets/Scripts/domain/ModeQuestionDirector.ts';
import { targetCountForTemplate, type DifficultyStage } from '../assets/Scripts/domain/QuestionPolicy.ts';
import { QuestionCompiler, templatesForRequest, type QuestionRequest } from '../assets/Scripts/domain/QuestionSystem.ts';
import type { QuestionCompilerEngineOptions } from '../assets/Scripts/domain/QuestionCompilerEngine.ts';
import type { QuestionTemplate } from '../assets/Scripts/domain/QuestionTemplateCatalog.ts';
import { SeededRng } from '../assets/Scripts/domain/SeededRng.ts';

export interface TemplateFixtureDirective {
    phase: QuestionRequest['phase'];
    difficultyStage: DifficultyStage;
    targetCount: number;
    questionTimeMs: number;
    speed: number;
    template: QuestionTemplate;
    rules: RuleId[];
}

/** Test-only bridge for focused template fixtures. Production cannot import this module. */
export class DirectiveCompilerFixture {
    private readonly compiler: QuestionCompiler;
    public constructor(rng: SeededRng, config: GameplayConfig, options: QuestionCompilerEngineOptions = {}) {
        this.compiler = new QuestionCompiler(rng, config, { mode: 'brawl60', seed: 'legacy-test', contentVersion: 'test' }, options);
    }
    public next(directive: TemplateFixtureDirective): QuestionInstance {
        return this.compiler.next({
            templateIds: [directive.template.id], themes: [directive.template.theme], rules: directive.rules,
            requiredCapabilities: directive.rules.includes('multi') ? ['multi'] : directive.rules.includes('order') ? ['order'] : [],
            difficulty: directive.difficultyStage === 0 ? 1 : directive.difficultyStage === 1 ? 3 : 5,
            targetCount: directive.targetCount, questionTimeMs: directive.questionTimeMs, speed: directive.speed, phase: directive.phase,
        }, 'test');
    }
}

class RequestFixtureBase {
    private readonly director: ModeQuestionDirector;
    public constructor(private readonly rng: SeededRng, entry: GameEntryParams, allowed?: ReadonlySet<RuleId>, compound = true) {
        this.director = new ModeQuestionDirector(rng.fork('requests'), entry, allowed, compound);
    }
    public next(elapsedMs: number): TemplateFixtureDirective {
        const request = this.director.next(elapsedMs);
        const templates = templatesForRequest(request);
        const template = this.rng.pick(templates);
        return { phase: request.phase, difficultyStage: request.difficulty <= 1 ? 0 : request.difficulty <= 3 ? 1 : 2,
            targetCount: targetCountForTemplate(request.targetCount, template, request.rules), questionTimeMs: request.questionTimeMs,
            speed: request.speed, template, rules: [...request.rules] };
    }
}

export class BrawlRequestFixture extends RequestFixtureBase {
    public constructor(rng: SeededRng, _recipe = 'mixed', allowed?: ReadonlySet<RuleId>, compound = true) {
        super(rng, { mode: 'brawl60', seed: 'legacy-brawl-test', contentVersion: 'test' }, allowed, compound);
    }
}

export class FriendChallengeRequestFixture extends RequestFixtureBase {
    public constructor(rng: SeededRng, config: FriendChallengeConfig) {
        super(rng, { mode: 'friendChallenge', seed: 'legacy-friend-test', contentVersion: 'test', challengeRole: 'creator', challengeConfig: config });
    }
}
