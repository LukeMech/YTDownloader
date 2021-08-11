const { ipcRenderer } = require("electron");
const ytdl = require("ytdl-core")

const yturl = document.getElementById('yt-url')

document.getElementById('settings').src="images/settings.png"

document.getElementById('settings').addEventListener('click', () => {
  ipcRenderer.invoke('browserWindow', __dirname + '/settings/settings.html', 430, 600, false, true)
})

const ifvalid = document.getElementById('ifvalid')

yturl.addEventListener('input', () => {
  const valid = ytdl.validateURL(yturl.value)
  if (valid) {
    ifvalid.innerHTML = '🔮 Convert'
    ifvalid.classList.add('btn')
    ifvalid.classList.remove('hidden-btn')
  } else {
    ifvalid.innerHTML = '❌ NOPE'
    ifvalid.classList.add('hidden-btn')
    ifvalid.classList.remove('btn')
  }
})

ifvalid.addEventListener('click', async () => {
  if (ifvalid.classList.contains('hidden-btn')) return;
  yturl.setAttribute('readonly', 'true')
  ipcRenderer.invoke('browserWindow', __dirname + '/convert/convert.html', 560, 600, false, true, yturl.value)
})

function opensite(site) {
  require("electron").shell.openExternal(site)
}