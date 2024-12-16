import { app } from 'electron';
import sharp from 'sharp';

export async function cropOnePixel(imageBuffer, x, y) {
    try {
        const metadata = await sharp(imageBuffer).metadata();

        if (x < 0 || y < 0 || x >= metadata.width || y >= metadata.height) {
            throw new Error('Cursor position is out of screenshot bounds');
        }

        const cropX = Math.max(0, x);
        const cropY = Math.max(0, y);

        const croppedBuffer = await sharp(imageBuffer)
            .extract({ left: cropX, top: cropY, width: 1, height: 1 })
            .png()
            .toBuffer();

        return croppedBuffer;
    } catch (err) {
        console.error("Crop failed:", err.message);
        throw err;
    }
}

export function getApiKeyForModel(modelId, LLMList, apiKeys) {
    // 找到对应的 Provider
    const provider = LLMList.find(provider =>
        provider.models.some(model => model.id === modelId)
    );

    // 如果找到对应的 Provider，返回对应的 API Key
    if (provider) {
        const providerId = provider.id;
        return apiKeys[providerId] || null; // 返回 API Key 或 null
    }

    // 如果找不到对应的 Provider，返回 null
    return null;
}

export function getAppLocale() {
    const supportedLocales = {
        'zh-CN': 'zh-CN', // 简体中文
        'zh-TW': 'zh-TW', // 繁体中文
        'en': 'en',       // 英文
    };

    const defaultLocale = 'en';

    const systemLocale = app.getLocale(); // 获取系统语言

    if (systemLocale.startsWith('zh-')) {
        return systemLocale === 'zh-CN' ? 'zh-CN' : 'zh-TW';
    }

    return supportedLocales[systemLocale] || defaultLocale;
}
