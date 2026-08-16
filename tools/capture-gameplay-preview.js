return (async () => {
    const electronModule = require('electron');
    const fileSystem = require('fs');
    const projectPath = Editor.Project.path.replace(/\\/g, '/');
    const outputPath = `${projectPath}/temp/mcp-captures/gameplay-runtime-iphone12.png`;
    const previewWindow = new electronModule.BrowserWindow({
        width: 520,
        height: 980,
        x: -10000,
        y: -10000,
        show: true,
        backgroundColor: '#17112f',
        webPreferences: { backgroundThrottling: false },
    });

    await previewWindow.loadURL('http://127.0.0.1:7456/');
    await new Promise((resolve) => setTimeout(resolve, 16000));
    await previewWindow.webContents.executeJavaScript(`
        (() => {
            try { if (globalThis.cc && cc.profiler) cc.profiler.hideStats(); } catch {}
            const device = document.querySelector(
                '#view-select li[data-device="Apple iPhone 12; 13; 14; 12/13 Pro"]'
            );
            if (device) device.click();
            return true;
        })()
    `);
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const crop = await previewWindow.webContents.executeJavaScript(`
        (() => {
            const canvas = document.querySelector('canvas');
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            return {
                x: Math.max(0, Math.floor(rect.x)),
                y: Math.max(0, Math.floor(rect.y)),
                width: Math.max(1, Math.floor(rect.width)),
                height: Math.max(1, Math.floor(rect.height)),
            };
        })()
    `);
    if (!crop) throw new Error('Preview canvas not found.');

    const screenshot = await previewWindow.webContents.capturePage(crop);
    fileSystem.writeFileSync(outputPath, screenshot.toPNG());
    previewWindow.destroy();
    return { outputPath, crop, bytes: fileSystem.statSync(outputPath).size };
})();
