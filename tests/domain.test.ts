import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTENT_VERSION, GAMEPLAY_CONFIG } from '../assets/Scripts/configs/GameConfig.ts';
import { Brawl60Director, phaseAt, targetCountForFamily } from '../assets/Scripts/domain/Brawl60Director.ts';
import {
    CONTENT_FAMILIES,
    CONTENT_FAMILY_TARGETS,
    ENGLISH_WORDS,
    GEOGRAPHY_FACTS,
    IDIOMS,
    LIFE_FACTS,
} from '../assets/Scripts/domain/ContentCatalog.ts';
import { GameSession } from '../assets/Scripts/domain/GameSession.ts';
import { GestureResolver, shouldKeepIncompleteGesture } from '../assets/Scripts/domain/GestureResolver.ts';
import type { QuestionInstance } from '../assets/Scripts/domain/Models.ts';
import { QuestionGenerator } from '../assets/Scripts/domain/QuestionGenerator.ts';
import { evaluateRules } from '../assets/Scripts/domain/Rules.ts';
import { SeededRng } from '../assets/Scripts/domain/SeededRng.ts';
import { validateQuestion } from '../assets/Scripts/domain/FairnessValidator.ts';
import { difficultyAt } from '../assets/Scripts/domain/DifficultyDirector.ts';
import {
    calculateHomePortraitLayout,
    HOME_PORTRAIT_SECTION_HEIGHTS,
    type HomeSectionId,
} from '../assets/Scripts/UI/home/HomePortraitLayout.ts';
import { RunSeedFactory } from '../assets/Scripts/app/RunSeedFactory.ts';
import { calculatePortraitTargetLayout, portraitTargetEntranceDelay } from '../assets/Scripts/UI/PortraitTargetLayout.ts';

function pipeline(seed: string): { director: Brawl60Director; generator: QuestionGenerator } {
    return {
        director: new Brawl60Director(new SeededRng(`${seed}:director`)),
        generator: new QuestionGenerator(new SeededRng(`${seed}:gameplay`), GAMEPLAY_CONFIG),
    };
}

function assertCompletesAcrossSeparateStrokes(constraint: ReturnType<typeof evaluateRules>): void {
    assert.equal(shouldKeepIncompleteGesture(constraint), true);
    const gesture = new GestureResolver(constraint);
    for (const targetId of constraint.requiredTargetIds.slice(0, -1)) {
        assert.equal(gesture.hit(targetId).status, 'continue');
        assert.equal(gesture.end(shouldKeepIncompleteGesture(constraint)).status, 'continue');
    }
    assert.equal(gesture.hit(constraint.requiredTargetIds.at(-1)!).status, 'success');
}

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

test('idiom ordering keeps progress when each character is slashed separately', () => {
    const constraint = {
        requiredTargetIds: ['狐', '假', '虎', '威'],
        forbiddenTargetIds: [],
        matchMode: 'all' as const,
        ordered: true,
        allowExtraHits: false,
    };
    assertCompletesAcrossSeparateStrokes(constraint);
});

test('every orderable idiom completes only after all four characters', () => {
    const orderable = IDIOMS.filter((entry) => new Set(entry.text).size === 4);
    for (const entry of orderable) {
        assertCompletesAcrossSeparateStrokes({
            requiredTargetIds: [...entry.text].map((_, index) => `${entry.text}:${index}`),
            forbiddenTargetIds: [],
            matchMode: 'all',
            ordered: true,
            allowExtraHits: false,
        });
    }
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
    assert.equal(gesture.end(true).status, 'continue');
    assert.equal(gesture.hit('12').status, 'success');
});

test('multi selection keeps correct progress across separate strokes', () => {
    const gesture = new GestureResolver({
        requiredTargetIds: ['first', 'second', 'third'],
        forbiddenTargetIds: ['bomb'],
        matchMode: 'all',
        ordered: false,
        allowExtraHits: false,
    });
    assert.equal(gesture.hit('first').status, 'continue');
    assert.equal(gesture.end(true).status, 'continue');
    assert.equal(gesture.hit('third').status, 'continue');
    assert.equal(gesture.end(true).status, 'continue');
    assert.equal(gesture.hit('second').status, 'success');
});

test('generated multi-step questions keep progress until every required target is hit', () => {
    let checked = 0;
    const checkedRules = new Set<string>();
    for (let seedIndex = 0; seedIndex < 40; seedIndex++) {
        const { director, generator } = pipeline(`multi-stroke-${seedIndex}`);
        for (let questionIndex = 0; questionIndex < 18; questionIndex++) {
            const elapsed = [15_000, 30_000, 50_000][questionIndex % 3];
            const question = generator.next(director.next(elapsed));
            const constraint = evaluateRules(question);
            if (constraint.matchMode !== 'all' || constraint.requiredTargetIds.length < 2) continue;
            assertCompletesAcrossSeparateStrokes(constraint);
            for (const rule of question.activeRules) if (rule === 'multi' || rule === 'order') checkedRules.add(rule);
            checked++;
        }
    }
    assert.ok(checked >= 100);
    assert.deepEqual([...checkedRules].sort(), ['multi', 'order']);
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

test('brawl director exposes exact four-phase boundaries and rising pressure', () => {
    assert.equal(phaseAt(0).id, 'warmup');
    assert.equal(phaseAt(9_999).id, 'warmup');
    assert.equal(phaseAt(10_000).id, 'action');
    assert.equal(phaseAt(24_999).id, 'action');
    assert.equal(phaseAt(25_000).id, 'twist');
    assert.equal(phaseAt(44_999).id, 'twist');
    assert.equal(phaseAt(45_000).id, 'climax');
    assert.equal(phaseAt(60_000).id, 'climax');
    assert.deepEqual([0, 10_000, 25_000, 45_000].map((elapsed) => difficultyAt(elapsed).targetCount), [3, 4, 5, 6]);
    assert.deepEqual([0, 10_000, 25_000, 45_000].map((elapsed) => difficultyAt(elapsed).phase), ['warmup', 'action', 'twist', 'climax']);
    assert.ok(phaseAt(0).questionTimeMs > phaseAt(10_000).questionTimeMs);
    assert.ok(phaseAt(10_000).questionTimeMs > phaseAt(25_000).questionTimeMs);
    assert.ok(phaseAt(25_000).questionTimeMs > phaseAt(45_000).questionTimeMs);
    assert.ok(phaseAt(0).speed < phaseAt(45_000).speed);
});

test('target density respects content readability and compound-rule pressure', () => {
    assert.equal(targetCountForFamily(6, 'math-add', ['bomb', 'reverse']), 4);
    assert.equal(targetCountForFamily(6, 'math-property', ['multi', 'reverse']), 5);
    assert.equal(targetCountForFamily(6, 'vision-odd', ['standard']), 6);
    assert.equal(targetCountForFamily(6, 'vision-odd', ['bomb', 'reverse']), 5);
    assert.equal(targetCountForFamily(6, 'hanzi-order', ['bomb', 'order']), 5);

    const climax = pipeline('portrait-climax');
    for (let i = 0; i < 30; i++) assert.ok(climax.director.next(50_000).targetCount <= 5);
});

test('portrait target formations use at most two targets per row with clear spacing', () => {
    for (let count = 2; count <= 6; count++) {
        const positions = calculatePortraitTargetLayout(count, 750, 1624);
        assert.equal(positions.length, count);
        assert.ok(positions.every((position) => portraitTargetEntranceDelay(position) === 0));
        for (const row of new Set(positions.map((position) => position.row))) {
            assert.ok(positions.filter((position) => position.row === row).length <= 2);
        }
        for (let a = 0; a < positions.length; a++) {
            for (let b = a + 1; b < positions.length; b++) {
                assert.ok(Math.hypot(positions[a].x - positions[b].x, positions[a].y - positions[b].y) >= 210);
            }
        }
    }
    assert.deepEqual(calculatePortraitTargetLayout(5, 750, 1624).map((position) => position.row), [0, 0, 1, 2, 2]);
    assert.deepEqual(calculatePortraitTargetLayout(6, 750, 1624).map((position) => position.row), [0, 0, 1, 1, 2, 2]);
});

test('each phase schedules its intended themes and rule beats', () => {
    const warmup = pipeline('warmup');
    for (let i = 0; i < 20; i++) {
        const directive = warmup.director.next(5_000);
        const question = warmup.generator.next(directive);
        assert.equal(directive.phase, 'warmup');
        assert.deepEqual(question.activeRules, ['standard']);
        assert.ok(question.theme === 'math' || question.theme === 'vision');
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }

    const action = pipeline('action');
    const actionRules = Array.from({ length: 5 }, () => action.director.next(15_000).rules);
    assert.deepEqual(actionRules.map((rules) => rules.join('+')).sort(), ['bomb', 'bomb', 'multi', 'order', 'standard']);

    const twist = pipeline('twist');
    const twistRules = Array.from({ length: 6 }, () => twist.director.next(30_000).rules);
    assert.deepEqual(twistRules.map((rules) => rules.join('+')).sort(), ['multi', 'reverse', 'reverse', 'standard', 'stroop', 'stroop']);

    const climax = pipeline('climax');
    for (let i = 0; i < 15; i++) {
        const directive = climax.director.next(50_000);
        const question = climax.generator.next(directive);
        assert.equal(directive.rules.length, 2);
        assert.deepEqual(question.activeRules, directive.rules);
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }
});

test('brawl rule beats vary by seed while preserving each phase recipe', () => {
    const signatures = new Set<string>();
    for (let seedIndex = 0; seedIndex < 24; seedIndex++) {
        const director = new Brawl60Director(new SeededRng(`rule-order-${seedIndex}`));
        signatures.add(Array.from({ length: 5 }, () => director.next(15_000).rules.join('+')).join(','));
    }
    assert.ok(signatures.size > 8);
});

test('brawl topic and question-family order varies across fresh session seeds', () => {
    const signatures = new Set<string>();
    for (let seedIndex = 0; seedIndex < 32; seedIndex++) {
        const director = new Brawl60Director(new SeededRng(`session-order-${seedIndex}`));
        const signature = Array.from({ length: 12 }, (_, questionIndex) => {
            const elapsed = questionIndex < 3 ? 5_000 : questionIndex < 8 ? 15_000 : 30_000;
            const directive = director.next(elapsed);
            return `${directive.family.id}:${directive.rules.join('+')}`;
        }).join(',');
        signatures.add(signature);
    }
    assert.ok(signatures.size > 24);
});

test('run seed factory refreshes free-play but keeps the daily recipe reproducible', () => {
    const fixedDate = new Date(2026, 7, 20, 12, 0, 0);
    const factory = new RunSeedFactory(() => fixedDate, () => 123_456_789);
    const first = factory.create('brawl60', CONTENT_VERSION);
    const second = factory.create('brawl60', CONTENT_VERSION);
    assert.notEqual(first.seed, second.seed);
    assert.match(first.seed, /^brawl60:/);

    const dailyA = factory.create('daily', CONTENT_VERSION);
    const dailyB = factory.create('daily', CONTENT_VERSION);
    assert.equal(dailyA.seed, dailyB.seed);
    assert.equal(dailyA.recipeId, 'daily-default');
});

test('theme and family bags enforce cooldowns across long mixed runs', () => {
    const { director, generator } = pipeline('bag-cooldowns');
    const recentFamilies: string[] = [];
    const recentThemes: string[] = [];
    for (let i = 0; i < 500; i++) {
        const elapsed = [5_000, 15_000, 30_000, 50_000][i % 4];
        const directive = director.next(elapsed);
        const question = generator.next(directive);
        assert.ok(!recentFamilies.includes(question.familyId ?? ''));
        recentFamilies.push(question.familyId ?? '');
        if (recentFamilies.length > 3) recentFamilies.shift();
        recentThemes.push(question.theme);
        if (recentThemes.length > 3) recentThemes.shift();
        if (recentThemes.length === 3) assert.ok(new Set(recentThemes).size > 1);
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }
});

test('fact bag keeps repeated reviewed facts more than 20 questions apart', () => {
    const { director, generator } = pipeline('fact-cooldowns');
    const lastSeen = new Map<string, number>();
    for (let i = 0; i < 800; i++) {
        const elapsed = i % 3 === 0 ? 15_000 : i % 3 === 1 ? 30_000 : 50_000;
        const question = generator.next(director.next(elapsed));
        for (const factId of question.factIds ?? []) {
            const previous = lastSeen.get(factId);
            if (previous !== undefined) assert.ok(i - previous > 20, `${factId} repeated after ${i - previous} questions`);
            lastSeen.set(factId, i);
        }
    }
});

test('1000 seeds survive full multi-round deterministic legality regression', () => {
    const multiStepFamilyIds = new Set<string>();
    let multiStepQuestions = 0;
    for (let i = 0; i < 1000; i++) {
        const seed = `regression-${i}`;
        const firstPipeline = pipeline(seed), secondPipeline = pipeline(seed);
        for (let questionIndex = 0; questionIndex < 64; questionIndex++) {
            const elapsed = (questionIndex * 997 + i * 137) % 60_000;
            const firstDirective = firstPipeline.director.next(elapsed);
            const secondDirective = secondPipeline.director.next(elapsed);
            assert.deepEqual(firstDirective, secondDirective);
            const first = firstPipeline.generator.next(firstDirective);
            const second = secondPipeline.generator.next(secondDirective);
            assert.deepEqual(first, second);
            assert.deepEqual(validateQuestion(first, evaluateRules(first)), []);
            assert.ok(first.targets.length <= firstDirective.targetCount);
            assert.ok(first.targets.length >= 2);
            assert.equal(first.timeLimitMs, firstDirective.questionTimeMs);
            const constraint = evaluateRules(first);
            if (constraint.matchMode === 'all' && constraint.requiredTargetIds.length > 1) {
                assertCompletesAcrossSeparateStrokes(constraint);
                multiStepFamilyIds.add(first.familyId ?? '');
                multiStepQuestions++;
            }
        }
    }
    const expectedMultiStepFamilies = CONTENT_FAMILIES
        .filter((family) => ['math-property', 'math-sequence', 'hanzi-order', 'english-category', 'life-category'].includes(family.kind))
        .map((family) => family.id)
        .sort();
    assert.deepEqual([...multiStepFamilyIds].sort(), expectedMultiStepFamilies);
    assert.ok(multiStepQuestions > 10_000);
});

test('home portrait layout keeps every section separated across common safe areas', () => {
    const profiles = [
        { name: 'reference-16:9', height: 1_672, top: 54, bottom: 42 },
        { name: 'modern-phone', height: 2_037, top: 230, bottom: 105 },
        { name: 'tall-android', height: 2_090, top: 200, bottom: 75 },
        { name: 'portrait-tablet', height: 1_672, top: 120, bottom: 60 },
    ];
    const order: HomeSectionId[] = ['header', 'daily', 'brawl', 'events', 'rank'];

    for (const profile of profiles) {
        const layout = calculateHomePortraitLayout(profile.height, profile.top, profile.bottom);
        assert.ok(layout.contentScale >= 0.8 && layout.contentScale <= 1, `${profile.name} scale`);
        assert.ok(layout.sectionGap >= 18, `${profile.name} gap`);

        const headerTop = layout.sectionY.header + HOME_PORTRAIT_SECTION_HEIGHTS.header * layout.contentScale * 0.5;
        assert.ok(headerTop <= profile.height * 0.5 - profile.top + 0.001, `${profile.name} top safe area`);

        for (let i = 0; i < order.length - 1; i++) {
            const upper = order[i], lower = order[i + 1];
            const upperBottom = layout.sectionY[upper] - HOME_PORTRAIT_SECTION_HEIGHTS[upper] * layout.contentScale * 0.5;
            const lowerTop = layout.sectionY[lower] + HOME_PORTRAIT_SECTION_HEIGHTS[lower] * layout.contentScale * 0.5;
            assert.ok(upperBottom - lowerTop >= 18 - 0.001, `${profile.name} ${upper}/${lower} overlap`);
        }

        const rankBottom = layout.sectionY.rank - HOME_PORTRAIT_SECTION_HEIGHTS.rank * layout.contentScale * 0.5;
        const navigationTop = layout.navigationY + 64;
        assert.ok(rankBottom - navigationTop >= 18 - 0.001, `${profile.name} rank/navigation overlap`);
        assert.equal(layout.navigationY - 64, -profile.height * 0.5 + profile.bottom);
    }
});
