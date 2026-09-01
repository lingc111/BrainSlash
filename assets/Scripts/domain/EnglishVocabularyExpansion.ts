import type { EnglishWord } from './ContentCatalog';

type Category = EnglishWord['category'];

function words(category: Category, source: string): EnglishWord[] {
    return source.split(',').map((entry) => {
        const [en, zh] = entry.split(':');
        return { en, zh, category };
    });
}

export const ENGLISH_EXTRA_WORDS: readonly EnglishWord[] = [
    ...words('动物', 'ANT:蚂蚁,COW:奶牛,DUCK:鸭子,GOAT:山羊,PIG:猪,MOUSE:老鼠,DEER:鹿,SNAKE:蛇,FROG:青蛙,WHALE:鲸,SHARK:鲨鱼,DOLPHIN:海豚,OCTOPUS:章鱼,EAGLE:鹰,OWL:猫头鹰,PARROT:鹦鹉,PEACOCK:孔雀,CAMEL:骆驼,DONKEY:驴,KANGAROO:袋鼠,KOALA:考拉,LEOPARD:豹,CHEETAH:猎豹,RHINO:犀牛,HIPPO:河马,CROCODILE:鳄鱼,TURTLE:海龟,PENGUIN:企鹅,SEAL:海豹,OTTER:水獭,SQUIRREL:松鼠,HAMSTER:仓鼠,BUTTERFLY:蝴蝶,BEE:蜜蜂'),
    ...words('颜色', 'NAVY:藏青色,TEAL:蓝绿色,MAROON:栗色,OLIVE:橄榄色,LIME:酸橙绿,INDIGO:靛蓝色,VIOLET:紫罗兰色,MAGENTA:品红色,SCARLET:猩红色,CRIMSON:深红色,AMBER:琥珀色,CORAL:珊瑚色,IVORY:象牙白,KHAKI:卡其色,MINT:薄荷绿,LAVENDER:薰衣草紫,TURQUOISE:青绿色,BRONZE:青铜色,COPPER:铜色,CREAM:奶油色,MAUVE:淡紫色,VERMILION:朱红色,TAN:棕褐色,AQUA:水蓝色,CHARCOAL:炭灰色,RUBY:宝石红,EMERALD:祖母绿,SAFFRON:藏红花色,OCHRE:赭色,JADE:翡翠绿,SEPIA:深褐色,ECRU:米灰色,CANARY:鲜黄色,CERULEAN:蔚蓝色'),
    ...words('食物', 'POTATO:土豆,TOMATO:番茄,CARROT:胡萝卜,ONION:洋葱,CABBAGE:卷心菜,CORN:玉米,BEAN:豆,PEACH:桃,PLUM:李子,MANGO:芒果,LEMON:柠檬,WATERMELON:西瓜,STRAWBERRY:草莓,COOKIE:饼干,CANDY:糖果,CHOCOLATE:巧克力,PIZZA:比萨,HAMBURGER:汉堡,SANDWICH:三明治,SALAD:沙拉,DUMPLING:饺子,PORRIDGE:粥,YOGURT:酸奶,BUTTER:黄油,HONEY:蜂蜜,SALT:盐,SUGAR:糖,TEA:茶,WATER:水,STEAK:牛排,SAUSAGE:香肠,SHRIMP:虾,TOFU:豆腐,PUMPKIN:南瓜'),
    ...words('动作', 'CLAP:拍手,WAVE:挥手,NOD:点头,SIT:坐,STAND:站,CLIMB:攀爬,THROW:投掷,CATCH:接住,KICK:踢,PUSH:推,PULL:拉,OPEN:打开,CLOSE:关闭,WASH:清洗,COOK:烹饪,CUT:切,DRIVE:驾驶,RIDE:骑行,FLY:飞,SKATE:滑冰,SKI:滑雪,PAINT:绘画,BUILD:建造,CARRY:搬运,HOLD:握住,TOUCH:触摸,TURN:转动,STOP:停止,START:开始,WAIT:等待,HELP:帮助,LEARN:学习,TEACH:教授,WORK:工作'),
    ...words('物品', 'DESK:书桌,SOFA:沙发,MIRROR:镜子,TOWEL:毛巾,BRUSH:刷子,COMB:梳子,PLATE:盘子,BOWL:碗,SPOON:勺子,FORK:叉子,KNIFE:刀,BOTTLE:瓶子,UMBRELLA:雨伞,CAMERA:相机,RADIO:收音机,COMPUTER:电脑,SCREEN:屏幕,MOUSEPAD:鼠标垫,NOTEBOOK:笔记本,RULER:尺子,ERASER:橡皮,SCISSORS:剪刀,BASKET:篮子,BUCKET:水桶,PILLOW:枕头,BLANKET:毯子,TICKET:票,CARD:卡片,COIN:硬币,STAMP:邮票,TOY:玩具,ROPE:绳子,DRUM:鼓,GUITAR:吉他'),
    ...words('自然', 'LAKE:湖泊,OCEAN:海洋,ISLAND:岛屿,BEACH:海滩,DESERT:沙漠,VALLEY:山谷,HILL:小山,ROCK:岩石,SAND:沙子,SOIL:土壤,LEAF:叶子,ROOT:根,SEED:种子,BRANCH:树枝,WOOD:木头,FIRE:火,ICE:冰,FOG:雾,STORM:暴风雨,THUNDER:雷,LIGHTNING:闪电,RAINBOW:彩虹,SKY:天空,EARTH:地球,FIELD:田野,MEADOW:草地,WATERFALL:瀑布,STREAM:溪流,CAVE:洞穴,TIDE:潮汐,SHELL:贝壳,STONE:石头,DUST:尘土,MUD:泥土'),
];
