const { app, BrowserWindow, ipcMain, desktopCapturer, screen, globalShortcut, net } = require('electron');
const { getAverageColor } = require('fast-average-color-node')
const path = require('path');

let mainWindow;
let isPickingColor = false; // 取色模式状态

require('dotenv').config()

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
        },
    });

    mainWindow.loadFile('index.html');
    mainWindow.setSkipTaskbar(true); // 不出现在任务栏中

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
        const display = screen.getDisplayNearestPoint(cursorPos); // 找到鼠标所在的屏幕
        const { x: displayX, y: displayY, width, height } = display.bounds;
        const scaleFactor = display.scaleFactor;

        // console.log('Cursor Position:', cursorPos);
        // console.log('Display Bounds:', display.bounds);
        // console.log('Display ScaleFactor:', scaleFactor);

        const sources = await desktopCapturer.getSources(
            {
                types: ['screen'],
                thumbnailSize: {
                    width: width,
                    height: height
                }
            }
        );

        const thumbnail = sources[0].thumbnail;

        if (!thumbnail || thumbnail.isEmpty()) {
            throw new Error('Invalid thumbnail data');
        }

        const thumbnailSize = thumbnail.getSize();
        // console.log('Thumbnail Size:', thumbnailSize);

        const thumbnailScaleX = thumbnailSize.width / (width * scaleFactor);
        const thumbnailScaleY = thumbnailSize.height / (height * scaleFactor);

        let x = Math.round((cursorPos.x - displayX) * thumbnailScaleX);
        let y = Math.round((cursorPos.y - displayY) * thumbnailScaleY);

        // console.log('Scaled Cursor Position:', { x, y });

        if (x < 0 || y < 0 || x >= thumbnailSize.width || y >= thumbnailSize.height) {
            throw new Error('Cursor position is out of thumbnail bounds');
        }

        const img = thumbnail.crop({ x, y, width: 3, height: 3 });
        const pixelData = img.toPNG();

        if (!pixelData || pixelData.length < 3) {
            throw new Error('Invalid pixel data retrieved');
        }

        const base64Data = pixelData.toString('base64');
        mainWindow.webContents.send('update-img', `data:image/png;base64,${base64Data}`);

        getAverageColor(pixelData)
            .then(color => {

                const hex = color.hex;

                // console.log('Picked Color:', hex);
                mainWindow.webContents.send('update-color', hex);

                chatGPTCommunicator(hex);
            })
            .catch(err => { throw new Error(err); })
    } catch (error) {
        console.error('Error capturing color:', error);
    }
};


const chatGPTCommunicator = async (hex) => {
    // 发送 HEX 到 ChatGPT API
    const response = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: '请描述一下这个Hex所代表的颜色。输出在一个段落中。不超过130字。示例：我提供：hex 你回答：这是（一种）xxx色，它更接近xxx色，给人一种xxx的感觉，等等。' },
                { role: 'user', content: `${hex}` },
            ],
        }),
    });

    const data = await response.json();
    // console.log('ChatGPT Response:', data);

    if (response.ok) {
        const message = data.choices[0]?.message?.content || '无响应';
        // console.log('ChatGPT interpretation:', message);
        mainWindow.webContents.send('chatgpt-response', message);
    } else {
        console.error('Error from ChatGPT API:', data);
    }
}