export interface DifficultySettings { stage: 0 | 1 | 2; targetCount: number; speed: number; }
export function difficultyAt(elapsedMs: number): DifficultySettings {
    if (elapsedMs < 15_000) return { stage: 0, targetCount: 3, speed: 0.7 };
    if (elapsedMs < 40_000) return { stage: 1, targetCount: 4, speed: 1 };
    return { stage: 2, targetCount: 5, speed: 1.25 };
}
