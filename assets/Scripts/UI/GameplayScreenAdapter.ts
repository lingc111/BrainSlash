import { _decorator, Component, Node, ResolutionPolicy, screen, UITransform, view } from 'cc';
import { EDITOR } from 'cc/env';
import { WechatSafeArea } from './WechatSafeArea';

const { ccclass, property } = _decorator;

@ccclass('GameplayScreenAdapter')
export class GameplayScreenAdapter extends Component {
    @property(Node)
    public background: Node | null = null;

    @property(Node)
    public dangerFrame: Node | null = null;

    @property(Node)
    public topHud: Node | null = null;

    @property(Node)
    public chaosBar: Node | null = null;

    @property
    public bottomGestureInset = 64;

    private readonly handleResize = (): void => this.applyVisibleRect();

    protected onEnable(): void {
        if (EDITOR) return;
        view.setDesignResolutionSize(750, 1624, ResolutionPolicy.SHOW_ALL);
        screen.on('window-resize', this.handleResize, this);
        this.applyVisibleRect();
        this.scheduleOnce(this.applyVisibleRect, 0);
    }

    protected onDisable(): void {
        if (EDITOR) return;
        screen.off('window-resize', this.handleResize, this);
    }

    public applyVisibleRect = (): void => {
        const visible = view.getVisibleSize();
        this.getComponent(UITransform)?.setContentSize(visible.width, visible.height);
        this.resizeLayer(this.background, visible.width, visible.height);
        this.resizeLayer(this.dangerFrame, visible.width, visible.height);
        this.resizeDangerFrame(visible.width, visible.height);

        if (this.chaosBar) {
            const transform = this.chaosBar.getComponent(UITransform);
            if (transform) {
                this.chaosBar.setPosition(
                    0,
                    -visible.height * 0.5 + this.bottomGestureInset + transform.height * 0.5,
                    this.chaosBar.position.z,
                );
            }
        }

        this.topHud?.getComponent(WechatSafeArea)?.applyTopSafeArea();
    };

    private resizeLayer(node: Node | null, width: number, height: number): void {
        if (!node) return;
        node.getComponent(UITransform)?.setContentSize(width, height);
        node.setPosition(0, 0, node.position.z);
        node.getChildByName('__VisualBase')?.getComponent(UITransform)?.setContentSize(width, height);
    }

    private resizeDangerFrame(width: number, height: number): void {
        if (!this.dangerFrame) return;
        const inset = 6;
        const thickness = 12;
        const left = this.dangerFrame.getChildByName('DangerLeft');
        const right = this.dangerFrame.getChildByName('DangerRight');
        const top = this.dangerFrame.getChildByName('DangerTop');
        const bottom = this.dangerFrame.getChildByName('DangerBottom');
        left?.getComponent(UITransform)?.setContentSize(thickness, height);
        right?.getComponent(UITransform)?.setContentSize(thickness, height);
        top?.getComponent(UITransform)?.setContentSize(width, thickness);
        bottom?.getComponent(UITransform)?.setContentSize(width, thickness);
        left?.setPosition(-width * 0.5 + inset, 0);
        right?.setPosition(width * 0.5 - inset, 0);
        top?.setPosition(0, height * 0.5 - inset);
        bottom?.setPosition(0, -height * 0.5 + inset);
    }
}
