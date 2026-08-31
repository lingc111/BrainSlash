import { readFileSync, writeFileSync } from 'node:fs';

const [inputPath, family = 'BrainSlashRank'] = process.argv.slice(2);
if (!inputPath) throw new Error('Usage: node tools/normalize-ttf-names.mjs <font.ttf> [family]');
if (!/^[A-Za-z0-9]+$/.test(family)) throw new Error('Font family must contain only ASCII letters and digits');

const font = readFileSync(inputPath);
const tableCount = font.readUInt16BE(4);
const tables = new Map();
for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    const tag = font.toString('ascii', recordOffset, recordOffset + 4);
    tables.set(tag, {
        recordOffset,
        offset: font.readUInt32BE(recordOffset + 8),
        length: font.readUInt32BE(recordOffset + 12),
    });
}

const name = tables.get('name');
const head = tables.get('head');
if (!name || !head) throw new Error('Font is missing a name or head table');

const encodedFamily = Buffer.alloc(family.length * 2);
for (let index = 0; index < family.length; index += 1) encodedFamily.writeUInt16BE(family.charCodeAt(index), index * 2);

const nameRecordCount = font.readUInt16BE(name.offset + 2);
const stringStorageOffset = name.offset + font.readUInt16BE(name.offset + 4);
let changed = 0;
for (let index = 0; index < nameRecordCount; index += 1) {
    const recordOffset = name.offset + 6 + index * 12;
    const platformId = font.readUInt16BE(recordOffset);
    const nameId = font.readUInt16BE(recordOffset + 6);
    if (platformId !== 3 || ![1, 4, 6].includes(nameId)) continue;
    const oldLength = font.readUInt16BE(recordOffset + 8);
    if (encodedFamily.length > oldLength) throw new Error(`Replacement is too long for name ID ${nameId}`);
    const valueOffset = stringStorageOffset + font.readUInt16BE(recordOffset + 10);
    font.fill(0, valueOffset, valueOffset + oldLength);
    encodedFamily.copy(font, valueOffset);
    font.writeUInt16BE(encodedFamily.length, recordOffset + 8);
    changed += 1;
}
if (changed < 3) throw new Error(`Expected family, full, and PostScript names; changed ${changed}`);

const checksum = (offset, length) => {
    let sum = 0;
    for (let cursor = 0; cursor < length; cursor += 4) {
        let value = 0;
        for (let byte = 0; byte < 4; byte += 1) value = (value << 8) | (font[offset + cursor + byte] ?? 0);
        sum = (sum + (value >>> 0)) >>> 0;
    }
    return sum;
};

font.writeUInt32BE(checksum(name.offset, name.length), name.recordOffset + 4);
font.writeUInt32BE(0, head.offset + 8);
font.writeUInt32BE(checksum(head.offset, head.length), head.recordOffset + 4);
const adjustment = (0xB1B0AFBA - checksum(0, font.length)) >>> 0;
font.writeUInt32BE(adjustment, head.offset + 8);

writeFileSync(inputPath, font);
console.log(`Normalized ${inputPath} to ${family}`);
