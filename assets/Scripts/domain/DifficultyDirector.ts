import { phaseAt, type BrawlPhaseId } from './QuestionPolicy';

export interface DifficultySettings { stage: 0 | 1 | 2; phase: BrawlPhaseId; targetCount: number; speed: number; }
export function difficultyAt(elapsedMs: number): DifficultySettings {
    const settings = phaseAt(elapsedMs);
    return { stage: settings.difficultyStage, phase: settings.id, targetCount: settings.targetCount, speed: settings.speed };
}
