import { CONTENT_VERSION, GAMEPLAY_CONFIG } from '../assets/Scripts/configs/GameConfig.ts';
import { ModeQuestionDirector } from '../assets/Scripts/domain/ModeQuestionDirector.ts';
import { QuestionCompiler, QUESTION_TEMPLATES, templatesForRequest } from '../assets/Scripts/domain/QuestionSystem.ts';
import { SeededRng } from '../assets/Scripts/domain/SeededRng.ts';
import { evaluateRules } from '../assets/Scripts/domain/Rules.ts';
import { validateQuestion } from '../assets/Scripts/domain/FairnessValidator.ts';
import { TowerChallengeRuntime } from '../assets/Scripts/domain/TowerChallenge.ts';
import { TowerDirector } from '../assets/Scripts/domain/TowerDirector.ts';
import { towerFloorConfig } from '../assets/Scripts/domain/TowerMode.ts';

const templateIds = new Set(QUESTION_TEMPLATES.map((template) => template.id));
let mixedQuestions = 0;
let towerQuestions = 0;

function verify(question, label) {
  if (!templateIds.has(question.templateId)) throw new Error(`${label}: unknown template ${question.templateId}`);
  if (!question.engineId || !question.contentVersion || !Array.isArray(question.factIds)) throw new Error(`${label}: incomplete trace metadata`);
  const errors = validateQuestion(question, evaluateRules(question));
  if (errors.length) throw new Error(`${label}: ${errors.join(', ')}`);
  if ('familyId' in question || 'typeId' in question) throw new Error(`${label}: obsolete routing field emitted`);
}

for (let seedIndex = 0; seedIndex < 1_000; seedIndex += 1) {
  const seed = `stress-mixed-${seedIndex}`;
  const entry = { mode: 'brawl60', seed, contentVersion: CONTENT_VERSION };
  const director = new ModeQuestionDirector(new SeededRng(`${seed}:director`), entry,
    new Set(['standard', 'reverse', 'rotate', 'multi', 'order', 'bomb']));
  const compiler = new QuestionCompiler(new SeededRng(`${seed}:compiler`), GAMEPLAY_CONFIG, entry);
  for (const elapsedMs of [0, 5_000, 10_000, 20_000, 25_000, 35_000, 45_000, 60_000, 90_000, 180_000]) {
    verify(compiler.next(director.next(elapsedMs), CONTENT_VERSION), `${seed}@${elapsedMs}`);
    mixedQuestions += 1;
  }
}

for (let floor = 1; floor <= 50; floor += 1) {
  for (let seedIndex = 0; seedIndex < 1_000; seedIndex += 1) {
    const seed = `stress-tower-${floor}-${seedIndex}`;
    const entry = { mode: 'tower', seed, contentVersion: CONTENT_VERSION, towerFloor: floor };
    const runtime = new TowerChallengeRuntime(towerFloorConfig(floor).challenge, new SeededRng(`${seed}:runtime`));
    const director = new TowerDirector(new SeededRng(`${seed}:director`), floor);
    const compiler = new QuestionCompiler(new SeededRng(`${seed}:compiler`), GAMEPLAY_CONFIG, entry);
    const request = director.next(0, runtime.nextRequest());
    if (!templatesForRequest(request).length) throw new Error(`floor ${floor}, seed ${seedIndex}: no legal template`);
    verify(compiler.next(request, CONTENT_VERSION), `floor ${floor}, seed ${seedIndex}`);
    towerQuestions += 1;
  }
}

console.log(JSON.stringify({ mixedSeeds: 1_000, mixedQuestions, towerFloors: 50, towerSeedsPerFloor: 1_000, towerQuestions }, null, 2));
console.log('Question system stress validation passed.');
