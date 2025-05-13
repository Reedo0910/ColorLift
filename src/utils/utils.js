import { app } from 'electron';
import sharp from 'sharp';

export async function cropOnePixel(imageBuffer, x, y) {
    try {
        const metadata = await sharp(imageBuffer).metadata();

        if (x < 0 || y < 0 || x >= metadata.width || y >= metadata.height) {
            throw new Error(`Cursor position (${x}, ${y}) is out of screenshot range: ${metadata.width}x${metadata.height}.`);
        }

        const croppedBuffer = await sharp(imageBuffer)
            .extract({ left: x, top: y, width: 1, height: 1 })
            .png()
            .toBuffer();

        return croppedBuffer;
    } catch (err) {
        console.error("Crop failed:", { x, y, error: err.message });
        throw err;
    }
}

export function getApiKeyForModel(modelId, LLMList, apiKeys) {
    // Custom Model ID
    if (modelId.startsWith('custom@')) {
        return apiKeys['custom'] || null;
    }

    // Find corresponding Provider by modelId
    const provider = LLMList.find(provider =>
        provider.models.some(model => model.id === modelId)
    );

    // Return the corresponding API Key if the matching Provider is found
    if (provider) {
        const providerId = provider.id;
        return apiKeys[providerId] || null;
    }

    return null;
}

export function getAppLocale() {
    const supportedLocales = {
        'zh-CN': 'zh-CN', // Simplified Chinese
        'zh-TW': 'zh-TW', // Traditional Chinese
        'en': 'en',       // English
    };

    const defaultLocale = 'en';

    const systemLanguage = app.getPreferredSystemLanguages()[0] || app.getLocale(); // Get current system language (locale)

    if (systemLanguage.startsWith('zh-')) {
        if (systemLanguage.includes('Hans')) {
            return 'zh-CN';
        } else if (systemLanguage.includes('Hant')) {
            return 'zh-TW';
        }

        // Fallback
        return systemLanguage.startsWith('zh-CN') ? 'zh-CN' : 'zh-TW';
    }

    return supportedLocales[systemLanguage] || defaultLocale;
}
