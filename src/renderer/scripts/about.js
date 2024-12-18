const windowTitle = document.getElementById('window-title');

const appNameText = document.getElementById('app-name');
const versionText = document.getElementById('version-text');
const openSourceStatementText = document.getElementById('open-source-statement');
const disclaimerStatementText = document.getElementById('disclaimer-statement');
const githubLinkText = document.getElementById('github-link-text');

const closeBtn = document.getElementById('close-btn');
const updateBtn = document.getElementById('update-btn');

const translations = window.electronAPI.getInitTranslations();
const appVersion = window.electronAPI.getAppVersion();

document.getElementById('version').textContent = appVersion;

document.title = translations['about_window_title'];

windowTitle.textContent = translations['about_window_title'];
appNameText.textContent = translations['app_name'];
versionText.textContent = translations['version_text'];
openSourceStatementText.textContent = translations['open_source_statement'];
disclaimerStatementText.textContent = translations['disclaimer_statement'];
githubLinkText.textContent = translations['github_link_text'];
updateBtn.textContent = translations['check_for_update_button_text'];
closeBtn.textContent = translations['close_button'];

closeBtn.addEventListener('click', () => {
    window.close();
});

updateBtn.addEventListener('click', () => {
    window.electronAPI.checkForUpdates();
});