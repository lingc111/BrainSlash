import type { GameplayConfig } from '../configs/GameConfig';
import {
    CONTENT_FAMILIES,
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
    private readonly familyBags = new Map<Stage, ContentFamilySpec[]>();

    public constructor(private readonly rng: SeededRng, private readonly config: GameplayConfig) {}

    public next(elapsedMs: number, stage: Stage): QuestionInstance {
        for (let attempt = 0; attempt < 8; attempt++) {
            const family = this.nextFamily(stage);
            const question = this.generate(family, elapsedMs, stage);
            if (!validateQuestion(question, evaluateRules(question)).length) return question;
        }
        return this.make(
            { id: 'math-property.safe', theme: 'math', kind: 'math-property', variant: 0 },
            '斩偶数',
            [{ id: 'safe-2', text: '2', value: 2 }, { id: 'safe-3', text: '3', value: 3 }],
            ['safe-2'],
            ['standard'],
            stage,
        );
    }

    private nextFamily(stage: Stage): ContentFamilySpec {
        let bag = this.familyBags.get(stage);
        if (!bag?.length) {
            const eligible = stage === 0
                ? CONTENT_FAMILIES.filter((family) => family.theme === 'math' || family.theme === 'vision')
                : CONTENT_FAMILIES;
            bag = this.rng.shuffle(eligible);
            this.familyBags.set(stage, bag);
        }
        return bag.pop()!;
    }

    private generate(family: ContentFamilySpec, elapsedMs: number, stage: Stage): QuestionInstance {
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
            default: return this.makeChoice(family, '斩偶数', 2, [3, 4, 5, 6], stage);
        }
    }

    private make(
        family: ContentFamilySpec,
        prompt: string,
        targets: TargetSpec[],
        correct: string[],
        rules: RuleId[],
        stage: Stage,
        orderedTargetIds?: string[],
    ): QuestionInstance {
        return {
            id: `${family.id}-${this.index}`,
            familyId: family.id,
            theme: family.theme,
            prompt: { text: rules.includes('reverse') ? `反向·${prompt}` : prompt },
            targets,
            baseCorrectTargetIds: correct,
            orderedTargetIds,
            activeRules: rules,
            timeLimitMs: this.config.questionTimeMs[stage],
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
        const rules = this.choiceRules(family, stage, options);
        const count = Math.max(2, stage + 3 - (rules.includes('bomb') ? 1 : 0));
        const values = this.includeAnswer(answer, candidates, count);
        const targets: TargetSpec[] = values.map((value, index) => ({ id: `t${index}`, text: String(value), value }));
        if (rules.includes('bomb')) targets.push({ id: 'bomb', text: '爆', isBomb: true });
        return this.make(family, prompt, targets, [targets.find((target) => target.value === answer)!.id], rules, stage);
    }

    private choiceRules(
        family: ContentFamilySpec,
        stage: Stage,
        options: { allowReverse?: boolean; allowBomb?: boolean },
    ): RuleId[] {
        if (stage === 0) return ['standard'];
        if (options.allowReverse !== false && family.variant === 4) return ['reverse'];
        if (options.allowBomb !== false && family.variant === 3) return ['bomb'];
        return ['standard'];
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
        const count = stage + 3;
        const max = 30 + family.variant * 20 + stage * 60;
        const values = this.uniqueNumbers(count, 2, max);
        let predicate: (value: number) => boolean;
        let prompt: string;
        if (family.variant === 0) { predicate = (value) => value % 2 === 0; prompt = '斩偶数'; }
        else if (family.variant === 1) { predicate = (value) => value % 2 !== 0; prompt = '斩奇数'; }
        else if (family.variant === 2) { predicate = (value) => value % 3 === 0; prompt = '斩3的倍数'; }
        else {
            const threshold = Math.max(10, Math.round(max * 0.5 / 5) * 5);
            predicate = family.variant === 3 ? (value) => value > threshold : (value) => value < threshold;
            prompt = family.variant === 3 ? `斩大于${threshold}` : `斩小于${threshold}`;
        }
        if (!values.some(predicate)) this.forcePropertyValue(values, 0, predicate, true, max);
        if (values.every(predicate)) this.forcePropertyValue(values, values.length - 1, predicate, false, max);
        const targets = values.map((value, index) => ({ id: `n${index}`, text: String(value), value }));
        const correct = targets.filter((target) => predicate(Number(target.value))).map((target) => target.id);
        const rules: RuleId[] = stage > 0 && correct.length > 1 ? ['multi'] : ['standard'];
        return this.make(family, rules.includes('multi') ? `${prompt}·全部` : prompt, targets, correct, rules, stage);
    }

    private mathCompare(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const count = stage + 3;
        const values = this.uniqueNumbers(count, 5, 50 + family.variant * 25 + stage * 80);
        const largest = family.variant % 2 === 0;
        const answer = largest ? Math.max(...values) : Math.min(...values);
        return this.makeChoice(family, largest ? '斩最大的' : '斩最小的', answer, values, stage);
    }

    private mathSequence(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        if (family.variant >= 3 && stage > 0) {
            const values = this.uniqueNumbers(Math.min(5, stage + 3), 1, 50 + stage * 50);
            const targets = this.rng.shuffle(values).map((value, index) => ({ id: `o${index}`, text: String(value), value }));
            const ordered = [...targets].sort((a, b) => Number(a.value) - Number(b.value)).map((target) => target.id);
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
        return this.makeChoice(family, opposite ? `斩 ${shown} 的反向` : `斩 ${shown}`, answer, ARROWS, stage, { allowBomb: false });
    }

    private visionOdd(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const pairs: readonly (readonly [string, string])[] = [['●', '○'], ['▲', '△'], ['■', '□'], ['◆', '◇'], ['★', '☆']];
        const [base, odd] = pairs[family.variant];
        const count = stage + 3;
        const oddIndex = this.rng.int(0, count - 1);
        const targets = Array.from({ length: count }, (_, index) => ({ id: `v${index}`, text: index === oddIndex ? odd : base, value: index }));
        return this.make(family, '斩不同的', targets, [`v${oddIndex}`], ['standard'], stage);
    }

    private visionCount(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const symbols = ['●', '▲', '■', '◆', '★'];
        const symbol = symbols[family.variant];
        const answerCount = this.rng.int(2, 4 + stage);
        const values = this.includeAnswer(answerCount, [1, 2, 3, 4, 5, 6], stage + 3);
        const targets = values.map((value, index) => ({ id: `c${index}`, text: symbol.repeat(value), value }));
        return this.make(family, `斩${answerCount}个`, targets, [targets.find((target) => target.value === answerCount)!.id], ['standard'], stage);
    }

    private visionStroop(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const wanted = COLOR_WORDS[family.variant % COLOR_WORDS.length];
        if (stage === 0) return this.makeChoice(family, `斩“${wanted}”`, wanted, COLOR_WORDS, stage, { allowBomb: false, allowReverse: false });
        const colors = this.includeAnswer(wanted, COLOR_WORDS, stage + 3);
        const targets = colors.map((color, index) => ({
            id: `s${index}`,
            text: COLOR_WORDS[(index + family.variant + 1) % COLOR_WORDS.length],
            colorName: color,
            value: color,
        }));
        return this.make(family, `斩字体颜色·${wanted}`, targets, [targets.find((target) => target.value === wanted)!.id], ['stroop'], stage);
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
        const entry = this.pickOffset(IDIOMS, family.variant);
        const answer = entry.text[entry.missingIndex];
        const prompt = `${entry.text.slice(0, entry.missingIndex)}□${entry.text.slice(entry.missingIndex + 1)}`;
        return this.makeChoice(family, prompt, answer, entry.wrong, stage);
    }

    private hanziValid(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const entry = this.pickOffset(IDIOMS, family.variant * 3);
        const wrong = entry.wrong.map((char) => `${entry.text.slice(0, entry.missingIndex)}${char}${entry.text.slice(entry.missingIndex + 1)}`);
        return this.makeChoice(family, '斩真成语', entry.text, wrong, stage);
    }

    private hanziOrder(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const orderable = IDIOMS.filter((entry) => new Set(entry.text).size === 4);
        const entry = this.pickOffset(orderable, family.variant * 2);
        const source = [...entry.text].map((text, originalIndex) => ({ text, originalIndex }));
        const targets = this.rng.shuffle(source).map((item, index) => ({ id: `h${index}`, text: item.text, value: item.originalIndex }));
        const ordered = [...targets].sort((a, b) => Number(a.value) - Number(b.value)).map((target) => target.id);
        return this.make(family, '排成语', targets, ordered, ['order'], stage, ordered);
    }

    private englishMeaning(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const word = this.pickOffset(ENGLISH_WORDS, family.variant * 4);
        const sameCategory = ENGLISH_WORDS.filter((candidate) => candidate.category === word.category && candidate.en !== word.en).map((candidate) => candidate.zh);
        return this.makeChoice(family, `${word.en} 是？`, word.zh, sameCategory, stage);
    }

    private englishCategory(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const categories = ['动物', '颜色', '食物', '动作', '物品'] as const;
        const category = categories[family.variant];
        const count = stage + 3;
        const matching = this.rng.shuffle(ENGLISH_WORDS.filter((word) => word.category === category));
        const others = this.rng.shuffle(ENGLISH_WORDS.filter((word) => word.category !== category));
        const correctCount = stage > 0 ? 2 : 1;
        const words = this.rng.shuffle([...matching.slice(0, correctCount), ...others.slice(0, count - correctCount)]);
        const targets = words.map((word, index) => ({ id: `e${index}`, text: word.en, value: word.category }));
        const correct = targets.filter((target) => target.value === category).map((target) => target.id);
        return this.make(family, stage > 0 ? `斩全部${category}` : `斩${category}`, targets, correct, stage > 0 ? ['multi'] : ['standard'], stage);
    }

    private englishAntonym(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const pair = this.pickOffset(ENGLISH_ANTONYMS, family.variant * 2);
        const reversePair = this.rng.next() < 0.5;
        const promptWord = pair[reversePair ? 1 : 0];
        const answer = pair[reversePair ? 0 : 1];
        const antonymWords: string[] = [];
        for (const item of ENGLISH_ANTONYMS) antonymWords.push(item[0], item[1]);
        const candidates = this.rng.shuffle(antonymWords).filter((word) => word !== promptWord);
        return this.makeChoice(family, `${promptWord} 的反义词`, answer, candidates, stage);
    }

    private lifeUse(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const fact = this.pickOffset(LIFE_FACTS, family.variant * 3);
        const candidates = LIFE_FACTS.filter((candidate) => candidate.item !== fact.item).map((candidate) => candidate.item);
        return this.makeChoice(family, fact.use, fact.item, candidates, stage);
    }

    private lifeCategory(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const categories = ['清洁工具', '厨房用品', '学习用品', '安全用品', '交通工具'] as const;
        const category = categories[family.variant];
        const count = stage + 3;
        const matching = this.rng.shuffle(LIFE_FACTS.filter((fact) => fact.category === category));
        const others = this.rng.shuffle(LIFE_FACTS.filter((fact) => fact.category !== category));
        const correctCount = stage > 0 ? 2 : 1;
        const facts = this.rng.shuffle([...matching.slice(0, correctCount), ...others.slice(0, count - correctCount)]);
        const targets = facts.map((fact, index) => ({ id: `l${index}`, text: fact.item, value: fact.category }));
        const correct = targets.filter((target) => target.value === category).map((target) => target.id);
        return this.make(family, stage > 0 ? `斩全部${category}` : `斩${category}`, targets, correct, stage > 0 ? ['multi'] : ['standard'], stage);
    }

    private geographyCapital(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const fact = this.pickOffset(GEOGRAPHY_FACTS, family.variant * 3);
        const candidates = GEOGRAPHY_FACTS.filter((candidate) => candidate.capital !== fact.capital).map((candidate) => candidate.capital);
        return this.makeChoice(family, `${fact.country}首都`, fact.capital, candidates, stage);
    }

    private geographyCountry(family: ContentFamilySpec, stage: Stage): QuestionInstance {
        const fact = this.pickOffset(GEOGRAPHY_FACTS, family.variant * 4 + 1);
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

    private pickOffset<T>(items: readonly T[], offset: number): T {
        return items[(this.rng.int(0, items.length - 1) + offset) % items.length];
    }
}
