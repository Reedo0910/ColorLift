const { contextBridge, ipcRenderer } = require('electron');

const additionalArguments = process.argv.filter(arg => arg.startsWith('{') && arg.endsWith('}'));

let translations, LLMList, ReqTypeList, isMac;

additionalArguments.forEach(arg => {
    try {
        const parsed = JSON.parse(arg);
        if (parsed.key === 'translations') {
            translations = parsed.value;
        } else if (parsed.key === 'LLMList') {
            LLMList = parsed.value;
        } else if (parsed.key === 'ReqTypeList') {
            ReqTypeList = parsed.value;
        } else if (parsed.key === 'isMac') {
            isMac = parsed.value;
        }
    } catch (error) {
        console.error('Error parsing additionalArguments:', error);
    }
});

contextBridge.exposeInMainWorld('electronAPI', {
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
    getInitTranslations: () => translations,
    getInitLLMList: () => LLMList,
    getInitReqTypeList: () => ReqTypeList,
    setLanguage: (lang) => ipcRenderer.send('set-language', lang),
    setColorPickShortcut: (shortcut) => ipcRenderer.invoke('set-color-pick-shortcut', shortcut),
    // Other var
    isMacOS: () => isMac
});
