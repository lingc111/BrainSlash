import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CONTENT_VERSION } from '../assets/Scripts/configs/GameConfig.ts';
import { QUESTION_BANK_PACKS, REVIEWED_FACTS, getQuestionBankStats } from '../assets/Scripts/domain/QuestionBankRegistry.ts';
import { QUESTION_TEMPLATES } from '../assets/Scripts/domain/QuestionSystem.ts';
import { MVP_QUESTION_INVENTORY, MVP_THEME_TARGETS } from '../assets/Scripts/domain/MvpQuestionInventory.ts';

const errors = [];
for (const sourceFile of ['assets/Scripts/domain/MvpQuestionInventory.ts', 'assets/Scripts/domain/TowerChallenge.ts']) {
  const source = await readFile(path.resolve(sourceFile), 'utf8');
  if (/\[\.\.\.[^\]]*\.(?:values|keys|entries)\(\)\]/.test(source)) {
    errors.push(`${sourceFile}: iterable spread is unsafe in the WeChat transform`);
  }
}
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
  if (bundle.templates.length !== descriptor.templateCount || bundle.facts.length !== descriptor.factCount
      || bundle.questions.length !== descriptor.questionCount) {
    errors.push(`${descriptor.file}: manifest counts mismatch`);
  }
  if (new Set(bundle.templates.map((template) => template.id)).size !== QUESTION_TEMPLATES.length) {
    errors.push(`${descriptor.file}: template catalog mismatch`);
  }
  if (descriptor.kind === 'production') {
    const sourceIds = REVIEWED_FACTS.map((fact) => fact.id).sort();
    const bundleIds = bundle.facts.map((fact) => fact.id).sort();
    if (JSON.stringify(bundleIds) !== JSON.stringify(sourceIds)) errors.push(`${descriptor.file}: production facts differ from reviewed registry`);
    const questionIds = MVP_QUESTION_INVENTORY.map((question) => question.id).sort();
    const bundleQuestionIds = bundle.questions.map((question) => question.id).sort();
    if (JSON.stringify(bundleQuestionIds) !== JSON.stringify(questionIds)) errors.push(`${descriptor.file}: production questions differ from MVP inventory`);
  }
  for (const template of bundle.templates.filter((item) => item.sourceKind === 'reviewed-facts')) {
    if (!bundle.facts.some((fact) => fact.enabled && fact.tags.includes(template.id))) errors.push(`${descriptor.file}: no fact for ${template.id}`);
  }
}

const inventoryIds = new Set();
const inventorySignatures = new Set();
const inventoryByTheme = Object.fromEntries(Object.keys(MVP_THEME_TARGETS).map((theme) => [theme, 0]));
for (const [index, question] of MVP_QUESTION_INVENTORY.entries()) {
  if (!question.id || inventoryIds.has(question.id)) errors.push(`inventory[${index}]: duplicate or empty id ${question.id}`);
  inventoryIds.add(question.id);
  if (!question.verified || !templateIds.has(question.templateId)) errors.push(`${question.id}: invalid verification or template`);
  if (QUESTION_TEMPLATES.find((template) => template.id === question.templateId)?.theme !== question.theme) errors.push(`${question.id}: theme/template mismatch`);
  if (typeof question.prompt !== 'string' || !question.prompt.trim()) errors.push(`${question.id}: empty prompt`);
  if (typeof question.answer !== 'string' && typeof question.answer !== 'number') errors.push(`${question.id}: invalid answer type`);
  if (!Array.isArray(question.wrong) || question.wrong.length < 3) errors.push(`${question.id}: fewer than three distractors`);
  if (question.wrong.some((choice) => typeof choice !== 'string' && typeof choice !== 'number')) errors.push(`${question.id}: invalid distractor type`);
  if (question.wrong.map(String).includes(String(question.answer))) errors.push(`${question.id}: answer appears in distractors`);
  if (new Set(question.wrong.map(String)).size !== question.wrong.length) errors.push(`${question.id}: duplicate distractors`);
  const signature = `${question.theme}|${question.templateId}|${question.prompt}|${question.answer}`;
  if (inventorySignatures.has(signature)) errors.push(`${question.id}: duplicate playable content`);
  inventorySignatures.add(signature);
  inventoryByTheme[question.theme] += 1;
  if (question.theme === 'math') {
    if (question.templateId === 'math-operator') {
      const match = question.prompt.match(/^(\d+)\( \)(\d+)=(\d+)$/);
      if (!match || !['+', '-', '×', '÷'].includes(question.answer)) errors.push(`${question.id}: invalid operator question`);
      else {
        const [, leftText, rightText, resultText] = match;
        const left = Number(leftText); const right = Number(rightText); const result = Number(resultText);
        const calculated = question.answer === '+' ? left + right : question.answer === '-' ? left - right
          : question.answer === '×' ? left * right : left / right;
        if (calculated !== result) errors.push(`${question.id}: incorrect operator answer`);
      }
    } else if (question.templateId === 'math-digit-reverse') {
      const match = question.prompt.match(/^(\d{5,})反转后$/);
      if (!match || String(question.answer) !== Array.from(match[1]).reverse().join('')) errors.push(`${question.id}: incorrect digit reversal`);
      if (question.wrong.some((choice) => String(choice).length !== String(question.answer).length)) errors.push(`${question.id}: reversal distractor length mismatch`);
      if (question.wrong.some((choice) => Array.from(String(choice)).filter((char, offset) => char !== String(question.answer)[offset]).length > 2)) {
        errors.push(`${question.id}: reversal distractor is not visually similar`);
      }
    } else if (question.templateId === 'math-remainder') {
      const match = question.prompt.match(/^(\d+)÷(\d+)的余数$/);
      if (!match || Number(match[1]) > 99 || Number(match[2]) > 99
          || Number(question.answer) < 0 || Number(question.answer) > 9
          || Number(question.answer) >= Number(match[2])
          || Number(match[1]) % Number(match[2]) !== question.answer) errors.push(`${question.id}: incorrect or out-of-range remainder`);
      if (question.wrong.some((choice) => Number(choice) < 0 || Number(choice) > 9 || Number(choice) >= Number(match?.[2]))) {
        errors.push(`${question.id}: invalid remainder distractor`);
      }
    } else {
      const expression = question.prompt.replace('=?', '').replaceAll('×', '*').replaceAll('÷', '/');
      if (!/^[0-9+*/-]+$/.test(expression)) errors.push(`${question.id}: unsafe arithmetic expression`);
      else if (Function(`"use strict"; return (${expression})`)() !== question.answer) errors.push(`${question.id}: incorrect arithmetic answer`);
      const operands = question.prompt.match(/\d+/g)?.map(Number) ?? [];
      if ((question.templateId === 'math-add' || question.templateId === 'math-subtract')
          && operands.slice(0, 2).some((value) => value < 100)) errors.push(`${question.id}: add/sub operand below three digits`);
      if (question.templateId === 'math-multiply' && (operands.slice(0, 2).some((value) => value < 10 || value > 999)
          || Number(question.answer) > 999 || question.wrong.some((choice) => Number(choice) > 999))) errors.push(`${question.id}: multiply value outside two/three digits`);
      if (question.templateId === 'math-divide' && (operands[1] < 10 || Number(question.answer) < 10
          || operands.some((value) => value > 999) || Number(question.answer) > 999)) errors.push(`${question.id}: divide value outside two/three digits`);
      if (question.templateId === 'math-mixed' && (operands[0] < 10 || operands[1] < 10 || operands.some((value) => value > 999)
          || Number(question.answer) > 999 || question.wrong.some((choice) => Number(choice) > 999))) errors.push(`${question.id}: mixed-operation value outside two/three digits`);
    }
  }
}
if (QUESTION_TEMPLATES.some((template) => template.id === 'math-rounding' || template.tags.includes('rounding'))) errors.push('rounding template must not exist');
if (QUESTION_TEMPLATES.some((template) => template.id === 'english-first-letter')
    || MVP_QUESTION_INVENTORY.some((question) => /首字母/.test(question.prompt))) errors.push('English first-letter questions must not exist');
if (QUESTION_TEMPLATES.some((template) => template.id === 'life-process' || template.id === 'knowledge-technology')) {
  errors.push('verbose life processes and technology trivia templates must not exist');
}
const computerTerms = /计算机|CPU|RAM|SSD|内存|硬盘|操作系统|浏览器|搜索引擎|Wi-?Fi|云存储|人工智能/;
if (MVP_QUESTION_INVENTORY.some((question) => question.theme === 'knowledge'
    && computerTerms.test(`${question.prompt}|${question.answer}|${question.wrong.join('|')}`))) {
  errors.push('computer trivia remains in the knowledge inventory');
}
if (MVP_QUESTION_INVENTORY.length < 10_000) errors.push(`MVP inventory fell below the original 10000-question baseline: ${MVP_QUESTION_INVENTORY.length}`);
for (const [theme, target] of Object.entries(MVP_THEME_TARGETS)) {
  if (inventoryByTheme[theme] !== target) errors.push(`${theme}: expected ${target} MVP questions, got ${inventoryByTheme[theme]}`);
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
      if (record.fields.wrong.length < 3) errors.push(`${pack.id}[${index}]: fewer than three distractors`);
      if (record.fields.wrong.includes(record.fields.answer)) errors.push(`${pack.id}[${index}]: answer appears in distractors`);
      if (new Set(record.fields.wrong).size !== record.fields.wrong.length) errors.push(`${pack.id}[${index}]: duplicate distractors`);
      if (record.fields.wrong.some((choice) => typeof choice !== 'string')
          || ('answer' in record.fields && typeof record.fields.answer !== 'string')) {
        errors.push(`${pack.id}[${index}]: answer choices must be strings`);
      }
    }
    if (Array.isArray(record.fields.parts) && record.fields.parts.some((part) => typeof part !== 'string')) {
      errors.push(`${pack.id}[${index}]: ordered choices must be strings`);
    }
    if (record.kind === 'life.process') {
      if (typeof record.fields.prompt !== 'string' || Array.from(record.fields.prompt).length > 6 || record.fields.prompt.includes('顺序')) {
        errors.push(`${pack.id}[${index}]: process prompt is not concise`);
      }
      if (!Array.isArray(record.fields.parts) || record.fields.parts.length !== 4
          || record.fields.parts.some((part) => Array.from(part).length > 6)) {
        errors.push(`${pack.id}[${index}]: process choices are not glanceable`);
      }
    }
    if (record.kind === 'hanzi.radical' && Array.isArray(record.fields.wrong)
        && record.fields.wrong.some((choice) => /^\d{3,4}年$/.test(choice))) {
      errors.push(`${pack.id}[${index}]: radical distractors must not contain years`);
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
    if (factCount < 30) errors.push(`${template.id}: only ${factCount} enabled facts; minimum is 30`);
  }
}

console.log(JSON.stringify({
  unifiedTemplates: {
    count: QUESTION_TEMPLATES.length,
    byTheme: Object.fromEntries([...new Set(QUESTION_TEMPLATES.map((item) => item.theme))]
      .map((theme) => [theme, QUESTION_TEMPLATES.filter((item) => item.theme === theme).length])),
  },
  reviewedFacts: getQuestionBankStats(),
  mvpQuestions: { count: MVP_QUESTION_INVENTORY.length, byTheme: inventoryByTheme },
  factsByTemplate: Object.fromEntries(QUESTION_TEMPLATES.filter((template) => template.sourceKind === 'reviewed-facts')
    .map((template) => [template.id, QUESTION_BANK_PACKS.filter((pack) => pack.templateIds.includes(template.id))
      .reduce((sum, pack) => sum + pack.records.filter((record) => record.enabled).length, 0)])),
}, null, 2));

if (errors.length) {
  console.error(`\nUnified question audit failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('\nUnified question audit passed.');
}
