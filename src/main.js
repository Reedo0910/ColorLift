import { app, Menu, BrowserWindow, ipcMain, screen, nativeTheme, globalShortcut, clipboard, shell, net, dialog } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import screenshot from 'screenshot-desktop';
import { getAverageColor } from 'fast-average-color-node';
import { cropOnePixel, getApiKeyForModel, getAppLocale } from './utils/utils.js'
import { setLanguage, getLanguage, getResourceBundle, t } from './utils/i18n.js';
import { LLMCommunicator, LLMList } from './utils/llms-interface.js';

// 创建 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let settingsWindow;
let aboutWindow;
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

setLanguage(store.get('language')); // 设置默认语言

let translations = getResourceBundle(store.get('language'));

if (translations['app_name']) {
    app.setName(translations['app_name'])
}

function isSafeForExternalOpen(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.origin === 'https://github.com';
    } catch (e) {
        return false;
    }
}

const isMac = process.platform === 'darwin'

const template = [
    // { role: 'appMenu' }
    ...(isMac
        ? [{
            label: translations['app_name'],
            submenu: [
                {
                    type: 'normal',
                    label: t('menu_about', { appName: translations['app_name'] }),
                    click: () => {
                        openAboutWindow();
                    }
                },
                { type: 'separator' },
                {
                    type: 'normal',
                    label: translations['menu_settings'],
                    accelerator: "CmdOrCtrl+,",
                    click: () => {
                        openSettingsWindow();
                    }
                },
                { type: 'separator' },
                {
                    role: 'services',
                    label: translations['menu_services']
                },
                { type: 'separator' },
                {
                    role: 'hide',
                    label: t('menu_hide', { appName: translations['app_name'] })
                },
                {
                    role: 'hideOthers',
                    label: translations['menu_hide_others']
                },
                {
                    role: 'unhide',
                    label: translations['menu_unhide']
                },
                { type: 'separator' },
                {
                    role: 'quit',
                    label: t('menu_quit', { appName: translations['app_name'] })
                }
            ]
        }]
        : []),
    // { role: 'fileMenu' }
    {
        label: translations['menu_file_menu'],
        submenu: [
            isMac ? { role: 'close', label: translations['menu_close'] } : { role: 'quit', label: translations['menu_quit_file_menu'] }
        ]
    },
    // { role: 'editMenu' }
    {
        label: translations['menu_edit_menu'],
        submenu: [
            { role: 'undo', label: translations['menu_undo'] },
            { role: 'redo', label: translations['menu_redo'] },
            { type: 'separator' },
            { role: 'cut', label: translations['menu_cut'] },
            { role: 'copy', label: translations['menu_copy'] },
            { role: 'paste', label: translations['menu_paste'] },
            ...(isMac
                ? [
                    // { role: 'pasteAndMatchStyle' },
                    { role: 'delete', label: translations['menu_delete'] },
                    { role: 'selectAll', label: translations['menu_select_all'] },
                    { type: 'separator' },
                    {
                        label: translations['menu_speech'],
                        submenu: [
                            { role: 'startSpeaking', label: translations['menu_start_speaking'] },
                            { role: 'stopSpeaking', label: translations['menu_stop_speaking'] }
                        ]
                    }
                ]
                : [
                    { role: 'delete', label: translations['menu_delete'] },
                    { type: 'separator' },
                    { role: 'selectAll', label: translations['menu_select_all'] }
                ])
        ]
    },
    // { role: 'windowMenu' }
    {
        label: translations['menu_window_menu'],
        submenu: [
            { role: 'minimize', label: translations['menu_minimize'] },
            { role: 'zoom', label: translations['menu_zoom'] },
            ...(isMac
                ? [
                    { type: 'separator' },
                    { role: 'front', label: translations['menu_front'] },
                    { type: 'separator' },
                    { role: 'window', label: translations['menu_window_menu'] }
                ]
                : [
                    { role: 'close' }
                ])
        ]
    },
    {
        role: 'help',
        label: translations['menu_help'],
        submenu: [
            {
                label: translations['menu_learn_more'],
                click: async () => {
                    await shell.openExternal('https://github.com/Reedo0910/ColorLift');
                }
            },
            {
                label: translations['menu_check_for_updates'],
                click: async () => {
                    await checkForUpdates();
                }
            }
        ]
    }
]

const menu = Menu.buildFromTemplate(template)

Menu.setApplicationMenu(menu);

const savedTheme = store.get('theme') || 'system';
nativeTheme.themeSource = savedTheme;

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
        openSettingsWindow();
    });

    // Create About window
    ipcMain.on('open-about', () => {
        openAboutWindow();
    });

    globalShortcut.register('Esc', () => {
        // 退出取色模式
        if (isPickingColor) {
            isPickingColor = false;
            mainWindow.webContents.send('update-status', 'inactive');
        }

        if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.close();
            settingsWindow = null;
        }

        if (aboutWindow && !aboutWindow.isDestroyed()) {
            aboutWindow.close();
            aboutWindow = null;
        }
    });


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
            if (isSafeForExternalOpen(url)) {
                setImmediate(() => {
                    shell.openExternal(url)
                })
            }

            return { action: 'deny' }
        })
    });

    // Check for updates
    ipcMain.handle('check-for-updates', async () => {
        await checkForUpdates();
    });
});

function openAboutWindow() {
    if (!aboutWindow) {
        aboutWindow = new BrowserWindow({
            width: 320,
            height: 420,
            title: '关于',
            resizable: false,
            minimizable: false,
            maximizable: false,
            vibrancy: 'fullscreen-ui',
            titleBarStyle: 'hidden',
            frame: false,
            modal: true,
            show: false,
            parent: mainWindow,
            backgroundMaterial: 'acrylic',
            backgroundColor: 'white',
            webPreferences: {
                preload: path.join(__dirname, 'preload', 'about-preload.js'),
                contextIsolation: true,
                additionalArguments: [
                    JSON.stringify({ key: 'translations', value: translations }),
                    JSON.stringify({ key: 'appVersion', value: app.getVersion() }),
                ],
            },
        });

        aboutWindow.loadFile(path.join(__dirname, 'renderer', 'pages', 'about.html'));

        aboutWindow.once('ready-to-show', () => {
            aboutWindow.show();
        });

        aboutWindow.on('closed', () => {
            aboutWindow = null;
        });
    }
}

function openSettingsWindow() {
    if (!settingsWindow) {

        if (store.get('colorPickShortcut') !== '') {
            globalShortcut.unregister(store.get('colorPickShortcut'));
        }

        settingsWindow = new BrowserWindow({
            width: 400,
            height: 450,
            title: translations['setting_window_title'],
            parent: mainWindow,
            modal: true,
            show: false,
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
}

const checkForUpdates = async () => {
    try {
        const response = await net.fetch('https://api.github.com/repos/Reedo0910/ColorLift/releases/latest');

        if (!response.ok) {
            throw new Error(`Failed to fetch updates. Status: ${response.status}`);
        }

        const data = await response.json();

        const latestVersion = data.tag_name;
        const currentVersion = app.getVersion();

        if (!data.tag_name || !data.assets || !data.assets[0]) {
            throw new Error('Incomplete response.');
        }

        if (latestVersion > currentVersion) {
            const result = dialog.showMessageBoxSync({
                type: 'info',
                title: translations['update_available_dialog_title'],
                message: t('update_available_dialog_message', { latestVersion: latestVersion }),
                buttons: [translations['dialog_yes_option'], translations['dialog_no_option']]
            });

            if (result === 0) {
                shell.openExternal(data.assets[0]?.browser_download_url);
                console.log(data.assets[0]?.browser_download_url);
            }
        } else {
            dialog.showMessageBoxSync({
                type: 'info',
                title: translations['no_update_dialog_title'],
                message: translations['no_update_dialog_message']
            });
        }
    } catch (error) {
        const alterResult = dialog.showMessageBoxSync({
            type: 'error',
            title: translations['update_error_dialog_title'],
            message: translations['update_error_dialog_message'],
            buttons: [translations['dialog_open_github_option'], translations['dialog_close_option']],
            defaultId: 0 // 默认选中 "Open GitHub"
        });

        if (alterResult === 0) {
            shell.openExternal('https://github.com/Reedo0910/ColorLift/releases');
        }

    }
}

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
    if ((settingsWindow && !settingsWindow.isDestroyed()) ||
        (aboutWindow && !aboutWindow.isDestroyed())) {
        // 当一个模态窗口开启时，或已经开启时，退出取色模式
        isPickingColor = false;
        mainWindow.webContents.send('update-status', 'inactive');
        return;
    }

    try {
        const cursorPos = screen.getCursorScreenPoint(); // 获取鼠标位置
        const imgBuffer = await screenshot({ format: 'png' });
        const croppedImageBuffer = await cropOnePixel(imgBuffer, cursorPos.x, cursorPos.y);

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
