const { contextBridge, ipcRenderer } = require('electron');

const additionalArguments = process.argv.filter(arg => arg.startsWith('{') && arg.endsWith('}'));

let translations, appVersion;

additionalArguments.forEach(arg => {
    try {
        const parsed = JSON.parse(arg);
        if (parsed.key === 'translations') {
            translations = parsed.value;
        } else if (parsed.key === 'appVersion') {
            appVersion = parsed.value;
        }
    } catch (error) {
        console.error('Error parsing additionalArguments:', error);
    }
});

contextBridge.exposeInMainWorld('electronAPI', {
    getInitTranslations: () => translations,
    getAppVersion: () => appVersion
});
