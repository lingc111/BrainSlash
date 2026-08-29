import type { ContentFamilyKind } from './ContentCatalog';
import type { GameMode, GameplayEngineId, RuleId, ThemeId } from './Models';
import { SeededRng } from './SeededRng';

export interface QuestionTypeDefinition {
    typeId: string;
    label: string;
    theme: ThemeId;
    engineId: GameplayEngineId;
    generatorId: string;
    familyKind: ContentFamilyKind;
    difficulty: 1 | 2 | 3;
    targetRange: readonly [number, number];
    compatibleRules: readonly RuleId[];
    modeWeights: Readonly<Record<GameMode, number>>;
    contentSource: 'algorithmic' | 'reviewed';
}

export interface ExcludedQuestionType {
    typeId: string;
    label: string;
    reason: 'image-assets' | 'product-memory' | 'product-tracking' | 'product-continuous' | 'product-geography-direction';
}

type Row = readonly [slug: string, label: string, engine: GameplayEngineId];
const rows = (raw: string, defaultEngine: GameplayEngineId): Row[] => raw.trim().split('\n').map((line) => {
    const [slug, label, engine] = line.trim().split('|');
    return [slug, label, (engine as GameplayEngineId | undefined) ?? defaultEngine];
});

const MATH = rows(`
addition|加法计算
subtraction|减法计算
multiplication|乘法计算
division|除法计算
even|选择偶数|condition
odd|选择奇数|condition
multiple-of-three|选择3的倍数|condition
greater-than|选择大于指定数|condition
less-than|选择小于指定数|condition
maximum|选择最大数字|compare
minimum|选择最小数字|compare
ascending-numbers|从小到大斩数字|order
arithmetic-next|等差数列下一项|sequence
addition-left-blank|加法左侧填空|fill
addition-right-blank|加法右侧填空|fill
minuend-blank|减法被减数填空|fill
subtrahend-blank|减法减数填空|fill
factor-blank|乘法因数填空|fill
addition-expression-target|选择目标和算式
subtraction-expression-target|选择目标差算式
pair-sum|两数之和等于目标|double
pair-difference|两数之差等于目标|double
pair-product|两数之积等于目标|double
pair-quotient|两数之商等于目标|double
slash-expression|连续斩出算式|order
correct-operator|选择正确运算符
wrong-operator|选择错误运算符|inverse
equation-true-false|判断算式正误|truth
find-wrong-equation|找出错误算式|inverse
find-correct-equation|找出正确算式
compare-expressions|比较两个算式大小|compare
largest-expression|结果最大的算式|compare
smallest-expression|结果最小的算式|compare
ascending-expressions|按结果从小到大斩算式|order
descending-expressions|按结果从大到小斩算式|order
even-expression|选择结果为偶数的算式|condition
odd-expression|选择结果为奇数的算式|condition
prime|质数选择|condition
composite|合数选择|condition
divisible|选择能整除的数字|condition
not-divisible|选择不能整除的数字|inverse
factor|选择指定数字的因数|condition
multiples|选择指定数字的倍数|multi
missing-sequence|找缺失数字的数列|sequence
geometric-next|等比数列下一项|sequence
growing-step-sequence|递增幅度数列|sequence
parity-alternating|单双数交替数列|sequence
interleaved-sequences|两个数列交叉规律|sequence
wrong-sequence-item|找数列错误项|sequence
duplicate-number|找重复数字|same
unique-number|找唯一未重复数字|odd-one-out
make-ten|凑整十
make-hundred|凑整百
nearest-target|最接近目标值|compare
farthest-target|离目标值最远|compare
number-range|数字区间判断|condition
and-number-condition|双条件数字|condition
excluded-number-condition|排除条件数字|inverse
digit-count|数字位数判断|condition
ones-digit|个位数条件|condition`, 'single');

const VISION = rows(`
same-arrow|找相同方向箭头
opposite-arrow|找反方向箭头|inverse
solid-outline-odd|实心空心找不同|odd-one-out
symbol-count|指定数量符号|count
stroop-color|根据字体颜色选择|condition
alternating-symbol|符号交替规律|sequence
arrow-rotation|箭头旋转规律|sequence
group-repeat|符号分组重复|sequence
alternating-number|数字交替规律|sequence
size-cycle|大小文字循环|sequence
reference-pair|参考符号对匹配|same
duplicate-shapes|找成对图形|pair
unique-shape|找唯一不同图形|odd-one-out
unique-matching-shape|找唯一相同图形|same
color-shape|颜色加形状定位|condition
exclude-color|颜色排除|inverse
exclude-shape|形状排除|inverse
color-shape-outline|双条件定位|condition
color-or-shape|条件二选一|multi
mirror|找镜像图形|compare
not-mirror|找非镜像图形|inverse
rotated-same|找旋转后的相同图形|same
rotation-invariant|忽略旋转找相同图形|same
direction-color|方向加颜色|condition
missing-corner|找缺角图形|odd-one-out
extra-element|找多一个元素图形|odd-one-out
missing-element|找少一个元素图形|odd-one-out
inner-pattern|内部图案不同|odd-one-out
outer-frame|外框不同|odd-one-out
count-group|数数量后选择|count
compare-quantity|比较数量|compare
largest-shape|比较大小|compare
second-largest|找第二大|compare
second-smallest|找第二小|compare
size-order|按大小顺序斩|order
color-order|按颜色顺序斩|order
direction-order|按箭头方向顺序斩|order
symmetric|寻找对称图形
asymmetric|寻找不对称图形|inverse
overlay|图形叠加判断|compare
split|图形拆分判断|compare`, 'single');

const HANZI = rows(`
idiom-fill|成语填空|fill
idiom-order|按顺序斩成语|order
antonym|选择反义词
synonym|选择近义词
pinyin|选择正确拼音
pinyin-to-character|根据拼音选择汉字
tone|选择正确声调
homophone|选择同音字|same
similar-character|选择形近字|same
wrong-character|找错别字|odd-one-out
correct-character|找正确汉字
radical-match|偏旁部首匹配|pair
radical-to-character|根据部首选择汉字
same-radical|选择相同部首汉字|same
word-formation|汉字组词|pair
two-character-word|两个字组成词语|double
word-order|按顺序组成词语|order
sentence-order|按顺序组成句子|order
measure-word|选择量词|fill
collocation|选择正确搭配|fill
category-odd|选择不同类别词语|odd-one-out
line-match|上下句短片段匹配|fill
poetry-fill|古诗补字|fill
poetry-next-fragment|古诗下一句短片段|fill
riddle-fill|歇后语补全|fill
idiom-wrong-character|成语找错字|odd-one-out
idiom-synonym|成语近义匹配|pair
idiom-antonym|成语反义匹配|pair`, 'single');

const ENGLISH = rows(`
meaning|英文选择中文含义
category|根据类别选择英文|condition
antonym|选择英文反义词
zh-to-en|根据中文选择英文
symbol-meaning|根据英文选择符号
correct-spelling|找拼写正确单词
wrong-spelling|找拼写错误单词|inverse
missing-letter|单词缺字母|fill
first-letter|选择首字母|fill
last-letter|选择尾字母|fill
letter-order|字母乱序组成单词|order
same-first-letter|找相同首字母单词|same
category-odd|找不同类别单词|odd-one-out
plural-match|单复数匹配|pair
case-match|大小写字母匹配|pair
uppercase-to-lowercase|大写找小写
synonym|选择英文近义词
zh-en-pair|中英配对|pair
sentence-fill|简单句子补词|fill
number-match|数字英文匹配|pair
color-match|颜色英文匹配|pair
weekday-order|星期顺序|order
month-order|月份顺序|order`, 'single');

const LIFE = rows(`
category|生活类别选择|condition
garbage-sort|垃圾分类|condition
transport-sort|交通工具分类|condition
food-sort|食物分类|condition
fruit-vegetable|水果蔬菜判断|truth
animal-sort|动物分类|condition
job-tool|职业与工具匹配|pair
place-item|场所与物品匹配|pair
weather-item|天气与物品匹配|pair
season-item|季节与物品匹配|pair
safe-behavior|安全行为判断|truth
dangerous-behavior|危险行为判断|truth
traffic-sign|交通标志文字判断|truth
daily-process|生活流程顺序|order
time-scene|时间场景判断
item-use|物品用途判断|pair
food-source|食物来源匹配|pair
animal-food|动物与食物匹配|pair`, 'single');

const GEOGRAPHY = rows(`
country-capital|国家选择首都
capital-country|首都选择国家
country-continent|国家选择大洲
continent-country|大洲选择国家
country-currency|国家选择货币
province-capital|省份选择省会
capital-province|省会选择省份
city-province|城市选择省份
river-region|河流选择地区
mountain-region|山脉选择地区
world-record|世界之最判断|truth`, 'single');

const KNOWLEDGE = rows(`
correct-fact|选择正确事实
wrong-fact|选择错误事实|inverse
true-false|判断真伪|truth
person-event|人物选择事件|pair
event-person|事件选择人物|pair
invention-inventor|发明选择发明者|pair
animal-habitat|动物选择栖息地|pair
animal-food|动物选择食物|pair
plant-feature|植物选择特征|pair
organ-function|器官选择功能|pair
animal-class|动物分类|condition
plant-class|植物分类|condition
matter-state|物态分类|condition
energy-renewability|能源分类|condition
historical-period|时代分类|condition
history-order|历史事件排序|order
dynasty-order|朝代排序|order
person-era-order|人物年代排序|order
science-process|科学过程排序|order
life-cycle|生命周期排序|order`, 'single');

const ALL_MODES: Readonly<Record<GameMode, number>> = { brawl60: 1, daily: 1, friendChallenge: 1, tower: 1 };
const FAMILY_RULES: readonly RuleId[] = ['standard', 'reverse', 'multi', 'order', 'rotate', 'bomb'];

function mathFamily(index: number): ContentFamilyKind {
    if (index <= 4) return index === 1 ? 'math-add' : index === 2 ? 'math-subtract' : 'math-multiply';
    if (index <= 11 || index >= 38 && index <= 43 || index >= 56) return 'math-property';
    if (index === 12 || index === 13 || index >= 44 && index <= 51) return 'math-sequence';
    if (index >= 14 && index <= 18) return 'math-missing';
    if (index >= 19 && index <= 37 || index >= 52 && index <= 55) return 'math-equation';
    return 'math-compare';
}

function visionFamily(index: number): ContentFamilyKind {
    if ([1, 2, 24, 37].includes(index)) return 'vision-direction';
    if ([3, 13, 25, 26, 27, 28, 29, 38, 39].includes(index)) return 'vision-odd';
    if ([4, 30, 31].includes(index)) return 'vision-count';
    if ([5, 15, 16, 17, 18, 19].includes(index)) return 'vision-stroop';
    if ([6, 7, 8, 9, 10, 35, 36].includes(index)) return 'vision-pattern';
    return 'vision-match';
}

function familyFor(theme: ThemeId, index: number): ContentFamilyKind {
    if (theme === 'math') return mathFamily(index);
    if (theme === 'vision') return visionFamily(index);
    if (theme === 'hanzi') return index === 2 || index === 17 || index === 18 ? 'hanzi-order' : index === 3 || index === 28 ? 'hanzi-antonym' : index === 4 || index === 27 ? 'hanzi-synonym' : 'hanzi-fill';
    if (theme === 'english') return index === 2 || index === 13 ? 'english-category' : index === 3 ? 'english-antonym' : 'english-meaning';
    if (theme === 'life') return 'life-category';
    if (theme === 'geography') return index % 2 === 0 ? 'geography-country' : 'geography-capital';
    if (index >= 16) return index <= 17 ? 'history-ancient' : 'history-modern-awakening';
    return index % 3 === 0 ? 'knowledge-science' : index % 3 === 1 ? 'knowledge-nature' : 'knowledge-culture';
}

function definitions(theme: ThemeId, list: readonly Row[]): QuestionTypeDefinition[] {
    return definitionsAt(theme, list, list.map((_, offset) => offset + 1));
}

function definitionsAt(theme: ThemeId, list: readonly Row[], documentIndexes: readonly number[]): QuestionTypeDefinition[] {
    return list.map(([slug, label, engineId], offset) => {
        const index = documentIndexes[offset];
        return {
            typeId: `${theme}.${String(index).padStart(2, '0')}.${slug}`,
            label,
            theme,
            engineId,
            generatorId: `${theme}.${slug}`,
            familyKind: familyFor(theme, index),
            difficulty: (index <= Math.ceil(list.length / 3) ? 1 : index <= Math.ceil(list.length * 2 / 3) ? 2 : 3),
            targetRange: engineId === 'multi' || engineId === 'order' || engineId === 'pair' || engineId === 'double' ? [3, 5] : [2, 4],
            compatibleRules: FAMILY_RULES,
            modeWeights: ALL_MODES,
            contentSource: theme === 'math' || theme === 'vision' ? 'algorithmic' : 'reviewed',
        };
    });
}

export const QUESTION_TYPES: readonly QuestionTypeDefinition[] = [
    ...definitions('math', MATH), ...definitions('vision', VISION), ...definitions('hanzi', HANZI),
    ...definitions('english', ENGLISH), ...definitions('life', LIFE),
    ...definitionsAt('geography', GEOGRAPHY, [1, 2, 3, 4, 9, 10, 11, 12, 13, 14, 15]),
    ...definitions('knowledge', KNOWLEDGE.slice(0, 15)), ...definitionsAt('history', KNOWLEDGE.slice(15), [16, 17, 18, 19, 20]),
];

export const EXCLUDED_QUESTION_TYPES: readonly ExcludedQuestionType[] = [
    { typeId: 'vision.42.instant-position-memory', label: '瞬时记忆位置', reason: 'product-memory' },
    { typeId: 'vision.43.instant-color-memory', label: '瞬时记忆颜色', reason: 'product-memory' },
    { typeId: 'vision.44.instant-order-memory', label: '瞬时记忆顺序', reason: 'product-memory' },
    { typeId: 'vision.45.target-tracking', label: '移动目标追踪', reason: 'product-tracking' },
    { typeId: 'geography.05.country-flag', label: '国家选择国旗', reason: 'image-assets' },
    { typeId: 'geography.06.flag-country', label: '国旗选择国家', reason: 'image-assets' },
    { typeId: 'geography.07.country-landmark', label: '国家选择地标', reason: 'image-assets' },
    { typeId: 'geography.08.landmark-country', label: '地标选择国家', reason: 'image-assets' },
    { typeId: 'geography.16.direction', label: '地理方向判断', reason: 'product-geography-direction' },
    { typeId: 'geography.17.position-order', label: '地理位置排序', reason: 'product-geography-direction' },
    { typeId: 'special.continuous-instruction', label: '连续指令', reason: 'product-continuous' },
    { typeId: 'special.rule-switch', label: '规则中途切换', reason: 'product-continuous' },
];

const TYPES_BY_FAMILY = new Map<ContentFamilyKind, QuestionTypeDefinition[]>();
for (const definition of QUESTION_TYPES) {
    const list = TYPES_BY_FAMILY.get(definition.familyKind) ?? [];
    list.push(definition);
    TYPES_BY_FAMILY.set(definition.familyKind, list);
}

export function questionTypesForFamily(kind: ContentFamilyKind, maximumDifficulty: 1 | 2 | 3 = 3): readonly QuestionTypeDefinition[] {
    return (TYPES_BY_FAMILY.get(kind) ?? []).filter((definition) => definition.difficulty <= maximumDifficulty);
}

export function questionTypeById(typeId: string): QuestionTypeDefinition | undefined {
    return QUESTION_TYPES.find((definition) => definition.typeId === typeId);
}

const LEGACY_GENERATOR_BY_FAMILY: Readonly<Partial<Record<ContentFamilyKind, string>>> = {
    'math-add': 'math.addition', 'math-subtract': 'math.subtraction', 'math-multiply': 'math.multiplication',
    'math-property': 'math.even', 'math-compare': 'math.maximum', 'math-sequence': 'math.arithmetic-next',
    'math-missing': 'math.addition-left-blank', 'math-equation': 'math.addition-expression-target',
    'vision-direction': 'vision.same-arrow', 'vision-odd': 'vision.solid-outline-odd', 'vision-count': 'vision.symbol-count',
    'vision-stroop': 'vision.stroop-color', 'vision-pattern': 'vision.alternating-symbol', 'vision-match': 'vision.reference-pair',
    'hanzi-fill': 'hanzi.idiom-fill', 'hanzi-order': 'hanzi.idiom-order', 'hanzi-antonym': 'hanzi.antonym', 'hanzi-synonym': 'hanzi.synonym',
    'english-meaning': 'english.meaning', 'english-category': 'english.category', 'english-antonym': 'english.antonym',
    'life-category': 'life.category', 'geography-capital': 'geography.country-capital', 'geography-country': 'geography.capital-country',
    'knowledge-science': 'knowledge.correct-fact', 'knowledge-nature': 'knowledge.correct-fact', 'knowledge-culture': 'knowledge.correct-fact',
    'knowledge-civic': 'knowledge.correct-fact', 'history-modern-opening': 'history.history-order',
    'history-modern-awakening': 'history.history-order', 'history-modern-resistance': 'history.history-order',
    'history-ancient': 'history.dynasty-order', 'history-myth': 'history.person-era-order',
};

export function legacyQuestionTypeForFamily(kind: ContentFamilyKind): QuestionTypeDefinition | undefined {
    const generatorId = LEGACY_GENERATOR_BY_FAMILY[kind];
    return QUESTION_TYPES.find((definition) => definition.generatorId === generatorId) ?? questionTypesForFamily(kind)[0];
}

/** Deterministic, cooling rotation used by every game-mode director. */
export class QuestionTypeRotation {
    private readonly bags = new Map<string, QuestionTypeDefinition[]>();
    public constructor(private readonly rng: SeededRng, private readonly extendedChance = 0.18) {}

    public next(
        kind: ContentFamilyKind,
        difficulty: 1 | 2 | 3,
        rules: readonly RuleId[],
        enabledRules?: ReadonlySet<RuleId>,
    ): string | undefined {
        if (rules.includes('multi') || rules.includes('order') || rules.filter((rule) => rule !== 'standard').length > 1) return undefined;
        if (this.rng.next() >= this.extendedChance) return undefined;
        const key = `${kind}:${difficulty}:${rules.includes('reverse') ? 'reverse' : 'normal'}`;
        let bag = this.bags.get(key);
        if (!bag?.length) {
            bag = this.rng.shuffle(questionTypesForFamily(kind, difficulty).filter((definition) => {
                if (rules.includes('reverse') && definition.engineId === 'inverse') return false;
                const needsOrder = definition.engineId === 'order';
                const needsMulti = definition.engineId === 'multi' || definition.engineId === 'double'
                    || definition.engineId === 'pair' || definition.engineId === 'same';
                if (enabledRules && needsOrder && !enabledRules.has('order')) return false;
                if (enabledRules && needsMulti && !enabledRules.has('multi')) return false;
                return true;
            }));
            this.bags.set(key, bag);
        }
        return bag.pop()?.typeId;
    }
}
