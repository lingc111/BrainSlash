export type HomeSectionId = 'header' | 'daily' | 'brawl' | 'events' | 'rank';

export interface HomePortraitLayout {
    contentScale: number;
    sectionGap: number;
    sectionY: Readonly<Record<HomeSectionId, number>>;
    navigationY: number;
}

const NAVIGATION_HEIGHT = 128;
const CONTENT_NAVIGATION_GAP = 18;
const MIN_SECTION_GAP = 18;
const MAX_SECTION_GAP = 42;

export const HOME_PORTRAIT_SECTION_HEIGHTS: Readonly<Record<HomeSectionId, number>> = {
    header: 138,
    daily: 600,
    brawl: 266,
    events: 420,
    rank: 112,
};

const SECTIONS: readonly { id: HomeSectionId; height: number }[] = [
    { id: 'header', height: HOME_PORTRAIT_SECTION_HEIGHTS.header },
    { id: 'daily', height: HOME_PORTRAIT_SECTION_HEIGHTS.daily },
    { id: 'brawl', height: HOME_PORTRAIT_SECTION_HEIGHTS.brawl },
    { id: 'events', height: HOME_PORTRAIT_SECTION_HEIGHTS.events },
    { id: 'rank', height: HOME_PORTRAIT_SECTION_HEIGHTS.rank },
];

/**
 * Fits the home content into one non-overlapping portrait column. The bottom
 * navigation remains full-size while the content stack scales uniformly on
 * shorter phones and tablets.
 */
export function calculateHomePortraitLayout(
    visibleHeight: number,
    topInset: number,
    bottomInset: number,
): HomePortraitLayout {
    const height = Math.max(1, visibleHeight);
    const topEdge = height * 0.5;
    const bottomEdge = -height * 0.5;
    const navigationY = bottomEdge + Math.max(0, bottomInset) + NAVIGATION_HEIGHT * 0.5;
    const contentTop = topEdge - Math.max(0, topInset);
    const contentBottom = navigationY + NAVIGATION_HEIGHT * 0.5 + CONTENT_NAVIGATION_GAP;
    const availableHeight = Math.max(1, contentTop - contentBottom);
    const baseHeight = SECTIONS.reduce((total, section) => total + section.height, 0);
    const gapCount = SECTIONS.length - 1;
    const contentScale = Math.min(1, Math.max(0.1, (availableHeight - MIN_SECTION_GAP * gapCount) / baseHeight));
    const scaledHeight = baseHeight * contentScale;
    const sectionGap = Math.max(0, Math.min(MAX_SECTION_GAP, (availableHeight - scaledHeight) / gapCount));
    const usedHeight = scaledHeight + sectionGap * gapCount;
    let cursor = contentTop - Math.max(0, (availableHeight - usedHeight) * 0.5);
    const sectionY = {} as Record<HomeSectionId, number>;

    for (const section of SECTIONS) {
        const sectionHeight = section.height * contentScale;
        sectionY[section.id] = cursor - sectionHeight * 0.5;
        cursor -= sectionHeight + sectionGap;
    }

    return { contentScale, sectionGap, sectionY, navigationY };
}
