import { app, BrowserWindow, ipcMain, screen, globalShortcut, net, clipboard } from 'electron';
import { URL } from 'url';
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
        colorPickShortcut: 'Alt+C'
    },
});

let translations = getResourceBundle(store.get('language'));

if (translations['app_name']) {
    app.setName(translations['app_name'])
}

app.on('web-contents-created', (event, contents) => {
    // restrict web navigation
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl)

        // to github.com only
        if (parsedUrl.origin !== 'https://github.com') {
            event.preventDefault()
        }
    })

    contents.setWindowOpenHandler(({ url }) => {
        // 在这个例子中，我们要求操作系统
        // 在默认浏览器中打开此事件的URL
        //
        // 关于哪些URL应该被允许通过shell.openExternal打开，
        // 请参照以下项目。
        if (isSafeForExternalOpen(url)) {
            setImmediate(() => {
                shell.openExternal(url)
            })
        }

        return { action: 'deny' }
    })
})

app.on('ready', () => {
    // 创建悬浮窗口
    mainWindow = new BrowserWindow({
        width: 345,
        height: 480,
        transparent: true, // 窗口透明
        vibrancy: 'fullscreen-ui',
        titleBarStyle: 'hiddenInset',
        frame: false,
        fullscreenable: false,
        backgroundColor: 'white',
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
    // ipcMain.handle('get-language', () => {
    //     return getLanguage();
    // });

    ipcMain.on('set-language', (event, lang) => {
        setLanguage(lang);
        translations = getResourceBundle(lang);

        mainWindow.webContents.send('translations-update', translations);
    });

    // 将系统设置通过 webContents 传递给主界面
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('color-pick-shortcut', store.get('colorPickShortcut'));
    });

    mainWindow.on('close', (event) => {
        // 检查平台
        if (process.platform === 'darwin' || process.platform === 'linux') {
            app.quit(); // macOS 和 Linux 上完全退出
        }
    });

    // 注册全局快捷键
    if (store.get('colorPickShortcut') !== '' && !globalShortcut.isRegistered(store.get('colorPickShortcut'))) {
        globalShortcut.register(store.get('colorPickShortcut'), captureColor);
    }


    // 确保全局快捷键在退出时释放
    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
    });

    let hasColorPickShortcutUpdated = false;

    // 创建设置窗口
    ipcMain.on('open-settings', () => {
        if (!settingsWindow) {

            if (store.get('colorPickShortcut') !== '') {
                globalShortcut.unregister(store.get('colorPickShortcut'));
            }

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

                if (!hasColorPickShortcutUpdated) {
                    if (store.get('colorPickShortcut') !== '') {
                        globalShortcut.register(store.get('colorPickShortcut'), captureColor);
                    }
                }

                hasColorPickShortcutUpdated = false;
            });
        }
    });

    // 获取当前存储的设置
    ipcMain.handle('get-settings', () => {
        return {
            apiKey: store.get('openaiApiKey'),
            gptModel: store.get('gptModel'),
            language: store.get('language'),
            colorPickShortcut: store.get('colorPickShortcut'),
        };
    });

    // 保存新的设置
    ipcMain.on('save-settings', (event, settings) => {
        store.set('openaiApiKey', settings.apiKey);
        store.set('gptModel', settings.gptModel);
        store.set('language', settings.language);
        store.set('colorPickShortcut', settings.colorPickShortcut);

        delete settings.apiKey;
        console.log('Settings saved:', settings);

        // 通知主窗口设置已更新
        mainWindow.webContents.send('settings-updated', settings);
    });

    ipcMain.handle('set-color-pick-shortcut', (event, shortcut) => {
        // 注销以前的快捷键
        if (store.get('colorPickShortcut') !== '') {
            globalShortcut.unregister(store.get('colorPickShortcut'));
        }

        if (shortcut !== '') {
            // 注册新的快捷键
            if (!globalShortcut.isRegistered(shortcut)) {
                globalShortcut.register(shortcut, captureColor);

                hasColorPickShortcutUpdated = true;
            } else {
                return false;
            }
        }

        return true;
    });

    globalShortcut.register('Esc', () => {
        // 退出取色模式
        if (isPickingColor) {
            isPickingColor = false;
            mainWindow.webContents.send('update-status', 'inactive');
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


ipcMain.on('copy-to-clipboard', (event, text) => {
    clipboard.writeText(text);
    event.sender.send('copy-success', true); // 通知渲染进程复制成功
});


// 开启取色模式
ipcMain.on('start-capture', () => {
    isPickingColor = true; // 标记进入取色模式
    mainWindow.webContents.send('update-status', 'active');
});

// 退出取色模式
ipcMain.on('stop-capture', () => {
    isPickingColor = false; // 标记退出取色模式
    mainWindow.webContents.send('update-status', 'inactive');
});

// 全局鼠标点击事件监听
app.on('browser-window-focus', () => {
    const clickListener = async () => {
        if (isPickingColor) {
            await captureColor();
            isPickingColor = false; // 退出取色模式
            mainWindow.webContents.send('update-status', 'inactive');
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
                { role: 'system', content: `请描述一下这个Hex所代表的颜色。输出在一个段落中。示例：我提供：Hex 你回答：这是xxx色，它更接近xxx色（或混杂了什么色调），一般会在哪里能见到，有什么应用，等等。注意：请使用${getLanguage()}进行描述。回答不超过120个字或单词。不要在你的回答中包含Hex。` },
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