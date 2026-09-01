import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_VERSION } from '../assets/Scripts/configs/GameConfig.ts';
import { QUESTION_BANK_PACKS, REVIEWED_FACTS, getQuestionBankStats } from '../assets/Scripts/domain/QuestionBankRegistry.ts';
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

const bundleDir = path.resolve('assets/resources/question-content');
const manifest = JSON.parse(await readFile(path.join(bundleDir, 'manifest.v2.json'), 'utf8'));
if (manifest.schemaVersion !== 2 || manifest.contentVersion !== CONTENT_VERSION) errors.push('manifest: schema or content version mismatch');
const descriptors = manifest.bundles ?? [];
if (descriptors.length !== 2 || new Set(descriptors.map((item) => item.kind)).size !== 2
    || !descriptors.some((item) => item.kind === 'production') || !descriptors.some((item) => item.kind === 'fallback')) {
  errors.push('manifest: expected exactly one production and one fallback bundle');
}
for (const descriptor of descriptors) {
  const text = await readFile(path.join(bundleDir, descriptor.file), 'utf8');
  const checksum = createHash('sha256').update(text).digest('hex');
  if (checksum !== descriptor.sha256) errors.push(`${descriptor.file}: checksum mismatch`);
  const bundle = JSON.parse(text);
  if (bundle.schemaVersion !== 2 || bundle.contentVersion !== CONTENT_VERSION || bundle.bundleKind !== descriptor.kind) {
    errors.push(`${descriptor.file}: schema mismatch`);
  }
  if (bundle.templates.length !== descriptor.templateCount || bundle.facts.length !== descriptor.factCount) {
    errors.push(`${descriptor.file}: manifest counts mismatch`);
  }
  if (new Set(bundle.templates.map((template) => template.id)).size !== QUESTION_TEMPLATES.length) {
    errors.push(`${descriptor.file}: template catalog mismatch`);
  }
  if (descriptor.kind === 'production') {
    const sourceIds = REVIEWED_FACTS.map((fact) => fact.id).sort();
    const bundleIds = bundle.facts.map((fact) => fact.id).sort();
    if (JSON.stringify(bundleIds) !== JSON.stringify(sourceIds)) errors.push(`${descriptor.file}: production facts differ from reviewed registry`);
  }
  for (const template of bundle.templates.filter((item) => item.sourceKind === 'reviewed-facts')) {
    if (!bundle.facts.some((fact) => fact.enabled && fact.tags.includes(template.id))) errors.push(`${descriptor.file}: no fact for ${template.id}`);
  }
}

const factKeys = new Map();
const factIds = new Set();
for (const pack of QUESTION_BANK_PACKS) {
  if (!pack.records.length) errors.push(`${pack.id}: empty reviewed fact pack`);
  if (pack.review.status !== 'reviewed' || !pack.review.source || !/^\d{4}-\d{2}-\d{2}$/.test(pack.review.reviewedAt)) {
    errors.push(`${pack.id}: invalid review metadata`);
  }
  for (const templateId of pack.templateIds) if (!templateIds.has(templateId)) errors.push(`${pack.id}: unknown template ${templateId}`);
  pack.records.forEach((record, index) => {
    if (!record.id || factIds.has(record.id)) errors.push(`${pack.id}[${index}]: duplicate or empty fact id ${record.id}`);
    factIds.add(record.id);
    if (record.kind !== pack.id || !record.tags.includes(pack.theme) || !record.enabled) errors.push(`${pack.id}[${index}]: invalid fact metadata`);
    if (record.reviewStatus !== 'reviewed' || !record.source || !/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt)) errors.push(`${pack.id}[${index}]: invalid fact review`);
    const key = JSON.stringify({ kind: record.kind, fields: record.fields });
    if (factKeys.has(key)) errors.push(`${pack.id}[${index}]: duplicate of ${factKeys.get(key)}`);
    factKeys.set(key, `${pack.id}[${index}]`);
    if (Array.isArray(record.fields.wrong)) {
      if (record.fields.wrong.includes(record.fields.answer)) errors.push(`${pack.id}[${index}]: answer appears in distractors`);
      if (new Set(record.fields.wrong).size !== record.fields.wrong.length) errors.push(`${pack.id}[${index}]: duplicate distractors`);
    }
  });
}

for (const template of QUESTION_TEMPLATES) {
  if (template.sourceKind === 'reviewed-facts' && !QUESTION_BANK_PACKS.some((pack) => pack.templateIds.includes(template.id))) {
    errors.push(`${template.id}: reviewed-facts template has no registered fact pack`);
  }
  if (template.sourceKind === 'reviewed-facts') {
    const factCount = QUESTION_BANK_PACKS.filter((pack) => pack.templateIds.includes(template.id))
      .reduce((sum, pack) => sum + pack.records.filter((record) => record.enabled).length, 0);
    if (factCount < 8) errors.push(`${template.id}: only ${factCount} enabled facts; minimum is 8`);
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
