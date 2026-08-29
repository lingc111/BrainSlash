export interface TargetTextPresentation {
    displayText: string;
    fontSize: number;
    lineHeight: number;
    minimumWidthScale: number;
    minimumHeightScale: number;
}

/** Keeps moving-target answers large enough to read without clipping artwork edges. */
export function targetTextPresentation(value: string): TargetTextPresentation {
    const text = value.trim();
    const characters = Array.from(text);
    const isFourCharacterChinese = characters.length === 4
        && characters.every((character) => /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(character));

    if (isFourCharacterChinese) {
        return {
            displayText: `${characters.slice(0, 2).join('')}\n${characters.slice(2).join('')}`,
            fontSize: 42,
            lineHeight: 46,
            minimumWidthScale: 1.28,
            minimumHeightScale: 1.36,
        };
    }

    const fontSize = characters.length > 6 ? 30 : characters.length > 4 ? 38 : characters.length > 2 ? 46 : 52;
    const needsWideLabel = characters.length >= 3;
    return {
        displayText: text,
        fontSize,
        lineHeight: fontSize * 1.2,
        minimumWidthScale: needsWideLabel ? 1.82 : 0,
        minimumHeightScale: needsWideLabel ? 0.9 : 0,
    };
}
