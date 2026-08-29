import type { ThemeId } from './Models';

export type StructuredContentKind = 'pinyin' | 'poetry-fragment' | 'country-relation';

export interface StructuredContentRecordV2 {
    id: string;
    kind: StructuredContentKind;
    data: Readonly<Record<string, unknown>>;
    reviewStatus: 'reviewed';
}

export interface StructuredContentPackV2 {
    schemaVersion: 2;
    contentVersion: string;
    packId: string;
    theme: ThemeId;
    records: StructuredContentRecordV2[];
}

const recordsByKind = new Map<StructuredContentKind, StructuredContentRecordV2[]>();
const installedIds = new Set<string>();

export function installStructuredContentPacks(packs: readonly StructuredContentPackV2[]): number {
    let installed = 0;
    for (const pack of packs) {
        if (!isStructuredContentPack(pack)) continue;
        for (const record of pack.records) {
            if (installedIds.has(record.id)) continue;
            installedIds.add(record.id);
            const records = recordsByKind.get(record.kind) ?? [];
            records.push(record);
            recordsByKind.set(record.kind, records);
            installed++;
        }
    }
    return installed;
}

export function structuredContent(kind: StructuredContentKind): readonly StructuredContentRecordV2[] {
    return recordsByKind.get(kind) ?? [];
}

export function isStructuredContentPack(value: unknown): value is StructuredContentPackV2 {
    if (!value || typeof value !== 'object') return false;
    const pack = value as Partial<StructuredContentPackV2>;
    return pack.schemaVersion === 2 && typeof pack.contentVersion === 'string'
        && typeof pack.packId === 'string' && typeof pack.theme === 'string'
        && Array.isArray(pack.records) && pack.records.every((record) => !!record && typeof record === 'object'
            && typeof record.id === 'string' && typeof record.kind === 'string'
            && !!record.data && typeof record.data === 'object' && record.reviewStatus === 'reviewed');
}

export function clearStructuredContentForTests(): void {
    recordsByKind.clear();
    installedIds.clear();
}
