import { validateRuleSet } from '../configs/GameConfig';
import type { ActionConstraint, QuestionInstance, RuleId } from './Models';

const SLASH_RULE_LABELS: Readonly<Partial<Record<RuleId, string>>> = {
    reverse: '反向',
    rotate: '旋转',
    multi: '多选',
    order: '顺序',
};

export function slashRuleCount(rules: readonly RuleId[]): number {
    return rules.filter((rule) => rule !== 'standard' && rule !== 'bomb').length;
}

export function questionPreviewDurationSeconds(rules: readonly RuleId[]): number {
    return slashRuleCount(rules) >= 2 ? 0.7 : 0.3;
}

export function slashRuleLabel(rules: readonly RuleId[]): string {
    const labels = rules
        .filter((rule) => rule !== 'standard' && rule !== 'bomb')
        .map((rule) => SLASH_RULE_LABELS[rule])
        .filter((label): label is string => !!label);
    return labels.length ? labels.join(' + ') : '单选';
}

export function evaluateRules(question: QuestionInstance): ActionConstraint {
    if (!validateRuleSet(question.activeRules)) throw new Error(`Illegal rule combination: ${question.activeRules.join('+')}`);
    const targetIds = question.targets.filter((target) => !target.isBomb).map((target) => target.id);
    let required = [...question.baseCorrectTargetIds];
    if (question.activeRules.includes('reverse')) {
        const correct = new Set(required);
        required = targetIds.filter((id) => !correct.has(id));
    }
    const order = question.orderedTargetIds?.filter((id) => required.includes(id));
    if (question.activeRules.includes('order') && order?.length) required = order;
    const ordered = question.activeRules.includes('order');
    return { requiredTargetIds: required, forbiddenTargetIds: question.targets.filter((t) => t.isBomb).map((t) => t.id), matchMode: question.activeRules.includes('multi') || ordered ? 'all' : 'any', ordered, allowExtraHits: false };
}
