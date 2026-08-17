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
    if (!question.activeRules.includes('multi') && !question.activeRules.includes('order')) required = required.slice(0, 1);
    const order = question.orderedTargetIds?.filter((id) => required.includes(id));
    if (question.activeRules.includes('order') && order?.length) required = order;
    return { requiredTargetIds: required, forbiddenTargetIds: question.targets.filter((t) => t.isBomb).map((t) => t.id), ordered: question.activeRules.includes('order'), allowExtraHits: false };
}
