import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_VERSION } from '../assets/Scripts/configs/GameConfig.ts';
import { QUESTION_BANK_PACKS, REVIEWED_FACTS } from '../assets/Scripts/domain/QuestionBankRegistry.ts';
import { QUESTION_TEMPLATES } from '../assets/Scripts/domain/QuestionTemplateCatalog.ts';

const outputDir = path.resolve('assets/resources/question-content');
const schemaVersion = 2;
const fallbackFactIds = new Set(QUESTION_BANK_PACKS.flatMap((pack) => pack.records.slice(0, 8).map((record) => record.id)));

const production = bundle('production', REVIEWED_FACTS);
const fallback = bundle('fallback', REVIEWED_FACTS.filter((record) => fallbackFactIds.has(record.id)));
const files = [
  ['question-content.v2.json', production],
  ['question-content.fallback.v2.json', fallback],
];

await mkdir(outputDir, { recursive: true });
const manifestBundles = [];
for (const [file, data] of files) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(path.join(outputDir, file), text, 'utf8');
  manifestBundles.push({
    kind: data.bundleKind,
    file,
    sha256: createHash('sha256').update(text).digest('hex'),
    templateCount: data.templates.length,
    factCount: data.facts.length,
  });
}

const manifest = {
  schemaVersion,
  contentVersion: CONTENT_VERSION,
  bundle: 'question-content',
  bundles: manifestBundles,
};
await writeFile(path.join(outputDir, 'manifest.v2.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));

function bundle(bundleKind, facts) {
  return {
    schemaVersion,
    contentVersion: CONTENT_VERSION,
    bundleKind,
    templates: QUESTION_TEMPLATES,
    facts,
  };
}
