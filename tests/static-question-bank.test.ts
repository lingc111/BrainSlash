import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { GAMEPLAY_CONFIG } from '../assets/Scripts/configs/GameConfig.ts';
import { Brawl60Director } from '../assets/Scripts/domain/Brawl60Director.ts';
import { CONTENT_FAMILIES } from '../assets/Scripts/domain/ContentCatalog.ts';
import { QuestionGenerator } from '../assets/Scripts/domain/QuestionGenerator.ts';
import { evaluateRules } from '../assets/Scripts/domain/Rules.ts';
import { SeededRng } from '../assets/Scripts/domain/SeededRng.ts';
import {
    clearStaticQuestionPacksForTests,
    installStaticQuestionPacks,
    installedStaticQuestionCount,
    isStaticQuestionPack,
    type StaticQuestionPack,
} from '../assets/Scripts/domain/StaticQuestionBank.ts';

function readPacks(): StaticQuestionPack[] {
    const directory = join(process.cwd(), 'assets', 'resources', 'question-banks');
    return readdirSync(directory)
        .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
        .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')) as unknown)
        .filter(isStaticQuestionPack);
}

test('resources subpackage contains exactly 5000 valid static playable questions', () => {
    const packs = readPacks();
    assert.equal(packs.length, 8);
    assert.equal(packs.reduce((sum, pack) => sum + pack.records.length, 0), 5_000);
    const ids = packs.flatMap((pack) => pack.records.map((record) => record.id));
    assert.equal(new Set(ids).size, 5_000);
    for (const pack of packs) {
        for (const record of pack.records) {
            assert.equal(record.theme, pack.theme);
            assert.ok(record.distractors.length >= 3);
            assert.ok(!record.distractors.map(String).includes(String(record.answer)));
        }
    }
});

test('installed static questions are selected by the live generator', () => {
    clearStaticQuestionPacksForTests();
    assert.equal(installStaticQuestionPacks(readPacks()), 5_000);
    assert.equal(installedStaticQuestionCount(), 5_000);

    const family = CONTENT_FAMILIES.find((item) => item.kind === 'math-add')!;
    const generator = new QuestionGenerator(new SeededRng('static-bank-live-selection'), GAMEPLAY_CONFIG);
    const question = generator.next({
        phase: 'action',
        difficultyStage: 2,
        targetCount: 4,
        questionTimeMs: 2_600,
        speed: 1,
        family,
        rules: ['standard'],
    });
    assert.ok(question.factIds?.some((id) => id.startsWith('static.math.add.')));
    assert.equal(evaluateRules(question).requiredTargetIds.length, 1);
});

test('cross-session history excludes recently accepted static facts', () => {
    clearStaticQuestionPacksForTests();
    installStaticQuestionPacks(readPacks());
    const family = CONTENT_FAMILIES.find((item) => item.kind === 'math-add')!;
    const accepted: string[] = [];
    const acceptedSignatures: string[] = [];
    const directive = {
        phase: 'action' as const, difficultyStage: 2 as const, targetCount: 4,
        questionTimeMs: 2_600, speed: 1, family, rules: ['standard' as const],
    };
    const first = new QuestionGenerator(new SeededRng('cross-session-same-seed'), GAMEPLAY_CONFIG, {
        onQuestionAccepted: (ids, signature) => {
            accepted.push(...ids);
            acceptedSignatures.push(signature);
        },
    }).next(directive);
    assert.ok(first.factIds?.length);
    const second = new QuestionGenerator(new SeededRng('cross-session-same-seed'), GAMEPLAY_CONFIG, {
        recentFactIds: accepted,
        recentSemanticSignatures: acceptedSignatures,
    }).next(directive);
    assert.notDeepEqual(second.factIds, first.factIds);
});

test('ordinary brawl uses static records for most compatible questions', () => {
    clearStaticQuestionPacksForTests();
    installStaticQuestionPacks(readPacks());
    let staticCount = 0;
    let total = 0;
    const recent: string[] = [];
    const recentSignatures: string[] = [];
    for (let run = 0; run < 20; run++) {
        const seed = `static-usage-${run}`;
        const director = new Brawl60Director(new SeededRng(`${seed}:director`));
        const generator = new QuestionGenerator(new SeededRng(`${seed}:gameplay`), GAMEPLAY_CONFIG, {
            recentFactIds: recent,
            recentSemanticSignatures: recentSignatures,
            onQuestionAccepted: (ids, signature) => {
                recent.push(...ids);
                if (recent.length > 300) recent.splice(0, recent.length - 300);
                const existing = recentSignatures.indexOf(signature);
                if (existing >= 0) recentSignatures.splice(existing, 1);
                recentSignatures.push(signature);
                if (recentSignatures.length > 300) recentSignatures.shift();
            },
        });
        for (let index = 0; index < 50; index++) {
            const question = generator.next(director.next(Math.min(59_000, index * 1_250)));
            if (question.factIds?.some((id) => id.startsWith('static.'))) staticCount++;
            total++;
        }
    }
    assert.ok(staticCount / total >= 0.7, `static usage too low: ${staticCount}/${total}`);
});
