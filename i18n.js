import i18next from 'i18next';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 创建 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化 i18next
await i18next.init({
    lng: 'en', // 默认语言
    fallbackLng: 'en', // 回退语言
    resources: {}, // 初始资源为空
});

// 加载语言文件
export const loadLanguageFiles = () => {
    const localesDir = path.resolve(__dirname, 'locales');
    const languages = fs.readdirSync(localesDir);

    languages.forEach((file) => {
        const lang = path.basename(file, '.json'); // 获取语言代码
        const filePath = path.join(localesDir, file);
        const translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        i18next.addResourceBundle(lang, 'translation', translations);
    });
};

// 导出翻译方法
export const setLanguage = (lang) => i18next.changeLanguage(lang);
export const getLanguage = () => i18next.language;
export const getResourceBundle = (lang) => i18next.getResourceBundle(lang, 'translation');

// 加载语言文件
loadLanguageFiles();
