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
 * Per-shape optical correction measured from the opaque subject area after
 * Cocos' sprite-frame trimming. The neutral square is slightly smaller so its
 * larger white paper edge does not look heavier than the colored artwork.
 */
export const TARGET_SKIN_VISUAL_SCALE: Readonly<Record<string, number>> = {
    circle: 1.06,
    hexagon: 1,
    square: 0.95,
    white_square: 0.9,
};

/** Target skins currently allowed to appear during gameplay. */
export const ACTIVE_TARGET_SKINS = [
    'blue_circle',
    'blue_hexagon',
    'cyan_circle',
    'cyan_hexagon',
    'cyan_square',
    'green_circle',
    'green_hexagon',
    'green_square',
    'orange_hexagon',
    'orange_square',
    'purple_circle',
    'purple_square',
    'red_circle',
    'red_hexagon',
    'red_square',
    'yellow_hexagon',
    'yellow_square',
] as const;

/** Neutral paper used only when the answer itself is encoded by text color. */
export const COLOR_QUESTION_TARGET_SKIN = 'white_square' as const;

export const ALL_TARGET_SKINS = [
    ...ACTIVE_TARGET_SKINS,
    COLOR_QUESTION_TARGET_SKIN,
] as const;

export function targetSkinForAnswer<T extends typeof ACTIVE_TARGET_SKINS[number]>(
    colorName: string | undefined,
    fallback: T,
): T | typeof COLOR_QUESTION_TARGET_SKIN {
    return colorName ? COLOR_QUESTION_TARGET_SKIN : fallback;
}

/**
 * Keeps the randomized shape choice while allowing each artwork color at most
 * once in a question. Color is the filename prefix before the final `_shape`.
 */
export function uniqueColorTargetSkins<T extends string>(skins: readonly T[]): T[] {
    const colors = new Set<string>();
    return skins.filter((skin) => {
        const separator = skin.lastIndexOf('_');
        const color = separator < 0 ? skin : skin.slice(0, separator);
        if (colors.has(color)) return false;
        colors.add(color);
        return true;
    });
}

export function targetSkinVisualScale(skinName: string): number {
    if (skinName === COLOR_QUESTION_TARGET_SKIN) return TARGET_SKIN_VISUAL_SCALE.white_square;
    const shape = skinName.slice(skinName.lastIndexOf('_') + 1);
    return TARGET_SKIN_VISUAL_SCALE[shape] ?? 1;
}

export type TargetArtworkShape = 'circle' | 'roundedSquare' | 'hexagon';

export function targetShapeForSkin(skinName: string): TargetArtworkShape {
    if (skinName.endsWith('_circle')) return 'circle';
    if (skinName.endsWith('_hexagon')) return 'hexagon';
    return 'roundedSquare';
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
    circle: { width: 1.2, height: 0.78, offsetX: 0, offsetY: 0 },
    hexagon: { width: 1.16, height: 0.74, offsetX: 0, offsetY: 0 },
    square: { width: 1.28, height: 0.82, offsetX: 0, offsetY: 0 },
};

const TARGET_SHAPE_CONTENT_LAYOUT: Readonly<Record<string, TargetContentLayout>> = {
    roundedSquare: TARGET_SKIN_CONTENT_LAYOUT.square,
    circle: TARGET_SKIN_CONTENT_LAYOUT.circle,
    hexagon: TARGET_SKIN_CONTENT_LAYOUT.hexagon,
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
    const artworkShape = skinName?.slice(skinName.lastIndexOf('_') + 1);
    return (artworkShape ? TARGET_SKIN_CONTENT_LAYOUT[artworkShape] : undefined)
        ?? TARGET_SHAPE_CONTENT_LAYOUT[shape]
        ?? DEFAULT_CONTENT_LAYOUT;
}
