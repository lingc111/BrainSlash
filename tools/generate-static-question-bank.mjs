import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { QUESTION_BANK_PACKS } from '../assets/Scripts/domain/QuestionBankRegistry.ts';

const CONTENT_VERSION = '1.20.0-8k-variety';
const EXPECTED_RECORDS = 8_000;
const outputDir = join(process.cwd(), 'assets', 'resources', 'question-banks');
const packsById = new Map(QUESTION_BANK_PACKS.map((pack) => [pack.id, pack]));
const byTheme = new Map();
const semanticKeys = new Set();

function add(theme, familyKind, id, prompt, answer, distractors, difficulty = 1, source = 'generated-logic') {
  const semanticKey = `${familyKind}|${String(prompt).replace(/\s+/g, '')}|${String(answer).replace(/\s+/g, '')}`;
  if (semanticKeys.has(semanticKey)) throw new Error(`${id}: duplicate semantic question ${semanticKey}`);
  semanticKeys.add(semanticKey);
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
    'math-add': 700,
    'math-subtract': 650,
    'math-multiply': 500,
    'math-compare': 500,
    'math-sequence': 650,
    'math-missing': 600,
    'math-equation': 582,
  };
  const additionPairs = [];
  const multiplicationPairs = [];
  for (let left = 2; additionPairs.length < targets['math-add']; left++) {
    for (let right = left; right <= 120 && additionPairs.length < targets['math-add']; right++) additionPairs.push([left, right]);
  }
  for (let left = 2; multiplicationPairs.length < targets['math-multiply']; left++) {
    for (let right = left; right <= 45 && multiplicationPairs.length < targets['math-multiply']; right++) multiplicationPairs.push([left, right]);
  }
  for (const [kind, count] of Object.entries(targets)) {
    for (let index = 0; index < count; index++) {
      const n = index + 1;
      if (kind === 'math-add') {
        const [a, b] = additionPairs[index], answer = a + b;
        add('math', kind, `static.math.add.${String(n).padStart(4, '0')}`, `${a}+${b}=?`, answer, numericDistractors(answer), n <= 230 ? 1 : n <= 470 ? 2 : 3);
      } else if (kind === 'math-subtract') {
        const answer = 2 + (index % 100), b = 2 + Math.floor(index / 100), a = answer + b;
        add('math', kind, `static.math.subtract.${String(n).padStart(4, '0')}`, `${a}-${b}=?`, answer, numericDistractors(answer), n <= 215 ? 1 : n <= 435 ? 2 : 3);
      } else if (kind === 'math-multiply') {
        const [left, right] = multiplicationPairs[index], answer = left * right;
        add('math', kind, `static.math.multiply.${String(n).padStart(4, '0')}`, `${left}×${right}=?`, answer, [answer - right, answer + right, answer - left, answer + left, left + right], n <= 165 ? 1 : n <= 335 ? 2 : 3);
      } else if (kind === 'math-compare') {
        const largest = n % 2 === 0;
        const answer = largest ? 100 + n : 10 + n;
        const offsets = [2 + n % 3, 7 + n % 5, 13 + n % 7];
        const values = largest ? offsets.map((offset) => answer - offset) : offsets.map((offset) => answer + offset);
        const labels = largest ? ['选最大值', '找最大数', '数值最大', '最大的数', '斩最大值'] : ['选最小值', '找最小数', '数值最小', '最小的数', '斩最小值'];
        add('math', kind, `static.math.compare.${String(n).padStart(4, '0')}`, labels[index % labels.length], answer, values, n <= 165 ? 1 : n <= 335 ? 2 : 3);
      } else if (kind === 'math-sequence') {
        const start = 1 + index % 50, step = 2 + Math.floor(index / 50), answer = start + step * 4;
        add('math', kind, `static.math.sequence.${String(n).padStart(4, '0')}`, `${start},${start + step},${start + step * 2},${start + step * 3},?`, answer, numericDistractors(answer, step), n <= 215 ? 1 : n <= 435 ? 2 : 3);
      } else if (kind === 'math-missing') {
        const pair = Math.floor(index / 2), answer = 2 + pair % 100, right = 2 + Math.floor(pair / 100);
        const subtract = index % 2 === 0;
        const prompt = subtract ? `( )-${right}=${answer}` : `( )+${right}=${answer + right}`;
        const value = subtract ? answer + right : answer;
        add('math', kind, `static.math.missing.${String(n).padStart(4, '0')}`, prompt, value, numericDistractors(value), n <= 200 ? 1 : n <= 400 ? 2 : 3);
      } else {
        const target = 20 + n, left = 2 + n % Math.max(3, target - 3), right = Math.max(1, target - left);
        const answer = `${left}+${right}`;
        add('math', kind, `static.math.equation.${String(n).padStart(4, '0')}`, `等于${target}`, answer, [`${left}+${right + 1}`, `${left + 1}+${right + 1}`, `${left}+${Math.max(0, right - 1)}`, `${left + 2}+${right + 1}`], n <= 190 ? 1 : n <= 390 ? 2 : 3);
      }
    }
  }
}

function generateVision() {
  const arrows = ['↑', '→', '↓', '←'];
  const arrowNames = ['上', '右', '下', '左'];
  const symbols = ['●', '○', '▲', '△', '■', '□', '◆', '◇', '★', '☆'];
  for (let n = 1; n <= 500; n++) {
    let code = n;
    const sequence = [];
    for (let index = 0; index < 5; index++) {
      sequence.push(code % 4);
      code = Math.floor(code / 4);
    }
    const wanted = Math.floor((n - 1) / 100) % 5;
    const answerIndex = sequence[wanted];
    add('vision', 'vision-direction', `static.vision.direction.${String(n).padStart(4, '0')}`, `${sequence.map((index) => arrows[index]).join('')}第${wanted + 1}个`, arrowNames[answerIndex], arrowNames.filter((_, i) => i !== answerIndex), n <= 165 ? 1 : n <= 335 ? 2 : 3);
  }
  for (let n = 1; n <= 500; n++) {
    const zero = n - 1;
    const symbol = symbols[Math.floor(zero / 100)], left = 1 + zero % 10, right = 1 + Math.floor(zero / 10) % 10, answer = left + right;
    add('vision', 'vision-count', `static.vision.count.${String(n).padStart(4, '0')}`, `数一数：${symbol.repeat(left)}·${symbol.repeat(right)}`, answer, numericDistractors(answer), n <= 200 ? 1 : n <= 400 ? 2 : 3);
  }
  const patterns = [];
  for (const first of symbols) {
    for (const second of symbols.filter((item) => item !== first)) {
      for (let run = 1; run <= 4; run++) patterns.push({ first, second, run });
    }
  }
  for (let index = 0; index < 600; index++) {
    const { first, second, run } = patterns[index % patterns.length];
    const answer = index < patterns.length ? first : second;
    const prompt = index < patterns.length
      ? `${first}${second.repeat(run)}${first}${second.repeat(run)}?`
      : `${first.repeat(run)}${second}${first.repeat(run)}?`;
    add('vision', 'vision-pattern', `static.vision.pattern.${String(index + 1).padStart(4, '0')}`, prompt, answer, symbols.filter((item) => item !== answer), index < 200 ? 1 : index < 400 ? 2 : 3);
  }
  const triples = [];
  for (const a of symbols) for (const b of symbols) for (const c of symbols) {
    if (a !== b && b !== c && a !== c) triples.push([a, b, c]);
  }
  for (let index = 0; index < 400; index++) {
    const [a, b, c] = triples[index];
    const answer = `${a}${b}${c}`;
    add('vision', 'vision-match', `static.vision.match.${String(index + 1).padStart(4, '0')}`, `找相同 ${answer}`, answer, [`${c}${b}${a}`, `${a}${c}${b}`, `${b}${a}${c}`, `${b}${c}${a}`], index < 135 ? 1 : index < 270 ? 2 : 3);
  }
}

function generateReviewedCatalogRecords() {
  const idioms = packsById.get('hanzi.idioms').records;
  idioms.forEach((entry, index) => {
    const answer = entry.text[entry.missingIndex];
    const prompt = `${entry.text.slice(0, entry.missingIndex)}( )${entry.text.slice(entry.missingIndex + 1)}`;
    add('hanzi', 'hanzi-fill', `static.hanzi.idiom.${String(index + 1).padStart(3, '0')}`, prompt, answer, entry.wrong, 1 + Math.min(2, Math.floor(index / 34)), 'reviewed-catalog');
  });
  idioms.forEach((entry, index) => {
    const missingIndex = (entry.missingIndex + 1) % entry.text.length;
    const answer = entry.text[missingIndex];
    const prompt = `${entry.text.slice(0, missingIndex)}( )${entry.text.slice(missingIndex + 1)}`;
    const distractors = [...entry.wrong, entry.text[entry.missingIndex], '未', '误'].filter((value) => value !== answer);
    add('hanzi', 'hanzi-fill', `static.hanzi.idiom.${String(index + 1).padStart(3, '0')}.alt`, prompt, answer, distractors, 2, 'reviewed-catalog');
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
  words.forEach((word, index) => {
    const others = words.filter((item) => item.category !== word.category).map((item) => item.category);
    add('english', 'english-category', `static.english.category.${String(index + 1).padStart(3, '0')}`, `${word.en}属于`, word.category, others, 1, 'reviewed-catalog');
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((letter) => letter !== word.en[0]);
    add('english', 'english-meaning', `static.english.first-letter.${String(index + 1).padStart(3, '0')}`, `${word.en}首字母`, word.en[0], rotate(letters, index), 1, 'reviewed-catalog');
    add('english', 'english-meaning', `static.english.length.${String(index + 1).padStart(3, '0')}`, `${word.en}有几字母`, word.en.length, numericDistractors(word.en.length), 2, 'reviewed-catalog');
  });

  const life = packsById.get('life.categories').records;
  life.forEach((fact, index) => {
    const itemDistractors = life.filter((item) => item.category !== fact.category).map((item) => item.item);
    const categoryDistractors = [...new Set(life.filter((item) => item.category !== fact.category).map((item) => item.category))];
    add('life', 'life-category', `static.life.${String(index + 1).padStart(3, '0')}.item`, `选择${fact.category}`, fact.item, rotate(itemDistractors, index), 1, 'reviewed-catalog');
    add('life', 'life-category', `static.life.${String(index + 1).padStart(3, '0')}.category`, `${fact.item}属于`, fact.category, rotate(categoryDistractors, index), 2, 'reviewed-catalog');
  });

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
  const meta = { ver: '2.0.1', importer: 'json', imported: true, uuid: uuidFor(name), files: ['.json'], subMetas: {}, userData: {} };
  await writeFile(`${path}.meta`, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

await mkdir(outputDir, { recursive: true });
generateMath();
generateVision();
generateReviewedCatalogRecords();

const themes = ['math', 'vision', 'hanzi', 'english', 'life', 'geography', 'knowledge', 'history'];
const counts = Object.fromEntries(themes.map((theme) => [theme, byTheme.get(theme)?.length ?? 0]));
const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
if (total !== EXPECTED_RECORDS) throw new Error(`Expected ${EXPECTED_RECORDS} records, generated ${total}: ${JSON.stringify(counts)}`);

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
