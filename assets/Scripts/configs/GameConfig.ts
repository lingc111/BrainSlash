import type { RuleId } from '../domain/Models';
export interface GameplayConfig {
    durationMs: number; readyMs: number; maxLife: number; masterWindowMs: number; masterHitSettleDelayMs: number;
    baseScore: number; masterBonus: number; masterSlashBonus: number; ruleMultiplierStep: number; questionTimeMs: [number, number, number];
}
export const CONTENT_VERSION = '1.17.0-mvp';
export const GAMEPLAY_CONFIG: GameplayConfig = {
    durationMs: 60_000, readyMs: 600, maxLife: 3, masterWindowMs: 650, masterHitSettleDelayMs: 340,
    baseScore: 100, masterBonus: 50, masterSlashBonus: 100, ruleMultiplierStep: 0.25, questionTimeMs: [3000, 2500, 2100],
};
export const RULE_PAIR_WHITELIST: readonly string[] = [
    'bomb+multi', 'bomb+order', 'bomb+reverse',
    'multi+reverse', 'order+reverse',
    'bomb+rotate', 'multi+rotate', 'order+rotate',
];
export function validateRuleSet(rules: readonly RuleId[]): boolean {
    const complex = rules.filter((rule) => rule !== 'standard');
    if (complex.includes('reverse') && complex.includes('rotate')) return false;
    if (complex.length <= 1) return true;
    if (complex.length > 2) return false;
    return RULE_PAIR_WHITELIST.includes([...complex].sort().join('+'));
}
