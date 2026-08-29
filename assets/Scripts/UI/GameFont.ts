import { Label, Node, resources, TTFFont } from 'cc';

const GAME_FONT_PATH = 'fonts/jiangxi-zhuokai';
/** Optical correction: this typeface looks smaller than the former system font at equal points. */
export const GAME_FONT_SCALE = 1.1;

let gameFont: TTFFont | null = null;
let loading = false;
const pendingLabels = new Set<Label>();
const scaledLabels = new WeakSet<Label>();

export function gameFontSize(size: number): number {
    return Math.max(1, Math.round(size * GAME_FONT_SCALE));
}

export function gameFontLineHeight(lineHeight: number): number {
    return Math.max(1, Math.round(lineHeight * GAME_FONT_SCALE));
}

export function setGameFontMetrics(label: Label, size: number, lineHeight: number): Label {
    label.fontSize = gameFontSize(size);
    label.lineHeight = gameFontLineHeight(lineHeight);
    scaledLabels.add(label);
    return label;
}

/** Applies the hand-drawn font and its optical size correction once per label. */
export function applyGameFont(label: Label): Label {
    label.isBold = false;
    if (!scaledLabels.has(label)) {
        label.fontSize = gameFontSize(label.fontSize);
        label.lineHeight = gameFontLineHeight(label.lineHeight);
        scaledLabels.add(label);
    }
    if (gameFont?.isValid) {
        label.useSystemFont = false;
        label.font = gameFont;
        return label;
    }
    pendingLabels.add(label);
    loadGameFont();
    return label;
}

/** Covers labels serialized in scenes as well as labels created by scripts. */
export function applyGameFontToTree(root: Node): void {
    for (const label of root.getComponentsInChildren(Label)) applyGameFont(label);
}

function loadGameFont(): void {
    if (loading || gameFont?.isValid) return;
    loading = true;
    resources.load(GAME_FONT_PATH, TTFFont, (error, font) => {
        loading = false;
        if (error || !font?.isValid) {
            console.warn(`[GameFont] Failed to load ${GAME_FONT_PATH}`, error);
            pendingLabels.clear();
            return;
        }
        gameFont = font;
        for (const label of pendingLabels) {
            if (!label.isValid) continue;
            label.useSystemFont = false;
            label.font = font;
        }
        pendingLabels.clear();
    });
}
