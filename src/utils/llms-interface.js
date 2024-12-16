import { net } from 'electron';

export const chatGPTCommunicator = async (hex, language, gptModel, openaiApiKey) => {
    const response = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
            model: gptModel,
            messages: [
                { role: 'system', content: `请描述一下这个Hex所代表的颜色。输出在一个段落中。示例：我提供：Hex 你回答：这是xxx色，它更接近xxx色（或混杂了什么色调），一般会在哪里能见到，有什么应用，等等。注意：请使用${language}进行描述。回答不超过120个字或单词。不要在你的回答中包含Hex。` },
                { role: 'user', content: `${hex}` },
            ],
        }),
    });

    const data = await response.json();
    // console.log('ChatGPT Response:', data);

    if (response.ok) {
        return data.choices[0]?.message?.content || 'No Response';
        // console.log('ChatGPT interpretation:', message);
    } else {
        console.error('Error from ChatGPT API:', data);
        return '';
    }
}