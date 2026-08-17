import type { GameplayConfig } from '../configs/GameConfig';
export function calculateScore(config: GameplayConfig, combo: number, complexRuleCount: number, master: boolean): number {
    return Math.round(config.baseScore * (1 + Math.min(combo, 20) * 0.05) * (1 + complexRuleCount * config.ruleMultiplierStep)) + (master ? config.masterBonus : 0);
}
