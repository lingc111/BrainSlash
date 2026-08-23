import { CONTENT_FAMILIES, type ContentFamilySpec } from './ContentCatalog';
import { familySupportsRules, targetCountForFamily, type BrawlPhaseId, type BrawlQuestionDirective } from './Brawl60Director';
import type { RuleId, ThemeId } from './Models';
import { SeededRng } from './SeededRng';
import { towerFloorConfig, type TowerFloorConfig } from './TowerMode';

export class TowerDirector {
    public readonly config: TowerFloorConfig;
    private questionIndex = 0;
    private ruleBag: RuleId[][] = [];
    private readonly familyBags = new Map<string, ContentFamilySpec[]>();
    private readonly recentFamilyIds: string[] = [];

    public constructor(private readonly rng: SeededRng, floor: number) {
        this.config = towerFloorConfig(floor);
    }

    public next(_elapsedMs: number): BrawlQuestionDirective {
        const rules = this.pickRules();
        const compatible = CONTENT_FAMILIES.filter((family) =>
            (this.config.themeWeights[family.theme] ?? 0) > 0 && familySupportsRules(family, rules),
        );
        if (!compatible.length) throw new Error(`No tower content supports floor ${this.config.floor}:${rules.join('+')}`);
        const family = this.pickFamily(compatible, rules);
        this.questionIndex += 1;
        return {
            phase: phaseForFloor(this.config.floor),
            difficultyStage: this.config.difficultyStage,
            targetCount: targetCountForFamily(this.config.targetCount, family.kind, rules),
            questionTimeMs: this.config.questionTimeMs,
            speed: this.config.speed,
            family,
            rules,
        };
    }

    private pickRules(): RuleId[] {
        if (this.questionIndex === 0 && this.config.unlockedRule) return [this.config.unlockedRule];
        if (!this.ruleBag.length) this.ruleBag = this.rng.shuffle(this.config.ruleSequence.map((rules) => [...rules]));
        return this.ruleBag.pop() ?? ['standard'];
    }

    private pickFamily(compatible: readonly ContentFamilySpec[], rules: readonly RuleId[]): ContentFamilySpec {
        const themes = weightedThemes(this.config.themeWeights, new Set(compatible.map((family) => family.theme)));
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
    return result.length ? result : [...available];
}

function phaseForFloor(floor: number): BrawlPhaseId {
    if (floor <= 4) return 'warmup';
    if (floor <= 9) return 'action';
    if (floor <= 19) return 'twist';
    return 'climax';
}
