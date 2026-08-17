import type { ActionConstraint, FailureKind } from './Models';
export type GestureProgress = { status: 'continue' } | { status: 'success' } | { status: 'failure'; kind: FailureKind };
export class GestureResolver {
    private readonly hits: string[] = [];
    private readonly seen = new Set<string>();
    public constructor(private readonly constraint: ActionConstraint) {}
    public hit(targetId: string): GestureProgress {
        if (this.seen.has(targetId)) return { status: 'continue' };
        this.seen.add(targetId); this.hits.push(targetId);
        if (this.constraint.forbiddenTargetIds.includes(targetId)) return { status: 'failure', kind: 'bomb' };
        if (!this.constraint.requiredTargetIds.includes(targetId) && !this.constraint.allowExtraHits) return { status: 'failure', kind: 'wrong' };
        if (this.constraint.ordered && targetId !== this.constraint.requiredTargetIds[this.hits.length - 1]) return { status: 'failure', kind: 'orderError' };
        return this.constraint.requiredTargetIds.every((id) => this.seen.has(id)) ? { status: 'success' } : { status: 'continue' };
    }
    public end(): GestureProgress {
        return this.constraint.requiredTargetIds.every((id) => this.seen.has(id)) ? { status: 'success' } : { status: 'failure', kind: 'miss' };
    }
    public hasHits(): boolean { return this.hits.length > 0; }
}
