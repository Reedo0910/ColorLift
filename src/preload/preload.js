const { contextBridge, ipcRenderer } = require('electron');

const additionalArguments = process.argv.filter(arg => arg.startsWith('{') && arg.endsWith('}'));

let translations, colorPickShortcut, initTheme, isMac, colorFormat;

additionalArguments.forEach(arg => {
    try {
        const parsed = JSON.parse(arg);
        if (parsed.key === 'translations') {
            translations = parsed.value;
        } else if (parsed.key === 'colorPickShortcut') {
            colorPickShortcut = parsed.value;
        } else if (parsed.key === 'initTheme') {
            initTheme = parsed.value;
        } else if (parsed.key === 'isMac') {
            isMac = parsed.value;
        } else if (parsed.key === 'colorFormat') {
            colorFormat = parsed.value;
        }
    } catch (error) {
        console.error('Error parsing additionalArguments:', error);
    }
});

contextBridge.exposeInMainWorld('electronAPI', {
    // Main Window
    startCapture: () => ipcRenderer.send('start-capture'),
    stopCapture: () => ipcRenderer.send('stop-capture'),
    onUpdateColor: (callback) => ipcRenderer.on('update-color', (_, colorObj) => callback(colorObj)),
    onLLMResponse: (callback) => ipcRenderer.on('llm-response', (_, message) => callback(message)),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status)),
    // About
    openAbout: () => ipcRenderer.send('open-about'),
    // Settings
    openSettings: () => ipcRenderer.send('open-settings'),
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (_, settings) => callback(settings)),
    getInitColorPickShortcut: () => colorPickShortcut,
    getInitTheme: () => initTheme,
    getInitColorFormat: () => colorFormat,
    // Translations
    getInitTranslations: () => translations,
    onTranslationsUpdated: (callback) => ipcRenderer.on('translations-update', (_, translations) => callback(translations)),
    // Clipboard APIs
    copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
    // Other var
    isMacOS: () => isMac
});
