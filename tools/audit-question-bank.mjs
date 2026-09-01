import { QUESTION_BANK_PACKS, getQuestionBankStats } from '../assets/Scripts/domain/QuestionBankRegistry.ts';
import { QUESTION_TEMPLATES } from '../assets/Scripts/domain/QuestionSystem.ts';

const errors = [];
const templateIds = new Set();
for (const template of QUESTION_TEMPLATES) {
  if (!template.id || templateIds.has(template.id)) errors.push(`duplicate or empty template id: ${template.id}`);
  templateIds.add(template.id);
  if (!template.capabilities.length) errors.push(`${template.id}: missing capabilities`);
  if (template.difficultyBands.length !== 5) errors.push(`${template.id}: incomplete difficulty coverage`);
  if (!template.supportedRuleSets.length) errors.push(`${template.id}: missing supported rule sets`);
  if (!Number.isInteger(template.targetCap) || template.targetCap < 2 || template.targetCap > 6) errors.push(`${template.id}: invalid target cap`);
  if (!template.enabled) errors.push(`${template.id}: disabled template is present in the production catalog`);
}

const factKeys = new Map();
for (const pack of QUESTION_BANK_PACKS) {
  if (!pack.records.length) errors.push(`${pack.id}: empty reviewed fact pack`);
  if (pack.review.status !== 'reviewed' || !pack.review.source || !/^\d{4}-\d{2}-\d{2}$/.test(pack.review.reviewedAt)) {
    errors.push(`${pack.id}: invalid review metadata`);
  }
  for (const templateId of pack.templateIds) if (!templateIds.has(templateId)) errors.push(`${pack.id}: unknown template ${templateId}`);
  pack.records.forEach((record, index) => {
    const key = JSON.stringify(record);
    if (factKeys.has(key)) errors.push(`${pack.id}[${index}]: duplicate of ${factKeys.get(key)}`);
    factKeys.set(key, `${pack.id}[${index}]`);
    if ('wrong' in record) {
      if (record.wrong.includes(record.answer)) errors.push(`${pack.id}[${index}]: answer appears in distractors`);
      if (new Set(record.wrong).size !== record.wrong.length) errors.push(`${pack.id}[${index}]: duplicate distractors`);
    }
  });
}

for (const template of QUESTION_TEMPLATES) {
  if (template.sourceKind === 'reviewed-facts' && !QUESTION_BANK_PACKS.some((pack) => pack.templateIds.includes(template.id))) {
    errors.push(`${template.id}: reviewed-facts template has no registered fact pack`);
  }
}

console.log(JSON.stringify({
  unifiedTemplates: {
    count: QUESTION_TEMPLATES.length,
    byTheme: Object.fromEntries([...new Set(QUESTION_TEMPLATES.map((item) => item.theme))]
      .map((theme) => [theme, QUESTION_TEMPLATES.filter((item) => item.theme === theme).length])),
  },
  reviewedFacts: getQuestionBankStats(),
}, null, 2));

if (errors.length) {
  console.error(`\nUnified question audit failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('\nUnified question audit passed.');
}
