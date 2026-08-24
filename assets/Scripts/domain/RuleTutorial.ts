import type { BrawlQuestionDirective } from './Brawl60Director';
import { familySupportsRules } from './Brawl60Director';
import { CONTENT_FAMILIES } from './ContentCatalog';
import type { FailureKind, RuleId } from './Models';

export type TutorialProgress = Readonly<Partial<Record<RuleId, boolean>>>;

export interface RuleTutorialSpec {
    rule: Exclude<RuleId, 'standard'>;
    name: string;
    instruction: string;
}

export interface PreparedTutorialDirective {
    directive: BrawlQuestionDirective;
    tutorial: RuleTutorialSpec | null;
}

const TUTORIALS: Readonly<Record<Exclude<RuleId, 'standard'>, Omit<RuleTutorialSpec, 'rule'>>> = {
    reverse: { name: '反向', instruction: '斩错误项' },
    rotate: { name: '旋转', instruction: '目标会持续旋转' },
    multi: { name: '多选', instruction: '正确目标全部斩完' },
    order: { name: '顺序', instruction: '按提示顺序斩' },
    bomb: { name: '禁区', instruction: '避开“爆”' },
};

export function prepareRuleTutorial(
    directive: BrawlQuestionDirective,
    learned: TutorialProgress,
): PreparedTutorialDirective {
    const unlearned = directive.rules.filter((candidate): candidate is Exclude<RuleId, 'standard'> =>
        candidate !== 'standard' && !learned[candidate],
    );
    if (!unlearned.length) return { directive, tutorial: null };
    const supportedRule = unlearned.find((candidate) => familySupportsRules(directive.family, [candidate]));
    const rule = supportedRule ?? unlearned[0];
    const family = supportedRule
        ? directive.family
        : CONTENT_FAMILIES.find((candidate) => familySupportsRules(candidate, [rule]));
    if (!family) throw new Error(`No content family can teach ${rule} independently.`);
    return {
        directive: {
            ...directive,
            family,
            rules: [rule],
            targetCount: Math.min(4, directive.targetCount),
            questionTimeMs: Math.max(3_400, directive.questionTimeMs),
            speed: Math.min(0.76, directive.speed),
        },
        tutorial: { rule, ...TUTORIALS[rule] },
    };
}

export function tutorialRetryInstruction(tutorial: RuleTutorialSpec, failure: FailureKind): string {
    if (failure === 'bomb') return '避开炸弹 · 再斩一次';
    if (failure === 'orderError') return '顺序不对 · 再斩一次';
    if (failure === 'miss') return `别漏目标 · ${tutorial.instruction}`;
    return `${tutorial.instruction} · 再斩一次`;
}
