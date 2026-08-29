import type { ActionConstraint, QuestionInstance } from './Models';
export function validateQuestion(question: QuestionInstance, constraint: ActionConstraint): string[] {
    const errors: string[] = [], ids = question.targets.map((target) => target.id);
    if (question.targets.length < 2 || question.targets.length > 6) errors.push('target-count');
    if (new Set(ids).size !== ids.length) errors.push('duplicate-target-id');
    if (!constraint.requiredTargetIds.length) errors.push('no-required-target');
    if (constraint.requiredTargetIds.some((id) => !ids.includes(id))) errors.push('missing-required-target');
    if (constraint.requiredTargetIds.some((id) => constraint.forbiddenTargetIds.includes(id))) errors.push('required-is-forbidden');
    if (constraint.ordered && constraint.requiredTargetIds.length < 2) errors.push('order-needs-multiple-targets');
    return errors;
}
