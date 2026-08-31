import type { GameplayConfig } from '../configs/GameConfig';
import type { BrawlQuestionDirective } from './Brawl60Director';
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
    type ContentFamilySpec,
    type TriviaFact,
} from './ContentCatalog';
import {
    HANZI_ANTONYM_FACTS,
    HANZI_SYNONYM_FACTS,
    type HanziRelationFact,
    type HanziRelationKind,
} from './HanziRelationCatalog';
import {
    KNOWLEDGE_CIVIC_FACTS,
    KNOWLEDGE_CULTURE_EXPANSION,
    KNOWLEDGE_NATURE_EXPANSION,
    KNOWLEDGE_SCIENCE_EXPANSION,
} from './KnowledgeExpansionCatalog';
import { validateQuestion } from './FairnessValidator';
import type { GameEntryParams, QuestionInstance, RuleId, TargetSpec, ThemeId } from './Models';
import { evaluateRules, rulesForReadableTargets } from './Rules';
import { SeededRng } from './SeededRng';
import { staticQuestionsForFamily, type StaticQuestionRecord } from './StaticQuestionBank';
import { generateExtendedQuestion } from './ExtendedQuestionGenerator';
import {
    legacyQuestionTypeForFamily,
    questionTypeById,
    type QuestionTypeDefinition,
} from './QuestionTypeCatalog';
import { validateRuleSet } from '../configs/GameConfig';

type Stage = 0 | 1 | 2;
export interface QuestionGeneratorOptions {
    recentFactIds?: readonly string[];
    recentSemanticSignatures?: readonly string[];
    onQuestionAccepted?: (factIds: readonly string[], semanticSignature: string) => void;
}

/** Shared challenges must depend only on their seed and configuration, never local play history. */
export function questionGeneratorOptionsForEntry(
    entry: Pick<GameEntryParams, 'mode'>,
    options: QuestionGeneratorOptions,
): QuestionGeneratorOptions {
    return entry.mode === 'friendChallenge' ? {} : options;
}
const COLOR_WORDS = ['红', '蓝', '绿', '黄'] as const;
const ARROWS = ['←', '↑', '→', '↓'] as const;
const OPPOSITE_ARROW: Readonly<Record<string, string>> = { '←': '→', '→': '←', '↑': '↓', '↓': '↑' };

export class QuestionGenerator {
    private index = 0;
    private directive!: BrawlQuestionDirective;
    private readonly factBags = new Map<string, number[]>();
    private readonly recentQuestionFacts: string[][] = [];
    private readonly recentSemanticSignatures: string[] = [];
    private readonly recentAnswerSignatures: string[] = [];
    private readonly crossSessionFactIds = new Set<string>();
    private readonly crossSessionFactRanks = new Map<string, number>();
    private readonly crossSessionSemanticSignatures = new Set<string>();
    private factRank = 0;
    private activeFactIds: string[] = [];
    private activeFactPoolExhausted = false;
    private activeQuestionType?: QuestionTypeDefinition;
    private activeRulesOverride?: RuleId[];

    public constructor(
        private readonly rng: SeededRng,
        _config: GameplayConfig,
        private readonly options: QuestionGeneratorOptions = {},
    ) {
        for (const id of options.recentFactIds ?? []) {
            if (!id) continue;
            this.crossSessionFactIds.add(id);
            this.crossSessionFactRanks.set(id, this.factRank++);
        }
        for (const signature of options.recentSemanticSignatures ?? []) {
            if (signature) this.crossSessionSemanticSignatures.add(signature);
        }
    }

    public next(directive: BrawlQuestionDirective): QuestionInstance {
        this.directive = directive;
        for (let attempt = 0; attempt < 24; attempt++) {
            this.activeFactIds = [];
            this.activeFactPoolExhausted = false;
            const question = this.generate(directive.family, directive.difficultyStage);
            question.activeRules = rulesForReadableTargets(question.activeRules, question.targets);
            if (validateQuestion(question, evaluateRules(question)).length) continue;
            const semanticSignature = this.semanticSignature(question);
            const answerSignature = this.answerSignature(question);
            const semanticCooling = this.recentSemanticSignatures.includes(semanticSignature)
                || (!this.activeFactPoolExhausted && this.crossSessionSemanticSignatures.has(semanticSignature));
            const answerCooling = this.recentAnswerSignatures.includes(answerSignature);
            // Relax answer variety first, then semantic variety only as a final
            // escape hatch for tiny visual pools. Fairness is never relaxed.
            if ((!semanticCooling && (!answerCooling || attempt >= 16)) || attempt >= 22) {
                this.recordQuestionFacts(semanticSignature);
                this.recordSignature(this.recentSemanticSignatures, semanticSignature, 60);
                this.recordSignature(this.recentAnswerSignatures, answerSignature, 8);
                return question;
            }
        }
        this.activeFactIds = [];
        return {
            id: `math-property.safe-${this.index}`,
            familyId: 'math-property.safe',
            factIds: [],
            theme: 'math',
            prompt: { text: '偶数' },
            targets: [{ id: 'safe-2', text: '2', value: 2 }, { id: 'safe-3', text: '3', value: 3 }],
            baseCorrectTargetIds: ['safe-2'],
            activeRules: ['standard'],
            timeLimitMs: directive.questionTimeMs,
        };
    }

    private generate(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        this.index += 1;
        // Generated packs may contain several records that only rotate the
        // distractors or difficulty while keeping the same question and
        // answer. They are useful authoring variants, but must not buy extra
        // probability in the live picker.
        const staticPool = this.uniqueStaticQuestions(staticQuestionsForFamily(family.kind));
        this.activeQuestionType = legacyQuestionTypeForFamily(family.kind);
        this.activeRulesOverride = undefined;
        const supportsExtended = !!this.directive.typeId
            && !this.directive.rules.includes('multi')
            && !this.directive.rules.includes('order')
            && this.directive.rules.filter((rule) => rule !== 'standard').length <= 1;
        if (supportsExtended) {
            const definition = questionTypeById(this.directive.typeId!);
            if (definition) {
                const rules = this.rulesForQuestionType(definition);
                if (rules) {
                    const draft = generateExtendedQuestion(definition, this.rng, stage);
                    // A pair/multi/order type is only safe when its generator
                    // supplied genuinely valid answers for that engine. Never
                    // promote a random distractor merely to satisfy the shape
                    // of an engine (for example "肺 -> 气体交换 + 昆虫").
                    if (this.draftSupportsEngine(definition, draft.correctTargetIds, draft.orderedTargetIds)) {
                        this.activeQuestionType = definition;
                        this.activeRulesOverride = rules;
                        const fitted = this.fitExtendedDraft(draft.targets, draft.correctTargetIds, draft.orderedTargetIds);
                        const targets = fitted.targets;
                        this.appendBomb(targets);
                        return this.make(family, draft.prompt, targets, fitted.correctTargetIds, rules, stage, fitted.orderedTargetIds);
                    }
                }
            }
        }
        if (staticPool.length && !this.directive.rules.includes('order')) {
            const eligible = staticPool.filter((record) => record.difficulty <= stage + 1);
            const pool = eligible.length ? eligible : staticPool;
            if (this.directive.rules.includes('multi')) {
                const multi = this.staticMultiChoice(family, stage, pool);
                if (multi) return multi;
            } else {
                const record = this.pickFact(`static:${family.kind}`, pool, (item) => item.id);
                return this.staticChoice(family, stage, record);
            }
        }
        switch (family.kind) {
            case 'math-add': return this.mathAdd(family, stage);
            case 'math-subtract': return this.mathSubtract(family, stage);
            case 'math-multiply': return this.mathMultiply(family, stage);
            case 'math-property': return this.mathProperty(family, stage);
            case 'math-compare': return this.mathCompare(family, stage);
            case 'math-sequence': return this.mathSequence(family, stage);
            case 'math-missing': return this.mathMissing(family, stage);
            case 'math-equation': return this.mathEquation(family, stage);
            case 'vision-direction': return this.visionDirection(family, stage);
            case 'vision-odd': return this.visionOdd(family, stage);
            case 'vision-count': return this.visionCount(family, stage);
            case 'vision-stroop': return this.visionStroop(family, stage);
            case 'vision-pattern': return this.visionPattern(family, stage);
            case 'vision-match': return this.visionMatch(family, stage);
            case 'hanzi-fill': return this.hanziFill(family, stage);
            case 'hanzi-order': return this.hanziOrder(family, stage);
            case 'hanzi-antonym': return this.hanziRelation(family, stage, 'antonym');
            case 'hanzi-synonym': return this.hanziRelation(family, stage, 'synonym');
            case 'english-meaning': return this.englishMeaning(family, stage);
            case 'english-category': return this.englishCategory(family, stage);
            case 'english-antonym': return this.englishAntonym(family, stage);
            case 'life-category': return this.lifeCategory(family, stage);
            case 'geography-capital': return this.geographyCapital(family, stage);
            case 'geography-country': return this.geographyCountry(family, stage);
            case 'knowledge-science': return this.trivia(family, stage, 'knowledge-science', [...KNOWLEDGE_SCIENCE_FACTS, ...KNOWLEDGE_SCIENCE_EXPANSION]);
            case 'knowledge-nature': return this.trivia(family, stage, 'knowledge-nature', [...KNOWLEDGE_NATURE_FACTS, ...KNOWLEDGE_NATURE_EXPANSION]);
            case 'knowledge-culture': return this.trivia(family, stage, 'knowledge-culture', [...KNOWLEDGE_CULTURE_FACTS, ...KNOWLEDGE_CULTURE_EXPANSION]);
            case 'knowledge-civic': return this.trivia(family, stage, 'knowledge-civic', KNOWLEDGE_CIVIC_FACTS);
            case 'history-modern-opening': return this.trivia(family, stage, 'history-modern-opening', HISTORY_MODERN_OPENING_FACTS);
            case 'history-modern-awakening': return this.trivia(family, stage, 'history-modern-awakening', HISTORY_MODERN_AWAKENING_FACTS);
            case 'history-modern-resistance': return this.trivia(family, stage, 'history-modern-resistance', HISTORY_MODERN_RESISTANCE_FACTS);
            case 'history-ancient': return this.trivia(family, stage, 'history-ancient', HISTORY_ANCIENT_FACTS);
            case 'history-myth': return this.trivia(family, stage, 'history-myth', HISTORY_MYTH_FACTS);
            default: return this.makeChoice(family, '偶数', 2, [3, 4, 5, 6], stage);
        }
    }

    private staticChoice(family: ContentFamilySpec, stage: Stage, record: StaticQuestionRecord): QuestionInstance {
        return this.makeChoice(
            family,
            record.prompt,
            String(record.answer),
            record.distractors.map(String),
            stage,
        );
    }

    private staticMultiChoice(
        family: ContentFamilySpec,
        stage: Stage,
        pool: readonly StaticQuestionRecord[],
    ): QuestionInstance | null {
        const prompts = new Map<string, StaticQuestionRecord[]>();
        for (const record of pool) {
            const group = prompts.get(record.prompt) ?? [];
            if (!group.some((candidate) => String(candidate.answer) === String(record.answer))) group.push(record);
            prompts.set(record.prompt, group);
        }
        const groups = Array.from(prompts.values()).filter((group) => group.length >= 2);
        if (!groups.length) return null;
        const group = this.rng.pick(groups);
        const pairs: Array<readonly [StaticQuestionRecord, StaticQuestionRecord]> = [];
        for (let left = 0; left < group.length; left++) {
            for (let right = left + 1; right < group.length; right++) pairs.push([group[left], group[right]]);
        }
        const selected = this.pickFact(
            `static-multi:${family.kind}:${group[0].prompt}`,
            pairs,
            (pair) => pair.map((record) => record.id).sort().join('+'),
        );
        const answers = selected.map((record) => String(record.answer));
        const distractors = this.rng.shuffle(group.flatMap((record) => record.distractors.map(String)))
            .filter((value, index, values) => !answers.includes(value) && values.indexOf(value) === index);
        const values = this.rng.shuffle([
            ...answers,
            ...distractors.slice(0, Math.max(0, this.directive.targetCount - answers.length)),
        ]);
        const targets: TargetSpec[] = values.map((value, index) => ({ id: `t${index}`, text: value, value }));
        const correct = targets.filter((target) => answers.includes(String(target.value))).map((target) => target.id);
        if (correct.length < 2) return null;
        this.appendBomb(targets);
        return this.make(family, group[0].prompt, targets, correct, this.directive.rules, stage);
    }

    private uniqueStaticQuestions(records: readonly StaticQuestionRecord[]): StaticQuestionRecord[] {
        const unique = new Map<string, StaticQuestionRecord>();
        for (const record of records) {
            const key = `${record.familyKind}|${this.normalizePrompt(record.prompt)}|${String(record.answer).trim()}`;
            const existing = unique.get(key);
            // Prefer the lowest difficulty so a semantic question does not
            // disappear from early phases solely because a later variant was
            // installed first.
            if (!existing || record.difficulty < existing.difficulty) unique.set(key, record);
        }
        return Array.from(unique.values());
    }

    private make(
        family: ContentFamilySpec,
        prompt: string,
        targets: TargetSpec[],
        correct: string[],
        _rules: RuleId[],
        _stage: Stage,
        orderedTargetIds?: string[],
    ): QuestionInstance {
        const activeRules = [...(this.activeRulesOverride ?? this.directive.rules)];
        return {
            id: `${family.id}-${this.index}`,
            typeId: this.activeQuestionType?.typeId,
            engineId: this.activeQuestionType?.engineId,
            familyId: family.id,
            theme: family.theme,
            factIds: [...this.activeFactIds],
            prompt: { text: prompt },
            targets,
            baseCorrectTargetIds: correct,
            orderedTargetIds,
            activeRules,
            timeLimitMs: this.directive.questionTimeMs,
        };
    }

    private makeChoice<T extends string | number>(
        family: ContentFamilySpec,
        prompt: string,
        answer: T,
        candidates: readonly T[],
        stage: Stage,
        options: { allowReverse?: boolean; allowBomb?: boolean } = { allowReverse: true, allowBomb: true },
    ): QuestionInstance {
        const rules = this.directive.rules;
        // targetCount describes answer candidates. A bomb is an additional
        // hazard and must never replace one of those candidates.
        const count = Math.max(2, this.directive.targetCount);
        const values = this.includeAnswer(answer, candidates, count);
        // Object.is also handles numeric edge values such as NaN. includeAnswer
        // inserts the answer before shuffling; retain a defensive repair so a
        // malformed external pool can never crash the live question loop.
        let answerIndex = values.findIndex((value) => Object.is(value, answer));
        if (answerIndex < 0) { values[0] = answer; answerIndex = 0; }
        const targets: TargetSpec[] = values.map((value, index) => ({ id: `t${index}`, text: String(value), value }));
        this.appendBomb(targets);
        return this.make(family, prompt, targets, [`t${answerIndex}`], rules, stage);
    }

    private includeAnswer<T>(answer: T, candidates: readonly T[], count: number): T[] {
        const seen = new Set<string>([String(answer)]);
        const unique = this.rng.shuffle(candidates).filter((candidate) => {
            const key = String(candidate);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        return this.rng.shuffle([answer, ...unique.slice(0, Math.max(1, count - 1))]);
    }

    private mathAdd(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const ceiling = 12 + family.variant * 8 + stage * 18;
        const a = this.rng.int(2 + family.variant, ceiling);
        const b = this.rng.int(2, ceiling);
        const c = family.variant >= 3 && stage === 2 ? this.rng.int(2, 12) : 0;
        const answer = a + b + c;
        const prompt = c ? `${a}+${b}+${c}=?` : `${a}+${b}=?`;
        return this.makeChoice(family, prompt, answer, [answer - 2, answer - 1, answer + 1, answer + 2, answer + 10], stage);
    }

    private mathSubtract(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const b = this.rng.int(2, 10 + family.variant * 5 + stage * 8);
        const answer = this.rng.int(2, 12 + family.variant * 6 + stage * 10);
        const a = answer + b;
        return this.makeChoice(family, `${a}-${b}=?`, answer, [answer - 2, answer - 1, answer + 1, answer + 2, answer + 5], stage);
    }

    private mathMultiply(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const a = this.rng.int(2, Math.min(12, 5 + family.variant + stage * 2));
        const b = this.rng.int(2, Math.min(12, 6 + family.variant + stage * 2));
        const answer = a * b;
        if (family.variant % 2 === 1 && stage > 0) {
            return this.makeChoice(family, `${answer}÷${a}=?`, b, [b - 2, b - 1, b + 1, b + 2, a], stage);
        }
        return this.makeChoice(family, `${a}×${b}=?`, answer, [answer - a, answer + a, answer - b, answer + b, a + b], stage);
    }

    private mathProperty(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const count = this.nonBombTargetCount();
        const max = 30 + family.variant * 20 + stage * 60;
        const values = this.uniqueNumbers(count, 2, max);
        let predicate: (value: number) => boolean;
        let prompt: string;
        if (family.variant === 0) { predicate = (value) => value % 2 === 0; prompt = '偶数'; }
        else if (family.variant === 1) { predicate = (value) => value % 2 !== 0; prompt = '奇数'; }
        else if (family.variant === 2) { predicate = (value) => value % 3 === 0; prompt = '3的倍数'; }
        else {
            const threshold = Math.max(10, Math.round(max * 0.5 / 5) * 5);
            predicate = family.variant === 3 ? (value) => value > threshold : (value) => value < threshold;
            prompt = family.variant === 3 ? `大于${threshold}` : `小于${threshold}`;
        }
        if (!values.some(predicate)) this.forcePropertyValue(values, 0, predicate, true, max);
        if (values.every(predicate)) this.forcePropertyValue(values, values.length - 1, predicate, false, max);
        if (this.isOrdinarySingleSelection()) {
            while (values.filter(predicate).length > 1) {
                const index = values.findIndex(predicate);
                if (index < 0) break;
                this.forcePropertyValue(values, index, predicate, false, max);
            }
        }
        if (this.directive.rules.includes('multi')) {
            while (values.filter(predicate).length < 2) {
                const index = values.findIndex((value) => !predicate(value));
                if (index < 0) break;
                this.forcePropertyValue(values, index, predicate, true, max);
            }
        }
        if (this.directive.rules.includes('multi') && this.directive.rules.includes('reverse')) {
            while (values.filter((value) => !predicate(value)).length < 2 && values.filter(predicate).length > 2) {
                const index = values.findIndex(predicate);
                if (index < 0) break;
                this.forcePropertyValue(values, index, predicate, false, max);
            }
        }
        const targets: TargetSpec[] = values.map((value, index) => ({ id: `n${index}`, text: String(value), value }));
        const correct = targets.filter((target) => predicate(Number(target.value))).map((target) => target.id);
        this.appendBomb(targets);
        const rules = this.directive.rules;
        return this.make(family, prompt, targets, correct, rules, stage);
    }

    private mathCompare(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const count = this.nonBombTargetCount();
        const values = this.uniqueNumbers(count, 5, 50 + family.variant * 25 + stage * 80);
        const largest = family.variant % 2 === 0;
        const answer = largest ? Math.max(...values) : Math.min(...values);
        return this.makeChoice(family, largest ? '最大的' : '最小的', answer, values, stage);
    }

    private mathSequence(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        if (this.directive.rules.includes('order')) {
            const values = this.uniqueNumbers(this.nonBombTargetCount(), 1, 50 + stage * 50);
            const targets: TargetSpec[] = this.rng.shuffle(values).map((value, index) => ({ id: `o${index}`, text: String(value), value }));
            const ordered = [...targets].sort((a, b) => Number(a.value) - Number(b.value)).map((target) => target.id);
            this.appendBomb(targets);
            return this.make(family, '从小到大', targets, ordered, ['order'], stage, ordered);
        }
        const step = 1 + family.variant + stage;
        const start = this.rng.int(1, 12 + stage * 8);
        const answer = start + step * 3;
        return this.makeChoice(family, `${start},${start + step},${start + step * 2},?`, answer, [answer - step, answer + step, answer + 1, answer - 1, answer + step * 2], stage);
    }

    private mathMissing(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const ceiling = 12 + family.variant * 8 + stage * 18;
        if (family.variant === 4) {
            const answer = this.rng.int(2, Math.min(12, 6 + stage * 3));
            const factor = this.rng.int(2, Math.min(12, 5 + stage * 3));
            const product = answer * factor;
            return this.makeChoice(family, `( )×${factor}=${product}`, answer, [answer - 2, answer - 1, answer + 1, answer + 2, factor], stage);
        }
        const left = this.rng.int(2, ceiling);
        const right = this.rng.int(2, ceiling);
        if (family.variant === 0) {
            return this.makeChoice(family, `( )+${right}=${left + right}`, left, [left - 2, left - 1, left + 1, left + 2], stage);
        }
        if (family.variant === 1) {
            return this.makeChoice(family, `${left}+( )=${left + right}`, right, [right - 2, right - 1, right + 1, right + 2], stage);
        }
        const result = this.rng.int(2, ceiling);
        const minuend = result + right;
        if (family.variant === 2) {
            return this.makeChoice(family, `( )-${right}=${result}`, minuend, [minuend - 2, minuend - 1, minuend + 1, minuend + 2], stage);
        }
        return this.makeChoice(family, `${minuend}-( )=${result}`, right, [right - 2, right - 1, right + 1, right + 2], stage);
    }

    private mathEquation(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const target = this.rng.int(8 + family.variant * 2, 18 + family.variant * 6 + stage * 10);
        if (family.variant % 2 === 0) {
            const left = this.rng.int(2, target - 3);
            const right = target - left;
            const answer = `${left}+${right}`;
            const candidates = [
                `${left}+${right + 1}`,
                `${left + 1}+${right + 1}`,
                `${left}+${right - 1}`,
                `${left + 2}+${right + 1}`,
                `${left + 1}+${right - 2}`,
            ];
            return this.makeChoice(family, `等于 ${target}`, answer, candidates, stage);
        }
        const subtrahend = this.rng.int(2, 8 + family.variant + stage * 3);
        const minuend = target + subtrahend;
        const answer = `${minuend}-${subtrahend}`;
        const candidates = [
            `${minuend + 1}-${subtrahend}`,
            `${minuend}-${subtrahend + 1}`,
            `${minuend + 2}-${subtrahend}`,
            `${minuend}-${subtrahend + 2}`,
            `${minuend + 3}-${subtrahend + 1}`,
        ];
        return this.makeChoice(family, `等于 ${target}`, answer, candidates, stage);
    }

    private visionDirection(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const shown = this.rng.pick(ARROWS);
        const opposite = family.variant >= 3 && stage > 0;
        const answer = opposite ? OPPOSITE_ARROW[shown] : shown;
        return this.makeChoice(family, opposite ? `${shown} 的反向` : shown, answer, ARROWS, stage, { allowBomb: false });
    }

    private visionOdd(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const pairs: readonly (readonly [string, string])[] = [['●', '○'], ['▲', '△'], ['■', '□'], ['◆', '◇'], ['★', '☆']];
        const [base, odd] = pairs[family.variant];
        const count = this.nonBombTargetCount();
        const oddIndex = this.rng.int(0, count - 1);
        const targets: TargetSpec[] = Array.from({ length: count }, (_, index) => ({ id: `v${index}`, text: index === oddIndex ? odd : base, value: index }));
        this.appendBomb(targets);
        return this.make(family, '不同的', targets, [`v${oddIndex}`], ['standard'], stage);
    }

    private visionCount(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const symbols = ['●', '▲', '■', '◆', '★'];
        const symbol = symbols[family.variant];
        const answerCount = this.rng.int(2, 4 + stage);
        const values = this.includeAnswer(answerCount, [1, 2, 3, 4, 5, 6], this.nonBombTargetCount());
        const targets: TargetSpec[] = values.map((value, index) => ({ id: `c${index}`, text: symbol.repeat(value), value }));
        this.appendBomb(targets);
        return this.make(family, `${answerCount}个`, targets, [targets.find((target) => target.value === answerCount)!.id], ['standard'], stage);
    }

    private visionStroop(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const wanted = COLOR_WORDS[family.variant % COLOR_WORDS.length];
        const colors = this.includeAnswer(wanted, COLOR_WORDS, this.nonBombTargetCount());
        const targets: TargetSpec[] = colors.map((color, index) => ({
            id: `s${index}`,
            text: COLOR_WORDS[(COLOR_WORDS.indexOf(color) + 1 + family.variant % 3) % COLOR_WORDS.length],
            colorName: color,
            value: color,
        }));
        this.appendBomb(targets);
        return this.make(family, `字体颜色·${wanted}`, targets, [targets.find((target) => target.value === wanted)!.id], this.directive.rules, stage);
    }

    private visionPattern(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const symbols = ['○', '△', '□', '◇', '☆', '●', '▲', '■', '◆', '★'];
        if (family.variant === 0) {
            const first = this.rng.pick(symbols);
            const second = this.rng.pick(symbols.filter((symbol) => symbol !== first));
            return this.makeChoice(family, `${first}${second}${first}${second}?`, first, symbols, stage, { allowBomb: false });
        }
        if (family.variant === 1) {
            const start = this.rng.int(0, ARROWS.length - 1);
            const step = this.rng.next() < 0.5 ? 1 : -1;
            const sequence = Array.from({ length: 4 }, (_, index) => ARROWS[(start + index * step + ARROWS.length * 2) % ARROWS.length]);
            return this.makeChoice(family, `${sequence[0]}${sequence[1]}${sequence[2]}?`, sequence[3], [...ARROWS, '↗'], stage, { allowBomb: false });
        }
        if (family.variant === 2) {
            const first = this.rng.pick(symbols);
            const second = this.rng.pick(symbols.filter((symbol) => symbol !== first));
            const run = this.rng.int(1, 3);
            const block = `${first}${second.repeat(run)}`;
            return this.makeChoice(family, `${block}${block}?`, first, symbols, stage, { allowBomb: false });
        }
        if (family.variant === 3) {
            const first = this.rng.int(0, 9);
            let second = this.rng.int(0, 9);
            if (second === first) second = (second + 1) % 10;
            return this.makeChoice(family, `${first},${second},${first},${second},?`, first, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], stage, { allowBomb: false });
        }
        const sizes = ['小', '中', '大'] as const;
        const start = this.rng.int(0, sizes.length - 1);
        const step = this.rng.next() < 0.5 ? 1 : -1;
        const sequence = Array.from({ length: 6 }, (_, index) => sizes[(start + index * step + sizes.length * 3) % sizes.length]);
        return this.makeChoice(family, `${sequence.slice(0, 5).join('')}?`, sequence[5], ['小', '中', '大', '特大'], stage, { allowBomb: false });
    }

    private visionMatch(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const symbolSets: readonly (readonly string[])[] = [
            ['●', '○', '▲', '△'],
            ['■', '□', '◆', '◇'],
            ['★', '☆', '●', '○'],
            ['▲', '△', '◆', '◇'],
            ['■', '□', '★', '☆'],
        ];
        const symbols = symbolSets[family.variant];
        const first = this.rng.pick(symbols);
        const second = this.rng.pick(symbols.filter((symbol) => symbol !== first));
        const answer = `${first}${second}`;
        const candidates: string[] = [];
        for (const left of symbols) {
            for (const right of symbols) {
                const pair = `${left}${right}`;
                if (pair !== answer) candidates.push(pair);
            }
        }
        return this.makeChoice(family, `找相同 ${answer}`, answer, candidates, stage);
    }

    private hanziFill(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const entry = this.pickFact('idioms', IDIOMS, (item) => `idiom:${item.text}`);
        const answer = entry.text[entry.missingIndex];
        const prompt = `${entry.text.slice(0, entry.missingIndex)}( )${entry.text.slice(entry.missingIndex + 1)}`;
        return this.makeChoice(family, prompt, answer, entry.wrong, stage);
    }

    private hanziOrder(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const orderable = IDIOMS.filter((entry) => new Set(entry.text).size === 4);
        const entry = this.pickFact('idioms-orderable', orderable, (item) => `idiom:${item.text}`);
        const source = Array.from(entry.text).map((text, originalIndex) => ({ text, originalIndex }));
        const targets: TargetSpec[] = this.rng.shuffle(source).map((item, index) => ({ id: `h${index}`, text: item.text, value: item.originalIndex }));
        const ordered = [...targets].sort((a, b) => Number(a.value) - Number(b.value)).map((target) => target.id);
        this.appendBomb(targets);
        return this.make(family, '排成语', targets, ordered, ['order'], stage, ordered);
    }

    private englishMeaning(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const word = this.pickFact('english-words', ENGLISH_WORDS, (item) => `english:${item.en}`);
        const sameCategory = ENGLISH_WORDS.filter((candidate) => candidate.category === word.category && candidate.en !== word.en).map((candidate) => candidate.zh);
        return this.makeChoice(family, `${word.en} 是？`, word.zh, sameCategory, stage);
    }

    private englishCategory(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const categories = ['动物', '颜色', '食物', '动作', '物品'] as const;
        const category = categories[family.variant];
        const count = this.nonBombTargetCount();
        const matchingPool = ENGLISH_WORDS.filter((word) => word.category === category);
        const others = this.rng.shuffle(ENGLISH_WORDS.filter((word) => word.category !== category));
        const correctCount = this.isOrdinarySingleSelection()
            ? 1
            : this.directive.rules.includes('multi') || stage > 0 ? 2 : 1;
        const matching = this.pickFacts(`english-category:${category}`, matchingPool, correctCount, (word) => `english:${word.en}`);
        const words = this.rng.shuffle([...matching, ...others.slice(0, count - correctCount)]);
        const targets: TargetSpec[] = words.map((word, index) => ({ id: `e${index}`, text: word.en, value: word.category }));
        const correct = targets.filter((target) => target.value === category).map((target) => target.id);
        this.appendBomb(targets);
        return this.make(family, category, targets, correct, this.directive.rules, stage);
    }

    private englishAntonym(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const pair = this.pickFact('english-antonyms', ENGLISH_ANTONYMS, (item) => `antonym:${item[0]}:${item[1]}`);
        const reversePair = this.rng.next() < 0.5;
        const promptWord = pair[reversePair ? 1 : 0];
        const answer = pair[reversePair ? 0 : 1];
        const antonymWords: string[] = [];
        for (const item of ENGLISH_ANTONYMS) antonymWords.push(item[0], item[1]);
        const candidates = this.rng.shuffle(antonymWords).filter((word) => word !== promptWord);
        return this.makeChoice(family, `${promptWord} 的反义词`, answer, candidates, stage);
    }

    private lifeCategory(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const categories = ['清洁工具', '厨房用品', '学习用品', '安全用品', '交通工具'] as const;
        const category = categories[family.variant];
        const count = this.nonBombTargetCount();
        const matchingPool = LIFE_CATEGORY_FACTS.filter((fact) => fact.category === category);
        const others = this.rng.shuffle(LIFE_CATEGORY_FACTS.filter((fact) => fact.category !== category));
        const correctCount = this.isOrdinarySingleSelection()
            ? 1
            : this.directive.rules.includes('multi') || stage > 0 ? 2 : 1;
        const matching = this.pickFacts(`life-category:${category}`, matchingPool, correctCount, (fact) => `life:${fact.item}`);
        const facts = this.rng.shuffle([...matching, ...others.slice(0, count - correctCount)]);
        const targets: TargetSpec[] = facts.map((fact, index) => ({ id: `l${index}`, text: fact.item, value: fact.category }));
        const correct = targets.filter((target) => target.value === category).map((target) => target.id);
        this.appendBomb(targets);
        return this.make(family, category, targets, correct, this.directive.rules, stage);
    }

    private geographyCapital(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const fact = this.pickFact('geography-facts', GEOGRAPHY_FACTS, (item) => `geography:${item.country}`);
        const candidates = GEOGRAPHY_FACTS.filter((candidate) => candidate.capital !== fact.capital).map((candidate) => candidate.capital);
        return this.makeChoice(family, `${fact.country}首都`, fact.capital, candidates, stage);
    }

    private geographyCountry(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const fact = this.pickFact('geography-facts', GEOGRAPHY_FACTS, (item) => `geography:${item.country}`);
        const candidates = GEOGRAPHY_FACTS.filter((candidate) => candidate.country !== fact.country).map((candidate) => candidate.country);
        return this.makeChoice(family, `${fact.capital}在哪国`, fact.country, candidates, stage);
    }

    private hanziRelation(
        family: ContentFamilySpec,
        stage: Stage,
        kind: HanziRelationKind,
    ): QuestionInstance {
        const pool: readonly HanziRelationFact[] = kind === 'antonym'
            ? HANZI_ANTONYM_FACTS
            : HANZI_SYNONYM_FACTS;
        const fact = this.pickFact(`hanzi-${kind}`, pool, (item) => item.id);
        const reversePair = this.rng.next() < 0.5;
        const promptWord = reversePair ? fact.right : fact.left;
        const answer = reversePair ? fact.left : fact.right;
        const distractors = reversePair ? fact.leftDistractors : fact.rightDistractors;
        return this.makeChoice(
            family,
            `${promptWord}的${kind === 'antonym' ? '反义词' : '近义词'}`,
            answer,
            distractors,
            stage,
        );
    }

    private trivia(family: ContentFamilySpec, stage: Stage, poolId: string, facts: readonly TriviaFact[]): QuestionInstance {
        const fact = this.pickFact(poolId, facts, (item) => `${poolId}:${item.prompt}`);
        return this.makeChoice(family, fact.prompt, fact.answer, fact.wrong, stage);
    }

    private uniqueNumbers(count: number, min: number, max: number): number[] {
        const values = new Set<number>();
        while (values.size < count) values.add(this.rng.int(min, max));
        // Creator's WeChat transform can lower iterable spread to [].concat(set),
        // which produces [Set] instead of the set's numeric entries.
        return Array.from(values);
    }

    private forcePropertyValue(values: number[], index: number, predicate: (value: number) => boolean, expected: boolean, max: number): void {
        for (let candidate = 1; candidate <= max; candidate++) {
            if (predicate(candidate) === expected && !values.some((value, valueIndex) => valueIndex !== index && value === candidate)) {
                values[index] = candidate;
                return;
            }
        }
    }

    private nonBombTargetCount(): number {
        return Math.max(2, this.directive.targetCount);
    }

    private isOrdinarySingleSelection(): boolean {
        const rules = this.directive.rules;
        return !rules.includes('reverse') && !rules.includes('multi') && !rules.includes('order');
    }

    private appendBomb(targets: TargetSpec[]): void {
        if (!(this.directive.bombEnabled ?? (this.activeRulesOverride ?? this.directive.rules).includes('bomb'))) return;
        const insertIndex = this.rng.int(0, targets.length);
        targets.splice(insertIndex, 0, { id: 'bomb', text: '爆', isBomb: true });
    }

    private pickFacts<T>(key: string, items: readonly T[], count: number, idOf: (item: T) => string): T[] {
        const picked: T[] = [];
        for (let i = 0; i < count; i++) picked.push(this.pickFact(key, items, idOf));
        return picked;
    }

    private pickFact<T>(key: string, items: readonly T[], idOf: (item: T) => string): T {
        if (!items.length) throw new Error(`Empty fact pool: ${key}`);
        let bag = this.factBags.get(key);
        if (!bag?.length) {
            bag = this.rng.shuffle(items.map((_, index) => index));
            this.factBags.set(key, bag);
        }
        const localRecent = new Set(this.recentQuestionFacts.flat());
        const seen = new Set([...this.crossSessionFactIds, ...localRecent]);
        let bagIndex = bag.length - 1;
        while (bagIndex >= 0) {
            const factId = idOf(items[bag[bagIndex]]);
            if (!seen.has(factId) && !this.activeFactIds.includes(factId)) break;
            bagIndex--;
        }
        if (bagIndex < 0) {
            bag = this.rng.shuffle(items.map((_, index) => index));
            this.factBags.set(key, bag);
            bagIndex = bag.findIndex((index) => !seen.has(idOf(items[index])) && !this.activeFactIds.includes(idOf(items[index])));
            if (bagIndex < 0) {
                // Every item in this pool has been seen across sessions. From
                // here the shuffled bag itself becomes the new no-replacement
                // cycle. Mark this so next() does not reject and burn up to 24
                // valid bag entries merely because the persisted history has
                // naturally covered a small pool (history is the common case).
                this.activeFactPoolExhausted = true;
                let oldestRank = Number.POSITIVE_INFINITY;
                for (let index = 0; index < bag.length; index++) {
                    const factId = idOf(items[bag[index]]);
                    if (localRecent.has(factId) || this.activeFactIds.includes(factId)) continue;
                    const rank = this.crossSessionFactRanks.get(factId) ?? -1;
                    if (rank < oldestRank) { oldestRank = rank; bagIndex = index; }
                }
            }
            if (bagIndex < 0) bagIndex = bag.findIndex((index) => !this.activeFactIds.includes(idOf(items[index])));
            if (bagIndex < 0) bagIndex = 0;
        }
        const item = items[bag.splice(bagIndex, 1)[0]];
        const factId = idOf(item);
        if (!this.activeFactIds.includes(factId)) this.activeFactIds.push(factId);
        return item;
    }

    private recordQuestionFacts(semanticSignature: string): void {
        const accepted = [...this.activeFactIds];
        this.recentQuestionFacts.push(accepted);
        if (this.recentQuestionFacts.length > 30) this.recentQuestionFacts.shift();
        if (accepted.length) {
            for (const id of accepted) {
                this.crossSessionFactIds.add(id);
                this.crossSessionFactRanks.set(id, this.factRank++);
            }
        }
        this.crossSessionSemanticSignatures.add(semanticSignature);
        this.options.onQuestionAccepted?.(accepted, semanticSignature);
    }

    private semanticSignature(question: QuestionInstance): string {
        const familyKind = (question.familyId ?? '').replace(/\.v\d+$/, '');
        return `${question.theme}|${question.typeId ?? familyKind}|${this.normalizePrompt(question.prompt.text)}|${this.answerSignature(question)}`;
    }

    private answerSignature(question: QuestionInstance): string {
        const textById = new Map(question.targets.map((target) => [target.id, target.text.trim()]));
        const answerIds = question.orderedTargetIds?.length ? question.orderedTargetIds : question.baseCorrectTargetIds;
        const answers = answerIds.map((id) => textById.get(id) ?? id);
        if (!question.orderedTargetIds?.length) answers.sort();
        return answers.join('→');
    }

    private normalizePrompt(prompt: string): string {
        const compact = prompt.replace(/\s+/g, '');
        const arithmetic = compact.match(/^(\d+)([+×])(\d+)(?:\2(\d+))?=\?$/);
        if (!arithmetic) return compact;
        const operands = [arithmetic[1], arithmetic[3], arithmetic[4]].filter((value): value is string => !!value);
        return `${operands.map(Number).sort((a, b) => a - b).join(arithmetic[2])}=?`;
    }

    private recordSignature(history: string[], signature: string, limit: number): void {
        history.push(signature);
        if (history.length > limit) history.shift();
    }

    private rulesForQuestionType(definition: QuestionTypeDefinition): RuleId[] | null {
        const requested = this.directive.rules.filter((rule) => rule !== 'standard' && rule !== 'multi' && rule !== 'order');
        if (definition.engineId === 'inverse' && requested.includes('reverse')) return null;
        const needsOrder = definition.engineId === 'order';
        const needsMulti = definition.engineId === 'multi' || definition.engineId === 'double'
            || definition.engineId === 'pair' || definition.engineId === 'same';
        const result = [...requested, ...(needsOrder ? ['order' as const] : needsMulti ? ['multi' as const] : [])];
        const normalized: RuleId[] = result.length ? Array.from(new Set(result)) : ['standard'];
        return validateRuleSet(normalized) ? normalized : null;
    }

    private draftSupportsEngine(
        definition: QuestionTypeDefinition,
        correctTargetIds: readonly string[],
        orderedTargetIds?: readonly string[],
    ): boolean {
        if (definition.engineId === 'order') return (orderedTargetIds?.length ?? 0) >= 2;
        const needsMultiple = definition.engineId === 'multi' || definition.engineId === 'double'
            || definition.engineId === 'pair' || definition.engineId === 'same';
        return !needsMultiple || correctTargetIds.length >= 2;
    }

    private fitExtendedDraft(
        targets: readonly TargetSpec[],
        correctTargetIds: readonly string[],
        orderedTargetIds?: readonly string[],
    ): { targets: TargetSpec[]; correctTargetIds: string[]; orderedTargetIds?: string[] } {
        const cap = Math.max(2, this.directive.targetCount);
        const answerIds = orderedTargetIds?.length ? [...orderedTargetIds].slice(0, cap) : [...correctTargetIds];
        const answers = targets.filter((target) => answerIds.includes(target.id));
        const distractors = this.rng.shuffle(targets.filter((target) => !answerIds.includes(target.id)));
        const selected = [...answers, ...distractors.slice(0, Math.max(0, cap - answers.length))];
        const selectedIds = new Set(selected.map((target) => target.id));
        const fittedOrder = orderedTargetIds?.filter((id) => selectedIds.has(id));
        return {
            targets: this.rng.shuffle(selected),
            correctTargetIds: correctTargetIds.filter((id) => selectedIds.has(id)),
            orderedTargetIds: fittedOrder?.length ? fittedOrder : undefined,
        };
    }
}
