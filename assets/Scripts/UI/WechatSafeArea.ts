import { _decorator, Component, ResolutionPolicy, UITransform, view } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, property } = _decorator;

type WechatSystemInfo = {
    screenWidth: number;
    screenHeight: number;
    safeArea?: { top: number; bottom: number };
};

type WechatMenuRect = { bottom: number };

type WechatApi = {
    getSystemInfoSync?: () => WechatSystemInfo;
    getMenuButtonBoundingClientRect?: () => WechatMenuRect;
    onWindowResize?: (handler: () => void) => void;
    offWindowResize?: (handler: () => void) => void;
};

@ccclass('WechatSafeArea')
export class WechatSafeArea extends Component {
    private readonly handleWindowResize = (): void => this.applyTopSafeArea();

    @property
    public topPadding = 16;

    @property
    public fallbackTopInset = 88;

    protected onEnable(): void {
        // SHOW_ALL guarantees that 9:16 through 9:19.5 WeChat devices never crop
        // the capsule-safe header, primary CTA, or bottom gesture-safe navigation.
        // The editor keeps its own Scene-view resolution so docking panels cannot
        // accidentally resize the serialized design Canvas.
        if (!EDITOR) {
            view.setDesignResolutionSize(750, 1624, ResolutionPolicy.SHOW_ALL);
        }
        this.applyTopSafeArea();

        const wxApi = (globalThis as { wx?: WechatApi }).wx;
        wxApi?.onWindowResize?.(this.handleWindowResize);
    }

    protected onDisable(): void {
        const wxApi = (globalThis as { wx?: WechatApi }).wx;
        wxApi?.offWindowResize?.(this.handleWindowResize);
    }

    /** Keeps this top-bar node below the WeChat capsule and status area. */
    public applyTopSafeArea(): void {
        const transform = this.getComponent(UITransform);
        if (!transform) return;

        // The visible size can be wider or taller than the design resolution
        // when SHOW_ALL is used. UI edge docking must use the visible rect,
        // otherwise the header drifts away from the real screen edge.
        const visible = view.getVisibleSize();
        let topInset = this.fallbackTopInset;
        const wxApi = (globalThis as { wx?: WechatApi }).wx;

        try {
            const info = wxApi?.getSystemInfoSync?.();
            const capsule = wxApi?.getMenuButtonBoundingClientRect?.();
            if (info && capsule && info.screenHeight > 0) {
                topInset = capsule.bottom * visible.height / info.screenHeight;
            } else if (info?.safeArea && info.screenHeight > 0) {
                topInset = info.safeArea.top * visible.height / info.screenHeight;
            }
        } catch {
            // Creator preview and non-WeChat targets use the documented fallback.
        }

        const y = visible.height * 0.5 - topInset - this.topPadding - transform.height * 0.5;
        this.node.setPosition(this.node.position.x, y, this.node.position.z);
    }
}
