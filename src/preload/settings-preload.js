const { contextBridge, ipcRenderer } = require('electron');

const additionalArguments = process.argv.filter(arg => arg.startsWith('{') && arg.endsWith('}'));

let translations, LLMList;

additionalArguments.forEach(arg => {
    try {
        const parsed = JSON.parse(arg);
        if (parsed.key === 'translations') {
            translations = parsed.value;
        } else if (parsed.key === 'LLMList') {
            LLMList = parsed.value;
        }
    } catch (error) {
        console.error('Error parsing additionalArguments:', error);
    }
});

console.log(translations);
console.log(LLMList);


contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    getInitialTranslations: () => translations,
    getLLMList: () => LLMList,
    setLanguage: (lang) => ipcRenderer.send('set-language', lang),
    setColorPickShortcut: (shortcut) => ipcRenderer.invoke('set-color-pick-shortcut', shortcut),
});
