const { contextBridge, ipcRenderer } = require('electron');

const additionalArguments = process.argv.filter(arg => arg.startsWith('{') && arg.endsWith('}'));

let translations, colorPickShortcut, initTheme;

additionalArguments.forEach(arg => {
    try {
        const parsed = JSON.parse(arg);
        if (parsed.key === 'translations') {
            translations = parsed.value;
        } else if (parsed.key === 'colorPickShortcut') {
            colorPickShortcut = parsed.value;
        } else if (parsed.key === 'initTheme') {
            initTheme = parsed.value;
        }
    } catch (error) {
        console.error('Error parsing additionalArguments:', error);
    }
});

contextBridge.exposeInMainWorld('electronAPI', {
    // Main Window
    startCapture: () => ipcRenderer.send('start-capture'),
    stopCapture: () => ipcRenderer.send('stop-capture'),
    onUpdateColor: (callback) => ipcRenderer.on('update-color', (_, hex) => callback(hex)),
    onLLMResponse: (callback) => ipcRenderer.on('llm-response', (_, message) => callback(message)),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status)),
    //About
    openAbout: () => ipcRenderer.send('open-about'),
    // Settings
    openSettings: () => ipcRenderer.send('open-settings'),
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (_, settings) => callback(settings)),
    getInitColorPickShortcut: () => colorPickShortcut,
    getInitTheme: () => initTheme,
    // Translations
    getInitTranslations: () => translations,
    onTranslationsUpdated: (callback) => ipcRenderer.on('translations-update', (_, translations) => callback(translations)),
    // Clipboard APIs
    copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
    // onCopySuccess: (callback) => ipcRenderer.on('copy-success', (_, message) => callback(message))
});
