import type { PortraitTargetPosition } from './PortraitTargetLayout';

export const PORTRAIT_TARGET_MIN_SEPARATION = 234;
export const PORTRAIT_TARGET_MAX_SEPARATION_OFFSET = 18;
export const PORTRAIT_TARGET_ROTATION_DEGREES_PER_SECOND = 72;

export interface PortraitTargetMotionPlan {
    startX: number;
    targetX: number;
    startY: number;
    groundY: number;
    ceilingY: number;
    duration: number;
    velocityY: number;
    gravity: number;
    entranceAngle: number;
    phase: number;
    speed: number;
}

export interface PortraitTargetMotionPoint {
    x: number;
    y: number;
}

export interface PortraitTargetMotionConfig {
    visibleWidth: number;
    visibleHeight: number;
    duration: number;
    speed: number;
    topInset: number;
    visualRadius: number;
}

/**
 * Builds one shared vertical arc for the whole formation. Every lane receives
 * the same vertical displacement, so vertically aligned targets cannot cross
 * while entering or falling out of the portrait playfield.
 */
export function createPortraitTargetMotionPlans(
    positions: readonly PortraitTargetPosition[],
    phases: readonly number[],
    config: PortraitTargetMotionConfig,
): PortraitTargetMotionPlan[] {
    if (!positions.length) return [];
    const duration = Math.max(0.1, config.duration);
    const ceilingY = config.visibleHeight / 2 - config.topInset - config.visualRadius - 8;
    const originalHighestStartY = Math.max(...positions.map((position) => position.y));
    const formationShiftY = Math.min(0, ceilingY - originalHighestStartY - 24);
    const startYs = positions.map((position) => position.y + formationShiftY);
    const groundTargets = positions.map((position) =>
        -config.visibleHeight / 2 - config.visualRadius - 8 - Math.max(0, position.row) * 220,
    );
    const landingOffset = positions.reduce(
        (sum, _position, index) => sum + groundTargets[index] - startYs[index],
        0,
    ) / positions.length;
    const highestStartY = Math.max(...startYs);
    const apexRise = Math.max(1, Math.min(config.visibleHeight * 0.105, ceilingY - highestStartY));
    const ratio = Math.sqrt(apexRise / Math.max(1, apexRise - landingOffset));
    const apexTime = duration * ratio / (1 + ratio);
    const gravity = -2 * apexRise / (apexTime * apexTime);
    const velocityY = -gravity * apexTime;
    const entranceAngles = [-10, 8, -7, 10, -6, 7] as const;

    return positions.map((position, index) => {
        const side = position.x < 0 ? -1 : position.x > 0 ? 1 : index % 2 === 0 ? -1 : 1;
        return {
            startX: side * (config.visibleWidth / 2 + 110),
            targetX: position.x,
            startY: startYs[index],
            groundY: startYs[index] + landingOffset,
            ceilingY,
            duration,
            velocityY,
            gravity,
            entranceAngle: entranceAngles[index] ?? 0,
            phase: phases[index] ?? 0,
            speed: config.speed,
        };
    });
}

export function evaluatePortraitTargetMotion(
    motion: PortraitTargetMotionPlan,
    elapsedSeconds: number,
): PortraitTargetMotionPoint {
    const t = Math.min(Math.max(0, elapsedSeconds), motion.duration);
    const entryDuration = Math.min(0.58 / Math.max(0.1, motion.speed), motion.duration * 0.3);
    const entry = Math.min(1, t / entryDuration);
    const ease = 1 - Math.pow(1 - entry, 3);
    const x = motion.startX
        + (motion.targetX - motion.startX) * ease
        + Math.sin(t * 2.4 * motion.speed + motion.phase) * 8 * entry;
    const y = motion.startY + motion.velocityY * t + 0.5 * motion.gravity * t * t;
    return {
        x,
        y: Math.min(motion.ceilingY, Math.max(motion.groundY, y)),
    };
}

export function evaluatePortraitTargetRotation(
    motion: PortraitTargetMotionPlan,
    elapsedSeconds: number,
    rotating: boolean,
): number {
    const local = Math.max(0, elapsedSeconds);
    const entranceAngle = motion.entranceAngle * Math.max(0, 1 - Math.min(1, local / 0.24));
    if (!rotating) return entranceAngle;
    const direction = Math.sin(motion.phase) >= 0 ? 1 : -1;
    return entranceAngle
        + direction * local * PORTRAIT_TARGET_ROTATION_DEGREES_PER_SECOND * motion.speed;
}

/**
 * Small deterministic circle separation used after the authored trajectory.
 * Its capped correction is deliberately not strong enough to hide a broken
 * trajectory; it only removes marginal contact caused by aspect ratios and
 * the eight-pixel horizontal drift.
 */
export function resolveSoftTargetSeparation(
    basePoints: readonly PortraitTargetMotionPoint[],
    minimumDistance = PORTRAIT_TARGET_MIN_SEPARATION,
    maximumOffset = PORTRAIT_TARGET_MAX_SEPARATION_OFFSET,
    iterations = 8,
): PortraitTargetMotionPoint[] {
    const points = basePoints.map((point) => ({ ...point }));
    const clampToOffset = (index: number): void => {
        const dx = points[index].x - basePoints[index].x;
        const dy = points[index].y - basePoints[index].y;
        const distance = Math.hypot(dx, dy);
        if (distance <= maximumOffset || distance === 0) return;
        const scale = maximumOffset / distance;
        points[index].x = basePoints[index].x + dx * scale;
        points[index].y = basePoints[index].y + dy * scale;
    };

    for (let iteration = 0; iteration < iterations; iteration++) {
        for (let a = 0; a < points.length; a++) {
            for (let b = a + 1; b < points.length; b++) {
                let dx = points[b].x - points[a].x;
                let dy = points[b].y - points[a].y;
                let distance = Math.hypot(dx, dy);
                if (distance >= minimumDistance) continue;
                if (distance < 0.001) {
                    dx = (a + b) % 2 === 0 ? 1 : -1;
                    dy = a % 2 === 0 ? 1 : -1;
                    distance = Math.SQRT2;
                }
                const correction = (minimumDistance - distance) * 0.5 * 0.82;
                const pushX = dx / distance * correction;
                const pushY = dy / distance * correction;
                points[a].x -= pushX;
                points[a].y -= pushY;
                points[b].x += pushX;
                points[b].y += pushY;
                clampToOffset(a);
                clampToOffset(b);
            }
        }
    }
    return points;
}
