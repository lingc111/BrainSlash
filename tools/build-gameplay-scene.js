// Rebuilds the hand-drawn Gameplay scene through Funplay Cocos MCP's scene context.
// GameplayHUD owns the real hierarchy so editor and runtime always stay in sync.

return (() => {
    const page = cc.find('Canvas/GameplayPage');
    const gameplayHUDClass = cc.js.getClassByName('GameplayHUD');
    const hud = page && gameplayHUDClass ? page.getComponent(gameplayHUDClass) : null;
    if (!page || !hud) throw new Error('GameplayPage or GameplayHUD is unavailable.');

    hud.rebuildGameplay();

    const editorCamera = cc.find('Editor Scene Background/Editor Camera');
    if (editorCamera) {
        editorCamera.setPosition(375, 812, 5000);
        const camera = editorCamera.getComponent(cc.Camera);
        if (camera) camera.orthoHeight = 900;
    }

    const safeRoot = page.getChildByName('SafeAreaRoot');
    const targets = cc.find('Canvas/GameplayPage/SafeAreaRoot/GameplayLayer/TargetContainer');
    return {
        scene: cc.director.getScene()?.name,
        root: safeRoot?.name,
        targetCount: targets?.children.length ?? 0,
        rule: '反向 + 多目标',
        chaos: '78%',
    };
})();
