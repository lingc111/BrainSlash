import { BRAWL_ARITHMETIC_RATIOS, BRAWL_PHASES, legalRuleSetsForTheme, phaseAt } from './QuestionPolicy';
import type { FriendChallengeConfig, GameEntryParams, RuleId, ThemeId } from './Models';
import type { QuestionCapability, QuestionRequest } from './QuestionSystem';
import { requestCanGenerate } from './QuestionSystem';
import { SeededRng } from './SeededRng';

/** Builds mode intent only. It never chooses a template or content source. */
export class ModeQuestionDirector {
    private readonly ruleBags = new Map<string, RuleId[][]>();
    private themeBag: ThemeId[] = [];
    private readonly mixCredits = new Map<string, number>();

    public constructor(
        private readonly rng: SeededRng,
        private readonly entry: GameEntryParams,
        private readonly allowedBrawlRules?: ReadonlySet<RuleId>,
        private readonly allowCompoundRules = true,
    ) {}

    public next(elapsedMs: number): QuestionRequest {
        const phase = phaseAt(this.normalizedElapsed(elapsedMs));
        const forceBrawlArithmetic = this.entry.mode === 'brawl60'
            && this.consumeMixCredit(`brawl:${phase.id}`, BRAWL_ARITHMETIC_RATIOS[phase.id]);
        const themes = forceBrawlArithmetic ? ['math' as const] : this.themesForQuestion(phase.themeWeights);
        const forceSelectedMathArithmetic = !forceBrawlArithmetic && themes[0] === 'math'
            && (this.entry.mode === 'daily'
                ? this.consumeMixCredit('daily:math', 0.75)
                : this.entry.mode === 'friendChallenge' && this.consumeMixCredit('friend:math', 0.8));
        let requiredTags = forceBrawlArithmetic || forceSelectedMathArithmetic ? ['arithmetic'] : [];
        if (requiredTags.length && this.entry.mode === 'friendChallenge') {
            const enabledRules = (this.entry.challengeConfig as FriendChallengeConfig).enabledRules;
            const supportsArithmetic = legalRuleSetsForTheme(themes[0], enabledRules).some((rules) => requestCanGenerate({
                themes, requiredTags, rules, difficulty: 3, targetCount: 4,
                questionTimeMs: 2_600, speed: 1, phase: 'action',
            }));
            if (!supportsArithmetic) requiredTags = [];
        }
        const rules = this.pickRules(phase.id, phase.ruleSequence, themes, requiredTags);
        const requiredCapabilities: QuestionCapability[] = [];
        if (rules.includes('multi')) requiredCapabilities.push('multi');
        if (rules.includes('order')) requiredCapabilities.push('order');
        return {
            themes,
            requiredTags,
            requiredCapabilities,
            rules,
            difficulty: (phase.difficultyStage === 0 ? 1 : phase.difficultyStage === 1 ? 3 : 5),
            targetCount: phase.targetCount,
            questionTimeMs: phase.questionTimeMs,
            speed: phase.speed,
            phase: phase.id,
        };
    }

    private normalizedElapsed(elapsedMs: number): number {
        const duration = this.entry.challengeConfig?.durationMs ?? 60_000;
        return this.entry.mode === 'friendChallenge' ? elapsedMs * 60_000 / duration : elapsedMs;
    }

    private themesForQuestion(weights: Readonly<Partial<Record<ThemeId, number>>>): ThemeId[] {
        if (this.entry.mode === 'daily') {
            if (!this.entry.dailyTheme) throw new Error('Daily entry is missing its selected theme');
            return [this.entry.dailyTheme];
        }
        const configured = this.entry.challengeConfig?.themeIds;
        if (this.entry.mode === 'friendChallenge' && configured?.length) {
            if (!this.themeBag.length) this.themeBag = this.rng.shuffle(configured);
            return [this.themeBag.pop()!];
        }
        const weighted: ThemeId[] = [];
        for (const [theme, weight] of Object.entries(weights) as [ThemeId, number][]) {
            for (let index = 0; index < Math.max(0, Math.round(weight)); index += 1) weighted.push(theme);
        }
        return [this.rng.pick(weighted)];
    }

    private consumeMixCredit(key: string, ratio: number): boolean {
        const credit = (this.mixCredits.get(key) ?? 0) + ratio;
        if (credit < 1) { this.mixCredits.set(key, credit); return false; }
        this.mixCredits.set(key, credit - 1);
        return true;
    }

    private pickRules(
        phaseId: string,
        configuredSets: readonly (readonly RuleId[])[],
        themes: readonly ThemeId[],
        requiredTags: readonly string[],
    ): RuleId[] {
        let candidates: RuleId[][];
        if (this.entry.mode === 'friendChallenge') {
            const config = this.entry.challengeConfig as FriendChallengeConfig;
            candidates = legalRuleSetsForTheme(themes[0], config.enabledRules);
        } else {
            candidates = configuredSets.map((set) => [...set])
                .filter((set) => this.entry.mode !== 'brawl60' || set.every((rule) => rule === 'standard' || this.allowedBrawlRules?.has(rule)))
                .filter((set) => this.entry.mode !== 'brawl60' || this.allowCompoundRules || set.filter((rule) => rule !== 'standard').length <= 1);
        }
        candidates = candidates.filter((rules) => requestCanGenerate({
            themes, rules, requiredCapabilities: rules.includes('multi') ? ['multi'] : rules.includes('order') ? ['order'] : [],
            requiredTags,
            difficulty: 3, targetCount: 4, questionTimeMs: 2_600, speed: 1, phase: 'action',
        }));
        if (!candidates.length) candidates = [['standard']];
        const key = `${phaseId}:${themes.join(',')}:${requiredTags.join(',')}:${candidates.map((item) => item.join('+')).join('|')}`;
        let bag = this.ruleBags.get(key);
        if (!bag?.length) { bag = this.rng.shuffle(candidates); this.ruleBags.set(key, bag); }
        return [...bag.pop()!];
    }
}

export function endlessPhaseCount(): number { return BRAWL_PHASES.length; }
