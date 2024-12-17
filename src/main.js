import { app, Menu, BrowserWindow, ipcMain, screen, nativeTheme, globalShortcut, clipboard, shell } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import screenshot from 'screenshot-desktop';
import { getAverageColor } from 'fast-average-color-node';
import { cropOnePixel, getApiKeyForModel, getAppLocale } from './utils/utils.js'
import { setLanguage, getLanguage, getResourceBundle } from './utils/i18n.js';
import { LLMCommunicator, LLMList } from './utils/llms-interface.js';

// 创建 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let settingsWindow;
let isPickingColor = false; // 取色模式状态
let hasColorPickShortcutUpdated = false;

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
        modelId: '',
        language: appLocale,
        colorPickShortcut: 'Alt+C',
        theme: 'system'
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

const savedTheme = store.get('theme') || 'system';
nativeTheme.themeSource = savedTheme;

setLanguage(store.get('language')); // 设置默认语言

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
            additionalArguments: [
                JSON.stringify({ key: 'translations', value: translations }),
                JSON.stringify({ key: 'colorPickShortcut', value: store.get('colorPickShortcut') }),
                JSON.stringify({ key: 'initTheme', value: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' }),
            ],
        },
    });

    // mainWindow.setBackgroundColor('rgba(255, 255, 255, 0.8)');

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'pages', 'index.html'));

    // mainWindow.webContents.openDevTools(); // Open DevTools

    mainWindow.setSkipTaskbar(true); // 不出现在任务栏中

    // 将系统设置通过 webContents 传递给主界面
    // mainWindow.webContents.on('did-finish-load', () => {
    //     mainWindow.webContents.send('color-pick-shortcut', store.get('colorPickShortcut'));
    // });

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

    globalShortcut.register('Esc', () => {
        // 退出取色模式
        if (isPickingColor) {
            isPickingColor = false;
            mainWindow.webContents.send('update-status', 'inactive');
        }
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

    // 确保全局快捷键在退出时释放
    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
    });

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
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
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

    nativeTheme.themeSource = settings.theme;

    // 通知主窗口设置已更新
    mainWindow.webContents.send('settings-updated', { 'colorPickShortcut': settings.colorPickShortcut, 'currentTheme': nativeTheme.shouldUseDarkColors ? 'dark' : 'light' });
});

ipcMain.on('set-language', (event, lang) => {
    setLanguage(lang);
    translations = getResourceBundle(lang);

    mainWindow.webContents.send('translations-update', translations);
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

        isPickingColor = false; // 退出取色模式
        mainWindow.webContents.send('update-status', 'inactive');

        const currentModelId = store.get('modelId');

        if (!currentModelId) {
            return mainWindow.webContents.send('llm-response', translations['error_model_invalid']);
        }

        const currentApiKey = getApiKeyForModel(currentModelId, LLMList, store.get('apiKeys'));

        if (!currentApiKey) {
            return mainWindow.webContents.send('llm-response', translations['error_api_key_invalid']);
        }

        const message = await LLMCommunicator(hex, getLanguage(), currentModelId, currentApiKey, translations);

        mainWindow.webContents.send('llm-response', message);
    } catch (error) {
        console.error('Error capturing color:', error);

        mainWindow.webContents.send('llm-response', translations['error_unhandled_error']);
    }
};
