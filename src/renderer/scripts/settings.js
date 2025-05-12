const windowTitle = document.getElementById('window-title');

const helpMessageTitle = document.getElementById('help-message-title');
const helpMessageText = document.getElementById('help-message-text');

const providerSelect = document.getElementById('provider-select');
const providerSelectLabel = document.getElementById('provider-select-label');
const providerSelectNote = document.getElementById('provider-select-note');

const apiKeyContainer = document.getElementById('api-key-container');
const apiKeyInput = document.getElementById('api-key-input');

const modelContainer = document.getElementById('model-container');
const modelSelect = document.getElementById('model-select');

const apiKeyLabel = document.getElementById('api-key-label');
const apiKeyNote = document.getElementById('api-key-note');

const modelLabel = document.getElementById('model-label');
const modelDescription = document.getElementById('model-description');

const themeSelectLabel = document.getElementById('theme-label');
const themeSelect = document.getElementById('theme-select');

const colorFormatSelectLabel = document.getElementById('color-format-label');
const colorFormatSelect = document.getElementById('color-format-select');

const languageLabel = document.getElementById('language-label');
const languageNote = document.getElementById('language-note');

const updateCheckLabel = document.getElementById('update-label');
const updateCheckCheckbox = document.getElementById('update-check');

const colorPickShortcutLabel = document.getElementById('color-pick-shortcut-label');
const colorPickShortcutNote = document.getElementById('color-pick-shortcut-note');

const saveButtonTxt = document.getElementById('save-btn-text');
const closeBtn = document.getElementById('close-btn');

const settingsForm = document.getElementById('settings-form');
const languageSelect = document.getElementById('language-select');

const colorPickShortcutInput = document.getElementById('color-pick-shortcut-input');

const toggleVisibilityBtn = document.getElementById('toggle-visibility-btn');

let apiKeys, modelId;

let isPasswordVisible = false; // 密钥是否可见

const myCurrentLanguage = '';
const myCurrentColorPickShortcut = '';

const translations = window.electronAPI.getInitTranslations();
const LLMList = window.electronAPI.getInitLLMList();
const isMac = window.electronAPI.isMacOS();

document.title = translations['setting_window_title'];

helpMessageTitle.textContent = translations['help_message_title'];

const helpMessageTextContentTemplate = translations['help_message_text'];
const dynamicLink = `<a id="readme-link" href="${translations['readme_link']}" target="_blank"><span id="github-readme-link-text">${translations['readme_link_text']}</span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M6.22 8.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v1.69a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-.75-.75h-3.5a.75.75 0 0 0 0 1.5h1.69L6.22 8.72Z" /><path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 0 0 7 4H4.75A2.75 2.75 0 0 0 2 6.75v4.5A2.75 2.75 0 0 0 4.75 14h4.5A2.75 2.75 0 0 0 12 11.25V9a.75.75 0 0 0-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5Z" /></svg></a>`;
const helpMessageTextContent = helpMessageTextContentTemplate.replace('[[readme_link_text]]', dynamicLink);

helpMessageText.innerHTML = helpMessageTextContent;

providerSelectLabel.textContent = translations['provider_select_label'];
providerSelectNote.textContent = translations['provider_select_note'];
toggleVisibilityBtn.title = translations['show_api_key_button_tooltip'];
windowTitle.textContent = translations['setting_window_title'];
apiKeyLabel.textContent = translations['api_key_label'];
apiKeyInput.placeholder = translations['api_key_placeholder'];
apiKeyNote.textContent = translations['api_key_note'];
modelLabel.textContent = translations['model_label'];
modelDescription.textContent = translations['model_description'];
colorFormatSelectLabel.textContent = translations['color_format_label'];
themeSelectLabel.textContent = translations['theme_select_label'];
languageLabel.textContent = translations['language_label'];
languageNote.textContent = translations['language_note'];
colorPickShortcutLabel.textContent = translations['color_pick_shortcut_label'];
colorPickShortcutNote.textContent = isMac ? translations['color_pick_shortcut_description_mac'] : translations['color_pick_shortcut_description'];
updateCheckLabel.textContent = translations['update_check_label'];

saveButtonTxt.textContent = translations['save_button'];
closeBtn.textContent = translations['close_button'];

// Fill the Provider dropdown menu
function populateProviderDropdown(selectedProviderId = '') {

    providerSelect.innerHTML = `<option value="">--${translations['provider_select_placeholder']}--</option>`;
    LLMList.forEach(provider => {
        const option = document.createElement('option');
        option.value = provider.id;
        option.textContent = translations[`provider_${provider.id}`] || provider.provider;
        if (provider.id === selectedProviderId) {
            option.selected = true;
        }
        providerSelect.appendChild(option);
    });
}

// Fill the Model dropdown menu
function populateModelDropdown(providerId) {
    const provider = LLMList.find(item => item.id === providerId);

    modelSelect.innerHTML = `<option value="">--${translations['model_select_placeholder']}--</option>`;
    if (provider) {
        provider.models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });
        modelContainer.style.display = 'block';
    } else {
        modelContainer.style.display = 'none';
    }
}

function populateThemeDropdown() {
    const optionList = [
        {
            text: translations['theme_select_option_system'],
            value: 'system'
        },
        {
            text: translations['theme_select_option_light'],
            value: 'light'
        },
        {
            text: translations['theme_select_option_dark'],
            value: 'dark'
        }
    ];

    themeSelect.innerHTML = '';
    optionList.forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.text;
        themeSelect.appendChild(option);
    })
}

// Initialize Provider and Model options based on the Model ID
function initializeWithModelId(modelId) {

    const provider = LLMList.find(provider =>
        provider.models.some(model => model.id === modelId)
    );
    if (provider) {
        populateProviderDropdown(provider.id);
        populateModelDropdown(provider.id);
        modelSelect.value = modelId;
        apiKeyContainer.style.display = 'block';
        apiKeyInput.value = apiKeys[provider.id] || '';
    }
}

// Provider onchange event
providerSelect.addEventListener('change', (event) => {
    const selectedProviderId = event.target.value;
    populateModelDropdown(selectedProviderId);

    // Select the first available item in the list by default
    if (selectedProviderId) {
        if (modelSelect && modelSelect.options.length >= 2) {
            modelSelect.selectedIndex = 1;
        }
    }

    // Display the API Key input box and load the current value
    if (selectedProviderId) {
        apiKeyContainer.style.display = 'block';
        apiKeyInput.value = apiKeys[selectedProviderId] || '';
    } else {
        apiKeyContainer.style.display = 'none';
        apiKeyInput.value = '';
    }
});

// API Key input event
apiKeyInput.addEventListener('input', (event) => {
    const selectedProviderId = providerSelect.value;
    if (selectedProviderId) {
        apiKeys[selectedProviderId] = event.target.value;
    }
});

// Init
populateProviderDropdown();
populateThemeDropdown();

// Load user settings
window.electronAPI.getSettings().then((settings) => {
    apiKeys = settings.apiKeys || { 'anthropic': '', 'cohere': '', 'deepseek': '', 'iflytek_spark': '', 'openai': '', 'qwen': '', 'zhipu_ai': '' };
    modelId = settings.modelId || '';

    if (modelId) {
        initializeWithModelId(modelId);
    }

    updateCheckCheckbox.checked = settings.isGetUpdateOnStart;
    themeSelect.value = settings.theme || 'system';
    languageSelect.value = settings.language || 'en';
    colorPickShortcutInput.value = getDisplayShortcut(settings.colorPickShortcut) || '';
    colorFormatSelect.value = settings.colorFormat || 'hex';

    myCurrentLanguage = languageSelect.value;
    myCurrentColorPickShortcut = colorPickShortcutInput.value;
});

// Save new user settings
settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (languageSelect.value !== myCurrentLanguage) {
        await window.electronAPI.setLanguage(languageSelect.value);
    }

    if (colorPickShortcutInput.value.trim() !== myCurrentColorPickShortcut.trim()) {
        const isSet = await window.electronAPI.setColorPickShortcut(getBackendShortcut(colorPickShortcutInput.value.trim()));

        if (!isSet) {
            return alert(translations['color_pick_shortcut_alert']);
        }
    }

    const settings = {
        apiKeys: apiKeys,
        modelId: modelSelect.value,
        language: languageSelect.value,
        colorPickShortcut: getBackendShortcut(colorPickShortcutInput.value.trim()), // use electron key format
        theme: themeSelect.value,
        isGetUpdateOnStart: updateCheckCheckbox.checked,
        colorFormat: colorFormatSelect.value
    };

    window.electronAPI.saveSettings(settings);

    // Close settings window
    window.close();
});


closeBtn.addEventListener('click', () => {
    window.close();
});

// Toggle API key visibility
toggleVisibilityBtn.addEventListener('click', () => {
    isPasswordVisible = !isPasswordVisible;

    if (isPasswordVisible) {
        apiKeyInput.type = 'text'; // Show API key

        toggleVisibilityBtn.title = translations['hide_api_key_button_tooltip'];
        toggleVisibilityBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l10.5 10.5a.75.75 0 1 0 1.06-1.06l-1.322-1.323a7.012 7.012 0 0 0 2.16-3.11.87.87 0 0 0 0-.567A7.003 7.003 0 0 0 4.82 3.76l-1.54-1.54Zm3.196 3.195 1.135 1.136A1.502 1.502 0 0 1 9.45 8.389l1.136 1.135a3 3 0 0 0-4.109-4.109Z" clip-rule="evenodd" /><path d="m7.812 10.994 1.816 1.816A7.003 7.003 0 0 1 1.38 8.28a.87.87 0 0 1 0-.566 6.985 6.985 0 0 1 1.113-2.039l2.513 2.513a3 3 0 0 0 2.806 2.806Z" /></svg>`;
    } else {
        apiKeyInput.type = 'password'; // Hide API Key

        toggleVisibilityBtn.title = translations['show_api_key_button_tooltip'];
        toggleVisibilityBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /><path fill-rule="evenodd" d="M1.38 8.28a.87.87 0 0 1 0-.566 7.003 7.003 0 0 1 13.238.006.87.87 0 0 1 0 .566A7.003 7.003 0 0 1 1.379 8.28ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clip-rule="evenodd" /></svg>`;
    }
});

// Capture the entered shortcut keys 
colorPickShortcutInput.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace') {
        colorPickShortcutInput.value = ''
    } else {
        const shortcut = getShortcutString(event);
        const displayShortcut = getDisplayShortcut(shortcut);
        colorPickShortcutInput.value = displayShortcut || colorPickShortcutInput.value;
    }
});

// Format shortcut str
function getShortcutString(event) {
    let keys = [];
    if (event.ctrlKey || event.metaKey) keys.push('CmdOrCtrl');
    if (event.shiftKey) keys.push('Shift');
    if (event.altKey) keys.push('Alt');

    let hasLetterOrDigit = false;

    if (event.code.startsWith('Key')) {
        // Get letter ("KeyA" -> "A")
        const letter = event.code.substring(3).toUpperCase();
        if (keys.length !== 0) {
            keys.push(letter);
        }
        hasLetterOrDigit = true;
    } else if (event.code.startsWith('Digit')) {
        // Get digit ("Digit1" -> "1")
        const digit = event.code.substring(5);
        if (keys.length !== 0) {
            keys.push(digit);
        }
        hasLetterOrDigit = true;
    }

    // Ensure there is at least one letter or digit in the shortcut
    if (!hasLetterOrDigit) {
        return '';
    }

    return keys.join('+');
}

// Format shortcut key based on OS
function getDisplayShortcut(shortcut) {
    return isMac
        ? shortcut
            .replace('CmdOrCtrl', 'Cmd') // macOS: CmdOrCtrl -> Cmd
            .replace('Alt', 'Option')   // macOS: Alt -> Option
        : shortcut
            .replace('CmdOrCtrl', 'Ctrl') // Windows/Linux: CmdOrCtrl -> Ctrl
}

// Transfer to Electron key format when storing shortcut
function getBackendShortcut(value) {
    return isMac
        ? value
            .replace('Cmd', 'CmdOrCtrl') // Cmd -> CmdOrCtrl
            .replace('Option', 'Alt')   // Option -> Alt
        : value
            .replace('Ctrl', 'CmdOrCtrl') // Ctrl -> CmdOrCtrl
}