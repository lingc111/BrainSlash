import type { GameplayConfig } from '../configs/GameConfig';
import type { QuestionCompileDirective } from './QuestionPolicy';
import type { QuestionTemplate } from './QuestionTemplateCatalog';
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
    type TriviaFact,
} from './ContentCatalog';
import {
    HANZI_ANTONYM_FACTS,
    HANZI_SYNONYM_FACTS,
    type HanziRelationFact,
    type HanziRelationKind,
} from './HanziRelationCatalog';
import { PINYIN_FACTS, POETRY_FACTS } from './HanziExpansionCatalog';
import {
    KNOWLEDGE_CIVIC_FACTS,
    KNOWLEDGE_CULTURE_EXPANSION,
    KNOWLEDGE_NATURE_EXPANSION,
    KNOWLEDGE_SCIENCE_EXPANSION,
} from './KnowledgeExpansionCatalog';
import { validateQuestion } from './FairnessValidator';
import { reviewedFactIdForRecord } from './QuestionBankRegistry';
import type { GameEntryParams, QuestionInstance, RuleId, TargetSpec, ThemeId } from './Models';
import { evaluateRules, rulesForReadableTargets } from './Rules';
import { SeededRng } from './SeededRng';
import { EXPANSION_ORDER_PACKS, EXPANSION_TRIVIA_PACKS, type OrderedFact } from './ThemeExpansionCatalog';
import { ENGLISH_EXTRA_WORDS } from './EnglishVocabularyExpansion';
import { MVP_QUESTIONS_BY_TEMPLATE, type MvpChoiceQuestion } from './MvpQuestionInventory';

type Stage = 0 | 1 | 2;
export interface QuestionCompilerEngineOptions {
    recentFactIds?: readonly string[];
    recentSemanticSignatures?: readonly string[];
    onQuestionAccepted?: (factIds: readonly string[], semanticSignature: string) => void;
}

/** Shared challenges must depend only on their seed and configuration, never local play history. */
export function compilerOptionsForEntry(
    entry: Pick<GameEntryParams, 'mode'>,
    options: QuestionCompilerEngineOptions,
): QuestionCompilerEngineOptions {
    return entry.mode === 'friendChallenge' ? {} : options;
}
const COLOR_WORDS = ['红', '蓝', '绿', '黄'] as const;
// U+2190–U+2193 are plain text arrows. Do not replace them with emoji-style
// arrows such as ⬅️/⬆️/➡️/⬇️ or append the emoji variation selector U+FE0F.
const ARROWS = ['←', '↑', '→', '↓'] as const;
const OPPOSITE_ARROW: Readonly<Record<string, string>> = { '←': '→', '→': '←', '↑': '↓', '↓': '↑' };
const ENGLISH_CONTENT_WORDS = [...ENGLISH_WORDS, ...ENGLISH_EXTRA_WORDS] as const;

/** @internal Concrete template algorithms. Only QuestionCompiler may call this class. */
export class QuestionCompilerEngine {
    private index = 0;
    private directive!: QuestionCompileDirective;
    private readonly factBags = new Map<string, number[]>();
    private readonly recentQuestionFacts: string[][] = [];
    private readonly recentSemanticSignatures: string[] = [];
    private readonly recentAnswerSignatures: string[] = [];
    private propertyDivisorBag: number[] = [];
    private pendingPropertyDivisor?: number;
    private readonly crossSessionFactIds = new Set<string>();
    private readonly crossSessionFactRanks = new Map<string, number>();
    private readonly crossSessionSemanticSignatures = new Set<string>();
    private factRank = 0;
    private activeFactIds: string[] = [];
    private activeFactPoolExhausted = false;

    private get difficultyIndex(): number { return this.directive.difficulty - 1; }

    public constructor(
        private readonly rng: SeededRng,
        _config: GameplayConfig,
        private readonly options: QuestionCompilerEngineOptions = {},
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

    public compile(directive: QuestionCompileDirective): QuestionInstance {
        this.directive = directive;
        for (let attempt = 0; attempt < 24; attempt++) {
            this.activeFactIds = [];
            this.activeFactPoolExhausted = false;
            const question = this.generate(directive.template, directive.difficultyStage);
            const recentFacts = new Set(this.recentQuestionFacts.flat());
            if (this.activeFactIds.some((factId) => recentFacts.has(factId))) continue;
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
                if (question.templateId === 'math-property') this.pendingPropertyDivisor = undefined;
                return question;
            }
        }
        throw new Error(`Template ${directive.template.id} could not produce a legal non-repeating question`);
    }

    private generate(template: QuestionTemplate, stage: Stage): QuestionInstance {
        this.index += 1;
        const inventoryQuestion = this.pickMvpChoice(template.id);
        if (inventoryQuestion) {
            return this.makeChoice(template, inventoryQuestion.prompt, inventoryQuestion.answer,
                inventoryQuestion.wrong, stage);
        }
        switch (template.id) {
            case 'math-add': return this.mathAdd(template, stage);
            case 'math-subtract': return this.mathSubtract(template, stage);
            case 'math-multiply': return this.mathMultiply(template, stage);
            case 'math-property': return this.mathProperty(template, stage);
            case 'math-compare': return this.mathCompare(template, stage);
            case 'math-sequence': return this.mathSequence(template, stage);
            case 'math-missing': return this.mathMissing(template, stage);
            case 'math-equation': return this.mathEquation(template, stage);
            case 'math-divide': return this.mathDivide(template, stage);
            case 'math-mixed': return this.mathMixed(template, stage);
            case 'math-operator': return this.mathOperator(template, stage);
            case 'math-digit-reverse': return this.mathDigitReverse(template, stage);
            case 'math-remainder': return this.mathRemainder(template, stage);
            case 'math-fraction-compare': return this.mathFractionCompare(template, stage);
            case 'vision-direction': return this.visionDirection(template, stage);
            case 'vision-odd': return this.visionOdd(template, stage);
            case 'vision-count': return this.visionCount(template, stage);
            case 'vision-stroop': return this.visionStroop(template, stage);
            case 'vision-pattern': return this.visionPattern(template, stage);
            case 'vision-match': return this.visionMatch(template, stage);
            case 'vision-mirror': return this.visionMirror(template, stage);
            case 'vision-symmetry': return this.visionSymmetry(template, stage);
            case 'vision-grid-position': return this.visionGridPosition(template, stage);
            case 'vision-rotation': return this.visionRotation(template, stage);
            case 'hanzi-fill': return this.hanziFill(template, stage);
            case 'hanzi-order': return this.hanziOrder(template, stage);
            case 'hanzi-antonym': return this.hanziRelation(template, stage, 'antonym');
            case 'hanzi-synonym': return this.hanziRelation(template, stage, 'synonym');
            case 'hanzi-pinyin': return this.hanziPinyin(template, stage);
            case 'hanzi-poetry': return this.hanziPoetry(template, stage);
            case 'hanzi-radical': return this.expansionTrivia(template, stage);
            case 'hanzi-homophone': return this.hanziHomophone(template, stage);
            case 'hanzi-compose': return this.expansionTrivia(template, stage);
            case 'english-meaning': return this.englishMeaning(template, stage);
            case 'english-category': return this.englishCategory(template, stage);
            case 'english-antonym': return this.englishAntonym(template, stage);
            case 'english-length': return this.englishLength(template, stage);
            case 'english-missing-letter': return this.englishMissingLetter(template, stage);
            case 'english-synonym': return this.expansionTrivia(template, stage);
            case 'english-word-order': return this.expansionOrder(template, stage);
            case 'life-category': return this.lifeCategory(template, stage);
            case 'life-use': return this.lifeUse(template, stage);
            case 'life-place': return this.expansionTrivia(template, stage);
            case 'life-public-sign': return this.expansionTrivia(template, stage);
            case 'life-safe-behavior': return this.expansionTrivia(template, stage);
            case 'life-process': return this.expansionOrder(template, stage);
            case 'geography-capital': return this.geographyCapital(template, stage);
            case 'geography-country': return this.geographyCountry(template, stage);
            case 'geography-continent': return this.expansionTrivia(template, stage);
            case 'geography-landmark': return this.expansionTrivia(template, stage);
            case 'geography-province-capital': return this.expansionTrivia(template, stage);
            case 'geography-relative-position': return this.expansionTrivia(template, stage);
            case 'knowledge-science': return this.trivia(template, stage, 'knowledge-science', [...KNOWLEDGE_SCIENCE_FACTS, ...KNOWLEDGE_SCIENCE_EXPANSION]);
            case 'knowledge-nature': return this.trivia(template, stage, 'knowledge-nature', [...KNOWLEDGE_NATURE_FACTS, ...KNOWLEDGE_NATURE_EXPANSION]);
            case 'knowledge-culture': return this.trivia(template, stage, 'knowledge-culture', [...KNOWLEDGE_CULTURE_FACTS, ...KNOWLEDGE_CULTURE_EXPANSION]);
            case 'knowledge-civic': return this.trivia(template, stage, 'knowledge-civic', KNOWLEDGE_CIVIC_FACTS);
            case 'knowledge-astronomy': return this.expansionTrivia(template, stage);
            case 'knowledge-biology': return this.expansionTrivia(template, stage);
            case 'knowledge-physics': return this.expansionTrivia(template, stage);
            case 'knowledge-technology': return this.expansionTrivia(template, stage);
            case 'history-modern-opening': return this.trivia(template, stage, 'history-modern-opening', [...HISTORY_MODERN_OPENING_FACTS, ...EXPANSION_TRIVIA_PACKS['history-modern-opening']!]);
            case 'history-modern-awakening': return this.trivia(template, stage, 'history-modern-awakening', [...HISTORY_MODERN_AWAKENING_FACTS, ...EXPANSION_TRIVIA_PACKS['history-modern-awakening']!]);
            case 'history-modern-resistance': return this.trivia(template, stage, 'history-modern-resistance', [...HISTORY_MODERN_RESISTANCE_FACTS, ...EXPANSION_TRIVIA_PACKS['history-modern-resistance']!]);
            case 'history-ancient': return this.trivia(template, stage, 'history-ancient', [...HISTORY_ANCIENT_FACTS, ...EXPANSION_TRIVIA_PACKS['history-ancient']!]);
            case 'history-myth': return this.trivia(template, stage, 'history-myth', [...HISTORY_MYTH_FACTS, ...EXPANSION_TRIVIA_PACKS['history-myth']!]);
            case 'history-chronology': return this.expansionOrder(template, stage);
            case 'history-person-event': return this.expansionTrivia(template, stage);
            default: throw new Error(`Unknown question template: ${String(template.id)}`);
        }
    }

    private make(
        template: QuestionTemplate,
        prompt: string,
        targets: TargetSpec[],
        correct: string[],
        _rules: RuleId[],
        _stage: Stage,
        orderedTargetIds?: string[],
    ): QuestionInstance {
        const activeRules = [...this.directive.rules];
        return {
            id: `${template.id}-${this.index}`,
            templateId: template.id,
            engineId: template.engine,
            contentVersion: this.directive.contentVersion,
            theme: template.theme,
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
        template: QuestionTemplate,
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
        return this.make(template, prompt, targets, [`t${answerIndex}`], rules, stage);
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

    private mathAdd(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const minimum = 100 + this.difficultyIndex * 120;
        const ceiling = minimum + 179 + stage * 40;
        const a = this.rng.int(minimum, ceiling);
        const b = this.rng.int(minimum, ceiling);
        const c = this.difficultyIndex >= 3 && stage === 2 ? this.rng.int(20, 99) : 0;
        const answer = a + b + c;
        const prompt = c ? `${a}+${b}+${c}=?` : `${a}+${b}=?`;
        return this.makeChoice(template, prompt, answer, [answer - 2, answer - 1, answer + 1, answer + 2, answer + 10], stage);
    }

    private mathSubtract(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const minimum = 100 + this.difficultyIndex * 80;
        const b = this.rng.int(minimum, minimum + 149 + stage * 30);
        const answer = this.rng.int(100, 249 + this.difficultyIndex * 60 + stage * 30);
        const a = answer + b;
        return this.makeChoice(template, `${a}-${b}=?`, answer, [answer - 2, answer - 1, answer + 1, answer + 2, answer + 5], stage);
    }

    private mathMultiply(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const minimum = 10 + this.difficultyIndex * 2;
        const maximum = Math.min(99, 35 + this.difficultyIndex * 7 + stage * 4);
        let a: number;
        let b: number;
        do {
            a = this.rng.int(minimum, maximum);
            b = this.rng.int(minimum, maximum);
        } while (a * b > 999);
        const answer = a * b;
        return this.makeChoice(template, `${a}×${b}=?`, answer,
            [answer - a, answer - 2, answer - 1, answer + 1, answer + 2, answer + a]
                .filter((value) => value >= 10 && value <= 999), stage);
    }

    private mathProperty(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const count = this.nonBombTargetCount();
        const max = 30 + this.difficultyIndex * 20 + stage * 60;
        const values = this.uniqueNumbers(count, 2, max);
        let predicate: (value: number) => boolean;
        let prompt: string;
        const useMultiple = this.difficultyIndex === 2 || (this.difficultyIndex > 0 && this.rng.next() < 0.5);
        if (this.difficultyIndex === 0) { predicate = (value) => value % 2 === 0; prompt = '偶数'; }
        else if (useMultiple) {
            if (!this.propertyDivisorBag.length) this.propertyDivisorBag = this.rng.shuffle([2, 3, 5, 7]);
            const divisor = this.pendingPropertyDivisor ?? (this.pendingPropertyDivisor = this.propertyDivisorBag.pop()!);
            predicate = (value) => value % divisor === 0;
            prompt = `${divisor}的倍数`;
        }
        else if (this.difficultyIndex === 1) { predicate = (value) => value % 2 !== 0; prompt = '奇数'; }
        else {
            const threshold = Math.max(10, Math.round(max * 0.5 / 5) * 5);
            predicate = this.difficultyIndex === 3 ? (value) => value > threshold : (value) => value < threshold;
            prompt = this.difficultyIndex === 3 ? `大于${threshold}` : `小于${threshold}`;
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
        return this.make(template, prompt, targets, correct, rules, stage);
    }

    private mathCompare(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const count = this.nonBombTargetCount();
        const values = this.uniqueNumbers(count, 5, 50 + this.difficultyIndex * 25 + stage * 80);
        const largest = this.difficultyIndex % 2 === 0;
        const answer = largest ? Math.max(...values) : Math.min(...values);
        return this.makeChoice(template, largest ? '最大的' : '最小的', answer, values, stage);
    }

    private mathSequence(template: QuestionTemplate, stage: Stage): QuestionInstance {
        if (this.directive.rules.includes('order')) {
            const descending = this.rng.next() < 0.5;
            const expressions = !this.directive.rules.includes('rotate') && this.rng.next() < 0.65;
            const values = this.uniqueNumbers(this.nonBombTargetCount(), 100, 399 + this.difficultyIndex * 100 + stage * 100);
            const source = values.map((value, sourceIndex) => ({
                value,
                text: expressions ? this.orderExpression(value, sourceIndex) : String(value),
            }));
            const targets: TargetSpec[] = this.rng.shuffle(source)
                .map((item, index) => ({ id: `o${index}`, text: item.text, value: item.value }));
            const direction = descending ? -1 : 1;
            const ordered = [...targets].sort((a, b) => direction * (Number(a.value) - Number(b.value))).map((target) => target.id);
            this.appendBomb(targets);
            const prompt = expressions
                ? `按结果${descending ? '降序' : '升序'}`
                : `数字${descending ? '降序' : '升序'}`;
            return this.make(template, prompt, targets, ordered, ['order'], stage, ordered);
        }
        const step = 11 + this.difficultyIndex * 3 + stage * 5;
        const start = this.rng.int(100, 399 + stage * 100);
        const answer = start + step * 3;
        return this.makeChoice(template, `${start},${start + step},${start + step * 2},?`, answer, [answer - step, answer + step, answer + 1, answer - 1, answer + step * 2], stage);
    }

    private pickMvpChoice(templateId: QuestionTemplate['id']): MvpChoiceQuestion | undefined {
        const rules = this.directive.rules;
        if (rules.includes('multi') || rules.includes('order') || rules.includes('rotate')) return undefined;
        const all = MVP_QUESTIONS_BY_TEMPLATE.get(templateId);
        if (!all?.length) return undefined;
        const pool = all.filter((question) => question.difficulty === undefined
            || question.difficulty === this.directive.difficulty);
        if (!pool.length) return undefined;
        return this.pickFact(`mvp-${templateId}-d${this.directive.difficulty}`, pool, (question) => question.id);
    }

    private orderExpression(value: number, index: number): string {
        if (index % 2 === 0) {
            const addend = this.rng.int(10, value - 10);
            return `${value - addend}+${addend}`;
        }
        const offset = this.rng.int(10, 99);
        return `${value + offset}-${offset}`;
    }

    private mathMissing(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const minimum = 100 + this.difficultyIndex * 80;
        const ceiling = minimum + 199 + stage * 60;
        if (this.difficultyIndex === 4) {
            const answer = this.rng.int(42, 69 + stage * 10);
            const factor = this.rng.int(34, 59 + stage * 10);
            const product = answer * factor;
            return this.makeChoice(template, `( )×${factor}=${product}`, answer, [answer - 2, answer - 1, answer + 1, answer + 2, factor], stage);
        }
        const left = this.rng.int(minimum, ceiling);
        const right = this.rng.int(minimum, ceiling);
        if (this.difficultyIndex === 0) {
            return this.makeChoice(template, `( )+${right}=${left + right}`, left, [left - 2, left - 1, left + 1, left + 2], stage);
        }
        if (this.difficultyIndex === 1) {
            return this.makeChoice(template, `${left}+( )=${left + right}`, right, [right - 2, right - 1, right + 1, right + 2], stage);
        }
        const result = this.rng.int(100, ceiling);
        const minuend = result + right;
        if (this.difficultyIndex === 2) {
            return this.makeChoice(template, `( )-${right}=${result}`, minuend, [minuend - 2, minuend - 1, minuend + 1, minuend + 2], stage);
        }
        return this.makeChoice(template, `${minuend}-( )=${result}`, right, [right - 2, right - 1, right + 1, right + 2], stage);
    }

    private mathEquation(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const target = this.rng.int(300 + this.difficultyIndex * 120, 599 + this.difficultyIndex * 140 + stage * 80);
        if (this.difficultyIndex % 2 === 0) {
            const left = this.rng.int(100, target - 100);
            const right = target - left;
            const answer = `${left}+${right}`;
            const candidates = [
                `${left}+${right + 1}`,
                `${left + 1}+${right + 1}`,
                `${left}+${right - 1}`,
                `${left + 2}+${right + 1}`,
                `${left + 1}+${right - 2}`,
            ];
            return this.makeChoice(template, `等于 ${target}`, answer, candidates, stage);
        }
        const subtrahend = this.rng.int(100, 249 + this.difficultyIndex * 40 + stage * 30);
        const minuend = target + subtrahend;
        const answer = `${minuend}-${subtrahend}`;
        const candidates = [
            `${minuend + 1}-${subtrahend}`,
            `${minuend}-${subtrahend + 1}`,
            `${minuend + 2}-${subtrahend}`,
            `${minuend}-${subtrahend + 2}`,
            `${minuend + 3}-${subtrahend + 1}`,
        ];
        return this.makeChoice(template, `等于 ${target}`, answer, candidates, stage);
    }

    private visionDirection(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const shown = this.rng.pick(ARROWS);
        const opposite = this.difficultyIndex >= 3 && stage > 0;
        const answer = opposite ? OPPOSITE_ARROW[shown] : shown;
        return this.makeChoice(template, opposite ? `${shown} 的反向` : shown, answer, ARROWS, stage, { allowBomb: false });
    }

    private visionOdd(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const pairs: readonly (readonly [string, string])[] = [['●', '○'], ['▲', '△'], ['■', '□'], ['◆', '◇'], ['★', '☆']];
        const [base, odd] = pairs[this.difficultyIndex];
        const count = this.nonBombTargetCount();
        const oddIndex = this.rng.int(0, count - 1);
        const targets: TargetSpec[] = Array.from({ length: count }, (_, index) => ({ id: `v${index}`, text: index === oddIndex ? odd : base, value: index }));
        this.appendBomb(targets);
        return this.make(template, '不同的', targets, [`v${oddIndex}`], ['standard'], stage);
    }

    private visionCount(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const symbols = ['●', '▲', '■', '◆', '★'];
        const symbol = symbols[this.difficultyIndex];
        const answerCount = this.rng.int(2, 4 + stage);
        const values = this.includeAnswer(answerCount, [1, 2, 3, 4, 5, 6], this.nonBombTargetCount());
        const targets: TargetSpec[] = values.map((value, index) => ({ id: `c${index}`, text: symbol.repeat(value), value }));
        this.appendBomb(targets);
        return this.make(template, `${answerCount}个`, targets, [targets.find((target) => target.value === answerCount)!.id], ['standard'], stage);
    }

    private visionStroop(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const wanted = COLOR_WORDS[this.difficultyIndex % COLOR_WORDS.length];
        const colors = this.includeAnswer(wanted, COLOR_WORDS, this.nonBombTargetCount());
        const targets: TargetSpec[] = colors.map((color, index) => ({
            id: `s${index}`,
            text: COLOR_WORDS[(COLOR_WORDS.indexOf(color) + 1 + this.difficultyIndex % 3) % COLOR_WORDS.length],
            colorName: color,
            value: color,
        }));
        this.appendBomb(targets);
        return this.make(template, `字体颜色·${wanted}`, targets, [targets.find((target) => target.value === wanted)!.id], this.directive.rules, stage);
    }

    private visionPattern(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const symbols = ['○', '△', '□', '◇', '☆', '●', '▲', '■', '◆', '★'];
        if (this.difficultyIndex === 0) {
            const first = this.rng.pick(symbols);
            const second = this.rng.pick(symbols.filter((symbol) => symbol !== first));
            return this.makeChoice(template, `${first}${second}${first}${second}?`, first, symbols, stage, { allowBomb: false });
        }
        if (this.difficultyIndex === 1) {
            const start = this.rng.int(0, ARROWS.length - 1);
            const step = this.rng.next() < 0.5 ? 1 : -1;
            const sequence = Array.from({ length: 4 }, (_, index) => ARROWS[(start + index * step + ARROWS.length * 2) % ARROWS.length]);
            return this.makeChoice(template, `${sequence[0]}${sequence[1]}${sequence[2]}?`, sequence[3], [...ARROWS, '↗'], stage, { allowBomb: false });
        }
        if (this.difficultyIndex === 2) {
            const first = this.rng.pick(symbols);
            const second = this.rng.pick(symbols.filter((symbol) => symbol !== first));
            const run = this.rng.int(1, 3);
            const block = `${first}${second.repeat(run)}`;
            return this.makeChoice(template, `${block}${block}?`, first, symbols, stage, { allowBomb: false });
        }
        if (this.difficultyIndex === 3) {
            const first = this.rng.int(0, 9);
            let second = this.rng.int(0, 9);
            if (second === first) second = (second + 1) % 10;
            return this.makeChoice(template, `${first},${second},${first},${second},?`, first, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], stage, { allowBomb: false });
        }
        const sizes = ['小', '中', '大'] as const;
        const start = this.rng.int(0, sizes.length - 1);
        const step = this.rng.next() < 0.5 ? 1 : -1;
        const sequence = Array.from({ length: 6 }, (_, index) => sizes[(start + index * step + sizes.length * 3) % sizes.length]);
        return this.makeChoice(template, `${sequence.slice(0, 5).join('')}?`, sequence[5], ['小', '中', '大', '特大'], stage, { allowBomb: false });
    }

    private visionMatch(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const symbolSets: readonly (readonly string[])[] = [
            ['●', '○', '▲', '△'],
            ['■', '□', '◆', '◇'],
            ['★', '☆', '●', '○'],
            ['▲', '△', '◆', '◇'],
            ['■', '□', '★', '☆'],
        ];
        const symbols = symbolSets[this.difficultyIndex];
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
        return this.makeChoice(template, `找相同 ${answer}`, answer, candidates, stage);
    }

    private visionMirror(template: QuestionTemplate, stage: Stage): QuestionInstance {
        // WeChat renders the diagonal U+2196–U+2199 characters as blue-square
        // emoji on some devices. Repeated horizontal text arrows preserve the
        // mirror task without depending on those platform glyphs.
        const mirrors: Readonly<Record<string, string>> = {
            '←': '→', '→': '←', '←←': '→→', '→→': '←←', '←←←': '→→→', '→→→': '←←←',
        };
        const source = this.rng.pick(Object.keys(mirrors));
        return this.makeChoice(template, `${source}的左右镜像`, mirrors[source], Object.values(mirrors), stage);
    }

    private visionSymmetry(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const answer = this.rng.pick(['◇', '○', '□', '△', '十', '工']);
        return this.makeChoice(template, '选择左右对称的图形', answer, ['▷', '◁', 'Γ', 'F', 'P', 'L'], stage);
    }

    private visionGridPosition(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const size = 3 + Math.min(1, this.difficultyIndex);
        const row = this.rng.int(1, size);
        const column = this.rng.int(1, size);
        const answer = `${row}行${column}列`;
        const grid = Array.from({ length: size }, (_, rowIndex) => Array.from({ length: size }, (_, columnIndex) =>
            rowIndex === row - 1 && columnIndex === column - 1 ? '●' : '○').join('')).join('\n');
        return this.makeChoice(template, `找●位置\n${grid}`, answer,
            [`${column}行${row}列`, `${row === 1 ? size : row - 1}行${column}列`,
                `${row}行${column === 1 ? size : column - 1}列`, `${row === size ? 1 : row + 1}行${column}列`], stage);
    }

    private visionRotation(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const startIndex = this.rng.int(0, ARROWS.length - 1);
        const turns = this.difficultyIndex >= 3 ? 2 : 1;
        const clockwise = this.rng.next() < 0.5;
        const offset = clockwise ? turns : -turns;
        const answer = ARROWS[(startIndex + offset + ARROWS.length) % ARROWS.length];
        return this.makeChoice(template, `${ARROWS[startIndex]}${clockwise ? '顺' : '逆'}时针转${turns * 90}°`, answer, ARROWS, stage);
    }

    private hanziFill(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const entry = this.pickFact('idioms', IDIOMS, reviewedFactIdForRecord);
        const missingIndex = this.rng.next() < 0.5 ? entry.missingIndex : (entry.missingIndex + 1) % entry.text.length;
        const answer = entry.text[missingIndex];
        const prompt = `${entry.text.slice(0, missingIndex)}( )${entry.text.slice(missingIndex + 1)}`;
        return this.makeChoice(template, prompt, answer, [...entry.wrong, ...Array.from(entry.text)], stage);
    }

    private hanziOrder(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const orderable = IDIOMS.filter((entry) => new Set(entry.text).size === 4);
        const entry = this.pickFact('idioms-orderable', orderable, reviewedFactIdForRecord);
        const source = Array.from(entry.text).map((text, originalIndex) => ({ text, originalIndex }));
        const targets: TargetSpec[] = this.rng.shuffle(source).map((item, index) => ({ id: `h${index}`, text: item.text, value: item.originalIndex }));
        const ordered = [...targets].sort((a, b) => Number(a.value) - Number(b.value)).map((target) => target.id);
        this.appendBomb(targets);
        return this.make(template, '排成语', targets, ordered, ['order'], stage, ordered);
    }

    private mathDivide(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const minimum = 10 + this.difficultyIndex * 2;
        const maximum = Math.min(99, 35 + this.difficultyIndex * 7 + stage * 4);
        let divisor: number;
        let answer: number;
        do {
            divisor = this.rng.int(minimum, maximum);
            answer = this.rng.int(minimum, maximum);
        } while (divisor * answer > 999);
        const dividend = divisor * answer;
        return this.makeChoice(template, `${dividend}÷${divisor}=?`, answer,
            [answer - 2, answer - 1, answer + 1, answer + 2, divisor], stage);
    }

    private mathMixed(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const minimum = 10 + this.difficultyIndex * 2;
        const maximum = Math.min(45, 28 + this.difficultyIndex * 3 + stage * 2);
        let multiplier: number;
        let factor: number;
        do {
            multiplier = this.rng.int(minimum, maximum);
            factor = this.rng.int(minimum, maximum);
        } while (multiplier * factor > 900);
        const offset = this.rng.int(20, 79 + this.difficultyIndex * 20 + stage * 20);
        const subtract = multiplier * factor + offset > 999 || (this.rng.next() < 0.5 && multiplier * factor > offset);
        const answer = subtract ? multiplier * factor - offset : multiplier * factor + offset;
        const operator = subtract ? '-' : '+';
        return this.makeChoice(template, `${multiplier}×${factor}${operator}${offset}=?`, answer,
            [answer - multiplier, answer - 2, answer - 1, answer + 1, answer + 2, answer + multiplier]
                .filter((value) => value >= 10 && value <= 999), stage);
    }

    private mathOperator(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const left = this.rng.int(100, 699);
        const right = this.rng.int(100, 299);
        return this.makeChoice(template, `${left}( )${right}=${left + right}`, '+', ['-', '×', '÷'], stage);
    }

    private mathDigitReverse(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const source = this.rng.shuffle(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
            .slice(0, 5 + this.difficultyIndex).join('');
        const answer = Array.from(source).reverse().join('');
        const chars = Array.from(answer);
        const candidates = [0, 1, 2, 3].map((index) => {
            const copy = [...chars];
            [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
            return copy.join('');
        });
        return this.makeChoice(template, `${source}反转后`, answer, candidates, stage);
    }

    private mathRemainder(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const divisor = this.rng.int(4 + this.difficultyIndex * 2, 11 + this.difficultyIndex * 2);
        const remainder = this.rng.int(1, Math.min(9, divisor - 1));
        const quotient = this.rng.int(2, Math.floor((99 - remainder) / divisor));
        const dividend = divisor * quotient + remainder;
        return this.makeChoice(template, `${dividend}÷${divisor}的余数`, remainder,
            Array.from({ length: Math.min(10, divisor) }, (_, value) => value), stage);
    }

    private mathFractionCompare(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const denominator = this.rng.int(4, 8 + this.difficultyIndex + stage);
        const left = this.rng.int(1, denominator - 2);
        const right = this.rng.int(left + 1, denominator - 1);
        const larger = `${right}/${denominator}`;
        return this.makeChoice(template, '选择较大的分数', larger,
            [`${left}/${denominator}`, `${left}/${denominator + 1}`, `${right - 1}/${denominator + 1}`, `${left + 1}/${denominator + 2}`], stage);
    }

    private hanziPinyin(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const fact = this.pickFact('hanzi-pinyin', PINYIN_FACTS, reviewedFactIdForRecord);
        const candidates = PINYIN_FACTS.filter((item) => item.id !== fact.id).map((item) => item.pinyin);
        return this.makeChoice(template, `${fact.character}的拼音`, fact.pinyin, candidates, stage);
    }

    private hanziHomophone(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const fact = this.pickFact('hanzi-homophone', PINYIN_FACTS, reviewedFactIdForRecord);
        const candidates = PINYIN_FACTS.filter((item) => item.id !== fact.id).map((item) => item.homophone);
        return this.makeChoice(template, `${fact.character}读音相近的字`, fact.homophone, candidates, stage);
    }

    private hanziPoetry(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const fact = this.pickFact('hanzi-poetry', POETRY_FACTS, reviewedFactIdForRecord);
        return this.makeChoice(template, fact.prompt, fact.answer, fact.wrong, stage);
    }

    private englishMeaning(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const word = this.pickFact('english-words', ENGLISH_CONTENT_WORDS, reviewedFactIdForRecord);
        const sameCategory = ENGLISH_CONTENT_WORDS.filter((candidate) => candidate.category === word.category && candidate.en !== word.en).map((candidate) => candidate.zh);
        return this.makeChoice(template, `${word.en} 是？`, word.zh, sameCategory, stage);
    }

    private englishCategory(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const categories = ['动物', '颜色', '食物', '动作', '物品'] as const;
        const category = categories[this.difficultyIndex];
        const count = this.nonBombTargetCount();
        const matchingPool = ENGLISH_CONTENT_WORDS.filter((word) => word.category === category);
        const others = this.rng.shuffle(ENGLISH_CONTENT_WORDS.filter((word) => word.category !== category));
        const correctCount = this.isOrdinarySingleSelection()
            ? 1
            : this.directive.rules.includes('multi') || stage > 0 ? 2 : 1;
        const matching = this.pickFacts(`english-category:${category}`, matchingPool, correctCount, reviewedFactIdForRecord);
        const words = this.rng.shuffle([...matching, ...others.slice(0, count - correctCount)]);
        const targets: TargetSpec[] = words.map((word, index) => ({ id: `e${index}`, text: word.en, value: word.category }));
        const correct = targets.filter((target) => target.value === category).map((target) => target.id);
        this.appendBomb(targets);
        return this.make(template, category, targets, correct, this.directive.rules, stage);
    }

    private englishAntonym(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const pair = this.pickFact('english-antonyms', ENGLISH_ANTONYMS, reviewedFactIdForRecord);
        const reversePair = this.rng.next() < 0.5;
        const promptWord = pair[reversePair ? 1 : 0];
        const answer = pair[reversePair ? 0 : 1];
        const antonymWords: string[] = [];
        for (const item of ENGLISH_ANTONYMS) antonymWords.push(item[0], item[1]);
        const candidates = this.rng.shuffle(antonymWords).filter((word) => word !== promptWord);
        return this.makeChoice(template, `${promptWord} 的反义词`, answer, candidates, stage);
    }

    private englishLength(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const word = this.pickFact('english-length', ENGLISH_CONTENT_WORDS, reviewedFactIdForRecord);
        const answer = Array.from(word.en).length;
        return this.makeChoice(template, `${word.en}有几字母`, answer, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], stage);
    }

    private englishMissingLetter(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const word = this.pickFact('english-missing-letter', ENGLISH_CONTENT_WORDS, reviewedFactIdForRecord);
        const index = this.rng.int(0, word.en.length - 1);
        const answer = word.en[index];
        const prompt = `${word.en.slice(0, index)}_${word.en.slice(index + 1)} = ${word.zh}`;
        return this.makeChoice(template, prompt, answer, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), stage);
    }

    private lifeCategory(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const categories = ['清洁工具', '厨房用品', '学习用品', '安全用品', '交通工具'] as const;
        const category = categories[this.difficultyIndex];
        const count = this.nonBombTargetCount();
        const matchingPool = LIFE_CATEGORY_FACTS.filter((fact) => fact.category === category);
        const others = this.rng.shuffle(LIFE_CATEGORY_FACTS.filter((fact) => fact.category !== category));
        const correctCount = this.isOrdinarySingleSelection()
            ? 1
            : this.directive.rules.includes('multi') || stage > 0 ? 2 : 1;
        const matching = this.pickFacts(`life-category:${category}`, matchingPool, correctCount, reviewedFactIdForRecord);
        const facts = this.rng.shuffle([...matching, ...others.slice(0, count - correctCount)]);
        const targets: TargetSpec[] = facts.map((fact, index) => ({ id: `l${index}`, text: fact.item, value: fact.category }));
        const correct = targets.filter((target) => target.value === category).map((target) => target.id);
        this.appendBomb(targets);
        return this.make(template, category, targets, correct, this.directive.rules, stage);
    }

    private lifeUse(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const fact = this.pickFact('life-use', LIFE_CATEGORY_FACTS, reviewedFactIdForRecord);
        const candidates = LIFE_CATEGORY_FACTS.filter((item) => item.item !== fact.item).map((item) => item.use);
        return this.makeChoice(template, `${fact.item}主要用于`, fact.use, candidates, stage);
    }

    private geographyCapital(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const fact = this.pickFact('geography-facts', GEOGRAPHY_FACTS, reviewedFactIdForRecord);
        const candidates = GEOGRAPHY_FACTS.filter((candidate) => candidate.capital !== fact.capital).map((candidate) => candidate.capital);
        return this.makeChoice(template, `${fact.country}首都`, fact.capital, candidates, stage);
    }

    private geographyCountry(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const fact = this.pickFact('geography-facts', GEOGRAPHY_FACTS, reviewedFactIdForRecord);
        const candidates = GEOGRAPHY_FACTS.filter((candidate) => candidate.country !== fact.country).map((candidate) => candidate.country);
        return this.makeChoice(template, `${fact.capital}在哪国`, fact.country, candidates, stage);
    }

    private hanziRelation(
        template: QuestionTemplate,
        stage: Stage,
        kind: HanziRelationKind,
    ): QuestionInstance {
        const pool: readonly HanziRelationFact[] = kind === 'antonym'
            ? HANZI_ANTONYM_FACTS
            : HANZI_SYNONYM_FACTS;
        const fact = this.pickFact(`hanzi-${kind}`, pool, reviewedFactIdForRecord);
        const reversePair = this.rng.next() < 0.5;
        const promptWord = reversePair ? fact.right : fact.left;
        const answer = reversePair ? fact.left : fact.right;
        const distractors = reversePair ? fact.leftDistractors : fact.rightDistractors;
        return this.makeChoice(
            template,
            `${promptWord}的${kind === 'antonym' ? '反义词' : '近义词'}`,
            answer,
            distractors,
            stage,
        );
    }

    private trivia(template: QuestionTemplate, stage: Stage, poolId: string, facts: readonly TriviaFact[]): QuestionInstance {
        const fact = this.pickFact(poolId, facts, reviewedFactIdForRecord);
        return this.makeChoice(template, fact.prompt, fact.answer, fact.wrong, stage);
    }

    private expansionTrivia(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const facts = EXPANSION_TRIVIA_PACKS[template.id];
        if (!facts?.length) throw new Error(`Missing expansion facts for ${template.id}`);
        return this.trivia(template, stage, template.id, facts);
    }

    private expansionOrder(template: QuestionTemplate, stage: Stage): QuestionInstance {
        const facts = EXPANSION_ORDER_PACKS[template.id];
        if (!facts?.length) throw new Error(`Missing ordered facts for ${template.id}`);
        const fact: OrderedFact = this.pickFact(template.id, facts, reviewedFactIdForRecord);
        const source = fact.parts.map((text, originalIndex) => ({ text, originalIndex }));
        const targets: TargetSpec[] = this.rng.shuffle(source).map((item, index) => ({ id: `o${index}`, text: item.text, value: item.originalIndex }));
        const ordered = [...targets].sort((a, b) => Number(a.value) - Number(b.value)).map((target) => target.id);
        this.appendBomb(targets);
        return this.make(template, fact.prompt, targets, ordered, ['order'], stage, ordered);
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
        if (!(this.directive.bombEnabled ?? this.directive.rules.includes('bomb'))) return;
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
        return `${question.theme}|${question.templateId}|${this.normalizePrompt(question.prompt.text)}|${this.answerSignature(question)}`;
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

}
