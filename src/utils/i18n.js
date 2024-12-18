import i18next from 'i18next';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Create __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await i18next.init({
    lng: 'en', // default language
    fallbackLng: 'en', // fallback language
    resources: {},
});

// Load language files
export const loadLanguageFiles = () => {
    const localesDir = path.resolve(__dirname, '../locales');
    const languages = fs.readdirSync(localesDir);

    languages.forEach((file) => {
        const lang = path.basename(file, '.json');
        const filePath = path.join(localesDir, file);
        const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        i18next.addResourceBundle(lang, 'translation', translations);
    });
};


export const setLanguage = (lang) => i18next.changeLanguage(lang);
export const getLanguage = () => i18next.language;
export const getResourceBundle = (lang) => i18next.getResourceBundle(lang, 'translation');
export const t = (key, options) => i18next.t(key, options);


loadLanguageFiles();
