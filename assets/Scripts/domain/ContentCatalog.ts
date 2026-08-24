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
    | 'geography-country'
    | 'knowledge-science'
    | 'knowledge-nature'
    | 'knowledge-culture'
    | 'history-modern-opening'
    | 'history-modern-awakening'
    | 'history-modern-resistance'
    | 'history-ancient'
    | 'history-myth';

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
    knowledge: 15,
    history: 25,
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
    ['knowledge', 'knowledge-science'],
    ['knowledge', 'knowledge-nature'],
    ['knowledge', 'knowledge-culture'],
    ['history', 'history-modern-opening'],
    ['history', 'history-modern-awakening'],
    ['history', 'history-modern-resistance'],
    ['history', 'history-ancient'],
    ['history', 'history-myth'],
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
    { en: 'BIRD', zh: '鸟', category: '动物' }, { en: 'ZEBRA', zh: '斑马', category: '动物' },
    { en: 'LION', zh: '狮子', category: '动物' }, { en: 'TIGER', zh: '老虎', category: '动物' },
    { en: 'HORSE', zh: '马', category: '动物' }, { en: 'PANDA', zh: '熊猫', category: '动物' },
    { en: 'RED', zh: '红色', category: '颜色' }, { en: 'BLUE', zh: '蓝色', category: '颜色' },
    { en: 'GREEN', zh: '绿色', category: '颜色' }, { en: 'BLACK', zh: '黑色', category: '颜色' },
    { en: 'WHITE', zh: '白色', category: '颜色' }, { en: 'YELLOW', zh: '黄色', category: '颜色' },
    { en: 'PURPLE', zh: '紫色', category: '颜色' }, { en: 'GRAY', zh: '灰色', category: '颜色' },
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

/**
 * A deliberately stricter subset for category questions. Context-dependent
 * objects such as garbage bags, sponges, scissors and masks stay available
 * for precise use questions, but never act as misleading category distractors.
 */
export const LIFE_CATEGORY_FACTS: readonly LifeFact[] = [
    { item: '扫帚', use: '清扫地面', category: '清洁工具' },
    { item: '拖把', use: '拖洗地面', category: '清洁工具' },
    { item: '吸尘器', use: '吸走灰尘', category: '清洁工具' },
    { item: '簸箕', use: '收拢尘土', category: '清洁工具' },
    { item: '玻璃刮', use: '刮净玻璃', category: '清洁工具' },
    { item: '鸡毛掸子', use: '掸除浮尘', category: '清洁工具' },
    { item: '炒锅', use: '炒制食物', category: '厨房用品' },
    { item: '筷子', use: '夹取食物', category: '厨房用品' },
    { item: '漏勺', use: '捞取食物', category: '厨房用品' },
    { item: '砧板', use: '承托切菜', category: '厨房用品' },
    { item: '擀面杖', use: '擀平面团', category: '厨房用品' },
    { item: '蒸笼', use: '蒸制食物', category: '厨房用品' },
    { item: '铅笔', use: '书写绘图', category: '学习用品' },
    { item: '橡皮', use: '擦除铅笔字', category: '学习用品' },
    { item: '圆规', use: '画圆', category: '学习用品' },
    { item: '作业本', use: '书写作业', category: '学习用品' },
    { item: '削笔器', use: '削尖铅笔', category: '学习用品' },
    { item: '文具盒', use: '收纳文具', category: '学习用品' },
    { item: '灭火器', use: '扑灭初起火灾', category: '安全用品' },
    { item: '救生圈', use: '水上救生', category: '安全用品' },
    { item: '安全帽', use: '保护头部', category: '安全用品' },
    { item: '急救箱', use: '存放急救用品', category: '安全用品' },
    { item: '警示锥', use: '标记危险区域', category: '安全用品' },
    { item: '护目镜', use: '保护眼睛', category: '安全用品' },
    { item: '自行车', use: '脚踏出行', category: '交通工具' },
    { item: '公交车', use: '公共出行', category: '交通工具' },
    { item: '地铁', use: '轨道通勤', category: '交通工具' },
    { item: '轮船', use: '水上运输', category: '交通工具' },
    { item: '飞机', use: '空中运输', category: '交通工具' },
    { item: '火车', use: '铁路运输', category: '交通工具' },
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

export interface TriviaFact {
    prompt: string;
    answer: string;
    wrong: readonly string[];
}

export const KNOWLEDGE_SCIENCE_FACTS: readonly TriviaFact[] = [
    { prompt: '人体最大的器官', answer: '皮肤', wrong: ['心脏', '肝脏', '肺'] },
    { prompt: '血液呈红色主要因为', answer: '血红蛋白', wrong: ['血小板', '胆红素', '葡萄糖'] },
    { prompt: '植物光合作用吸收', answer: '二氧化碳', wrong: ['氧气', '氮气', '氢气'] },
    { prompt: '声音无法传播的地方', answer: '真空', wrong: ['水中', '钢铁中', '空气中'] },
    { prompt: '标准气压下水的沸点', answer: '100℃', wrong: ['0℃', '50℃', '120℃'] },
    { prompt: '有“红色星球”之称', answer: '火星', wrong: ['金星', '木星', '水星'] },
    { prompt: '月亮发光的真相', answer: '反射阳光', wrong: ['自身燃烧', '储存闪电', '释放岩浆'] },
    { prompt: '磁铁同名磁极相遇', answer: '互相排斥', wrong: ['互相吸引', '失去磁性', '开始发热'] },
    { prompt: '晒太阳有助合成', answer: '维生素D', wrong: ['维生素A', '维生素C', '维生素K'] },
    { prompt: '成年人通常有几颗牙', answer: '32颗', wrong: ['20颗', '24颗', '40颗'] },
];

export const KNOWLEDGE_NATURE_FACTS: readonly TriviaFact[] = [
    { prompt: '鲸鱼其实属于', answer: '哺乳动物', wrong: ['鱼类', '两栖动物', '软体动物'] },
    { prompt: '真正会飞的哺乳动物', answer: '蝙蝠', wrong: ['鼯鼠', '企鹅', '鸵鸟'] },
    { prompt: '大熊猫的“第六指”', answer: '腕骨突起', wrong: ['真正拇指', '尾骨', '爪鞘'] },
    { prompt: '章鱼有几颗心脏', answer: '3颗', wrong: ['1颗', '2颗', '8颗'] },
    { prompt: '骆驼驼峰主要储存', answer: '脂肪', wrong: ['清水', '空气', '血液'] },
    { prompt: '野生企鹅主要生活在', answer: '南半球', wrong: ['北极点', '撒哈拉', '青藏高原'] },
    { prompt: '考拉最爱吃', answer: '桉树叶', wrong: ['竹子', '松果', '仙人掌'] },
    { prompt: '能倒着飞的鸟', answer: '蜂鸟', wrong: ['麻雀', '海鸥', '孔雀'] },
    { prompt: '鲨鱼的骨架主要是', answer: '软骨', wrong: ['硬骨', '甲壳', '角质'] },
    { prompt: '变色本领出名的爬行动物', answer: '变色龙', wrong: ['壁虎', '鳄鱼', '陆龟'] },
];

export const KNOWLEDGE_CULTURE_FACTS: readonly TriviaFact[] = [
    { prompt: '奥运五环有几环', answer: '5环', wrong: ['4环', '6环', '7环'] },
    { prompt: '标准钢琴有几键', answer: '88键', wrong: ['66键', '72键', '108键'] },
    { prompt: '《蒙娜丽莎》作者', answer: '达·芬奇', wrong: ['梵高', '莫奈', '毕加索'] },
    { prompt: '“命运交响曲”是第几部', answer: '第五部', wrong: ['第三部', '第六部', '第九部'] },
    { prompt: '象棋棋盘中间写着', answer: '楚河汉界', wrong: ['天圆地方', '泾渭分明', '龙争虎斗'] },
    { prompt: '标准围棋棋盘纵横各', answer: '19路', wrong: ['9路', '13路', '21路'] },
    { prompt: '和平奖颁奖城市', answer: '奥斯陆', wrong: ['斯德哥尔摩', '日内瓦', '哥本哈根'] },
    { prompt: '世界读书日是', answer: '4月23日', wrong: ['3月12日', '5月1日', '9月10日'] },
    { prompt: '万维网发明者', answer: '伯纳斯-李', wrong: ['乔布斯', '图灵', '爱迪生'] },
    { prompt: '飞机“黑匣子”通常是', answer: '橙红色', wrong: ['纯黑色', '天蓝色', '透明色'] },
];

export const HISTORY_MODERN_OPENING_FACTS: readonly TriviaFact[] = [
    { prompt: '虎门销烟的主角', answer: '林则徐', wrong: ['魏源', '曾国藩', '左宗棠'] },
    { prompt: '鸦片战争爆发于', answer: '1840年', wrong: ['1839年', '1860年', '1894年'] },
    { prompt: '近代首个不平等条约', answer: '《南京条约》', wrong: ['《北京条约》', '《马关条约》', '《辛丑条约》'] },
    { prompt: '洋务运动的口号', answer: '自强求富', wrong: ['师夷长技', '实业救国', '民主科学'] },
    { prompt: '北洋水师最终覆没于', answer: '威海卫', wrong: ['旅顺', '天津', '厦门'] },
    { prompt: '“公车上书”领衔者', answer: '康有为', wrong: ['孙中山', '陈独秀', '李大钊'] },
    { prompt: '百日维新时的皇帝', answer: '光绪帝', wrong: ['同治帝', '宣统帝', '道光帝'] },
    { prompt: '辛亥革命首义之城', answer: '武昌', wrong: ['广州', '南京', '长沙'] },
    { prompt: '民国临时政府设在', answer: '南京', wrong: ['北京', '上海', '武汉'] },
    { prompt: '清帝退位发生于', answer: '1912年', wrong: ['1898年', '1911年', '1919年'] },
];

export const HISTORY_MODERN_AWAKENING_FACTS: readonly TriviaFact[] = [
    { prompt: '《新青年》创办人', answer: '陈独秀', wrong: ['鲁迅', '胡适', '蔡元培'] },
    { prompt: '《狂人日记》作者', answer: '鲁迅', wrong: ['郭沫若', '老舍', '巴金'] },
    { prompt: '五四运动首先爆发在', answer: '北京', wrong: ['上海', '广州', '天津'] },
    { prompt: '五四运动导火索', answer: '巴黎和会', wrong: ['武昌起义', '九一八事变', '北伐开始'] },
    { prompt: '中共一大最初开会城市', answer: '上海', wrong: ['北京', '广州', '武汉'] },
    { prompt: '南湖红船所在城市', answer: '嘉兴', wrong: ['杭州', '绍兴', '苏州'] },
    { prompt: '首个农村革命根据地', answer: '井冈山', wrong: ['延安', '西柏坡', '大别山'] },
    { prompt: '中央红军长征集结出发地', answer: '江西于都', wrong: ['陕西延安', '贵州遵义', '河北西柏坡'] },
    { prompt: '遵义会议所在省份', answer: '贵州', wrong: ['四川', '云南', '湖南'] },
    { prompt: '“为中华崛起而读书”', answer: '周恩来', wrong: ['蔡元培', '闻一多', '詹天佑'] },
];

export const HISTORY_MODERN_RESISTANCE_FACTS: readonly TriviaFact[] = [
    { prompt: '九一八事变发生地', answer: '沈阳', wrong: ['北平', '南京', '武汉'] },
    { prompt: '卢沟桥事变发生在', answer: '北京', wrong: ['天津', '上海', '西安'] },
    { prompt: '平型关大捷主力', answer: '八路军', wrong: ['新四军', '东北军', '北洋军'] },
    { prompt: '台儿庄大捷指挥者', answer: '李宗仁', wrong: ['张自忠', '佟麟阁', '谢晋元'] },
    { prompt: '南京大屠杀发生于', answer: '1937年', wrong: ['1931年', '1935年', '1941年'] },
    { prompt: '地道战故事多发生在', answer: '冀中平原', wrong: ['河西走廊', '江南水乡', '云贵高原'] },
    { prompt: '百团大战主要指挥者', answer: '彭德怀', wrong: ['叶挺', '左权', '聂荣臻'] },
    { prompt: '“飞虎队”创建者', answer: '陈纳德', wrong: ['白求恩', '史迪威', '柯棣华'] },
    { prompt: '日本宣布投降年份', answer: '1945年', wrong: ['1937年', '1943年', '1949年'] },
    { prompt: '中国抗战胜利纪念日', answer: '9月3日', wrong: ['7月7日', '8月15日', '9月18日'] },
];

export const HISTORY_ANCIENT_FACTS: readonly TriviaFact[] = [
    { prompt: '秦统一后推行的文字', answer: '小篆', wrong: ['甲骨文', '楷书', '行书'] },
    { prompt: '“凿空西域”的使者', answer: '张骞', wrong: ['班超', '苏武', '甘英'] },
    { prompt: '《史记》的作者', answer: '司马迁', wrong: ['班固', '司马光', '陈寿'] },
    { prompt: '“投笔从戎”的主角', answer: '班超', wrong: ['霍去病', '卫青', '祖逖'] },
    { prompt: '《三国演义》草船借箭者', answer: '诸葛亮', wrong: ['周瑜', '鲁肃', '司马懿'] },
    { prompt: '被称为“诗仙”', answer: '李白', wrong: ['杜甫', '白居易', '王维'] },
    { prompt: '玄奘取经前往古称', answer: '天竺', wrong: ['大秦', '安息', '扶桑'] },
    { prompt: '活字印刷术发明者', answer: '毕昇', wrong: ['蔡伦', '沈括', '祖冲之'] },
    { prompt: '郑和船队远航称为', answer: '下西洋', wrong: ['通西域', '渡东瀛', '征漠北'] },
    { prompt: '“杯酒释兵权”的皇帝', answer: '宋太祖', wrong: ['唐太宗', '汉武帝', '明成祖'] },
    { prompt: '兵马俑所在城市', answer: '西安', wrong: ['洛阳', '开封', '南京'] },
    { prompt: '鸿门宴上舞剑的是', answer: '项庄', wrong: ['项伯', '樊哙', '韩信'] },
];

export const HISTORY_MYTH_FACTS: readonly TriviaFact[] = [
    { prompt: '开天辟地的巨人', answer: '盘古', wrong: ['夸父', '刑天', '共工'] },
    { prompt: '女娲补天使用', answer: '五色石', wrong: ['定海针', '息壤', '昆仑玉'] },
    { prompt: '后羿一共射落几个太阳', answer: '9个', wrong: ['7个', '8个', '10个'] },
    { prompt: '嫦娥奔月住进', answer: '广寒宫', wrong: ['兜率宫', '水晶宫', '碧游宫'] },
    { prompt: '追着太阳奔跑的巨人', answer: '夸父', wrong: ['盘古', '刑天', '愚公'] },
    { prompt: '精卫衔石要填平', answer: '东海', wrong: ['南海', '西湖', '黄河'] },
    { prompt: '大禹治水几过家门不入', answer: '3次', wrong: ['1次', '5次', '9次'] },
    { prompt: '尝百草的始祖', answer: '神农', wrong: ['伏羲', '祝融', '后稷'] },
    { prompt: '失去头颅仍挥舞干戚', answer: '刑天', wrong: ['蚩尤', '共工', '相柳'] },
    { prompt: '哪吒重获身体靠', answer: '莲花化身', wrong: ['蟠桃化身', '仙草化身', '神木化身'] },
    { prompt: '筋斗云一个跟头十万八千里', answer: '孙悟空', wrong: ['猪八戒', '二郎神', '哪吒'] },
    { prompt: '八仙过海比拼的是', answer: '各显神通', wrong: ['力拔山河', '点石成金', '呼风唤雨'] },
];
