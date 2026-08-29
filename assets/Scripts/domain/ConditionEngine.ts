import type { TargetSpec, TargetAttributeValue } from './Models';

export type ConditionExpr =
    | { kind: 'predicate'; attribute: string; operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'divisibleBy' | 'contains'; value: TargetAttributeValue }
    | { kind: 'and'; conditions: readonly ConditionExpr[] }
    | { kind: 'or'; conditions: readonly ConditionExpr[] }
    | { kind: 'not'; condition: ConditionExpr };

export function matchesCondition(target: TargetSpec, expression: ConditionExpr): boolean {
    if (expression.kind === 'and') return expression.conditions.every((item) => matchesCondition(target, item));
    if (expression.kind === 'or') return expression.conditions.some((item) => matchesCondition(target, item));
    if (expression.kind === 'not') return !matchesCondition(target, expression.condition);
    const actual = expression.attribute === 'value' ? target.value : target.attributes?.[expression.attribute];
    switch (expression.operator) {
        case 'eq': return actual === expression.value;
        case 'neq': return actual !== expression.value;
        case 'gt': return Number(actual) > Number(expression.value);
        case 'gte': return Number(actual) >= Number(expression.value);
        case 'lt': return Number(actual) < Number(expression.value);
        case 'lte': return Number(actual) <= Number(expression.value);
        case 'divisibleBy': return Number(expression.value) !== 0 && Number(actual) % Number(expression.value) === 0;
        case 'contains': return String(actual ?? '').includes(String(expression.value));
    }
}

export function compileCondition(targets: readonly TargetSpec[], expression: ConditionExpr): string[] {
    return targets.filter((target) => !target.isBomb && matchesCondition(target, expression)).map((target) => target.id);
}
