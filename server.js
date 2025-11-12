const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
app.use(express.json());

const upload = multer({ dest: '/tmp/' });

// Helper function to cleanup files
const cleanup = (...files) => {
  files.forEach(file => {
    if (file && fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        console.error('Cleanup error:', e.message);
      }
    }
  });
};

// Helper function to download file from URL
const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
    
    file.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

// Helper function to get file path (from upload or URL)
const getFilePath = async (fileFromUpload, urlFromBody, fieldName) => {
  if (fileFromUpload) {
    return fileFromUpload.path;
  } else if (urlFromBody) {
    const ext = path.extname(urlFromBody.split('?')[0]) || '.tmp';
    const tempPath = `/tmp/${fieldName}-${Date.now()}${ext}`;
    await downloadFile(urlFromBody, tempPath);
    return tempPath;
  }
  throw new Error(`No ${fieldName} provided (file or URL)`);
};

// 1. Image + Audio = Video (audio length) - FIXED
app.post('/image-audio', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  let imagePath, audioPath;
  const outputPath = `/tmp/output-${Date.now()}.mp4`;

  try {
    imagePath = await getFilePath(
      req.files?.image?.[0],
      req.body.imageUrl,
      'image'
    );
    
    audioPath = await getFilePath(
      req.files?.audio?.[0],
      req.body.audioUrl,
      'audio'
    );

    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1'])
      .input(audioPath)
      .outputOptions([
        '-c:v libx264',
        '-tune stillimage',
        '-c:a aac',
        '-b:a 192k',
        '-pix_fmt yuv420p',
        '-shortest',
        '-preset ultrafast',
        '-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'
      ])
      .output(outputPath)
      .on('end', () => {
        res.download(outputPath, 'output.mp4', () => {
          cleanup(imagePath, audioPath, outputPath);
        });
      })
      .on('error', (err) => {
        console.error('Image+Audio Error:', err);
        cleanup(imagePath, audioPath, outputPath);
        res.status(500).json({ error: 'Error processing video', details: err.message });
      })
      .run();
  } catch (err) {
    console.error('Image+Audio Setup Error:', err);
    cleanup(imagePath, audioPath, outputPath);
    res.status(400).json({ error: err.message });
  }
});

// 2. Multiple Images = Slideshow Video - FIXED
app.post('/slideshow', upload.array('images', 20), async (req, res) => {
  let imagePaths = [];
  const outputPath = `/tmp/slideshow-${Date.now()}.mp4`;
  const listPath = `/tmp/list-${Date.now()}.txt`;

  try {
    // Handle uploaded files
    if (req.files && req.files.length > 0) {
      imagePaths = req.files.map(f => f.path);
    }
    
    // Handle URLs from body (JSON array or comma-separated string)
    if (req.body.imageUrls) {
      const urls = Array.isArray(req.body.imageUrls) 
        ? req.body.imageUrls 
        : req.body.imageUrls.split(',').map(u => u.trim());
      
      for (let i = 0; i < urls.length; i++) {
        const ext = path.extname(urls[i].split('?')[0]) || '.jpg';
        const tempPath = `/tmp/image-${Date.now()}-${i}${ext}`;
        await downloadFile(urls[i], tempPath);
        imagePaths.push(tempPath);
      }
    }

    if (imagePaths.length === 0) {
      throw new Error('No images provided');
    }

    const duration = parseFloat(req.body.duration) || 3;
    
    // Create concat file list - FIXED: proper format
    const listContent = imagePaths.map(p => `file '${p}'\nduration ${duration}`).join('\n') + `\nfile '${imagePaths[imagePaths.length - 1]}'`;
    fs.writeFileSync(listPath, listContent);

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions([
        '-vsync vfr',
        '-pix_fmt yuv420p',
        '-c:v libx264',
        '-preset ultrafast',
        '-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2'
      ])
      .output(outputPath)
      .on('end', () => {
        res.download(outputPath, 'slideshow.mp4', () => {
          cleanup(...imagePaths, listPath, outputPath);
        });
      })
      .on('error', (err) => {
        console.error('Slideshow Error:', err);
        cleanup(...imagePaths, listPath, outputPath);
        res.status(500).json({ error: 'Error creating slideshow', details: err.message });
      })
      .run();
  } catch (err) {
    console.error('Slideshow Setup Error:', err);
    cleanup(...imagePaths, listPath, outputPath);
    res.status(400).json({ error: err.message });
  }
});

// 3. Video1 + Video2 = Concatenated Video - FIXED
app.post('/concat-videos', upload.fields([
  { name: 'video1', maxCount: 1 },
  { name: 'video2', maxCount: 1 }
]), async (req, res) => {
  let video1Path, video2Path;
  const outputPath = `/tmp/concat-${Date.now()}.mp4`;
  const listPath = `/tmp/concat-list-${Date.now()}.txt`;
  const tempVideo1 = `/tmp/temp-v1-${Date.now()}.mp4`;
  const tempVideo2 = `/tmp/temp-v2-${Date.now()}.mp4`;

  try {
    video1Path = await getFilePath(
      req.files?.video1?.[0],
      req.body.video1Url,
      'video1'
    );
    
    video2Path = await getFilePath(
      req.files?.video2?.[0],
      req.body.video2Url,
      'video2'
    );

    // Re-encode both videos to same format for reliable concatenation
    const encodeVideo = (input, output) => {
      return new Promise((resolve, reject) => {
        ffmpeg(input)
          .outputOptions([
            '-c:v libx264',
            '-c:a aac',
            '-preset ultrafast',
            '-pix_fmt yuv420p',
            '-ar 44100'
          ])
          .output(output)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    };

    console.log('Re-encoding videos for concatenation...');
    await encodeVideo(video1Path, tempVideo1);
    await encodeVideo(video2Path, tempVideo2);

    // Create concat file
    const listContent = `file '${tempVideo1}'\nfile '${tempVideo2}'`;
    fs.writeFileSync(listPath, listContent);

    ffmpeg()
      .input(listPath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .output(outputPath)
      .on('end', () => {
        res.download(outputPath, 'concatenated.mp4', () => {
          cleanup(video1Path, video2Path, tempVideo1, tempVideo2, listPath, outputPath);
        });
      })
      .on('error', (err) => {
        console.error('Concat Error:', err);
        cleanup(video1Path, video2Path, tempVideo1, tempVideo2, listPath, outputPath);
        res.status(500).json({ error: 'Error concatenating videos', details: err.message });
      })
      .run();
  } catch (err) {
    console.error('Concat Setup Error:', err);
    cleanup(video1Path, video2Path, tempVideo1, tempVideo2, listPath, outputPath);
    res.status(400).json({ error: err.message });
  }
});

// 4. Video + Audio = Video with new/background audio - FIXED
app.post('/video-audio', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  let videoPath, audioPath;
  const mode = req.body.mode || 'replace';
  const outputPath = `/tmp/video-audio-${Date.now()}.mp4`;

  try {
    videoPath = await getFilePath(
      req.files?.video?.[0],
      req.body.videoUrl,
      'video'
    );
    
    audioPath = await getFilePath(
      req.files?.audio?.[0],
      req.body.audioUrl,
      'audio'
    );

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
    } else if (mode === 'background') {
      // Mix audio (background music) - FIXED: proper filter
      command.complexFilter([
        '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[aout]'
      ])
      .outputOptions([
        '-c:v copy',
        '-map 0:v:0',
        '-map [aout]',
        '-c:a aac',
        '-b:a 192k'
      ]);
    } else {
      throw new Error('Invalid mode. Use "replace" or "background"');
    }

    command
      .output(outputPath)
      .on('end', () => {
        res.download(outputPath, 'video-with-audio.mp4', () => {
          cleanup(videoPath, audioPath, outputPath);
        });
      })
      .on('error', (err) => {
        console.error('Video+Audio Error:', err);
        cleanup(videoPath, audioPath, outputPath);
        res.status(500).json({ error: 'Error processing video', details: err.message });
      })
      .run();
  } catch (err) {
    console.error('Video+Audio Setup Error:', err);
    cleanup(videoPath, audioPath, outputPath);
    res.status(400).json({ error: err.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'FFmpeg Service Running',
    version: '1.1.0',
    features: {
      fileUpload: true,
      urlSupport: true
    },
    endpoints: {
      '/image-audio': 'POST - Combine image and audio into video (video length = audio length)',
      '/slideshow': 'POST - Create slideshow from multiple images',
      '/concat-videos': 'POST - Concatenate two videos (preserves audio)',
      '/video-audio': 'POST - Add audio to video - replace or background mix'
    },
    notes: {
      'image-audio': 'Video duration matches audio duration exactly',
      'concat-videos': 'Videos are re-encoded to same format for reliable concatenation',
      'video-audio-replace': 'Removes original audio, adds new audio',
      'video-audio-background': 'Mixes new audio with original audio'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎬 FrameFusion API running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🌐 Supports both file uploads and URL inputs`);
});
