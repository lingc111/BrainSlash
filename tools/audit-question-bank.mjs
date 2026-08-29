import { QUESTION_BANK_PACKS, getQuestionBankStats } from '../assets/Scripts/domain/QuestionBankRegistry.ts';
import { CONTENT_VERSION } from '../assets/Scripts/configs/GameConfig.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const errors = [];
const semanticRecords = new Map();
const lengthOf = (value) => Array.from(String(value)).length;

for (const pack of QUESTION_BANK_PACKS) {
  if (pack.records.length === 0) errors.push(`${pack.id}: empty pack`);
  pack.records.forEach((record, index) => {
    const location = `${pack.id}[${index}]`;
    const semanticKey = 'prompt' in record
      ? `${pack.theme}:${record.prompt}:${record.answer}`
      : 'en' in record
        ? `${pack.theme}:${record.en}:${record.zh}`
        : 'left' in record
          ? `${pack.theme}:${record.kind}:${record.left}:${record.right}`
          : 'text' in record
            ? `${pack.theme}:${record.text}`
            : `${pack.theme}:${JSON.stringify(record)}`;
    if (semanticRecords.has(semanticKey)) errors.push(`${location}: duplicate of ${semanticRecords.get(semanticKey)}`);
    semanticRecords.set(semanticKey, location);

    for (const field of ['answer', 'zh', 'left', 'right']) {
      if (field in record && lengthOf(record[field]) > 4) errors.push(`${location}: ${field} exceeds 4 characters (${record[field]})`);
    }
    if ('wrong' in record) {
      if (record.wrong.includes(record.answer)) errors.push(`${location}: answer appears in distractors`);
      if (new Set(record.wrong).size !== record.wrong.length) errors.push(`${location}: duplicate distractors`);
    }
    if ('leftDistractors' in record && record.leftDistractors.includes(record.left)) errors.push(`${location}: left answer appears in distractors`);
    if ('rightDistractors' in record && record.rightDistractors.includes(record.right)) errors.push(`${location}: right answer appears in distractors`);
  });
}

const stats = getQuestionBankStats();
const staticDirectory = join(process.cwd(), 'assets', 'resources', 'question-banks');
const staticFiles = readdirSync(staticDirectory).filter((name) => name.endsWith('.json') && name !== 'manifest.json');
const staticIds = new Set();
const staticSignatures = new Map();
const staticByTheme = {};
let staticRecordCount = 0;
for (const fileName of staticFiles) {
  const pack = JSON.parse(readFileSync(join(staticDirectory, fileName), 'utf8'));
  if (pack.schemaVersion !== 1 || !Array.isArray(pack.records)) {
    errors.push(`${fileName}: invalid static pack schema`);
    continue;
  }
  if (pack.contentVersion !== CONTENT_VERSION) errors.push(`${fileName}: contentVersion ${pack.contentVersion} differs from ${CONTENT_VERSION}`);
  staticByTheme[pack.theme] = (staticByTheme[pack.theme] ?? 0) + pack.records.length;
  staticRecordCount += pack.records.length;
  for (const [index, record] of pack.records.entries()) {
    const location = `${fileName}[${index}]`;
    if (staticIds.has(record.id)) errors.push(`${location}: duplicate static id ${record.id}`);
    staticIds.add(record.id);
    if (record.theme !== pack.theme) errors.push(`${location}: theme differs from pack`);
    if (!record.prompt || !record.familyKind) errors.push(`${location}: missing prompt or familyKind`);
    if (!Array.isArray(record.distractors) || record.distractors.length < 3) errors.push(`${location}: fewer than three distractors`);
    if (record.distractors?.some((item) => String(item) === String(record.answer))) errors.push(`${location}: answer appears in distractors`);
    if (record.distractors && new Set(record.distractors.map(String)).size !== record.distractors.length) errors.push(`${location}: duplicate distractors`);
    const signature = JSON.stringify([record.theme, record.familyKind, record.prompt, record.answer, record.distractors]);
    if (staticSignatures.has(signature)) errors.push(`${location}: exact duplicate of ${staticSignatures.get(signature)}`);
    staticSignatures.set(signature, location);
  }
}
if (staticRecordCount !== 5_000) errors.push(`static question count must be 5000, received ${staticRecordCount}`);

console.log(JSON.stringify({
  curatedBase: { ...stats, packs: QUESTION_BANK_PACKS.map((pack) => ({ id: pack.id, records: pack.records.length })) },
  staticPlayable: { recordCount: staticRecordCount, files: staticFiles.length, byTheme: staticByTheme },
}, null, 2));
if (errors.length) {
  console.error(`\nQuestion bank audit failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('\nQuestion bank audit passed. Static playable records are materialized in the resources subpackage.');
}
