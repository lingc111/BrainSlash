import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTENT_VERSION, GAMEPLAY_CONFIG } from '../assets/Scripts/configs/GameConfig.ts';
import { RunSeedFactory } from '../assets/Scripts/app/RunSeedFactory.ts';
import { ModeQuestionDirector } from '../assets/Scripts/domain/ModeQuestionDirector.ts';
import { QuestionCompiler, QUESTION_TEMPLATES, templatesForRequest } from '../assets/Scripts/domain/QuestionSystem.ts';
import { SeededRng } from '../assets/Scripts/domain/SeededRng.ts';
import { evaluateRules } from '../assets/Scripts/domain/Rules.ts';
import { validateQuestion } from '../assets/Scripts/domain/FairnessValidator.ts';
import { TowerChallengeRuntime } from '../assets/Scripts/domain/TowerChallenge.ts';
import { TowerDirector } from '../assets/Scripts/domain/TowerDirector.ts';
import { towerFloorConfig } from '../assets/Scripts/domain/TowerMode.ts';
import type { GameEntryParams, QuestionInstance } from '../assets/Scripts/domain/Models.ts';

function assertTraceable(question: QuestionInstance): void {
    const template = QUESTION_TEMPLATES.find((item) => item.id === question.templateId);
    assert.ok(template, `unknown template ${question.templateId}`);
    assert.equal(question.theme, template.theme);
    assert.equal(question.engineId, template.engine);
    assert.equal(question.contentVersion, CONTENT_VERSION);
    assert.ok(Array.isArray(question.factIds));
    assert.equal('familyId' in question, false);
    assert.equal('typeId' in question, false);
}

test('unified catalog contains one stable real template id per cognitive template', () => {
    assert.equal(new Set(QUESTION_TEMPLATES.map((item) => item.id)).size, QUESTION_TEMPLATES.length);
    assert.ok(QUESTION_TEMPLATES.every((item) => item.enabled && item.capabilities.length > 0 && item.difficultyBands.length === 5));
});

test('endless mode can continuously compile legal traceable questions after the 60-second phase boundary', () => {
    const entry = { mode: 'brawl60' as const, seed: 'endless-unified', contentVersion: CONTENT_VERSION };
    const director = new ModeQuestionDirector(new SeededRng('endless-unified:director'), entry, new Set(['standard', 'reverse', 'rotate', 'multi', 'order', 'bomb']));
    const compiler = new QuestionCompiler(new SeededRng('endless-unified:compiler'), GAMEPLAY_CONFIG, entry);
    for (let index = 0; index < 2_000; index++) {
        const request = director.next(60_000 + index * 2_000);
        const question = compiler.next(request, CONTENT_VERSION);
        assertTraceable(question);
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }
});

test('friend challenge honors the selected theme and rule pool and reproduces the sequence', () => {
    const entry: GameEntryParams = { mode: 'friendChallenge', seed: 'friend-unified', contentVersion: CONTENT_VERSION,
        challengeRole: 'creator', challengeConfig: { themeIds: ['math', 'english'], enabledRules: ['standard', 'reverse', 'multi'], durationMs: 90_000 } };
    const build = () => {
        const director = new ModeQuestionDirector(new SeededRng(`${entry.seed}:director`), entry);
        const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
        return Array.from({ length: 120 }, (_, index) => {
            const request = director.next(index * 700);
            assert.ok(request.rules.every((rule) => entry.challengeConfig.enabledRules.includes(rule as never)));
            const question = compiler.next(request, CONTENT_VERSION);
            assertTraceable(question);
            assert.ok(entry.challengeConfig.themeIds.includes(question.theme as never));
            return [question.templateId, question.prompt.text, question.targets.map((target) => target.text), question.activeRules];
        });
    };
    assert.deepEqual(build(), build());
});

test('daily retries keep one date theme but receive different question content', () => {
    let entropy = 10;
    const factory = new RunSeedFactory(() => new Date(2026, 8, 1, 12), () => entropy++);
    const first = factory.create('daily', CONTENT_VERSION);
    const second = factory.create('daily', CONTENT_VERSION);
    assert.equal(first.dailyTheme, second.dailyTheme);
    assert.notEqual(first.seed, second.seed);
    const signature = (entry: typeof first): string => {
        const director = new ModeQuestionDirector(new SeededRng(`${entry.seed}:director`), entry);
        const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
        return Array.from({ length: 20 }, (_, index) => {
            const question = compiler.next(director.next(index * 2_000), CONTENT_VERSION);
            assertTraceable(question);
            assert.equal(question.theme, entry.dailyTheme);
            return `${question.templateId}:${question.prompt.text}:${question.targets.map((target) => target.text).join(',')}`;
        }).join('|');
    };
    assert.notEqual(signature(first), signature(second));
});

test('all 50 tower floors compile through capability requests', () => {
    for (let floor = 1; floor <= 50; floor++) {
        const entry = { mode: 'tower' as const, seed: `tower-unified-${floor}`, contentVersion: CONTENT_VERSION, towerFloor: floor };
        const runtime = new TowerChallengeRuntime(towerFloorConfig(floor).challenge, new SeededRng(`${entry.seed}:runtime`));
        const director = new TowerDirector(new SeededRng(`${entry.seed}:director`), floor);
        const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
        for (let index = 0; index < 20; index++) {
            const request = director.next(index * 1_000, runtime.nextRequest());
            assert.ok(templatesForRequest(request).length > 0, `floor ${floor}`);
            const question = compiler.next(request, CONTENT_VERSION);
            assertTraceable(question);
            assert.deepEqual(validateQuestion(question, evaluateRules(question)), [], `floor ${floor}`);
            if (request.requiredCapabilities?.includes('stroop')) assert.equal(question.templateId, 'vision-stroop');
            if (request.requiredCapabilities?.includes('master-slash')) assert.ok(evaluateRules(question).requiredTargetIds.length > 1);
        }
    }
});
