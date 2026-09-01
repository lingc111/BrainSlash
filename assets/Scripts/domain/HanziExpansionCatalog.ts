export interface PinyinFact {
    id: string;
    character: string;
    pinyin: string;
    homophone: string;
    tone: string;
}

export interface PoetryFact {
    id: string;
    prompt: string;
    answer: string;
    wrong: readonly string[];
}

export const PINYIN_FACTS: readonly PinyinFact[] = [
    { id: 'pinyin.shan', character: '山', pinyin: 'shān', homophone: '扇', tone: '一声' },
    { id: 'pinyin.shui', character: '水', pinyin: 'shuǐ', homophone: '睡', tone: '三声' },
    { id: 'pinyin.hua', character: '花', pinyin: 'huā', homophone: '画', tone: '一声' },
    { id: 'pinyin.niao', character: '鸟', pinyin: 'niǎo', homophone: '尿', tone: '三声' },
    { id: 'pinyin.yue', character: '月', pinyin: 'yuè', homophone: '越', tone: '四声' },
    { id: 'pinyin.feng', character: '风', pinyin: 'fēng', homophone: '丰', tone: '一声' },
    { id: 'pinyin.yu', character: '雨', pinyin: 'yǔ', homophone: '语', tone: '三声' },
    { id: 'pinyin.yun', character: '云', pinyin: 'yún', homophone: '匀', tone: '二声' },
    { id: 'pinyin.ma', character: '马', pinyin: 'mǎ', homophone: '码', tone: '三声' },
    { id: 'pinyin.fish', character: '鱼', pinyin: 'yú', homophone: '余', tone: '二声' },
    { id: 'pinyin.book', character: '书', pinyin: 'shū', homophone: '叔', tone: '一声' },
    { id: 'pinyin.fire', character: '火', pinyin: 'huǒ', homophone: '伙', tone: '三声' },
];

export const POETRY_FACTS: readonly PoetryFact[] = [
    { id: 'poetry.01', prompt: '床前明月( )，疑是地上霜', answer: '光', wrong: ['风', '花', '雪'] },
    { id: 'poetry.02', prompt: '举头望明月，低头思( )', answer: '故乡', wrong: ['远方', '长安', '家园'] },
    { id: 'poetry.03', prompt: '白日依山尽，黄河入( )', answer: '海流', wrong: ['江流', '湖中', '云间'] },
    { id: 'poetry.04', prompt: '春眠不觉晓，处处闻啼( )', answer: '鸟', wrong: ['花', '雨', '风'] },
    { id: 'poetry.05', prompt: '锄禾日当午，汗滴禾下( )', answer: '土', wrong: ['田', '苗', '谷'] },
    { id: 'poetry.06', prompt: '谁知盘中餐，粒粒皆辛( )', answer: '苦', wrong: ['勤', '劳', '甜'] },
    { id: 'poetry.07', prompt: '两个黄鹂鸣翠柳，一行白鹭上( )', answer: '青天', wrong: ['蓝天', '云端', '高山'] },
    { id: 'poetry.08', prompt: '欲穷千里目，更上一层( )', answer: '楼', wrong: ['山', '台', '桥'] },
    { id: 'poetry.09', prompt: '野火烧不尽，春风吹又( )', answer: '生', wrong: ['绿', '来', '起'] },
    { id: 'poetry.10', prompt: '小荷才露尖尖角，早有蜻蜓立( )', answer: '上头', wrong: ['水边', '叶间', '花中'] },
    { id: 'poetry.11', prompt: '桃花潭水深千尺，不及汪伦送我( )', answer: '情', wrong: ['行', '舟', '心'] },
    { id: 'poetry.12', prompt: '飞流直下三千尺，疑是银河落( )', answer: '九天', wrong: ['云端', '人间', '高山'] },
];
