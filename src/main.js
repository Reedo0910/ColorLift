import { app, Menu, BrowserWindow, ipcMain, screen, nativeTheme, globalShortcut, clipboard, shell, net, dialog } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import screenshot from 'screenshot-desktop';
import { getAverageColor } from 'fast-average-color-node';
import { cropOnePixel, getApiKeyForModel, getAppLocale } from './utils/utils.js'
import { setLanguage, getLanguage, getResourceBundle, t } from './utils/i18n.js';
import { LLMCommunicator, LLMList } from './utils/llms-interface.js';
import electronSquirrelStartup from 'electron-squirrel-startup';
import semver from 'semver';

// Define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let settingsWindow;
let aboutWindow;
let isPickingColor = false; // Color picking state
let hasColorPickShortcutUpdated = false;

const isMac = process.platform === 'darwin';

// Prevent Squirrel.Windows launches the app multiple times during the installation/updating/uninstallation
if (electronSquirrelStartup) {
    app.quit();
}

// Get locale language
const appLocale = getAppLocale();

// Init electron-store
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
        colorPickShortcut: isMac ? 'Alt+C' : 'Alt+D',
        theme: 'system'
    },
});

setLanguage(store.get('language')); // Set default language

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
];

const menu = Menu.buildFromTemplate(template);

Menu.setApplicationMenu(menu);

const savedTheme = store.get('theme') || 'system';
nativeTheme.themeSource = savedTheme;

app.on('ready', () => {
    // Create main window
    mainWindow = new BrowserWindow({
        width: 345,
        height: 480,
        transparent: true,
        vibrancy: 'fullscreen-ui',
        titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
        // expose window controlls in Windows/Linux
        ...(!isMac ? {
            titleBarOverlay: true
        } : {}),
        frame: false,
        fullscreenable: false,
        backgroundMaterial: 'acrylic',
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload', 'preload.js'),
            contextIsolation: true,
            additionalArguments: [
                JSON.stringify({ key: 'translations', value: translations }),
                JSON.stringify({ key: 'colorPickShortcut', value: store.get('colorPickShortcut') }),
                JSON.stringify({ key: 'initTheme', value: nativeTheme.shouldUseDarkColors ? 'dark' : 'light' }),
                JSON.stringify({ key: 'isMac', value: isMac }),
            ],
        },
    });

    // mainWindow.setBackgroundColor('rgba(255, 255, 255, 0.8)');

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'pages', 'index.html'));

    // mainWindow.webContents.openDevTools(); // Open DevTools

    // mainWindow.setSkipTaskbar(true); // Hide in task bar

    mainWindow.on('close', (event) => {
        if (process.platform === 'darwin' || process.platform === 'linux') {
            app.quit(); // fully quit on macOS and Linux
        }
    });

    // Register global color picking shortcut
    if (store.get('colorPickShortcut') !== '' && !globalShortcut.isRegistered(store.get('colorPickShortcut'))) {
        globalShortcut.register(store.get('colorPickShortcut'), captureColor);
    }

    ipcMain.handle('set-color-pick-shortcut', (event, shortcut) => {
        // Unregister previous color picking shortcut
        if (store.get('colorPickShortcut') !== '') {
            globalShortcut.unregister(store.get('colorPickShortcut'));
        }

        if (shortcut !== '') {
            // Register new color picking shortcut
            if (!globalShortcut.isRegistered(shortcut)) {
                globalShortcut.register(shortcut, captureColor);

                hasColorPickShortcutUpdated = true;
            } else {
                return false;
            }
        }

        return true;
    });

    // Ensure global shortcuts are released upon exit
    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
    });

    // Create Settings window
    ipcMain.on('open-settings', () => {
        openSettingsWindow();
    });

    // Create About window
    ipcMain.on('open-about', () => {
        openAboutWindow();
    });

    globalShortcut.register('Esc', () => {
        // Quit color picking mode
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

    // set Title Bar Overlay everytime the native theme has changed
    nativeTheme.on('updated', () => {
        setTitleBarOverlay();
    })

    setTitleBarOverlay();
});

function openAboutWindow() {
    if (!aboutWindow) {
        aboutWindow = new BrowserWindow({
            width: 320,
            height: 420,
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
                preload: path.join(__dirname, 'preload', 'settings-preload.js'),
                contextIsolation: true,
                additionalArguments: [
                    JSON.stringify({ key: 'translations', value: translations }),
                    JSON.stringify({ key: 'LLMList', value: LLMList }),
                    JSON.stringify({ key: 'isMac', value: isMac }),
                ],
            },
        });

        settingsWindow.loadFile(path.join(__dirname, 'renderer', 'pages', 'settings.html'));

        // Show when the window is ready
        settingsWindow.once('ready-to-show', () => {
            settingsWindow.show();
        });

        // Clean up references when the window is closed
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

function setTitleBarOverlay() {
    if (isMac) return;

    if (nativeTheme.shouldUseDarkColors) {
        mainWindow.setTitleBarOverlay({ color: '#3a3a3a', symbolColor: '#888888' });
    } else {
        mainWindow.setTitleBarOverlay({ color: '#ebebeb', symbolColor: '#6f6f6f' });
    }
}

const checkForUpdates = async () => {
    try {
        const response = await net.fetch('https://api.github.com/repos/Reedo0910/ColorLift/releases/latest');

        if (!response.ok) {
            throw new Error(`Failed to fetch updates. Status: ${response.status}`);
        }

        const data = await response.json();

        if (!data || !data.tag_name || !Array.isArray(data.assets) || data.assets.length === 0) {
            throw new Error('Invalid API response.');
        }

        const latestVersion = data.tag_name;
        const currentVersion = app.getVersion();

        if (semver.gt(latestVersion, currentVersion)) {
            // select file based on OS and arch
            let downloadUrl;

            switch (process.platform) {
                case 'darwin': { // macOS
                    if (process.arch === 'arm64') {
                        downloadUrl = data.assets.find(asset => asset.name.includes('macos-arm64') && asset.name.endsWith('.dmg'))?.browser_download_url;
                    } else if (process.arch === 'x64') {
                        downloadUrl = data.assets.find(asset => asset.name.includes('macos-x64') && asset.name.endsWith('.dmg'))?.browser_download_url;
                    }
                    break;
                }
                case 'win32': { // Windows
                    downloadUrl = data.assets.find(asset => asset.name.endsWith('.exe'))?.browser_download_url;
                    break;
                }
                case 'linux': { // Linux
                    downloadUrl = data.assets.find(asset => asset.name.endsWith('.AppImage'))?.browser_download_url;
                    break;
                }
                default:
                    throw new Error('Unsupported platform.');
            }

            if (!downloadUrl) {
                throw new Error('No suitable file found for the current platform or architecture.');
            }

            const result = dialog.showMessageBoxSync({
                type: 'info',
                title: translations['update_available_dialog_title'] || 'Update Available',
                message: t('update_available_dialog_message', { latestVersion }) ||
                    `A new version (${latestVersion}) is available. Would you like to download it?`,
                buttons: [
                    translations['dialog_yes_option'] || 'Yes',
                    translations['dialog_no_option'] || 'No',
                ],
            });

            if (result === 0) {
                shell.openExternal(downloadUrl);
            }
        } else {
            dialog.showMessageBoxSync({
                type: 'info',
                title: translations['no_update_dialog_title'] || 'No Updates Available',
                message: translations['no_update_dialog_message'] || 'You are using the latest version.',
            });
        }
    } catch (error) {
        console.error('Error checking for updates:', error.message);

        const alterResult = dialog.showMessageBoxSync({
            type: 'error',
            title: translations['update_error_dialog_title'] || 'Update Error',
            message: translations['update_error_dialog_message'] || 'An error occurred while checking for updates.',
            buttons: [
                translations['dialog_open_github_option'] || 'Open GitHub',
                translations['dialog_close_option'] || 'Close',
            ],
            defaultId: 0,
        });

        if (alterResult === 0) {
            shell.openExternal('https://github.com/Reedo0910/ColorLift/releases');
        }
    }
};

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Retrieve the currently stored settings
ipcMain.handle('get-settings', () => {
    return {
        apiKeys: store.get('apiKeys'),
        modelId: store.get('modelId'),
        language: store.get('language'),
        colorPickShortcut: store.get('colorPickShortcut'),
        theme: store.get('theme'),
    };
});

// Save new settings
ipcMain.on('save-settings', (event, settings) => {
    store.set('apiKeys', settings.apiKeys);
    store.set('modelId', settings.modelId);
    store.set('language', settings.language);
    store.set('colorPickShortcut', settings.colorPickShortcut);
    store.set('theme', settings.theme);

    nativeTheme.themeSource = settings.theme;

    // Notify the main window that settings have been updated
    mainWindow.webContents.send('settings-updated', { 'colorPickShortcut': settings.colorPickShortcut, 'currentTheme': nativeTheme.shouldUseDarkColors ? 'dark' : 'light' });
});

ipcMain.on('set-language', (event, lang) => {
    setLanguage(lang);
    translations = getResourceBundle(lang);

    mainWindow.webContents.send('translations-update', translations);
});

// Copy hex / description to clipboard
ipcMain.on('copy-to-clipboard', (event, text) => {
    clipboard.writeText(text);
});


// Enable color picking mode
ipcMain.on('start-capture', () => {
    isPickingColor = true;
    mainWindow.webContents.send('update-status', 'active');
});

// Exit color picking mode
ipcMain.on('stop-capture', () => {
    isPickingColor = false;
    mainWindow.webContents.send('update-status', 'inactive');
});

// Listen to cursor click event on the whole screen
app.on('browser-window-focus', () => {
    const clickListener = async () => {
        if (isPickingColor) {
            await captureColor();
        }
    };

    app.once('browser-window-blur', clickListener);
});

// Proceed picking color
const captureColor = async () => {
    if ((settingsWindow && !settingsWindow.isDestroyed()) ||
        (aboutWindow && !aboutWindow.isDestroyed())) {
        // Exit color picking mode when a modal window is opened or already open
        isPickingColor = false;
        mainWindow.webContents.send('update-status', 'inactive');
        return;
    }

    try {
        const cursorPos = screen.getCursorScreenPoint(); // Get cursor current position
        const imgBuffer = await screenshot({ format: 'png' });
        const croppedImageBuffer = await cropOnePixel(imgBuffer, cursorPos.x, cursorPos.y);

        const color = await getAverageColor(croppedImageBuffer);
        const hex = color.hex;

        // console.log('Picked Color:', hex);
        mainWindow.webContents.send('update-color', hex);

        // Exit color picking mode
        isPickingColor = false;
        mainWindow.webContents.send('update-status', 'inactive');

        const currentModelId = store.get('modelId');

        if (!currentModelId) {
            return mainWindow.webContents.send('llm-response', `||ERROR|| ${translations['error_model_invalid']}`);
        }

        const currentApiKey = getApiKeyForModel(currentModelId, LLMList, store.get('apiKeys'));

        if (!currentApiKey) {
            return mainWindow.webContents.send('llm-response', `||ERROR|| ${translations['error_api_key_invalid']}`);
        }

        const message = await LLMCommunicator(hex, getLanguage(), currentModelId, currentApiKey, translations);

        mainWindow.webContents.send('llm-response', message);
    } catch (error) {
        console.error('Error capturing color:', error);

        mainWindow.webContents.send('llm-response', `||ERROR|| ${translations['error_unhandled_error']}`);
    }
};
