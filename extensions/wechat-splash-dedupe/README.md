# WeChat Splash Dedupe

Cocos Creator 3.8 writes a custom splash image to both `background.png` and
`src/settings.json`. The WeChat first-screen template loads `background.png`
directly, so the Base64 copy unnecessarily increases the main package size.

This build extension runs only for `wechatgame`. After a successful build it
checks that the expected runtime splash files exist, then removes only
`splashScreen.background.base64` from the generated settings file.

The WeChat build panel exposes an **移除重复启动图 Base64** checkbox. It is
enabled by default.

Enable **WeChat Splash Dedupe** under **Extension > Extension Manager > Project**
after adding or updating the extension. Reload it after changing the hook.
