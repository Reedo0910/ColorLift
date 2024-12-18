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

export const LLMCommunicator = async (hex, language, modelId, apiKey, translations) => {
    try {
        const providerObj = findProviderByModelId(modelId);
        if (!providerObj) {
            return translations['error_invalid_model_id'] || 'Invalid model ID.';
        }

        const { apiUrl, authHeader, tokenPrefix, additionalHeader, additionalValue, locale } = providerObj;
        if (!apiUrl) {
            return translations['error_invalid_api_url'] || 'Invalid API URL.';
        }

        const promptEN = `Please describe the color represented by this Hex code in a single paragraph. Example: I provide: Hex. You Response: This is a [color name] color, which is closer to [color name] (or has hints of other tones). You can mention where this color is commonly seen, its applications, etc. Note: You must respond in ${language}. Your response may not exceed 120 words. Do not include the Hex code in your response.`;

        const promptCN = `请描述一下这个Hex所代表的颜色。输出在一个段落中。示例：我提供：Hex 你回答：这是xxx色，它更接近xxx色（或混杂了什么色调），一般会在哪里能见到，有什么应用，等等。注意：请使用${language}进行描述。回答不超过120个字或单词。不要在你的回答中包含Hex。`;

        const bodyObject = buildRequestBody(providerObj, modelId, hex, locale === 'en' ? promptEN : promptCN);

        const headers = buildHeaders(authHeader, tokenPrefix, apiKey, additionalHeader, additionalValue);

        const response = await net.fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bodyObject),
        });

        return await handleResponse(response, providerObj, translations);

    } catch (error) {
        console.error('Unexpected error:', error);
        return translations['error_unexpected'] || 'An unexpected error occurred. Please try again later.';
    }
};

function buildRequestBody(providerObj, modelId, hex, prompt) {
    if (providerObj.id === 'anthropic') {
        return {
            model: modelId,
            system: prompt,
            max_tokens: 300,
            messages: [{ role: 'user', content: hex }],
        };
    }
    return {
        model: modelId,
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: hex },
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
        return translations['error_invalid_response'] || 'Invalid response from the API.';
    }

    if (response.ok) {
        switch (providerObj.id) {
            case 'cohere':
                return data.message?.content?.[0]?.text || translations['error_no_response'];
            case 'anthropic':
                return data.content?.[0]?.text || translations['error_no_response'];
            default:
                return data.choices?.[0]?.message?.content || translations['error_no_response'];
        }
    } else {
        console.error('API error:', data);
        return `${translations['error_api']} ${data.message || 'Unknown error'}`;
    }
}

function findProviderByModelId(modelId) {
    return LLMList.find(provider =>
        provider.models.some(model => model.id === modelId)
    );
}
