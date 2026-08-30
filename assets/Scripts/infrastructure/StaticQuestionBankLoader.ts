import { JsonAsset, resources } from 'cc';
import { installStaticQuestionPacks, isStaticQuestionPack, type StaticQuestionPack } from '../domain/StaticQuestionBank';
import { installStructuredContentPacks, isStructuredContentPack, type StructuredContentPackV2 } from '../domain/StructuredContentBank';

class StaticQuestionBankLoader {
    private pending: Promise<number> | null = null;
    private loadedCount = 0;

    public load(): Promise<number> {
        if (this.loadedCount > 0) return Promise.resolve(this.loadedCount);
        if (this.pending) return this.pending;
        this.pending = new Promise<number>((resolve) => {
            resources.loadDir('question-banks', JsonAsset, (error, assets) => {
                if (error) {
                    console.warn('[QuestionBank] Static subpackage unavailable, using built-in fallback.', error);
                    resolve(0);
                    return;
                }
                const packs: StaticQuestionPack[] = [];
                const structuredPacks: StructuredContentPackV2[] = [];
                for (const asset of assets) {
                    if (isStaticQuestionPack(asset.json)) packs.push(asset.json);
                    else if (isStructuredContentPack(asset.json)) structuredPacks.push(asset.json);
                }
                installStructuredContentPacks(structuredPacks);
                this.loadedCount = installStaticQuestionPacks(packs);
                if (this.loadedCount !== 8_000) {
                    console.warn(`[QuestionBank] Expected 8000 static questions, loaded ${this.loadedCount}.`);
                }
                resolve(this.loadedCount);
            });
        }).finally(() => {
            this.pending = null;
        });
        return this.pending;
    }

    public preload(): void {
        void this.load();
    }
}

export const staticQuestionBankLoader = new StaticQuestionBankLoader();
