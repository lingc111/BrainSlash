export interface TargetTextPresentation {
    displayText: string;
    fontSize: number;
    lineHeight: number;
    minimumWidthScale: number;
    minimumHeightScale: number;
}

export interface MultilineTextPresentation {
    displayText: string;
    fontSize: number;
    lineHeight: number;
    width: number;
    height: number;
    lineCount: number;
    displaySeconds: number;
}

export interface PromptTextPresentation {
    fontSize: number;
    lineHeight: number;
    width: number;
    height: number;
}

/** Uses the prompt paper's inner width before asking Cocos to shrink long copy. */
export function promptTextPresentation(value: string): PromptTextPresentation {
    const length = Array.from(value.trim()).length;
    const fontSize = length <= 4 ? 44
        : length <= 6 ? 40
            : length <= 10 ? 34
                : length <= 14 ? 30 : 28;
    return {
        fontSize,
        lineHeight: Math.ceil(fontSize * 1.16),
        width: 350,
        height: 64,
    };
}

/** Fits tower opening copy inside the portrait safe area instead of inheriting the READY label size. */
export function towerOpeningTextPresentation(
    title: string,
    detail: string,
    visibleWidth: number,
): MultilineTextPresentation {
    const width = Math.max(300, Math.min(650, visibleWidth - 64));
    const fontSize = width < 420 ? 30 : width < 560 ? 36 : 42;
    const maximumCharacters = width < 420 ? 10 : width < 560 ? 12 : 14;
    const lines = [
        ...wrapDisplayLine(title, maximumCharacters),
        ...wrapDisplayLine(detail, maximumCharacters),
    ];
    const lineHeight = Math.ceil(fontSize * 1.22);
    const height = Math.max(150, Math.min(300, lines.length * lineHeight + 28));
    const readingCharacters = Array.from(`${title}${detail}`).length;
    return {
        displayText: lines.join('\n'),
        fontSize,
        lineHeight,
        width,
        height,
        lineCount: lines.length,
        displaySeconds: Math.max(1.8, Math.min(3.2, 1.25 + readingCharacters * 0.055)),
    };
}

function wrapDisplayLine(value: string, maximumCharacters: number): string[] {
    const remaining = Array.from(value.trim());
    const lines: string[] = [];
    const breakCharacters = new Set(['，', '、', '；', '。', '·', ' ']);
    while (remaining.length > maximumCharacters) {
        const minimumBreak = Math.max(1, Math.floor(maximumCharacters * 0.55));
        let breakAt = maximumCharacters;
        for (let index = maximumCharacters - 1; index >= minimumBreak; index--) {
            if (breakCharacters.has(remaining[index])) { breakAt = index + 1; break; }
        }
        lines.push(remaining.splice(0, breakAt).join('').trim());
        while (remaining[0] === ' ') remaining.shift();
    }
    if (remaining.length) lines.push(remaining.join('').trim());
    return lines.filter(Boolean);
}

/** Keeps moving-target answers large enough to read without clipping artwork edges. */
export function targetTextPresentation(value: string): TargetTextPresentation {
    const text = value.trim();
    const characters = Array.from(text);
    // ASCII hyphen is the subtraction operator in generated math choices.
    // Only visual relation separators may trigger the two-line relation layout.
    const relationParts = text.split(/[—→]/).map((part) => part.trim()).filter(Boolean);

    if (relationParts.length === 2 && relationParts.every((part) => Array.from(part).length <= 5)) {
        return {
            displayText: relationParts.join('\n'),
            fontSize: 40,
            lineHeight: 44,
            minimumWidthScale: 1.45,
            minimumHeightScale: 1.38,
        };
    }
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
