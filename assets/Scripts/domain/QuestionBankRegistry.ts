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
import {
    KNOWLEDGE_CIVIC_FACTS,
    KNOWLEDGE_CULTURE_EXPANSION,
    KNOWLEDGE_NATURE_EXPANSION,
    KNOWLEDGE_SCIENCE_EXPANSION,
} from './KnowledgeExpansionCatalog';
import type { ThemeId } from './Models';

export type QuestionBankStorage = 'curated' | 'relationship';

export interface QuestionBankPack {
    id: string;
    label: string;
    theme: ThemeId;
    storage: QuestionBankStorage;
    templateIds: readonly QuestionTemplateId[];
    records: readonly unknown[];
    review: {
        source: string;
        status: 'reviewed';
        reviewedAt: string;
    };
}

const RAW_QUESTION_BANK_PACKS: readonly Omit<QuestionBankPack, 'review'>[] = [
    { id: 'hanzi.idioms', label: '成语', theme: 'hanzi', storage: 'curated', templateIds: ['hanzi-fill', 'hanzi-order'], records: IDIOMS },
    { id: 'hanzi.antonyms', label: '汉字反义关系', theme: 'hanzi', storage: 'relationship', templateIds: ['hanzi-antonym'], records: HANZI_ANTONYM_FACTS },
    { id: 'hanzi.synonyms', label: '汉字近义关系', theme: 'hanzi', storage: 'relationship', templateIds: ['hanzi-synonym'], records: HANZI_SYNONYM_FACTS },
    { id: 'english.words', label: '英语词汇', theme: 'english', storage: 'curated', templateIds: ['english-meaning', 'english-category'], records: ENGLISH_WORDS },
    { id: 'english.antonyms', label: '英语反义词', theme: 'english', storage: 'relationship', templateIds: ['english-antonym'], records: ENGLISH_ANTONYMS },
    { id: 'life.categories', label: '生活分类', theme: 'life', storage: 'curated', templateIds: ['life-category'], records: LIFE_CATEGORY_FACTS },
    { id: 'geography.world', label: '国家与首都', theme: 'geography', storage: 'relationship', templateIds: ['geography-capital', 'geography-country'], records: GEOGRAPHY_FACTS },
    { id: 'knowledge.science.core', label: '科学常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-science'], records: KNOWLEDGE_SCIENCE_FACTS },
    { id: 'knowledge.science.extra', label: '科学常识扩展', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-science'], records: KNOWLEDGE_SCIENCE_EXPANSION },
    { id: 'knowledge.nature.core', label: '自然常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-nature'], records: KNOWLEDGE_NATURE_FACTS },
    { id: 'knowledge.nature.extra', label: '自然常识扩展', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-nature'], records: KNOWLEDGE_NATURE_EXPANSION },
    { id: 'knowledge.culture.core', label: '文化常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-culture'], records: KNOWLEDGE_CULTURE_FACTS },
    { id: 'knowledge.culture.extra', label: '文化常识扩展', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-culture'], records: KNOWLEDGE_CULTURE_EXPANSION },
    { id: 'knowledge.civic', label: '公考常识', theme: 'knowledge', storage: 'curated', templateIds: ['knowledge-civic'], records: KNOWLEDGE_CIVIC_FACTS },
    { id: 'history.opening', label: '近代开端', theme: 'history', storage: 'curated', templateIds: ['history-modern-opening'], records: HISTORY_MODERN_OPENING_FACTS },
    { id: 'history.awakening', label: '近代觉醒', theme: 'history', storage: 'curated', templateIds: ['history-modern-awakening'], records: HISTORY_MODERN_AWAKENING_FACTS },
    { id: 'history.resistance', label: '抗战常识', theme: 'history', storage: 'curated', templateIds: ['history-modern-resistance'], records: HISTORY_MODERN_RESISTANCE_FACTS },
    { id: 'history.ancient', label: '古代常识', theme: 'history', storage: 'curated', templateIds: ['history-ancient'], records: HISTORY_ANCIENT_FACTS },
    { id: 'history.myth', label: '神话常识', theme: 'history', storage: 'curated', templateIds: ['history-myth'], records: HISTORY_MYTH_FACTS },
];

const REVIEW = { source: 'internal-reviewed-catalog', status: 'reviewed', reviewedAt: '2026-09-01' } as const;
export const QUESTION_BANK_PACKS: readonly QuestionBankPack[] = RAW_QUESTION_BANK_PACKS.map((pack) => ({ ...pack, review: REVIEW }));

export interface QuestionBankStats {
    baseRecordCount: number;
    packCount: number;
    byTheme: Readonly<Record<ThemeId, number>>;
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
