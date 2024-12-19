import { app, screen } from 'electron';
import sharp from 'sharp';

export async function cropOnePixel(imageBuffer, x, y) {
    try {
        // adapt to retina
        const primaryDisplay = screen.getPrimaryDisplay();
        const devicePixelRatio = primaryDisplay.scaleFactor;

        // convert to physic pixel
        const physicalX = Math.floor(x * devicePixelRatio);
        const physicalY = Math.floor(y * devicePixelRatio);

        const metadata = await sharp(imageBuffer).metadata();

        if (
            physicalX < 0 || physicalY < 0 ||
            physicalX >= metadata.width || physicalY >= metadata.height
        ) {
            throw new Error(`Cursor position (${x}, ${y}) with devicePixelRatio ${devicePixelRatio} is out of bounds.`);
        }

        const croppedBuffer = await sharp(imageBuffer)
            .extract({ left: physicalX, top: physicalY, width: 1, height: 1 })
            .png()
            .toBuffer();

        return croppedBuffer;
    } catch (err) {
        console.error("Crop failed:", { x, y, error: err.message });
        throw err;
    }
}

export function getApiKeyForModel(modelId, LLMList, apiKeys) {
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
