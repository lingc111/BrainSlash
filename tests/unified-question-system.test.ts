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

test('all direct arithmetic templates participate in the same uniform random shuffle', () => {
    const entry: GameEntryParams = { mode: 'brawl60', seed: 'uniform-arithmetic-random', contentVersion: CONTENT_VERSION };
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    const expectedTemplateIds = [
        'math-add', 'math-subtract', 'math-multiply', 'math-property', 'math-divide',
        'math-mixed', 'math-operator', 'math-digit-reverse', 'math-remainder', 'math-fraction-compare',
    ];
    const counts = new Map<string, number>();
    const multipleDivisors = new Set<string>();
    for (let index = 0; index < 600; index++) {
        const question = compiler.next({ themes: ['math'], requiredTags: ['arithmetic'], rules: ['standard'],
            difficulty: 3, targetCount: 4, questionTimeMs: 2_600, speed: 1, phase: 'action' }, CONTENT_VERSION);
        counts.set(question.templateId, (counts.get(question.templateId) ?? 0) + 1);
        if (question.templateId === 'math-property') {
            const divisor = question.prompt.text.match(/^([2357])的倍数$/)?.[1];
            if (divisor) multipleDivisors.add(divisor);
        }
    }
    assert.deepEqual([...counts.keys()].sort(), [...expectedTemplateIds].sort());
    for (const templateId of expectedTemplateIds) assert.equal(counts.get(templateId), 60, templateId);
    assert.deepEqual(multipleDivisors, new Set(['2', '3', '5', '7']));
});

test('uniform arithmetic selection keeps generated content constraints intact', () => {
    const entry: GameEntryParams = { mode: 'brawl60', seed: 'uniform-arithmetic-content', contentVersion: CONTENT_VERSION };
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    let mixed = 0;
    let operator = 0;
    let digitReverse = 0;
    let fraction = 0;
    for (let index = 0; index < 600; index++) {
        const question = compiler.next({ themes: ['math'], requiredTags: ['arithmetic'], rules: ['standard'],
            difficulty: 3, targetCount: 4, questionTimeMs: 2_600, speed: 1, phase: 'action' }, CONTENT_VERSION);
        if (question.templateId === 'math-mixed') mixed += 1;
        if (question.templateId === 'math-operator') operator += 1;
        if (question.templateId === 'math-digit-reverse') {
            digitReverse += 1;
        }
        if (question.templateId === 'math-fraction-compare') {
            fraction += 1;
            assert.ok(question.targets.filter((target) => !target.isBomb)
                .every((target) => /^[1-9]\/[1-9]$/.test(target.text)), question.targets.map((target) => target.text).join(','));
        }
    }
    assert.equal(mixed, 60);
    assert.equal(operator, 60);
    assert.equal(digitReverse, 60);
    assert.equal(fraction, 60);
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

test('numeric ranking asks for inner ranks instead of trivial largest or smallest', () => {
    const entry: GameEntryParams = { mode: 'daily', seed: 'numeric-ranks', contentVersion: CONTENT_VERSION, dailyTheme: 'math' };
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    const prompts = new Set<string>();
    for (let index = 0; index < 200; index += 1) {
        const question = compiler.next({ templateIds: ['math-compare'], themes: ['math'], rules: ['standard'],
            difficulty: 5, targetCount: 5, questionTimeMs: 2_600, speed: 1, phase: 'climax' }, CONTENT_VERSION);
        prompts.add(question.prompt.text);
        assert.ok(!['最大的', '最小的'].includes(question.prompt.text));
        const values = question.targets.filter((target) => !target.isBomb).map((target) => Number(target.value)).sort((a, b) => a - b);
        assert.ok(values.every((value) => value >= 0 && value <= 99));
        const rankText = question.prompt.text.match(/^(第二|第三|第四)(大|小)的$/)!;
        const rank = ({ 第二: 2, 第三: 3, 第四: 4 } as const)[rankText[1] as '第二' | '第三' | '第四'];
        const expected = rankText[2] === '大' ? values[values.length - rank] : values[rank - 1];
        const correct = question.targets.find((target) => question.baseCorrectTargetIds.includes(target.id))!;
        assert.equal(Number(correct.value), expected);
    }
    assert.ok(['第二大的', '第二小的', '第三大的', '第三小的', '第四大的', '第四小的']
        .every((prompt) => prompts.has(prompt)), Array.from(prompts).join(','));
});

test('direction questions use readable text arrows instead of emoji arrows', () => {
    const entry: GameEntryParams = { mode: 'brawl60', seed: 'text-directions', contentVersion: CONTENT_VERSION };
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    // Bare diagonal arrows are prohibited too: WeChat promotes them to emoji
    // even without an explicit U+FE0F emoji variation selector.
    const emojiArrows = /[⬅⬆➡⬇↔↕↖↗↙↘]\uFE0F?|\uFE0F/;
    const textArrows = /[←↑→↓]/;
    for (const templateId of ['vision-direction', 'vision-mirror', 'vision-rotation'] as const) {
        for (let index = 0; index < 20; index += 1) {
            const question = compiler.next({ templateIds: [templateId], themes: ['vision'], rules: ['standard'],
                difficulty: 4, targetCount: 4, questionTimeMs: 2_600, speed: 1, phase: 'action' }, CONTENT_VERSION);
            assert.ok(!emojiArrows.test(question.prompt.text), question.prompt.text);
            assert.ok(question.targets.every((target) => !emojiArrows.test(target.text)), question.targets.map((target) => target.text).join(','));
            assert.ok(textArrows.test(question.prompt.text)
                || question.targets.some((target) => textArrows.test(target.text)), question.prompt.text);
        }
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

test('multiple questions expose 2 3 5 and 7 across the other middle and high difficulties', () => {
    for (const difficulty of [2, 4, 5] as const) {
        const entry: GameEntryParams = { mode: 'brawl60', seed: `multiple-exposure-${difficulty}`, contentVersion: CONTENT_VERSION };
        const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
        const divisors = new Set<string>();
        for (let index = 0; index < 40; index++) {
            const question = compiler.next({ templateIds: ['math-property'], themes: ['math'], rules: ['standard'],
                difficulty, targetCount: 5, questionTimeMs: 2_600, speed: 1, phase: 'action' }, CONTENT_VERSION);
            const divisor = question.prompt.text.match(/^([2357])的倍数$/)?.[1];
            if (divisor) divisors.add(divisor);
        }
        assert.deepEqual(divisors, new Set(['2', '3', '5', '7']));
    }
});

test('ordinary brawl keeps standalone reverse between five and seven point five percent', () => {
    const entry: GameEntryParams = { mode: 'brawl60', seed: 'lower-reverse-frequency', contentVersion: CONTENT_VERSION };
    const director = new ModeQuestionDirector(new SeededRng(`${entry.seed}:director`), entry,
        new Set(['standard', 'reverse', 'rotate', 'multi', 'order', 'bomb']));
    let standaloneReverse = 0;
    let compoundReverse = 0;
    const elapsed = [15_000, 30_000, 50_000];
    for (let index = 0; index < 6_000; index++) {
        const rules = director.next(elapsed[index % elapsed.length]).rules;
        if (rules.length === 1 && rules[0] === 'reverse') standaloneReverse += 1;
        else if (rules.includes('reverse')) compoundReverse += 1;
    }
    const standaloneRatio = standaloneReverse / 6_000;
    const compoundRatio = compoundReverse / 6_000;
    const totalRatio = standaloneRatio + compoundRatio;
    assert.ok(standaloneRatio >= 0.05, `standalone reverse frequency unexpectedly low: ${standaloneRatio}`);
    assert.ok(standaloneRatio <= 0.075, `standalone reverse frequency too high: ${standaloneRatio}`);
    assert.ok(compoundRatio >= 0.025, `compound reverse frequency unexpectedly low: ${compoundRatio}`);
    assert.ok(compoundRatio <= 0.035, `compound reverse frequency too high: ${compoundRatio}`);
    assert.ok(totalRatio >= 0.07, `total reverse frequency unexpectedly low: ${totalRatio}`);
    assert.ok(totalRatio <= 0.10, `total reverse frequency too high: ${totalRatio}`);
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
        assert.ok(question.targets.filter((target) => !target.isBomb)
            .flatMap((target) => target.text.match(/\d+/g) ?? [])
            .every((value) => Number(value) <= 99));
    }
    assert.deepEqual([...prompts].sort(), ['数字升序', '数字降序'].sort());
    const entry: GameEntryParams = { mode: 'daily', seed: 'two-digit-sequences', contentVersion: CONTENT_VERSION, dailyTheme: 'math' };
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    for (let index = 0; index < 80; index += 1) {
        const question = compiler.next({ templateIds: ['math-sequence'], themes: ['math'], rules: ['standard'],
            difficulty: 5, targetCount: 4, questionTimeMs: 2_600, speed: 1, phase: 'climax' }, CONTENT_VERSION);
        const values = `${question.prompt.text}|${question.targets.map((target) => target.text).join('|')}`.match(/\d+/g)?.map(Number) ?? [];
        assert.ok(values.length > 0 && values.every((value) => value <= 99), values.join(','));
    }
});

test('result-order expressions keep add/sub operands within 20 and multiply/divide within 10', () => {
    const entry: GameEntryParams = { mode: 'daily', seed: 'bounded-order-expressions', contentVersion: CONTENT_VERSION, dailyTheme: 'math' };
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    const operators = new Set<string>();
    let expressionQuestions = 0;
    for (let index = 0; index < 240; index += 1) {
        const question = compiler.next({ templateIds: ['math-sequence'], themes: ['math'], rules: ['order'],
            difficulty: 5, targetCount: 5, questionTimeMs: 2_600, speed: 1, phase: 'climax' }, CONTENT_VERSION);
        if (!question.prompt.text.startsWith('按结果')) continue;
        expressionQuestions += 1;
        for (const target of question.targets.filter((item) => !item.isBomb)) {
            const match = target.text.match(/^(\d+)([+\-×÷])(\d+)$/)!;
            assert.ok(match, target.text);
            const left = Number(match[1]);
            const operator = match[2];
            const right = Number(match[3]);
            operators.add(operator);
            const limit = operator === '+' || operator === '-' ? 20 : 10;
            assert.ok(left <= limit && right <= limit, target.text);
            const result = operator === '+' ? left + right : operator === '-' ? left - right
                : operator === '×' ? left * right : left / right;
            assert.equal(result, target.value, target.text);
        }
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }
    assert.ok(expressionQuestions >= 120, `too few expression questions: ${expressionQuestions}`);
    assert.deepEqual(operators, new Set(['+', '-', '×', '÷']));
});

test('knowledge templates are uniformly randomized and contain no computer trivia', () => {
    const entry: GameEntryParams = { mode: 'daily', seed: 'civic-density', contentVersion: CONTENT_VERSION, dailyTheme: 'knowledge' };
    const director = new ModeQuestionDirector(new SeededRng(`${entry.seed}:director`), entry);
    const compiler = new QuestionCompiler(new SeededRng(`${entry.seed}:compiler`), GAMEPLAY_CONFIG, entry);
    let civic = 0;
    const computerTerms = /计算机|CPU|RAM|SSD|内存|硬盘|操作系统|浏览器|搜索引擎|Wi-?Fi|云存储|人工智能/;
    for (let index = 0; index < 700; index += 1) {
        const question = compiler.next(director.next((index * 997) % 60_000), CONTENT_VERSION);
        if (question.templateId === 'knowledge-civic') civic += 1;
        assert.ok(!computerTerms.test(`${question.prompt.text}|${question.targets.map((target) => target.text).join('|')}`));
    }
    const ratio = civic / 700;
    assert.ok(ratio >= 0.12 && ratio <= 0.17, `unexpected civic ratio: ${ratio}`);
});

test('new language and history templates join uniform selection and raise myth-person coverage', () => {
    const historyEntry: GameEntryParams = { mode: 'daily', seed: 'history-person-expansion', contentVersion: CONTENT_VERSION, dailyTheme: 'history' };
    const historyCompiler = new QuestionCompiler(new SeededRng(`${historyEntry.seed}:compiler`), GAMEPLAY_CONFIG, historyEntry);
    const historyCounts = new Map<string, number>();
    for (let index = 0; index < 800; index += 1) {
        const question = historyCompiler.next({ themes: ['history'], rules: ['standard'], difficulty: 3,
            targetCount: 4, questionTimeMs: 2_600, speed: 1, phase: 'action' }, CONTENT_VERSION);
        historyCounts.set(question.templateId, (historyCounts.get(question.templateId) ?? 0) + 1);
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }
    assert.equal(historyCounts.get('history-myth'), 100);
    assert.equal(historyCounts.get('history-myth-person'), 100);
    assert.equal(historyCounts.get('history-allusion-person'), 100);
    assert.equal(((historyCounts.get('history-myth') ?? 0) + (historyCounts.get('history-myth-person') ?? 0)) / 800, 0.25);

    const hanziEntry: GameEntryParams = { mode: 'daily', seed: 'xiehouyu-expansion', contentVersion: CONTENT_VERSION, dailyTheme: 'hanzi' };
    const hanziCompiler = new QuestionCompiler(new SeededRng(`${hanziEntry.seed}:compiler`), GAMEPLAY_CONFIG, hanziEntry);
    let xiehouyu = 0;
    for (let index = 0; index < 900; index += 1) {
        const question = hanziCompiler.next({ themes: ['hanzi'], rules: ['standard'], difficulty: 3,
            targetCount: 4, questionTimeMs: 2_600, speed: 1, phase: 'action' }, CONTENT_VERSION);
        if (question.templateId === 'hanzi-xiehouyu') xiehouyu += 1;
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }
    assert.equal(xiehouyu, 100);
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
