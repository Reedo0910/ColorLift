import { app, BrowserWindow, ipcMain, screen, globalShortcut, net } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import screenshot from 'screenshot-desktop';
import { getAverageColor } from 'fast-average-color-node';
import { setLanguage, getLanguage, getResourceBundle } from './i18n.js';

// 创建 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let settingsWindow;
let isPickingColor = false; // 取色模式状态

// 默认语言
const appLocale = getAppLocale();

// 初始化 electron-store
const store = new Store({
    defaults: {
        openaiApiKey: '', // 默认存储 OpenAI API Key
        gptModel: 'gpt-4o-mini', // 默认 GPT 模型
        language: appLocale,
        wordLimit: '120',
    },
});

let translations = getResourceBundle(store.get('language'));

if (translations['app_name']) {
    app.setName(translations['app_name'])
}

app.on('ready', () => {
    // 创建悬浮窗口
    mainWindow = new BrowserWindow({
        width: 320,
        height: 380,
        transparent: true, // 窗口透明
        vibrancy: 'fullscreen-ui',
        titleBarStyle: 'hiddenInset',
        frame: false,
        fullscreenable: false,
        backgroundMaterial: 'acrylic',
        alwaysOnTop: true, // 悬浮在所有窗口之上
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            additionalArguments: [JSON.stringify(translations)],
        },
    });

    mainWindow.loadFile('index.html');

    // mainWindow.webContents.openDevTools(); // Open DevTools

    mainWindow.setSkipTaskbar(true); // 不出现在任务栏中

    setLanguage(store.get('language')); // 设置默认语言

    // 提供翻译功能给渲染进程
    ipcMain.handle('get-language', () => {
        return getLanguage();
    });

    ipcMain.on('set-language', (event, lang) => {
        setLanguage(lang);
        translations = getResourceBundle(lang);
    });

    mainWindow.on('close', (event) => {
        // 检查平台
        if (process.platform === 'darwin' || process.platform === 'linux') {
            app.quit(); // macOS 和 Linux 上完全退出
        }
    });

    // 注册全局快捷键
    globalShortcut.register('Alt+C', captureColor);

    // 确保全局快捷键在退出时释放
    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
    });


    // 创建设置窗口
    ipcMain.on('open-settings', () => {
        if (!settingsWindow) {
            settingsWindow = new BrowserWindow({
                width: 400,
                height: 450,
                parent: mainWindow, // 设置为主窗口的子窗口
                modal: true, // 模态窗口
                show: false, // 初始隐藏
                vibrancy: 'fullscreen-ui',
                titleBarStyle: 'hidden',
                frame: false,
                backgroundMaterial: 'acrylic',
                backgroundColor: 'white',
                webPreferences: {
                    preload: path.join(__dirname, 'settings-preload.js'), // 为设置窗口加载单独的 preload 脚本
                    contextIsolation: true,
                    additionalArguments: [JSON.stringify(translations)],
                },
            });

            settingsWindow.loadFile('settings.html');

            // 在窗口准备好时显示
            settingsWindow.once('ready-to-show', () => {
                settingsWindow.show();
            });

            // 窗口关闭时清理引用
            settingsWindow.on('closed', () => {
                settingsWindow = null;
            });
        }
    });

    // 获取当前存储的设置
    ipcMain.handle('get-settings', () => {
        return {
            apiKey: store.get('openaiApiKey'),
            gptModel: store.get('gptModel'),
            language: store.get('language'),
            wordLimit: store.get('wordLimit'),
        };
    });

    // 保存新的设置
    ipcMain.on('save-settings', (event, settings) => {
        store.set('openaiApiKey', settings.apiKey);
        store.set('gptModel', settings.gptModel);
        store.set('language', settings.language);
        store.set('wordLimit', settings.wordLimit);
        console.log('Settings saved:', settings);

        // 通知主窗口设置已更新
        mainWindow.webContents.send('settings-updated', settings);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});



// 开启取色模式
ipcMain.on('start-capture', () => {
    isPickingColor = true; // 标记进入取色模式
    mainWindow.webContents.send('update-status', 'active');
});

// 全局鼠标点击事件监听
app.on('browser-window-focus', () => {
    const clickListener = () => {
        if (isPickingColor) {
            captureColor().then(() => {
                isPickingColor = false; // 退出取色模式
                mainWindow.webContents.send('update-status', 'inactive');
            });
        }
    };

    app.once('browser-window-blur', clickListener);
});

// 捕获颜色
const captureColor = async () => {
    try {
        const cursorPos = screen.getCursorScreenPoint(); // 获取鼠标位置
        const imgBuffer = await screenshot({ format: 'png' });
        const croppedImageBuffer = await cropOnePixel(imgBuffer, cursorPos.x, cursorPos.y);
        // mainWindow.webContents.send('update-img', `data:image/png;base64,${croppedImageBuffer.toString('base64')}`);

        const color = await getAverageColor(croppedImageBuffer);
        const hex = color.hex;

        // console.log('Picked Color:', hex);
        mainWindow.webContents.send('update-color', hex);

        chatGPTCommunicator(hex);
    } catch (error) {
        console.error('Error capturing color:', error);
    }
};

async function cropOnePixel(imageBuffer, x, y) {
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

function getAppLocale() {
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

const chatGPTCommunicator = async (hex) => {
    const response = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${store.get('openaiApiKey')}`,
        },
        body: JSON.stringify({
            model: store.get('gptModel'),
            messages: [
                { role: 'system', content: `请描述一下这个Hex所代表的颜色。输出在一个段落中。示例：我提供：hex 你回答：这是xxx色，它更接近xxx色（或混杂了什么色调），一般会在哪里能见到，有什么应用，等等。注意：请使用${getLanguage()}进行描述。回答不超过${store.get('wordLimit')}个字或单词。` },
                { role: 'user', content: `${hex}` },
            ],
        }),
    });

    const data = await response.json();
    // console.log('ChatGPT Response:', data);

    if (response.ok) {
        const message = data.choices[0]?.message?.content || 'No Response';
        // console.log('ChatGPT interpretation:', message);
        mainWindow.webContents.send('chatgpt-response', message);
    } else {
        console.error('Error from ChatGPT API:', data);
    }
}