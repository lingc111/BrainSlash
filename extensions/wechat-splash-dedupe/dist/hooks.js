'use strict';

const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = 'wechat-splash-dedupe';

exports.throwError = true;

function getBuildDirectory(result) {
  return result && result.paths && result.paths.dir;
}

function removeInlineSplash(settingsPath) {
  const source = fs.readFileSync(settingsPath, 'utf8');
  const settings = JSON.parse(source);
  const background = settings.splashScreen && settings.splashScreen.background;

  if (!background || typeof background.base64 !== 'string') {
    return 0;
  }

  const removedBytes = Buffer.byteLength(JSON.stringify(background.base64), 'utf8');
  delete background.base64;
  fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');
  return removedBytes;
}

exports.onAfterBuild = async function onAfterBuild(options, result) {
  const packageOptions = options && options.packages && options.packages[PACKAGE_NAME];
  if (packageOptions && packageOptions.enabled === false) {
    return;
  }

  const buildDirectory = getBuildDirectory(result);
  if (!buildDirectory) {
    throw new Error('[wechat-splash-dedupe] Missing build output directory.');
  }

  const settingsPath = path.join(buildDirectory, 'src', 'settings.json');
  const backgroundPath = path.join(buildDirectory, 'background.png');
  const firstScreenPath = path.join(buildDirectory, 'first-screen.js');

  if (!fs.existsSync(settingsPath)) {
    throw new Error(`[wechat-splash-dedupe] Missing settings file: ${settingsPath}`);
  }

  // The WeChat first-screen template loads this physical image directly. Only
  // strip the inline copy after verifying that the runtime files are present.
  if (!fs.existsSync(backgroundPath) || !fs.existsSync(firstScreenPath)) {
    console.warn('[wechat-splash-dedupe] Runtime splash files not found; inline image was kept.');
    return;
  }

  const firstScreenSource = fs.readFileSync(firstScreenPath, 'utf8');
  if (!firstScreenSource.includes("bgName = 'background.png'")) {
    console.warn('[wechat-splash-dedupe] Unknown first-screen template; inline image was kept.');
    return;
  }

  const removedBytes = removeInlineSplash(settingsPath);
  if (removedBytes > 0) {
    console.info(
      `[wechat-splash-dedupe] Removed ${(removedBytes / 1024).toFixed(2)} KB of redundant splash data.`,
    );
  }
};

exports.__test__ = {
  removeInlineSplash,
};
