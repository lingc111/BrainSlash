/**
 * Returns the scale that fits a target skin's source canvas into a square
 * visual extent. Sprite-frame trim bounds must not drive this calculation:
 * skins with tighter transparent padding would otherwise render larger.
 */
export function targetSkinPixelScale(
    originalWidth: number,
    originalHeight: number,
    targetExtent: number,
): number {
    return targetExtent / Math.max(1, originalWidth, originalHeight);
}

/**
 * Per-skin optical correction measured from the opaque subject area after
 * Cocos' sprite-frame trimming. Values are intentionally capped at 1.12 so a
 * low-fill shape (notably the triangle) cannot gain an oversized hit visual.
 */
export const TARGET_SKIN_VISUAL_SCALE: Readonly<Record<string, number>> = {
    blue_square: 1.03,
    green_triangle: 1.12,
    orange_circle: 0.92,
    pink_diamond: 1.12,
    purple_hexagon: 0.93,
    red_trapezoid: 0.99,
    yellow_circle: 1,
};

export function targetSkinVisualScale(skinName: string): number {
    return TARGET_SKIN_VISUAL_SCALE[skinName] ?? 1;
}
