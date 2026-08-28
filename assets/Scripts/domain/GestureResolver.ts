import type { ActionConstraint, FailureKind } from './Models';
export type GestureProgress = { status: 'continue' } | { status: 'success'; masterSlash: boolean } | { status: 'failure'; kind: FailureKind };

export function shouldKeepIncompleteGesture(constraint: ActionConstraint): boolean {
    return constraint.matchMode === 'all' && constraint.requiredTargetIds.length > 1;
}

export class GestureResolver {
    private readonly hits: string[] = [];
    private readonly seen = new Set<string>();
    private strokeBreaks = 0;
    public constructor(private readonly constraint: ActionConstraint) {}
    public hit(targetId: string): GestureProgress {
        if (this.seen.has(targetId)) return { status: 'continue' };
        this.seen.add(targetId); this.hits.push(targetId);
        if (this.constraint.forbiddenTargetIds.includes(targetId)) return { status: 'failure', kind: 'bomb' };
        if (!this.constraint.requiredTargetIds.includes(targetId) && !this.constraint.allowExtraHits) return { status: 'failure', kind: 'wrong' };
        if (this.constraint.ordered && targetId !== this.constraint.requiredTargetIds[this.hits.length - 1]) return { status: 'failure', kind: 'orderError' };
        return this.isComplete() ? this.success() : { status: 'continue' };
    }
    public end(keepIncomplete = false): GestureProgress {
        if (this.isComplete()) return this.success();
        if (keepIncomplete) { this.strokeBreaks++; return { status: 'continue' }; }
        return { status: 'failure', kind: 'miss' };
    }
    public hasHits(): boolean { return this.hits.length > 0; }
    private isComplete(): boolean {
        return this.constraint.matchMode === 'any'
            ? this.constraint.requiredTargetIds.some((id) => this.seen.has(id))
            : this.constraint.requiredTargetIds.every((id) => this.seen.has(id));
    }
    private success(): Extract<GestureProgress, { status: 'success' }> {
        return { status: 'success', masterSlash: this.constraint.matchMode === 'all' && this.constraint.requiredTargetIds.length > 1 && this.strokeBreaks === 0 };
    }
}
