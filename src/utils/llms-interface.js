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
    },
    {
        provider: 'Custom',
        id: 'custom',
        models: []
    }
];

export const ReqTypeList = [
    {
        name: 'OpenAI',
        id: 'custom_openai',
        authHeader: 'Authorization',
        tokenPrefix: 'Bearer '
    },
    {
        name: 'Anthropic',
        id: 'custom_anthropic',
        authHeader: 'x-api-key',
        tokenPrefix: '',
        additionalHeader: 'anthropic-version',
        additionalValue: '2023-06-01',
    },
    {
        name: 'Cohere',
        id: 'custom_cohere',
        authHeader: 'Authorization',
        tokenPrefix: 'bearer '
    },
];

export const LLMCommunicator = async (colorObj, modelId, apiKey, promptComponents, translations, customReqTypeId = '', customEndpoint = '') => {
    try {
        const providerObj = findProviderByModelId(modelId);
        if (!providerObj) {
            return `||ERROR|| ${translations['error_invalid_model_id'] || 'Invalid model ID.'}`;
        }

        let { apiUrl, authHeader, tokenPrefix, additionalHeader, additionalValue } = providerObj;

        if (providerObj.id === 'custom') {
            if (!isValidHttpUrl(customEndpoint)) {
                return `||ERROR|| ${translations['error_invalid_custom_endpoint'] || 'Invalid custom endpoint URL.'}`;
            }

            apiUrl = customEndpoint;

            const myCustomReqTypeId = customReqTypeId ? customReqTypeId : 'custom_openai';

            const reqTypeObj = findReqTypeById(myCustomReqTypeId);

            if (!reqTypeObj) {
                return `||ERROR|| ${translations['error_invalid_request_type'] || 'Invalid request type.'}`;
            }

            ({ authHeader, tokenPrefix, additionalHeader, additionalValue } = reqTypeObj);
        }

        if (!apiUrl) {
            return `||ERROR|| ${translations['error_invalid_api_url'] || 'Invalid API URL.'}`;
        }

        let promptColorImpressionRequirementText = '';
        let promptColorImpressionExampleText = '';

        let promptColorScenarioRequirementText = '';
        let promptColorScenarioExampleText = '';

        const promptTemplate = translations['prompt_text'];

        if (promptComponents.isShowColorImpression) {
            promptColorImpressionRequirementText = translations['prompt_text_color_impression_requirement'];

            promptColorImpressionExampleText = translations['prompt_text_color_impression_example'];
        }

        if (promptComponents.isShowColorScenario) {
            promptColorScenarioRequirementText = translations['prompt_text_color_scenario_requirement'];

            promptColorScenarioExampleText = translations['prompt_text_color_scenario_example'];
        }

        const promptText = promptTemplate
            .replace('[[prompt_text_color_impression_requirement]]', promptColorImpressionRequirementText)
            .replace('[[prompt_text_color_scenario_requirement]]', promptColorScenarioRequirementText)
            .replace('[[prompt_text_color_impression_example]]', promptColorImpressionExampleText)
            .replace('[[prompt_text_color_scenario_example]]', promptColorScenarioExampleText);

        const prompt = promptText;

        const userPrompt = `- HSL：${colorObj.hsl} - RGB：${colorObj.rgb} - Hex：${colorObj.hex}`;

        const myModelId = modelId.startsWith('custom@') ? modelId.slice(7) : modelId;

        const bodyObject = buildRequestBody(providerObj, myModelId, userPrompt, prompt, customReqTypeId);

        const headers = buildHeaders(authHeader, tokenPrefix, apiKey, additionalHeader, additionalValue);

        const response = await net.fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bodyObject),
        });

        return await handleResponse(response, providerObj, translations, customReqTypeId);

    } catch (error) {
        console.error('Unexpected error:', error);
        return `||ERROR|| ${translations['error_unexpected'] || 'An unexpected error occurred. Please try again later.'}`;
    }
};

function buildRequestBody(providerObj, modelId, userPrompt, systemPrompt, customReqTypeId) {
    if (providerObj.id === 'anthropic' ||
        (providerObj.id === 'custom' && customReqTypeId === 'custom_anthropic')
    ) {
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

function findProviderByModelId(modelId) {
    // Special case: if modelId starts with "custom@", return the "custom" provider
    if (modelId.startsWith('custom@')) {
        const customModelId = modelId.slice(7); // "custom@".length === 7
        if (customModelId === '') return undefined; // custom model ID is empty

        return LLMList.find(provider => provider.id === 'custom');
    }

    // Otherwise, find the provider that contains the modelId
    return LLMList.find(provider =>
        provider.models.some(model => model.id === modelId)
    );
}

function findReqTypeById(reqTypeId) {
    return ReqTypeList.find(type => type.id === reqTypeId);
}

function isValidHttpUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

async function handleResponse(response, providerObj, translations, customReqTypeId) {
    let data;
    try {
        data = await response.json();
    } catch (err) {
        console.error('Failed to parse JSON response:', err);
        return `||ERROR|| ${translations['error_invalid_response'] || 'Invalid response from the API.'}`;
    }

    if (response.ok) {
        const fallback = `||ERROR|| ${translations['error_no_response']}`;
        switch (providerObj.id) {
            case 'cohere':
                return data.message?.content?.[0]?.text || fallback;

            case 'anthropic':
                return data.content?.[0]?.text || fallback;

            case 'custom':
                switch (customReqTypeId) {
                    case 'custom_cohere':
                        return data.message?.content?.[0]?.text || fallback;

                    case 'custom_anthropic':
                        return data.content?.[0]?.text || fallback;

                    default:
                        return data.choices?.[0]?.message?.content || fallback;
                }

            default:
                return data.choices?.[0]?.message?.content || fallback;
        }
    } else {
        console.error('API error:', data);
        return `||ERROR|| ${translations['error_api']} (Code: ${response.status}) ${data.message?.content || data.error?.message || data.message || 'Unknown error'}`;
    }
}
