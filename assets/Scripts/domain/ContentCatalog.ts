import type { ThemeId } from './Models';

export type ContentFamilyKind =
    | 'math-add'
    | 'math-subtract'
    | 'math-multiply'
    | 'math-property'
    | 'math-compare'
    | 'math-sequence'
    | 'vision-direction'
    | 'vision-odd'
    | 'vision-count'
    | 'vision-stroop'
    | 'vision-pattern'
    | 'hanzi-fill'
    | 'hanzi-valid'
    | 'hanzi-order'
    | 'english-meaning'
    | 'english-category'
    | 'english-antonym'
    | 'life-use'
    | 'life-category'
    | 'geography-capital'
    | 'geography-country';

export interface ContentFamilySpec {
    id: string;
    theme: ThemeId;
    kind: ContentFamilyKind;
    variant: number;
}

export const CONTENT_FAMILY_TARGETS: Readonly<Record<ThemeId, number>> = {
    math: 30,
    vision: 25,
    hanzi: 15,
    english: 15,
    life: 10,
    geography: 10,
};

const FAMILY_GROUPS: ReadonlyArray<readonly [ThemeId, ContentFamilyKind]> = [
    ['math', 'math-add'],
    ['math', 'math-subtract'],
    ['math', 'math-multiply'],
    ['math', 'math-property'],
    ['math', 'math-compare'],
    ['math', 'math-sequence'],
    ['vision', 'vision-direction'],
    ['vision', 'vision-odd'],
    ['vision', 'vision-count'],
    ['vision', 'vision-stroop'],
    ['vision', 'vision-pattern'],
    ['hanzi', 'hanzi-fill'],
    ['hanzi', 'hanzi-valid'],
    ['hanzi', 'hanzi-order'],
    ['english', 'english-meaning'],
    ['english', 'english-category'],
    ['english', 'english-antonym'],
    ['life', 'life-use'],
    ['life', 'life-category'],
    ['geography', 'geography-capital'],
    ['geography', 'geography-country'],
];

const contentFamilies: ContentFamilySpec[] = [];
for (const [theme, kind] of FAMILY_GROUPS) {
    for (let variant = 0; variant < 5; variant++) {
        contentFamilies.push({ id: `${kind}.v${variant + 1}`, theme, kind, variant });
    }
}
export const CONTENT_FAMILIES: readonly ContentFamilySpec[] = contentFamilies;

export interface IdiomEntry {
    text: string;
    missingIndex: number;
    wrong: readonly string[];
}

export const IDIOMS: readonly IdiomEntry[] = [
    { text: '画龙点睛', missingIndex: 3, wrong: ['晴', '情', '精', '晶'] },
    { text: '一心一意', missingIndex: 3, wrong: ['亿', '忆', '议', '义'] },
    { text: '四面八方', missingIndex: 3, wrong: ['芳', '房', '放', '坊'] },
    { text: '守株待兔', missingIndex: 1, wrong: ['珠', '朱', '蛛', '诸'] },
    { text: '亡羊补牢', missingIndex: 3, wrong: ['劳', '捞', '唠', '涝'] },
    { text: '刻舟求剑', missingIndex: 2, wrong: ['球', '囚', '秋', '丘'] },
    { text: '掩耳盗铃', missingIndex: 3, wrong: ['玲', '零', '龄', '灵'] },
    { text: '井底之蛙', missingIndex: 3, wrong: ['洼', '娃', '哇', '挖'] },
    { text: '狐假虎威', missingIndex: 3, wrong: ['危', '微', '薇', '巍'] },
    { text: '滥竽充数', missingIndex: 1, wrong: ['芋', '宇', '羽', '雨'] },
    { text: '叶公好龙', missingIndex: 2, wrong: ['号', '浩', '耗', '豪'] },
    { text: '杯弓蛇影', missingIndex: 1, wrong: ['工', '功', '攻', '宫'] },
    { text: '对牛弹琴', missingIndex: 3, wrong: ['勤', '秦', '芹', '擒'] },
    { text: '自相矛盾', missingIndex: 2, wrong: ['毛', '茅', '贸', '锚'] },
    { text: '水滴石穿', missingIndex: 3, wrong: ['川', '串', '船', '传'] },
    { text: '愚公移山', missingIndex: 2, wrong: ['疑', '宜', '仪', '怡'] },
    { text: '雪中送炭', missingIndex: 3, wrong: ['碳', '叹', '探', '坛'] },
    { text: '锦上添花', missingIndex: 2, wrong: ['天', '填', '甜', '田'] },
    { text: '拔苗助长', missingIndex: 0, wrong: ['拨', '跋', '钹', '泼'] },
    { text: '惊弓之鸟', missingIndex: 1, wrong: ['工', '功', '攻', '宫'] },
    { text: '胸有成竹', missingIndex: 3, wrong: ['足', '逐', '烛', '筑'] },
    { text: '闻鸡起舞', missingIndex: 0, wrong: ['文', '纹', '蚊', '雯'] },
    { text: '望梅止渴', missingIndex: 3, wrong: ['喝', '褐', '竭', '揭'] },
    { text: '三顾茅庐', missingIndex: 2, wrong: ['毛', '矛', '锚', '茂'] },
    { text: '草木皆兵', missingIndex: 2, wrong: ['接', '街', '阶', '结'] },
    { text: '完璧归赵', missingIndex: 1, wrong: ['壁', '碧', '避', '蔽'] },
    { text: '负荆请罪', missingIndex: 1, wrong: ['京', '经', '晶', '精'] },
    { text: '纸上谈兵', missingIndex: 2, wrong: ['弹', '坛', '痰', '谭'] },
    { text: '卧薪尝胆', missingIndex: 1, wrong: ['新', '心', '欣', '辛'] },
    { text: '破釜沉舟', missingIndex: 1, wrong: ['斧', '府', '辅', '俯'] },
    { text: '指鹿为马', missingIndex: 1, wrong: ['路', '露', '录', '陆'] },
    { text: '买椟还珠', missingIndex: 1, wrong: ['读', '独', '毒', '督'] },
    { text: '南辕北辙', missingIndex: 1, wrong: ['原', '园', '圆', '源'] },
    { text: '门庭若市', missingIndex: 1, wrong: ['廷', '亭', '停', '霆'] },
    { text: '一鸣惊人', missingIndex: 1, wrong: ['明', '名', '铭', '冥'] },
    { text: '入木三分', missingIndex: 3, wrong: ['纷', '芬', '汾', '粉'] },
    { text: '程门立雪', missingIndex: 3, wrong: ['学', '穴', '血', '薛'] },
    { text: '凿壁偷光', missingIndex: 0, wrong: ['造', '燥', '躁', '澡'] },
    { text: '悬梁刺股', missingIndex: 1, wrong: ['粱', '粮', '良', '凉'] },
    { text: '囊萤映雪', missingIndex: 1, wrong: ['莹', '荧', '营', '赢'] },
];

export interface EnglishWord {
    en: string;
    zh: string;
    category: '动物' | '颜色' | '食物' | '动作' | '物品' | '自然';
}

export const ENGLISH_WORDS: readonly EnglishWord[] = [
    { en: 'CAT', zh: '猫', category: '动物' }, { en: 'DOG', zh: '狗', category: '动物' },
    { en: 'BIRD', zh: '鸟', category: '动物' }, { en: 'FISH', zh: '鱼', category: '动物' },
    { en: 'LION', zh: '狮子', category: '动物' }, { en: 'TIGER', zh: '老虎', category: '动物' },
    { en: 'HORSE', zh: '马', category: '动物' }, { en: 'PANDA', zh: '熊猫', category: '动物' },
    { en: 'RED', zh: '红色', category: '颜色' }, { en: 'BLUE', zh: '蓝色', category: '颜色' },
    { en: 'GREEN', zh: '绿色', category: '颜色' }, { en: 'BLACK', zh: '黑色', category: '颜色' },
    { en: 'WHITE', zh: '白色', category: '颜色' }, { en: 'YELLOW', zh: '黄色', category: '颜色' },
    { en: 'PURPLE', zh: '紫色', category: '颜色' }, { en: 'ORANGE', zh: '橙色', category: '颜色' },
    { en: 'APPLE', zh: '苹果', category: '食物' }, { en: 'BREAD', zh: '面包', category: '食物' },
    { en: 'RICE', zh: '米饭', category: '食物' }, { en: 'MILK', zh: '牛奶', category: '食物' },
    { en: 'CAKE', zh: '蛋糕', category: '食物' }, { en: 'EGG', zh: '鸡蛋', category: '食物' },
    { en: 'CHEESE', zh: '奶酪', category: '食物' }, { en: 'SOUP', zh: '汤', category: '食物' },
    { en: 'RUN', zh: '跑', category: '动作' }, { en: 'JUMP', zh: '跳', category: '动作' },
    { en: 'READ', zh: '阅读', category: '动作' }, { en: 'WRITE', zh: '书写', category: '动作' },
    { en: 'SING', zh: '唱歌', category: '动作' }, { en: 'SWIM', zh: '游泳', category: '动作' },
    { en: 'WALK', zh: '行走', category: '动作' }, { en: 'DANCE', zh: '跳舞', category: '动作' },
    { en: 'BOOK', zh: '书', category: '物品' }, { en: 'CHAIR', zh: '椅子', category: '物品' },
    { en: 'CLOCK', zh: '时钟', category: '物品' }, { en: 'PHONE', zh: '手机', category: '物品' },
    { en: 'KEY', zh: '钥匙', category: '物品' }, { en: 'CUP', zh: '杯子', category: '物品' },
    { en: 'TABLE', zh: '桌子', category: '物品' }, { en: 'PEN', zh: '钢笔', category: '物品' },
    { en: 'SUN', zh: '太阳', category: '自然' }, { en: 'MOON', zh: '月亮', category: '自然' },
    { en: 'RAIN', zh: '雨', category: '自然' }, { en: 'SNOW', zh: '雪', category: '自然' },
    { en: 'RIVER', zh: '河流', category: '自然' }, { en: 'MOUNTAIN', zh: '山', category: '自然' },
];

export const ENGLISH_ANTONYMS: readonly (readonly [string, string])[] = [
    ['BIG', 'SMALL'], ['HOT', 'COLD'], ['FAST', 'SLOW'], ['UP', 'DOWN'], ['LEFT', 'RIGHT'],
    ['OPEN', 'CLOSE'], ['HAPPY', 'SAD'], ['OLD', 'YOUNG'], ['DAY', 'NIGHT'], ['LIGHT', 'DARK'],
    ['HIGH', 'LOW'], ['LONG', 'SHORT'], ['EASY', 'HARD'], ['EARLY', 'LATE'], ['FULL', 'EMPTY'],
    ['START', 'STOP'], ['PUSH', 'PULL'], ['IN', 'OUT'], ['ABOVE', 'BELOW'], ['SAME', 'DIFFERENT'],
];

export interface LifeFact {
    item: string;
    use: string;
    category: '清洁工具' | '厨房用品' | '学习用品' | '安全用品' | '交通工具' | '穿戴物品';
}

export const LIFE_FACTS: readonly LifeFact[] = [
    { item: '雨伞', use: '雨天防雨', category: '穿戴物品' }, { item: '手电筒', use: '照亮黑暗', category: '安全用品' },
    { item: '尺子', use: '测量长度', category: '学习用品' }, { item: '扫帚', use: '清扫地面', category: '清洁工具' },
    { item: '拖把', use: '拖洗地面', category: '清洁工具' }, { item: '抹布', use: '擦拭桌面', category: '清洁工具' },
    { item: '牙刷', use: '清洁牙齿', category: '清洁工具' }, { item: '菜刀', use: '切菜', category: '厨房用品' },
    { item: '锅', use: '烹煮食物', category: '厨房用品' }, { item: '筷子', use: '夹取食物', category: '厨房用品' },
    { item: '水壶', use: '烧水', category: '厨房用品' }, { item: '橡皮', use: '擦除铅笔字', category: '学习用品' },
    { item: '铅笔', use: '书写绘图', category: '学习用品' }, { item: '圆规', use: '画圆', category: '学习用品' },
    { item: '胶带', use: '粘合物品', category: '学习用品' }, { item: '灭火器', use: '扑灭初起火灾', category: '安全用品' },
    { item: '救生圈', use: '水上救生', category: '安全用品' }, { item: '安全帽', use: '保护头部', category: '安全用品' },
    { item: '口罩', use: '遮挡飞沫', category: '安全用品' }, { item: '自行车', use: '脚踏出行', category: '交通工具' },
    { item: '公交车', use: '公共出行', category: '交通工具' }, { item: '地铁', use: '轨道通勤', category: '交通工具' },
    { item: '轮船', use: '水上运输', category: '交通工具' }, { item: '围巾', use: '颈部保暖', category: '穿戴物品' },
    { item: '手套', use: '手部保暖', category: '穿戴物品' }, { item: '雨靴', use: '防止鞋袜进水', category: '穿戴物品' },
    { item: '眼镜', use: '辅助视力', category: '穿戴物品' }, { item: '剪刀', use: '剪裁纸张', category: '学习用品' },
    { item: '漏勺', use: '捞取食物', category: '厨房用品' }, { item: '海绵', use: '清洗餐具', category: '清洁工具' },
    { item: '吸尘器', use: '吸走灰尘', category: '清洁工具' }, { item: '清洁刷', use: '刷洗污渍', category: '清洁工具' },
    { item: '垃圾袋', use: '收纳垃圾', category: '清洁工具' }, { item: '盘子', use: '盛放食物', category: '厨房用品' },
    { item: '勺子', use: '舀取食物', category: '厨房用品' }, { item: '砧板', use: '承托切菜', category: '厨房用品' },
    { item: '笔记本', use: '记录内容', category: '学习用品' }, { item: '计算器', use: '辅助计算', category: '学习用品' },
    { item: '急救箱', use: '存放急救用品', category: '安全用品' }, { item: '安全带', use: '乘车保护身体', category: '安全用品' },
    { item: '警示锥', use: '标记危险区域', category: '安全用品' }, { item: '飞机', use: '空中运输', category: '交通工具' },
    { item: '火车', use: '铁路运输', category: '交通工具' }, { item: '出租车', use: '载客出行', category: '交通工具' },
    { item: '摩托车', use: '机动骑行', category: '交通工具' },
];

export interface GeographyFact {
    country: string;
    capital: string;
}

export const GEOGRAPHY_FACTS: readonly GeographyFact[] = [
    { country: '中国', capital: '北京' }, { country: '日本', capital: '东京' },
    { country: '韩国', capital: '首尔' }, { country: '泰国', capital: '曼谷' },
    { country: '越南', capital: '河内' }, { country: '印度', capital: '新德里' },
    { country: '新加坡', capital: '新加坡' }, { country: '法国', capital: '巴黎' },
    { country: '英国', capital: '伦敦' }, { country: '德国', capital: '柏林' },
    { country: '意大利', capital: '罗马' }, { country: '西班牙', capital: '马德里' },
    { country: '葡萄牙', capital: '里斯本' }, { country: '希腊', capital: '雅典' },
    { country: '俄罗斯', capital: '莫斯科' }, { country: '美国', capital: '华盛顿' },
    { country: '加拿大', capital: '渥太华' }, { country: '墨西哥', capital: '墨西哥城' },
    { country: '巴西', capital: '巴西利亚' }, { country: '阿根廷', capital: '布宜诺斯艾利斯' },
    { country: '澳大利亚', capital: '堪培拉' }, { country: '新西兰', capital: '惠灵顿' },
    { country: '埃及', capital: '开罗' }, { country: '肯尼亚', capital: '内罗毕' },
    { country: '土耳其', capital: '安卡拉' }, { country: '瑞典', capital: '斯德哥尔摩' },
    { country: '挪威', capital: '奥斯陆' }, { country: '芬兰', capital: '赫尔辛基' },
    { country: '奥地利', capital: '维也纳' }, { country: '瑞士', capital: '伯尔尼' },
];
