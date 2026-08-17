function hashSeed(seed: string): number {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) { hash ^= seed.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0 || 0x9e3779b9;
}
export class SeededRng {
    private state: number;
    public constructor(seed: string) { this.state = hashSeed(seed); }
    public next(): number {
        let value = this.state;
        value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
        this.state = value >>> 0;
        return this.state / 0x100000000;
    }
    public int(min: number, maxInclusive: number): number { return min + Math.floor(this.next() * (maxInclusive - min + 1)); }
    public pick<T>(items: readonly T[]): T {
        if (!items.length) throw new Error('Cannot pick from an empty list.');
        return items[this.int(0, items.length - 1)];
    }
    public shuffle<T>(items: readonly T[]): T[] {
        const result = [...items];
        for (let i = result.length - 1; i > 0; i--) { const j = this.int(0, i); [result[i], result[j]] = [result[j], result[i]]; }
        return result;
    }
    public fork(stream: string): SeededRng { return new SeededRng(`${this.state}:${stream}`); }
}
