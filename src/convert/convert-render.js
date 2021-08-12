// Buildin with nodejs
const cp = require('child_process');
const fs = require('fs')

// External modules
const { ipcRenderer } = require("electron");
const prettyMilliseconds = require("pretty-ms");
const ytdl = require("ytdl-core");
const ffmpeg = require('ffmpeg-static').replace('app.asar','app.asar.unpacked');

const mp3button = document.getElementById('mp3')
const mp4button = document.getElementById('mp4')

function buttons (hide) {
  if (hide === true) {
    mp4button.classList.remove('button')
    mp4button.classList.add('hidden')
    mp3button.classList.remove('button')
    mp3button.classList.add('hidden')
  }
  else {
    mp3button.classList.remove('hidden')
    mp4button.classList.remove('hidden')
    mp3button.classList.add('button')
    mp4button.classList.add('button')
  }
}

let yturl, videoinfo
ipcRenderer.on('from-other-renderer', async (a, yt) => {
  yturl = yt

  const error = function() {
    document.getElementById('video-img').src='../images/error.png'
    document.getElementById('video-title').innerHTML='Error, cannot parse video'
    document.getElementById('video-length').innerHTML='Not available'
    return;
  }

  try {
    const parseerror = setTimeout(() => {
      error()
    }, 10000);
    const video = await ytdl.getBasicInfo(yt)
    videoinfo = video.videoDetails
    document.getElementById('video-img').src=videoinfo.thumbnails[0].url
    document.getElementById('video-title').innerHTML=videoinfo.title
    document.getElementById('video-length').innerHTML=`Length: ${prettyMilliseconds(videoinfo.lengthSeconds * 1000)}`
    buttons()
    clearTimeout(parseerror);
  } 
  catch (err) {
    error()
  }
})

mp3button.addEventListener('click', () => {
  if (mp3button.classList.contains('hidden')) return;
  downloadvideo('mp3')
})

mp4button.addEventListener('click', () => {
  if (mp3button.classList.contains('hidden')) return;
  downloadvideo('mp4', 'highest', 'ultrafast')
})

function downloadvideo (format, quality, encodespeed) {
  ipcRenderer.invoke('askForDownload', `${videoinfo.title}.${format}`).then(async location => {
    if (location.canceled) return;
    buttons(true)

    let mp3speed = document.getElementById('mp3-download')

    if (format === 'wav' || format === 'mp3') {
      const tracker = {
        start: Date.now(),
        audio: { downloaded: 0, total: Infinity },
      }

      let progressbarHandle = null;
      const progressbarInterval = 1000;
      const showProgress = () => {
        const toMB = i => (i / 1024 / 1024).toFixed(2);
        mp3speed.innerHTML = `Audio  | ${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}% processed (${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB)`;
      };

      const audio = ytdl(yturl, { filter: 'audioonly', quality: 'highestaudio' })
        .on('progress', (_, downloaded, total) => {
          if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
          tracker.audio = { downloaded, total };
        });

        // Start the ffmpeg child process
      const ffmpegProcess = cp.spawn(ffmpeg, [
        // Remove ffmpeg's console spamming
        '-loglevel', '0', '-hide_banner',
        // Set inputs
        '-i', 'pipe:3',
        // Keep encoding
        '-c:a', 'copy',
        // Define output container
        '-f', 'matroska', 'pipe:3',
        ], {
        windowsHide: true,
        stdio: [
          // Standard: stdin, stdout, stderr 
          'inherit', 'inherit', 'inherit',
          // Custom: pipe:3
          'pipe'
        ],
      });

      ffmpegProcess.on('close', () => {
        // Cleanup
        clearInterval(progressbarHandle);
        fs.copyFileSync(`temp`, location.filePath)
        fs.unlinkSync(`temp`)
        mp3speed.innerHTML = `Audio ready`;
        buttons()
      });

      ffmpegProcess.stdio[3].pipe(fs.createWriteStream(`temp`));
      audio.pipe(ffmpegProcess.stdio[3]);
      
      return;
    }

    let mp4speed = document.getElementById('mp4-download')
    let merged = document.getElementById('merged')

    const tracker = {
      start: Date.now(),
      audio: { downloaded: 0, total: Infinity },
      video: { downloaded: 0, total: Infinity },
      merged: { frame: 0, speed: '0x', fps: 0 },
    };

    // Get audio and video streams
    const audio = ytdl(yturl, { filter: 'audioonly', quality: 'highestaudio' })
      .on('progress', (_, downloaded, total) => {
        tracker.audio = { downloaded, total };
      });
    const video = ytdl(yturl, { filter: 'videoonly', quality: `${quality}video` })
      .on('progress', (_, downloaded, total) => {
        tracker.video = { downloaded, total };
      });

    // Prepare the progress bar
    let progressbarHandle = null;
    const progressbarInterval = 1000;
    const showProgress = () => {
      const toMB = i => (i / 1024 / 1024).toFixed(2);

      mp3speed.innerHTML = `Audio  | ${(tracker.audio.downloaded / tracker.audio.total * 100).toFixed(2)}% processed (${toMB(tracker.audio.downloaded)}MB of ${toMB(tracker.audio.total)}MB)`;

      mp4speed.innerHTML = `Video  | ${(tracker.video.downloaded / tracker.video.total * 100).toFixed(2)}% processed (${toMB(tracker.video.downloaded)}MB of ${toMB(tracker.video.total)}MB)`;

      merged.innerHTML = `Merged | processing frame ${tracker.merged.frame} (at ${tracker.merged.fps} fps => ${tracker.merged.speed})`

     // process.stdout.write(`running for: ${((Date.now() - tracker.start) / 1000 / 60).toFixed(2)} Minutes.`);
    };

    // Start the ffmpeg child process
    const ffmpegProcess = cp.spawn(ffmpeg, [
    // Remove ffmpeg's console spamming
    '-loglevel', '8', '-hide_banner',
    // Redirect/Enable progress messages
    '-progress', 'pipe:3',
    // Set inputs
    '-i', 'pipe:4',
    '-i', 'pipe:5',
    // Map audio & video from streams
    '-map', '0:a',
    '-map', '1:v',
    // Keep encoding
    '-c:a', 'copy',
    '-preset', encodespeed, '-tune', 'fastdecode',
    // Define output container
    '-f', 'matroska', 'pipe:5',
    ], {
    windowsHide: true,
    stdio: [
      /* Standard: stdin, stdout, stderr */
      'inherit', 'inherit', 'inherit',
      /* Custom: pipe:3, pipe:4, pipe:5 */
      'pipe', 'pipe', 'pipe',
    ],
    });

    ffmpegProcess.on('close', () => {
      // Cleanup
      clearInterval(progressbarHandle);
      fs.copyFileSync(`temp`, location.filePath)
      fs.unlinkSync(`temp`)
      mp3speed.innerHTML = `Video ready`;
      mp4speed.innerHTML = ''
      merged.innerHTML = ''
      buttons()
    });

    // Link streams
    // FFmpeg creates the transformer streams and we just have to insert / read data
    ffmpegProcess.stdio[3].on('data', chunk => {
      // Start the progress bar
      if (!progressbarHandle) progressbarHandle = setInterval(showProgress, progressbarInterval);
      // Parse the param=value list returned by ffmpeg
      const lines = chunk.toString().trim().split('\n');
      const args = {};
      for (const l of lines) {
        const [key, value] = l.split('=');
        args[key.trim()] = value.trim();
      }
      tracker.merged = args;
    });
    ffmpegProcess.stdio[5].pipe(fs.createWriteStream(`temp`));
    audio.pipe(ffmpegProcess.stdio[4]);
    video.pipe(ffmpegProcess.stdio[5]);
  })
}