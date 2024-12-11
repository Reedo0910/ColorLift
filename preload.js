const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onUpdateColor: (callback) => ipcRenderer.on('update-color', (_, hex) => callback(hex)),
    onUpdateImg: (callback) => ipcRenderer.on('update-img', (_, img) => callback(img)),
    onChatGPTResponse: (callback) => ipcRenderer.on('chatgpt-response', (_, message) => callback(message)),
});
