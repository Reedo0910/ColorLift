const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Main Window
    startCapture: () => ipcRenderer.send('start-capture'),
    onUpdateColor: (callback) => ipcRenderer.on('update-color', (_, hex) => callback(hex)),
    onUpdateImg: (callback) => ipcRenderer.on('update-img', (_, img) => callback(img)),
    onChatGPTResponse: (callback) => ipcRenderer.on('chatgpt-response', (_, message) => callback(message)),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_, status) => callback(status)),
    // Settings
    openSettings: () => ipcRenderer.send('open-settings'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (_, settings) => callback(settings)),
});
