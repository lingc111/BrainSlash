import { QUESTION_BANK_PACKS, getQuestionBankStats } from '../assets/Scripts/domain/QuestionBankRegistry.ts';

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
console.log(JSON.stringify({ ...stats, packs: QUESTION_BANK_PACKS.map((pack) => ({ id: pack.id, records: pack.records.length })) }, null, 2));
if (errors.length) {
  console.error(`\nQuestion bank audit failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('\nQuestion bank audit passed. Counts are base records, not generated combinations.');
}
