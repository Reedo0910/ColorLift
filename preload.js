const { contextBridge, ipcRenderer } = require('electron');

const translations = JSON.parse(process.argv.find((arg) => arg.startsWith('{')) || '{}');

contextBridge.exposeInMainWorld('electronAPI', {
    // Main Window
    startCapture: () => ipcRenderer.send('start-capture'),
    // onUpdateImg: (callback) => ipcRenderer.on('update-img', (_, img) => callback(img)),
    onUpdateColor: (callback) => ipcRenderer.on('update-color', (_, hex) => callback(hex)),
    onChatGPTResponse: (callback) => ipcRenderer.on('chatgpt-response', (_, message) => callback(message)),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status)),
    // Settings
    openSettings: () => ipcRenderer.send('open-settings'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (_, settings) => callback(settings)),
    // Translations
    getInitialTranslations: () => translations,
    getLanguage: () => ipcRenderer.invoke('get-language'),
    setLanguage: (lang) => ipcRenderer.send('set-language', lang),
    // Clipboard APIs
    copyToClipboard: (text) => ipcRenderer.send('copy-to-clipboard', text),
    onCopySuccess: (callback) => ipcRenderer.on('copy-success', (_, message) => callback(message))
});
