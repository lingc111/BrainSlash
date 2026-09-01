import {
    ENGLISH_ANTONYMS,
    ENGLISH_WORDS,
    GEOGRAPHY_FACTS,
    HISTORY_ANCIENT_FACTS,
    HISTORY_MODERN_AWAKENING_FACTS,
    HISTORY_MODERN_OPENING_FACTS,
    HISTORY_MODERN_RESISTANCE_FACTS,
    HISTORY_MYTH_FACTS,
    IDIOMS,
    KNOWLEDGE_CULTURE_FACTS,
    KNOWLEDGE_NATURE_FACTS,
    KNOWLEDGE_SCIENCE_FACTS,
    LIFE_CATEGORY_FACTS,
} from './ContentCatalog';
import type { QuestionTemplateId } from './QuestionTemplateCatalog';
import { HANZI_ANTONYM_FACTS, HANZI_SYNONYM_FACTS } from './HanziRelationCatalog';
import { PINYIN_FACTS, POETRY_FACTS } from './HanziExpansionCatalog';
import {
    KNOWLEDGE_CIVIC_FACTS,
    KNOWLEDGE_CULTURE_EXPANSION,
    KNOWLEDGE_NATURE_EXPANSION,
    KNOWLEDGE_SCIENCE_EXPANSION,
} from './KnowledgeExpansionCatalog';
import type { ThemeId } from './Models';
import { EXPANSION_ORDER_PACKS, EXPANSION_TRIVIA_PACKS } from './ThemeExpansionCatalog';
import { ENGLISH_EXTRA_WORDS } from './EnglishVocabularyExpansion';

export type QuestionBankStorage = 'curated' | 'relationship';

export interface ReviewedFactRecord {
    id: string;
    kind: string;
    fields: Readonly<Record<string, unknown>>;
    tags: readonly string[];
    source: string;
    reviewStatus: 'reviewed';
    reviewedAt: string;
    enabled: boolean;
}

export interface QuestionBankPack {
    id: string;
    label: string;
    theme: ThemeId;
    storage: QuestionBankStorage;
    templateIds: readonly QuestionTemplateId[];
    records: readonly ReviewedFactRecord[];
    review: {
        source: string;
        status: 'reviewed';
        reviewedAt: string;
    };
}

interface RawQuestionBankPack extends Omit<QuestionBankPack, 'records' | 'review'> { rawRecords: readonly unknown[]; }

const RAW_QUESTION_BANK_PACKS: readonly RawQuestionBankPack[] = [
    { id: 'hanzi.idioms', label: '成语', theme: 'hanzi', storage: 'curated', templateIds: ['hanzi-fill', 'hanzi-order'], rawRecords: IDIOMS },
    { id: 'hanzi.antonyms', label: '汉字反义关系', theme: 'hanzi', storage: 'relationship', templateIds: ['hanzi-antonym'], rawRecords: HANZI_ANTONYM_FACTS },
    { id: 'hanzi.synonyms', label: '汉字近义关系', theme: 'hanzi', storage: 'relationship', templateIds: ['hanzi-synonym'], rawRecords: HANZI_SYNONYM_FACTS },
    { id: 'hanzi.pinyin', label: '汉字拼音', theme: 'hanzi', storage: 'curated', templateIds: ['hanzi-pinyin', 'hanzi-homophone'], rawRecords: PINYIN_FACTS },
    { id: 'hanzi.poetry', label: '诗句填空', theme: 'hanzi', storage: 'curated', templateIds: ['hanzi-poetry'], rawRecords: POETRY_FACTS },
    { id: 'hanzi.radical', label: '汉字部首', theme: 'hanzi', storage: 'relationship', templateIds: ['hanzi-radical'], rawRecords: EXPANSION_TRIVIA_PACKS['hanzi-radical']! },
    { id: 'hanzi.compose', label: '汉字组成', theme: 'hanzi', storage: 'relationship', templateIds: ['hanzi-compose'], rawRecords: EXPANSION_TRIVIA_PACKS['hanzi-compose']! },
    { id: 'english.words', label: '英语词汇', theme: 'english', storage: 'curated', templateIds: ['english-meaning', 'english-category', 'english-first-letter', 'english-length', 'english-missing-letter'], rawRecords: ENGLISH_WORDS },
    { id: 'english.words.extra', label: '英语词汇扩展', theme: 'english', storage: 'curated', templateIds: ['english-meaning', 'english-category', 'english-first-letter', 'english-length', 'english-missing-letter'], rawRecords: ENGLISH_EXTRA_WORDS },
    { id: 'english.antonyms', label: '英语反义词', theme: 'english', storage: 'relationship', templateIds: ['english-antonym'], rawRecords: ENGLISH_ANTONYMS },
    { id: 'english.synonyms', label: '英语近义词', theme: 'english', storage: 'relationship', templateIds: ['english-synonym'], rawRecords: EXPANSION_TRIVIA_PACKS['english-synonym']! },
    { id: 'english.sentences', label: '英语句序', theme: 'english', storage: 'curated', templateIds: ['english-word-order'], rawRecords: EXPANSION_ORDER_PACKS['english-word-order']! },
    { id: 'life.categories', label: '生活分类与用途', theme: 'life', storage: 'curated', templateIds: ['life-category', 'life-use'], rawRecords: LIFE_CATEGORY_FACTS },
    { id: 'life.places', label: '生活场所', theme: 'life', storage: 'relationship', templateIds: ['life-place'], rawRecords: EXPANSION_TRIVIA_PACKS['life-place']! },
    { id: 'life.signs', label: '公共标志', theme: 'life', storage: 'curated', templateIds: ['life-public-sign'], rawRecords: EXPANSION_TRIVIA_PACKS['life-public-sign']! },
    { id: 'life.safety', label: '安全行为', theme: 'life', storage: 'curated', templateIds: ['life-safe-behavior'], rawRecords: EXPANSION_TRIVIA_PACKS['life-safe-behavior']! },
    { id: 'life.process', label: '生活流程', theme: 'life', storage: 'curated', templateIds: ['life-process'], rawRecords: EXPANSION_ORDER_PACKS['life-process']! },
    { id: 'geography.world', label: '国家与首都', theme: 'geography', storage: 'relationship', templateIds: ['geography-capital', 'geography-country'], rawRecords: GEOGRAPHY_FACTS },
    { id: 'geography.continent', label: '国家与洲', theme: 'geography', storage: 'relationship', templateIds: ['geography-continent'], rawRecords: EXPANSION_TRIVIA_PACKS['geography-continent']! },
    { id: 'geography.landmark', label: '世界地标', theme: 'geography', storage: 'relationship', templateIds: ['geography-landmark'], rawRecords: EXPANSION_TRIVIA_PACKS['geography-landmark']! },
    { id: 'geography.province', label: '省与省会', theme: 'geography', storage: 'relationship', templateIds: ['geography-province-capital'], rawRecords: EXPANSION_TRIVIA_PACKS['geography-province-capital']! },
    { id: 'geography.position', label: '相对方位', theme: 'geography', storage: 'relationship', templateIds: ['geography-relative-position'], rawRecords: EXPANSION_TRIVIA_PACKS['geography-relative-position']! },
    { id: 'knowledge.science.core', label: '科学常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-science'], rawRecords: KNOWLEDGE_SCIENCE_FACTS },
    { id: 'knowledge.science.extra', label: '科学常识扩展', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-science'], rawRecords: KNOWLEDGE_SCIENCE_EXPANSION },
    { id: 'knowledge.nature.core', label: '自然常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-nature'], rawRecords: KNOWLEDGE_NATURE_FACTS },
    { id: 'knowledge.nature.extra', label: '自然常识扩展', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-nature'], rawRecords: KNOWLEDGE_NATURE_EXPANSION },
    { id: 'knowledge.culture.core', label: '文化常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-culture'], rawRecords: KNOWLEDGE_CULTURE_FACTS },
    { id: 'knowledge.culture.extra', label: '文化常识扩展', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-culture'], rawRecords: KNOWLEDGE_CULTURE_EXPANSION },
    { id: 'knowledge.civic', label: '公考常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-civic'], rawRecords: KNOWLEDGE_CIVIC_FACTS },
    { id: 'knowledge.astronomy', label: '天文常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-astronomy'], rawRecords: EXPANSION_TRIVIA_PACKS['knowledge-astronomy']! },
    { id: 'knowledge.biology', label: '生物常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-biology'], rawRecords: EXPANSION_TRIVIA_PACKS['knowledge-biology']! },
    { id: 'knowledge.physics', label: '物理常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-physics'], rawRecords: EXPANSION_TRIVIA_PACKS['knowledge-physics']! },
    { id: 'knowledge.technology', label: '科技常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-technology'], rawRecords: EXPANSION_TRIVIA_PACKS['knowledge-technology']! },
    { id: 'history.opening', label: '近代开端', theme: 'history', storage: 'curated', templateIds: ['history-modern-opening'], rawRecords: HISTORY_MODERN_OPENING_FACTS },
    { id: 'history.opening.extra', label: '近代开端扩展', theme: 'history', storage: 'curated', templateIds: ['history-modern-opening'], rawRecords: EXPANSION_TRIVIA_PACKS['history-modern-opening']! },
    { id: 'history.awakening', label: '近代觉醒', theme: 'history', storage: 'curated', templateIds: ['history-modern-awakening'], rawRecords: HISTORY_MODERN_AWAKENING_FACTS },
    { id: 'history.awakening.extra', label: '近代觉醒扩展', theme: 'history', storage: 'curated', templateIds: ['history-modern-awakening'], rawRecords: EXPANSION_TRIVIA_PACKS['history-modern-awakening']! },
    { id: 'history.resistance', label: '抗战常识', theme: 'history', storage: 'curated', templateIds: ['history-modern-resistance'], rawRecords: HISTORY_MODERN_RESISTANCE_FACTS },
    { id: 'history.resistance.extra', label: '抗战常识扩展', theme: 'history', storage: 'curated', templateIds: ['history-modern-resistance'], rawRecords: EXPANSION_TRIVIA_PACKS['history-modern-resistance']! },
    { id: 'history.ancient', label: '古代常识', theme: 'history', storage: 'curated', templateIds: ['history-ancient'], rawRecords: HISTORY_ANCIENT_FACTS },
    { id: 'history.ancient.extra', label: '古代常识扩展', theme: 'history', storage: 'curated', templateIds: ['history-ancient'], rawRecords: EXPANSION_TRIVIA_PACKS['history-ancient']! },
    { id: 'history.myth', label: '神话常识', theme: 'history', storage: 'curated', templateIds: ['history-myth'], rawRecords: HISTORY_MYTH_FACTS },
    { id: 'history.myth.extra', label: '神话常识扩展', theme: 'history', storage: 'curated', templateIds: ['history-myth'], rawRecords: EXPANSION_TRIVIA_PACKS['history-myth']! },
    { id: 'history.chronology', label: '历史时序', theme: 'history', storage: 'curated', templateIds: ['history-chronology'], rawRecords: EXPANSION_ORDER_PACKS['history-chronology']! },
    { id: 'history.person-event', label: '历史人物事件', theme: 'history', storage: 'relationship', templateIds: ['history-person-event'], rawRecords: EXPANSION_TRIVIA_PACKS['history-person-event']! },
];

const REVIEW = { source: 'internal-reviewed-catalog', status: 'reviewed', reviewedAt: '2026-09-01' } as const;

export function reviewedFactId(packId: string, rawRecord: unknown): string {
    return `fact.${packId}.${fnv1a(identityOf(rawRecord))}`;
}

const FACT_ID_BY_RECORD = new WeakMap<object, string>();

export function reviewedFactIdForRecord(rawRecord: object): string {
    const id = FACT_ID_BY_RECORD.get(rawRecord);
    if (!id) throw new Error('Question compiler used an unregistered reviewed fact');
    return id;
}

export const QUESTION_BANK_PACKS: readonly QuestionBankPack[] = RAW_QUESTION_BANK_PACKS.map(({ rawRecords, ...pack }) => ({
    ...pack,
    review: REVIEW,
    records: rawRecords.map((rawRecord) => toReviewedFact(pack, rawRecord)),
}));

export const REVIEWED_FACTS: readonly ReviewedFactRecord[] = QUESTION_BANK_PACKS.flatMap((pack) => pack.records);

export interface QuestionBankStats {
    baseRecordCount: number;
    packCount: number;
    byTheme: Readonly<Record<ThemeId, number>>;
}

function fieldsOf(rawRecord: unknown): Readonly<Record<string, unknown>> {
    if (Array.isArray(rawRecord)) return { values: [...rawRecord] };
    if (rawRecord && typeof rawRecord === 'object') return { ...(rawRecord as Record<string, unknown>) };
    return { value: rawRecord };
}

function toReviewedFact(pack: Omit<RawQuestionBankPack, 'rawRecords'>, rawRecord: unknown): ReviewedFactRecord {
    const id = reviewedFactId(pack.id, rawRecord);
    if (rawRecord && typeof rawRecord === 'object') FACT_ID_BY_RECORD.set(rawRecord, id);
    return {
        id,
        kind: pack.id,
        fields: fieldsOf(rawRecord),
        tags: [pack.theme, ...pack.templateIds],
        source: REVIEW.source,
        reviewStatus: REVIEW.status,
        reviewedAt: REVIEW.reviewedAt,
        enabled: true,
    };
}

function identityOf(rawRecord: unknown): string {
    if (rawRecord && typeof rawRecord === 'object' && !Array.isArray(rawRecord)) {
        const record = rawRecord as Record<string, unknown>;
        if (typeof record.id === 'string') return record.id;
        for (const key of ['text', 'en', 'item', 'country']) if (typeof record[key] === 'string') return `${key}:${record[key]}`;
        if (typeof record.prompt === 'string') return `prompt:${record.prompt}|answer:${String(record.answer ?? '')}`;
    }
    return stableStringify(rawRecord);
}

function stableStringify(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? String(value);
}

function fnv1a(value: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36).padStart(7, '0');
}

export function getQuestionBankStats(): QuestionBankStats {
    const byTheme: Record<ThemeId, number> = {
        math: 0, vision: 0, hanzi: 0, english: 0, life: 0,
        geography: 0, knowledge: 0, history: 0,
    };
    for (const pack of QUESTION_BANK_PACKS) byTheme[pack.theme] += pack.records.length;
    return {
        baseRecordCount: QUESTION_BANK_PACKS.reduce((sum, pack) => sum + pack.records.length, 0),
        packCount: QUESTION_BANK_PACKS.length,
        byTheme,
    };
}
