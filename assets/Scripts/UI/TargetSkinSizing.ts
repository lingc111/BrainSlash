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

/** Target skins currently allowed to appear during gameplay. */
export const ACTIVE_TARGET_SKINS = [
    'blue_square',
    'orange_circle',
    'pink_diamond',
    'purple_hexagon',
    'red_trapezoid',
    'yellow_circle',
] as const;

export function targetSkinVisualScale(skinName: string): number {
    return TARGET_SKIN_VISUAL_SCALE[skinName] ?? 1;
}

export interface TargetContentLayout {
    /** Safe content width as a multiple of the target radius. */
    width: number;
    /** Safe content height as a multiple of the target radius. */
    height: number;
    /** Optical-center offset as a multiple of the target radius. */
    offsetX: number;
    /** Optical-center offset as a multiple of the target radius. */
    offsetY: number;
}

const TARGET_SKIN_CONTENT_LAYOUT: Readonly<Record<string, TargetContentLayout>> = {
    blue_square: { width: 1.35, height: 0.92, offsetX: 0, offsetY: 0 },
    green_triangle: { width: 0.92, height: 0.58, offsetX: 0, offsetY: -0.16 },
    orange_circle: { width: 1.28, height: 0.86, offsetX: 0, offsetY: 0.02 },
    pink_diamond: { width: 1, height: 0.68, offsetX: 0, offsetY: 0 },
    purple_hexagon: { width: 1.22, height: 0.78, offsetX: 0, offsetY: 0 },
    red_trapezoid: { width: 1.22, height: 0.68, offsetX: 0, offsetY: -0.07 },
    yellow_circle: { width: 1.28, height: 0.86, offsetX: 0, offsetY: 0.02 },
};

const TARGET_SHAPE_CONTENT_LAYOUT: Readonly<Record<string, TargetContentLayout>> = {
    roundedSquare: TARGET_SKIN_CONTENT_LAYOUT.blue_square,
    triangle: TARGET_SKIN_CONTENT_LAYOUT.green_triangle,
    circle: TARGET_SKIN_CONTENT_LAYOUT.orange_circle,
    pentagon: { width: 1.05, height: 0.72, offsetX: 0, offsetY: -0.05 },
    hexagon: TARGET_SKIN_CONTENT_LAYOUT.purple_hexagon,
};

const DEFAULT_CONTENT_LAYOUT: TargetContentLayout = {
    width: 1.1,
    height: 0.72,
    offsetX: 0,
    offsetY: 0,
};

/**
 * Returns a conservative rectangle that remains inside the visible paper
 * shape. Skin-specific optical offsets keep content centered on the opaque
 * subject rather than on transparent source-canvas padding.
 */
export function targetContentLayout(skinName: string | undefined, shape: string): TargetContentLayout {
    return (skinName ? TARGET_SKIN_CONTENT_LAYOUT[skinName] : undefined)
        ?? TARGET_SHAPE_CONTENT_LAYOUT[shape]
        ?? DEFAULT_CONTENT_LAYOUT;
}
