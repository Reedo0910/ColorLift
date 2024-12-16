const windowTitle = document.getElementById('window-title');

const apiKeyLabel = document.getElementById('api-key-label');
const apiKeyNote = document.getElementById('api-key-note');

const gptModelLabel = document.getElementById('gpt-model-label');
const gptModelDescription = document.getElementById('gpt-model-description');

const languageLabel = document.getElementById('language-label');
const languageNote = document.getElementById('language-note');

const colorPickShortcutLabel = document.getElementById('color-pick-shortcut-label');
const colorPickShortcutNote = document.getElementById('color-pick-shortcut-note');

const saveButtonTxt = document.getElementById('save-btn-text');
const closeBtn = document.getElementById('close-btn');

const settingsForm = document.getElementById('settings-form');
const gptModelSelect = document.getElementById('gpt-model-select');
const languageSelect = document.getElementById('language-select');

const apiKeyInput = document.getElementById('api-key-input');
const colorPickShortcutInput = document.getElementById('color-pick-shortcut-input');

const toggleVisibilityBtn = document.getElementById('toggle-visibility-btn');

let isPasswordVisible = false; // 密钥是否可见

const myCurrentLanguage = '';
const myCurrentColorPickShortcut = '';

const translations = window.electronAPI.getInitialTranslations();

document.title = translations['setting_window_title'];

toggleVisibilityBtn.title = translations['show_api_key_button_tooltip'];
windowTitle.textContent = translations['setting_window_title'];
apiKeyLabel.textContent = translations['api_key_label'];
apiKeyNote.textContent = translations['api_key_note'];
gptModelLabel.textContent = translations['gpt_model_label'];
gptModelDescription.textContent = translations['gpt_model_description'];
languageLabel.textContent = translations['language_label'];
languageNote.textContent = translations['language_note'];
colorPickShortcutLabel.textContent = translations['color_pick_shortcut_label'];
colorPickShortcutNote.textContent = translations['color_pick_shortcut_description'];

saveButtonTxt.textContent = translations['save_button'];
closeBtn.textContent = translations['close_button'];

// 加载当前设置
window.electronAPI.getSettings().then((settings) => {
    apiKeyInput.value = settings.apiKey || '';
    gptModelSelect.value = settings.gptModel || 'gpt-4o-mini';
    languageSelect.value = settings.language || 'en';
    colorPickShortcutInput.value = settings.colorPickShortcut || '';

    myCurrentLanguage = languageSelect.value;
    myCurrentColorPickShortcut = colorPickShortcutInput.value;
});

// 保存新的设置
settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (languageSelect.value !== myCurrentLanguage) {
        await window.electronAPI.setLanguage(languageSelect.value);
    }

    if (colorPickShortcutInput.value.trim() !== myCurrentColorPickShortcut.trim()) {
        const isSet = await window.electronAPI.setColorPickShortcut(colorPickShortcutInput.value.trim());

        if (!isSet) {
            return alert(translations['color_pick_shortcut_alert']);
        }
    }

    const settings = {
        apiKey: apiKeyInput.value.trim(),
        gptModel: gptModelSelect.value,
        language: languageSelect.value,
        colorPickShortcut: colorPickShortcutInput.value.trim()
    };

    window.electronAPI.saveSettings(settings);

    // 关闭设置窗口
    window.close();
});

// 关闭按钮事件
closeBtn.addEventListener('click', () => {
    window.close();
});

// 切换密钥可见性
toggleVisibilityBtn.addEventListener('click', () => {
    isPasswordVisible = !isPasswordVisible;

    if (isPasswordVisible) {
        apiKeyInput.type = 'text'; // 显示密钥

        toggleVisibilityBtn.title = translations['hide_api_key_button_tooltip'];
        toggleVisibilityBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l10.5 10.5a.75.75 0 1 0 1.06-1.06l-1.322-1.323a7.012 7.012 0 0 0 2.16-3.11.87.87 0 0 0 0-.567A7.003 7.003 0 0 0 4.82 3.76l-1.54-1.54Zm3.196 3.195 1.135 1.136A1.502 1.502 0 0 1 9.45 8.389l1.136 1.135a3 3 0 0 0-4.109-4.109Z" clip-rule="evenodd" /><path d="m7.812 10.994 1.816 1.816A7.003 7.003 0 0 1 1.38 8.28a.87.87 0 0 1 0-.566 6.985 6.985 0 0 1 1.113-2.039l2.513 2.513a3 3 0 0 0 2.806 2.806Z" /></svg>`;
    } else {
        apiKeyInput.type = 'password'; // 隐藏密钥

        toggleVisibilityBtn.title = translations['show_api_key_button_tooltip'];
        toggleVisibilityBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /><path fill-rule="evenodd" d="M1.38 8.28a.87.87 0 0 1 0-.566 7.003 7.003 0 0 1 13.238.006.87.87 0 0 1 0 .566A7.003 7.003 0 0 1 1.379 8.28ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clip-rule="evenodd" /></svg>`;
    }
});

// 监听键盘事件，捕获用户输入的快捷键
colorPickShortcutInput.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace') {
        colorPickShortcutInput.value = ''
    } else {
        const shortcut = getShortcutString(event);
        colorPickShortcutInput.value = shortcut || colorPickShortcutInput.value;
    }
});

// 处理快捷键字符串的格式
function getShortcutString(event) {
    let keys = [];
    if (event.ctrlKey || event.metaKey) keys.push('CmdOrCtrl');
    if (event.shiftKey) keys.push('Shift');
    if (event.altKey) keys.push('Alt');

    if (event.code.startsWith('Key')) {
        // Key后跟的字母即按下的字母键
        const letter = event.code.substring(3).toUpperCase();
        if (keys.length !== 0) {
            keys.push(letter);
        }
    } else if (event.code.startsWith('Digit')) {
        // Digit后跟的数字即按下的数字键
        const digit = event.code.substring(5);
        if (keys.length !== 0) {
            keys.push(digit);
        }
    }

    return keys.join('+');
}