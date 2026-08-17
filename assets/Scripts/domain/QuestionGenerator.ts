import type { GameplayConfig } from '../configs/GameConfig';
import { validateQuestion } from './FairnessValidator';
import type { QuestionInstance, RuleId, TargetSpec, ThemeId } from './Models';
import { evaluateRules } from './Rules';
import { SeededRng } from './SeededRng';

type Stage = 0 | 1 | 2;
const COLOR_WORDS = ['红', '蓝', '绿', '黄'];

export class QuestionGenerator {
    private index = 0;
    public constructor(private readonly rng: SeededRng, private readonly config: GameplayConfig) {}

    public next(elapsedMs: number, stage: Stage): QuestionInstance {
        for (let attempt = 0; attempt < 8; attempt++) {
            const question = this.generate(elapsedMs, stage);
            if (!validateQuestion(question, evaluateRules(question)).length) return question;
        }
        return this.make('safe', 'math', '斩偶数', [{ id: '2', text: '2', value: 2 }, { id: '3', text: '3', value: 3 }], ['2'], ['standard'], stage);
    }

    private generate(elapsedMs: number, stage: Stage): QuestionInstance {
        const family = this.index++ % 9;
        if (family === 0) return this.parity(elapsedMs, stage);
        if (family === 1) return this.addition(elapsedMs, stage);
        if (family === 2) return this.order(elapsedMs, stage);
        if (family === 3) return this.direction(stage);
        if (family === 4) return this.stroop(elapsedMs, stage);
        if (family === 5) return this.vocabulary(stage);
        if (family === 6) return this.hanzi(stage);
        if (family === 7) return this.geography(stage);
        return this.life(stage);
    }

    private make(id: string, theme: ThemeId, prompt: string, targets: TargetSpec[], correct: string[], rules: RuleId[], stage: Stage): QuestionInstance {
        return { id: `${id}-${this.index}`, theme, prompt: { text: prompt }, targets, baseCorrectTargetIds: correct, activeRules: rules, timeLimitMs: this.config.questionTimeMs[stage], tutorialSafe: stage === 0 };
    }

    private parity(elapsedMs: number, stage: Stage): QuestionInstance {
        const values = this.rng.shuffle([2, 3, 6, 9, 12]).slice(0, stage + 3);
        const targets = values.map((value, i) => ({ id: `n${i}`, text: String(value), value }));
        const reverse = elapsedMs >= 15_000 && this.rng.next() < 0.25;
        return this.make('parity', 'math', reverse ? '反向·斩奇数' : '斩偶数', targets, targets.filter((t) => Number(t.value) % 2 === 0).map((t) => t.id), reverse ? ['reverse'] : stage === 0 ? ['standard'] : ['multi'], stage);
    }

    private addition(elapsedMs: number, stage: Stage): QuestionInstance {
        const a = this.rng.int(2, 9 + stage * 4), b = this.rng.int(2, 9 + stage * 4), answer = a + b;
        const values = this.rng.shuffle([answer, answer - 1, answer + 1, answer + 2]).slice(0, stage + 3);
        const targets: TargetSpec[] = values.map((value, i) => ({ id: `a${i}`, text: String(value), value }));
        const bomb = elapsedMs >= 15_000 && this.rng.next() < 0.3;
        if (bomb && targets.length < 6) targets.push({ id: 'bomb', text: '爆', isBomb: true });
        return this.make('add', 'math', `${a}+${b}=?`, targets, [targets.find((t) => t.value === answer)!.id], bomb ? ['bomb'] : ['standard'], stage);
    }

    private order(elapsedMs: number, stage: Stage): QuestionInstance {
        const values = this.rng.shuffle([1, 2, 3, 4, 5]).slice(0, Math.max(3, stage + 3));
        const targets = values.map((value, i) => ({ id: `o${i}`, text: String(value), value }));
        const ordered = [...targets].sort((a, b) => Number(a.value) - Number(b.value)).map((t) => t.id);
        const question = this.make('order', 'math', elapsedMs >= 15_000 ? '从小到大' : '斩最小', targets, ordered, elapsedMs >= 15_000 ? ['order'] : ['standard'], stage);
        question.orderedTargetIds = ordered;
        return question;
    }

    private direction(stage: Stage): QuestionInstance {
        const arrows = ['←', '↑', '→', '↓'], wanted = this.rng.pick(arrows);
        const targets = this.rng.shuffle(arrows).slice(0, stage + 3).map((text, i) => ({ id: `d${i}`, text, value: text }));
        return this.make('direction', 'vision', `斩 ${wanted}`, targets, [targets.find((t) => t.value === wanted)!.id], ['standard'], stage);
    }

    private stroop(elapsedMs: number, stage: Stage): QuestionInstance {
        const wanted = this.rng.pick(COLOR_WORDS);
        const targets = this.rng.shuffle(COLOR_WORDS).slice(0, stage + 3).map((color, i) => ({ id: `s${i}`, text: COLOR_WORDS[(i + 1) % COLOR_WORDS.length], colorName: color, value: color }));
        return this.make('stroop', 'vision', `斩字体颜色·${wanted}`, targets, [targets.find((t) => t.value === wanted)!.id], elapsedMs >= 15_000 ? ['stroop'] : ['standard'], stage);
    }

    private vocabulary(stage: Stage): QuestionInstance {
        const words = [{ en: 'CAT', zh: '猫' }, { en: 'SUN', zh: '太阳' }, { en: 'RED', zh: '红色' }, { en: 'RUN', zh: '跑' }], wanted = this.rng.pick(words);
        const targets = this.rng.shuffle(words).slice(0, stage + 3).map((word, i) => ({ id: `w${i}`, text: word.zh, value: word.en }));
        return this.make('word', 'english', `${wanted.en} 是？`, targets, [targets.find((t) => t.value === wanted.en)!.id], ['standard'], stage);
    }

    private hanzi(stage: Stage): QuestionInstance {
        const entries = [{ prompt: '画龙点□', answer: '睛', wrong: ['晴', '情', '精'] }, { prompt: '一心一□', answer: '意', wrong: ['亿', '忆', '议'] }, { prompt: '四面八□', answer: '方', wrong: ['芳', '房', '放'] }], entry = this.rng.pick(entries);
        const values = this.rng.shuffle([entry.answer, ...entry.wrong]).slice(0, stage + 3), targets = values.map((value, i) => ({ id: `h${i}`, text: value, value }));
        return this.make('hanzi', 'hanzi', entry.prompt, targets, [targets.find((t) => t.value === entry.answer)!.id], ['standard'], stage);
    }

    private geography(stage: Stage): QuestionInstance {
        const entries = [{ prompt: '中国首都', answer: '北京', wrong: ['上海', '广州', '成都'] }, { prompt: '日本首都', answer: '东京', wrong: ['大阪', '首尔', '曼谷'] }, { prompt: '法国首都', answer: '巴黎', wrong: ['伦敦', '罗马', '柏林'] }], entry = this.rng.pick(entries);
        const values = this.rng.shuffle([entry.answer, ...entry.wrong]).slice(0, stage + 3), targets = values.map((value, i) => ({ id: `g${i}`, text: value, value }));
        return this.make('geo', 'geography', entry.prompt, targets, [targets.find((t) => t.value === entry.answer)!.id], ['standard'], stage);
    }

    private life(stage: Stage): QuestionInstance {
        const entries = [{ prompt: '雨天防雨', answer: '雨伞', wrong: ['牙刷', '剪刀', '枕头'] }, { prompt: '照亮黑暗', answer: '手电', wrong: ['尺子', '杯子', '毛巾'] }, { prompt: '测量长度', answer: '尺子', wrong: ['盘子', '钥匙', '帽子'] }], entry = this.rng.pick(entries);
        const values = this.rng.shuffle([entry.answer, ...entry.wrong]).slice(0, stage + 3), targets = values.map((value, i) => ({ id: `l${i}`, text: value, value }));
        return this.make('life', 'life', entry.prompt, targets, [targets.find((t) => t.value === entry.answer)!.id], ['standard'], stage);
    }
}
