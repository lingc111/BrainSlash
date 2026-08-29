import type { ContentFamilyKind } from './ContentCatalog';
import type { ThemeId } from './Models';

export interface StaticQuestionRecord {
    id: string;
    theme: ThemeId;
    familyKind: ContentFamilyKind;
    prompt: string;
    answer: string | number;
    distractors: readonly (string | number)[];
    difficulty: 1 | 2 | 3;
    source: 'generated-logic' | 'reviewed-catalog';
}

export interface StaticQuestionPack {
    schemaVersion: 1;
    contentVersion: string;
    theme: ThemeId;
    records: StaticQuestionRecord[];
}

const recordsByFamily = new Map<ContentFamilyKind, StaticQuestionRecord[]>();
const installedIds = new Set<string>();

export function installStaticQuestionPacks(packs: readonly StaticQuestionPack[]): number {
    let installed = 0;
    for (const pack of packs) {
        if (pack.schemaVersion !== 1 || pack.theme === undefined || !Array.isArray(pack.records)) continue;
        for (const record of pack.records) {
            if (!isStaticQuestionRecord(record) || record.theme !== pack.theme || installedIds.has(record.id)) continue;
            installedIds.add(record.id);
            const family = recordsByFamily.get(record.familyKind) ?? [];
            family.push(record);
            recordsByFamily.set(record.familyKind, family);
            installed += 1;
        }
    }
    return installed;
}

export function staticQuestionsForFamily(kind: ContentFamilyKind): readonly StaticQuestionRecord[] {
    return recordsByFamily.get(kind) ?? [];
}

export function familyHasStaticQuestions(kind: ContentFamilyKind): boolean {
    return (recordsByFamily.get(kind)?.length ?? 0) > 0;
}

export function installedStaticQuestionCount(): number {
    return installedIds.size;
}

export function clearStaticQuestionPacksForTests(): void {
    recordsByFamily.clear();
    installedIds.clear();
}

export function isStaticQuestionPack(value: unknown): value is StaticQuestionPack {
    if (!value || typeof value !== 'object') return false;
    const pack = value as Partial<StaticQuestionPack>;
    return pack.schemaVersion === 1
        && typeof pack.contentVersion === 'string'
        && typeof pack.theme === 'string'
        && Array.isArray(pack.records)
        && pack.records.every(isStaticQuestionRecord);
}

function isStaticQuestionRecord(value: unknown): value is StaticQuestionRecord {
    if (!value || typeof value !== 'object') return false;
    const record = value as Partial<StaticQuestionRecord>;
    return typeof record.id === 'string'
        && typeof record.theme === 'string'
        && typeof record.familyKind === 'string'
        && typeof record.prompt === 'string'
        && (typeof record.answer === 'string' || typeof record.answer === 'number')
        && Array.isArray(record.distractors)
        && record.distractors.length >= 3
        && record.distractors.every((item) => typeof item === 'string' || typeof item === 'number')
        && (record.difficulty === 1 || record.difficulty === 2 || record.difficulty === 3)
        && (record.source === 'generated-logic' || record.source === 'reviewed-catalog');
}
