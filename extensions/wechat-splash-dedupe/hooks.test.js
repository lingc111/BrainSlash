'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const hooks = require('./dist/hooks');

test('removes only the redundant inline WeChat splash image', async () => {
  const buildDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-splash-dedupe-'));

  try {
    const sourceDirectory = path.join(buildDirectory, 'src');
    fs.mkdirSync(sourceDirectory);
    fs.writeFileSync(path.join(buildDirectory, 'background.png'), 'fixture');
    fs.writeFileSync(
      path.join(buildDirectory, 'first-screen.js'),
      "let bgName = 'background.png';",
    );
    fs.writeFileSync(
      path.join(sourceDirectory, 'settings.json'),
      JSON.stringify({
        engine: { debug: false },
        splashScreen: {
          background: {
            type: 'custom',
            base64: 'data:image/png;base64,fixture',
            image: '..\\..\\background.png',
          },
        },
      }),
    );

    await hooks.onAfterBuild({}, { paths: { dir: buildDirectory } });

    const settings = JSON.parse(
      fs.readFileSync(path.join(sourceDirectory, 'settings.json'), 'utf8'),
    );
    assert.deepEqual(settings.engine, { debug: false });
    assert.deepEqual(settings.splashScreen.background, {
      type: 'custom',
      image: '..\\..\\background.png',
    });
  } finally {
    fs.rmSync(buildDirectory, { recursive: true, force: true });
  }
});

test('keeps inline data when the WeChat first-screen template is unknown', async () => {
  const buildDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-splash-dedupe-'));

  try {
    const sourceDirectory = path.join(buildDirectory, 'src');
    fs.mkdirSync(sourceDirectory);
    fs.writeFileSync(path.join(buildDirectory, 'background.png'), 'fixture');
    fs.writeFileSync(path.join(buildDirectory, 'first-screen.js'), 'new template');
    fs.writeFileSync(
      path.join(sourceDirectory, 'settings.json'),
      JSON.stringify({
        splashScreen: { background: { base64: 'keep-me' } },
      }),
    );

    await hooks.onAfterBuild({}, { paths: { dir: buildDirectory } });

    const settings = JSON.parse(
      fs.readFileSync(path.join(sourceDirectory, 'settings.json'), 'utf8'),
    );
    assert.equal(settings.splashScreen.background.base64, 'keep-me');
  } finally {
    fs.rmSync(buildDirectory, { recursive: true, force: true });
  }
});
