import { QUESTION_BANK_PACKS, type ReviewedFactRecord } from './QuestionBankRegistry';
import type { ThemeId } from './Models';
import type { QuestionTemplateId } from './QuestionTemplateCatalog';

export interface MvpChoiceQuestion {
    id: string;
    theme: ThemeId;
    templateId: QuestionTemplateId;
    prompt: string;
    answer: string | number;
    wrong: readonly (string | number)[];
    sourceFactId?: string;
    difficulty?: 1 | 2 | 3 | 4 | 5;
    verified: true;
}

export const MVP_THEME_TARGETS: Readonly<Record<ThemeId, number>> = {
    math: 2800, vision: 600, hanzi: 1200, english: 1600,
    life: 900, geography: 900, knowledge: 1200, history: 800,
};

const PROMPT_STYLES = [
    (prompt: string) => prompt,
    (prompt: string) => `请选择：${prompt}`,
    (prompt: string) => `${prompt}，正确的是`,
    (prompt: string) => `快速作答：${prompt}`,
    (prompt: string) => `知识配对：${prompt}`,
    (prompt: string) => `根据常识：${prompt}`,
    (prompt: string) => `判断对应：${prompt}`,
    (prompt: string) => `完成题目：${prompt}`,
] as const;

type Seed = Omit<MvpChoiceQuestion, 'id' | 'verified'>;

function uniqueWrong(answer: string | number, values: readonly (string | number)[]): (string | number)[] {
    const seen = new Set([String(answer)]);
    return values.filter((value) => {
        const key = String(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 5);
}

function recordChoice(record: ReviewedFactRecord, templateId: QuestionTemplateId): Seed | undefined {
    const { prompt, answer, wrong } = record.fields;
    if (typeof prompt !== 'string' || (typeof answer !== 'string' && typeof answer !== 'number') || !Array.isArray(wrong)) return undefined;
    const choices = uniqueWrong(answer, wrong.filter((item): item is string | number => typeof item === 'string' || typeof item === 'number'));
    if (choices.length < 3) return undefined;
    return { theme: record.tags[0] as ThemeId, templateId, prompt, answer, wrong: choices, sourceFactId: record.id };
}

function poolsFor(kind: string, key: string): string[] {
    return QUESTION_BANK_PACKS.filter((pack) => pack.id.startsWith(kind))
        .flatMap((pack) => pack.records.map((record) => record.fields[key]).filter((value): value is string => typeof value === 'string'));
}

function reviewedSeeds(theme: ThemeId): Seed[] {
    const seeds: Seed[] = [];
    const characterPool = poolsFor('hanzi.pinyin', 'character');
    const pinyinPool = poolsFor('hanzi.pinyin', 'pinyin');
    const homophonePool = poolsFor('hanzi.pinyin', 'homophone');
    const englishPool = poolsFor('english.words', 'en');
    const meaningPool = poolsFor('english.words', 'zh');
    const categoryPool = Array.from(new Set([
        ...poolsFor('english.words', 'category'), ...poolsFor('life.categories', 'category'),
    ]));
    const usePool = poolsFor('life.categories', 'use');
    const itemPool = poolsFor('life.categories', 'item');
    const countryPool = poolsFor('geography.world', 'country');
    const capitalPool = poolsFor('geography.world', 'capital');

    for (const pack of QUESTION_BANK_PACKS.filter((item) => item.theme === theme)) {
        for (const record of pack.records) {
            const fields = record.fields;
            const choiceTemplate = pack.templateIds.find((id) => !id.includes('order'));
            if (choiceTemplate) {
                const direct = recordChoice(record, choiceTemplate);
                if (direct) seeds.push(direct);
            }
            if (pack.id === 'hanzi.idioms' && typeof fields.text === 'string' && Array.from(fields.text).length === 4) {
                const text = Array.from(fields.text);
                const suppliedWrong = Array.isArray(fields.wrong) ? fields.wrong.filter((item): item is string => typeof item === 'string') : [];
                text.forEach((answer, index) => seeds.push({ theme, templateId: 'hanzi-fill',
                    prompt: `${text.slice(0, index).join('')}( )${text.slice(index + 1).join('')}`, answer,
                    wrong: uniqueWrong(answer, [...suppliedWrong, ...text]), sourceFactId: record.id }));
            } else if ((pack.id === 'hanzi.antonyms' || pack.id === 'hanzi.synonyms')
                && typeof fields.left === 'string' && typeof fields.right === 'string') {
                const label = pack.id.endsWith('antonyms') ? '反义词' : '近义词';
                const templateId = pack.id.endsWith('antonyms') ? 'hanzi-antonym' : 'hanzi-synonym';
                const leftWrong = Array.isArray(fields.leftDistractors) ? fields.leftDistractors as string[] : [];
                const rightWrong = Array.isArray(fields.rightDistractors) ? fields.rightDistractors as string[] : [];
                seeds.push({ theme, templateId, prompt: `${fields.left}的${label}`, answer: fields.right,
                    wrong: uniqueWrong(fields.right, rightWrong), sourceFactId: record.id });
                seeds.push({ theme, templateId, prompt: `${fields.right}的${label}`, answer: fields.left,
                    wrong: uniqueWrong(fields.left, leftWrong), sourceFactId: record.id });
            } else if (pack.id === 'hanzi.pinyin' && typeof fields.character === 'string'
                && typeof fields.pinyin === 'string' && typeof fields.homophone === 'string') {
                seeds.push({ theme, templateId: 'hanzi-pinyin', prompt: `${fields.character}的拼音`, answer: fields.pinyin,
                    wrong: uniqueWrong(fields.pinyin, pinyinPool), sourceFactId: record.id });
                seeds.push({ theme, templateId: 'hanzi-homophone', prompt: `${fields.character}的同音字`, answer: fields.homophone,
                    wrong: uniqueWrong(fields.homophone, homophonePool), sourceFactId: record.id });
                seeds.push({ theme, templateId: 'hanzi-pinyin', prompt: `${fields.pinyin}对应的字`, answer: fields.character,
                    wrong: uniqueWrong(fields.character, characterPool), sourceFactId: record.id });
            } else if (pack.id.startsWith('english.words') && typeof fields.en === 'string'
                && typeof fields.zh === 'string' && typeof fields.category === 'string') {
                const word = fields.en;
                seeds.push({ theme, templateId: 'english-meaning', prompt: `${word}的中文`, answer: fields.zh,
                    wrong: uniqueWrong(fields.zh, meaningPool), sourceFactId: record.id });
                seeds.push({ theme, templateId: 'english-category', prompt: `${word}所属类别`, answer: fields.category,
                    wrong: uniqueWrong(fields.category, categoryPool), sourceFactId: record.id });
                seeds.push({ theme, templateId: 'english-first-letter', prompt: `${word}的首字母`, answer: word[0],
                    wrong: uniqueWrong(word[0], 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), sourceFactId: record.id });
                seeds.push({ theme, templateId: 'english-length', prompt: `${word}有几个字母`, answer: word.length,
                    wrong: uniqueWrong(word.length, [word.length - 2, word.length - 1, word.length + 1, word.length + 2]), sourceFactId: record.id });
                const missing = Math.floor(word.length / 2);
                seeds.push({ theme, templateId: 'english-missing-letter', prompt: `${word.slice(0, missing)}_${word.slice(missing + 1)}`,
                    answer: word[missing], wrong: uniqueWrong(word[missing], englishPool.map((item) => item[0])), sourceFactId: record.id });
            } else if (pack.id === 'life.categories' && typeof fields.item === 'string'
                && typeof fields.use === 'string' && typeof fields.category === 'string') {
                seeds.push({ theme, templateId: 'life-use', prompt: `${fields.item}主要用于`, answer: fields.use,
                    wrong: uniqueWrong(fields.use, usePool), sourceFactId: record.id });
                seeds.push({ theme, templateId: 'life-category', prompt: `${fields.item}属于`, answer: fields.category,
                    wrong: uniqueWrong(fields.category, categoryPool), sourceFactId: record.id });
                seeds.push({ theme, templateId: 'life-use', prompt: `${fields.use}会用到`, answer: fields.item,
                    wrong: uniqueWrong(fields.item, itemPool), sourceFactId: record.id });
            } else if (pack.id === 'geography.world' && typeof fields.country === 'string' && typeof fields.capital === 'string') {
                seeds.push({ theme, templateId: 'geography-capital', prompt: `${fields.country}首都`, answer: fields.capital,
                    wrong: uniqueWrong(fields.capital, capitalPool), sourceFactId: record.id });
                seeds.push({ theme, templateId: 'geography-country', prompt: `${fields.capital}在哪国`, answer: fields.country,
                    wrong: uniqueWrong(fields.country, countryPool), sourceFactId: record.id });
            }
        }
    }
    const unique = new Map<string, Seed>();
    for (const seed of seeds) {
        if (seed.wrong.length < 3) continue;
        unique.set(`${seed.templateId}|${seed.prompt}|${seed.answer}`, seed);
    }
    return [...unique.values()];
}

function expandTheme(theme: ThemeId, target: number): MvpChoiceQuestion[] {
    const seeds = reviewedSeeds(theme);
    if (!seeds.length) throw new Error(`No MVP seeds for ${theme}`);
    const output: MvpChoiceQuestion[] = [];
    for (let index = 0; index < target; index += 1) {
        const seed = seeds[index % seeds.length];
        const round = Math.floor(index / seeds.length);
        if (round >= PROMPT_STYLES.length) throw new Error(`Not enough distinct MVP variants for ${theme}`);
        output.push({ ...seed, id: `mvp.${theme}.${String(index + 1).padStart(4, '0')}`,
            prompt: PROMPT_STYLES[round](seed.prompt), verified: true });
    }
    return output;
}

function arithmeticInventory(): MvpChoiceQuestion[] {
    const output: MvpChoiceQuestion[] = [];
    const push = (templateId: QuestionTemplateId, difficulty: 1 | 2 | 3 | 4 | 5,
        prompt: string, answer: string | number, wrong: (string | number)[]) => output.push({
        id: `mvp.math.${String(output.length + 1).padStart(4, '0')}`, theme: 'math', templateId,
        difficulty, prompt, answer, wrong: uniqueWrong(answer, wrong), verified: true,
    });
    const take = <T>(items: readonly T[], count: number): T[] => Array.from({ length: count }, (_, index) =>
        items[Math.floor(index * items.length / count)]);
    const wrongNumbers = (answer: number, stride: number) =>
        [answer - stride, answer - 1, answer + 1, answer + stride, answer + 10];
    for (let difficulty = 1 as 1 | 2 | 3 | 4 | 5; difficulty <= 5; difficulty = (difficulty + 1) as typeof difficulty) {
        const base = 100 + (difficulty - 1) * 140;
        const additions: Array<readonly [number, number]> = [];
        const subtractions: Array<readonly [number, number]> = [];
        const products: Array<readonly [number, number]> = [];
        const divisions: Array<readonly [number, number]> = [];
        const mixed: Array<readonly [number, number, number, boolean]> = [];
        for (let offset = 0; offset < 20; offset += 1) for (let step = 0; step < 20; step += 1) {
            additions.push([base + offset, 100 + difficulty * 20 + step]);
            subtractions.push([base + 220 + offset, 100 + difficulty * 18 + step]);
        }
        const factorMin = 10 + (difficulty - 1) * 14;
        for (let a = factorMin; a < factorMin + 14; a += 1) for (let b = factorMin; b < factorMin + 14; b += 1) {
            products.push([a, b]);
            divisions.push([a, b]);
            for (let offset = 20; offset < 30; offset += 1) mixed.push([a, b, offset + difficulty * 10, (a + b + offset) % 2 === 0]);
        }
        for (const [a, b] of take(additions, 60)) {
            const answer = a + b; push('math-add', difficulty, `${a}+${b}=?`, answer, wrongNumbers(answer, 10));
        }
        for (const [minuend, subtrahend] of take(subtractions, 60)) {
            const answer = minuend - subtrahend; push('math-subtract', difficulty, `${minuend}-${subtrahend}=?`, answer, wrongNumbers(answer, 10));
        }
        for (const [a, b] of take(products, 60)) {
            const answer = a * b; push('math-multiply', difficulty, `${a}×${b}=?`, answer, wrongNumbers(answer, a));
        }
        for (const [divisor, answer] of take(divisions, 60)) {
            push('math-divide', difficulty, `${divisor * answer}÷${divisor}=?`, answer, wrongNumbers(answer, 2));
        }
        for (const [a, b, offset, subtract] of take(mixed, 140)) {
            const answer = subtract ? a * b - offset : a * b + offset;
            push('math-mixed', difficulty, `${a}×${b}${subtract ? '-' : '+'}${offset}=?`, answer, wrongNumbers(answer, a));
        }
        const operators = ['+', '-', '×', '÷'] as const;
        for (let index = 0; index < 60; index += 1) {
            const operator = operators[index % operators.length];
            const left = base + index;
            const right = operator === '×' || operator === '÷' ? factorMin + index % 14 : 100 + index;
            const prompt = operator === '+' ? `${left}( )${right}=${left + right}`
                : operator === '-' ? `${left + right}( )${right}=${left}`
                    : operator === '×' ? `${left}( )${right}=${left * right}`
                        : `${left * right}( )${right}=${left}`;
            push('math-operator', difficulty, prompt, operator, ['+', '-', '×', '÷'].filter((item) => item !== operator));
        }
        const reverseSources: string[] = [];
        let candidate = 12_345 + (difficulty - 1) * 15_000;
        while (reverseSources.length < 60) {
            const text = String(candidate++);
            if (!text.includes('0') && new Set(text).size === text.length) reverseSources.push(text);
        }
        for (const source of reverseSources) {
            const answerChars = Array.from(source).reverse();
            const answer = answerChars.join('');
            const wrong = [0, 1, 2, 3].map((index) => {
                const chars = [...answerChars];
                [chars[index], chars[index + 1]] = [chars[index + 1], chars[index]];
                return chars.join('');
            });
            push('math-digit-reverse', difficulty, `${source}反转后`, answer, wrong);
        }
        for (let index = 0; index < 60; index += 1) {
            const divisor = factorMin + index % 14;
            const quotient = factorMin + index;
            const remainder = 1 + index * 5 % (divisor - 1);
            const dividend = divisor * quotient + remainder;
            push('math-remainder', difficulty, `${dividend}÷${divisor}的余数`, remainder,
                [0, remainder - 1, remainder + 1, divisor - remainder, divisor - 1]);
        }
    }
    return output;
}

function visionInventory(): MvpChoiceQuestion[] {
    const symbols = ['○', '△', '□', '◇', '☆', '●', '▲', '■', '◆', '★'];
    const output: MvpChoiceQuestion[] = [];
    for (let a = 0; a < symbols.length && output.length < MVP_THEME_TARGETS.vision; a += 1) {
        for (let b = 0; b < symbols.length && output.length < MVP_THEME_TARGETS.vision; b += 1) {
            if (a === b) continue;
            for (let run = 1; run <= 7 && output.length < MVP_THEME_TARGETS.vision; run += 1) {
                const answer = symbols[a];
                output.push({ id: `mvp.vision.${String(output.length + 1).padStart(4, '0')}`, theme: 'vision',
                    templateId: 'vision-pattern', prompt: `${symbols[a]}${symbols[b].repeat(run)}${symbols[a]}${symbols[b].repeat(run)}?`,
                    answer, wrong: uniqueWrong(answer, symbols), verified: true });
            }
        }
    }
    return output;
}

export const MVP_QUESTION_INVENTORY: readonly MvpChoiceQuestion[] = [
    ...arithmeticInventory(), ...visionInventory(),
    ...expandTheme('hanzi', MVP_THEME_TARGETS.hanzi),
    ...expandTheme('english', MVP_THEME_TARGETS.english),
    ...expandTheme('life', MVP_THEME_TARGETS.life),
    ...expandTheme('geography', MVP_THEME_TARGETS.geography),
    ...expandTheme('knowledge', MVP_THEME_TARGETS.knowledge),
    ...expandTheme('history', MVP_THEME_TARGETS.history),
];

export const MVP_QUESTIONS_BY_TEMPLATE: ReadonlyMap<QuestionTemplateId, readonly MvpChoiceQuestion[]> = (() => {
    const map = new Map<QuestionTemplateId, MvpChoiceQuestion[]>();
    for (const question of MVP_QUESTION_INVENTORY) {
        const values = map.get(question.templateId) ?? [];
        values.push(question);
        map.set(question.templateId, values);
    }
    return map;
})();
