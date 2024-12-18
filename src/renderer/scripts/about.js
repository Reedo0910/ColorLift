const closeBtn = document.getElementById('close-btn');

const appVersion = window.electronAPI.getAppVersion();

document.getElementById('version').textContent = appVersion;

closeBtn.addEventListener('click', () => {
    window.close();
});