const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const fs = require('fs');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
app.use(express.json());

const upload = multer({ dest: '/tmp/' });

// Helper function to cleanup files
const cleanup = (...files) => {
  files.forEach(file => {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
};

// 1. Image(s) + Audio = Video (audio length)
app.post('/image-audio', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), (req, res) => {
  const imagePath = req.files.image[0].path;
  const audioPath = req.files.audio[0].path;
  const outputPath = `/tmp/output-${Date.now()}.mp4`;

  ffmpeg()
    .input(imagePath)
    .loop(1)
    .input(audioPath)
    .outputOptions([
      '-c:v libx264',
      '-tune stillimage',
      '-c:a aac',
      '-b:a 192k',
      '-pix_fmt yuv420p',
      '-shortest',
      '-preset ultrafast'
    ])
    .output(outputPath)
    .on('end', () => {
      res.download(outputPath, 'output.mp4', () => {
        cleanup(imagePath, audioPath, outputPath);
      });
    })
    .on('error', (err) => {
      console.error(err);
      cleanup(imagePath, audioPath, outputPath);
      res.status(500).json({ error: 'Error processing video', details: err.message });
    })
    .run();
});

// 2. Multiple Images = Slideshow Video
app.post('/slideshow', upload.array('images', 20), (req, res) => {
  const imagePaths = req.files.map(f => f.path);
  const duration = parseFloat(req.body.duration) || 3; // seconds per image
  const outputPath = `/tmp/slideshow-${Date.now()}.mp4`;
  const listPath = `/tmp/list-${Date.now()}.txt`;

  // Create concat file list
  const listContent = imagePaths.map(p => `file '${p}'\nduration ${duration}`).join('\n') + `\nfile '${imagePaths[imagePaths.length - 1]}'`;
  fs.writeFileSync(listPath, listContent);

  ffmpeg()
    .input(listPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions([
      '-vsync vfr',
      '-pix_fmt yuv420p',
      '-c:v libx264',
      '-preset ultrafast'
    ])
    .output(outputPath)
    .on('end', () => {
      res.download(outputPath, 'slideshow.mp4', () => {
        cleanup(...imagePaths, listPath, outputPath);
      });
    })
    .on('error', (err) => {
      console.error(err);
      cleanup(...imagePaths, listPath, outputPath);
      res.status(500).json({ error: 'Error creating slideshow', details: err.message });
    })
    .run();
});

// 3. Video1 + Video2 = Concatenated Video
app.post('/concat-videos', upload.fields([
  { name: 'video1', maxCount: 1 },
  { name: 'video2', maxCount: 1 }
]), (req, res) => {
  const video1Path = req.files.video1[0].path;
  const video2Path = req.files.video2[0].path;
  const outputPath = `/tmp/concat-${Date.now()}.mp4`;
  const listPath = `/tmp/concat-list-${Date.now()}.txt`;

  // Create concat file
  const listContent = `file '${video1Path}'\nfile '${video2Path}'`;
  fs.writeFileSync(listPath, listContent);

  ffmpeg()
    .input(listPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions([
      '-c copy'
    ])
    .output(outputPath)
    .on('end', () => {
      res.download(outputPath, 'concatenated.mp4', () => {
        cleanup(video1Path, video2Path, listPath, outputPath);
      });
    })
    .on('error', (err) => {
      console.error(err);
      cleanup(video1Path, video2Path, listPath, outputPath);
      res.status(500).json({ error: 'Error concatenating videos', details: err.message });
    })
    .run();
});

// 4. Video + Audio = Video with new/background audio
app.post('/video-audio', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), (req, res) => {
  const videoPath = req.files.video[0].path;
  const audioPath = req.files.audio[0].path;
  const mode = req.body.mode || 'replace'; // 'replace' or 'background'
  const outputPath = `/tmp/video-audio-${Date.now()}.mp4`;

  let command = ffmpeg()
    .input(videoPath)
    .input(audioPath);

  if (mode === 'replace') {
    // Replace original audio
    command.outputOptions([
      '-c:v copy',
      '-c:a aac',
      '-b:a 192k',
      '-map 0:v:0',
      '-map 1:a:0',
      '-shortest'
    ]);
  } else {
    // Mix audio (background music)
    command.complexFilter([
      '[0:a][1:a]amix=inputs=2:duration=shortest[aout]'
    ])
    .outputOptions([
      '-c:v copy',
      '-map 0:v:0',
      '-map [aout]',
      '-c:a aac',
      '-b:a 192k'
    ]);
  }

  command
    .output(outputPath)
    .on('end', () => {
      res.download(outputPath, 'video-with-audio.mp4', () => {
        cleanup(videoPath, audioPath, outputPath);
      });
    })
    .on('error', (err) => {
      console.error(err);
      cleanup(videoPath, audioPath, outputPath);
      res.status(500).json({ error: 'Error processing video', details: err.message });
    })
    .run();
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'FFmpeg Service Running',
    version: '1.0.0',
    endpoints: {
      '/image-audio': 'POST - Combine image and audio into video',
      '/slideshow': 'POST - Create slideshow from multiple images',
      '/concat-videos': 'POST - Concatenate two videos',
      '/video-audio': 'POST - Add audio to video (replace or background)'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎬 FrameFusion API running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
});
