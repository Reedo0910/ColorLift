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
            },
            {
                name: 'Claude 3.7 Sonnet',
                id: 'claude-3-7-sonnet-latest'
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
            },
            {
                name: 'Command A',
                id: 'command-a-03-2025'
            }
        ]
    },
    {
        provider: 'DeepSeek',
        id: 'deepseek',
        authHeader: 'Authorization',
        tokenPrefix: 'Bearer ',
        apiUrl: 'https://api.deepseek.com/chat/completions',
        locale: 'cn',
        models: [
            {
                name: 'DeepSeek-V3',
                id: 'deepseek-chat'
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
                name: 'GPT-4.1 nano',
                id: 'gpt-4.1-nano'
            },
            {
                name: 'GPT-4o mini',
                id: 'gpt-4o-mini'
            },
            {
                name: 'GPT-4.1 mini',
                id: 'gpt-4.1-mini'
            },
            {
                name: 'GPT-4o',
                id: 'gpt-4o'
            },
            {
                name: 'GPT-4.1',
                id: 'gpt-4.1'
            }
        ]
    },
    {
        provider: 'Qwen',
        id: 'qwen',
        authHeader: 'Authorization',
        tokenPrefix: 'Bearer ',
        apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        locale: 'cn',
        models: [
            {
                name: 'Qwen Turbo',
                id: 'qwen-turbo-latest'
            },
            {
                name: 'Qwen Plus',
                id: 'qwen-plus-latest'
            },
            {
                name: 'Qwen Max',
                id: 'qwen-max-latest'
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
                name: 'GLM-4-FlashX-250414',
                id: 'glm-4-flash-250414'
            },
            {
                name: 'GLM-4-AirX',
                id: 'glm-4-airx'
            },
            {
                name: 'GLM-4-Air-250414',
                id: 'glm-4-air-250414'
            },
            {
                name: 'GLM-4-Plus',
                id: 'glm-4-plus'
            }
        ]
    }];

export const LLMCommunicator = async (colorObj, modelId, apiKey, translations) => {
    try {
        const providerObj = findProviderByModelId(modelId);
        if (!providerObj) {
            return `||ERROR|| ${translations['error_invalid_model_id'] || 'Invalid model ID.'}`;
        }

        const { apiUrl, authHeader, tokenPrefix, additionalHeader, additionalValue } = providerObj;
        if (!apiUrl) {
            return `||ERROR|| ${translations['error_invalid_api_url'] || 'Invalid API URL.'}`;
        }

        const prompt = translations['prompt_text'];

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
