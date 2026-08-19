import assert from 'node:assert/strict';
import test from 'node:test';
import { GAMEPLAY_CONFIG } from '../assets/Scripts/configs/GameConfig.ts';
import {
    CONTENT_FAMILIES,
    CONTENT_FAMILY_TARGETS,
    ENGLISH_WORDS,
    GEOGRAPHY_FACTS,
    IDIOMS,
    LIFE_FACTS,
} from '../assets/Scripts/domain/ContentCatalog.ts';
import { GameSession } from '../assets/Scripts/domain/GameSession.ts';
import { GestureResolver } from '../assets/Scripts/domain/GestureResolver.ts';
import type { QuestionInstance } from '../assets/Scripts/domain/Models.ts';
import { QuestionGenerator } from '../assets/Scripts/domain/QuestionGenerator.ts';
import { evaluateRules } from '../assets/Scripts/domain/Rules.ts';
import { SeededRng } from '../assets/Scripts/domain/SeededRng.ts';
import { validateQuestion } from '../assets/Scripts/domain/FairnessValidator.ts';
import { difficultyAt } from '../assets/Scripts/domain/DifficultyDirector.ts';

test('seeded RNG is deterministic and streams do not drift', () => {
    const a = new SeededRng('same'), b = new SeededRng('same');
    assert.deepEqual(Array.from({ length: 20 }, () => a.next()), Array.from({ length: 20 }, () => b.next()));
    assert.notEqual(a.fork('gameplay').next(), a.fork('visual').next());
});

test('reverse never turns a bomb into a required target', () => {
    const question: QuestionInstance = {
        id: 'reverse', theme: 'math', prompt: { text: '反向' },
        targets: [{ id: 'right', text: '2' }, { id: 'wrong', text: '3' }, { id: 'bomb', text: '爆', isBomb: true }],
        baseCorrectTargetIds: ['right'], activeRules: ['reverse', 'bomb'], timeLimitMs: 3000, tutorialSafe: false,
    };
    const constraint = evaluateRules(question);
    assert.deepEqual(constraint.requiredTargetIds, ['wrong']);
    assert.deepEqual(constraint.forbiddenTargetIds, ['bomb']);
});

test('order and multi gestures resolve once and reject incomplete strokes', () => {
    const ordered = new GestureResolver({ requiredTargetIds: ['a', 'b'], forbiddenTargetIds: [], matchMode: 'all', ordered: true, allowExtraHits: false });
    assert.equal(ordered.hit('a').status, 'continue');
    assert.equal(ordered.hit('b').status, 'success');
    const incomplete = new GestureResolver({ requiredTargetIds: ['a', 'b'], forbiddenTargetIds: [], matchMode: 'all', ordered: false, allowExtraHits: false });
    incomplete.hit('a');
    assert.deepEqual(incomplete.end(), { status: 'failure', kind: 'miss' });
    const empty = new GestureResolver({ requiredTargetIds: ['a'], forbiddenTargetIds: [], matchMode: 'any', ordered: false, allowExtraHits: false });
    assert.equal(empty.hasHits(), false);
});

test('standard parity accepts either even while multi parity requires all evens', () => {
    const base: QuestionInstance = {
        id: 'parity', theme: 'math', prompt: { text: '斩偶数' },
        targets: [{ id: '6', text: '6', value: 6 }, { id: '12', text: '12', value: 12 }, { id: '13', text: '13', value: 13 }],
        baseCorrectTargetIds: ['6', '12'], activeRules: ['standard'], timeLimitMs: 3000, tutorialSafe: false,
    };
    const standard = evaluateRules(base);
    assert.equal(standard.matchMode, 'any');
    assert.equal(new GestureResolver(standard).hit('6').status, 'success');
    assert.equal(new GestureResolver(standard).hit('12').status, 'success');

    const multi = evaluateRules({ ...base, prompt: { text: '斩出全部偶数' }, activeRules: ['multi'] });
    assert.equal(multi.matchMode, 'all');
    const gesture = new GestureResolver(multi);
    assert.equal(gesture.hit('6').status, 'continue');
    assert.equal(gesture.hit('12').status, 'success');
});

test('session applies a question result only once', () => {
    const entry = { mode: 'brawl60' as const, seed: 's', contentVersion: 'v' };
    const session = new GameSession(entry, GAMEPLAY_CONFIG); session.start(); session.beginQuestion();
    const q: QuestionInstance = { id: 'q', theme: 'math', prompt: { text: 'x' }, targets: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }], baseCorrectTargetIds: ['a'], activeRules: ['standard'], timeLimitMs: 3000, tutorialSafe: true };
    assert.ok(session.resolveSuccess(q)); assert.equal(session.resolveSuccess(q), null); assert.equal(session.state.correctCount, 1);
});

test('expanded content catalog contains five times the recommended family counts', () => {
    const counts = Object.fromEntries(Object.keys(CONTENT_FAMILY_TARGETS).map((theme) => [theme, 0])) as Record<keyof typeof CONTENT_FAMILY_TARGETS, number>;
    for (const family of CONTENT_FAMILIES) counts[family.theme] += 1;
    assert.deepEqual(counts, CONTENT_FAMILY_TARGETS);
    assert.equal(CONTENT_FAMILIES.length, 105);
    assert.equal(new Set(CONTENT_FAMILIES.map((family) => family.id)).size, CONTENT_FAMILIES.length);
});

test('reviewed fact pools contain unique answers and safe idiom distractors', () => {
    for (const idiom of IDIOMS) {
        assert.equal([...idiom.text].length, 4);
        const answer = [...idiom.text][idiom.missingIndex];
        assert.equal(new Set(idiom.wrong).size, idiom.wrong.length);
        assert.ok(!idiom.wrong.includes(answer));
    }
    assert.equal(new Set(ENGLISH_WORDS.map((word) => word.en)).size, ENGLISH_WORDS.length);
    assert.equal(new Set(LIFE_FACTS.map((fact) => fact.item)).size, LIFE_FACTS.length);
    assert.equal(new Set(GEOGRAPHY_FACTS.map((fact) => fact.country)).size, GEOGRAPHY_FACTS.length);
    assert.equal(new Set(GEOGRAPHY_FACTS.map((fact) => fact.capital)).size, GEOGRAPHY_FACTS.length);
});

test('opening-stage catalog stays readable while later stages cover every expanded theme', () => {
    const opening = new QuestionGenerator(new SeededRng('opening-content'), GAMEPLAY_CONFIG);
    for (let i = 0; i < 55; i++) {
        const question = opening.next(i * 100, 0);
        assert.ok(question.theme === 'math' || question.theme === 'vision');
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }

    const advanced = new QuestionGenerator(new SeededRng('advanced-content'), GAMEPLAY_CONFIG);
    const themes = new Set<string>(), families = new Set<string>();
    for (let i = 0; i < CONTENT_FAMILIES.length; i++) {
        const question = advanced.next(20_000 + i * 100, 1);
        themes.add(question.theme);
        families.add(question.familyId ?? '');
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }
    assert.deepEqual([...themes].sort(), ['english', 'geography', 'hanzi', 'life', 'math', 'vision']);
    assert.equal(families.size, CONTENT_FAMILIES.length);
});

test('1000 seeds generate only valid questions and repeat exactly', () => {
    for (let i = 0; i < 1000; i++) {
        const seed = `regression-${i}`;
        const firstGenerator = new QuestionGenerator(new SeededRng(seed), GAMEPLAY_CONFIG);
        const secondGenerator = new QuestionGenerator(new SeededRng(seed), GAMEPLAY_CONFIG);
        for (let questionIndex = 0; questionIndex < 18; questionIndex++) {
            const elapsed = (i * 137 + questionIndex * 3_271) % 59_000;
            const stage = difficultyAt(elapsed).stage;
            const first = firstGenerator.next(elapsed, stage);
            const second = secondGenerator.next(elapsed, stage);
            assert.deepEqual(first, second);
            assert.deepEqual(validateQuestion(first, evaluateRules(first)), []);
        }
    }
});
