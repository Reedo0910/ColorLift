const colorDisplay = document.getElementById('color-display');
const hexValue = document.getElementById('hex-value');
const LLMResponse = document.getElementById('llm-response');
const loaderDiv = document.getElementById('loader');
const captureButton = document.getElementById('capture-btn');


const colorPickingInstruction = document.getElementById('color-picking-instruction');
const colorPickingInstructionText1 = document.getElementById('color-picking-instruction-text-1');
const colorPickingInstructionText2 = document.getElementById('color-picking-instruction-text-2');

const onboardingInstruction = document.getElementById('onboarding-instruction');
const onboardingInstructionText1 = document.getElementById('onboarding-instruction-text-1');
const onboardingInstructionText2 = document.getElementById('onboarding-instruction-text-2');
const onboardingInstructionShortcutText = document.getElementById('onboarding-instruction-text-shortcut');

const clipboardDropdownButton = document.getElementById('clipboard_dropdown_button');
const clipboardDropdownMenu = document.getElementById('clipboard_dropdown_menu');

const clipboardDropdownMenuCopyCodeBtnText = document.getElementById('copy-code-btn-text');
const clipboardDropdownMenuCopyDescriptionBtnText = document.getElementById('copy-description-btn-text');

const openSettingsBtn = document.getElementById('settings-btn');
const openAboutBtn = document.getElementById('about_button');

const initTranslations = window.electronAPI.getInitTranslations();
const initTheme = window.electronAPI.getInitTheme();
const initColorPickShortcut = window.electronAPI.getInitColorPickShortcut();
const isMac = window.electronAPI.isMacOS();

setTranslations(initTranslations);
setColorPickShortcut(initColorPickShortcut);
setColorDisplay(initTheme);

let isInit = true;

instructionManager(true, 1);

function setTranslations(translations) {
    document.title = translations['app_name'];

    openAboutBtn.title = translations['about_button_title'];
    openSettingsBtn.title = translations['setting_button_title'];
    clipboardDropdownButton.title = translations['clipboard_dropdown_button_title'];

    clipboardDropdownMenuCopyCodeBtnText.textContent = translations['copy_color_code_text'];
    clipboardDropdownMenuCopyDescriptionBtnText.textContent = translations['copy_color_description_text'];

    captureButton.title = translations['enter_color_picking_mode'];
    colorPickingInstructionText1.textContent = translations['color_picking_instruction_1'];
    colorPickingInstructionText2.textContent = translations['color_picking_instruction_2'];
    onboardingInstructionText1.textContent = translations['onboarding_instruction_1'];
    onboardingInstructionText2.textContent = translations['onboarding_instruction_2'];
}

function setColorPickShortcut(shortcut) {
    if (shortcut) {
        const formattedShortcut = isMac
            ? shortcut
                .replace('CmdOrCtrl', 'Cmd') // Replace CmdOrCtrl with Cmd on macOS
                .replace('Alt', 'Option')   // Replace Alt with Option on macOS
            : shortcut
                .replace('CmdOrCtrl', 'Ctrl') // Replace CmdOrCtrl with Ctrl on Windows/Linux

        onboardingInstructionShortcutText.textContent = formattedShortcut.replace(/\+/g, ' + ');
    } else {
        if (!onboardingInstructionText2.classList.contains('invisible')) {
            onboardingInstructionText2.classList.add('invisible');
        }
        if (!onboardingInstructionShortcutText.classList.contains('invisible')) {
            onboardingInstructionShortcutText.classList.add('invisible');
        }
    }
}

function setColorDisplay(theme) {
    const isLightTheme = theme && theme === 'light';
    const myHex = isLightTheme ? '#ffffff' : '#262626';

    colorDisplay.style.backgroundColor = myHex;
    hexValue.textContent = myHex;
    colorDisplay.style.boxShadow = isLightTheme ? 'inset 3px 3px 7px #f5f5f5, inset -3px -3px 7px #ffffff' : 'inset 3px 3px 7px #202020, inset -3px -3px 7px #2c2c2c';
}

function toggleVisibility(element, isVisible) {
    if (element !== null) {
        if (isVisible) {
            if (!element.classList.contains('visible')) {
                element.classList.add('visible')
            }
        } else {
            element.classList.remove('visible')
        }
    }
}

function instructionManager(isShowInstruction = false, instructionIndex = -1) {

    resetInstructionManager();

    if (isShowInstruction) {
        // index: 0: Color Picking; 1: Onboarding
        switch (instructionIndex) {
            case 0:
                toggleVisibility(colorPickingInstruction, true);
                break;

            case 1:
                toggleVisibility(onboardingInstruction, true);

            default:
                break;
        }

    }
}

function resetInstructionManager() {
    toggleVisibility(colorPickingInstruction, false);
    toggleVisibility(onboardingInstruction, false);
}

captureButton.addEventListener('click', () => {
    if (!captureButton.classList.contains('active')) {
        window.electronAPI.startCapture();
    } else {
        window.electronAPI.stopCapture();
    }
});

window.electronAPI.onUpdateColor(hex => {
    colorDisplay.style.backgroundColor = hex;
    hexValue.textContent = hex;

    const colorDifference = 0.15;
    const darkColor = colorLuminance(hex, colorDifference * -1);
    const lightColor = colorLuminance(hex, colorDifference);
    colorDisplay.style.boxShadow = `inset 3px 3px 7px ${darkColor}, inset -3px -3px 7px  ${lightColor}`;

    LLMResponse.textContent = '';

    isInit = false;
    toggleVisibility(loaderDiv, true);

    instructionManager(false);
});

window.electronAPI.onLLMResponse((message) => {
    toggleVisibility(loaderDiv, false);

    LLMResponse.textContent = message;
});

window.electronAPI.onUpdateStatus((status) => {
    if (status === 'active') {
        captureButton.classList.add('active');

        instructionManager(true, 0);
    } else {
        captureButton.classList.remove('active');

        instructionManager(false);

        if (isInit) {
            instructionManager(true, 1);
        }
    }
});

window.electronAPI.onSettingsUpdated((customeSettings) => {
    setColorPickShortcut(customeSettings.colorPickShortcut);
    setColorDisplay(customeSettings.currentTheme);

    LLMResponse.textContent = '';

    isInit = true;
    instructionManager(true, 1);
});

window.electronAPI.onTranslationsUpdated((myTranslations) => {
    setTranslations(myTranslations);
})

// Toggle clipboard dropdown menu
clipboardDropdownButton.addEventListener('click', () => {
    clipboardDropdownMenu.classList.toggle('visible');
});

// Hide clipboard dropdown menu when clicking out of the menu
document.addEventListener('click', (event) => {
    if (!event.target.closest('.clipboard-dropdown-container')) {
        toggleVisibility(clipboardDropdownMenu, false);
    }
});


clipboardDropdownMenu.addEventListener('click', (event) => {
    const action = event.target.getAttribute('data-action');
    if (action === 'copyColor') {
        // Hex code in uppercase
        if (hexValue.textContent) {
            window.electronAPI.copyToClipboard(hexValue.textContent.toUpperCase());
        }
    } else if (action === 'copyDesc') {
        if (LLMResponse.textContent) {
            window.electronAPI.copyToClipboard(LLMResponse.textContent);
        }
    }

    setTimeout(() => {
        // Hide dropdown menu once an item is clicked
        toggleVisibility(clipboardDropdownMenu, false);
    }, 50);
});

// Open settings window
openSettingsBtn.addEventListener('click', () => {
    window.electronAPI.openSettings();
});

// Open about window
openAboutBtn.addEventListener('click', () => {
    window.electronAPI.openAbout();
});

// https://github.com/adamgiebl/neumorphism
function colorLuminance(hex, lum) {
    // validate hex string
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    lum = lum || 0;

    // convert to decimal and change luminosity
    let rgb = '#';
    for (let i = 0; i < 3; i++) {
        let c = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        c = Math.round(Math.min(Math.max(0, c + c * lum), 255)).toString(16);
        rgb += ('00' + c).slice(-2);
    }

    return rgb;
}