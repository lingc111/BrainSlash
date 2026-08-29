import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { QUESTION_BANK_PACKS } from '../assets/Scripts/domain/QuestionBankRegistry.ts';

const CONTENT_VERSION = '1.19.0-variety';
const outputDir = join(process.cwd(), 'assets', 'resources', 'question-banks');
const packsById = new Map(QUESTION_BANK_PACKS.map((pack) => [pack.id, pack]));
const byTheme = new Map();

function add(theme, familyKind, id, prompt, answer, distractors, difficulty = 1, source = 'generated-logic') {
  const normalized = [...new Set(distractors.map((value) => typeof value === 'number' ? value : String(value)))].filter((value) => String(value) !== String(answer));
  if (typeof answer === 'number') {
    for (let offset = 1; normalized.length < 3; offset++) {
      const candidate = answer + offset;
      if (candidate !== answer && !normalized.includes(candidate)) normalized.push(candidate);
    }
  }
  if (normalized.length < 3) throw new Error(`${id}: fewer than three unique distractors`);
  const record = { id, theme, familyKind, prompt, answer, distractors: normalized.slice(0, 5), difficulty, source };
  const records = byTheme.get(theme) ?? [];
  records.push(record);
  byTheme.set(theme, records);
}

function numericDistractors(answer, step = 1) {
  return [answer - step * 2, answer - step, answer + step, answer + step * 2, answer + step * 3].filter((value) => value >= 0);
}

function generateMath() {
  const targets = {
    'math-add': 380,
    'math-subtract': 340,
    'math-multiply': 252,
    'math-compare': 260,
    'math-sequence': 380,
    'math-missing': 340,
    'math-equation': 300,
  };
  for (const [kind, count] of Object.entries(targets)) {
    for (let index = 0; index < count; index++) {
      const n = index + 1;
      if (kind === 'math-add') {
        const a = 2 + (n % 97), b = 2 + (Math.floor(n / 7) % 83), c = n % 4 === 0 ? 2 + (n % 9) : 0, answer = a + b + c;
        add('math', kind, `static.math.add.${String(n).padStart(4, '0')}`, c ? `${a}+${b}+${c}=?` : `${a}+${b}=?`, answer, numericDistractors(answer), n < 120 ? 1 : n < 280 ? 2 : 3);
      } else if (kind === 'math-subtract') {
        const answer = 2 + (n % 89), b = 2 + (Math.floor(n / 5) % 71), a = answer + b;
        add('math', kind, `static.math.subtract.${String(n).padStart(4, '0')}`, `${a}-${b}=?`, answer, numericDistractors(answer), n < 110 ? 1 : n < 250 ? 2 : 3);
      } else if (kind === 'math-multiply') {
        const a = 2 + (n % 11), b = 2 + (Math.floor(n / 11) % 11), offset = Math.floor(n / 121);
        const left = a + offset * 11, answer = left * b;
        add('math', kind, `static.math.multiply.${String(n).padStart(4, '0')}`, `${left}×${b}=?`, answer, [answer - b, answer + b, answer - left, answer + left, left + b], n < 80 ? 1 : n < 170 ? 2 : 3);
      } else if (kind === 'math-compare') {
        const values = [7 + n % 91, 9 + (n * 3) % 97, 11 + (n * 7) % 101, 13 + (n * 11) % 103];
        const unique = [...new Set(values)];
        while (unique.length < 4) unique.push(Math.max(...unique) + unique.length + 1);
        const largest = n % 2 === 0, answer = largest ? Math.max(...unique) : Math.min(...unique);
        add('math', kind, `static.math.compare.${String(n).padStart(4, '0')}`, largest ? '选最大值' : '选最小值', answer, unique.filter((value) => value !== answer), n < 90 ? 1 : n < 190 ? 2 : 3);
      } else if (kind === 'math-sequence') {
        const start = 1 + n % 43, step = 2 + Math.floor(n / 43) % 13, answer = start + step * 4;
        add('math', kind, `static.math.sequence.${String(n).padStart(4, '0')}`, `${start},${start + step},${start + step * 2},${start + step * 3},?`, answer, numericDistractors(answer, step), n < 120 ? 1 : n < 280 ? 2 : 3);
      } else if (kind === 'math-missing') {
        const answer = 2 + n % 83, right = 2 + Math.floor(n / 9) % 61;
        const subtract = n % 2 === 0;
        const prompt = subtract ? `( )-${right}=${answer}` : `( )+${right}=${answer + right}`;
        const value = subtract ? answer + right : answer;
        add('math', kind, `static.math.missing.${String(n).padStart(4, '0')}`, prompt, value, numericDistractors(value), n < 110 ? 1 : n < 250 ? 2 : 3);
      } else {
        const target = 20 + n, left = 2 + n % Math.max(3, target - 3), right = Math.max(1, target - left);
        const answer = `${left}+${right}`;
        add('math', kind, `static.math.equation.${String(n).padStart(4, '0')}`, `等于${target}`, answer, [`${left}+${right + 1}`, `${left + 1}+${right + 1}`, `${left}+${Math.max(0, right - 1)}`, `${left + 2}+${right + 1}`], n < 100 ? 1 : n < 220 ? 2 : 3);
      }
    }
  }
}

function generateVision() {
  const arrows = ['↑', '→', '↓', '←'];
  const arrowNames = ['上', '右', '下', '左'];
  const symbols = ['●', '○', '▲', '△', '■', '□', '◆', '◇', '★', '☆'];
  for (let n = 1; n <= 300; n++) {
    let code = n;
    const sequence = [];
    for (let index = 0; index < 5; index++) {
      sequence.push(code % 4);
      code = Math.floor(code / 4);
    }
    const wanted = Math.floor((n - 1) / 60) % 5;
    const answerIndex = sequence[wanted];
    add('vision', 'vision-direction', `static.vision.direction.${String(n).padStart(4, '0')}`, `${sequence.map((index) => arrows[index]).join('')}第${wanted + 1}个`, arrowNames[answerIndex], arrowNames.filter((_, i) => i !== answerIndex), n < 100 ? 1 : n < 220 ? 2 : 3);
  }
  for (let n = 1; n <= 300; n++) {
    const zero = n - 1;
    const symbol = symbols[Math.floor(zero / 30)], left = 1 + (zero % 5), right = 1 + (Math.floor(zero / 5) % 6), answer = left + right;
    add('vision', 'vision-count', `static.vision.count.${String(n).padStart(4, '0')}`, `数一数：${symbol.repeat(left)}·${symbol.repeat(right)}`, answer, numericDistractors(answer), n < 120 ? 1 : 2);
  }
  const patterns = [];
  for (const first of symbols) {
    for (const second of symbols.filter((item) => item !== first)) {
      for (let run = 1; run <= 4; run++) patterns.push({ first, second, run });
    }
  }
  for (let index = 0; index < 400; index++) {
    const { first, second, run } = patterns[index % patterns.length];
    const answer = index < patterns.length ? first : second;
    const prompt = index < patterns.length
      ? `${first}${second.repeat(run)}${first}${second.repeat(run)}?`
      : `${first.repeat(run)}${second}${first.repeat(run)}?`;
    add('vision', 'vision-pattern', `static.vision.pattern.${String(index + 1).padStart(4, '0')}`, prompt, answer, symbols.filter((item) => item !== answer), index < 130 ? 1 : index < 300 ? 2 : 3);
  }
  const triples = [];
  for (const a of symbols) for (const b of symbols) for (const c of symbols) {
    if (a !== b && b !== c && a !== c) triples.push([a, b, c]);
  }
  for (let index = 0; index < 200; index++) {
    const [a, b, c] = triples[index];
    const answer = `${a}${b}${c}`;
    add('vision', 'vision-match', `static.vision.match.${String(index + 1).padStart(4, '0')}`, `找相同 ${answer}`, answer, [`${c}${b}${a}`, `${a}${c}${b}`, `${b}${a}${c}`, `${b}${c}${a}`], index < 80 ? 1 : index < 150 ? 2 : 3);
  }
}

function generateReviewedCatalogRecords() {
  const idioms = packsById.get('hanzi.idioms').records;
  idioms.forEach((entry, index) => {
    const answer = entry.text[entry.missingIndex];
    const prompt = `${entry.text.slice(0, entry.missingIndex)}( )${entry.text.slice(entry.missingIndex + 1)}`;
    add('hanzi', 'hanzi-fill', `static.hanzi.idiom.${String(index + 1).padStart(3, '0')}`, prompt, answer, entry.wrong, 1 + Math.min(2, Math.floor(index / 34)), 'reviewed-catalog');
  });
  for (const packId of ['hanzi.antonyms', 'hanzi.synonyms']) {
    const pack = packsById.get(packId);
    pack.records.forEach((entry) => {
      const label = entry.kind === 'antonym' ? '反义词' : '近义词';
      add('hanzi', pack.familyKinds[0], `static.${entry.id}.lr`, `${entry.left}的${label}`, entry.right, entry.rightDistractors, 2, 'reviewed-catalog');
      add('hanzi', pack.familyKinds[0], `static.${entry.id}.rl`, `${entry.right}的${label}`, entry.left, entry.leftDistractors, 2, 'reviewed-catalog');
    });
  }

  const words = packsById.get('english.words').records;
  words.forEach((word, index) => {
    const sameCategory = words.filter((item) => item.category === word.category && item.en !== word.en);
    const otherEnglish = sameCategory.map((item) => item.en);
    const otherChinese = sameCategory.map((item) => item.zh);
    add('english', 'english-meaning', `static.english.word.${String(index + 1).padStart(3, '0')}.ez`, `${word.en}是？`, word.zh, otherChinese, 1, 'reviewed-catalog');
    add('english', 'english-meaning', `static.english.word.${String(index + 1).padStart(3, '0')}.ze`, `${word.zh}的英文`, word.en, otherEnglish, 2, 'reviewed-catalog');
  });
  packsById.get('english.antonyms').records.forEach(([left, right], index) => {
    const pool = packsById.get('english.antonyms').records.flat();
    add('english', 'english-antonym', `static.english.antonym.${String(index + 1).padStart(3, '0')}.lr`, `${left}的反义词`, right, pool.filter((item) => item !== left && item !== right), 2, 'reviewed-catalog');
    add('english', 'english-antonym', `static.english.antonym.${String(index + 1).padStart(3, '0')}.rl`, `${right}的反义词`, left, pool.filter((item) => item !== left && item !== right), 2, 'reviewed-catalog');
  });
  for (let index = 0; index < 28; index++) {
    const word = words[index];
    const others = words.filter((item) => item.category !== word.category).map((item) => item.category);
    add('english', 'english-category', `static.english.category.${String(index + 1).padStart(3, '0')}`, `${word.en}属于`, word.category, others, 1, 'reviewed-catalog');
  }

  const life = packsById.get('life.categories').records;
  for (let variant = 0; variant < 5; variant++) {
    life.forEach((fact, index) => {
      const distractors = life.filter((item) => item.category !== fact.category).map((item) => item.item);
      add('life', 'life-category', `static.life.${String(index + 1).padStart(3, '0')}.v${variant + 1}`, `选择${fact.category}`, fact.item, rotate(distractors, index + variant * 7), 1 + Math.min(2, variant), 'reviewed-catalog');
    });
  }

  const geography = packsById.get('geography.world').records;
  geography.forEach((fact, index) => {
    add('geography', 'geography-capital', `static.geography.${String(index + 1).padStart(3, '0')}.capital`, `${fact.country}首都`, fact.capital, geography.filter((item) => item !== fact).map((item) => item.capital), 2, 'reviewed-catalog');
    add('geography', 'geography-country', `static.geography.${String(index + 1).padStart(3, '0')}.country`, `${fact.capital}在哪国`, fact.country, geography.filter((item) => item !== fact).map((item) => item.country), 2, 'reviewed-catalog');
  });

  for (const pack of QUESTION_BANK_PACKS.filter((item) => item.theme === 'knowledge' || item.theme === 'history')) {
    pack.records.forEach((fact, index) => {
      add(pack.theme, pack.familyKinds[0], `static.${pack.id}.${String(index + 1).padStart(3, '0')}`, fact.prompt, fact.answer, fact.wrong, 2, 'reviewed-catalog');
    });
  }
}

function rotate(values, offset) {
  if (!values.length) return values;
  const start = offset % values.length;
  return [...values.slice(start), ...values.slice(0, start)];
}

function uuidFor(name) {
  const hex = createHash('sha256').update(`brain-slash:${name}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

async function writeJsonAsset(name, value) {
  const path = join(outputDir, `${name}.json`);
  await writeFile(path, `${JSON.stringify(value)}\n`, 'utf8');
  const meta = { ver: '1.0.0', importer: 'json', imported: true, uuid: uuidFor(name), files: ['.json'], subMetas: {}, userData: {} };
  await writeFile(`${path}.meta`, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

await mkdir(outputDir, { recursive: true });
generateMath();
generateVision();
generateReviewedCatalogRecords();

const themes = ['math', 'vision', 'hanzi', 'english', 'life', 'geography', 'knowledge', 'history'];
const counts = Object.fromEntries(themes.map((theme) => [theme, byTheme.get(theme)?.length ?? 0]));
const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
if (total !== 5_000) throw new Error(`Expected 5000 records, generated ${total}: ${JSON.stringify(counts)}`);

for (const theme of themes) {
  await writeJsonAsset(theme, { schemaVersion: 1, contentVersion: CONTENT_VERSION, theme, records: byTheme.get(theme) });
}
await writeJsonAsset('manifest', {
  schemaVersion: 1,
  contentVersion: CONTENT_VERSION,
  bundle: 'resources',
  subpackagePath: 'question-banks',
  totalRecords: total,
  counts,
  packs: themes.map((theme) => ({ theme, file: `${theme}.json`, records: counts[theme] })),
});
console.log(JSON.stringify({ contentVersion: CONTENT_VERSION, totalRecords: total, counts }, null, 2));
