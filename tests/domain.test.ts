import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTENT_VERSION, GAMEPLAY_CONFIG, validateRuleSet } from '../assets/Scripts/configs/GameConfig.ts';
import { isDirectionSensitiveTemplate, legalRuleSetsForTheme, phaseAt, targetCountForTemplate, templateSupportsRules } from '../assets/Scripts/domain/QuestionPolicy.ts';
import { BrawlRequestFixture, DirectiveCompilerFixture, FriendChallengeRequestFixture } from './question-compiler-fixtures.ts';
import {
    ENGLISH_ANTONYMS,
    ENGLISH_WORDS,
    GEOGRAPHY_FACTS,
    HISTORY_ANCIENT_FACTS,
    HISTORY_MODERN_AWAKENING_FACTS,
    HISTORY_MODERN_OPENING_FACTS,
    HISTORY_MODERN_RESISTANCE_FACTS,
    HISTORY_MYTH_FACTS,
    IDIOMS,
    KNOWLEDGE_CULTURE_FACTS,
    KNOWLEDGE_NATURE_FACTS,
    KNOWLEDGE_SCIENCE_FACTS,
    LIFE_CATEGORY_FACTS,
} from '../assets/Scripts/domain/ContentCatalog.ts';
import { HANZI_ANTONYM_FACTS, HANZI_SYNONYM_FACTS } from '../assets/Scripts/domain/HanziRelationCatalog.ts';
import {
    KNOWLEDGE_CIVIC_FACTS,
    KNOWLEDGE_CULTURE_EXPANSION,
    KNOWLEDGE_NATURE_EXPANSION,
    KNOWLEDGE_SCIENCE_EXPANSION,
} from '../assets/Scripts/domain/KnowledgeExpansionCatalog.ts';
import { getQuestionBankStats, QUESTION_BANK_PACKS } from '../assets/Scripts/domain/QuestionBankRegistry.ts';
import { GameSession } from '../assets/Scripts/domain/GameSession.ts';
import { countdownWarningSecond, failureFeedback, successFeedback } from '../assets/Scripts/domain/GameFeedback.ts';
import { beginDailyRun, createDailyChallenge, createDailyHomePresentation, dailyRecipeById, localDateKey, recordDailyRun } from '../assets/Scripts/domain/DailyChallenge.ts';
import {
    canStartFriendChallenge,
    createFriendChallengePayload,
    DEFAULT_FRIEND_CHALLENGE_CONFIG,
    encodeFriendChallengeQuery,
    FRIEND_CHALLENGE_RULES,
    friendTargetPresentation,
    normalizeFriendChallengeConfig,
    parseFriendChallengeQuery,
} from '../assets/Scripts/domain/FriendChallenge.ts';
import { GestureResolver, shouldKeepIncompleteGesture } from '../assets/Scripts/domain/GestureResolver.ts';
import type { FriendChallengeConfig, PlayerProgress, QuestionInstance, RunResult } from '../assets/Scripts/domain/Models.ts';
import { ModeQuestionDirector } from '../assets/Scripts/domain/ModeQuestionDirector.ts';
import { QUESTION_TEMPLATES, QuestionCompiler, templatesForRequest } from '../assets/Scripts/domain/QuestionSystem.ts';
import { createResultPresentation, finalizeResult } from '../assets/Scripts/domain/ResultSummary.ts';
import { createMistakeRecord, evaluateRules, maximumAnswerTextLength, questionFlightDurationSeconds, questionPreviewDurationSeconds, rulesForReadableTargets, slashRuleCount, slashRuleLabel } from '../assets/Scripts/domain/Rules.ts';
import { SeededRng } from '../assets/Scripts/domain/SeededRng.ts';
import { validateQuestion } from '../assets/Scripts/domain/FairnessValidator.ts';
import { difficultyAt } from '../assets/Scripts/domain/DifficultyDirector.ts';
import {
    calculateHomePortraitLayout,
    HOME_PORTRAIT_SECTION_HEIGHTS,
    type HomeSectionId,
} from '../assets/Scripts/UI/home/HomePortraitLayout.ts';
import { RunSeedFactory } from '../assets/Scripts/app/RunSeedFactory.ts';
import { PlatformService } from '../assets/Scripts/infrastructure/PlatformService.ts';
import { AudioService, SoundThrottle } from '../assets/Scripts/infrastructure/AudioService.ts';
import { createDefaultSave, migrateV1ToV2, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5, migrateV5ToV6, migrateV6ToV7, normalizeV5, RECENT_QUESTION_HISTORY_LIMIT } from '../assets/Scripts/infrastructure/SaveData.ts';
import { applyBrawlFinalScore, brawlRecordFromRun, calculateBrawlRankScore, createLocalLeaderboard, emptyBrawlRecord } from '../assets/Scripts/domain/Leaderboard.ts';
import { TowerDirector } from '../assets/Scripts/domain/TowerDirector.ts';
import { TowerChallengeRuntime, towerChallengeSummary, validateTowerChallenge } from '../assets/Scripts/domain/TowerChallenge.ts';
import {
    DEFAULT_TOWER_PROGRESS,
    allowedBrawlRules,
    commitTowerFloor,
    normalizeTowerProgress,
    towerFloorConfig,
    towerPointsForClear,
    towerTimeBonus,
    unlockedRulesForTower,
} from '../assets/Scripts/domain/TowerMode.ts';
import { calculatePortraitTargetLayout, portraitTargetEntranceDelay } from '../assets/Scripts/UI/PortraitTargetLayout.ts';
import {
    createPortraitTargetMotionPlans,
    evaluatePortraitTargetMotion,
    evaluatePortraitTargetRotation,
    PORTRAIT_TARGET_MAX_SEPARATION_OFFSET,
    PORTRAIT_TARGET_MIN_SEPARATION,
    PORTRAIT_TARGET_ROTATION_DEGREES_PER_SECOND,
    resolveSoftTargetSeparation,
} from '../assets/Scripts/UI/PortraitTargetMotion.ts';
import { ACTIVE_TARGET_SKINS, ALL_TARGET_SKINS, COLOR_QUESTION_TARGET_SKIN, TARGET_SKIN_VISUAL_SCALE, targetContentLayout, targetShapeForSkin, targetSkinForAnswer, targetSkinPixelScale, targetSkinVisualScale, uniqueColorTargetSkins } from '../assets/Scripts/UI/TargetSkinSizing.ts';
import { targetTextPresentation, towerOpeningTextPresentation } from '../assets/Scripts/UI/TargetTypography.ts';

function pipeline(seed: string): { director: BrawlRequestFixture; generator: DirectiveCompilerFixture } {
    return {
        director: new BrawlRequestFixture(new SeededRng(`${seed}:director`)),
        generator: new DirectiveCompilerFixture(new SeededRng(`${seed}:gameplay`), GAMEPLAY_CONFIG),
    };
}

const TEST_QUESTION_META: Pick<QuestionInstance, 'templateId' | 'contentVersion' | 'engineId' | 'factIds'> = {
    templateId: 'math-add', contentVersion: 'test', engineId: 'single', factIds: [],
};

function assertCompletesAcrossSeparateStrokes(constraint: ReturnType<typeof evaluateRules>): void {
    assert.equal(shouldKeepIncompleteGesture(constraint), true);
    const gesture = new GestureResolver(constraint);
    for (const targetId of constraint.requiredTargetIds.slice(0, -1)) {
        assert.equal(gesture.hit(targetId).status, 'continue');
        assert.equal(gesture.end(shouldKeepIncompleteGesture(constraint)).status, 'continue');
    }
    assert.equal(gesture.hit(constraint.requiredTargetIds.at(-1)!).status, 'success');
}

function decodeQuery(query: string): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(query).entries());
}

test('seeded RNG is deterministic and streams do not drift', () => {
    const a = new SeededRng('same'), b = new SeededRng('same');
    assert.deepEqual(Array.from({ length: 20 }, () => a.next()), Array.from({ length: 20 }, () => b.next()));
    assert.notEqual(a.fork('gameplay').next(), a.fork('visual').next());
});

test('friend challenge payload round-trips and rebuilds the same question sequence', () => {
    const payload = createFriendChallengePayload({
        entry: { mode: 'brawl60', seed: 'shared:/?seed&1', contentVersion: CONTENT_VERSION, recipeId: 'mixed' },
        score: 987.9,
    });
    assert.equal(payload.targetScore, 987);
    const parsed = parseFriendChallengeQuery(decodeQuery(encodeFriendChallengeQuery(payload)), CONTENT_VERSION);
    assert.equal(parsed.status, 'valid');
    if (parsed.status !== 'valid') return;
    assert.deepEqual(parsed.entry, {
        mode: 'friendChallenge', seed: 'shared:/?seed&1', contentVersion: CONTENT_VERSION,
        recipeId: 'mixed', challengeRole: 'responder', targetScore: 987,
    });
    const first = pipeline(parsed.entry.seed), second = pipeline(parsed.entry.seed);
    for (let index = 0; index < 64; index++) {
        const elapsed = (index * 947) % 60_000;
        assert.deepEqual(first.generator.next(first.director.next(elapsed)), second.generator.next(second.director.next(elapsed)));
    }
});

test('friend challenge parser distinguishes expired, invalid and unrelated links', () => {
    const base = { v: '1', mode: 'brawl60', seed: 'friend-seed', contentVersion: CONTENT_VERSION, recipeId: 'mixed', targetScore: '800' };
    assert.equal(parseFriendChallengeQuery({}, CONTENT_VERSION).status, 'none');
    assert.equal(parseFriendChallengeQuery({ source: 'campaign' }, CONTENT_VERSION).status, 'none');
    assert.equal(parseFriendChallengeQuery({ ...base, contentVersion: 'old-content' }, CONTENT_VERSION).status, 'expired');
    assert.equal(parseFriendChallengeQuery({ ...base, v: '2' }, CONTENT_VERSION).status, 'invalid');
    assert.equal(parseFriendChallengeQuery({ ...base, mode: 'daily' }, CONTENT_VERSION).status, 'invalid');
    for (const targetScore of ['', 'NaN', '-1', '12.5', '100000001']) {
        assert.equal(parseFriendChallengeQuery({ ...base, targetScore }, CONTENT_VERSION).status, 'invalid');
    }
    assert.equal(canStartFriendChallenge({ mode: 'friendChallenge', seed: 'valid', contentVersion: CONTENT_VERSION, targetScore: 0 }), true);
    assert.equal(canStartFriendChallenge({ mode: 'friendChallenge', seed: 'missing-target', contentVersion: CONTENT_VERSION }), false);
    assert.equal(canStartFriendChallenge({ mode: 'brawl60', seed: 'wrong-mode', contentVersion: CONTENT_VERSION, targetScore: 800 }), false);
});

test('platform adapter shares and receives cold or warm friend challenge links', () => {
    type ShowOptions = { query?: Record<string, string> };
    const host = globalThis as typeof globalThis & { wx?: Record<string, unknown> };
    const previousWx = host.wx;
    let shared: { title: string; query: string } | undefined;
    let onShow: ((options: ShowOptions) => void) | undefined;
    const payload = createFriendChallengePayload({
        entry: { mode: 'brawl60', seed: 'platform-seed', contentVersion: CONTENT_VERSION, recipeId: 'mixed' },
        score: 860,
    });
    const coldQuery = decodeQuery(encodeFriendChallengeQuery(payload));
    host.wx = {
        shareAppMessage: (options: { title: string; query: string }) => { shared = options; },
        getLaunchOptionsSync: () => ({ query: coldQuery }),
        onShow: (listener: (options: ShowOptions) => void) => { onShow = listener; },
    };
    try {
        const platform = new PlatformService();
        platform.share(payload);
        assert.match(shared?.title ?? '', /860/);
        assert.deepEqual(decodeQuery(shared?.query ?? ''), coldQuery);
        assert.equal(platform.readChallenge(CONTENT_VERSION).status, 'valid');
        let warmStatus = 'none';
        platform.onChallengeOpened(CONTENT_VERSION, (result) => { warmStatus = result.status; });
        onShow?.({ query: coldQuery });
        assert.equal(warmStatus, 'valid');
        onShow?.({ query: { source: 'resume' } });
        assert.equal(warmStatus, 'valid');
    } finally {
        host.wx = previousWx;
    }
});

test('platform adapter recovers a share opened before the warm-start listener is registered', () => {
    const host = globalThis as typeof globalThis & { wx?: Record<string, unknown> };
    const previousWx = host.wx;
    const payload = createFriendChallengePayload({
        entry: {
            mode: 'friendChallenge', seed: 'latest-enter-seed', contentVersion: CONTENT_VERSION,
            challengeConfig: { themeIds: ['math'], enabledRules: ['standard'], durationMs: 60_000 },
            challengeRole: 'creator',
        },
        score: 920,
    });
    const challengeQuery = decodeQuery(encodeFriendChallengeQuery(payload));
    host.wx = {
        // The process originally cold-started from the ordinary home entry.
        getLaunchOptionsSync: () => ({ query: { source: 'home' } }),
        // WeChat then retained that process and reopened it from a share card.
        getEnterOptionsSync: () => ({ query: challengeQuery }),
    };
    try {
        const result = new PlatformService().readChallenge(CONTENT_VERSION);
        assert.equal(result.status, 'valid');
        if (result.status === 'valid') {
            assert.equal(result.entry.seed, payload.seed);
            assert.equal(result.entry.targetScore, payload.targetScore);
            assert.deepEqual(result.entry.challengeConfig, payload.config);
        }
    } finally {
        host.wx = previousWx;
    }
});

test('platform adapter accepts raw percent-encoded WeChat query values', () => {
    const host = globalThis as typeof globalThis & { wx?: Record<string, unknown> };
    const previousWx = host.wx;
    const payload = createFriendChallengePayload({
        entry: {
            mode: 'friendChallenge', seed: 'encoded-seed', contentVersion: CONTENT_VERSION,
            challengeConfig: { themeIds: ['math', 'english'], enabledRules: ['standard', 'reverse'], durationMs: 90_000 },
            challengeRole: 'creator',
        },
        score: 880,
    });
    const encodedQuery = Object.fromEntries(new URLSearchParams(encodeFriendChallengeQuery(payload)).entries());
    encodedQuery.themes = encodeURIComponent(encodedQuery.themes);
    encodedQuery.rules = encodeURIComponent(encodedQuery.rules);
    host.wx = { getEnterOptionsSync: () => ({ query: encodedQuery }) };
    try {
        const result = new PlatformService().readChallenge(CONTENT_VERSION);
        assert.equal(result.status, 'valid');
        if (result.status === 'valid') assert.deepEqual(result.entry.challengeConfig, payload.config);
    } finally {
        host.wx = previousWx;
    }
});

test('platform adapter falls back when latest-entry options temporarily throw', () => {
    const host = globalThis as typeof globalThis & { wx?: Record<string, unknown> };
    const previousWx = host.wx;
    const payload = createFriendChallengePayload({
        entry: { mode: 'brawl60', seed: 'fallback-seed', contentVersion: CONTENT_VERSION, recipeId: 'mixed' },
        score: 720,
    });
    const query = Object.fromEntries(new URLSearchParams(encodeFriendChallengeQuery(payload)).entries());
    host.wx = {
        getEnterOptionsSync: () => { throw new Error('base library not ready'); },
        getLaunchOptionsSync: () => ({ query }),
    };
    try {
        assert.equal(new PlatformService().readChallenge(CONTENT_VERSION).status, 'valid');
    } finally {
        host.wx = previousWx;
    }
});

test('friend target HUD reports behind, tied and ahead score states', () => {
    assert.deepEqual(friendTargetPresentation(650, 800), { text: '好友目标 800 · 还差 150', tone: 'behind', scoreDelta: -150 });
    assert.deepEqual(friendTargetPresentation(800, 800), { text: '好友 800 · 已追平', tone: 'tied', scoreDelta: 0 });
    assert.deepEqual(friendTargetPresentation(920, 800), { text: '好友 800 · 已超过 120', tone: 'ahead', scoreDelta: 120 });
});

test('audio service synthesizes cues, respects settings and throttles rapid repeats', () => {
    let now = 1_000;
    let oscillatorCount = 0;
    const parameter = { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined };
    const context = {
        currentTime: 2,
        destination: {},
        state: 'running',
        createOscillator: () => {
            oscillatorCount++;
            return { frequency: parameter, type: 'sine', connect: () => undefined, start: () => undefined, stop: () => undefined };
        },
        createGain: () => ({ gain: parameter, connect: () => undefined }),
    };
    const audio = new AudioService(() => now, () => context as never);
    assert.equal(audio.play('slash'), true);
    assert.equal(oscillatorCount, 2);
    assert.equal(audio.play('slash'), false);
    assert.equal(oscillatorCount, 2);
    now += 34;
    assert.equal(audio.play('slash'), true);
    assert.equal(oscillatorCount, 4);
    audio.enabled = false;
    assert.equal(audio.play('master'), false);
    assert.equal(oscillatorCount, 4);
});

test('audio service resumes once without stacking delayed cues', async () => {
    let oscillatorCount = 0;
    let finishResume = (): void => undefined;
    const parameter = { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined };
    const context = {
        currentTime: 2,
        destination: {},
        state: 'suspended',
        createOscillator: () => {
            oscillatorCount++;
            return { frequency: parameter, type: 'sine', connect: () => undefined, start: () => undefined, stop: () => undefined };
        },
        createGain: () => ({ gain: parameter, connect: () => undefined }),
        resume: () => new Promise<void>((resolve) => {
            finishResume = () => { context.state = 'running'; resolve(); };
        }),
    };
    const audio = new AudioService(() => 1_000, () => context as never);
    assert.equal(audio.play('ui'), true);
    assert.equal(audio.play('correct'), false);
    assert.equal(oscillatorCount, 0);
    finishResume();
    await Promise.resolve();
    assert.equal(oscillatorCount, 1);
});

test('sound throttle recovers from cooldowns and device clock rollback', () => {
    const throttle = new SoundThrottle();
    assert.equal(throttle.allow('warning', 1_000), true);
    assert.equal(throttle.allow('warning', 1_200), false);
    assert.equal(throttle.allow('warning', 1_280), true);
    assert.equal(throttle.allow('warning', 900), true);
});

test('game feedback policy maps master, combo, failures and final countdown', () => {
    assert.deepEqual(successFeedback('correct', 4), { sound: 'correct', haptic: 'light', hitStopMs: 0, comboMilestone: false });
    assert.deepEqual(successFeedback('master', 10), { sound: 'master', haptic: 'medium', hitStopMs: 100, comboMilestone: true });
    assert.deepEqual(successFeedback('masterSlash', 10), { sound: 'master', haptic: 'medium', hitStopMs: 120, comboMilestone: true });
    assert.deepEqual(failureFeedback('bomb', 6), { sound: 'bomb', haptic: 'heavy', label: '', showComboBreak: true });
    assert.deepEqual(failureFeedback('orderError', 2), { sound: 'error', haptic: 'medium', label: '顺序错误', showComboBreak: false });
    assert.deepEqual(failureFeedback('wrong', 0), { sound: 'error', haptic: 'medium', label: '', showComboBreak: false });
    assert.deepEqual(failureFeedback('miss', 0), { sound: 'error', haptic: 'medium', label: '', showComboBreak: false });
    assert.equal(countdownWarningSecond(5_000, 6), 5);
    assert.equal(countdownWarningSecond(4_999, 5), null);
    assert.equal(countdownWarningSecond(4_000, 5), 4);
    assert.equal(countdownWarningSecond(6_000, 7), null);
    assert.equal(countdownWarningSecond(0, 1), null);
});

test('numeric comparison targets remain primitive numbers with readable labels', () => {
    const template = QUESTION_TEMPLATES.find((candidate) => candidate.id === 'math-compare')!;
    const generator = new DirectiveCompilerFixture(new SeededRng('wechat-set-spread-regression'), GAMEPLAY_CONFIG);
    const question = generator.next({
        phase: 'warmup',
        difficultyStage: 1,
        targetCount: 2,
        questionTimeMs: 3_000,
        speed: 1,
        template,
        rules: ['standard'],
    });

    for (const target of question.targets) {
        assert.equal(typeof target.value, 'number');
        assert.match(target.text, /^\d+$/);
    }
});

test('friend challenge config validates canonical themes, rules, durations and compatibility', () => {
    assert.equal(normalizeFriendChallengeConfig({ themeIds: [], enabledRules: ['standard'], durationMs: 60_000 }).valid, false);
    assert.equal(normalizeFriendChallengeConfig({ themeIds: ['math'], enabledRules: [], durationMs: 60_000 }).valid, false);
    assert.equal(normalizeFriendChallengeConfig({ themeIds: ['math', 'math'], enabledRules: ['standard'], durationMs: 60_000 }).valid, false);
    assert.equal(normalizeFriendChallengeConfig({ themeIds: ['math'], enabledRules: ['standard'], durationMs: 75_000 }).valid, false);
    const incompatible = normalizeFriendChallengeConfig({ themeIds: ['geography'], enabledRules: ['multi'], durationMs: 90_000 });
    assert.deepEqual(incompatible, { valid: false, reason: 'incompatible' });
    const valid = normalizeFriendChallengeConfig({ themeIds: ['history', 'math'], enabledRules: ['bomb', 'reverse'], durationMs: 120_000 });
    assert.deepEqual(valid, {
        valid: true,
        config: { themeIds: ['math', 'history'], enabledRules: ['reverse'], durationMs: 120_000 },
    });
    assert.deepEqual(FRIEND_CHALLENGE_RULES, ['standard', 'reverse', 'rotate', 'multi', 'order']);
});

test('friend challenge V2 parser rejects tampering and preserves custom configuration', () => {
    const config: FriendChallengeConfig = { themeIds: ['math', 'english'], enabledRules: ['standard', 'reverse'], durationMs: 90_000 };
    const payload = createFriendChallengePayload({
        entry: { mode: 'friendChallenge', seed: 'custom-seed', contentVersion: CONTENT_VERSION, challengeConfig: config, challengeRole: 'creator' },
        score: 1_234,
    });
    const query = decodeQuery(encodeFriendChallengeQuery(payload));
    const parsed = parseFriendChallengeQuery(query, CONTENT_VERSION);
    assert.equal(parsed.status, 'valid');
    if (parsed.status === 'valid') {
        assert.deepEqual(parsed.entry.challengeConfig, config);
        assert.equal(parsed.entry.challengeRole, 'responder');
        assert.equal(parsed.entry.targetScore, 1_234);
    }
    const legacy = parseFriendChallengeQuery({ ...query, rules: 'standard,reverse,bomb' }, CONTENT_VERSION);
    assert.equal(legacy.status, 'valid');
    if (legacy.status === 'valid') assert.deepEqual(legacy.entry.challengeConfig, config);
    assert.equal(parseFriendChallengeQuery({ ...query, duration: '75000' }, CONTENT_VERSION).status, 'invalid');
    assert.equal(parseFriendChallengeQuery({ ...query, themes: 'math,math' }, CONTENT_VERSION).status, 'invalid');
    assert.equal(parseFriendChallengeQuery({ ...query, rules: 'multi', themes: 'geography' }, CONTENT_VERSION).status, 'invalid');
});



test('friend challenge sessions honor 60, 90 and 120 second durations with three lives', () => {
    for (const durationMs of [60_000, 90_000, 120_000] as const) {
        const session = new GameSession({
            mode: 'friendChallenge', seed: `duration-${durationMs}`, contentVersion: CONTENT_VERSION,
            challengeRole: 'creator', challengeConfig: { themeIds: ['math'], enabledRules: ['standard'], durationMs },
        }, GAMEPLAY_CONFIG);
        assert.equal(session.state.life, 3);
        assert.equal(session.state.remainingMs, durationMs);
        session.start();
        session.tick(durationMs - 1);
        assert.equal(session.state.phase, 'playing');
        session.tick(1);
        assert.equal(session.state.phase, 'finished');
        assert.equal(session.state.remainingMs, 0);
    }
});

test('rotation excludes reverse and every direction-sensitive template', () => {
    assert.equal(validateRuleSet(['rotate']), true);
    assert.equal(validateRuleSet(['multi', 'rotate']), true);
    assert.equal(validateRuleSet(['reverse', 'rotate']), false);
    for (const template of QUESTION_TEMPLATES) {
        if (isDirectionSensitiveTemplate(template)) {
            assert.equal(templateSupportsRules(template, ['rotate']), false);
            assert.equal(templateSupportsRules(template, ['bomb', 'rotate']), false);
        }
    }
    const math = QUESTION_TEMPLATES.find((template) => template.id === 'math-add')!;
    assert.equal(templateSupportsRules(math, ['rotate']), true);
    assert.equal(templateSupportsRules(math, ['bomb', 'rotate']), true);
});

test('reverse never turns a bomb into a required target', () => {
    const question: QuestionInstance = { ...TEST_QUESTION_META,
        id: 'reverse', theme: 'math', prompt: { text: '反向' },
        targets: [{ id: 'right', text: '2' }, { id: 'wrong', text: '3' }, { id: 'bomb', text: '爆', isBomb: true }],
        baseCorrectTargetIds: ['right'], activeRules: ['reverse', 'bomb'], timeLimitMs: 3000,
    };
    const constraint = evaluateRules(question);
    assert.deepEqual(constraint.requiredTargetIds, ['wrong']);
    assert.deepEqual(constraint.forbiddenTargetIds, ['bomb']);
});

test('mistake review records the effective answer after applying rules', () => {
    const question: QuestionInstance = { ...TEST_QUESTION_META,
        id: 'mistake-reverse', theme: 'math', prompt: { text: '偶数' },
        targets: [{ id: 'even', text: '2' }, { id: 'odd', text: '3' }, { id: 'bomb', text: '爆', isBomb: true }],
        baseCorrectTargetIds: ['even'], activeRules: ['reverse', 'bomb'], timeLimitMs: 3_000,
    };
    const constraint = evaluateRules(question);
    const mistake = createMistakeRecord(question, constraint, 'wrong', 'even');
    assert.deepEqual(mistake, {
        questionId: 'mistake-reverse', prompt: '偶数', ruleLabel: '反向', failureKind: 'wrong',
        selectedAnswer: '2', correctAnswer: '3',
    });
    assert.equal(createMistakeRecord(question, constraint, 'miss').selectedAnswer, '超时未完成');
});

test('slash rule labels describe the gesture and ignore bomb distractors', () => {
    assert.equal(slashRuleLabel(['standard']), '单选');
    assert.equal(slashRuleLabel(['bomb']), '单选');
    assert.equal(slashRuleLabel(['bomb', 'multi']), '多选');
    assert.equal(slashRuleLabel(['order']), '顺序');
    assert.equal(slashRuleLabel(['multi', 'reverse']), '多选 + 反向');
    assert.equal(slashRuleCount(['bomb', 'multi']), 1);
    assert.equal(slashRuleCount(['multi', 'reverse']), 2);
    assert.equal(questionPreviewDurationSeconds(['bomb', 'multi']), 0.3);
    assert.equal(questionPreviewDurationSeconds(['multi', 'reverse']), 0.7);
    assert.equal(questionFlightDurationSeconds(2.5, ['standard']), 2.5);
    assert.equal(questionFlightDurationSeconds(2.5, ['bomb']), 2.5);
    assert.equal(questionFlightDurationSeconds(2.5, ['multi']), 3.85);
    assert.equal(questionFlightDurationSeconds(2.5, ['order']), 3.85);
    assert.equal(questionFlightDurationSeconds(2.5, ['reverse']), 3.85);
    assert.equal(questionFlightDurationSeconds(2.5, ['rotate']), 3.85);
    assert.equal(questionFlightDurationSeconds(2.5, ['multi', 'reverse']), 4.15);
    assert.equal(questionFlightDurationSeconds(2.5, ['multi', 'rotate']), 4.15);
    assert.equal(questionFlightDurationSeconds(2.5, ['multi', 'order']), 4.15);
    assert.equal(questionFlightDurationSeconds(2.5, ['bomb', 'multi']), 3.85);
    assert.equal(questionFlightDurationSeconds(2.25, ['standard'], 5), 3);
    assert.equal(questionFlightDurationSeconds(2.25, ['bomb'], 5), 3);
    assert.equal(questionFlightDurationSeconds(2.5, ['standard'], 4, 3), 2.5);
    assert.equal(questionFlightDurationSeconds(2.5, ['standard'], 4, 4), 3.25);
    assert.equal(questionFlightDurationSeconds(2.5, ['multi'], 4, 4), 4.6);
    assert.equal(questionFlightDurationSeconds(2.25, ['standard'], 5, 4), 3.75);
    assert.equal(questionFlightDurationSeconds(2.5, ['standard'], 4, 6), 4);
    assert.equal(maximumAnswerTextLength([
        { id: 'bomb', text: '五字炸弹题', isBomb: true },
        { id: 'short', text: '三字内' },
        { id: 'long', text: '四字答案' },
    ]), 4);
    const shortTargets = [{ id: 'a', text: '三字内' }, { id: 'b', text: '答案' }];
    const longTargets = [{ id: 'a', text: '四字答案' }, { id: 'b', text: '答案' }];
    assert.deepEqual(rulesForReadableTargets(['rotate'], shortTargets), ['rotate']);
    assert.deepEqual(rulesForReadableTargets(['rotate'], longTargets), ['standard']);
    assert.deepEqual(rulesForReadableTargets(['multi', 'rotate'], longTargets), ['multi']);
    assert.deepEqual(rulesForReadableTargets(['order', 'rotate'], longTargets), ['order']);
    assert.deepEqual(rulesForReadableTargets(['bomb', 'rotate'], [{ id: 'bomb', text: '四字炸弹', isBomb: true }, ...shortTargets]), ['bomb', 'rotate']);
});

test('four-character Chinese target answers use a large two-line layout', () => {
    const presentation = targetTextPresentation('清洁工具');
    assert.equal(presentation.displayText, '清洁\n工具');
    assert.equal(presentation.fontSize, 42);
    assert.ok(presentation.minimumHeightScale >= 1.3);
    assert.equal(targetTextPresentation('book').displayText, 'book');
});

test('date and medium-length answers use the available target width', () => {
    const date = targetTextPresentation('9月18日');
    assert.equal(date.fontSize, 38);
    assert.ok(date.minimumWidthScale >= 1.8);
    assert.ok(date.minimumHeightScale >= 0.9);
    assert.equal(targetTextPresentation('9月3日').fontSize, 46);
});

test('relationship answers use a large two-line layout', () => {
    const presentation = targetTextPresentation('爱迪生—电灯');
    assert.equal(presentation.displayText, '爱迪生\n电灯');
    assert.equal(presentation.fontSize, 40);
    assert.ok(presentation.minimumHeightScale >= 1.3);
});

test('all tower opening descriptions fit portrait safe widths', () => {
    for (const visibleWidth of [750, 540, 420]) {
        for (let floor = 1; floor <= 50; floor++) {
            const config = towerFloorConfig(floor);
            const detail = config.challenge.openingHint ?? towerChallengeSummary(config.challenge);
            const presentation = towerOpeningTextPresentation(`第${floor}层 · ${config.title}`, detail, visibleWidth);
            assert.ok(presentation.width <= visibleWidth - 64, `floor ${floor} at ${visibleWidth}`);
            assert.ok(presentation.height <= 300, `floor ${floor} at ${visibleWidth}`);
            assert.ok(presentation.displayText.split('\n').every((line) => Array.from(line).length <= (visibleWidth < 420 ? 10 : visibleWidth < 560 ? 12 : 14)));
            assert.ok(presentation.displaySeconds >= 1.8);
        }
    }
    const floorSeven = towerFloorConfig(7);
    const presentation = towerOpeningTextPresentation('第7层 · 双律初见', floorSeven.challenge.openingHint!, 750);
    assert.equal(presentation.displayText, '第7层 · 双律初见\n同时观察两条规则，\n先判断再出刀');
});




test('fill-in prompts show a spaced parenthesis placeholder', () => {
    const fillTemplates = QUESTION_TEMPLATES.filter((template) => template.id === 'math-missing' || template.id === 'hanzi-fill');
    assert.ok(fillTemplates.length > 0);
    for (const template of fillTemplates) {
        const generator = new DirectiveCompilerFixture(new SeededRng(`placeholder-${template.id}`), GAMEPLAY_CONFIG);
        const question = generator.next({
            phase: 'action', difficultyStage: 1, targetCount: 4, questionTimeMs: 2_600,
            speed: 1, template, rules: ['standard'],
        });
        assert.ok(question.prompt.text.includes('( )'), `${template.id}: ${question.prompt.text}`);
        assert.equal(question.prompt.text.includes('□'), false, template.id);
    }
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
    const base: QuestionInstance = { ...TEST_QUESTION_META,
        id: 'parity', theme: 'math', prompt: { text: '斩偶数' },
        targets: [{ id: '6', text: '6', value: 6 }, { id: '12', text: '12', value: 12 }, { id: '13', text: '13', value: 13 }],
        baseCorrectTargetIds: ['6', '12'], activeRules: ['standard'], timeLimitMs: 3000,
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

test('master slash requires multiple answers completed without lifting the pointer', () => {
    const constraint = { requiredTargetIds: ['a', 'b'], forbiddenTargetIds: [], matchMode: 'all' as const, ordered: false, allowExtraHits: false };
    const continuous = new GestureResolver(constraint);
    continuous.hit('a');
    assert.deepEqual(continuous.hit('b'), { status: 'success', masterSlash: true });

    const broken = new GestureResolver(constraint);
    broken.hit('a');
    assert.equal(broken.end(true).status, 'continue');
    assert.deepEqual(broken.hit('b'), { status: 'success', masterSlash: false });

    const single = new GestureResolver({ ...constraint, requiredTargetIds: ['a'], matchMode: 'any' });
    assert.deepEqual(single.hit('a'), { status: 'success', masterSlash: false });
    const reverseChoice = new GestureResolver({ ...constraint, requiredTargetIds: ['a', 'b'], matchMode: 'any' });
    assert.deepEqual(reverseChoice.hit('a'), { status: 'success', masterSlash: false });
});

test('ordinary single selection generates exactly one correct target', () => {
    const templateIds = new Set(['math-property', 'english-category', 'life-category']);
    const ruleSets = [['standard'], ['bomb'], ['rotate']] as const;
    for (const template of QUESTION_TEMPLATES.filter((candidate) => templateIds.has(candidate.id))) {
        for (const rules of ruleSets) {
            if (!templateSupportsRules(template, rules)) continue;
            for (let seedIndex = 0; seedIndex < 20; seedIndex++) {
                const generator = new DirectiveCompilerFixture(new SeededRng(`single-${template.id}-${rules.join('+')}-${seedIndex}`), GAMEPLAY_CONFIG);
                const question = generator.next({
                    phase: 'climax', difficultyStage: 2, targetCount: 6, questionTimeMs: 3_000,
                    speed: 1, template, rules: [...rules],
                });
                const constraint = evaluateRules(question);
                assert.equal(constraint.requiredTargetIds.length, 1, `${template.id}:${rules.join('+')}`);
                assert.equal(validateQuestion(question, constraint).includes('single-needs-one-target'), false);
            }
        }
    }
});

test('reverse selection may still accept any one of multiple reversed targets', () => {
    const question: QuestionInstance = { ...TEST_QUESTION_META,
        id: 'reverse-single', theme: 'math', prompt: { text: '奇数' },
        targets: [{ id: '3', text: '3', value: 3 }, { id: '4', text: '4', value: 4 }, { id: '6', text: '6', value: 6 }],
        baseCorrectTargetIds: ['3'], activeRules: ['reverse'], timeLimitMs: 3_000,
    };
    const constraint = evaluateRules(question);
    assert.deepEqual(constraint.requiredTargetIds, ['4', '6']);
    assert.equal(constraint.matchMode, 'any');
    assert.equal(validateQuestion(question, constraint).includes('single-needs-one-target'), false);
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


test('session applies a question result only once', () => {
    const entry = { mode: 'brawl60' as const, seed: 's', contentVersion: 'v' };
    const session = new GameSession(entry, GAMEPLAY_CONFIG); session.start(); session.beginQuestion();
    const q: QuestionInstance = { ...TEST_QUESTION_META, id: 'q', theme: 'math', prompt: { text: 'x' }, targets: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }], baseCorrectTargetIds: ['a'], activeRules: ['standard'], timeLimitMs: 3000 };
    assert.ok(session.resolveSuccess(q)); assert.equal(session.resolveSuccess(q), null); assert.equal(session.state.correctCount, 1);
});

test('session counts master slashes and adds their independent score bonus', () => {
    const session = new GameSession({ mode: 'brawl60', seed: 'master-slash', contentVersion: 'v' }, GAMEPLAY_CONFIG);
    const question: QuestionInstance = { ...TEST_QUESTION_META, id: 'multi', theme: 'math', prompt: { text: '斩全部偶数' }, targets: [{ id: 'a', text: '2' }, { id: 'b', text: '4' }], baseCorrectTargetIds: ['a', 'b'], activeRules: ['multi'], timeLimitMs: 3000 };
    session.start(); session.beginQuestion(); session.tick(1000);
    const result = session.resolveSuccess(question, true);
    assert.equal(result?.kind, 'masterSlash');
    assert.equal(result?.masterHit, false);
    assert.equal(result?.scoreDelta, 225);
    assert.equal(session.state.masterSlashCount, 1);
});

test('question preview time does not reduce the measured answer window', () => {
    const entry = { mode: 'brawl60' as const, seed: 'preview-window', contentVersion: 'v' };
    const session = new GameSession(entry, GAMEPLAY_CONFIG); session.start(); session.tick(300); session.beginQuestion(); session.tick(120);
    const q: QuestionInstance = { ...TEST_QUESTION_META, id: 'preview-q', theme: 'math', prompt: { text: '1+1=?' }, targets: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }], baseCorrectTargetIds: ['a'], activeRules: ['standard'], timeLimitMs: 3000 };
    assert.equal(session.resolveSuccess(q)?.reactionMs, 120);
});

test('master hit window starts after target entrance settles', () => {
    const question: QuestionInstance = { ...TEST_QUESTION_META, id: 'master-hit-window', theme: 'math', prompt: { text: '1+1=?' }, targets: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }], baseCorrectTargetIds: ['a'], activeRules: ['standard'], timeLimitMs: 3000 };
    const withinWindow = new GameSession({ mode: 'brawl60', seed: 'master-hit-within', contentVersion: 'v' }, GAMEPLAY_CONFIG);
    withinWindow.start(); withinWindow.beginQuestion(); withinWindow.tick(990);
    assert.equal(withinWindow.resolveSuccess(question)?.masterHit, true);

    const outsideWindow = new GameSession({ mode: 'brawl60', seed: 'master-hit-outside', contentVersion: 'v' }, GAMEPLAY_CONFIG);
    outsideWindow.start(); outsideWindow.beginQuestion(); outsideWindow.tick(1000);
    assert.equal(outsideWindow.resolveSuccess(question)?.masterHit, false);
});

test('endless brawl only ends on life depletion and heals every third consecutive correct answer', () => {
    const question: QuestionInstance = { ...TEST_QUESTION_META, id: 'endless-q', theme: 'math', prompt: { text: '1+1=?' }, targets: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }], baseCorrectTargetIds: ['a'], activeRules: ['standard'], timeLimitMs: 3_000 };
    const session = new GameSession({ mode: 'brawl60', seed: 'endless', contentVersion: 'v' }, GAMEPLAY_CONFIG);
    session.start();
    session.tick(10 * 60_000);
    assert.equal(session.state.phase, 'playing');
    assert.equal(session.state.remainingMs, 0);
    assert.equal(session.state.elapsedMs, 10 * 60_000);

    for (let index = 0; index < 2; index++) {
        session.beginQuestion();
        assert.equal(session.resolveSuccess(question)?.lifeDelta, 0);
        session.continueAfterFeedback();
    }
    assert.equal(session.state.combo, 2);

    session.beginQuestion();
    session.resolveFailure('wrong');
    session.continueAfterFeedback();
    assert.equal(session.state.life, 2);
    assert.equal(session.state.combo, 0);

    let thirdLifeDelta = 0;
    for (let index = 1; index <= 3; index++) {
        session.beginQuestion();
        thirdLifeDelta = session.resolveSuccess(question)?.lifeDelta ?? 0;
        session.continueAfterFeedback();
    }
    assert.equal(thirdLifeDelta, 1);
    assert.equal(session.state.combo, 3);
    assert.equal(session.state.life, 3);

    for (let index = 4; index <= 6; index++) {
        session.beginQuestion();
        const result = session.resolveSuccess(question);
        if (index === 6) assert.equal(result?.lifeDelta, 0);
        session.continueAfterFeedback();
    }
    assert.equal(session.state.life, 3);

    const timed = new GameSession({ mode: 'daily', seed: 'timed', contentVersion: 'v' }, GAMEPLAY_CONFIG);
    timed.start();
    timed.beginQuestion(); timed.resolveFailure('wrong'); timed.continueAfterFeedback();
    for (let index = 0; index < 5; index++) {
        timed.beginQuestion(); timed.resolveSuccess(question); timed.continueAfterFeedback();
    }
    assert.equal(timed.state.life, 2);
    timed.tick(60_000);
    assert.equal(timed.state.phase, 'finished');
});

test('result finalization atomically records growth, level-up and new best score', () => {
    const player: PlayerProgress = { level: 1, xp: 495, bestScore: 500 };
    const run: RunResult = {
        entry: { mode: 'brawl60', seed: 'result', contentVersion: CONTENT_VERSION },
        score: 620, maxCombo: 8, correctCount: 2, errorCount: 1, accuracy: 2 / 3, bestReactionMs: 384,
    };
    const committed = finalizeResult(run, player);
    assert.deepEqual(committed.player, { level: 2, xp: 505, bestScore: 620 });
    assert.equal(committed.result.previousBestScore, 500);
    assert.equal(committed.result.isNewRecord, true);
    assert.deepEqual(committed.result.growth, {
        xpGained: 10,
        levelBefore: 1,
        levelAfter: 2,
        levelProgressBefore: 495,
        levelProgressAfter: 5,
        levelTarget: 500,
    });
    const presentation = createResultPresentation(committed.result);
    assert.equal(presentation.modeLabel, '无尽乱斗');
    assert.equal(presentation.headline, '极限新纪录！');
    assert.equal(presentation.comparison, '刷新纪录 +120');
    assert.equal(presentation.fastestReaction, '384ms');
    assert.equal(presentation.sharePrimary, true);
});

test('result presentation covers friend win, tie and loss without a server', () => {
    const player: PlayerProgress = { level: 3, xp: 1_100, bestScore: 900 };
    const friendRun = (score: number): RunResult => ({
        entry: { mode: 'friendChallenge', seed: 'friend', contentVersion: CONTENT_VERSION, targetScore: 700 },
        score, maxCombo: 4, correctCount: 10, errorCount: 2, accuracy: 10 / 12,
    });
    const won = finalizeResult(friendRun(750), player).result;
    const tied = finalizeResult(friendRun(700), player).result;
    const lost = finalizeResult(friendRun(640), player).result;
    assert.deepEqual(won.challenge, { targetScore: 700, scoreDelta: 50, outcome: 'won' });
    assert.equal(createResultPresentation(won).comparison, '超过好友 50 分');
    assert.equal(createResultPresentation(won).sharePrimary, true);
    assert.deepEqual(tied.challenge, { targetScore: 700, scoreDelta: 0, outcome: 'tied' });
    assert.equal(createResultPresentation(tied).headline, '势均力敌！');
    assert.equal(createResultPresentation(tied).sharePrimary, false);
    assert.deepEqual(lost.challenge, { targetScore: 700, scoreDelta: -60, outcome: 'lost' });
    assert.equal(createResultPresentation(lost).comparison, '距离好友 60 分');
    assert.equal(createResultPresentation(lost).replayLabel, '再战同题');
});

test('result presentation keeps replay and share actions contextual across modes', () => {
    const player: PlayerProgress = { level: 1, xp: 0, bestScore: 800 };
    const daily = finalizeResult({
        entry: { mode: 'daily', seed: 'daily', contentVersion: CONTENT_VERSION },
        score: 500, maxCombo: 3, correctCount: 0, errorCount: 0, accuracy: 0,
    }, player).result;
    const presentation = createResultPresentation(daily);
    assert.equal(presentation.modeLabel, '今日挑战');
    assert.equal(presentation.headline, '挑战未达成');
    assert.equal(presentation.fastestReaction, '—');
    assert.equal(presentation.replayLabel, '再战今日');
    assert.equal(presentation.shareLabel, '挑战好友');
    assert.equal(presentation.sharePrimary, false);
});

test('daily completion records attempts and compares against the local daily best', () => {
    const challenge = createDailyChallenge(new Date(2026, 7, 20, 12, 0, 0), CONTENT_VERSION);
    const run = (score: number): RunResult => ({
        entry: challenge.entry, score, maxCombo: 6, correctCount: 8, errorCount: 1, accuracy: 8 / 9,
    });
    const first = recordDailyRun(undefined, run(620));
    assert.ok(first);
    if (!first) return;
    assert.deepEqual(first.record, {
        dateKey: '2026-08-20', recipeId: challenge.recipe.id, attempts: 1, bestScore: 620, lastScore: 620, completed: true,
        targetScore: challenge.targetScore, targetAchieved: false, tutorialBaseline: [],
    });
    assert.deepEqual(first.result, {
        dateKey: '2026-08-20', recipeId: challenge.recipe.id, attempts: 1, previousBestScore: 0, bestScore: 620, isNewBest: true,
        targetScore: challenge.targetScore, targetAchieved: false, firstAchievement: false,
    });
    const second = recordDailyRun(first.record, run(580));
    assert.ok(second);
    if (!second) return;
    assert.equal(second.record.attempts, 2);
    assert.equal(second.record.bestScore, 620);
    assert.equal(second.result.isNewBest, false);
    const result = { ...finalizeResult(run(580), { level: 2, xp: 500, bestScore: 900 }).result, daily: second.result };
    const presentation = createResultPresentation(result);
    assert.equal(presentation.modeLabel, `今日挑战 · ${challenge.recipe.title}`);
    assert.equal(presentation.headline, '挑战未达成');
    assert.equal(presentation.comparison, `距离今日目标 ${challenge.targetScore - 580} 分`);
    assert.equal(presentation.replayLabel, '再战今日');
    const home = createDailyHomePresentation(challenge, second.record);
    assert.equal(home.status, `最佳 620 · 还差 ${challenge.targetScore - 620}`);
    assert.equal(home.goal, `目标 ${challenge.targetScore} 分`);
    assert.equal(home.achieved, false);

    const achieved = recordDailyRun(second.record, run(challenge.targetScore + 100));
    assert.ok(achieved);
    if (!achieved) return;
    assert.equal(achieved.result.targetAchieved, true);
    assert.equal(achieved.result.firstAchievement, true);
    assert.equal(achieved.record.targetAchieved, true);
    assert.equal(typeof achieved.record.achievedAt, 'number');
    const achievedResult = { ...finalizeResult(run(challenge.targetScore + 100), { level: 2, xp: 500, bestScore: 900 }).result, daily: achieved.result };
    const achievedPresentation = createResultPresentation(achievedResult);
    assert.equal(achievedPresentation.headline, '今日目标达成！');
    assert.equal(achievedPresentation.comparison, `目标 ${challenge.targetScore} 分 · 已达成`);
    assert.equal(createDailyHomePresentation(challenge, achieved.record).status, `已达标 · 最佳 ${challenge.targetScore + 100}`);
});

test('daily challenge starts without tutorial state and reuses the same-day record', () => {
    const challenge = createDailyChallenge(new Date(2026, 7, 20, 9, 0, 0), CONTENT_VERSION);
    const first = beginDailyRun(undefined, challenge.entry, { reverse: true, rotate: true, bomb: true });
    assert.ok(first);
    if (!first) return;
    assert.deepEqual(first.tutorialBaseline, []);
    const replay = beginDailyRun(first, challenge.entry, { reverse: true, rotate: true, bomb: true, multi: true, order: true });
    assert.equal(replay, first);
    assert.deepEqual(replay?.tutorialBaseline, []);
    const tomorrow = createDailyChallenge(new Date(2026, 7, 21, 9, 0, 0), CONTENT_VERSION);
    const nextDay = beginDailyRun(first, tomorrow.entry, { reverse: true, rotate: true, bomb: true, multi: true });
    assert.deepEqual(nextDay?.tutorialBaseline, []);
});

test('unified template catalog contains one stable entry per cognitive template', () => {
    assert.equal(QUESTION_TEMPLATES.length, 66);
    assert.equal(new Set(QUESTION_TEMPLATES.map((template) => template.id)).size, QUESTION_TEMPLATES.length);
    assert.ok(QUESTION_TEMPLATES.every((template) => template.enabled && template.difficultyBands.length === 5));
});

test('question-bank registry reports audited base records instead of generated combinations', () => {
    const stats = getQuestionBankStats();
    assert.equal(stats.baseRecordCount, 1202);
    assert.equal(stats.packCount, 39);
    assert.deepEqual(stats.byTheme, {
        math: 0,
        vision: 0,
        hanzi: 340,
        english: 152,
        life: 92,
        geography: 92,
        knowledge: 436,
        history: 90,
    });
    assert.equal(new Set(QUESTION_BANK_PACKS.map((pack) => pack.id)).size, QUESTION_BANK_PACKS.length);
});

test('new relationship and common-knowledge packs keep short answers and clean choices', () => {
    assert.equal(HANZI_ANTONYM_FACTS.length, 100);
    assert.equal(HANZI_SYNONYM_FACTS.length, 100);
    for (const fact of [...HANZI_ANTONYM_FACTS, ...HANZI_SYNONYM_FACTS]) {
        assert.ok(Array.from(fact.left).length <= 4, fact.left);
        assert.ok(Array.from(fact.right).length <= 4, fact.right);
        assert.ok(!fact.leftDistractors.includes(fact.left));
        assert.ok(!fact.rightDistractors.includes(fact.right));
    }

    const expansions = [
        KNOWLEDGE_SCIENCE_EXPANSION,
        KNOWLEDGE_NATURE_EXPANSION,
        KNOWLEDGE_CULTURE_EXPANSION,
        KNOWLEDGE_CIVIC_FACTS,
    ];
    for (const pool of expansions) {
        assert.equal(pool.length, 56);
        for (const fact of pool) {
            assert.ok(Array.from(fact.prompt).length <= 12, fact.prompt);
            assert.ok(Array.from(fact.answer).length <= 4, `${fact.prompt}: ${fact.answer}`);
            assert.ok(!fact.wrong.includes(fact.answer));
            assert.equal(new Set(fact.wrong).size, fact.wrong.length);
        }
    }
});

test('warmup catalog includes distinct equation and symbol-matching questions', () => {
    for (const kind of ['math-equation', 'vision-match'] as const) {
        const templates = QUESTION_TEMPLATES.filter((template) => template.id === kind);
        assert.equal(templates.length, 1);
        for (const template of templates) {
            const generator = new DirectiveCompilerFixture(new SeededRng(`warmup-${template.id}`), GAMEPLAY_CONFIG);
            const question = generator.next({
                phase: 'warmup', difficultyStage: 0, targetCount: 3, questionTimeMs: 3_000,
                speed: 0.72, template, rules: ['standard'],
            });
            assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
            assert.equal(question.baseCorrectTargetIds.length, 1);
            assert.equal(question.targets.length, 3);
        }
    }
});

test('reviewed fact pools contain unique answers and safe idiom distractors', () => {
    for (const idiom of IDIOMS) {
        assert.equal([...idiom.text].length, 4);
        const answer = [...idiom.text][idiom.missingIndex];
        assert.equal(new Set(idiom.wrong).size, idiom.wrong.length);
        assert.ok(!idiom.wrong.includes(answer));
    }
    assert.equal(new Set(ENGLISH_WORDS.map((word) => word.en)).size, ENGLISH_WORDS.length);
    assert.ok(ENGLISH_WORDS.length >= 96);
    assert.ok(ENGLISH_ANTONYMS.length >= 40);
    assert.ok(IDIOMS.length >= 100);
    assert.equal(new Set(LIFE_CATEGORY_FACTS.map((fact) => fact.item)).size, LIFE_CATEGORY_FACTS.length);
    assert.equal(new Set(GEOGRAPHY_FACTS.map((fact) => fact.country)).size, GEOGRAPHY_FACTS.length);
    assert.equal(new Set(GEOGRAPHY_FACTS.map((fact) => fact.capital)).size, GEOGRAPHY_FACTS.length);
    assert.ok(GEOGRAPHY_FACTS.length >= 60);
    for (const fact of GEOGRAPHY_FACTS) {
        assert.ok(Array.from(fact.country).length <= 4, fact.country);
        assert.ok(Array.from(fact.capital).length <= 4, fact.capital);
    }
    const triviaPools = [
        KNOWLEDGE_SCIENCE_FACTS, KNOWLEDGE_NATURE_FACTS, KNOWLEDGE_CULTURE_FACTS,
        HISTORY_MODERN_OPENING_FACTS, HISTORY_MODERN_AWAKENING_FACTS, HISTORY_MODERN_RESISTANCE_FACTS,
        HISTORY_ANCIENT_FACTS, HISTORY_MYTH_FACTS,
    ];
    for (const pool of triviaPools) {
        assert.equal(new Set(pool.map((fact) => fact.prompt)).size, pool.length);
        for (const fact of pool) {
            assert.equal(new Set(fact.wrong).size, fact.wrong.length);
            assert.ok(!fact.wrong.includes(fact.answer));
            assert.ok(Array.from(fact.answer).length <= 4, `${fact.prompt}: ${fact.answer}`);
        }
    }
    for (const pool of [KNOWLEDGE_SCIENCE_FACTS, KNOWLEDGE_NATURE_FACTS, KNOWLEDGE_CULTURE_FACTS]) {
        assert.ok(pool.length >= 60);
        for (const fact of pool) {
            assert.ok(Array.from(fact.prompt).length <= 12, fact.prompt);
            assert.ok(Array.from(fact.answer).length <= 4, `${fact.prompt}: ${fact.answer}`);
        }
    }
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
    assert.deepEqual([0, 10_000, 25_000, 45_000].map((elapsed) => difficultyAt(elapsed).targetCount), [3, 4, 5, 5]);
    assert.deepEqual([0, 10_000, 25_000, 45_000].map((elapsed) => difficultyAt(elapsed).phase), ['warmup', 'action', 'twist', 'climax']);
    assert.ok(phaseAt(0).questionTimeMs > phaseAt(10_000).questionTimeMs);
    assert.ok(phaseAt(10_000).questionTimeMs > phaseAt(25_000).questionTimeMs);
    assert.ok(phaseAt(25_000).questionTimeMs > phaseAt(45_000).questionTimeMs);
    assert.ok(phaseAt(0).speed < phaseAt(45_000).speed);
});

test('target density respects content readability and compound-rule pressure', () => {
    const byId = (id: string) => QUESTION_TEMPLATES.find((template) => template.id === id)!;
    assert.equal(targetCountForTemplate(6, byId('math-add'), ['bomb', 'reverse']), 4);
    assert.equal(targetCountForTemplate(5, byId('math-property'), ['bomb', 'multi']), 5);
    assert.equal(targetCountForTemplate(6, byId('math-property'), ['multi', 'reverse']), 4);
    assert.equal(targetCountForTemplate(6, byId('vision-odd'), ['standard']), 6);
    assert.equal(targetCountForTemplate(6, byId('vision-odd'), ['bomb', 'reverse']), 5);
    assert.equal(targetCountForTemplate(6, byId('hanzi-order'), ['bomb', 'order']), 5);

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

test('friend challenge creator result is shareable without comparing against a target', () => {
    const config: FriendChallengeConfig = { themeIds: ['math', 'vision'], enabledRules: ['reverse'], durationMs: 90_000 };
    const commit = finalizeResult({
        entry: { mode: 'friendChallenge', seed: 'creator', contentVersion: CONTENT_VERSION, challengeConfig: config, challengeRole: 'creator' },
        score: 980, maxCombo: 8, correctCount: 9, errorCount: 2, accuracy: 9 / 11,
    }, { level: 1, xp: 0, bestScore: 800 });
    const result = commit.result;
    assert.equal(commit.player.bestScore, 800);
    assert.equal(result.isNewRecord, false);
    assert.equal(result.challenge, undefined);
    const presentation = createResultPresentation(result);
    assert.equal(presentation.modeLabel, '好友挑战 · 90 秒');
    assert.equal(presentation.headline, '挑战成绩已生成！');
    assert.equal(presentation.replayLabel, '同配置再来一局');
    assert.equal(presentation.shareLabel, '分享挑战');
    assert.equal(presentation.sharePrimary, true);
});

test('target skins use their source canvas instead of auto-trim bounds for visual sizing', () => {
    const targetExtent = 184.8;
    const sourceCanvas = 384;
    const scale = targetSkinPixelScale(sourceCanvas, sourceCanvas, targetExtent);

    assert.equal(scale * sourceCanvas, targetExtent);
    assert.equal(targetSkinPixelScale(0, 0, targetExtent), targetExtent);
});

test('target skin optical scales keep visible subject areas within a small error', () => {
    assert.equal(targetSkinVisualScale('blue_circle'), TARGET_SKIN_VISUAL_SCALE.circle);
    assert.equal(targetSkinVisualScale('red_hexagon'), TARGET_SKIN_VISUAL_SCALE.hexagon);
    assert.equal(targetSkinVisualScale('yellow_square'), TARGET_SKIN_VISUAL_SCALE.square);
    assert.equal(targetSkinVisualScale(COLOR_QUESTION_TARGET_SKIN), TARGET_SKIN_VISUAL_SCALE.white_square);
    assert.equal(targetSkinVisualScale('unknown_skin'), 1);
});

test('target content layouts follow the three supported artwork shapes', () => {
    const circle = targetContentLayout('blue_circle', 'roundedSquare');
    const hexagon = targetContentLayout('green_hexagon', 'roundedSquare');
    const square = targetContentLayout('red_square', 'circle');

    assert.ok(square.width > hexagon.width);
    assert.ok(circle.height > hexagon.height);
    assert.deepEqual(targetContentLayout(undefined, 'circle'), circle);
    assert.equal(targetShapeForSkin('purple_circle'), 'circle');
    assert.equal(targetShapeForSkin('cyan_hexagon'), 'hexagon');
    assert.equal(targetShapeForSkin(COLOR_QUESTION_TARGET_SKIN), 'roundedSquare');
});

test('active gameplay target skins contain only colored squares, circles, and hexagons', () => {
    assert.deepEqual(ACTIVE_TARGET_SKINS, [
        'blue_circle',
        'blue_hexagon',
        'cyan_circle',
        'cyan_hexagon',
        'cyan_square',
        'green_circle',
        'green_hexagon',
        'green_square',
        'orange_hexagon',
        'orange_square',
        'purple_circle',
        'purple_square',
        'red_circle',
        'red_hexagon',
        'red_square',
        'yellow_hexagon',
        'yellow_square',
    ]);
    assert.ok(ACTIVE_TARGET_SKINS.every((skin) => /_(square|circle|hexagon)$/.test(skin)));
    assert.ok(!ACTIVE_TARGET_SKINS.includes(COLOR_QUESTION_TARGET_SKIN as never));
    assert.deepEqual(ALL_TARGET_SKINS, [...ACTIVE_TARGET_SKINS, COLOR_QUESTION_TARGET_SKIN]);
    assert.equal(targetSkinForAnswer('红', ACTIVE_TARGET_SKINS[0]), COLOR_QUESTION_TARGET_SKIN);
    assert.equal(targetSkinForAnswer(undefined, ACTIVE_TARGET_SKINS[0]), ACTIVE_TARGET_SKINS[0]);
});

test('one question uses every artwork color at most once while shapes may repeat', () => {
    const randomized = [
        'red_circle',
        'blue_circle',
        'red_square',
        'cyan_circle',
        'blue_hexagon',
        'green_circle',
    ] as const;
    const selected = uniqueColorTargetSkins(randomized);

    assert.deepEqual(selected, ['red_circle', 'blue_circle', 'cyan_circle', 'green_circle']);
    assert.equal(selected.filter((skin) => skin.endsWith('_circle')).length, 4);
    assert.equal(new Set(selected.map((skin) => skin.slice(0, skin.lastIndexOf('_')))).size, selected.length);
});

test('portrait target motion preserves lanes and separates every phase throughout flight', () => {
    const screens = [
        { width: 750, height: 1624 },
        { width: 720, height: 1280 },
        { width: 828, height: 1792 },
    ];
    const phases = [
        { duration: 3, speed: 0.72 },
        { duration: 2.6, speed: 0.95 },
        { duration: 2.25, speed: 1.15 },
        { duration: 1.85, speed: 1.38 },
    ];
    for (const screen of screens) {
        for (const phase of phases) {
            for (let count = 2; count <= 6; count++) {
                const layout = calculatePortraitTargetLayout(count, screen.width, screen.height);
                for (let variation = 0; variation < 12; variation++) {
                    const motionPhases = Array.from(
                        { length: count },
                        (_, index) => (index * 1.137 + variation * 0.733) % (Math.PI * 2),
                    );
                    const plans = createPortraitTargetMotionPlans(layout, motionPhases, {
                        visibleWidth: screen.width,
                        visibleHeight: screen.height,
                        duration: phase.duration,
                        speed: phase.speed,
                        topInset: 292,
                        visualRadius: 132,
                    });
                    for (let sample = 0; sample <= 180; sample++) {
                        const elapsed = phase.duration * sample / 180;
                        const base = plans.map((plan) => evaluatePortraitTargetMotion(plan, elapsed));
                        const separated = resolveSoftTargetSeparation(base);
                        for (let a = 0; a < separated.length; a++) {
                            assert.ok(
                                Math.hypot(separated[a].x - base[a].x, separated[a].y - base[a].y)
                                    <= PORTRAIT_TARGET_MAX_SEPARATION_OFFSET + 0.001,
                            );
                            for (let b = a + 1; b < separated.length; b++) {
                                assert.ok(
                                    Math.hypot(separated[a].x - separated[b].x, separated[a].y - separated[b].y)
                                        >= PORTRAIT_TARGET_MIN_SEPARATION - 0.05,
                                    `${screen.width}x${screen.height}, count ${count}, variation ${variation}, sample ${sample}, pair ${a}/${b}`,
                                );
                            }
                        }
                    }
                }
            }
        }
    }
});

test('soft target separation is deterministic and capped for an invalid overlapping input', () => {
    const input = [{ x: 10, y: 20 }, { x: 10, y: 20 }];
    const first = resolveSoftTargetSeparation(input);
    const second = resolveSoftTargetSeparation(input);
    assert.deepEqual(first, second);
    first.forEach((point, index) => {
        assert.ok(Math.hypot(point.x - input[index].x, point.y - input[index].y)
            <= PORTRAIT_TARGET_MAX_SEPARATION_OFFSET + 0.001);
    });
});

test('rotation rule spins targets deterministically after their entrance settles', () => {
    const motion = {
        startX: -400, targetX: 0, startY: 100, groundY: -500, ceilingY: 500,
        duration: 3, velocityY: 200, gravity: -300, entranceAngle: 10, phase: 1, speed: 1,
    };
    assert.equal(evaluatePortraitTargetRotation(motion, 0, true), 10);
    assert.equal(evaluatePortraitTargetRotation(motion, 1, false), 0);
    assert.equal(
        evaluatePortraitTargetRotation(motion, 1, true),
        PORTRAIT_TARGET_ROTATION_DEGREES_PER_SECOND,
    );
    assert.equal(
        evaluatePortraitTargetRotation({ ...motion, phase: -1 }, 1, true),
        -PORTRAIT_TARGET_ROTATION_DEGREES_PER_SECOND,
    );
});



test('brawl topic and question-template order varies across fresh session seeds', () => {
    const signatures = new Set<string>();
    for (let seedIndex = 0; seedIndex < 32; seedIndex++) {
        const director = new BrawlRequestFixture(new SeededRng(`session-order-${seedIndex}`));
        const signature = Array.from({ length: 12 }, (_, questionIndex) => {
            const elapsed = questionIndex < 3 ? 5_000 : questionIndex < 8 ? 15_000 : 30_000;
            const directive = director.next(elapsed);
            return `${directive.template.id}:${directive.rules.join('+')}`;
        }).join(',');
        signatures.add(signature);
    }
    assert.ok(signatures.size > 24);
});

test('run seed factory refreshes every attempt while keeping the daily recipe stable', () => {
    const fixedDate = new Date(2026, 7, 20, 12, 0, 0);
    const factory = new RunSeedFactory(() => fixedDate, () => 123_456_789);
    const first = factory.create('brawl60', CONTENT_VERSION);
    const second = factory.create('brawl60', CONTENT_VERSION);
    assert.notEqual(first.seed, second.seed);
    assert.match(first.seed, /^brawl60:/);

    const dailyA = factory.create('daily', CONTENT_VERSION);
    const dailyB = factory.create('daily', CONTENT_VERSION);
    assert.notEqual(dailyA.seed, dailyB.seed);
    assert.equal(dailyA.recipeId, dailyB.recipeId);
    assert.equal(dailyA.dailyTargetScore, dailyB.dailyTargetScore);
    assert.equal(dailyA.dailyDate, '2026-08-20');
    assert.ok(dailyRecipeById(dailyA.recipeId));
    assert.equal(dailyA.dailyTargetScore, dailyRecipeById(dailyA.recipeId)?.targetScore);
    assert.match(dailyA.seed, /^daily:[^:]+:2026-08-20:[a-z-]+:attempt:[a-z0-9]+:[a-z0-9]+:[a-z0-9]+$/);
});

test('friend challenge replay preserves the exact shared seed and configuration', () => {
    const factory = new RunSeedFactory(() => new Date(2026, 7, 20, 12, 0, 0), () => 123_456_789);
    const entry = factory.createFriendChallenge({
        themeIds: ['math', 'history'], enabledRules: ['standard', 'reverse'], durationMs: 90_000,
    }, CONTENT_VERSION);
    const replay = factory.createReplay(entry, CONTENT_VERSION);
    const brawl = factory.create('brawl60', CONTENT_VERSION);

    assert.deepEqual(replay, entry);
    assert.notEqual(replay, entry);
    assert.notEqual(factory.createReplay(brawl, CONTENT_VERSION).seed, brawl.seed);
});

test('local daily challenge deterministically selects one theme and rolls over at local midnight', () => {
    const challenges = Array.from({ length: 32 }, (_, offset) => createDailyChallenge(new Date(2026, 7, 17 + offset, 12, 0, 0), CONTENT_VERSION));
    assert.ok(new Set(challenges.map((challenge) => challenge.recipe.theme)).size >= 4);
    assert.deepEqual(createDailyChallenge(new Date(2026, 7, 17, 18), CONTENT_VERSION), createDailyChallenge(new Date(2026, 7, 17, 8), CONTENT_VERSION));
    for (const challenge of challenges) {
        assert.equal(challenge.entry.dailyTheme, challenge.recipe.theme);
        assert.equal(challenge.dateKey, localDateKey(new Date(challenge.endTime - 1)));
        const midnight = new Date(challenge.endTime);
        assert.deepEqual([midnight.getHours(), midnight.getMinutes(), midnight.getSeconds(), midnight.getMilliseconds()], [0, 0, 0, 0]);
    }
});

test('daily runs stay on their selected theme and remain deterministic for a seed', () => {
    const signatures = new Set<string>();
    for (let day = 0; day < 24; day++) {
        const challenge = createDailyChallenge(new Date(2026, 7, 17 + day, 12, 0, 0), CONTENT_VERSION);
        const build = (): string => {
            const director = new ModeQuestionDirector(new SeededRng('daily-recipe-director'), challenge.entry);
            const generator = new QuestionCompiler(new SeededRng('daily-recipe-gameplay'), GAMEPLAY_CONFIG, challenge.entry);
            return Array.from({ length: 80 }, (_, index) => {
                const elapsed = [5_000, 15_000, 30_000, 50_000][index % 4];
                const question = generator.next(director.next(elapsed), CONTENT_VERSION);
                assert.equal(question.theme, challenge.recipe.theme);
                assert.equal(validateQuestion(question, evaluateRules(question)).length, 0);
                return `${question.templateId}:${question.activeRules.join('+')}`;
            }).join(',');
        };
        const first = build(), second = build();
        assert.equal(first, second);
        signatures.add(first);
    }
    assert.ok(signatures.size >= 4);
});


test('fact bag keeps reviewed facts from non-exhausted pools more than 20 questions apart', () => {
    const { director, generator } = pipeline('fact-cooldowns');
    const lastSeen = new Map<string, number>();
    for (let i = 0; i < 800; i++) {
        const elapsed = i % 3 === 0 ? 15_000 : i % 3 === 1 ? 30_000 : 50_000;
        const question = generator.next(director.next(elapsed));
        for (const factId of question.factIds ?? []) {
            const previous = lastSeen.get(factId);
            if (previous !== undefined && !factId.startsWith('life:')) {
                assert.ok(i - previous > 20, `${factId} repeated after ${i - previous} questions`);
            }
            lastSeen.set(factId, i);
        }
    }
});


test('question appearance keeps semantic questions and answers on rolling cooldowns', () => {
    const template = QUESTION_TEMPLATES.find((candidate) => candidate.id === 'knowledge-science')!;
    const generator = new DirectiveCompilerFixture(new SeededRng('semantic-question-cooldown'), GAMEPLAY_CONFIG);
    const seen = new Set<string>();
    for (let index = 0; index < 40; index++) {
        const question = generator.next({
            phase: 'action', difficultyStage: 1, targetCount: 4, questionTimeMs: 2_600,
            speed: 1, template, rules: ['standard'],
        });
        const textById = new Map(question.targets.map((target) => [target.id, target.text]));
        const answer = question.baseCorrectTargetIds.map((id) => textById.get(id)).sort().join('→');
        const signature = `${question.prompt.text}|${answer}`;
        assert.ok(!seen.has(signature), `semantic question repeated too soon: ${signature}`);
        seen.add(signature);
    }
});

test('tower exposes the fixed 60-second 1-50 progression and unlock schedule', () => {
    for (let floor = 1; floor <= 50; floor++) {
        const config = towerFloorConfig(floor);
        assert.equal(config.floor, floor);
        assert.equal(config.durationMs, 60_000);
        assert.ok(config.title.length > 0);
        assert.ok(config.difficulty.targetCount >= 3 && config.difficulty.targetCount <= 5);
        assert.deepEqual(validateTowerChallenge(config.challenge), []);
    }
    assert.deepEqual(unlockedRulesForTower(0), ['standard', 'bomb']);
    assert.deepEqual(unlockedRulesForTower(1), ['standard', 'bomb']);
    assert.deepEqual(unlockedRulesForTower(2), ['standard', 'bomb', 'multi']);
    assert.deepEqual(unlockedRulesForTower(3), ['standard', 'bomb', 'multi', 'order']);
    assert.deepEqual(unlockedRulesForTower(4), ['standard', 'bomb', 'multi', 'order', 'reverse']);
    assert.deepEqual(unlockedRulesForTower(5), ['standard', 'bomb', 'multi', 'order', 'reverse', 'rotate']);
    assert.deepEqual(unlockedRulesForTower(13), ['standard', 'bomb', 'multi', 'order', 'reverse', 'rotate']);
    assert.deepEqual(unlockedRulesForTower(14), ['standard', 'bomb', 'multi', 'order', 'reverse', 'rotate']);
    assert.equal(towerFloorConfig(14).unlockedRule, undefined);
    assert.equal(towerFloorConfig(14).challenge.encounter.type, 'pool');
    if (towerFloorConfig(14).challenge.encounter.type === 'pool') assert.deepEqual(towerFloorConfig(14).challenge.encounter.pool.requiredCapabilities, ['stroop']);
    assert.equal(towerFloorConfig(7).unlocksCompoundRules, true);
    assert.equal(towerFloorConfig(15).unlocksCompoundRules, false);
    assert.equal(towerFloorConfig(8).title, '一笔制敌');
    assert.equal(towerFloorConfig(50).title, '塔巅试炼');
    for (let floor = 1; floor <= 8; floor++) {
        const correctObjective = towerFloorConfig(floor).challenge.objectives.find((objective) => objective.type === 'correct');
        assert.ok(correctObjective && correctObjective.target === 8, `floor ${floor}`);
    }

    assert.deepEqual(new TowerDirector(new SeededRng('floor-2-unlock'), 2).next(0).rules, ['multi']);
    assert.deepEqual(new TowerDirector(new SeededRng('floor-3-unlock'), 3).next(0).rules, ['order']);
    assert.deepEqual(new TowerDirector(new SeededRng('floor-4-unlock'), 4).next(0).rules, ['reverse']);
    assert.deepEqual(new TowerDirector(new SeededRng('floor-5-unlock'), 5).next(0).rules, ['rotate']);
    assert.deepEqual(new TowerDirector(new SeededRng('floor-7-unlock'), 7).next(0).rules, ['multi', 'reverse']);
});

test('tower challenge quota retries the same lane after failure and clears only completed supply', () => {
    const config = towerFloorConfig(16).challenge;
    const runtime = new TowerChallengeRuntime(config, new SeededRng('tower-quota-runtime'));
    const session = new GameSession({ mode: 'tower', seed: 'quota', contentVersion: CONTENT_VERSION, towerFloor: 16 }, GAMEPLAY_CONFIG);
    session.start();
    const failedRequest = runtime.nextRequest();
    session.state.errorCount += 1; session.state.life -= 1;
    const afterFailure = runtime.resolve(failedRequest.requestId, false, session.state, 'wrong');
    assert.equal(afterFailure.status, 'active');
    assert.equal(runtime.nextRequest().laneId, failedRequest.laneId);

    for (let index = 0; index < 10; index++) {
        const request = runtime.nextRequest();
        session.state.correctCount += 1; session.state.combo += 1; session.state.maxCombo = session.state.combo;
        runtime.resolve(request.requestId, true, session.state);
    }
    assert.equal(runtime.snapshot(session.state).status, 'cleared');
    assert.equal(Object.values(runtime.snapshot(session.state).laneSuccesses).reduce((sum, count) => sum + count, 0), 10);
});



test('tower has five non-healing lives while other modes keep three', () => {
    const tower = new GameSession({ mode: 'tower', seed: 'tower-life', contentVersion: CONTENT_VERSION, towerFloor: 8 }, GAMEPLAY_CONFIG);
    assert.equal(tower.state.life, 5);
    assert.equal(tower.state.maxLife, 5);
    for (const mode of ['brawl60', 'daily', 'friendChallenge'] as const) {
        const session = new GameSession({ mode, seed: `life-${mode}`, contentVersion: CONTENT_VERSION }, GAMEPLAY_CONFIG);
        assert.equal(session.state.life, 3);
        assert.equal(session.state.maxLife, 3);
    }
    const question: QuestionInstance = { ...TEST_QUESTION_META, id: 'tower-life-q', theme: 'math', prompt: { text: '1+1=?' }, targets: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }], baseCorrectTargetIds: ['a'], activeRules: ['standard'], timeLimitMs: 3_000 };
    tower.start();
    tower.beginQuestion(); tower.resolveFailure('wrong'); tower.continueAfterFeedback();
    for (let index = 0; index < 3; index++) { tower.beginQuestion(); tower.resolveSuccess(question); tower.continueAfterFeedback(); }
    assert.equal(tower.state.life, 4);
});

test('tower max-error constraints fail after the allowed count, before five-life depletion', () => {
    const runtime = new TowerChallengeRuntime(towerFloorConfig(10).challenge, new SeededRng('max-errors'));
    const session = new GameSession({ mode: 'tower', seed: 'max-errors', contentVersion: CONTENT_VERSION, towerFloor: 10 }, GAMEPLAY_CONFIG);
    session.start();
    for (let error = 1; error <= 4; error++) {
        const request = runtime.nextRequest();
        session.state.errorCount += 1; session.state.life -= 1;
        const snapshot = runtime.resolve(request.requestId, false, session.state, 'wrong');
        assert.equal(snapshot.status, error <= 3 ? 'active' : 'failed');
    }
    assert.equal(session.state.life, 1);
    assert.equal(runtime.snapshot(session.state).failureReason, 'constraintViolated');
});


test('daily selection covers every single-theme recipe and unified templates cover all themes', () => {
    const themes = new Set(Array.from({ length: 256 }, (_, day) => createDailyChallenge(new Date(2026, 0, 1 + day, 12), CONTENT_VERSION).recipe.theme));
    assert.deepEqual([...themes].sort(), ['english', 'geography', 'hanzi', 'history', 'knowledge', 'life', 'math', 'vision']);
    assert.deepEqual([...new Set(QUESTION_TEMPLATES.map((template) => template.theme))].sort(), [...themes].sort());
});




test('ordinary brawl enforces visible quotas across all eight themes', () => {
    const director = new BrawlRequestFixture(new SeededRng('balanced-theme-quotas'));
    const counts = new Map<string, number>();
    const elapsed = [15_000, 30_000, 50_000];
    for (let index = 0; index < 3_000; index++) {
        const theme = director.next(elapsed[index % elapsed.length]).template.theme;
        counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
    for (const theme of ['math', 'vision', 'hanzi', 'english', 'life', 'geography', 'knowledge', 'history']) {
        const ratio = (counts.get(theme) ?? 0) / 3_000;
        const minimum = theme === 'math' ? 0.25 : 0.07;
        const maximum = theme === 'math' ? 0.35 : 0.18;
        assert.ok(ratio >= minimum, `${theme} quota too low: ${ratio}`);
        assert.ok(ratio <= maximum, `${theme} quota too high: ${ratio}`);
    }
});

test('category question pools exclude context-dependent items and polysemous English words', () => {
    assert.ok(!ENGLISH_WORDS.some((word) => word.en === 'ORANGE' || word.en === 'FISH'));
    assert.ok(ENGLISH_WORDS.some((word) => word.en === 'GRAY' && word.category === '颜色'));
    assert.ok(ENGLISH_WORDS.some((word) => word.en === 'ZEBRA' && word.category === '动物'));

    const excludedLifeItems = new Set(['垃圾袋', '海绵', '抹布', '剪刀', '胶带', '口罩', '牙刷']);
    assert.ok(LIFE_CATEGORY_FACTS.every((fact) => !excludedLifeItems.has(fact.item)));
    assert.equal(new Set(LIFE_CATEGORY_FACTS.map((fact) => fact.item)).size, LIFE_CATEGORY_FACTS.length);
    for (const category of ['清洁工具', '厨房用品', '学习用品', '安全用品', '交通工具']) {
        assert.equal(LIFE_CATEGORY_FACTS.filter((fact) => fact.category === category).length, 12);
    }
});

test('tower progress rewards first clears once without checkpoint rollback', () => {
    const entry = { mode: 'tower' as const, seed: 'tower-attempt-a', contentVersion: CONTENT_VERSION, towerFloor: 5 };
    const run: RunResult = { entry, score: 1_000, maxCombo: 7, correctCount: 10, errorCount: 1, accuracy: 10 / 11, remainingMs: 30_000 };
    const first = commitTowerFloor(DEFAULT_TOWER_PROGRESS, run, 2);
    assert.equal(first.result.cleared, true);
    assert.equal(first.result.firstClear, true);
    assert.equal(first.result.timeBonus, 60);
    assert.equal(first.result.towerPointsGained, 220);
    assert.equal(first.result.runTotalScore, 220);
    assert.equal(first.progress.highestClearedFloor, 5);
    const repeat = commitTowerFloor(first.progress, run, 2);
    assert.equal(repeat.result.firstClear, false);
    assert.equal(repeat.result.towerPointsGained, 14);
    assert.equal(repeat.result.runTotalScore, 234);
    const floor7Run: RunResult = { ...run, entry: { ...entry, seed: 'tower-floor-7', towerFloor: 7 }, correctCount: 12 };
    const floor7 = commitTowerFloor({ ...first.progress, highestClearedFloor: 6, currentFloor: 7 }, floor7Run, 2);
    assert.equal(floor7.result.unlockedLabel, '双规则');
});

test('floor 50 marks the MVP complete and remains replayable', () => {
    const before = { ...DEFAULT_TOWER_PROGRESS, currentFloor: 50, highestClearedFloor: 49 };
    const run: RunResult = {
        entry: { mode: 'tower', seed: 'floor-50', contentVersion: CONTENT_VERSION, towerFloor: 50 },
        score: 5_000, maxCombo: 10, correctCount: 15, errorCount: 2, accuracy: 15 / 17,
        elapsedMs: 45_000, remainingMs: 15_000,
    };
    const committed = commitTowerFloor(before, run, 3);
    assert.equal(committed.result.cleared, true);
    assert.equal(committed.result.towerMvpCompleted, true);
    assert.equal(committed.progress.currentFloor, 50);
    assert.equal(committed.progress.highestClearedFloor, 50);
    assert.equal(committed.progress.activeRun, undefined);
});

test('tower scoring rewards faster clears while staying near a chapter-scale total', () => {
    const maximumFirstClearTotal = Array.from({ length: 50 }, (_, index) =>
        towerPointsForClear(999_999, index + 1, true, 60_000),
    ).reduce((sum, points) => sum + points, 0);
    assert.equal(maximumFirstClearTotal, 26_250);
    assert.equal(towerTimeBonus(30_999), 60);
    assert.ok(towerPointsForClear(1_000, 10, true, 40_000) > towerPointsForClear(1_000, 10, true, 10_000));
    assert.equal(towerPointsForClear(999_999, 50, false, 60_000), 50);

    const migrated = normalizeTowerProgress({
        currentFloor: 17,
        highestClearedFloor: 16,
        scoringVersion: 3,
        totalTowerPoints: 51_096,
        bestContinuousScore: 0,
        maxCombo: 18,
        towerMvpCompleted: false,
        activeRun: { startFloor: 1, totalScore: 51_096, maxCombo: 18 },
    });
    assert.equal(migrated.scoringVersion, 4);
    assert.equal(migrated.totalTowerPoints, 0);
    assert.equal(migrated.activeRun?.totalScore, 51_096);
    assert.equal(migrated.highestClearedFloor, 16);
});

test('tower target stays cleared after life depletion and only fails below the target', () => {
    const base = { entry: { mode: 'tower' as const, seed: 'tower-fail', contentVersion: CONTENT_VERSION, towerFloor: 10 }, score: 900, maxCombo: 5, errorCount: 2, accuracy: 0.8 };
    const dead = commitTowerFloor(DEFAULT_TOWER_PROGRESS, { ...base, correctCount: 12 }, 0);
    assert.equal(dead.result.cleared, true);
    assert.equal(dead.result.failureReason, undefined);
    const short = commitTowerFloor(DEFAULT_TOWER_PROGRESS, { ...base, correctCount: 9 }, 1);
    assert.equal(short.result.cleared, false);
    assert.equal(short.result.failureReason, 'objectiveIncomplete');
    const deadShort = commitTowerFloor(DEFAULT_TOWER_PROGRESS, { ...base, correctCount: 9 }, 0);
    assert.equal(deadShort.result.cleared, false);
    assert.equal(deadShort.result.failureReason, 'lifeDepleted');
});

test('tower retries receive fresh seeds while a supplied seed remains reproducible', () => {
    let entropy = 10;
    const factory = new RunSeedFactory(() => new Date('2026-08-24T12:00:00+08:00'), () => entropy++);
    const first = factory.create('tower', CONTENT_VERSION, 8);
    const retry = factory.create('tower', CONTENT_VERSION, 8);
    assert.notEqual(first.seed, retry.seed);
    assert.equal(first.towerFloor, 8);
    assert.match(first.seed, /^tower:floor-8:/);
});

test('brawl rule pool follows tower unlocks and learned legacy tutorials', () => {
    const allowed = allowedBrawlRules(DEFAULT_TOWER_PROGRESS, { reverse: true });
    assert.deepEqual([...allowed].sort(), ['bomb', 'reverse', 'standard']);
    const director = new BrawlRequestFixture(new SeededRng('locked-brawl'), 'mixed', allowed, false);
    for (let index = 0; index < 80; index++) {
        const directive = director.next((index * 997) % 60_000);
        assert.ok(directive.rules.every((rule) => rule === 'standard' || allowed.has(rule)));
        assert.ok(directive.rules.filter((rule) => rule !== 'standard' && rule !== 'bomb').length <= 1);
    }
});

test('save v1 migration preserves player settings daily-compatible fields and adds tower defaults', () => {
    const migrated = migrateV1ToV2({
        schemaVersion: 1,
        player: { level: 4, xp: 1_560, bestScore: 8_800 },
        settings: { music: false, sfx: true, vibration: false, quality: 'low' },
        tutorials: { bomb: true, rotate: true },
        daily: {
            dateKey: '2026-08-20', recipeId: 'number-lab', attempts: 2, bestScore: 1700,
            lastScore: 1700, completed: true, tutorialBaseline: [],
        } as any,
    });
    assert.equal(migrated.schemaVersion, 2);
    assert.deepEqual(migrated.player, { level: 4, xp: 1_560, bestScore: 8_800 });
    assert.equal(migrated.settings.music, false);
    assert.equal(migrated.tutorials.bomb, true);
    assert.equal(migrated.tutorials.rotate, true);
    assert.equal(migrated.daily, undefined);
    assert.deepEqual(migrated.tower, DEFAULT_TOWER_PROGRESS);
});

test('save v2 migration adds a valid default friend challenge configuration', () => {
    const migrated = migrateV2ToV3({
        schemaVersion: 2,
        player: { level: 2, xp: 700, bestScore: 900 },
        settings: { music: true, sfx: true, vibration: true, quality: 'auto' },
        tutorials: {},
        tower: DEFAULT_TOWER_PROGRESS,
    });
    assert.equal(migrated.schemaVersion, 3);
    assert.deepEqual(migrated.lastFriendChallengeConfig, DEFAULT_FRIEND_CHALLENGE_CONFIG);
});

test('save v3 migration preserves the legacy best score for the local brawl leaderboard', () => {
    const migrated = migrateV3ToV4({
        schemaVersion: 3,
        player: { level: 2, xp: 700, bestScore: 975 },
        settings: { music: true, sfx: true, vibration: true, quality: 'auto' },
        tutorials: {},
        tower: DEFAULT_TOWER_PROGRESS,
        lastFriendChallengeConfig: DEFAULT_FRIEND_CHALLENGE_CONFIG,
    });
    assert.equal(migrated.schemaVersion, 4);
    assert.equal(migrated.leaderboard.brawlBestScore, 975);
});

test('save v4 migration creates detailed brawl and trial leaderboard records', () => {
    const migrated = migrateV4ToV5({
        schemaVersion: 4,
        player: { level: 2, xp: 700, bestScore: 975 },
        settings: { music: true, sfx: true, vibration: true, quality: 'auto' },
        tutorials: {}, tower: DEFAULT_TOWER_PROGRESS,
        lastFriendChallengeConfig: DEFAULT_FRIEND_CHALLENGE_CONFIG,
        leaderboard: { brawlBestScore: 975 },
    });
    assert.equal(migrated.schemaVersion, 5);
    assert.equal(migrated.leaderboard.brawlBest.rankScore, 975);
    assert.equal(migrated.leaderboard.trialAnsweredCount, 0);
});

test('save v5 keeps the expanded cross-session question history', () => {
    const base = createDefaultSave();
    const recentQuestionIds = [
        ...Array.from({ length: RECENT_QUESTION_HISTORY_LIMIT + 50 }, (_, index) => `static.question.${index}`),
        'static.question.100',
    ];
    const recentQuestionSignatures = Array.from({ length: RECENT_QUESTION_HISTORY_LIMIT + 40 }, (_, index) => `signature-${index}`);
    const normalized = normalizeV5({ ...base, recentQuestionIds, recentQuestionSignatures });
    assert.equal(normalized.recentQuestionIds.length, RECENT_QUESTION_HISTORY_LIMIT);
    assert.equal(normalized.recentQuestionIds.at(-1), 'static.question.100');
    assert.equal(new Set(normalized.recentQuestionIds).size, RECENT_QUESTION_HISTORY_LIMIT);
    assert.equal(normalized.recentQuestionSignatures.length, RECENT_QUESTION_HISTORY_LIMIT);
    assert.equal(normalized.recentQuestionSignatures[0], 'signature-40');
});

test('save v6 resets only tower progress and trial statistics', () => {
    const base = normalizeV5({
        ...createDefaultSave(),
        schemaVersion: 5,
        player: { level: 5, xp: 2_200, bestScore: 9_900 },
        tower: { ...DEFAULT_TOWER_PROGRESS, currentFloor: 30, highestClearedFloor: 29, totalTowerPoints: 8_000 },
        leaderboard: { brawlBest: emptyBrawlRecord(7_700), trialAnsweredCount: 400, trialCorrectCount: 360 },
    });
    const migrated = migrateV5ToV6(base);
    assert.equal(migrated.schemaVersion, 6);
    assert.deepEqual(migrated.tower, DEFAULT_TOWER_PROGRESS);
    assert.equal(migrated.leaderboard.trialAnsweredCount, 0);
    assert.equal(migrated.leaderboard.trialCorrectCount, 0);
    assert.equal(migrated.leaderboard.brawlBest.rankScore, base.leaderboard.brawlBest.rankScore);
    assert.deepEqual(migrated.player, base.player);
});

test('migrated V1 templates compile from reviewed facts', () => {
    const migratedTemplates = [
        ['hanzi-pinyin', /^fact\.hanzi\.pinyin\./],
        ['hanzi-poetry', /^fact\.hanzi\.poetry\./],
        ['english-first-letter', /^fact\.english\.words\./],
        ['english-length', /^fact\.english\.words\./],
    ] as const;
    for (const [id, factIdPattern] of migratedTemplates) {
        const template = QUESTION_TEMPLATES.find((item) => item.id === id)!;
        const generator = new DirectiveCompilerFixture(new SeededRng(`migrated-${id}`), GAMEPLAY_CONFIG);
        const question = generator.next({ phase: 'action', difficultyStage: 1, targetCount: 4,
            questionTimeMs: 2_600, speed: 1, template, rules: ['standard'] });
        assert.equal(question.templateId, id);
        assert.equal(question.factIds.length, 1);
        assert.match(question.factIds[0], factIdPattern);
        assert.deepEqual(validateQuestion(question, evaluateRules(question)), []);
    }
});

test('save v7 starts a clean final-score brawl season without resetting other progress', () => {
    const base = migrateV5ToV6(normalizeV5({
        ...createDefaultSave(), schemaVersion: 5,
        player: { level: 5, xp: 2_200, bestScore: 9_900 },
        leaderboard: { brawlBest: emptyBrawlRecord(7_700), trialAnsweredCount: 400, trialCorrectCount: 360 },
    }));
    const migrated = migrateV6ToV7(base);
    assert.equal(migrated.schemaVersion, 7);
    assert.equal(migrated.leaderboard.brawlBest.rankScore, 0);
    assert.equal(migrated.leaderboard.trialAnsweredCount, base.leaderboard.trialAnsweredCount);
    assert.deepEqual(migrated.player, base.player);
});

test('brawl final score applies accuracy once without a separate answer-count bonus', () => {
    assert.equal(calculateBrawlRankScore(2_000, 1), 2_000);
    assert.equal(calculateBrawlRankScore(2_000, .5), 1_700);
    const scored = applyBrawlFinalScore({
        entry: { mode: 'brawl60', seed: 'score', contentVersion: 'v' }, score: 2_000,
        elapsedMs: 60_000, maxCombo: 8, correctCount: 10, errorCount: 2, accuracy: .5, masterSlashCount: 1,
    });
    assert.equal(scored.score, 1_700);
});

test('local leaderboard sorts persisted player scores and reports an off-screen self rank', () => {
    const record = brawlRecordFromRun({
        entry: { mode: 'brawl60', seed: 'rank', contentVersion: 'v' }, score: 20_000,
        elapsedMs: 300_000, maxCombo: 30, correctCount: 120, errorCount: 5, accuracy: 120 / 125, masterSlashCount: 10,
    });
    const leading = createLocalLeaderboard('brawl', { brawl: record, trial: { highestFloor: 0, answeredCount: 0, accuracy: 0 } });
    assert.equal(leading.top[0].id, 'self');
    assert.equal(leading.top[0].score, record.rankScore);
    assert.equal(leading.self.rank, 1);

    const newcomer = createLocalLeaderboard('trial', { brawl: emptyBrawlRecord(), trial: { highestFloor: 0, answeredCount: 0, accuracy: 0 } });
    assert.equal(newcomer.top.length, 10);
    assert.equal(newcomer.self.rank, 13);
    assert.equal(newcomer.self.score, 0);
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

test('home portrait layout survives incomplete WeChat safe-area values', () => {
    const layout = calculateHomePortraitLayout(Number.NaN, Number.NaN, Number.POSITIVE_INFINITY);

    assert.ok(Number.isFinite(layout.contentScale));
    assert.ok(Number.isFinite(layout.sectionGap));
    assert.ok(Number.isFinite(layout.navigationY));
    for (const y of Object.values(layout.sectionY)) assert.ok(Number.isFinite(y));
});
