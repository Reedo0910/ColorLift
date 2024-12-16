const { contextBridge, ipcRenderer } = require('electron');

const translations = JSON.parse(process.argv.find((arg) => arg.startsWith('{')) || '{}');

contextBridge.exposeInMainWorld('electronAPI', {
    // Main Window
    startCapture: () => ipcRenderer.send('start-capture'),
    stopCapture: () => ipcRenderer.send('stop-capture'),
    // onUpdateImg: (callback) => ipcRenderer.on('update-img', (_, img) => callback(img)),
    onUpdateColor: (callback) => ipcRenderer.on('update-color', (_, hex) => callback(hex)),
    onChatGPTResponse: (callback) => ipcRenderer.on('chatgpt-response', (_, message) => callback(message)),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status)),
    // Settings
    openSettings: () => ipcRenderer.send('open-settings'),
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (_, settings) => callback(settings)),
    onColorPickShortcut: (callback) => ipcRenderer.once('color-pick-shortcut', (_, shortcut) => callback(shortcut)),
    // Translations
    getInitialTranslations: () => translations,
    onTranslationsUpdated: (callback) => ipcRenderer.on('translations-update', (_, translations) => callback(translations)),
    // Clipboard APIs
    copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
    // onCopySuccess: (callback) => ipcRenderer.on('copy-success', (_, message) => callback(message))
});
