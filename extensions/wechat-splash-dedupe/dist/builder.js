'use strict';

exports.load = function load() {
  console.debug('[wechat-splash-dedupe] Build extension loaded.');
};

exports.unload = function unload() {};

exports.configs = {
  wechatgame: {
    hooks: './hooks',
    options: {
      enabled: {
        label: '移除重复启动图 Base64',
        description: '保留 background.png，并从 settings.json 移除微信运行时未使用的内联副本。',
        default: true,
        render: {
          ui: 'ui-checkbox',
        },
      },
    },
  },
};
