export interface TargetTextPresentation {
    displayText: string;
    fontSize: number;
    lineHeight: number;
    minimumWidthScale: number;
    minimumHeightScale: number;
}

/** Keeps four-character Chinese answers large enough to read on moving targets. */
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

    const fontSize = characters.length > 6 ? 25 : characters.length > 4 ? 30 : characters.length > 2 ? 38 : 52;
    return {
        displayText: text,
        fontSize,
        lineHeight: fontSize * 1.2,
        minimumWidthScale: 0,
        minimumHeightScale: 0,
    };
}
