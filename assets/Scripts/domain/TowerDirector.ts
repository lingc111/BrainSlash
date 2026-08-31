import type { BrawlPhaseId } from './QuestionPolicy';
import type { RuleId, ThemeId } from './Models';
import { SeededRng } from './SeededRng';
import type { TowerQuestionPool, TowerQuestionRequest } from './TowerChallenge';
import { towerFloorConfig, type TowerFloorConfig, TOWER_DOUBLE_RULES } from './TowerMode';
import { requestCanGenerate, type QuestionCapability, type QuestionRequest } from './QuestionSystem';

export class TowerDirector {
    public readonly config: TowerFloorConfig;
    private questionIndex = 0;
    private readonly ruleBags = new Map<string, RuleId[][]>();

    public constructor(private readonly rng: SeededRng, floor: number) {
        this.config = towerFloorConfig(floor);
    }

    public next(_elapsedMs: number, request?: TowerQuestionRequest): QuestionRequest {
        const pool = request?.pool ?? defaultPool(this.config);
        const rules = this.pickRules(pool);
        this.questionIndex += 1;
        const requiredCapabilities = [...(pool.requiredCapabilities ?? [])];
        if (rules.includes('multi') && !requiredCapabilities.includes('multi')) requiredCapabilities.push('multi');
        if (rules.includes('order') && !requiredCapabilities.includes('order')) requiredCapabilities.push('order');
        const result: QuestionRequest = {
            phase: phaseForFloor(this.config.floor),
            difficulty: (this.config.difficulty.stage === 0 ? 1 : this.config.difficulty.stage === 1 ? 3 : 5),
            targetCount: this.config.difficulty.targetCount,
            questionTimeMs: this.config.difficulty.questionTimeMs,
            speed: this.config.difficulty.speed,
            themes: pool.themes,
            requiredCapabilities,
            forbiddenCapabilities: pool.forbiddenCapabilities,
            requiredTags: pool.requiredTags,
            rules,
        };
        return result;
    }

    private pickRules(pool: TowerQuestionPool): RuleId[] {
        if (this.questionIndex === 0 && this.config.unlockedRule) return [this.config.unlockedRule];
        if (this.questionIndex === 0 && this.config.unlocksCompoundRules) return ['multi', 'reverse'];
        const candidates = (pool.allowedRuleSets ?? TOWER_DOUBLE_RULES)
            .filter((rules) => !pool.requiredRules?.some((rule) => !rules.includes(rule)))
            .filter((rules) => !pool.forbiddenRules?.some((rule) => rules.includes(rule)))
            .filter((rules) => (pool.minimumComplexRuleCount ?? 0) <= rules.filter((rule) => rule !== 'standard').length)
            .filter((rules) => pool.bombPolicy !== 'required' || rules.includes('bomb'))
            .filter((rules) => pool.bombPolicy !== 'forbidden' || !rules.includes('bomb'))
            .filter((rules) => !pool.masterSlashEligible || rules.includes('multi'))
            .filter((rules) => requestCanGenerate(this.requestProbe(pool, rules)));
        if (!candidates.length) throw new Error(`No rule set supports tower floor ${this.config.floor} pool`);
        const key = JSON.stringify(candidates);
        let bag = this.ruleBags.get(key);
        if (!bag?.length) { bag = this.rng.shuffle(candidates.map((rules) => [...rules])); this.ruleBags.set(key, bag); }
        return bag.pop() ?? ['standard'];
    }

    private requestProbe(pool: TowerQuestionPool, rules: readonly RuleId[]): QuestionRequest {
        const capabilities: QuestionCapability[] = [...(pool.requiredCapabilities ?? [])];
        if (rules.includes('multi') && !capabilities.includes('multi')) capabilities.push('multi');
        if (rules.includes('order') && !capabilities.includes('order')) capabilities.push('order');
        return { themes: pool.themes, requiredCapabilities: capabilities, forbiddenCapabilities: pool.forbiddenCapabilities,
            requiredTags: pool.requiredTags, rules, difficulty: 3, targetCount: 4, questionTimeMs: 2600, speed: 1, phase: 'action' };
    }
}

function phaseForFloor(floor: number): BrawlPhaseId {
    if (floor <= 4) return 'warmup';
    if (floor <= 9) return 'action';
    if (floor <= 19) return 'twist';
    return 'climax';
}

function defaultPool(config: TowerFloorConfig): TowerQuestionPool {
    const encounter = config.challenge.encounter;
    if (encounter.type === 'pool') return encounter.pool;
    return encounter.lanes[0]?.pool ?? encounter.fallbackPool ?? { allowedRuleSets: [['standard']] };
}
