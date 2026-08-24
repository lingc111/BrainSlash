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
