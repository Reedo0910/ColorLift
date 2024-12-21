import { net } from 'electron';

export const LLMList = [
    {
        provider: 'Anthropic',
        id: 'anthropic',
        authHeader: 'x-api-key',
        tokenPrefix: '',
        additionalHeader: 'anthropic-version',
        additionalValue: '2023-06-01',
        apiUrl: 'https://api.anthropic.com/v1/messages',
        locale: 'en',
        models: [
            {
                name: 'Claude 3.5 Haiku',
                id: 'claude-3-5-haiku-latest'
            },
            {
                name: 'Claude 3.5 Sonnet',
                id: 'claude-3-5-sonnet-latest'
            }
        ]
    },
    {
        provider: 'Cohere',
        id: 'cohere',
        authHeader: 'Authorization',
        tokenPrefix: 'bearer ',
        apiUrl: 'https://api.cohere.com/v2/chat',
        locale: 'en',
        models: [
            {
                name: 'Command R7B',
                id: 'command-r7b-12-2024'
            },
            {
                name: 'Command R+',
                id: 'command-r-plus-08-2024'
            }
        ]
    },
    {
        provider: 'iFlytek Spark',
        id: 'iflytek_spark',
        authHeader: 'Authorization',
        tokenPrefix: 'Bearer ',
        apiUrl: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
        locale: 'cn',
        models: [
            {
                name: 'Lite',
                id: 'lite'
            },
            {
                name: 'Pro',
                id: 'generalv3'
            },
            {
                name: 'Max',
                id: 'generalv3.5'
            },
            {
                name: '4.0 Ultra',
                id: '4.0Ultra'
            }
        ]
    },
    {
        provider: 'OpenAI',
        id: 'openai',
        authHeader: 'Authorization',
        tokenPrefix: 'Bearer ',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        locale: 'en',
        models: [
            {
                name: 'GPT-4o mini',
                id: 'gpt-4o-mini'
            },
            {
                name: 'GPT-4o',
                id: 'gpt-4o'
            }
        ]
    },
    {
        provider: 'Zhipu AI',
        id: 'zhipu_ai',
        authHeader: 'Authorization',
        tokenPrefix: 'Bearer ',
        apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        locale: 'cn',
        models: [
            {
                name: 'GLM-4-Flash',
                id: 'glm-4-flash'
            },
            {
                name: 'GLM-4-AirX',
                id: 'glm-4-airx'
            },
            {
                name: 'GLM-4-0520',
                id: 'glm-4-0520'
            },
            {
                name: 'GLM-4-Plus',
                id: 'glm-4-plus'
            }
        ]
    }];

export const LLMCommunicator = async (colorObj, language, modelId, apiKey, translations) => {
    try {
        const providerObj = findProviderByModelId(modelId);
        if (!providerObj) {
            return `||ERROR|| ${translations['error_invalid_model_id'] || 'Invalid model ID.'}`;
        }

        const { apiUrl, authHeader, tokenPrefix, additionalHeader, additionalValue, locale } = providerObj;
        if (!apiUrl) {
            return `||ERROR|| ${translations['error_invalid_api_url'] || 'Invalid API URL.'}`;
        }

        const prompt = `Please describe the characteristics and application scenarios of the following color. Input format: - HSL: [hsl value] - RGB: [rgb value] - Hex: [hex value] Requirements: 1. Description includes: - Basic hue name - Approximate or blended tones - Common application scenarios (including famous cases, where applicable) - Visual impression 2. Use ${language} for the description 3. Limit the response to 120 words 4. Do not include any color codes (HSL/RGB/Hex) Example: Input: - HSL: hsl(120, 2%, 16%) - RGB: rgb(40, 42, 40) - Hex: #282A28 Output: This is a deep iron gray, close to charcoal tones with an olive undertone. It conveys seriousness, professionalism, and mystery, commonly seen in modern architecture facades, high-end electronics, and winter fashion collections.`;

        const userPrompt = `- HSL：${colorObj.hsl} - RGB：${colorObj.rgb} - Hex：${colorObj.hex}`;

        const bodyObject = buildRequestBody(providerObj, modelId, userPrompt, prompt);

        const headers = buildHeaders(authHeader, tokenPrefix, apiKey, additionalHeader, additionalValue);

        const response = await net.fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bodyObject),
        });

        return await handleResponse(response, providerObj, translations);

    } catch (error) {
        console.error('Unexpected error:', error);
        return `||ERROR|| ${translations['error_unexpected'] || 'An unexpected error occurred. Please try again later.'}`;
    }
};

function buildRequestBody(providerObj, modelId, userPrompt, systemPrompt) {
    if (providerObj.id === 'anthropic') {
        return {
            model: modelId,
            system: systemPrompt,
            max_tokens: 350,
            messages: [{ role: 'user', content: userPrompt }],
        };
    }
    return {
        model: modelId,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    };
}

function buildHeaders(authHeader, tokenPrefix, apiKey, additionalHeader, additionalValue) {
    return {
        'Content-Type': 'application/json',
        [authHeader]: `${tokenPrefix}${apiKey}`,
        ...(additionalHeader ? { [additionalHeader]: additionalValue } : {}),
    };
}

async function handleResponse(response, providerObj, translations) {
    let data;
    try {
        data = await response.json();
    } catch (err) {
        console.error('Failed to parse JSON response:', err);
        return `||ERROR|| ${translations['error_invalid_response'] || 'Invalid response from the API.'}`;
    }

    if (response.ok) {
        switch (providerObj.id) {
            case 'cohere':
                return data.message?.content?.[0]?.text || `||ERROR|| ${translations['error_no_response']}`;
            case 'anthropic':
                return data.content?.[0]?.text || `||ERROR|| ${translations['error_no_response']}`;
            default:
                return data.choices?.[0]?.message?.content || `||ERROR|| ${translations['error_no_response']}`;
        }
    } else {
        console.error('API error:', data);
        return `||ERROR|| ${translations['error_api']} (Code: ${response.status}) ${data.message?.content || data.error?.message || data.message || 'Unknown error'}`;
    }
}

function findProviderByModelId(modelId) {
    return LLMList.find(provider =>
        provider.models.some(model => model.id === modelId)
    );
}
