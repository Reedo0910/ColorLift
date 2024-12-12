const { contextBridge, ipcRenderer } = require('electron');

const translations = JSON.parse(process.argv.find((arg) => arg.startsWith('{')) || '{}');

contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    getInitialTranslations: () => translations,
    getLanguage: () => ipcRenderer.invoke('get-language'),
    setLanguage: (lang) => ipcRenderer.send('set-language', lang),
});
