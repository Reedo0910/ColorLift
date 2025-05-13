import { app, Menu, BrowserWindow, ipcMain, screen, nativeTheme, globalShortcut, clipboard, shell, net, dialog } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import screenshot from 'screenshot-desktop';
import { getAverageColor } from 'fast-average-color-node';
import { cropOnePixel, getApiKeyForModel, getAppLocale } from './utils/utils.js'
import { setLanguage, getLanguage, getResourceBundle, t } from './utils/i18n.js';
import { LLMCommunicator, LLMList, ReqTypeList } from './utils/llms-interface.js';
import electronSquirrelStartup from 'electron-squirrel-startup';
import semver from 'semver';
import convert from 'color-convert';
import colorString from 'color-string'

// Define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let settingsWindow;
let aboutWindow;
let isPickingColor = false; // Color picking state
let hasColorPickShortcutUpdated = false;
let isMultipleDisplays = false;
let electronDisplays = [];
let screenshotDisplays = [];

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
        windowBounds: {
            width: 345,
            height: 480,
            x: undefined,
            y: undefined
        },
        apiKeys: {
            'anthropic': '',
            'cohere': '',
            'deepseek': '',
            'google': '',
            'iflytek_spark': '',
            'openai': '',
            'qwen': '',
            'zhipu_ai': '',
            'custom': ''
        },
        modelId: '',
        customReqTypeId: '',
        customEndpoint: '',
        customModelId: '', // for persistent settings storage use only
        language: appLocale,
        colorPickShortcut: isMac ? 'Alt+C' : 'Alt+D',
        theme: 'system',
        isGetUpdateOnStart: false,
        colorFormat: 'hex', // hex, rgb, hsl
        promptComponents: {
            isShowColorImpression: true,
            isShowColorScenario: true
        }
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
    const { width, height, x, y } = getSafeBounds();

    mainWindow = new BrowserWindow({
        width,
        height,
        x,
        y,
        minHeight: 292,
        minWidth: 325,
        maxHeight: 535,
        maxWidth: 375,
        maximizable: false,
        // transparent: true,
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
                JSON.stringify({ key: 'isAcrylicSupport', value: semver.gte(process.getSystemVersion(), '10.0.22621') && process.platform === 'win32' }),
                JSON.stringify({ key: 'colorFormat', value: store.get('colorFormat') }),
                JSON.stringify({ key: 'language', value: store.get('language') }),
            ],
        },
    });

    if (!isMac) {
        mainWindow.setBackgroundMaterial('acrylic');
    }

    // mainWindow.setBackgroundColor('rgba(255, 255, 255, 0.8)');

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'pages', 'index.html'));

    // mainWindow.webContents.openDevTools(); // Open DevTools

    // mainWindow.setSkipTaskbar(true); // Hide in task bar

    // Check for updates in the background on app starts
    mainWindow.once('ready-to-show', () => {
        // delay for 1 seconds
        setTimeout(() => {
            if (store.get('isGetUpdateOnStart')) {
                checkForUpdates(true);
            }
        }, 1000);
    });

    mainWindow.on('close', (event) => {
        // save mainwindow's size and position when app closes
        const bounds = mainWindow.getBounds();
        store.set('windowBounds', bounds);

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

    // get display count
    updateDisplayCount();

    // listen to screen adds/removes
    screen.on('display-added', updateDisplayCount);
    screen.on('display-removed', updateDisplayCount);

});

// Prevent Mainwindow being offscreen when loaded
function getSafeBounds() {
    const saved = store.get('windowBounds');
    const { width, height } = saved;
    let { x, y } = saved;

    const displays = screen.getAllDisplays();
    const inSomeDisplay = displays.some(d => {
        const { bounds } = d;      // {x, y, width, height}
        return x >= bounds.x &&
            y >= bounds.y &&
            x < bounds.x + bounds.width &&
            y < bounds.y + bounds.height;
    });

    // fallback to screen center if the main window is completely offscreen
    if (!inSomeDisplay) {
        const primaryBounds = screen.getPrimaryDisplay().workArea;
        x = primaryBounds.x + (primaryBounds.width - width) / 2;
        y = primaryBounds.y + (primaryBounds.height - height) / 2;
    }

    return { x, y, width, height };
}

// if multiple screens in used
async function updateDisplayCount() {
    const displays = screen.getAllDisplays();
    isMultipleDisplays = (displays.length > 1);

    electronDisplays = displays;
    screenshotDisplays = await screenshot.listDisplays();
}

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

        // aboutWindow.webContents.openDevTools(); // Open DevTools for about

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
            height: 515,
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
                    JSON.stringify({ key: 'ReqTypeList', value: ReqTypeList }),
                    JSON.stringify({ key: 'isMac', value: isMac }),
                ],
            },
        });

        // settingsWindow.webContents.openDevTools(); // Open DevTools for settings

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
        mainWindow.setTitleBarOverlay({ color: '#32323200', symbolColor: '#a8a8a8' });
    } else {
        mainWindow.setTitleBarOverlay({ color: '#f8f8f800', symbolColor: '#6f6f6f' });
    }
}

const checkForUpdates = async (isSilentUpdate = false) => {
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

            const result = dialog.showMessageBoxSync(((isMac || !mainWindow) ? null : mainWindow), {
                type: 'info',
                title: translations['update_available_dialog_title'] || 'Update Available',
                message: t('update_available_dialog_message', { latestVersion }) ||
                    `A new version (${latestVersion}) is available. Would you like to download it?`,
                buttons: [
                    translations['dialog_yes_option'] || 'Yes',
                    translations['dialog_no_option'] || 'No',
                ],
                cancelId: 1,
            });

            if (result === 0) {
                shell.openExternal(downloadUrl);
            }
        } else {
            if (isSilentUpdate) return;

            dialog.showMessageBoxSync(((isMac || !mainWindow) ? null : mainWindow), {
                type: 'info',
                title: translations['no_update_dialog_title'] || 'No Updates Available',
                message: translations['no_update_dialog_message'] || 'You are using the latest version.',
            });
        }
    } catch (error) {
        console.error('Error checking for updates:', error.message);

        if (isSilentUpdate) return;

        const alterResult = dialog.showMessageBoxSync(((isMac || !mainWindow) ? null : mainWindow), {
            type: 'error',
            title: translations['update_error_dialog_title'] || 'Update Error',
            message: translations['update_error_dialog_message'] || 'An error occurred while checking for updates.',
            buttons: [
                translations['dialog_open_github_option'] || 'Open GitHub',
                translations['dialog_close_option'] || 'Close',
            ],
            defaultId: 0,
            cancelId: 1,
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
        customReqTypeId: store.get('customReqTypeId'),
        customEndpoint: store.get('customEndpoint'),
        customModelId: store.get('customModelId'),
        language: store.get('language'),
        colorPickShortcut: store.get('colorPickShortcut'),
        theme: store.get('theme'),
        isGetUpdateOnStart: store.get('isGetUpdateOnStart'),
        colorFormat: store.get('colorFormat'),
        promptComponents: store.get('promptComponents'),
    };
});

// Save new settings
ipcMain.on('save-settings', (event, settings) => {
    store.set('apiKeys', settings.apiKeys);
    store.set('modelId', settings.modelId);
    store.set('customReqTypeId', settings.customReqTypeId);
    store.set('customEndpoint', settings.customEndpoint);
    store.set('customModelId', settings.customModelId);
    store.set('language', settings.language);
    store.set('colorPickShortcut', settings.colorPickShortcut);
    store.set('theme', settings.theme);
    store.set('isGetUpdateOnStart', settings.isGetUpdateOnStart);
    store.set('colorFormat', settings.colorFormat);
    store.set('promptComponents', settings.promptComponents);

    nativeTheme.themeSource = settings.theme;

    // Notify the main window that settings have been updated
    mainWindow.webContents.send('settings-updated',
        {
            'colorPickShortcut': settings.colorPickShortcut,
            'currentTheme': nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
            'colorFormat': settings.colorFormat,
            'language': settings.language
        });
});

ipcMain.on('set-language', (event, lang) => {
    setLanguage(lang);
    translations = getResourceBundle(lang);

    mainWindow.webContents.send('translations-update', translations);
});

// Copy color code / description to clipboard
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

const clickListener = async () => {
    if (isPickingColor) {
        await captureColor();
    }
};

// Listen to cursor click event on the whole screen (once at a time)
app.on('browser-window-focus', () => {
    app.removeListener('browser-window-blur', clickListener);
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

        const currentDisplay = isMultipleDisplays ? screen.getDisplayNearestPoint(cursorPos) : screen.getPrimaryDisplay();

        // Calculate relative and physical cursor position
        const relativeX = cursorPos.x - currentDisplay.bounds.x;
        const relativeY = cursorPos.y - currentDisplay.bounds.y;
        const physicalX = Math.floor(relativeX * currentDisplay.scaleFactor);
        const physicalY = Math.floor(relativeY * currentDisplay.scaleFactor);

        let targetScreenIndex = 0;

        // if multiple displays exist
        if (isMultipleDisplays) {
            // Caveat: if screen label mismatch, using this index as fallback.
            // However, this is assuming the item order of the list of screen.getAllDisplays() is aligned with screenshot.listDisplays()
            // If this issue (multi-monitor supports) persists, consider asking users in the setting panel to manually map monitors
            let displayIndex = electronDisplays.findIndex(d => d.id === currentDisplay.id);

            if (displayIndex < 0 || displayIndex >= screenshotDisplays.length) {
                displayIndex = 0;

                throw new Error('No corresponding display in screens list');
            }

            // Default to the matched display index
            targetScreenIndex = displayIndex;

            const targetScreen = screenshotDisplays.find(screen => screen.name === currentDisplay.label);

            if (targetScreen) {
                targetScreenIndex = targetScreen.id;
            } else if (currentDisplay.internal && isMac) {
                const internalScreen = screenshotDisplays.find(screen => screen.name === 'Color LCD');

                if (internalScreen) {
                    targetScreenIndex = internalScreen.id;
                } else {
                    console.error(`Unknown internal screen label: ${currentDisplay.label}`);
                }
            } else {
                console.error(`Screenshot display not found. (Target: ${currentDisplay.label})`);
            }
        }

        // Capture screenshot and process the image
        const imgBuffer = await screenshot({ screen: targetScreenIndex, format: 'png' });
        const croppedImageBuffer = await cropOnePixel(imgBuffer, physicalX, physicalY);
        const color = await getAverageColor(croppedImageBuffer);
        const hex = color.hex;
        const rgbValue = colorString.get(hex).value;  // e.g., {model: 'rgb', value: [255, 255, 255, 1]}, see https://github.com/Qix-/color-string
        const rgb = colorString.to.rgb(rgbValue);
        const hsl = colorString.to.hsl(convert.rgb.hsl(rgbValue));

        const colorObj = { hex, hsl, rgb };

        // console.log('Picked Color:', hex);
        mainWindow.webContents.send('update-color', colorObj);

        // Exit color picking mode
        isPickingColor = false;
        mainWindow.webContents.send('update-status', 'inactive');

        const currentModelId = store.get('modelId');
        if (!currentModelId ||
            (currentModelId.startsWith('custom@') && currentModelId.slice(7) === '')) {
            return mainWindow.webContents.send('llm-response', `||ERROR|| ${translations['error_model_invalid']}`);
        }

        const currentApiKey = getApiKeyForModel(currentModelId, LLMList, store.get('apiKeys'));

        if (!currentApiKey) {
            return mainWindow.webContents.send('llm-response', `||ERROR|| ${translations['error_api_key_invalid']}`);
        }

        const currentPromptComponents = store.get('promptComponents');

        const message = await LLMCommunicator(colorObj, currentModelId, currentApiKey, currentPromptComponents, translations, store.get('customReqTypeId'), store.get('customEndpoint'));

        mainWindow.webContents.send('llm-response', message);
    } catch (error) {
        console.error('Error capturing color:', error);

        const errorMessage = (error && error.message) ? `(${error.message})` : '';

        mainWindow.webContents.send(
            'llm-response',
            `||ERROR|| ${translations['error_unhandled_error']} ${errorMessage}`);
    }
};
