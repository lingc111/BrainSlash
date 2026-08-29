import { assetManager, ImageAsset, SpriteFrame } from 'cc';

type AvatarImage = HTMLImageElement;
type AvatarCallback = (error: unknown, frame: SpriteFrame | null) => void;

type WechatImageApi = {
    createImage?: () => AvatarImage;
};

const MAX_CACHED_AVATARS = 24;
const cachedFrames = new Map<string, SpriteFrame>();
const pendingLoads = new Map<string, AvatarCallback[]>();

function remember(url: string, frame: SpriteFrame): void {
    cachedFrames.delete(url);
    cachedFrames.set(url, frame);
    while (cachedFrames.size > MAX_CACHED_AVATARS) {
        const oldestUrl = cachedFrames.keys().next().value as string | undefined;
        if (!oldestUrl) break;
        cachedFrames.delete(oldestUrl);
    }
}

function finish(url: string, error: unknown, frame: SpriteFrame | null): void {
    if (frame) remember(url, frame);
    const callbacks = pendingLoads.get(url) ?? [];
    pendingLoads.delete(url);
    callbacks.forEach((callback) => callback(error, frame));
}

function frameFromImage(image: ImageAsset | AvatarImage): SpriteFrame {
    const frame = SpriteFrame.createWithImage(image);
    frame.packable = false;
    return frame;
}

function loadWithCocos(url: string): void {
    assetManager.loadRemote<ImageAsset>(url, { ext: '.png' }, (error, image) => {
        if (error || !image) {
            finish(url, error ?? new Error('Avatar image is empty'), null);
            return;
        }
        finish(url, null, frameFromImage(image));
    });
}

/** Loads authorized avatars consistently for Home and the main-domain ranking UI. */
export function loadAvatarFrame(url: string, callback: AvatarCallback): void {
    const normalizedUrl = url.trim();
    if (!normalizedUrl) {
        callback(new Error('Avatar URL is empty'), null);
        return;
    }

    const cached = cachedFrames.get(normalizedUrl);
    if (cached) {
        // Refresh insertion order so frequently displayed avatars stay cached.
        remember(normalizedUrl, cached);
        callback(null, cached);
        return;
    }

    const waiting = pendingLoads.get(normalizedUrl);
    if (waiting) {
        waiting.push(callback);
        return;
    }
    pendingLoads.set(normalizedUrl, [callback]);

    let wxImage: AvatarImage | undefined;
    try {
        wxImage = (globalThis as { wx?: WechatImageApi }).wx?.createImage?.();
    } catch {
        wxImage = undefined;
    }
    if (!wxImage) {
        loadWithCocos(normalizedUrl);
        return;
    }

    wxImage.onload = () => finish(normalizedUrl, null, frameFromImage(wxImage!));
    wxImage.onerror = (event) => finish(normalizedUrl, event, null);
    wxImage.src = normalizedUrl;
}
