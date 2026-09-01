import type { TriviaFact } from './ContentCatalog';
import type { QuestionTemplateId } from './QuestionTemplateCatalog';

export interface OrderedFact {
    id: string;
    prompt: string;
    parts: readonly string[];
}

type ExpansionTriviaFact = TriviaFact & { id: string };

const TYPE_SAFE_DISTRACTORS: Readonly<Record<string, readonly string[]>> = {
    radical: ['亻', '氵', '木', '艹', '日', '目', '口', '足', '女', '钅', '纟', '讠'],
    person: ['林则徐', '魏源', '曾国藩', '左宗棠', '李鸿章', '康有为', '梁启超', '孙中山', '鲁迅', '蔡元培', '毛泽东', '周恩来'],
    'myth-person': ['盘古', '女娲', '夸父', '精卫', '后羿', '嫦娥', '大禹', '燧人氏', '伏羲', '神农'],
    date: ['1840年', '1842年', '1860年', '1894年', '1898年', '1911年', '1919年', '1921年', '1931年', '1937年', '1945年'],
    place: ['北京', '南京', '上海', '武汉', '广州', '沈阳', '重庆', '会宁', '卢沟桥', '南湖红船'],
    country: ['中国', '日本', '法国', '英国', '德国', '印度', '埃及', '美国'],
    region: ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲'],
    direction: ['东面', '西面', '南面', '北面', '东北', '东南', '西北', '西南'],
    unit: ['牛顿', '千克', '米', '安培', '秒', '摄氏度'],
    organ: ['皮肤', '大脑', '心脏', '肺', '胃', '小肠', '肝', '肾'],
    celestial: ['水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星', '月球', '太阳'],
    quantity: ['两条', '四条', '六条', '八条', '十颗', '三十七摄氏度', '四十六亿年'],
    slogan: ['自强', '求富', '民主', '科学'],
    conflict: ['鸦片战争', '甲午战争', '抗日战争', '北伐战争'],
    event: ['七七事变', '九一八事变', '五四运动', '辛亥革命'],
    dynasty: ['秦朝', '汉朝', '唐朝', '宋朝', '元朝', '明朝', '清朝', '隋朝'],
    'historical-term': ['百日维新', '洋务运动', '新文化运动', '辛亥革命'],
    publication: ['《新青年》', '《民报》', '《时务报》', '《申报》'],
    boolean: ['会', '不会', '是', '不是'],
    cause: ['相对位置变化', '引力作用', '地球自转', '持续自由落体'],
    constellation: ['大熊座', '小熊座', '猎户座', '天鹅座'],
    gas: ['氧气', '二氧化碳', '氮气', '氢气'],
    cell: ['红细胞', '白细胞', '血小板', '神经细胞'],
    process: ['光合作用', '呼吸作用', '蒸腾作用', '物理变化', '化学变化'],
    property: ['热胀冷缩', '导电性', '弹性', '磁性'],
    state: ['固体', '液体', '气体', '等离子体'],
    trend: ['变大', '变小', '不变', '先变大后变小'],
    'device-category': ['输入设备', '输出设备', '存储设备', '通信设备'],
    covering: ['鳞片', '羽毛', '毛发', '甲壳'],
    food: ['乳汁', '植物', '昆虫', '小鱼'],
    organism: ['青蛙', '蜥蜴', '麻雀', '鲫鱼'],
    microorganism: ['酵母菌', '乳酸菌', '醋酸菌', '霉菌'],
    nutrient: ['钙', '铁', '维生素', '水分'],
    taxonomy: ['种', '属', '科', '目'],
    weapon: ['火尖枪', '金箍棒', '宝剑', '长枪'],
    phrase: ['各显神通', '大显身手', '齐心协力', '各有所长'],
    feature: ['第三只眼', '三头六臂', '火眼金睛', '九条尾巴'],
    landform: ['太行王屋', '泰山华山', '昆仑山', '喜马拉雅山'],
    layer: ['对流层', '平流层', '中间层', '热层'],
    shape: ['棒旋星系', '椭圆星系', '旋涡星系', '不规则星系'],
    'planet-count': ['七颗', '八颗', '九颗', '十颗'],
    'limb-count': ['两条', '四条', '六条', '八条'],
    temperature: ['三十五摄氏度', '三十六摄氏度', '三十七摄氏度', '三十八摄氏度'],
    age: ['四十亿年', '四十六亿年', '五十亿年', '六十亿年'],
    'myth-date': ['七夕', '端午', '中秋', '重阳'],
    'astronomy-feature': ['彗尾', '太阳黑子', '行星光环', '流星尾迹'],
    function: ['观测天体', '测量距离', '记录数据', '放大图像'],
    'physical-change': ['物理变化', '化学变化', '状态变化', '形态变化'],
    'body-function': ['运动', '支撑', '保护', '消化'],
    reproduction: ['产卵', '胎生', '孢子繁殖', '分裂生殖'],
    behavior: ['勤洗手', '接种疫苗', '开窗通风', '规律作息'],
    stimulus: ['光线', '声音', '气味', '温度'],
    speed: ['每秒三十万千米', '每秒三十万米', '每秒三千米', '每秒三百米'],
    'optical-phenomenon': ['色散', '反射', '折射', '衍射'],
    'wave-phenomenon': ['反射', '折射', '干涉', '衍射'],
    'lens-effect': ['会聚作用', '发散作用', '反射作用', '散射作用'],
    'sound-parameter': ['频率', '振幅', '波长', '音色'],
    interaction: ['相互排斥', '相互吸引', '没有作用', '先吸后斥'],
    'circuit-condition': ['闭合回路', '断开开关', '绝缘导线', '移除电源'],
    magnitude: ['过大', '过小', '不变', '反向'],
    comparison: ['更大', '更小', '相等', '无法比较'],
    force: ['自身重力', '浮力', '摩擦力', '弹力'],
    area: ['受力面积', '作用时间', '物体质量', '移动距离'],
    'physical-quantity': ['距离', '时间', '质量', '温度'],
    'astronomy-property': ['恒星自身发光', '行星自身发光', '恒星围绕行星运行', '二者都不发光'],
    building: ['长城', '故宫', '天坛', '大运河'],
    'storage-content': ['运行数据', '永久文件', '纸质文档', '声音信号'],
    energy: ['电能', '热能', '机械能', '化学能'],
    driver: ['电动机', '内燃机', '蒸汽机', '液压泵'],
    sensor: ['传感器', '显示器', '扬声器', '打印机'],
    'training-resource': ['数据和算法', '燃料和齿轮', '纸张和油墨', '水和肥料'],
    manufacturing: ['逐层制造', '整体切削', '手工浇筑', '自然生长'],
    connection: ['短距离无线连接', '近距离通信', '有线网络连接', '卫星通信连接'],
};

function relationAnswerGroup(prefix: string, prompt: string, answer: string): string {
    // A radical can itself be “日” or “月”. Classify the question by its
    // explicit semantics before the generic date-suffix rule below.
    if (prefix.startsWith('radical.') || /部首/.test(prompt)) return 'radical';
    if ((/神话|传说/.test(prompt) || prefix.includes('history.myth')) && /人物|英雄|神鸟/.test(prompt)) return 'myth-person';
    if (/人物|作者|领导人|指挥者|作曲者|作词者|皇帝|建立者|发明者|科学家|工程师|先驱|学者|高僧|名将/.test(prompt)) return 'person';
    if (prefix.includes('history.myth') && /日子/.test(prompt)) return 'myth-date';
    if (/有几|几条|多少|大约/.test(prompt)) {
        if (/颗$/.test(answer)) return 'planet-count';
        if (/条$/.test(answer)) return 'limb-count';
        if (/摄氏度$/.test(answer)) return 'temperature';
        if (/亿年$/.test(answer)) return 'age';
        return 'quantity';
    }
    if (/哪一年|发生于|开始于|胜利于|成立于|建立于|形成于|纪念日|月份/.test(prompt) || /(?:年|月|日)$/.test(answer)) return 'date';
    if (/哪个国家/.test(prompt)) return 'country';
    if (/哪个洲/.test(prompt)) return 'region';
    if (/方向/.test(prompt)) return 'direction';
    if (/衡量什么的单位/.test(prompt)) return 'physical-quantity';
    if (/国际单位/.test(prompt)) return 'unit';
    if (/口号|旗帜/.test(prompt)) return 'slogan';
    if (/哪场战争|哪场战役/.test(prompt)) return 'conflict';
    if (/开始标志|重要标志/.test(prompt)) return 'event';
    if (/哪个朝代|朝代/.test(prompt)) return 'dynasty';
    if (/又称/.test(prompt)) return 'historical-term';
    if (/主要阵地/.test(prompt)) return 'publication';
    if (/是否/.test(prompt)) return 'boolean';
    if (/哪个天体/.test(prompt)) return 'celestial';
    if (/与什么有关|呈现失重是因|主要受.*影响/.test(prompt)) return 'cause';
    if (/哪个星座/.test(prompt)) return 'constellation';
    if (/气体/.test(prompt)) return 'gas';
    if (/细胞/.test(prompt)) return 'cell';
    if (/什么变化/.test(prompt)) return 'physical-change';
    if (/过程/.test(prompt)) return 'process';
    if (/什么性质/.test(prompt)) return 'property';
    if (/变成/.test(prompt)) return 'state';
    if (/体积通常/.test(prompt)) return 'trend';
    if (/哪类设备|主要属于/.test(prompt)) return 'device-category';
    if (/身体表面.*覆盖/.test(prompt)) return 'covering';
    if (/为食/.test(prompt)) return 'food';
    if (/典型代表/.test(prompt)) return 'organism';
    if (/微生物|真菌/.test(prompt)) return 'microorganism';
    if (/有助于.*吸收/.test(prompt)) return 'nutrient';
    if (/生物分类的基本单位/.test(prompt)) return 'taxonomy';
    if (/兵器/.test(prompt)) return 'weapon';
    if (/下半句/.test(prompt)) return 'phrase';
    if (/特征/.test(prompt)) return 'feature';
    if (/阻挡道路的山/.test(prompt)) return 'landform';
    if (/哪一层/.test(prompt)) return 'layer';
    if (/外形大致/.test(prompt)) return 'shape';
    if (/恒星与行星的主要区别/.test(prompt)) return 'astronomy-property';
    if (/彗星.*出现/.test(prompt)) return 'astronomy-feature';
    if (/主要用于/.test(prompt) && prefix.includes('astro')) return 'function';
    if (/共同帮助人体/.test(prompt)) return 'body-function';
    if (/繁殖通常依靠/.test(prompt)) return 'reproduction';
    if (/重要做法/.test(prompt)) return 'behavior';
    if (/调节进入眼睛/.test(prompt)) return 'stimulus';
    if (/速度约为/.test(prompt)) return 'speed';
    if (/三棱镜/.test(prompt)) return 'optical-phenomenon';
    if (/透镜/.test(prompt)) return 'lens-effect';
    if (/回声/.test(prompt)) return 'wave-phenomenon';
    if (/音调|响度/.test(prompt)) return 'sound-parameter';
    if (/磁极之间/.test(prompt)) return 'interaction';
    if (/形成电流需要/.test(prompt)) return 'circuit-condition';
    if (/防止电流/.test(prompt)) return 'magnitude';
    if (/通常比/.test(prompt)) return 'comparison';
    if (/潜水艇.*调节/.test(prompt)) return 'force';
    if (/压力大小等于压力除以/.test(prompt)) return 'area';
    if (prefix.includes('history.myth') && /名字/.test(prompt)) return 'myth-person';
    if (/哪处建筑/.test(prompt)) return 'building';
    if (/临时存放/.test(prompt)) return 'storage-content';
    if (/光能转为/.test(prompt)) return 'energy';
    if (/什么驱动/.test(prompt)) return 'driver';
    if (/感知环境.*使用/.test(prompt)) return 'sensor';
    if (/人工智能训练.*需要/.test(prompt)) return 'training-resource';
    if (/方式成形/.test(prompt)) return 'manufacturing';
    if (/什么连接|NFC常用于/.test(prompt)) return 'connection';
    if (/器官|哪个器官|主要场所/.test(prompt)) return 'organ';
    if (/行星|哪个天体|绕什么运行|谁位于日/.test(prompt)) return 'celestial';
    if (/发生地|城市|成立地|地点|陪都|岛屿|位于/.test(prompt) && !prefix.includes('position')) return 'place';
    return 'default';
}

function relationFacts(prefix: string, rows: readonly (readonly [string, string])[]): ExpansionTriviaFact[] {
    // Do not spread Set here. Some Cocos Creator target transforms lower
    // iterable spread to [].concat(set), leaving a Set object in the choices.
    const groupedAnswers = new Map<string, string[]>();
    for (const [prompt, answer] of rows) {
        const group = relationAnswerGroup(prefix, prompt, answer);
        const values = groupedAnswers.get(group) ?? [];
        if (!values.includes(answer)) values.push(answer);
        groupedAnswers.set(group, values);
    }
    return rows.map(([prompt, answer], index) => ({
        id: `${prefix}.${String(index + 1).padStart(2, '0')}`,
        prompt,
        answer,
        wrong: (() => {
            const group = relationAnswerGroup(prefix, prompt, answer);
            const candidates = [...(groupedAnswers.get(group) ?? []), ...(TYPE_SAFE_DISTRACTORS[group] ?? [])];
            return Array.from(new Set(candidates)).filter((candidate) => candidate !== answer).slice(0, 3);
        })(),
    }));
}

export const EXPANSION_TRIVIA_PACKS: Readonly<Partial<Record<QuestionTemplateId, readonly ExpansionTriviaFact[]>>> = {
    'hanzi-radical': [
        { id: 'radical.休', prompt: '“休”的部首', answer: '亻', wrong: ['木', '人', '十'] },
        { id: 'radical.江', prompt: '“江”的部首', answer: '氵', wrong: ['工', '水', '冫'] },
        { id: 'radical.草', prompt: '“草”的部首', answer: '艹', wrong: ['早', '日', '十'] },
        { id: 'radical.晴', prompt: '“晴”的部首', answer: '日', wrong: ['青', '月', '目'] },
        { id: 'radical.跑', prompt: '“跑”的部首', answer: '足', wrong: ['包', '走', '止'] },
        { id: 'radical.妈', prompt: '“妈”的部首', answer: '女', wrong: ['马', '母', '人'] },
        { id: 'radical.桥', prompt: '“桥”的部首', answer: '木', wrong: ['乔', '禾', '朩'] },
        { id: 'radical.海', prompt: '“海”的部首', answer: '氵', wrong: ['每', '水', '母'] },
        ...relationFacts('radical.extra', [
            ['“河”的部首', '氵'], ['“湖”的部首', '氵'], ['“松”的部首', '木'], ['“树”的部首', '木'],
            ['“花”的部首', '艹'], ['“莲”的部首', '艹'], ['“明”的部首', '日'], ['“晚”的部首', '日'],
            ['“眼”的部首', '目'], ['“睛”的部首', '目'], ['“吃”的部首', '口'], ['“唱”的部首', '口'],
            ['“跳”的部首', '足'], ['“路”的部首', '足'], ['“姐”的部首', '女'], ['“妹”的部首', '女'],
            ['“铁”的部首', '钅'], ['“铜”的部首', '钅'], ['“纸”的部首', '纟'], ['“线”的部首', '纟'],
            ['“语”的部首', '讠'], ['“说”的部首', '讠'],
        ]),
    ],
    'hanzi-compose': [
        { id: 'compose.林', prompt: '木＋木组成', answer: '林', wrong: ['森', '休', '本'] },
        { id: 'compose.明', prompt: '日＋月组成', answer: '明', wrong: ['朋', '晴', '阳'] },
        { id: 'compose.休', prompt: '亻＋木组成', answer: '休', wrong: ['体', '林', '保'] },
        { id: 'compose.好', prompt: '女＋子组成', answer: '好', wrong: ['妈', '字', '仔'] },
        { id: 'compose.男', prompt: '田＋力组成', answer: '男', wrong: ['苗', '勇', '累'] },
        { id: 'compose.尖', prompt: '小＋大组成', answer: '尖', wrong: ['尘', '太', '少'] },
        { id: 'compose.岩', prompt: '山＋石组成', answer: '岩', wrong: ['岸', '矿', '磊'] },
        { id: 'compose.尘', prompt: '小＋土组成', answer: '尘', wrong: ['尖', '灰', '沙'] },
        ...relationFacts('compose.extra', [
            ['木＋目组成', '相'], ['木＋子组成', '李'], ['木＋寸组成', '村'], ['木＋公组成', '松'],
            ['日＋生组成', '星'], ['日＋寸组成', '时'], ['田＋心组成', '思'], ['口＋鸟组成', '鸣'],
            ['口＋昌组成', '唱'], ['口＋未组成', '味'], ['女＋马组成', '妈'], ['女＋且组成', '姐'],
            ['亻＋本组成', '体'], ['亻＋尔组成', '你'], ['亻＋门组成', '们'], ['氵＋工组成', '江'],
            ['氵＋可组成', '河'], ['氵＋每组成', '海'], ['艹＋早组成', '草'], ['艹＋化组成', '花'],
            ['讠＋吾组成', '语'], ['钅＋失组成', '铁'],
        ]),
    ],
    'english-synonym': [
        { id: 'synonym.quick', prompt: 'QUICK的近义词', answer: 'FAST', wrong: ['SLOW', 'LATE', 'QUIET'] },
        { id: 'synonym.large', prompt: 'LARGE的近义词', answer: 'BIG', wrong: ['SMALL', 'THIN', 'SHORT'] },
        { id: 'synonym.small', prompt: 'SMALL的近义词', answer: 'LITTLE', wrong: ['LARGE', 'LONG', 'WIDE'] },
        { id: 'synonym.begin', prompt: 'BEGIN的近义词', answer: 'START', wrong: ['STOP', 'END', 'WAIT'] },
        { id: 'synonym.smart', prompt: 'SMART的近义词', answer: 'CLEVER', wrong: ['SLOW', 'WEAK', 'LOUD'] },
        { id: 'synonym.happy', prompt: 'HAPPY的近义词', answer: 'GLAD', wrong: ['SAD', 'ANGRY', 'TIRED'] },
        { id: 'synonym.quiet', prompt: 'QUIET的近义词', answer: 'SILENT', wrong: ['LOUD', 'FAST', 'BRIGHT'] },
        { id: 'synonym.finish', prompt: 'FINISH的近义词', answer: 'END', wrong: ['BEGIN', 'OPEN', 'ENTER'] },
        ...relationFacts('synonym.extra', [
            ['BEAUTIFUL的近义词', 'PRETTY'], ['ANGRY的近义词', 'MAD'], ['CORRECT的近义词', 'RIGHT'], ['DIFFICULT的近义词', 'HARD'],
            ['EASY的近义词', 'SIMPLE'], ['GIFT的近义词', 'PRESENT'], ['HELP的近义词', 'AID'], ['HOUSE的近义词', 'HOME'],
            ['ILL的近义词', 'SICK'], ['JOB的近义词', 'WORK'], ['JUMP的近义词', 'LEAP'], ['KIND的近义词', 'NICE'],
            ['LOOK的近义词', 'SEE'], ['NEAR的近义词', 'CLOSE'], ['OLD的近义词', 'AGED'], ['REPLY的近义词', 'ANSWER'],
            ['ROAD的近义词', 'STREET'], ['SPEAK的近义词', 'TALK'], ['STORY的近义词', 'TALE'], ['TRUE的近义词', 'REAL'],
            ['VACATION的近义词', 'HOLIDAY'], ['WRONG的近义词', 'INCORRECT'],
        ]),
    ],
    'life-place': [
        { id: 'place.book', prompt: '借阅图书通常去哪里', answer: '图书馆', wrong: ['体育馆', '菜市场', '车站'] },
        { id: 'place.mail', prompt: '寄送包裹通常去哪里', answer: '邮局', wrong: ['药店', '公园', '影院'] },
        { id: 'place.medicine', prompt: '购买常用药通常去哪里', answer: '药店', wrong: ['书店', '银行', '车站'] },
        { id: 'place.train', prompt: '乘坐火车通常去哪里', answer: '火车站', wrong: ['码头', '超市', '医院'] },
        { id: 'place.swim', prompt: '学习游泳通常去哪里', answer: '游泳馆', wrong: ['图书馆', '博物馆', '音乐厅'] },
        { id: 'place.exhibit', prompt: '参观历史文物通常去哪里', answer: '博物馆', wrong: ['体育馆', '邮局', '餐厅'] },
        { id: 'place.deposit', prompt: '办理存款通常去哪里', answer: '银行', wrong: ['学校', '剧院', '公园'] },
        { id: 'place.doctor', prompt: '身体不适需要就诊去哪里', answer: '医院', wrong: ['商场', '车站', '书店'] },
        ...relationFacts('place.extra', [
            ['购买日常食品通常去哪里', '超市'], ['观看电影通常去哪里', '电影院'], ['乘坐飞机通常去哪里', '机场'],
            ['乘坐轮船通常去哪里', '码头'], ['观看舞台演出通常去哪里', '剧院'], ['欣赏音乐演奏通常去哪里', '音乐厅'],
            ['进行篮球比赛通常去哪里', '体育馆'], ['购买图书通常去哪里', '书店'], ['修剪头发通常去哪里', '理发店'],
            ['购买新鲜蔬菜通常去哪里', '菜市场'], ['办理住宿通常去哪里', '酒店'], ['进行体育锻炼通常去哪里', '健身房'],
            ['学习课程通常去哪里', '学校'], ['观赏动物通常去哪里', '动物园'], ['观赏植物展览通常去哪里', '植物园'],
            ['乘坐地铁通常去哪里', '地铁站'], ['为汽车加油通常去哪里', '加油站'], ['维修汽车通常去哪里', '汽车修理厂'],
            ['购买眼镜通常去哪里', '眼镜店'], ['复印文件通常去哪里', '打印店'], ['寄存贵重物品通常去哪里', '保管处'],
            ['参加露天散步通常去哪里', '公园'],
        ]),
    ],
    'life-public-sign': [
        { id: 'sign.exit', prompt: '“安全出口”标志指向', answer: '疏散出口', wrong: ['收银台', '停车位', '卫生间'] },
        { id: 'sign.no-smoking', prompt: '划掉香烟的标志表示', answer: '禁止吸烟', wrong: ['允许点火', '出售香烟', '注意通风'] },
        { id: 'sign.crosswalk', prompt: '斑马线标志提示', answer: '人行横道', wrong: ['高速入口', '禁止行人', '停车区域'] },
        { id: 'sign.first-aid', prompt: '绿色十字标志通常表示', answer: '急救点', wrong: ['餐饮区', '售票处', '行李处'] },
        { id: 'sign.recycle', prompt: '循环箭头标志通常表示', answer: '可回收', wrong: ['有毒', '易燃', '不可触摸'] },
        { id: 'sign.wet-floor', prompt: '“小心地滑”标志提醒', answer: '地面湿滑', wrong: ['台阶损坏', '高温区域', '车辆经过'] },
        { id: 'sign.no-entry', prompt: '红圈白横杠标志表示', answer: '禁止驶入', wrong: ['直行', '停车', '减速'] },
        { id: 'sign.accessible', prompt: '轮椅图案标志表示', answer: '无障碍设施', wrong: ['儿童区域', '行李寄存', '自行车道'] },
        ...relationFacts('sign.extra', [
            ['红圈内写数字的交通标志表示', '最高限速'], ['蓝底白色P标志表示', '停车场'], ['喇叭图案被斜线划掉表示', '禁止鸣笛'],
            ['行人图案被红圈划掉表示', '禁止行人'], ['自行车图案标志通常表示', '自行车道'], ['餐叉图案标志通常表示', '餐饮服务'],
            ['男女图案标志通常表示', '卫生间'], ['行李箱图案标志通常表示', '行李寄存'], ['字母i标志通常表示', '问讯服务'],
            ['婴儿图案标志通常表示', '母婴室'], ['楼梯向上箭头标志表示', '上行楼梯'], ['楼梯向下箭头标志表示', '下行楼梯'],
            ['火焰图案警告标志表示', '当心易燃'], ['闪电图案警告标志表示', '当心触电'], ['骷髅图案警告标志表示', '当心中毒'],
            ['安全帽图案标志表示', '必须戴安全帽'], ['耳罩图案标志表示', '必须护耳'], ['护目镜图案标志表示', '必须戴护目镜'],
            ['水龙头与杯子标志表示', '饮用水'], ['宠物图案被划掉表示', '禁止宠物'], ['相机图案被划掉表示', '禁止拍照'],
            ['手机图案被划掉表示', '禁止使用手机'],
        ]),
    ],
    'life-safe-behavior': [
        { id: 'safe.fire', prompt: '发现初起火灾应优先', answer: '报警并撤离', wrong: ['乘电梯下楼', '躲进衣柜', '返回取物'] },
        { id: 'safe.road', prompt: '过马路的正确做法', answer: '走人行横道', wrong: ['低头看手机', '翻越护栏', '追逐车辆'] },
        { id: 'safe.electric', prompt: '发现电线破损应当', answer: '远离并求助', wrong: ['徒手触摸', '用水冲洗', '继续使用'] },
        { id: 'safe.gas', prompt: '闻到燃气味应当', answer: '关阀并通风', wrong: ['打开电灯', '点火检查', '使用打火机'] },
        { id: 'safe.storm', prompt: '雷雨时较安全的做法', answer: '进入建筑物内', wrong: ['躲在孤树下', '站在高处', '触摸金属杆'] },
        { id: 'safe.stranger', prompt: '陌生人索要验证码时', answer: '拒绝并核实', wrong: ['立即告知', '转发给朋友', '公开在群里'] },
        { id: 'safe.water', prompt: '不会游泳者落水时同伴应', answer: '呼救找工具', wrong: ['直接跳水', '独自下水', '转身离开'] },
        { id: 'safe.food', prompt: '发现食品过期应当', answer: '停止食用', wrong: ['加热后食用', '继续保存', '掩盖日期'] },
        ...relationFacts('safe.extra', [
            ['乘车时正确的做法', '系好安全带'], ['骑自行车时正确的做法', '佩戴头盔'], ['上下楼梯时正确的做法', '靠右慢行'],
            ['使用剪刀时应当', '刀尖朝下传递'], ['热水壶刚烧开时应当', '防止蒸汽烫伤'], ['运动前正确的做法', '充分热身'],
            ['运动后感到不适应当', '立即停止并求助'], ['独自在家有人敲门时', '先核实身份'], ['收到陌生链接时应当', '不要随意点击'],
            ['公共场所发现遗失物品', '交给工作人员'], ['电梯突然停运时应当', '按报警键求助'], ['发生地震时在室内应', '避开玻璃和吊物'],
            ['洪水来临时应当', '向高处转移'], ['遇到浓烟撤离时应当', '低姿捂鼻前进'], ['厨房油锅起火时应当', '关火并盖锅盖'],
            ['使用插座前应确认', '双手保持干燥'], ['药品服用前应当', '核对说明和剂量'], ['食用野生蘑菇前应当', '不采不食不认识的'],
            ['冰面没有安全标识时', '不要贸然上冰'], ['在站台候车时应当', '站在安全线内'], ['发现同伴中暑时应当', '移至阴凉处求助'],
            ['眼睛进入异物时应当', '用清水轻柔冲洗'],
        ]),
    ],
    'geography-continent': [
        { id: 'continent.china', prompt: '中国位于哪个洲', answer: '亚洲', wrong: ['欧洲', '非洲', '南美洲'] },
        { id: 'continent.france', prompt: '法国位于哪个洲', answer: '欧洲', wrong: ['亚洲', '非洲', '北美洲'] },
        { id: 'continent.egypt', prompt: '埃及主要位于哪个洲', answer: '非洲', wrong: ['欧洲', '亚洲', '南美洲'] },
        { id: 'continent.brazil', prompt: '巴西位于哪个洲', answer: '南美洲', wrong: ['北美洲', '非洲', '欧洲'] },
        { id: 'continent.canada', prompt: '加拿大位于哪个洲', answer: '北美洲', wrong: ['南美洲', '欧洲', '大洋洲'] },
        { id: 'continent.australia', prompt: '澳大利亚位于哪个洲', answer: '大洋洲', wrong: ['亚洲', '欧洲', '非洲'] },
        { id: 'continent.india', prompt: '印度位于哪个洲', answer: '亚洲', wrong: ['欧洲', '非洲', '大洋洲'] },
        { id: 'continent.argentina', prompt: '阿根廷位于哪个洲', answer: '南美洲', wrong: ['北美洲', '亚洲', '欧洲'] },
        ...relationFacts('continent.extra', [
            ['韩国位于哪个洲', '亚洲'], ['泰国位于哪个洲', '亚洲'], ['德国位于哪个洲', '欧洲'], ['西班牙位于哪个洲', '欧洲'],
            ['肯尼亚位于哪个洲', '非洲'], ['南非位于哪个洲', '非洲'], ['墨西哥位于哪个洲', '北美洲'], ['古巴位于哪个洲', '北美洲'],
            ['智利位于哪个洲', '南美洲'], ['秘鲁位于哪个洲', '南美洲'], ['新西兰位于哪个洲', '大洋洲'], ['斐济位于哪个洲', '大洋洲'],
            ['挪威位于哪个洲', '欧洲'], ['希腊位于哪个洲', '欧洲'], ['尼日利亚位于哪个洲', '非洲'], ['摩洛哥位于哪个洲', '非洲'],
            ['巴基斯坦位于哪个洲', '亚洲'], ['越南位于哪个洲', '亚洲'], ['美国位于哪个洲', '北美洲'], ['哥伦比亚位于哪个洲', '南美洲'],
            ['巴布亚新几内亚位于哪个洲', '大洋洲'], ['葡萄牙位于哪个洲', '欧洲'],
        ]),
    ],
    'geography-landmark': [
        { id: 'landmark.great-wall', prompt: '长城位于哪个国家', answer: '中国', wrong: ['日本', '印度', '埃及'] },
        { id: 'landmark.eiffel', prompt: '埃菲尔铁塔位于哪个国家', answer: '法国', wrong: ['英国', '德国', '意大利'] },
        { id: 'landmark.pyramid', prompt: '吉萨金字塔位于哪个国家', answer: '埃及', wrong: ['希腊', '土耳其', '印度'] },
        { id: 'landmark.liberty', prompt: '自由女神像位于哪个国家', answer: '美国', wrong: ['加拿大', '法国', '巴西'] },
        { id: 'landmark.opera', prompt: '悉尼歌剧院位于哪个国家', answer: '澳大利亚', wrong: ['新西兰', '英国', '美国'] },
        { id: 'landmark.colosseum', prompt: '斗兽场位于哪个国家', answer: '意大利', wrong: ['西班牙', '希腊', '法国'] },
        { id: 'landmark.fuji', prompt: '富士山位于哪个国家', answer: '日本', wrong: ['韩国', '中国', '尼泊尔'] },
        { id: 'landmark.taj', prompt: '泰姬陵位于哪个国家', answer: '印度', wrong: ['泰国', '巴基斯坦', '伊朗'] },
        ...relationFacts('landmark.extra', [
            ['大本钟位于哪个国家', '英国'], ['勃兰登堡门位于哪个国家', '德国'], ['圣家堂位于哪个国家', '西班牙'],
            ['雅典卫城位于哪个国家', '希腊'], ['佩特拉古城位于哪个国家', '约旦'], ['吴哥窟位于哪个国家', '柬埔寨'],
            ['下龙湾位于哪个国家', '越南'], ['景福宫位于哪个国家', '韩国'], ['鱼尾狮位于哪个国家', '新加坡'],
            ['双子塔位于哪个国家', '马来西亚'], ['哈利法塔位于哪个国家', '阿联酋'], ['克里姆林宫位于哪个国家', '俄罗斯'],
            ['尼亚加拉瀑布横跨美国和哪个国家', '加拿大'], ['基督像位于哪个国家', '巴西'], ['马丘比丘位于哪个国家', '秘鲁'],
            ['复活节岛属于哪个国家', '智利'], ['奇琴伊察位于哪个国家', '墨西哥'], ['好望角位于哪个国家', '南非'],
            ['乞力马扎罗山位于哪个国家', '坦桑尼亚'], ['婆罗浮屠位于哪个国家', '印度尼西亚'], ['米尔福德峡湾位于哪个国家', '新西兰'],
            ['日内瓦湖主要位于哪个国家', '瑞士'],
        ]),
    ],
    'geography-province-capital': [
        { id: 'province.guangdong', prompt: '广东省省会', answer: '广州', wrong: ['深圳', '珠海', '佛山'] },
        { id: 'province.sichuan', prompt: '四川省省会', answer: '成都', wrong: ['重庆', '绵阳', '乐山'] },
        { id: 'province.zhejiang', prompt: '浙江省省会', answer: '杭州', wrong: ['宁波', '温州', '绍兴'] },
        { id: 'province.jiangsu', prompt: '江苏省省会', answer: '南京', wrong: ['苏州', '无锡', '徐州'] },
        { id: 'province.hubei', prompt: '湖北省省会', answer: '武汉', wrong: ['宜昌', '襄阳', '荆州'] },
        { id: 'province.hunan', prompt: '湖南省省会', answer: '长沙', wrong: ['株洲', '衡阳', '岳阳'] },
        { id: 'province.shandong', prompt: '山东省省会', answer: '济南', wrong: ['青岛', '烟台', '潍坊'] },
        { id: 'province.fujian', prompt: '福建省省会', answer: '福州', wrong: ['厦门', '泉州', '漳州'] },
        ...relationFacts('province.extra', [
            ['河北省省会', '石家庄'], ['河南省省会', '郑州'], ['山西省省会', '太原'], ['陕西省省会', '西安'],
            ['安徽省省会', '合肥'], ['江西省省会', '南昌'], ['辽宁省省会', '沈阳'], ['吉林省省会', '长春'],
            ['黑龙江省省会', '哈尔滨'], ['云南省省会', '昆明'], ['贵州省省会', '贵阳'], ['甘肃省省会', '兰州'],
            ['青海省省会', '西宁'], ['海南省省会', '海口'], ['台湾省省会', '台北'], ['内蒙古自治区首府', '呼和浩特'],
            ['广西壮族自治区首府', '南宁'], ['西藏自治区首府', '拉萨'], ['宁夏回族自治区首府', '银川'], ['新疆维吾尔自治区首府', '乌鲁木齐'],
            ['北京市行政中心', '北京'], ['上海市行政中心', '上海'],
        ]),
    ],
    'geography-relative-position': [
        { id: 'position.japan', prompt: '日本位于中国的大致方向', answer: '东面', wrong: ['西面', '南面', '北面'] },
        { id: 'position.mongolia', prompt: '蒙古位于中国的大致方向', answer: '北面', wrong: ['南面', '东面', '西面'] },
        { id: 'position.india', prompt: '印度位于中国的大致方向', answer: '西南', wrong: ['东北', '正东', '东南'] },
        { id: 'position.russia', prompt: '俄罗斯位于中国的大致方向', answer: '北面', wrong: ['南面', '东南', '西南'] },
        { id: 'position.korea', prompt: '韩国位于中国的大致方向', answer: '东面', wrong: ['西面', '南面', '西北'] },
        { id: 'position.vietnam', prompt: '越南位于中国的大致方向', answer: '南面', wrong: ['北面', '东面', '西北'] },
        { id: 'position.nepal', prompt: '尼泊尔位于中国的大致方向', answer: '西南', wrong: ['东北', '东南', '正东'] },
        { id: 'position.philippines', prompt: '菲律宾位于中国的大致方向', answer: '东南', wrong: ['西北', '东北', '正西'] },
        ...relationFacts('position.extra', [
            ['北京位于广州的大致方向', '北面'], ['广州位于北京的大致方向', '南面'], ['上海位于成都的大致方向', '东面'],
            ['成都位于上海的大致方向', '西面'], ['哈尔滨位于北京的大致方向', '东北'], ['昆明位于北京的大致方向', '西南'],
            ['乌鲁木齐位于北京的大致方向', '西北'], ['福州位于武汉的大致方向', '东南'], ['济南位于郑州的大致方向', '东北'],
            ['南宁位于长沙的大致方向', '西南'], ['杭州位于合肥的大致方向', '东南'], ['西安位于南京的大致方向', '西北'],
            ['沈阳位于天津的大致方向', '东北'], ['拉萨位于成都的大致方向', '西面'], ['海口位于广州的大致方向', '南面'],
            ['呼和浩特位于太原的大致方向', '北面'], ['青岛位于济南的大致方向', '东面'], ['兰州位于西安的大致方向', '西面'],
            ['长沙位于武汉的大致方向', '南面'], ['南京位于合肥的大致方向', '东面'], ['贵阳位于重庆的大致方向', '南面'],
            ['长春位于沈阳的大致方向', '东北'],
        ]),
    ],
    'knowledge-astronomy': [
        { id: 'astro.earth-star', prompt: '地球围绕哪颗恒星运行', answer: '太阳', wrong: ['月球', '火星', '北极星'] },
        { id: 'astro.satellite', prompt: '地球的天然卫星', answer: '月球', wrong: ['金星', '太阳', '木星'] },
        { id: 'astro.red', prompt: '常被称为红色星球的是', answer: '火星', wrong: ['金星', '水星', '土星'] },
        { id: 'astro.largest', prompt: '太阳系体积最大的行星', answer: '木星', wrong: ['地球', '火星', '海王星'] },
        { id: 'astro.ring', prompt: '以明显光环著称的行星', answer: '土星', wrong: ['水星', '地球', '火星'] },
        { id: 'astro.day-night', prompt: '昼夜交替主要由什么造成', answer: '地球自转', wrong: ['地球公转', '月球公转', '太阳自转'] },
        { id: 'astro.year', prompt: '一年主要对应地球完成一次', answer: '绕太阳公转', wrong: ['自转', '绕月球公转', '太阳公转'] },
        { id: 'astro.galaxy', prompt: '太阳系所在的星系', answer: '银河系', wrong: ['仙女座星系', '大麦哲伦云', '猎户座'] },
        ...relationFacts('astro.extra', [
            ['距离太阳最近的行星', '水星'], ['太阳系最热的行星', '金星'], ['人类居住的行星', '地球'], ['距离太阳最远的行星', '海王星'],
            ['太阳系中有几颗行星', '八颗'], ['月球本身是否发光', '不会'], ['月相变化主要与什么有关', '日地月相对位置'], ['日食发生时谁位于日地之间', '月球'],
            ['月食发生时谁位于日月之间', '地球'], ['北斗七星属于哪个星座', '大熊座'], ['北极星大致指示什么方向', '北方'], ['太阳主要由什么气体构成', '氢和氦'],
            ['恒星与行星的主要区别', '恒星自身发光'], ['彗星接近太阳时常出现', '彗尾'], ['流星通常在哪一层发生', '大气层'], ['宇航员在轨道中呈现失重是因', '持续自由落体'],
            ['国际空间站绕什么运行', '地球'], ['太阳系年龄大约为', '四十六亿年'], ['光年是衡量什么的单位', '距离'], ['天文望远镜主要用于', '观测天体'],
            ['银河系外形大致属于', '棒旋星系'], ['潮汐主要受哪个天体引力影响', '月球'],
        ]),
    ],
    'knowledge-biology': [
        { id: 'biology.photosynthesis', prompt: '绿色植物制造有机物主要靠', answer: '光合作用', wrong: ['蒸腾作用', '呼吸作用', '消化作用'] },
        { id: 'biology.breath', prompt: '人体进行气体交换的主要器官', answer: '肺', wrong: ['胃', '肾', '肝'] },
        { id: 'biology.blood', prompt: '推动血液循环的主要器官', answer: '心脏', wrong: ['肺', '胃', '胰腺'] },
        { id: 'biology.plant-water', prompt: '植物吸收水分的主要部位', answer: '根', wrong: ['花', '果实', '种子'] },
        { id: 'biology.bird', prompt: '鸟类身体表面通常覆盖', answer: '羽毛', wrong: ['鳞片', '毛发', '甲壳'] },
        { id: 'biology.fish', prompt: '鱼类主要依靠什么呼吸', answer: '鳃', wrong: ['肺', '皮毛', '气孔'] },
        { id: 'biology.seed', prompt: '种子萌发通常首先需要', answer: '适量水分', wrong: ['强烈阳光', '大量肥料', '低温冰冻'] },
        { id: 'biology.teeth', prompt: '门齿主要用于', answer: '切断食物', wrong: ['磨碎食物', '听声音', '过滤空气'] },
        ...relationFacts('biology.extra', [
            ['人体最大的器官', '皮肤'], ['人体负责思考的主要器官', '大脑'], ['人体消化食物的主要场所', '小肠'], ['血液中运输氧气的细胞', '红细胞'],
            ['骨骼和肌肉共同帮助人体', '运动'], ['植物进行光合作用常需要的气体', '二氧化碳'], ['植物光合作用释放的气体', '氧气'], ['叶片散失水分的过程', '蒸腾作用'],
            ['昆虫通常有几条腿', '六条'], ['蜘蛛通常有几条腿', '八条'], ['哺乳动物幼体通常以什么为食', '乳汁'], ['两栖动物典型代表', '青蛙'],
            ['爬行动物身体表面常覆盖', '鳞片'], ['鸟类繁殖通常依靠', '产卵'], ['真菌中常用于发酵面包的是', '酵母菌'], ['制作酸奶常用的微生物', '乳酸菌'],
            ['预防传染病的重要做法', '勤洗手'], ['维生素D有助于身体吸收', '钙'], ['人类正常体温大约', '三十七摄氏度'], ['瞳孔主要调节进入眼睛的', '光线'],
            ['耳蜗属于人体哪个器官', '耳'], ['生物分类的基本单位', '种'],
        ]),
    ],
    'knowledge-physics': [
        { id: 'physics.gravity', prompt: '物体下落主要受到', answer: '重力', wrong: ['浮力', '磁力', '弹力'] },
        { id: 'physics.sound', prompt: '声音不能在什么环境传播', answer: '真空', wrong: ['空气', '水', '钢铁'] },
        { id: 'physics.shadow', prompt: '影子的形成说明光通常', answer: '沿直线传播', wrong: ['只会弯曲', '没有方向', '不能反射'] },
        { id: 'physics.float', prompt: '轮船能浮在水面主要受到', answer: '浮力', wrong: ['磁力', '电力', '摩擦力'] },
        { id: 'physics.friction', prompt: '鞋底花纹主要用于增大', answer: '摩擦力', wrong: ['浮力', '重力', '弹力'] },
        { id: 'physics.lever', prompt: '使用开瓶器体现的简单机械', answer: '杠杆', wrong: ['滑轮', '斜面', '齿轮'] },
        { id: 'physics.reflect', prompt: '平面镜成像利用光的', answer: '反射', wrong: ['吸收', '发声', '导电'] },
        { id: 'physics.conductor', prompt: '下列通常容易导电的是', answer: '铜线', wrong: ['橡皮', '玻璃', '干木块'] },
        ...relationFacts('physics.extra', [
            ['力的国际单位', '牛顿'], ['质量的国际单位', '千克'], ['长度的国际单位', '米'], ['电流的国际单位', '安培'],
            ['温度计利用物质的什么性质', '热胀冷缩'], ['冰融化成水属于什么变化', '物理变化'], ['水沸腾时液体变成', '气体'], ['水结冰时体积通常', '变大'],
            ['光在真空中的速度约为', '每秒三十万千米'], ['白光经过三棱镜会发生', '色散'], ['凸透镜对平行光具有', '会聚作用'], ['凹透镜对平行光具有', '发散作用'],
            ['回声是声音发生了', '反射'], ['音调高低主要取决于振动', '频率'], ['声音响度主要与振动什么有关', '振幅'], ['磁铁同名磁极之间会', '相互排斥'],
            ['磁铁异名磁极之间会', '相互吸引'], ['电路形成电流需要', '闭合回路'], ['保险丝主要防止电流', '过大'], ['滑动摩擦通常比滚动摩擦', '更大'],
            ['潜水艇改变浮沉主要调节', '自身重力'], ['压力大小等于压力除以', '受力面积'],
        ]),
    ],
    'knowledge-technology': [
        { id: 'tech.cpu', prompt: '计算机中负责运算控制的核心部件', answer: 'CPU', wrong: ['显示器', '键盘', '音箱'] },
        { id: 'tech.qr', prompt: '二维码主要用于', answer: '编码和读取信息', wrong: ['测量温度', '放大声音', '净化空气'] },
        { id: 'tech.gps', prompt: '手机导航定位常使用', answer: '卫星定位', wrong: ['显微镜', '指南针磁化', '声呐捕鱼'] },
        { id: 'tech.wifi', prompt: 'Wi-Fi主要提供', answer: '无线网络连接', wrong: ['食品冷藏', '机械动力', '水质过滤'] },
        { id: 'tech.cloud', prompt: '云存储通常把数据保存在', answer: '远程服务器', wrong: ['纸张', '电池', '扬声器'] },
        { id: 'tech.password', prompt: '更安全的密码做法是', answer: '使用不同的复杂密码', wrong: ['所有网站相同', '告诉陌生人', '只用生日'] },
        { id: 'tech.update', prompt: '及时安装安全更新有助于', answer: '修复已知漏洞', wrong: ['耗尽电池', '删除屏幕', '关闭网络'] },
        { id: 'tech.backup', prompt: '定期备份数据主要为了', answer: '防止意外丢失', wrong: ['降低音量', '加快充电', '改变颜色'] },
        ...relationFacts('tech.extra', [
            ['RAM主要用于临时存放', '运行数据'], ['SSD属于哪类设备', '存储设备'], ['显示器主要负责', '输出图像'], ['键盘主要属于', '输入设备'],
            ['操作系统主要负责', '管理软硬件资源'], ['浏览器主要用于', '访问网页'], ['搜索引擎主要用于', '检索网络信息'], ['电子邮件主要用于', '传递电子信件'],
            ['蓝牙适合进行什么连接', '短距离无线连接'], ['NFC常用于', '近距离通信'], ['USB接口常用于', '连接设备传输数据'], ['压缩文件主要为了', '减小存储体积'],
            ['防火墙主要用于', '过滤网络访问'], ['验证码主要用于', '确认操作者身份'], ['双重验证主要提高', '账户安全性'], ['钓鱼网站常伪装成', '可信网站'],
            ['人工智能训练通常需要', '数据和算法'], ['机器人感知环境常使用', '传感器'], ['太阳能电池板把光能转为', '电能'], ['电动汽车主要由什么驱动', '电动机'],
            ['3D打印通过什么方式成形', '逐层制造'], ['条形码主要用于', '标识商品信息'],
        ]),
    ],
    'history-modern-opening': relationFacts('history.opening.extra', [
        ['《南京条约》签订于哪一年', '1842年'], ['第二次鸦片战争开始于哪一年', '1856年'], ['火烧圆明园发生于哪一年', '1860年'],
        ['洋务运动前期主要口号', '自强'], ['洋务运动后期主要口号', '求富'], ['创办江南制造总局的人物', '李鸿章'],
        ['创办福州船政局的人物', '左宗棠'], ['北洋水师在哪场战争中覆没', '甲午战争'], ['《马关条约》割让的岛屿', '台湾'],
        ['提出“师夷长技以制夷”的人物', '魏源'],
    ]),
    'history-modern-awakening': relationFacts('history.awakening.extra', [
        ['戊戌变法发生于哪一年', '1898年'], ['戊戌变法又称', '百日维新'], ['领导戊戌变法的重要人物', '康有为'], ['辛亥革命爆发于哪一年', '1911年'],
        ['辛亥革命首先爆发的城市', '武昌'], ['中华民国临时政府成立地', '南京'], ['新文化运动兴起的主要阵地', '《新青年》'], ['五四运动爆发于哪一年', '1919年'],
        ['五四运动首先爆发的城市', '北京'], ['中国共产党成立于哪一年', '1921年'], ['中共一大最后一天会议地点', '南湖红船'], ['北伐战争开始于哪一年', '1926年'],
        ['南昌起义发生于哪一年', '1927年'], ['秋收起义领导人', '毛泽东'], ['井冈山革命根据地位于', '江西'], ['红军长征开始于哪一年', '1934年'],
        ['遵义会议召开于哪一年', '1935年'], ['长征胜利会师的重要地点', '会宁'], ['新文化运动提倡的两面旗帜', '民主与科学'], ['《狂人日记》的作者', '鲁迅'],
    ]),
    'history-modern-resistance': relationFacts('history.resistance.extra', [
        ['九一八事变发生于哪一年', '1931年'], ['九一八事变发生地', '沈阳'], ['西安事变发生于哪一年', '1936年'], ['七七事变发生于哪一年', '1937年'],
        ['七七事变发生地', '卢沟桥'], ['淞沪会战主要发生在哪座城市', '上海'], ['南京大屠杀发生于哪一年', '1937年'], ['平型关大捷发生于哪一年', '1937年'],
        ['台儿庄大捷指挥者', '李宗仁'], ['百团大战主要指挥者', '彭德怀'], ['百团大战开始于哪一年', '1940年'], ['抗日战争胜利于哪一年', '1945年'],
        ['日本宣布无条件投降的月份', '1945年8月'], ['抗战时期陪都', '重庆'], ['东北抗日联军代表人物', '杨靖宇'], ['《义勇军进行曲》作曲者', '聂耳'],
        ['《义勇军进行曲》作词者', '田汉'], ['抗战胜利纪念日', '9月3日'], ['全民族抗战开始标志', '七七事变'], ['抗日民族统一战线正式形成于', '1937年'],
    ]),
    'history-ancient': relationFacts('history.ancient.extra', [
        ['秦朝建立于哪一年', '公元前221年'], ['汉朝开国皇帝', '刘邦'], ['唐朝开国皇帝', '李渊'], ['宋朝开国皇帝', '赵匡胤'],
        ['元朝建立者', '忽必烈'], ['明朝建立者', '朱元璋'], ['清朝入关后的首位皇帝', '顺治帝'], ['科举制度正式形成于哪个朝代', '隋朝'],
    ]),
    'history-myth': relationFacts('history.myth.extra', [
        ['开天辟地的神话人物', '盘古'], ['炼石补天的神话人物', '女娲'], ['追逐太阳的神话人物', '夸父'], ['填海的神鸟', '精卫'],
        ['射下九个太阳的英雄', '后羿'], ['奔月的神话人物', '嫦娥'], ['治理洪水三过家门不入的人物', '大禹'], ['钻木取火的传说人物', '燧人氏'],
        ['教民结网捕鱼的传说人物', '伏羲'], ['尝百草的传说人物', '神农'], ['愚公移山中阻挡道路的山', '太行王屋'], ['八仙过海常用的下半句', '各显神通'],
        ['哪吒使用的兵器之一', '火尖枪'], ['孙悟空的兵器', '金箍棒'], ['二郎神额头上的特征', '第三只眼'], ['牛郎织女相会的日子', '七夕'],
        ['白蛇传中白娘子的名字', '白素贞'], ['孟姜女传说与哪处建筑有关', '长城'],
    ]),
    'history-person-event': [
        { id: 'person.qin', prompt: '统一六国并建立秦朝的人物', answer: '秦始皇', wrong: ['汉武帝', '唐太宗', '宋太祖'] },
        { id: 'person.zhenghe', prompt: '明代率船队七下西洋的人物', answer: '郑和', wrong: ['张骞', '玄奘', '鉴真'] },
        { id: 'person.linzexu', prompt: '主持虎门销烟的人物', answer: '林则徐', wrong: ['魏源', '左宗棠', '曾国藩'] },
        { id: 'person.sun', prompt: '领导辛亥革命的重要人物', answer: '孙中山', wrong: ['康有为', '李鸿章', '林则徐'] },
        { id: 'person.simaqian', prompt: '《史记》的作者', answer: '司马迁', wrong: ['司马光', '班固', '陈寿'] },
        { id: 'person.lishizhen', prompt: '《本草纲目》的作者', answer: '李时珍', wrong: ['张仲景', '华佗', '孙思邈'] },
        { id: 'person.bisheng', prompt: '活字印刷术的发明者', answer: '毕昇', wrong: ['蔡伦', '张衡', '祖冲之'] },
        { id: 'person.zhangqian', prompt: '西汉出使西域的重要人物', answer: '张骞', wrong: ['班超', '郑和', '玄奘'] },
        ...relationFacts('person.extra', [
            ['改进造纸术的东汉人物', '蔡伦'], ['测定圆周率精确值的古代数学家', '祖冲之'], ['发明地动仪的东汉科学家', '张衡'],
            ['撰写《资治通鉴》的史学家', '司马光'], ['提出“先天下之忧而忧”的文学家', '范仲淹'], ['抗金名将《满江红》的作者', '岳飞'],
            ['主持修建都江堰的战国人物', '李冰'], ['唐代西行取经的高僧', '玄奘'], ['东渡日本传播文化的唐代高僧', '鉴真'],
            ['收复台湾的明末清初人物', '郑成功'], ['领导南昌起义的重要人物之一', '周恩来'], ['杂交水稻研究的科学家', '袁隆平'],
            ['中国铁路工程先驱', '詹天佑'], ['主持编写《天工开物》的学者', '宋应星'], ['《梦溪笔谈》的作者', '沈括'],
            ['提出日心说的科学家', '哥白尼'], ['发现万有引力定律的科学家', '牛顿'], ['提出相对论的科学家', '爱因斯坦'],
            ['环球航行船队的发起者', '麦哲伦'], ['发现青霉素的科学家', '弗莱明'], ['发明蒸汽机改良方案的工程师', '瓦特'],
            ['领导美国独立战争的重要人物', '华盛顿'],
        ]),
    ],
};

export const EXPANSION_ORDER_PACKS: Readonly<Partial<Record<QuestionTemplateId, readonly OrderedFact[]>>> = {
    'english-word-order': [
        { id: 'sentence.i-like-apples', prompt: '组成英语句子', parts: ['I', 'LIKE', 'APPLES'] },
        { id: 'sentence.she-can-swim', prompt: '组成英语句子', parts: ['SHE', 'CAN', 'SWIM'] },
        { id: 'sentence.this-is-book', prompt: '组成英语句子', parts: ['THIS', 'IS', 'A', 'BOOK'] },
        { id: 'sentence.we-go-school', prompt: '组成英语句子', parts: ['WE', 'GO', 'TO', 'SCHOOL'] },
        { id: 'sentence.bird-can-fly', prompt: '组成英语句子', parts: ['THE', 'BIRD', 'CAN', 'FLY'] },
        { id: 'sentence.he-reads-books', prompt: '组成英语句子', parts: ['HE', 'READS', 'BOOKS'] },
        { id: 'sentence.the-sun-shines', prompt: '组成英语句子', parts: ['THE', 'SUN', 'SHINES'] },
        { id: 'sentence.they-play-football', prompt: '组成英语句子', parts: ['THEY', 'PLAY', 'FOOTBALL'] },
        { id: 'sentence.extra.01', prompt: '组成英语句子', parts: ['I', 'AM', 'HAPPY'] },
        { id: 'sentence.extra.02', prompt: '组成英语句子', parts: ['YOU', 'ARE', 'MY', 'FRIEND'] },
        { id: 'sentence.extra.03', prompt: '组成英语句子', parts: ['HE', 'LIKES', 'MUSIC'] },
        { id: 'sentence.extra.04', prompt: '组成英语句子', parts: ['SHE', 'HAS', 'A', 'CAT'] },
        { id: 'sentence.extra.05', prompt: '组成英语句子', parts: ['WE', 'LOVE', 'OUR', 'HOME'] },
        { id: 'sentence.extra.06', prompt: '组成英语句子', parts: ['THEY', 'GO', 'TO', 'WORK'] },
        { id: 'sentence.extra.07', prompt: '组成英语句子', parts: ['THE', 'SKY', 'IS', 'BLUE'] },
        { id: 'sentence.extra.08', prompt: '组成英语句子', parts: ['THE', 'FLOWER', 'IS', 'RED'] },
        { id: 'sentence.extra.09', prompt: '组成英语句子', parts: ['MY', 'DOG', 'CAN', 'RUN'] },
        { id: 'sentence.extra.10', prompt: '组成英语句子', parts: ['PLEASE', 'OPEN', 'THE', 'DOOR'] },
        { id: 'sentence.extra.11', prompt: '组成英语句子', parts: ['PLEASE', 'CLOSE', 'THE', 'WINDOW'] },
        { id: 'sentence.extra.12', prompt: '组成英语句子', parts: ['WE', 'EAT', 'RICE'] },
        { id: 'sentence.extra.13', prompt: '组成英语句子', parts: ['SHE', 'DRINKS', 'MILK'] },
        { id: 'sentence.extra.14', prompt: '组成英语句子', parts: ['HE', 'RIDES', 'A', 'BIKE'] },
        { id: 'sentence.extra.15', prompt: '组成英语句子', parts: ['THE', 'MOON', 'IS', 'BRIGHT'] },
        { id: 'sentence.extra.16', prompt: '组成英语句子', parts: ['BIRDS', 'SING', 'IN', 'TREES'] },
        { id: 'sentence.extra.17', prompt: '组成英语句子', parts: ['FISH', 'SWIM', 'IN', 'WATER'] },
        { id: 'sentence.extra.18', prompt: '组成英语句子', parts: ['IT', 'IS', 'A', 'SUNNY', 'DAY'] },
        { id: 'sentence.extra.19', prompt: '组成英语句子', parts: ['THIS', 'APPLE', 'IS', 'SWEET'] },
        { id: 'sentence.extra.20', prompt: '组成英语句子', parts: ['THAT', 'BOX', 'IS', 'HEAVY'] },
        { id: 'sentence.extra.21', prompt: '组成英语句子', parts: ['CHILDREN', 'PLAY', 'IN', 'THE', 'PARK'] },
        { id: 'sentence.extra.22', prompt: '组成英语句子', parts: ['STUDENTS', 'READ', 'IN', 'THE', 'LIBRARY'] },
    ],
    'life-process': [
        { id: 'process.handwash', prompt: '洗手', parts: ['打湿双手', '涂洗手液', '揉搓双手', '冲净擦干'] },
        { id: 'process.toothbrush', prompt: '刷牙', parts: ['挤牙膏', '刷牙齿', '漱口', '清洗牙刷'] },
        { id: 'process.cook-rice', prompt: '电饭锅煮饭', parts: ['量取大米', '淘米加水', '按煮饭键', '等待煮熟'] },
        { id: 'process.mail', prompt: '寄快递', parts: ['包装物品', '填写信息', '交给快递员', '查询物流'] },
        { id: 'process.bus', prompt: '乘公交', parts: ['查看线路', '排队候车', '上车付费', '到站下车'] },
        { id: 'process.library', prompt: '借书', parts: ['查找图书', '取下图书', '办理借阅', '按期归还'] },
        { id: 'process.laundry', prompt: '洗衣', parts: ['分类衣物', '放入洗衣机', '启动洗涤', '取出晾晒'] },
        { id: 'process.recycle', prompt: '扔垃圾', parts: ['确认类别', '找到对应桶', '分类投放', '清洁双手'] },
        { id: 'process.extra.01', prompt: '泡茶', parts: ['准备茶具', '放入茶叶', '注入热水', '等待冲泡'] },
        { id: 'process.extra.02', prompt: '整理书包', parts: ['看课程表', '取出书本', '装入书包', '检查文具'] },
        { id: 'process.extra.03', prompt: '雨天收伞', parts: ['进入避雨处', '抖落雨水', '收拢雨伞', '放入伞架'] },
        { id: 'process.extra.04', prompt: '网购收货', parts: ['查看物流', '核对包裹', '开箱验货', '确认收货'] },
        { id: 'process.extra.05', prompt: '乘火车', parts: ['购买车票', '通过安检', '检票进站', '按座乘车'] },
        { id: 'process.extra.06', prompt: '看病', parts: ['预约挂号', '医生问诊', '检查诊断', '遵医嘱治疗'] },
        { id: 'process.extra.07', prompt: '做作业', parts: ['准备用品', '阅读题目', '完成作答', '检查订正'] },
        { id: 'process.extra.08', prompt: '用灭火器', parts: ['提起瓶体', '拔保险销', '对准火根', '压柄喷射'] },
        { id: 'process.extra.09', prompt: '晨起准备', parts: ['起床穿衣', '刷牙洗脸', '整理床铺', '准备早餐'] },
        { id: 'process.extra.10', prompt: '晾晒衣物', parts: ['洗净衣物', '取出抖平', '挂上衣架', '放到通风处'] },
        { id: 'process.extra.11', prompt: '打印文件', parts: ['打开文件', '检查页面', '选择打印机', '确认打印'] },
        { id: 'process.extra.12', prompt: '用微波炉', parts: ['放入适用容器', '关好炉门', '设置时间', '戴手套取出'] },
        { id: 'process.extra.13', prompt: '乘电梯', parts: ['按呼梯键', '等待停稳', '先下后上', '按楼层'] },
        { id: 'process.extra.14', prompt: '种盆栽', parts: ['备好盆土', '放入种子', '覆土浇水', '放到适宜处'] },
        { id: 'process.extra.15', prompt: '做沙拉', parts: ['清洗食材', '切分食材', '放入容器', '加调料拌匀'] },
        { id: 'process.extra.16', prompt: '骑共享单车', parts: ['找到车辆', '扫码解锁', '安全骑行', '停车上锁'] },
        { id: 'process.extra.17', prompt: '入住酒店', parts: ['出示证件', '办理登记', '领取房卡', '找到房间'] },
        { id: 'process.extra.18', prompt: '超市结账', parts: ['挑选商品', '前往收银台', '核对付款', '取走商品'] },
        { id: 'process.extra.19', prompt: '处理擦伤', parts: ['清洁双手', '冲洗伤口', '消毒处理', '盖上敷料'] },
        { id: 'process.extra.20', prompt: 'ATM取款', parts: ['插卡或扫码', '验证身份', '选择金额', '取现金和卡'] },
        { id: 'process.extra.21', prompt: '整理房间', parts: ['分类物品', '归位收纳', '清扫地面', '开窗通风'] },
        { id: 'process.extra.22', prompt: '参加考试', parts: ['准备文具', '进入考场', '阅读要求', '答完检查'] },
    ],
    'history-chronology': [
        { id: 'chronology.dynasty-1', prompt: '按朝代先后排序', parts: ['秦', '汉', '唐', '宋'] },
        { id: 'chronology.dynasty-2', prompt: '按朝代先后排序', parts: ['夏', '商', '周', '秦'] },
        { id: 'chronology.dynasty-3', prompt: '按朝代先后排序', parts: ['隋', '唐', '宋', '元'] },
        { id: 'chronology.modern-1', prompt: '按事件先后排序', parts: ['鸦片战争', '洋务运动', '戊戌变法', '辛亥革命'] },
        { id: 'chronology.modern-2', prompt: '按事件先后排序', parts: ['五四运动', '九一八事变', '七七事变', '抗战胜利'] },
        { id: 'chronology.discovery', prompt: '按发明出现先后排序', parts: ['造纸术', '印刷术', '指南针航海', '蒸汽机'] },
        { id: 'chronology.republic', prompt: '按事件先后排序', parts: ['辛亥革命', '五四运动', '北伐战争', '抗战胜利'] },
        { id: 'chronology.world', prompt: '按时代先后排序', parts: ['古代', '中世纪', '近代', '现代'] },
        { id: 'chronology.extra.01', prompt: '按朝代先后排序', parts: ['汉', '三国', '晋', '隋'] },
        { id: 'chronology.extra.02', prompt: '按朝代先后排序', parts: ['唐', '五代', '宋', '元'] },
        { id: 'chronology.extra.03', prompt: '按朝代先后排序', parts: ['宋', '元', '明', '清'] },
        { id: 'chronology.extra.04', prompt: '按事件先后排序', parts: ['商鞅变法', '秦统一', '楚汉相争', '文景之治'] },
        { id: 'chronology.extra.05', prompt: '按事件先后排序', parts: ['张骞出使西域', '赤壁之战', '隋朝统一', '贞观之治'] },
        { id: 'chronology.extra.06', prompt: '按事件先后排序', parts: ['安史之乱', '陈桥兵变', '靖康之变', '元朝建立'] },
        { id: 'chronology.extra.07', prompt: '按事件先后排序', parts: ['郑和下西洋', '土木堡之变', '戚继光抗倭', '明朝灭亡'] },
        { id: 'chronology.extra.08', prompt: '按事件先后排序', parts: ['康熙即位', '乾隆即位', '鸦片战争', '太平天国运动'] },
        { id: 'chronology.extra.09', prompt: '按事件先后排序', parts: ['洋务运动', '甲午战争', '戊戌变法', '义和团运动'] },
        { id: 'chronology.extra.10', prompt: '按事件先后排序', parts: ['辛亥革命', '新文化运动', '五四运动', '北伐战争'] },
        { id: 'chronology.extra.11', prompt: '按事件先后排序', parts: ['九一八事变', '西安事变', '七七事变', '抗战胜利'] },
        { id: 'chronology.extra.12', prompt: '按事件先后排序', parts: ['抗战胜利', '新中国成立', '恢复联合国席位', '改革开放'] },
        { id: 'chronology.extra.13', prompt: '按发明先后排序', parts: ['造纸术', '火药', '活字印刷', '蒸汽机'] },
        { id: 'chronology.extra.14', prompt: '按探索先后排序', parts: ['张骞通西域', '玄奘西行', '郑和下西洋', '麦哲伦航行'] },
        { id: 'chronology.extra.15', prompt: '按作品时代排序', parts: ['《诗经》', '《史记》', '唐诗', '宋词'] },
        { id: 'chronology.extra.16', prompt: '按科技成就排序', parts: ['地动仪', '圆周率研究', '活字印刷', '蒸汽机'] },
        { id: 'chronology.extra.17', prompt: '按世界事件排序', parts: ['文艺复兴', '地理大发现', '工业革命', '互联网兴起'] },
        { id: 'chronology.extra.18', prompt: '按世界事件排序', parts: ['美国独立', '法国大革命', '第一次世界大战', '第二次世界大战'] },
        { id: 'chronology.extra.19', prompt: '按交通发展排序', parts: ['马车', '蒸汽火车', '汽车', '民航客机'] },
        { id: 'chronology.extra.20', prompt: '按通信发展排序', parts: ['驿站', '电报', '电话', '互联网'] },
        { id: 'chronology.extra.21', prompt: '按记录方式排序', parts: ['甲骨文字', '竹简', '纸张书籍', '电子文档'] },
        { id: 'chronology.extra.22', prompt: '按照明发展排序', parts: ['油灯', '煤气灯', '白炽灯', 'LED灯'] },
    ],
};
