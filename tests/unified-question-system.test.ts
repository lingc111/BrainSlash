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

test('every template compiles at every difficulty with every declared rule set', () => {
    for (const template of QUESTION_TEMPLATES) {
        for (const difficulty of [1, 2, 3, 4, 5] as const) {
            for (const rules of template.supportedRuleSets) {
                const seed = `coverage-${template.id}-${difficulty}-${rules.join('+')}`;
                const entry = { mode: 'brawl60' as const, seed, contentVersion: CONTENT_VERSION };
                const compiler = new QuestionCompiler(new SeededRng(seed), GAMEPLAY_CONFIG, entry);
                const question = compiler.next({ templateIds: [template.id], rules, difficulty, targetCount: 5,
                    questionTimeMs: 2_600, speed: 1, phase: 'action' }, CONTENT_VERSION);
                assert.equal(question.templateId, template.id);
                assert.deepEqual(validateQuestion(question, evaluateRules(question)), [], `${template.id}:${difficulty}:${rules.join('+')}`);
            }
        }
    }
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

test('brawl uses deterministic phase arithmetic quotas without starving other themes', () => {
    const entry = { mode: 'brawl60' as const, seed: 'arithmetic-mix', contentVersion: CONTENT_VERSION };
    const director = new ModeQuestionDirector(new SeededRng('arithmetic-mix:director'), entry,
        new Set(['standard', 'reverse', 'rotate', 'multi', 'order', 'bomb']));
    let arithmetic = 0;
    const themes = new Set<string>();
    const elapsed = [15_000, 30_000, 50_000];
    for (let index = 0; index < 3_000; index++) {
        const request = director.next(elapsed[index % elapsed.length]);
        themes.add(request.themes![0]);
        if (request.requiredTags?.includes('arithmetic')) {
            arithmetic += 1;
            assert.deepEqual(request.themes, ['math']);
            assert.ok(templatesForRequest(request).every((template) => template.tags.includes('arithmetic')));
        }
    }
    assert.ok(arithmetic / 3_000 >= 0.415 && arithmetic / 3_000 <= 0.42);
    assert.equal(themes.size, 8);
});

test('selected math modes raise arithmetic share while preserving the chosen theme', () => {
    const entries: GameEntryParams[] = [
        { mode: 'daily', seed: 'daily-math-mix', contentVersion: CONTENT_VERSION, dailyTheme: 'math' },
        { mode: 'friendChallenge', seed: 'friend-math-mix', contentVersion: CONTENT_VERSION, challengeRole: 'creator',
            challengeConfig: { themeIds: ['math'], enabledRules: ['standard', 'reverse', 'bomb'], durationMs: 60_000 } },
    ];
    const expected = [0.75, 0.8];
    entries.forEach((entry, entryIndex) => {
        const director = new ModeQuestionDirector(new SeededRng(`${entry.seed}:director`), entry);
        let arithmetic = 0;
        for (let index = 0; index < 200; index++) {
            const request = director.next(index * 300);
            assert.deepEqual(request.themes, ['math']);
            if (request.requiredTags?.includes('arithmetic')) arithmetic += 1;
            assert.ok(templatesForRequest(request).length > 0);
        }
        assert.ok(Math.abs(arithmetic / 200 - expected[entryIndex]) <= 0.01);
    });
});

test('short runs surface division at least once every three arithmetic questions', () => {
    const entry: GameEntryParams = { mode: 'brawl60', seed: 'division-quota', contentVersion: CONTENT_VERSION };
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    let gap = 0;
    let divisions = 0;
    for (let index = 0; index < 60; index++) {
        const question = compiler.next({ themes: ['math'], requiredTags: ['arithmetic'], rules: ['standard'],
            difficulty: 3, targetCount: 4, questionTimeMs: 2_600, speed: 1, phase: 'action' }, CONTENT_VERSION);
        if (question.templateId === 'math-divide') {
            divisions += 1;
            gap = 0;
            assert.ok(question.prompt.text.includes('÷'));
        } else {
            gap += 1;
            assert.ok(gap <= 2, `division absent for ${gap} arithmetic questions`);
        }
    }
    assert.ok(divisions >= 20);
});

test('action and climax multiplication division avoid kindergarten-sized operands', () => {
    for (const [difficulty, phase, expectedMinimum] of [[3, 'action', 5], [5, 'climax', 7]] as const) {
        const entry: GameEntryParams = { mode: 'brawl60', seed: `harder-arithmetic-${difficulty}`, contentVersion: CONTENT_VERSION };
        const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
        let largestOperand = 0;
        for (const templateId of ['math-multiply', 'math-divide'] as const) {
            for (let index = 0; index < 80; index++) {
                const question = compiler.next({ templateIds: [templateId], themes: ['math'], rules: ['standard'],
                    difficulty, targetCount: 4, questionTimeMs: 2_600, speed: 1, phase }, CONTENT_VERSION);
                const operands = question.prompt.text.match(/\d+/g)?.map(Number) ?? [];
                assert.ok(operands.length >= 2, question.prompt.text);
                const smallerOperand = templateId === 'math-divide' ? operands[1] : Math.min(...operands.slice(0, 2));
                assert.ok(smallerOperand >= expectedMinimum, question.prompt.text);
                largestOperand = Math.max(largestOperand, ...operands);
            }
        }
        assert.ok(largestOperand >= (difficulty === 3 ? 15 : 20));
    }
});

test('difficulty-three property questions rotate 2 3 5 and 7 multiples', () => {
    const entry: GameEntryParams = { mode: 'brawl60', seed: 'multiple-variety', contentVersion: CONTENT_VERSION };
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    const prompts: string[] = [];
    for (let index = 0; index < 16; index++) {
        const question = compiler.next({ templateIds: ['math-property'], themes: ['math'], rules: ['multi'],
            difficulty: 3, targetCount: 5, questionTimeMs: 2_600, speed: 1, phase: 'action' }, CONTENT_VERSION);
        prompts.push(question.prompt.text);
    }
    assert.deepEqual(new Set(prompts), new Set(['2的倍数', '3的倍数', '5的倍数', '7的倍数']));
    for (let index = 0; index < prompts.length; index += 4) {
        assert.equal(new Set(prompts.slice(index, index + 4)).size, 4);
    }
});

test('ordinary brawl keeps reverse near one eighth of generated rules', () => {
    const entry: GameEntryParams = { mode: 'brawl60', seed: 'lower-reverse-frequency', contentVersion: CONTENT_VERSION };
    const director = new ModeQuestionDirector(new SeededRng(`${entry.seed}:director`), entry,
        new Set(['standard', 'reverse', 'rotate', 'multi', 'order', 'bomb']));
    let reversed = 0;
    const elapsed = [15_000, 30_000, 50_000];
    for (let index = 0; index < 6_000; index++) {
        if (director.next(elapsed[index % elapsed.length]).rules.includes('reverse')) reversed += 1;
    }
    const ratio = reversed / 6_000;
    assert.ok(ratio >= 0.08, `reverse frequency unexpectedly low: ${ratio}`);
    assert.ok(ratio < 0.16, `reverse frequency too high: ${ratio}`);
});

test('compound math order questions vary direction and content without losing rotation', () => {
    const prompts = new Set<string>();
    for (let seedIndex = 0; seedIndex < 80; seedIndex++) {
        const entry: GameEntryParams = { mode: 'tower', seed: `math-order-${seedIndex}`, contentVersion: CONTENT_VERSION, towerFloor: 39 };
        const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
        const question = compiler.next({ templateIds: ['math-sequence'], themes: ['math'], rules: ['order', 'rotate'],
            difficulty: 5, targetCount: 4, questionTimeMs: 2_600, speed: 1, phase: 'climax' }, CONTENT_VERSION);
        prompts.add(question.prompt.text);
        assert.deepEqual(question.activeRules, ['order', 'rotate']);
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
        assert.ok(question.targets.filter((target) => !target.isBomb).every((target) => Array.from(target.text).length <= 3));
    }
    assert.deepEqual([...prompts].sort(), ['按结果升序', '按结果降序', '数字升序', '数字降序'].sort());
});

test('tower compound rules never silently degrade and rotated order alternates content families', () => {
    const entry: GameEntryParams = { mode: 'tower', seed: 'compound-integrity', contentVersion: CONTENT_VERSION, towerFloor: 7 };
    const director = new TowerDirector(new SeededRng(`${entry.seed}:director`), 7);
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    const requestedPairs = new Set<string>();
    const activePairs = new Set<string>();
    const rotatedOrderTemplates = new Set<string>();
    for (let index = 0; index < 350; index++) {
        const request = director.next(index * 500);
        const question = compiler.next(request, CONTENT_VERSION);
        requestedPairs.add(request.rules.join('+'));
        activePairs.add(question.activeRules.join('+'));
        assert.deepEqual(question.activeRules, request.rules, `${request.rules.join('+')} degraded on ${question.templateId}`);
        if (request.rules.includes('order') && request.rules.includes('rotate')) rotatedOrderTemplates.add(question.templateId);
    }
    assert.equal(requestedPairs.size, 7);
    assert.deepEqual(activePairs, requestedPairs);
    assert.deepEqual([...rotatedOrderTemplates].sort(), ['hanzi-order', 'math-sequence']);
});

test('friend arithmetic preference never overrides an incompatible selected rule', () => {
    const entry: GameEntryParams = { mode: 'friendChallenge', seed: 'friend-order-only', contentVersion: CONTENT_VERSION,
        challengeRole: 'creator', challengeConfig: { themeIds: ['math'], enabledRules: ['order'], durationMs: 60_000 } };
    const director = new ModeQuestionDirector(new SeededRng(`${entry.seed}:director`), entry);
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    for (let index = 0; index < 20; index++) {
        const request = director.next(index * 1_000);
        assert.deepEqual(request.rules, ['order']);
        assert.ok(!request.requiredTags?.includes('arithmetic'));
        const question = compiler.next(request, CONTENT_VERSION);
        assert.equal(question.theme, 'math');
        assert.deepEqual(question.activeRules, ['order']);
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

test('every fact theme sustains 500 questions without short fact repetition', () => {
    for (const theme of ['hanzi', 'english', 'life', 'geography', 'knowledge', 'history'] as const) {
        const entry: GameEntryParams = { mode: 'daily', seed: `density-${theme}`, contentVersion: CONTENT_VERSION, dailyTheme: theme };
        const director = new ModeQuestionDirector(new SeededRng(`${entry.seed}:director`), entry);
        const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
        const lastSeen = new Map<string, number>();
        for (let index = 0; index < 500; index++) {
            const question = compiler.next(director.next((index * 997) % 60_000), CONTENT_VERSION);
            assert.equal(question.theme, theme);
            for (const factId of question.factIds) {
                const previous = lastSeen.get(factId);
                if (previous !== undefined) assert.ok(index - previous > 20, `${theme}:${factId} repeated after ${index - previous}`);
                lastSeen.set(factId, index);
            }
        }
    }
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
