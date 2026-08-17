import { validateRuleSet } from '../configs/GameConfig';
import type { ActionConstraint, QuestionInstance } from './Models';
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
