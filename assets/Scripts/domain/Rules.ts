import { validateRuleSet } from '../configs/GameConfig';
import type { ActionConstraint, FailureKind, MistakeRecord, QuestionInstance, RuleId, TargetSpec } from './Models';

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

export function maximumAnswerTextLength(targets: readonly TargetSpec[]): number {
    return targets.reduce((maximum, target) => target.isBomb
        ? maximum
        : Math.max(maximum, Array.from(target.text.trim()).length), 0);
}

/** Extra airborne time for dense choices, long answers, or rules that require mental remapping. */
export function questionFlightDurationSeconds(
    baseSeconds: number,
    rules: readonly RuleId[],
    answerCount = 0,
    maximumAnswerLength = 0,
): number {
    const safeBase = Math.max(0.9, baseSeconds) + 0.6;
    const ruleCount = slashRuleCount(rules);
    const fiveAnswerReadabilityTime = answerCount === 5 ? 0.75 : 0;
    const longAnswerReadabilityTime = maximumAnswerLength >= 6 ? 1.5 : maximumAnswerLength >= 4 ? 0.75 : 0;
    const readabilityTime = fiveAnswerReadabilityTime + longAnswerReadabilityTime;
    if (ruleCount === 0) return safeBase + readabilityTime;
    return safeBase + readabilityTime + (ruleCount >= 2 ? 1.65 : 1.35);
}

export function rulesForReadableTargets(rules: readonly RuleId[], targets: readonly TargetSpec[]): RuleId[] {
    if (!rules.includes('rotate')) return [...rules];
    const hasLongChoice = targets.some((target) => !target.isBomb && Array.from(target.text.trim()).length >= 4);
    if (!hasLongChoice) return [...rules];
    const readable = rules.filter((rule) => rule !== 'rotate');
    return readable.length ? readable : ['standard'];
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

export function createMistakeRecord(
    question: QuestionInstance,
    constraint: ActionConstraint,
    failureKind: FailureKind,
    selectedTargetId?: string,
): MistakeRecord {
    const textById = new Map(question.targets.map((target) => [target.id, target.text]));
    const correct = constraint.requiredTargetIds.map((id) => textById.get(id) ?? id);
    const correctAnswer = constraint.ordered
        ? correct.join(' → ')
        : constraint.matchMode === 'any' && correct.length > 1
            ? `任一：${correct.join(' / ')}`
            : correct.join('、');
    const selected = selectedTargetId ? textById.get(selectedTargetId) : undefined;
    return {
        questionId: question.id,
        prompt: question.prompt.text,
        ruleLabel: slashRuleLabel(question.activeRules),
        failureKind,
        selectedAnswer: failureKind === 'miss' ? '超时未完成' : selected ?? (failureKind === 'bomb' ? '炸弹' : '未记录'),
        correctAnswer: correctAnswer || '无可斩目标',
    };
}
