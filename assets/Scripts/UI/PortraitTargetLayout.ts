export interface PortraitTargetPosition {
    x: number;
    y: number;
    row: number;
}

/** All choices enter together so their index or row never creates an information advantage. */
export function portraitTargetEntranceDelay(_position: PortraitTargetPosition): number {
    return 0;
}

type FormationPoint = readonly [column: -1 | 0 | 1, rowOffset: -1 | -0.5 | 0 | 0.5 | 1, row: number];

const PORTRAIT_FORMATIONS: Readonly<Record<number, readonly FormationPoint[]>> = {
    1: [[0, 0, 0]],
    2: [[-1, 0, 0], [1, 0, 0]],
    3: [[-1, 0.5, 0], [1, 0.5, 0], [0, -0.5, 1]],
    4: [[-1, 0.5, 0], [1, 0.5, 0], [-1, -0.5, 1], [1, -0.5, 1]],
    5: [[-1, 1, 0], [1, 1, 0], [0, 0, 1], [-1, -1, 2], [1, -1, 2]],
    6: [[-1, 1, 0], [1, 1, 0], [-1, 0, 1], [1, 0, 1], [-1, -1, 2], [1, -1, 2]],
};

/** Keeps at most two moving targets per row so portrait playfields retain clear slash lanes. */
export function calculatePortraitTargetLayout(count: number, visibleWidth: number, visibleHeight: number): PortraitTargetPosition[] {
    const safeCount = Math.max(1, Math.min(6, Math.round(count)));
    const formation = PORTRAIT_FORMATIONS[safeCount];
    const columnOffset = Math.min(150, Math.max(118, visibleWidth * 0.2));
    const rowGap = Math.min(232, Math.max(220, visibleHeight * 0.143));
    const centerY = visibleHeight * (safeCount <= 2 ? 0.15 : safeCount <= 4 ? 0.12 : 0.08);
    return formation.map(([column, rowOffset, row]) => ({
        x: column * columnOffset,
        y: centerY + rowOffset * rowGap,
        row,
    }));
}
