import { ENGLISH_ANTONYMS, ENGLISH_WORDS, IDIOMS } from './ContentCatalog';
import type { TargetSpec } from './Models';
import type { QuestionTypeDefinition } from './QuestionTypeCatalog';
import { SeededRng } from './SeededRng';
import { compileCondition, type ConditionExpr } from './ConditionEngine';
import { structuredContent } from './StructuredContentBank';

export interface ExtendedQuestionDraft {
    prompt: string;
    targets: TargetSpec[];
    correctTargetIds: string[];
    orderedTargetIds?: string[];
    factIds?: string[];
}

type Pair = readonly [left: string, right: string];
type Relation = Readonly<Record<string, string>>;

const PINYIN: readonly (readonly [string, string, string, string])[] = [
    ['山', 'shān', '扇', '一声'], ['水', 'shuǐ', '睡', '三声'], ['花', 'huā', '画', '一声'], ['鸟', 'niǎo', '尿', '三声'],
    ['月', 'yuè', '越', '四声'], ['风', 'fēng', '凤', '一声'], ['雨', 'yǔ', '语', '三声'], ['云', 'yún', '匀', '二声'],
    ['马', 'mǎ', '码', '三声'], ['鱼', 'yú', '余', '二声'], ['书', 'shū', '叔', '一声'], ['火', 'huǒ', '伙', '三声'],
];
const RADICALS: readonly (readonly [string, string, string])[] = [
    ['河', '氵', '湖'], ['树', '木', '林'], ['跑', '足', '跳'], ['猫', '犭', '狗'], ['明', '日', '晴'], ['语', '讠', '说'],
    ['铁', '钅', '铜'], ['妈', '女', '姐'], ['花', '艹', '草'], ['烧', '火', '灯'], ['饭', '饣', '饱'], ['纸', '纟', '线'],
];
const WORD_PAIRS: readonly Pair[] = [['学', '习'], ['朋', '友'], ['天', '空'], ['道', '路'], ['安', '全'], ['快', '乐'], ['春', '天'], ['森', '林'], ['海', '洋'], ['时', '间'], ['阳', '光'], ['勇', '气']];
const HANZI_ANTONYMS: readonly Pair[] = [['大', '小'], ['高', '低'], ['快', '慢'], ['远', '近'], ['冷', '热'], ['明', '暗'], ['开', '关'], ['进', '退'], ['前', '后'], ['多', '少'], ['轻', '重'], ['真', '假']];
const HANZI_SYNONYMS: readonly Pair[] = [['快乐', '高兴'], ['美丽', '漂亮'], ['立刻', '马上'], ['寒冷', '冰冷'], ['宽广', '广阔'], ['安静', '宁静'], ['观看', '观赏'], ['珍贵', '宝贵'], ['经常', '常常'], ['非常', '十分'], ['著名', '有名'], ['寻找', '寻觅']];
const MEASURE_WORDS: readonly Pair[] = [['苹果', '个'], ['书', '本'], ['鱼', '条'], ['马', '匹'], ['花', '朵'], ['树', '棵'], ['鸟', '只'], ['衣服', '件'], ['伞', '把'], ['车', '辆'], ['纸', '张'], ['灯', '盏']];
const COLLOCATIONS: readonly Pair[] = [['明亮的', '眼睛'], ['清澈的', '河水'], ['温暖的', '阳光'], ['安静的', '夜晚'], ['勇敢的', '战士'], ['宽阔的', '道路'], ['茂密的', '森林'], ['甜美的', '笑容'], ['整齐的', '队伍'], ['新鲜的', '空气'], ['洁白的', '云朵'], ['辽阔的', '草原']];
const POETRY: readonly (readonly [string, string, readonly string[]])[] = [
    ['床前明月＿，疑是地上霜', '光', ['风', '花', '雪']], ['举头望明月，低头思＿', '故乡', ['远方', '长安', '家园']],
    ['白日依山尽，黄河入＿', '海流', ['江流', '湖中', '云间']], ['春眠不觉晓，处处闻啼＿', '鸟', ['花', '雨', '风']],
    ['锄禾日当午，汗滴禾下＿', '土', ['田', '苗', '谷']], ['谁知盘中餐，粒粒皆辛＿', '苦', ['勤', '劳', '甜']],
    ['两个黄鹂鸣翠柳，一行白鹭上＿', '青天', ['蓝天', '云端', '高山']], ['欲穷千里目，更上一层＿', '楼', ['山', '台', '桥']],
    ['野火烧不尽，春风吹又＿', '生', ['绿', '来', '起']], ['小荷才露尖尖角，早有蜻蜓立＿', '上头', ['水边', '叶间', '花中']],
    ['桃花潭水深千尺，不及汪伦送我＿', '情', ['行', '舟', '心']], ['飞流直下三千尺，疑是银河落＿', '九天', ['云端', '人间', '高山']],
];
const ENGLISH_RELATIONS: readonly (readonly [string, string, string, string])[] = [
    ['CAT', 'CATS', '猫', '🐱'], ['DOG', 'DOGS', '狗', '🐶'], ['APPLE', 'APPLES', '苹果', '●'], ['BOOK', 'BOOKS', '书', '▤'],
    ['BIRD', 'BIRDS', '鸟', '◆'], ['STAR', 'STARS', '星星', '★'], ['FLOWER', 'FLOWERS', '花', '✿'], ['CAR', 'CARS', '汽车', '▰'],
    ['CUP', 'CUPS', '杯子', '∪'], ['TREE', 'TREES', '树', '♣'], ['KEY', 'KEYS', '钥匙', '⚿'], ['BALL', 'BALLS', '球', '●'],
];
const ENGLISH_SYNONYMS: readonly Pair[] = [['BIG', 'LARGE'], ['SMALL', 'LITTLE'], ['FAST', 'QUICK'], ['SMART', 'CLEVER'], ['HAPPY', 'GLAD'], ['BEGIN', 'START'], ['CLOSE', 'SHUT'], ['QUIET', 'SILENT'], ['EASY', 'SIMPLE'], ['ANGRY', 'MAD'], ['GIFT', 'PRESENT'], ['END', 'FINISH']];
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

const LIFE_RELATIONS: readonly Readonly<Record<string, string>>[] = [
    { item: '雨伞', category: '日用品', garbage: '可回收', transport: '否', food: '否', plant: '否', animal: '否', job: '售货员', place: '家中', weather: '下雨', season: '雨季', use: '挡雨', source: '工厂' },
    { item: '苹果', category: '水果', garbage: '湿垃圾', transport: '否', food: '是', plant: '水果', animal: '否', job: '果农', place: '果园', weather: '晴天', season: '秋季', use: '食用', source: '果树' },
    { item: '白菜', category: '蔬菜', garbage: '湿垃圾', transport: '否', food: '是', plant: '蔬菜', animal: '否', job: '菜农', place: '菜地', weather: '晴天', season: '冬季', use: '食用', source: '菜地' },
    { item: '牛奶', category: '饮品', garbage: '湿垃圾', transport: '否', food: '是', plant: '否', animal: '否', job: '牧民', place: '牧场', weather: '晴天', season: '四季', use: '饮用', source: '奶牛' },
    { item: '公交车', category: '交通工具', garbage: '其他垃圾', transport: '是', food: '否', plant: '否', animal: '否', job: '司机', place: '车站', weather: '雨天', season: '四季', use: '出行', source: '工厂' },
    { item: '自行车', category: '交通工具', garbage: '可回收', transport: '是', food: '否', plant: '否', animal: '否', job: '骑手', place: '车棚', weather: '晴天', season: '春季', use: '骑行', source: '工厂' },
    { item: '听诊器', category: '医疗用品', garbage: '可回收', transport: '否', food: '否', plant: '否', animal: '否', job: '医生', place: '医院', weather: '晴天', season: '四季', use: '听诊', source: '工厂' },
    { item: '粉笔', category: '学习用品', garbage: '其他垃圾', transport: '否', food: '否', plant: '否', animal: '否', job: '教师', place: '教室', weather: '晴天', season: '四季', use: '书写', source: '矿物' },
    { item: '扫帚', category: '清洁工具', garbage: '其他垃圾', transport: '否', food: '否', plant: '否', animal: '否', job: '保洁员', place: '家中', weather: '晴天', season: '四季', use: '扫地', source: '工厂' },
    { item: '消防帽', category: '安全用品', garbage: '其他垃圾', transport: '否', food: '否', plant: '否', animal: '否', job: '消防员', place: '消防站', weather: '晴天', season: '四季', use: '防护', source: '工厂' },
    { item: '胡萝卜', category: '蔬菜', garbage: '湿垃圾', transport: '否', food: '是', plant: '蔬菜', animal: '否', job: '菜农', place: '菜地', weather: '晴天', season: '秋季', use: '食用', source: '菜地' },
    { item: '香蕉', category: '水果', garbage: '湿垃圾', transport: '否', food: '是', plant: '水果', animal: '否', job: '果农', place: '果园', weather: '晴天', season: '夏季', use: '食用', source: '果树' },
    { item: '小狗', category: '动物', garbage: '不适用', transport: '否', food: '否', plant: '否', animal: '哺乳动物', job: '兽医', place: '宠物医院', weather: '晴天', season: '四季', use: '陪伴', source: '犬类' },
    { item: '金鱼', category: '动物', garbage: '不适用', transport: '否', food: '否', plant: '否', animal: '鱼类', job: '饲养员', place: '水族馆', weather: '晴天', season: '四季', use: '观赏', source: '鱼卵' },
];
const SAFE_BEHAVIORS = ['过马路看红绿灯', '乘车系安全带', '湿手不碰插座', '闻到煤气先通风', '下楼扶好栏杆', '运动前先热身', '陌生链接不乱点', '雷雨天远离大树', '骑车佩戴头盔', '药品遵医嘱服用', '厨房用火不离人', '游泳要有成人陪同'] as const;
const DANGEROUS_BEHAVIORS = ['闯红灯', '玩弄插座', '高处推搡', '私自下水', '乱吃药品', '车内打闹', '厨房玩火', '泄露密码', '翻越护栏', '雷雨树下躲雨', '逆行骑车', '电梯内跳跃'] as const;
const DAILY_FLOW = ['起床', '刷牙', '早餐', '上学'] as const;

const COUNTRY_EXT: readonly Readonly<Record<string, string>>[] = [
    { country: '中国', capital: '北京', continent: '亚洲', currency: '人民币' }, { country: '日本', capital: '东京', continent: '亚洲', currency: '日元' },
    { country: '韩国', capital: '首尔', continent: '亚洲', currency: '韩元' }, { country: '法国', capital: '巴黎', continent: '欧洲', currency: '欧元' },
    { country: '德国', capital: '柏林', continent: '欧洲', currency: '欧元' }, { country: '英国', capital: '伦敦', continent: '欧洲', currency: '英镑' },
    { country: '美国', capital: '华盛顿', continent: '北美洲', currency: '美元' }, { country: '加拿大', capital: '渥太华', continent: '北美洲', currency: '加元' },
    { country: '巴西', capital: '巴西利亚', continent: '南美洲', currency: '雷亚尔' }, { country: '埃及', capital: '开罗', continent: '非洲', currency: '埃及镑' },
    { country: '澳大利亚', capital: '堪培拉', continent: '大洋洲', currency: '澳元' }, { country: '印度', capital: '新德里', continent: '亚洲', currency: '卢比' },
];
const PROVINCES: readonly (readonly [string, string, string])[] = [['广东', '广州', '深圳'], ['浙江', '杭州', '宁波'], ['江苏', '南京', '苏州'], ['福建', '福州', '厦门'], ['湖北', '武汉', '宜昌'], ['湖南', '长沙', '岳阳'], ['四川', '成都', '绵阳'], ['山东', '济南', '青岛'], ['河南', '郑州', '洛阳'], ['河北', '石家庄', '唐山'], ['辽宁', '沈阳', '大连'], ['陕西', '西安', '宝鸡']];
const RIVERS: readonly Pair[] = [['长江', '中国'], ['黄河', '中国'], ['尼罗河', '非洲'], ['亚马孙河', '南美洲'], ['密西西比河', '北美洲'], ['多瑙河', '欧洲'], ['恒河', '印度'], ['湄公河', '东南亚'], ['莱茵河', '欧洲'], ['伏尔加河', '俄罗斯'], ['刚果河', '非洲'], ['幼发拉底河', '西亚']];
const MOUNTAINS: readonly Pair[] = [['喜马拉雅山脉', '亚洲'], ['阿尔卑斯山脉', '欧洲'], ['安第斯山脉', '南美洲'], ['落基山脉', '北美洲'], ['昆仑山脉', '中国'], ['秦岭', '中国'], ['乌拉尔山脉', '俄罗斯'], ['阿特拉斯山脉', '非洲'], ['大分水岭', '澳大利亚'], ['高加索山脉', '欧亚交界'], ['天山山脉', '亚洲'], ['太行山脉', '中国']];
const WORLD_RECORDS: readonly Pair[] = [['最大海洋', '太平洋'], ['最高山峰', '珠穆朗玛峰'], ['最大洲', '亚洲'], ['最小洲', '大洋洲'], ['最长山脉', '安第斯山脉'], ['最大沙漠', '南极沙漠'], ['最深海沟', '马里亚纳海沟'], ['最大岛屿', '格陵兰岛'], ['最大半岛', '阿拉伯半岛'], ['最大湖泊', '里海'], ['最高高原', '青藏高原'], ['最大雨林', '亚马孙雨林']];

const KNOWLEDGE_RELATIONS: readonly (readonly [string, string, string])[] = [
    ['爱迪生', '电灯', '人物事件'], ['牛顿', '万有引力', '人物事件'], ['袁隆平', '杂交水稻', '人物事件'], ['屠呦呦', '青蒿素', '人物事件'],
    ['蔡伦', '造纸术', '发明'], ['毕昇', '活字印刷', '发明'], ['张衡', '地动仪', '发明'], ['莱特兄弟', '飞机', '发明'],
    ['企鹅', '南极地区', '栖息地'], ['骆驼', '沙漠', '栖息地'], ['北极熊', '北极', '栖息地'], ['袋鼠', '草原', '栖息地'],
    ['熊猫', '竹子', '食物'], ['青蛙', '昆虫', '食物'], ['考拉', '桉树叶', '食物'], ['长颈鹿', '树叶', '食物'],
    ['仙人掌', '耐旱', '植物特征'], ['向日葵', '向光', '植物特征'], ['荷花', '水生', '植物特征'], ['松树', '常绿', '植物特征'],
    ['心脏', '输送血液', '器官功能'], ['肺', '气体交换', '器官功能'], ['胃', '消化食物', '器官功能'], ['肾脏', '形成尿液', '器官功能'],
    ['太阳能', '可再生', '能源'], ['煤炭', '不可再生', '能源'], ['水', '液体', '物态'], ['氧气', '气体', '物态'],
];
const HISTORY_EVENTS: readonly Pair[] = [['秦朝建立', '公元前221年'], ['汉朝建立', '公元前202年'], ['唐朝建立', '618年'], ['宋朝建立', '960年'], ['元朝建立', '1271年'], ['明朝建立', '1368年'], ['清朝建立', '1636年'], ['辛亥革命', '1911年'], ['五四运动', '1919年'], ['抗战胜利', '1945年'], ['新中国成立', '1949年'], ['改革开放', '1978年']];
const SCIENCE_PROCESSES: readonly (readonly string[])[] = [['种子', '发芽', '幼苗', '开花'], ['卵', '幼虫', '蛹', '成虫'], ['水', '水蒸气', '云', '雨'], ['受精卵', '胚胎', '幼体', '成体']];

function questionNumber(definition: QuestionTypeDefinition): number {
    return Number(definition.typeId.split('.')[1]);
}

function choice(rng: SeededRng, prompt: string, answer: string | number, candidates: readonly (string | number)[], count = 4): ExtendedQuestionDraft {
    const unique = Array.from(new Set(candidates.map(String))).filter((value) => value !== String(answer));
    for (const fallback of ['其他', '都不是', '无法判断']) {
        if (unique.length >= Math.max(1, count - 1)) break;
        if (fallback !== String(answer) && !unique.includes(fallback)) unique.push(fallback);
    }
    const values = rng.shuffle([String(answer), ...rng.shuffle(unique).slice(0, Math.max(1, count - 1))]);
    const targets = values.map((text, index) => ({ id: `t${index}`, text, value: text }));
    return { prompt, targets, correctTargetIds: [targets.find((target) => target.text === String(answer))!.id] };
}

function pairChoice(rng: SeededRng, prompt: string, answers: readonly (string | number)[], distractors: readonly (string | number)[]): ExtendedQuestionDraft {
    const answerText = answers.map(String);
    const values = rng.shuffle([...answerText, ...rng.shuffle(Array.from(new Set(distractors.map(String))).filter((value) => !answerText.includes(value))).slice(0, 2)]);
    const targets = values.map((text, index) => ({ id: `t${index}`, text, value: text }));
    return { prompt, targets, correctTargetIds: targets.filter((target) => answerText.includes(target.text)).map((target) => target.id) };
}

function ordered(rng: SeededRng, prompt: string, values: readonly (string | number)[]): ExtendedQuestionDraft {
    const source = values.map((value, order) => ({ text: String(value), order }));
    const targets = rng.shuffle(source).map((item, index) => ({ id: `t${index}`, text: item.text, value: item.order, attributes: { order: item.order } }));
    const ids = [...targets].sort((a, b) => Number(a.value) - Number(b.value)).map((target) => target.id);
    return { prompt, targets, correctTargetIds: ids, orderedTargetIds: ids };
}

function wrongSpelling(word: string): string {
    if (word.length < 2) return `${word}X`;
    const chars = Array.from(word);
    [chars[0], chars[1]] = [chars[1], chars[0]];
    return chars.join('');
}

function expressionValue(expression: string): number {
    const match = expression.match(/^(\d+)([+\-×÷])(\d+)$/);
    if (!match) return 0;
    const a = Number(match[1]), b = Number(match[3]);
    return match[2] === '+' ? a + b : match[2] === '-' ? a - b : match[2] === '×' ? a * b : a / b;
}

function isPrime(value: number): boolean {
    if (value < 2) return false;
    for (let i = 2; i * i <= value; i++) if (value % i === 0) return false;
    return true;
}

function mathDraft(definition: QuestionTypeDefinition, rng: SeededRng, stage: 0 | 1 | 2): ExtendedQuestionDraft {
    const n = questionNumber(definition), a = rng.int(2, 9 + stage * 4), b = rng.int(2, 9 + stage * 3);
    if (n === 1) return choice(rng, `${a}+${b}=?`, a + b, [a + b - 2, a + b - 1, a + b + 1, a + b + 2]);
    if (n === 2) return choice(rng, `${a + b}-${b}=?`, a, [a - 2, a - 1, a + 1, a + 2]);
    if (n === 3) return choice(rng, `${a}×${b}=?`, a * b, [a * b - a, a * b + a, a * b - b, a * b + b]);
    if (n === 4) return choice(rng, `${a * b}÷${b}=?`, a, [a - 2, a - 1, a + 1, a + 2]);
    if (n >= 5 && n <= 9) {
        const threshold = 10, values = [6, 9, 12, 15];
        const predicate = n === 5 ? (value: number) => value % 2 === 0
            : n === 6 ? (value: number) => value % 2 !== 0
                : n === 7 ? (value: number) => value % 3 === 0
                    : n === 8 ? (value: number) => value > threshold
                        : (value: number) => value < threshold;
        const prompt = n === 5 ? '偶数' : n === 6 ? '奇数' : n === 7 ? '3的倍数' : n === 8 ? `大于${threshold}` : `小于${threshold}`;
        const answer = values.find(predicate)!;
        return choice(rng, prompt, answer, values.filter((value) => !predicate(value)));
    }
    if (n === 10 || n === 11) {
        const values = [a, b, a + b, a * 2];
        return choice(rng, n === 10 ? '最大的' : '最小的', n === 10 ? Math.max(...values) : Math.min(...values), values);
    }
    if (n === 12) return ordered(rng, '从小到大', [a, a + 2, a + 4, a + 6]);
    if (n === 13) return choice(rng, `${a},${a + 2},${a + 4},?`, a + 6, [a + 5, a + 7, a + 8]);
    if (n >= 14 && n <= 18) {
        if (n === 14) return choice(rng, `( )+${b}=${a + b}`, a, [a - 1, a + 1, b]);
        if (n === 15) return choice(rng, `${a}+( )=${a + b}`, b, [b - 1, b + 1, a]);
        if (n === 16) return choice(rng, `( )-${b}=${a}`, a + b, [a + b - 1, a + b + 1, a]);
        if (n === 17) return choice(rng, `${a + b}-( )=${a}`, b, [b - 1, b + 1, a]);
        return choice(rng, `( )×${b}=${a * b}`, a, [a - 1, a + 1, b]);
    }
    if (n === 19 || n === 20) {
        const target = n === 19 ? a + b : a;
        const answer = n === 19 ? `${a}+${b}` : `${a + b}-${b}`;
        return choice(rng, `结果等于${target}`, answer, n === 19 ? [`${a}+${b + 1}`, `${a + 1}+${b + 1}`, `${a}+${b - 1}`] : [`${a + b + 1}-${b}`, `${a + b}-${b + 1}`, `${a + b + 2}-${b}`]);
    }
    if (n >= 21 && n <= 24) {
        const operation = n === 21 ? '+' : n === 22 ? '-' : n === 23 ? '×' : '÷';
        const left = n === 24 ? a * b : n === 22 ? a + b : a, right = b;
        const target = operation === '+' ? left + right : operation === '-' ? left - right : operation === '×' ? left * right : left / right;
        return pairChoice(rng, `选两数，使${operation === '+' ? '和' : operation === '-' ? '差' : operation === '×' ? '积' : '商'}为${target}`, [left, right], [left + 1, right + 2, Math.max(1, left - 1), right + 3]);
    }
    if (n === 25) return ordered(rng, `斩出 ${a}×${b}`, [a, '×', b]);
    if (n === 26 || n === 27) {
        const result = a * b, answer = n === 26 ? '×' : rng.pick(['+', '-', '÷']);
        return choice(rng, n === 26 ? `${a} ? ${b}=${result}` : `${a} ? ${b}≠${result}`, answer, ['+', '-', '×', '÷']);
    }
    if (n === 28) {
        const correct = rng.next() < .5, shown = correct ? a * b : a * b + rng.pick([-2, -1, 1, 2]);
        return choice(rng, `${a}×${b}=${shown}`, correct ? '对' : '错', ['对', '错'], 2);
    }
    const expressions = [`${a}+${b}`, `${a + 2}-${b}`, `${a}×${b}`, `${a * b}÷${b}`];
    if (n === 29 || n === 30) {
        const equations = expressions.map((value, index) => `${value}=${expressionValue(value) + (n === 29 ? index === 1 ? 1 : 0 : index === 0 ? 0 : 1)}`);
        const answer = n === 29 ? equations[1] : equations[0];
        return choice(rng, n === 29 ? '找错误算式' : '找正确算式', answer, equations);
    }
    if (n === 31) {
        const left = `${a}×${b}`, right = `${a + b}+${b}`;
        const answer = expressionValue(left) === expressionValue(right) ? '=' : expressionValue(left) > expressionValue(right) ? '>' : '<';
        return choice(rng, `${left} ? ${right}`, answer, ['>', '<', '='], 3);
    }
    if (n >= 32 && n <= 35) {
        const unique = Array.from(new Set(expressions));
        if (n === 34 || n === 35) return ordered(rng, n === 34 ? '按结果从小到大' : '按结果从大到小', [...unique].sort((x, y) => (expressionValue(x) - expressionValue(y)) * (n === 34 ? 1 : -1)));
        const answer = [...unique].sort((x, y) => (expressionValue(x) - expressionValue(y)) * (n === 32 ? -1 : 1))[0];
        return choice(rng, n === 32 ? '结果最大的算式' : '结果最小的算式', answer, unique);
    }
    if (n === 36 || n === 37) {
        const wantedEven = n === 36;
        const values = [`${a}+${b}`, `${a}+${b + 1}`, `${a + 2}+${b}`, `${a + 1}+${b + 1}`];
        const answer = values.find((value) => expressionValue(value) % 2 === (wantedEven ? 0 : 1))!;
        const distractors = values.filter((value) => value !== answer && expressionValue(value) % 2 !== (wantedEven ? 0 : 1));
        return choice(rng, wantedEven ? '结果为偶数' : '结果为奇数', answer, distractors);
    }
    if (n >= 38 && n <= 43 || n >= 56) {
        let values = rng.shuffle([11, 12, 15, 17, 18, 21, 25, 30, 35, 42]).slice(0, 4);
        let prompt = '选择符合条件的数', predicate: (value: number) => boolean = (value) => isPrime(value);
        if (n === 39) { prompt = '合数'; predicate = (value) => value > 1 && !isPrime(value); }
        if (n === 40) { prompt = '能被3整除'; predicate = (value) => value % 3 === 0; }
        if (n === 41) { prompt = '不能被3整除'; predicate = (value) => value % 3 !== 0; }
        if (n === 42) { prompt = '30的因数'; predicate = (value) => 30 % value === 0; }
        if (n === 43) {
            prompt = '5的倍数'; predicate = (value) => value % 5 === 0;
            // Multi-select must always expose at least two real matches.
            values = rng.shuffle([10, 15, 12, 17]);
        }
        if (n === 56) { prompt = '20到30之间'; predicate = (value) => value >= 20 && value <= 30; }
        if (n === 57) { prompt = '大于10且为偶数'; predicate = (value) => value > 10 && value % 2 === 0; }
        if (n === 58) { prompt = '不是3的倍数'; predicate = (value) => value % 3 !== 0; }
        if (n === 59) { values = [7, 25, 108, 9]; prompt = '两位数'; predicate = (value) => value >= 10 && value <= 99; }
        if (n === 60) { values = [15, 21, 35, 42]; prompt = '个位是5'; predicate = (value) => value % 10 === 5; }
        const matches = values.filter(predicate);
        if (!matches.length) values[0] = n === 38 ? 17 : n === 39 ? 21 : n === 59 ? 25 : n === 60 ? 35 : 30;
        if (n !== 43) {
            const answer = values.find(predicate)!;
            return choice(rng, prompt, answer, values.filter((value) => !predicate(value)));
        }
        return pairChoice(rng, prompt, values.filter(predicate).slice(0, 2), values.filter((value) => !predicate(value)));
    }
    if (n >= 44 && n <= 49) {
        if (n === 44) return choice(rng, '2,4,_,8,10', 6, [5, 7, 9, 12]);
        if (n === 45) return choice(rng, '2,4,8,16,?', 32, [20, 24, 30, 34]);
        if (n === 46) return choice(rng, '1,2,4,7,11,?', 16, [14, 15, 17, 18]);
        if (n === 47) return choice(rng, '2,5,4,7,6,?', 9, [8, 10, 11, 12]);
        if (n === 48) return choice(rng, '1,10,2,20,3,?', 30, [4, 25, 35, 40]);
        return choice(rng, '找错误项：2,4,7,8', 7, [2, 4, 8]);
    }
    if (n === 50) return pairChoice(rng, '找重复数字', [a, a], [b, b + 1]);
    if (n === 51) {
        const targets = [a, a, b, b + 1, b + 1].map((value, index) => ({ id: `t${index}`, text: String(value), value }));
        return { prompt: '找唯一未重复', targets: rng.shuffle(targets), correctTargetIds: [targets[2].id] };
    }
    if (n === 52 || n === 53) {
        const base = n === 52 ? 10 : 100, shown = n === 52 ? rng.int(1, 9) : rng.int(1, 9) * 10;
        return choice(rng, `${shown}凑${base}`, base - shown, [base - shown - 1, base - shown + 1, shown]);
    }
    const target = 50, values = [target - 3, target + 8, target - 12, target + 15];
    const answer = [...values].sort((x, y) => (Math.abs(x - target) - Math.abs(y - target)) * (n === 54 ? 1 : -1))[0];
    return choice(rng, n === 54 ? `最接近${target}` : `离${target}最远`, answer, values);
}

function visionDraft(definition: QuestionTypeDefinition, rng: SeededRng): ExtendedQuestionDraft {
    const n = questionNumber(definition), arrows = ['←', '↑', '→', '↓'], shapes = ['●', '▲', '■', '◆'];
    if (n === 1) { const arrow = rng.pick(arrows); return choice(rng, `找相同 ${arrow}`, arrow, arrows); }
    if (n === 2) { const arrow = rng.pick(arrows); const opposite: Relation = { '←': '→', '→': '←', '↑': '↓', '↓': '↑' }; return choice(rng, `${arrow}的反向`, opposite[arrow], arrows); }
    if (n === 3) return choice(rng, '找不同', '○', ['●', '●', '●']);
    if (n === 4) return choice(rng, '找3个点', '•••', ['•', '••', '••••']);
    if (n === 5) {
        const targets: TargetSpec[] = [{ id: 't0', text: '蓝', colorName: '红' }, { id: 't1', text: '红', colorName: '蓝' }, { id: 't2', text: '黄', colorName: '绿' }, { id: 't3', text: '绿', colorName: '黄' }];
        return { prompt: '字体颜色·红', targets, correctTargetIds: ['t0'] };
    }
    if (n === 6) return choice(rng, '●▲●▲?', '●', shapes);
    if (n === 7) return choice(rng, '↑→↓?', '←', arrows);
    if (n === 8) return choice(rng, '●▲▲●▲▲?', '●', shapes);
    if (n === 9) return choice(rng, '1,9,1,9,?', '1', ['2', '8', '9']);
    if (n === 10) return choice(rng, '小中大小中?', '大', ['小', '中', '特大']);
    if (n === 11) return choice(rng, '找相同 ●△', '●△', ['△●', '●▲', '○△']);
    if (n === 12 || n === 14) return pairChoice(rng, n === 12 ? '找成对图形' : '找唯一相同', ['●', '●'], ['▲', '■']);
    if ([13, 25, 26, 27, 28, 29].includes(n)) return choice(rng, definition.label, '◒', ['●', '●', '●']);
    if (n === 24) {
        const targets: TargetSpec[] = [
            { id: 't0', text: '↑', colorName: '红', attributes: { color: '红', direction: '上' } },
            { id: 't1', text: '←', colorName: '蓝', attributes: { color: '蓝', direction: '左' } },
            { id: 't2', text: '→', colorName: '红', attributes: { color: '红', direction: '右' } },
            { id: 't3', text: '↓', colorName: '黄', attributes: { color: '黄', direction: '下' } },
        ];
        return { prompt: '选择蓝色左箭头', targets, correctTargetIds: ['t1'] };
    }
    if (n >= 15 && n <= 19) {
        const targets: TargetSpec[] = [
            { id: 't0', text: '▲', colorName: '红', attributes: { color: '红', shape: '三角', outline: false, direction: '上' } },
            { id: 't1', text: '○', colorName: '蓝', attributes: { color: '蓝', shape: '圆', outline: true, direction: '左' } },
            { id: 't2', text: '●', colorName: '红', attributes: { color: '红', shape: '圆', outline: false, direction: '右' } },
            { id: 't3', text: '△', colorName: '黄', attributes: { color: '黄', shape: '三角', outline: true, direction: '下' } },
        ];
        let condition: ConditionExpr | undefined;
        if (n === 15) condition = { kind: 'and', conditions: [
            { kind: 'predicate', attribute: 'color', operator: 'eq', value: '红' },
            { kind: 'predicate', attribute: 'shape', operator: 'eq', value: '三角' },
        ] };
        if (n === 18) condition = { kind: 'and', conditions: [
            { kind: 'predicate', attribute: 'color', operator: 'eq', value: '蓝' },
            { kind: 'predicate', attribute: 'outline', operator: 'eq', value: true },
        ] };
        if (n === 19) condition = { kind: 'or', conditions: [
            { kind: 'predicate', attribute: 'color', operator: 'eq', value: '红' },
            { kind: 'predicate', attribute: 'shape', operator: 'eq', value: '三角' },
        ] };
        const correct = condition ? compileCondition(targets, condition) : n === 16 ? ['t1'] : n === 17 ? ['t0'] : ['t1'];
        const prompts: Readonly<Record<number, string>> = {
            15: '选择红色三角形',
            16: '选择非红色圆形',
            17: '选择红色实心三角',
            18: '选择蓝色空心圆',
            19: '选择红色或三角形',
        };
        return { prompt: prompts[n], targets, correctTargetIds: correct };
    }
    if (n >= 20 && n <= 23) return choice(rng, definition.label, '◁▷', ['▷◁', '△▽', '◁◁']);
    if (n === 30) return choice(rng, '哪组有4个点', '••••', ['••', '•••', '•••••']);
    if (n >= 31 && n <= 34) {
        const values = [1, 2, 3, 4];
        const sorted = n === 31 || n === 32 || n === 33 ? [...values].sort((a, b) => b - a) : [...values].sort((a, b) => a - b);
        const answer = n === 33 || n === 34 ? sorted[1] : sorted[0];
        return choice(rng, definition.label, shapes[answer - 1].repeat(answer), values.filter((value) => value !== answer).map((value) => shapes[value - 1].repeat(value)));
    }
    if (n === 35) return ordered(rng, '从小到大', ['小', '中', '大']);
    if (n === 36) return ordered(rng, '红→黄→蓝', ['红', '黄', '蓝']);
    if (n === 37) return ordered(rng, '上→右→下→左', ['↑', '→', '↓', '←']);
    if (n === 38 || n === 39) return choice(rng, n === 38 ? '找对称图形' : '找不对称图形', n === 38 ? '◇' : '◩', ['◇', '○', '□']);
    if (n === 40) return choice(rng, '○与△叠加', '◉△', ['○△', '◎', '◇']);
    return choice(rng, '哪个能拆成○和△', '○△', ['○□', '△□', '◇◇']);
}

function pickOther<T>(rng: SeededRng, items: readonly T[], current: T, count = 3): T[] {
    return rng.shuffle(items.filter((item) => item !== current)).slice(0, count);
}

function hanziDraft(definition: QuestionTypeDefinition, rng: SeededRng): ExtendedQuestionDraft {
    const n = questionNumber(definition);
    if (n === 1) {
        const idiom = rng.pick(IDIOMS);
        return choice(rng, `${idiom.text.slice(0, idiom.missingIndex)}( )${idiom.text.slice(idiom.missingIndex + 1)}`, idiom.text[idiom.missingIndex], idiom.wrong);
    }
    if (n === 2) return ordered(rng, '排成语', Array.from(rng.pick(IDIOMS.filter((item) => new Set(item.text).size === 4)).text));
    if (n === 3) { const item = rng.pick(HANZI_ANTONYMS); return choice(rng, `${item[0]}的反义词`, item[1], pickOther(rng, HANZI_ANTONYMS.map((pair) => pair[1]), item[1])); }
    if (n === 4) { const item = rng.pick(HANZI_SYNONYMS); return choice(rng, `${item[0]}的近义词`, item[1], pickOther(rng, HANZI_SYNONYMS.map((pair) => pair[1]), item[1])); }
    const installedPinyin = structuredContent('pinyin').map((record) => [record.data.character, record.data.pinyin, record.data.homophone, record.data.tone] as const)
        .filter((item): item is readonly [string, string, string, string] => item.every((value) => typeof value === 'string'));
    const pinyinPool = installedPinyin.length >= 12 ? installedPinyin : PINYIN;
    const pinyin = rng.pick(pinyinPool), pinyinAnswers = pinyinPool.map((item) => item[1]), chars = pinyinPool.map((item) => item[0]);
    if (n === 5) return choice(rng, `${pinyin[0]}的拼音`, pinyin[1], pickOther(rng, pinyinAnswers, pinyin[1]));
    if (n === 6) return choice(rng, `${pinyin[1]}是哪个字`, pinyin[0], pickOther(rng, chars, pinyin[0]));
    if (n === 7) return choice(rng, `${pinyin[0]}的声调`, pinyin[3], ['一声', '二声', '三声', '四声']);
    if (n === 8) return choice(rng, `与${pinyin[0]}同音`, pinyin[2], pickOther(rng, PINYIN.map((item) => item[2]), pinyin[2]));
    if (n === 9) return choice(rng, `与${pinyin[0]}形近`, pinyin[2], pickOther(rng, chars, pinyin[0]));
    if (n === 10 || n === 11 || n === 26) {
        const idiom = rng.pick(IDIOMS), correct = idiom.text[idiom.missingIndex], wrong = idiom.wrong[0];
        return choice(rng, n === 10 || n === 26 ? `${idiom.text.slice(0, idiom.missingIndex)}${wrong}${idiom.text.slice(idiom.missingIndex + 1)}` : '找正确汉字', n === 10 || n === 26 ? wrong : correct, n === 10 || n === 26 ? Array.from(idiom.text) : idiom.wrong);
    }
    const radical = rng.pick(RADICALS);
    if (n === 12) return pairChoice(rng, `找“${radical[1]}”部的两个字`, [radical[0], radical[2]], pickOther(rng, RADICALS.map((item) => item[0]), radical[0]));
    if (n === 13) return choice(rng, `部首：${radical[1]}`, radical[0], pickOther(rng, RADICALS.map((item) => item[0]), radical[0]));
    if (n === 14) return choice(rng, `与${radical[0]}同部首`, radical[2], pickOther(rng, RADICALS.map((item) => item[2]), radical[2]));
    const word = rng.pick(WORD_PAIRS);
    if (n === 15 || n === 16) return pairChoice(rng, '组成词语', word, pickOther(rng, WORD_PAIRS.reduce<string[]>((all, pair) => [...all, ...pair], []), word[0]));
    if (n === 17) return ordered(rng, '组成词语', word);
    if (n === 18) return ordered(rng, '组成短句', ['我们', '热爱', '生活']);
    if (n === 19) { const item = rng.pick(MEASURE_WORDS); return choice(rng, `一＿${item[0]}`, item[1], pickOther(rng, MEASURE_WORDS.map((x) => x[1]), item[1])); }
    if (n === 20) { const item = rng.pick(COLLOCATIONS); return choice(rng, item[0], item[1], pickOther(rng, COLLOCATIONS.map((x) => x[1]), item[1])); }
    if (n === 21) return choice(rng, '找不同类', '桌子', ['苹果', '香蕉', '葡萄']);
    if (n >= 22 && n <= 24) {
        const installedPoetry = structuredContent('poetry-fragment').map((record) => [record.data.prompt, record.data.answer, record.data.distractors] as const)
            .filter((item): item is readonly [string, string, readonly string[]] => typeof item[0] === 'string' && typeof item[1] === 'string' && Array.isArray(item[2]) && item[2].every((value) => typeof value === 'string'));
        const poem = rng.pick(installedPoetry.length >= 12 ? installedPoetry : POETRY);
        return choice(rng, poem[0], poem[1], poem[2]);
    }
    if (n === 25) return choice(rng, '竹篮打水——', '一场空', ['节节高', '里外红', '团团转']);
    if (n === 27) return pairChoice(rng, '找近义成语', ['聚精会神', '全神贯注'], ['东张西望', '三心二意']);
    return pairChoice(rng, '找反义成语', ['坚持不懈', '半途而废'], ['全神贯注', '聚精会神']);
}

function englishDraft(definition: QuestionTypeDefinition, rng: SeededRng): ExtendedQuestionDraft {
    const n = questionNumber(definition), word = rng.pick(ENGLISH_WORDS), pool = ENGLISH_WORDS.map((item) => item.en);
    if (n === 1) return choice(rng, `${word.en}是？`, word.zh, pickOther(rng, ENGLISH_WORDS.map((item) => item.zh), word.zh));
    if (n === 2) return choice(rng, `选择${word.category}单词`, word.en, ENGLISH_WORDS.filter((item) => item.category !== word.category).map((item) => item.en));
    if (n === 3) { const item = rng.pick(ENGLISH_ANTONYMS); return choice(rng, `${item[0]}的反义词`, item[1], pickOther(rng, ENGLISH_ANTONYMS.map((pair) => pair[1]), item[1])); }
    if (n === 4) return choice(rng, word.zh, word.en, pickOther(rng, pool, word.en));
    const relation = rng.pick(ENGLISH_RELATIONS);
    if (n === 5) return choice(rng, relation[0], relation[3], pickOther(rng, ENGLISH_RELATIONS.map((item) => item[3]), relation[3]));
    const wrong = wrongSpelling(word.en);
    if (n === 6) return choice(rng, '拼写正确', word.en, [wrong, `${word.en}E`, word.en.slice(0, -1)]);
    if (n === 7) return choice(rng, '拼写错误', wrong, [word.en, ...pickOther(rng, pool, word.en, 2)]);
    if (n === 8) { const index = Math.min(1, word.en.length - 1); return choice(rng, `${word.en.slice(0, index)}_${word.en.slice(index + 1)}`, word.en[index], ['A', 'E', 'I', 'O']); }
    if (n === 9) return choice(rng, `${word.en.slice(1)}的首字母`, word.en[0], ['A', 'B', 'C', 'D']);
    if (n === 10) return choice(rng, `${word.en.slice(0, -1)}_`, word.en.charAt(word.en.length - 1), ['A', 'E', 'S', 'T']);
    if (n === 11) return ordered(rng, '组成单词', Array.from(relation[0]));
    if (n === 12) return choice(rng, `与${word.en}同首字母`, pool.find((item) => item !== word.en && item[0] === word.en[0]) ?? relation[0], pickOther(rng, pool, word.en));
    if (n === 13) return choice(rng, '找不同类别', 'RUN', ['CAT', 'DOG', 'BIRD']);
    if (n === 14) return pairChoice(rng, '单复数配对', [relation[0], relation[1]], ['DOG', 'BOOKS']);
    if (n === 15) return pairChoice(rng, '大小写配对', [relation[0], relation[0].toLowerCase()], ['ABC', 'xyz']);
    if (n === 16) return choice(rng, `${relation[0]}的小写`, relation[0].toLowerCase(), ['abc', 'xyz', 'word']);
    if (n === 17) { const item = rng.pick(ENGLISH_SYNONYMS); return choice(rng, `${item[0]}的近义词`, item[1], pickOther(rng, ENGLISH_SYNONYMS.map((x) => x[1]), item[1])); }
    if (n === 18) return pairChoice(rng, '中英配对', [relation[0], relation[2]], ['DOG', '书']);
    if (n === 19) return choice(rng, 'I ___ happy.', 'AM', ['IS', 'ARE', 'BE']);
    if (n === 20) return pairChoice(rng, '数字英文配对', ['7', 'SEVEN'], ['6', 'EIGHT']);
    if (n === 21) return pairChoice(rng, '颜色英文配对', ['红色', 'RED'], ['蓝色', 'GREEN']);
    if (n === 22) { const start = rng.int(0, 3); return ordered(rng, '星期顺序', WEEKDAYS.slice(start, start + 4)); }
    const start = rng.int(0, 8); return ordered(rng, '月份顺序', MONTHS.slice(start, start + 4));
}

function lifeDraft(definition: QuestionTypeDefinition, rng: SeededRng): ExtendedQuestionDraft {
    const n = questionNumber(definition), item = rng.pick(LIFE_RELATIONS), allItems = LIFE_RELATIONS.map((entry) => entry.item);
    if (n === 1) return choice(rng, item.category, item.item, pickOther(rng, allItems, item.item));
    if (n >= 2 && n <= 6) {
        const key = n === 2 ? 'garbage' : n === 3 ? 'transport' : n === 4 ? 'food' : n === 5 ? 'plant' : 'animal';
        return choice(rng, `${key === 'garbage' ? '垃圾分类' : key === 'transport' ? '交通工具' : key === 'food' ? '食物' : key === 'plant' ? '水果或蔬菜' : '动物分类'}：${item.item}`, item[key] ?? '否', Array.from(new Set(LIFE_RELATIONS.map((entry) => entry[key] ?? '否'))));
    }
    if (n >= 7 && n <= 10 || n === 16 || n === 17) {
        const key = n === 7 ? 'job' : n === 8 ? 'place' : n === 9 ? 'weather' : n === 10 ? 'season' : n === 16 ? 'use' : 'source';
        return choice(rng, `${item.item}匹配什么`, item[key], pickOther(rng, LIFE_RELATIONS.map((entry) => entry[key]), item[key]));
    }
    if (n === 11 || n === 12) {
        const safe = n === 11, behavior = rng.pick(safe ? SAFE_BEHAVIORS : DANGEROUS_BEHAVIORS);
        return choice(rng, behavior, safe ? '安全' : '危险', ['安全', '危险'], 2);
    }
    if (n === 13) return choice(rng, '红灯表示什么', '停止', ['通行', '加速', '鸣笛']);
    if (n === 14) return ordered(rng, '生活流程', DAILY_FLOW);
    if (n === 15) return choice(rng, '晚上应该做什么', '睡觉', ['吃早餐', '上学', '晨练']);
    return choice(rng, '熊猫喜欢吃什么', '竹子', ['青草', '鱼', '坚果']);
}

function geographyDraft(definition: QuestionTypeDefinition, rng: SeededRng): ExtendedQuestionDraft {
    const n = questionNumber(definition), country = rng.pick(COUNTRY_EXT), countries = COUNTRY_EXT.map((item) => item.country);
    if (n === 1) return choice(rng, `${country.country}的首都`, country.capital, pickOther(rng, COUNTRY_EXT.map((item) => item.capital), country.capital));
    if (n === 2) return choice(rng, `${country.capital}属于`, country.country, pickOther(rng, countries, country.country));
    if (n === 3) return choice(rng, `${country.country}所在大洲`, country.continent, pickOther(rng, Array.from(new Set(COUNTRY_EXT.map((item) => item.continent))), country.continent));
    if (n === 4) return choice(rng, `${country.continent}的国家`, country.country, COUNTRY_EXT.filter((item) => item.continent !== country.continent).map((item) => item.country));
    if (n === 9) return choice(rng, `${country.country}的货币`, country.currency, pickOther(rng, Array.from(new Set(COUNTRY_EXT.map((item) => item.currency))), country.currency));
    const province = rng.pick(PROVINCES);
    if (n === 10) return choice(rng, `${province[0]}的省会`, province[1], pickOther(rng, PROVINCES.map((item) => item[1]), province[1]));
    if (n === 11) return choice(rng, `${province[1]}属于`, province[0], pickOther(rng, PROVINCES.map((item) => item[0]), province[0]));
    if (n === 12) return choice(rng, `${province[2]}属于`, province[0], pickOther(rng, PROVINCES.map((item) => item[0]), province[0]));
    const relation = rng.pick(n === 13 ? RIVERS : n === 14 ? MOUNTAINS : WORLD_RECORDS);
    return choice(rng, relation[0], relation[1], pickOther(rng, (n === 13 ? RIVERS : n === 14 ? MOUNTAINS : WORLD_RECORDS).map((item) => item[1]), relation[1]));
}

function knowledgeDraft(definition: QuestionTypeDefinition, rng: SeededRng): ExtendedQuestionDraft {
    const n = questionNumber(definition);
    if (definition.theme === 'history') {
        if (n <= 18) {
            const start = rng.int(0, HISTORY_EVENTS.length - 4);
            return ordered(rng, n === 16 ? '历史事件排序' : n === 17 ? '朝代排序' : '人物年代排序', HISTORY_EVENTS.slice(start, start + 4).map((item) => item[0]));
        }
        return ordered(rng, n === 19 ? '科学过程排序' : '生命周期排序', rng.pick(SCIENCE_PROCESSES));
    }
    const relation = rng.pick(KNOWLEDGE_RELATIONS);
    if (n <= 3) {
        const trueFact = `${relation[0]}—${relation[1]}`, wrong = `${relation[0]}—${rng.pick(KNOWLEDGE_RELATIONS.filter((item) => item[1] !== relation[1]))[1]}`;
        return choice(rng, n === 2 ? '选择错误事实' : trueFact, n === 2 ? wrong : n === 3 ? '对' : trueFact, n === 3 ? ['对', '错'] : [wrong, ...KNOWLEDGE_RELATIONS.slice(0, 2).map((item) => `${item[0]}—${item[1]}`)], n === 3 ? 2 : 4);
    }
    if (n >= 4 && n <= 10) {
        const relationKind = n === 4 || n === 5 ? '人物事件' : n === 6 ? '发明' : n === 7 ? '栖息地'
            : n === 8 ? '食物' : n === 9 ? '植物特征' : '器官功能';
        const pool = KNOWLEDGE_RELATIONS.filter((item) => item[2] === relationKind);
        const selected = rng.pick(pool);
        const reverseDirection = n === 5 || n === 6;
        const prompt = n === 4 ? `${selected[0]}相关的是`
            : n === 5 ? `${selected[1]}对应人物`
                : n === 6 ? `${selected[1]}发明者`
                    : n === 7 ? `${selected[0]}栖息地`
                        : n === 8 ? `${selected[0]}的食物`
                            : n === 9 ? `${selected[0]}的特征`
                                : `${selected[0]}的功能`;
        const answer = selected[reverseDirection ? 0 : 1];
        const candidates = pool.map((item) => item[reverseDirection ? 0 : 1]);
        return choice(rng, prompt, answer, pickOther(rng, candidates, answer));
    }
    if (n === 11) return choice(rng, '哺乳动物', '熊猫', ['青蛙', '鲫鱼', '麻雀']);
    if (n === 12) return choice(rng, '开花植物', '向日葵', ['海带', '苔藓', '蕨类']);
    if (n === 13) return choice(rng, '常温下是气体', '氧气', ['水', '铁', '食盐']);
    if (n === 14) return choice(rng, '可再生能源', '太阳能', ['煤炭', '石油', '天然气']);
    return choice(rng, '属于古代', '唐朝', ['辛亥革命', '五四运动', '改革开放']);
}

export function generateExtendedQuestion(definition: QuestionTypeDefinition, rng: SeededRng, stage: 0 | 1 | 2): ExtendedQuestionDraft {
    let draft: ExtendedQuestionDraft;
    switch (definition.theme) {
        case 'math': draft = mathDraft(definition, rng, stage); break;
        case 'vision': draft = visionDraft(definition, rng); break;
        case 'hanzi': draft = hanziDraft(definition, rng); break;
        case 'english': draft = englishDraft(definition, rng); break;
        case 'life': draft = lifeDraft(definition, rng); break;
        case 'geography': draft = geographyDraft(definition, rng); break;
        case 'knowledge':
        case 'history': draft = knowledgeDraft(definition, rng); break;
        default: draft = choice(rng, definition.label, '对', ['错'], 2); break;
    }
    return conformToEngine(definition, draft, rng);
}

function conformToEngine(definition: QuestionTypeDefinition, draft: ExtendedQuestionDraft, rng: SeededRng): ExtendedQuestionDraft {
    // Engine compatibility is validated by QuestionGenerator. Semantic data
    // must never be invented here: alphabetically sorting unrelated choices
    // does not create a real sequence, and promoting a distractor does not
    // create a real pair.
    void definition;
    void rng;
    return draft;
}

export function chineseAnswerLength(value: string): number {
    return Array.from(value.replace(/[\s，。！？、；：“”‘’（）()《》—…·,.!?;:'"-]/g, '')).length;
}

export function poetryRecordsAreSafe(): boolean {
    return POETRY.every((record) => chineseAnswerLength(record[1]) >= 1
        && chineseAnswerLength(record[1]) <= 4
        && record[2].every((wrong) => chineseAnswerLength(wrong) >= 1 && chineseAnswerLength(wrong) <= 4));
}
