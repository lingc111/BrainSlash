import { _decorator, Component, Node, ResolutionPolicy, screen, UITransform, view } from 'cc';
import { EDITOR } from 'cc/env';
import { WechatSafeArea } from './WechatSafeArea';

const { ccclass, property } = _decorator;

@ccclass('HomeScreenAdapter')
export class HomeScreenAdapter extends Component {
    @property(Node)
    public background: Node | null = null;

    @property(Node)
    public bottomNav: Node | null = null;

    @property(Node)
    public topBar: Node | null = null;

    @property
    public bottomGestureInset = 64;

    private readonly handleWindowResize = (): void => this.applyVisibleRect();

    protected onEnable(): void {
        if (EDITOR) return;

        view.setDesignResolutionSize(750, 1624, ResolutionPolicy.SHOW_ALL);
        screen.on('window-resize', this.handleWindowResize, this);
        this.applyVisibleRect();
        this.scheduleOnce(this.applyVisibleRect, 0);
    }

    protected onDisable(): void {
        if (EDITOR) return;
        screen.off('window-resize', this.handleWindowResize, this);
    }

    /**
     * SHOW_ALL can expose an area wider or taller than the 750 × 1624 design
     * frame. Only full-bleed surfaces dock to that visible rectangle; content
     * cards stay on the centered 750-unit layout grid.
     */
    public applyVisibleRect = (): void => {
        const visible = view.getVisibleSize();
        this.getComponent(UITransform)?.setContentSize(visible.width, visible.height);

        if (this.background) {
            this.background.getComponent(UITransform)?.setContentSize(visible.width, visible.height);
            this.background.setPosition(0, 0, this.background.position.z);
            this.resizeVisualLayer(this.background, visible.width, visible.height, 0);
        }

        if (this.bottomNav) {
            const transform = this.bottomNav.getComponent(UITransform);
            if (transform) {
                transform.setContentSize(visible.width, transform.height);
                const y = -visible.height * 0.5 + this.bottomGestureInset + transform.height * 0.5;
                this.bottomNav.setPosition(0, y, this.bottomNav.position.z);
                this.resizeVisualLayer(this.bottomNav, visible.width, transform.height, 2);
            }
        }

        this.topBar?.getComponent(WechatSafeArea)?.applyTopSafeArea();
    };

    private resizeVisualLayer(root: Node, width: number, height: number, border: number): void {
        const base = root.getChildByName('__VisualBase');
        const depth = root.getChildByName('__ArcadeDepth');

        depth?.getComponent(UITransform)?.setContentSize(width, height);
        if (!base) return;

        base.getComponent(UITransform)?.setContentSize(width, height);
        const fill = base.getChildByName('__VisualFill');
        fill?.getComponent(UITransform)?.setContentSize(
            Math.max(1, width - border * 2),
            Math.max(1, height - border * 2),
        );
    }
}
