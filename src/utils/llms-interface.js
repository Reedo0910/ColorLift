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

export const LLMCommunicator = async (hex, language, modelId, apiKey) => {

    const providerObj = findProviderByModelId(modelId);
    const providerId = providerObj.id;
    const url = providerObj.apiUrl;
    const providerLocale = providerObj.locale;
    const authHeader = providerObj.authHeader;
    const tokenPrefix = providerObj.tokenPrefix;
    const additionalHeader = providerObj.additionalHeader || '';
    const additionalValue = providerObj.additionalValue || '';

    if (!url) {
        return 'invalid model id';
    }

    const promptEN = `Please describe the color represented by this Hex code in a single paragraph. Example: I provide: Hex. You Response: This is a [color name] color, which is closer to [color name] (or has hints of other tones). You can mention where this color is commonly seen, its applications, etc. . Note: You must respond in ${language}. Your response may not exceed 120 words. Do not include the Hex code in your response.`;

    const promptCN = `请描述一下这个Hex所代表的颜色。输出在一个段落中。示例：我提供：Hex 你回答：这是xxx色，它更接近xxx色（或混杂了什么色调），一般会在哪里能见到，有什么应用，等等。注意：请使用${language}进行描述。回答不超过120个字或单词。不要在你的回答中包含Hex。`;

    const headers = {
        'Content-Type': 'application/json',
        [authHeader]: `${tokenPrefix}${apiKey}`,
        ...(additionalHeader ? { [additionalHeader]: additionalValue } : {}), // 仅当 additionalHeader 存在时添加
    };

    let bodyObject;

    if (providerId === 'anthropic') {
        bodyObject = {
            model: modelId,
            system: promptEN,
            max_tokens: 300,
            messages: [
                { role: 'user', content: `${hex}` }
            ]
        }
    } else {
        bodyObject = {
            model: modelId,
            messages: [
                { role: 'system', content: providerLocale === 'en' ? promptEN : promptCN },
                { role: 'user', content: `${hex}` },
            ]
        }
    }

    const response = await net.fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(bodyObject),
    });

    const data = await response.json();
    // console.log('LLM Response:', data);

    if (response.ok) {
        if (providerId === 'cohere') {
            return data.message?.content[0]?.text || 'No Response';
        }
        if (providerId === 'anthropic') {
            return data.content[0].text || 'No Response';
        }
        return data.choices[0]?.message?.content || 'No Response';
        // console.log('LLM interpretation:', message);
    } else {
        console.error('Error from LLM API:', data);
        return '';
    }
}

function findProviderByModelId(modelId) {
    for (const provider of LLMList) {
        const model = provider.models.find(model => model.id === modelId);
        if (model) {
            return provider;
        }
    }
    return null;
}