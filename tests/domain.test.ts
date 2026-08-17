import assert from 'node:assert/strict';
import test from 'node:test';
import { GAMEPLAY_CONFIG } from '../assets/Scripts/configs/GameConfig.ts';
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
    const ordered = new GestureResolver({ requiredTargetIds: ['a', 'b'], forbiddenTargetIds: [], ordered: true, allowExtraHits: false });
    assert.equal(ordered.hit('a').status, 'continue');
    assert.equal(ordered.hit('b').status, 'success');
    const incomplete = new GestureResolver({ requiredTargetIds: ['a', 'b'], forbiddenTargetIds: [], ordered: false, allowExtraHits: false });
    incomplete.hit('a');
    assert.deepEqual(incomplete.end(), { status: 'failure', kind: 'miss' });
});

test('session applies a question result only once', () => {
    const entry = { mode: 'brawl60' as const, seed: 's', contentVersion: 'v' };
    const session = new GameSession(entry, GAMEPLAY_CONFIG); session.start(); session.beginQuestion();
    const q: QuestionInstance = { id: 'q', theme: 'math', prompt: { text: 'x' }, targets: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }], baseCorrectTargetIds: ['a'], activeRules: ['standard'], timeLimitMs: 3000, tutorialSafe: true };
    assert.ok(session.resolveSuccess(q)); assert.equal(session.resolveSuccess(q), null); assert.equal(session.state.correctCount, 1);
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
