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
    { id: 'pinyin.sky', character: '天', pinyin: 'tiān', homophone: '添', tone: '一声' },
    { id: 'pinyin.earth', character: '地', pinyin: 'dì', homophone: '弟', tone: '四声' },
    { id: 'pinyin.person', character: '人', pinyin: 'rén', homophone: '仁', tone: '二声' },
    { id: 'pinyin.door', character: '门', pinyin: 'mén', homophone: '们', tone: '二声' },
    { id: 'pinyin.heart', character: '心', pinyin: 'xīn', homophone: '新', tone: '一声' },
    { id: 'pinyin.star', character: '星', pinyin: 'xīng', homophone: '兴', tone: '一声' },
    { id: 'pinyin.river', character: '河', pinyin: 'hé', homophone: '合', tone: '二声' },
    { id: 'pinyin.sea', character: '海', pinyin: 'hǎi', homophone: '害', tone: '三声' },
    { id: 'pinyin.forest', character: '林', pinyin: 'lín', homophone: '临', tone: '二声' },
    { id: 'pinyin.field', character: '田', pinyin: 'tián', homophone: '甜', tone: '二声' },
    { id: 'pinyin.spring', character: '春', pinyin: 'chūn', homophone: '椿', tone: '一声' },
    { id: 'pinyin.autumn', character: '秋', pinyin: 'qiū', homophone: '丘', tone: '一声' },
    { id: 'pinyin.winter', character: '冬', pinyin: 'dōng', homophone: '东', tone: '一声' },
    { id: 'pinyin.light', character: '光', pinyin: 'guāng', homophone: '逛', tone: '一声' },
    { id: 'pinyin.bright', character: '明', pinyin: 'míng', homophone: '名', tone: '二声' },
    { id: 'pinyin.white', character: '白', pinyin: 'bái', homophone: '百', tone: '二声' },
    { id: 'pinyin.red', character: '红', pinyin: 'hóng', homophone: '洪', tone: '二声' },
    { id: 'pinyin.blue', character: '蓝', pinyin: 'lán', homophone: '兰', tone: '二声' },
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
    { id: 'poetry.13', prompt: '海内存知己，天涯若比( )', answer: '邻', wrong: ['亲', '心', '人'] },
    { id: 'poetry.14', prompt: '会当凌绝顶，一览众山( )', answer: '小', wrong: ['高', '远', '青'] },
    { id: 'poetry.15', prompt: '不识庐山真面目，只缘身在此山( )', answer: '中', wrong: ['外', '前', '后'] },
    { id: 'poetry.16', prompt: '竹外桃花三两枝，春江水暖鸭先( )', answer: '知', wrong: ['来', '游', '归'] },
    { id: 'poetry.17', prompt: '接天莲叶无穷碧，映日荷花别样( )', answer: '红', wrong: ['香', '美', '浓'] },
    { id: 'poetry.18', prompt: '千里莺啼绿映红，水村山郭酒旗( )', answer: '风', wrong: ['中', '高', '扬'] },
    { id: 'poetry.19', prompt: '停车坐爱枫林晚，霜叶红于二月( )', answer: '花', wrong: ['春', '霞', '红'] },
    { id: 'poetry.20', prompt: '孤帆远影碧空尽，唯见长江天际( )', answer: '流', wrong: ['来', '去', '舟'] },
    { id: 'poetry.21', prompt: '春风又绿江南岸，明月何时照我( )', answer: '还', wrong: ['归', '来', '行'] },
    { id: 'poetry.22', prompt: '等闲识得东风面，万紫千红总是( )', answer: '春', wrong: ['花', '景', '香'] },
    { id: 'poetry.23', prompt: '纸上得来终觉浅，绝知此事要躬( )', answer: '行', wrong: ['学', '知', '读'] },
    { id: 'poetry.24', prompt: '山重水复疑无路，柳暗花明又一( )', answer: '村', wrong: ['家', '春', '城'] },
    { id: 'poetry.25', prompt: '莫愁前路无知己，天下谁人不识( )', answer: '君', wrong: ['我', '卿', '友'] },
    { id: 'poetry.26', prompt: '沉舟侧畔千帆过，病树前头万木( )', answer: '春', wrong: ['生', '青', '新'] },
    { id: 'poetry.27', prompt: '洛阳亲友如相问，一片冰心在玉( )', answer: '壶', wrong: ['盘', '杯', '瓶'] },
    { id: 'poetry.28', prompt: '欲把西湖比西子，淡妆浓抹总相( )', answer: '宜', wrong: ['美', '似', '知'] },
    { id: 'poetry.29', prompt: '问渠那得清如许，为有源头活水( )', answer: '来', wrong: ['流', '清', '开'] },
    { id: 'poetry.30', prompt: '少壮不努力，老大徒伤( )', answer: '悲', wrong: ['心', '情', '身'] },
];
