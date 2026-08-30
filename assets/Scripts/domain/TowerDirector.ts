import { CONTENT_FAMILIES, type ContentFamilySpec } from './ContentCatalog';
import { familySupportsRules, targetCountForFamily, type BrawlPhaseId, type BrawlQuestionDirective } from './Brawl60Director';
import type { RuleId, ThemeId } from './Models';
import { SeededRng } from './SeededRng';
import type { TowerQuestionPool, TowerQuestionRequest } from './TowerChallenge';
import { towerFloorConfig, type TowerFloorConfig, TOWER_DOUBLE_RULES } from './TowerMode';
import { QuestionTypeRotation } from './QuestionTypeCatalog';

export class TowerDirector {
    public readonly config: TowerFloorConfig;
    private questionIndex = 0;
    private readonly ruleBags = new Map<string, RuleId[][]>();
    private readonly familyBags = new Map<string, ContentFamilySpec[]>();
    private readonly recentFamilyIds: string[] = [];
    private readonly typeRotation: QuestionTypeRotation;

    public constructor(private readonly rng: SeededRng, floor: number) {
        this.config = towerFloorConfig(floor);
        this.typeRotation = new QuestionTypeRotation(rng.fork('question-types'));
    }

    public next(_elapsedMs: number, request?: TowerQuestionRequest): BrawlQuestionDirective {
        const pool = request?.pool ?? defaultPool(this.config);
        const rules = this.pickRules(pool);
        const compatible = CONTENT_FAMILIES.filter((family) =>
            (this.config.difficulty.themeWeights[family.theme] ?? 0) > 0
            && (!pool.themes || pool.themes.includes(family.theme))
            && (!pool.familyKinds || pool.familyKinds.includes(family.kind))
            && familySupportsRules(family, rules),
        );
        if (!compatible.length) throw new Error(`No tower content supports floor ${this.config.floor}:${rules.join('+')}`);
        const family = this.pickFamily(compatible, rules);
        this.questionIndex += 1;
        return {
            phase: phaseForFloor(this.config.floor),
            difficultyStage: this.config.difficulty.stage,
            targetCount: targetCountForFamily(this.config.difficulty.targetCount, family.kind, rules),
            questionTimeMs: this.config.difficulty.questionTimeMs,
            speed: this.config.difficulty.speed,
            family,
            rules,
            typeId: this.typeRotation.next(
                family.kind,
                (this.config.difficulty.stage + 1) as 1 | 2 | 3,
                rules,
                new Set((pool.allowedRuleSets ?? TOWER_DOUBLE_RULES).reduce<RuleId[]>((all, set) => [...all, ...set], [])),
            ),
            bombEnabled: rules.includes('bomb'),
        };
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
            .filter((rules) => CONTENT_FAMILIES.some((family) =>
                (this.config.difficulty.themeWeights[family.theme] ?? 0) > 0
                && (!pool.themes || pool.themes.includes(family.theme))
                && (!pool.familyKinds || pool.familyKinds.includes(family.kind))
                && familySupportsRules(family, rules),
            ));
        if (!candidates.length) throw new Error(`No rule set supports tower floor ${this.config.floor} pool`);
        const key = JSON.stringify(candidates);
        let bag = this.ruleBags.get(key);
        if (!bag?.length) { bag = this.rng.shuffle(candidates.map((rules) => [...rules])); this.ruleBags.set(key, bag); }
        return bag.pop() ?? ['standard'];
    }

    private pickFamily(compatible: readonly ContentFamilySpec[], rules: readonly RuleId[]): ContentFamilySpec {
        const themes = weightedThemes(this.config.difficulty.themeWeights, new Set(compatible.map((family) => family.theme)));
        const theme = this.rng.pick(themes);
        const pool = compatible.filter((family) => family.theme === theme);
        const key = `${theme}:${[...rules].sort().join('+')}`;
        let bag = this.familyBags.get(key);
        if (!bag?.some((family) => pool.some((candidate) => candidate.id === family.id))) {
            bag = this.rng.shuffle(pool);
            this.familyBags.set(key, bag);
        }
        let index = bag.length - 1;
        while (index >= 0 && this.recentFamilyIds.includes(bag[index].id)) index -= 1;
        if (index < 0) {
            bag = this.rng.shuffle(pool);
            this.familyBags.set(key, bag);
            index = bag.length - 1;
        }
        const family = bag.splice(index, 1)[0];
        this.recentFamilyIds.push(family.id);
        if (this.recentFamilyIds.length > 4) this.recentFamilyIds.shift();
        return family;
    }
}

function weightedThemes(weights: Readonly<Partial<Record<ThemeId, number>>>, available: ReadonlySet<ThemeId>): ThemeId[] {
    const result: ThemeId[] = [];
    for (const theme of Object.keys(weights) as ThemeId[]) {
        if (!available.has(theme)) continue;
        for (let index = 0; index < Math.max(1, Math.round(weights[theme] ?? 0)); index += 1) result.push(theme);
    }
    return result.length ? result : Array.from(available);
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
