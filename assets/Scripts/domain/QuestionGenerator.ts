import type { GameplayConfig } from '../configs/GameConfig';
import type { BrawlQuestionDirective } from './Brawl60Director';
import {
    ENGLISH_ANTONYMS,
    ENGLISH_WORDS,
    GEOGRAPHY_FACTS,
    IDIOMS,
    LIFE_FACTS,
    type ContentFamilySpec,
} from './ContentCatalog';
import { validateQuestion } from './FairnessValidator';
import type { QuestionInstance, RuleId, TargetSpec, ThemeId } from './Models';
import { evaluateRules } from './Rules';
import { SeededRng } from './SeededRng';

type Stage = 0 | 1 | 2;
const COLOR_WORDS = ['红', '蓝', '绿', '黄'] as const;
const ARROWS = ['←', '↑', '→', '↓'] as const;
const OPPOSITE_ARROW: Readonly<Record<string, string>> = { '←': '→', '→': '←', '↑': '↓', '↓': '↑' };

export class QuestionGenerator {
    private index = 0;
    private directive!: BrawlQuestionDirective;
    private readonly factBags = new Map<string, number[]>();
    private readonly recentQuestionFacts: string[][] = [];
    private activeFactIds: string[] = [];

    public constructor(private readonly rng: SeededRng, _config: GameplayConfig) {}

    public next(directive: BrawlQuestionDirective): QuestionInstance {
        this.directive = directive;
        for (let attempt = 0; attempt < 8; attempt++) {
            this.activeFactIds = [];
            const question = this.generate(directive.family, directive.difficultyStage);
            if (!validateQuestion(question, evaluateRules(question)).length) {
                this.recordQuestionFacts();
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
            tutorialSafe: directive.difficultyStage === 0,
        };
    }

    private generate(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        this.index += 1;
        switch (family.kind) {
            case 'math-add': return this.mathAdd(family, stage);
            case 'math-subtract': return this.mathSubtract(family, stage);
            case 'math-multiply': return this.mathMultiply(family, stage);
            case 'math-property': return this.mathProperty(family, stage);
            case 'math-compare': return this.mathCompare(family, stage);
            case 'math-sequence': return this.mathSequence(family, stage);
            case 'vision-direction': return this.visionDirection(family, stage);
            case 'vision-odd': return this.visionOdd(family, stage);
            case 'vision-count': return this.visionCount(family, stage);
            case 'vision-stroop': return this.visionStroop(family, stage);
            case 'vision-pattern': return this.visionPattern(family, stage);
            case 'hanzi-fill': return this.hanziFill(family, stage);
            case 'hanzi-valid': return this.hanziValid(family, stage);
            case 'hanzi-order': return this.hanziOrder(family, stage);
            case 'english-meaning': return this.englishMeaning(family, stage);
            case 'english-category': return this.englishCategory(family, stage);
            case 'english-antonym': return this.englishAntonym(family, stage);
            case 'life-use': return this.lifeUse(family, stage);
            case 'life-category': return this.lifeCategory(family, stage);
            case 'geography-capital': return this.geographyCapital(family, stage);
            case 'geography-country': return this.geographyCountry(family, stage);
            default: return this.makeChoice(family, '偶数', 2, [3, 4, 5, 6], stage);
        }
    }

    private make(
        family: ContentFamilySpec,
        prompt: string,
        targets: TargetSpec[],
        correct: string[],
        _rules: RuleId[],
        stage: Stage,
        orderedTargetIds?: string[],
    ): QuestionInstance {
        const activeRules = [...this.directive.rules];
        return {
            id: `${family.id}-${this.index}`,
            familyId: family.id,
            theme: family.theme,
            factIds: [...this.activeFactIds],
            prompt: { text: prompt },
            targets,
            baseCorrectTargetIds: correct,
            orderedTargetIds,
            activeRules,
            timeLimitMs: this.directive.questionTimeMs,
            tutorialSafe: stage === 0,
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
        if (stage === 0) return this.makeChoice(family, `“${wanted}”`, wanted, COLOR_WORDS, stage, { allowBomb: false, allowReverse: false });
        const colors = this.includeAnswer(wanted, COLOR_WORDS, this.nonBombTargetCount());
        const targets: TargetSpec[] = colors.map((color, index) => ({
            id: `s${index}`,
            text: COLOR_WORDS[(index + family.variant + 1) % COLOR_WORDS.length],
            colorName: color,
            value: color,
        }));
        this.appendBomb(targets);
        return this.make(family, `字体颜色·${wanted}`, targets, [targets.find((target) => target.value === wanted)!.id], ['stroop'], stage);
    }

    private visionPattern(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const patterns = [
            { prompt: '○△○△?', answer: '○', wrong: ['△', '□', '◇', '☆'] },
            { prompt: '↑→↓?', answer: '←', wrong: ['↑', '→', '↓', '↗'] },
            { prompt: '■□□■□□?', answer: '■', wrong: ['□', '●', '▲', '◆'] },
            { prompt: '1,2,1,2,?', answer: '1', wrong: ['2', '3', '0', '4'] },
            { prompt: '小中大·小中?', answer: '大', wrong: ['小', '中', '特大', '相同'] },
        ];
        const pattern = patterns[family.variant];
        return this.makeChoice(family, pattern.prompt, pattern.answer, pattern.wrong, stage, { allowBomb: false });
    }

    private hanziFill(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const entry = this.pickFact('idioms', IDIOMS, (item) => `idiom:${item.text}`);
        const answer = entry.text[entry.missingIndex];
        const prompt = `${entry.text.slice(0, entry.missingIndex)}□${entry.text.slice(entry.missingIndex + 1)}`;
        return this.makeChoice(family, prompt, answer, entry.wrong, stage);
    }

    private hanziValid(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const entry = this.pickFact('idioms', IDIOMS, (item) => `idiom:${item.text}`);
        const wrong = entry.wrong.map((char) => `${entry.text.slice(0, entry.missingIndex)}${char}${entry.text.slice(entry.missingIndex + 1)}`);
        return this.makeChoice(family, '真成语', entry.text, wrong, stage);
    }

    private hanziOrder(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const orderable = IDIOMS.filter((entry) => new Set(entry.text).size === 4);
        const entry = this.pickFact('idioms-orderable', orderable, (item) => `idiom:${item.text}`);
        const source = [...entry.text].map((text, originalIndex) => ({ text, originalIndex }));
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
        const correctCount = this.directive.rules.includes('multi') || stage > 0 ? 2 : 1;
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

    private lifeUse(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const fact = this.pickFact('life-facts', LIFE_FACTS, (item) => `life:${item.item}`);
        const candidates = LIFE_FACTS.filter((candidate) => candidate.item !== fact.item).map((candidate) => candidate.item);
        return this.makeChoice(family, fact.use, fact.item, candidates, stage);
    }

    private lifeCategory(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const categories = ['清洁工具', '厨房用品', '学习用品', '安全用品', '交通工具'] as const;
        const category = categories[family.variant];
        const count = this.nonBombTargetCount();
        const matchingPool = LIFE_FACTS.filter((fact) => fact.category === category);
        const others = this.rng.shuffle(LIFE_FACTS.filter((fact) => fact.category !== category));
        const correctCount = this.directive.rules.includes('multi') || stage > 0 ? 2 : 1;
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

    private uniqueNumbers(count: number, min: number, max: number): number[] {
        const values = new Set<number>();
        while (values.size < count) values.add(this.rng.int(min, max));
        return [...values];
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

    private appendBomb(targets: TargetSpec[]): void {
        if (!this.directive.rules.includes('bomb')) return;
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
        const recent = new Set(this.recentQuestionFacts.flat());
        let bagIndex = bag.length - 1;
        while (bagIndex >= 0) {
            const factId = idOf(items[bag[bagIndex]]);
            if (!recent.has(factId) && !this.activeFactIds.includes(factId)) break;
            bagIndex--;
        }
        if (bagIndex < 0) {
            bag = this.rng.shuffle(items.map((_, index) => index));
            this.factBags.set(key, bag);
            bagIndex = bag.findIndex((index) => !recent.has(idOf(items[index])) && !this.activeFactIds.includes(idOf(items[index])));
            if (bagIndex < 0) bagIndex = bag.findIndex((index) => !this.activeFactIds.includes(idOf(items[index])));
            if (bagIndex < 0) bagIndex = 0;
        }
        const item = items[bag.splice(bagIndex, 1)[0]];
        const factId = idOf(item);
        if (!this.activeFactIds.includes(factId)) this.activeFactIds.push(factId);
        return item;
    }

    private recordQuestionFacts(): void {
        this.recentQuestionFacts.push([...this.activeFactIds]);
        if (this.recentQuestionFacts.length > 20) this.recentQuestionFacts.shift();
    }
}
