import { _decorator, Color, Component, Label, Node, Sprite, tween, UIOpacity, Vec3 } from 'cc';
import { UI_COLORS } from './DesignTokens';

const { ccclass, property } = _decorator;

export type GameplayHUDState = {
    combo: number;
    secondsLeft: number;
    lives: number;
    prompt: string;
    primaryRule: string;
    secondaryRule?: string;
    chaosPercent: number;
    reverse: boolean;
};

@ccclass('GameplayHUD')
export class GameplayHUD extends Component {
    @property(Label) public comboLabel: Label | null = null;
    @property(Label) public timerLabel: Label | null = null;
    @property(Label) public livesLabel: Label | null = null;
    @property(Label) public promptLabel: Label | null = null;
    @property(Label) public ruleLabel: Label | null = null;
    @property(Label) public chaosLabel: Label | null = null;
    @property(Sprite) public chaosFill: Sprite | null = null;
    @property(Node) public dangerFrame: Node | null = null;

    public applyState(state: GameplayHUDState): void {
        if (this.comboLabel) this.comboLabel.string = `${state.combo}`;
        if (this.timerLabel) this.timerLabel.string = this.formatTime(state.secondsLeft);
        if (this.livesLabel) this.livesLabel.string = '♥'.repeat(Math.max(0, state.lives));
        if (this.promptLabel) this.promptLabel.string = state.prompt;
        if (this.ruleLabel) {
            this.ruleLabel.string = state.secondaryRule
                ? `${state.primaryRule}  ·  ${state.secondaryRule}`
                : state.primaryRule;
        }
        if (this.chaosLabel) this.chaosLabel.string = `CHAOS ${Math.round(state.chaosPercent)}%`;
        if (this.chaosFill) {
            this.chaosFill.fillRange = Math.max(0, Math.min(1, state.chaosPercent / 100));
        }
        if (this.dangerFrame) this.dangerFrame.active = state.reverse;
    }

    public playMasterHit(): void {
        const feedback = this.node.getChildByName('MasterFeedback');
        if (!feedback) return;
        feedback.active = true;
        feedback.setScale(Vec3.ZERO);
        const opacity = feedback.getComponent(UIOpacity) ?? feedback.addComponent(UIOpacity);
        opacity.opacity = 255;
        tween(feedback)
            .to(0.08, { scale: new Vec3(1.08, 1.08, 1) })
            .to(0.08, { scale: Vec3.ONE })
            .delay(0.18)
            .call(() => tween(opacity).to(0.12, { opacity: 0 }).call(() => { feedback.active = false; }).start())
            .start();
    }

    public playErrorFlash(): void {
        if (!this.dangerFrame) return;
        for (const child of this.dangerFrame.children) {
            const sprite = child.getComponent(Sprite);
            if (!sprite) continue;
            sprite.color = UI_COLORS.danger;
            tween(sprite).to(0.12, { color: new Color(0xff, 0x4d, 0x6d, 0x88) }).start();
        }
    }

    private formatTime(seconds: number): string {
        const safe = Math.max(0, Math.ceil(seconds));
        return `${this.twoDigits(Math.floor(safe / 60))}:${this.twoDigits(safe % 60)}`;
    }

    private twoDigits(value: number): string {
        return value < 10 ? `0${value}` : String(value);
    }
}
