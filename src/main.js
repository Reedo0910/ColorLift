import { app, Menu, BrowserWindow, ipcMain, screen, globalShortcut, clipboard, shell } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import sharp from 'sharp';
import screenshot from 'screenshot-desktop';
import { getAverageColor } from 'fast-average-color-node';
import { setLanguage, getLanguage, getResourceBundle } from './utils/i18n.js';
import { LLMCommunicator, LLMList } from './utils/llms-interface.js';

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
        apiKeys: {
            'anthropic': '',
            'cohere': '',
            'iflytek_spark': '',
            'openai': '',
            'zhipu_ai': ''
        },
        modelId: 'gpt-4o-mini', // 默认模型
        language: appLocale,
        colorPickShortcut: 'Alt+C',
        theme: 'system' // 跟随系统主题
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

const isMac = process.platform === 'darwin'

const template = [
    ...(isMac
        ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }]
        : []),
    {
        label: 'File',
        submenu: [
            isMac ? { role: 'close' } : { role: 'quit' }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            ...(isMac
                ? [
                    { role: 'pasteAndMatchStyle' },
                    { role: 'delete' },
                    { role: 'selectAll' },
                    { type: 'separator' },
                    {
                        label: 'Speech',
                        submenu: [
                            { role: 'startSpeaking' },
                            { role: 'stopSpeaking' }
                        ]
                    }
                ]
                : [
                    { role: 'delete' },
                    { type: 'separator' },
                    { role: 'selectAll' }
                ])
        ]
    },
    {
        label: 'Window',
        submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            ...(isMac
                ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ]
                : [
                    { role: 'close' }
                ])
        ]
    },
    {
        role: 'help',
        submenu: [
            {
                label: 'Learn More',
                click: async () => {
                    await shell.openExternal('https://github.com/Reedo0910/ColorLift')
                }
            }
        ]
    }
]

const menu = Menu.buildFromTemplate(template)

Menu.setApplicationMenu(menu);

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
        backgroundMaterial: 'acrylic',
        alwaysOnTop: true, // 悬浮在所有窗口之上
        webPreferences: {
            preload: path.join(__dirname, 'preload', 'preload.js'),
            contextIsolation: true,
            additionalArguments: [JSON.stringify(translations)],
        },
    });

    // mainWindow.setBackgroundColor('rgba(255, 255, 255, 0.8)');

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'pages', 'index.html'));

    // mainWindow.webContents.openDevTools(); // Open DevTools

    mainWindow.setSkipTaskbar(true); // 不出现在任务栏中

    setLanguage(store.get('language')); // 设置默认语言

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
                    preload: path.join(__dirname, 'preload', 'settings-preload.js'), // 为设置窗口加载单独的 preload 脚本
                    contextIsolation: true,
                    additionalArguments: [
                        JSON.stringify({ key: 'translations', value: translations }),
                        JSON.stringify({ key: 'LLMList', value: LLMList }),
                    ],
                },
            });

            settingsWindow.loadFile(path.join(__dirname, 'renderer', 'pages', 'settings.html'));

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
            apiKeys: store.get('apiKeys'),
            modelId: store.get('modelId'),
            language: store.get('language'),
            colorPickShortcut: store.get('colorPickShortcut'),
            theme: store.get('theme'),
        };
    });

    // 保存新的设置
    ipcMain.on('save-settings', (event, settings) => {
        store.set('apiKeys', settings.apiKeys);
        store.set('modelId', settings.modelId);
        store.set('language', settings.language);
        store.set('colorPickShortcut', settings.colorPickShortcut);
        store.set('theme', settings.theme);

        delete settings.apiKeys;
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

        const currentModelId = store.get('modelId');

        // TODO: i18n
        if (!currentModelId) {
            return mainWindow.webContents.send('chatgpt-response', translations['error_model_invalid']);
        }

        const currentApiKey = getApiKeyForModel(currentModelId, LLMList, store.get('apiKeys'));

        if (!currentApiKey) {
            return mainWindow.webContents.send('chatgpt-response', translations['error_api_key_invalid']);
        }

        const message = await LLMCommunicator(hex, getLanguage(), currentModelId, currentApiKey, translations);

        mainWindow.webContents.send('chatgpt-response', message);
    } catch (error) {
        console.error('Error capturing color:', error);

        mainWindow.webContents.send('chatgpt-response', translations['error_unhandled_error']);
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

function getApiKeyForModel(modelId, LLMList, apiKeys) {
    // 找到对应的 Provider
    const provider = LLMList.find(provider =>
        provider.models.some(model => model.id === modelId)
    );

    // 如果找到对应的 Provider，返回对应的 API Key
    if (provider) {
        const providerId = provider.id;
        return apiKeys[providerId] || null; // 返回 API Key 或 null
    }

    // 如果找不到对应的 Provider，返回 null
    return null;
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
