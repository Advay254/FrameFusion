# 🎬 FrameFusion

<div align="center">

![FrameFusion Banner](https://img.shields.io/badge/FrameFusion-FFmpeg_API-blueviolet?style=for-the-badge)
[![Deploy to Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7?style=for-the-badge&logo=render)](https://render.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**A powerful, free, and easy-to-deploy FFmpeg API service for all your media processing needs**

[Features](#-features) • [Quick Start](#-quick-start) • [API Endpoints](#-api-endpoints) • [Deploy](#-deploy-to-render) • [Support](#-support)

</div>

---

## ✨ Features

FrameFusion provides a simple REST API wrapper around FFmpeg, enabling you to:

- 🖼️ **Image + Audio → Video**: Transform static images into engaging videos with audio
- 🎞️ **Slideshow Creator**: Turn multiple images into a stylish video slideshow
- 🔗 **Video Concatenation**: Seamlessly merge multiple videos into one
- 🎵 **Audio Mixing**: Replace or add background music to existing videos

Perfect for:
- 📱 Social media content creation
- 🤖 Automation workflows (n8n, Zapier, Make)
- 🎨 Creative projects
- 📊 Presentations and demos
- 🎓 Educational content

---

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ (for local development)
- A Render account (for deployment)

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/framefusion.git
cd framefusion

# Install dependencies
npm install

# Start the server
npm start
```

The API will be available at `http://localhost:3000`

---

## 📡 API Endpoints

### 1️⃣ Image + Audio → Video

Combine a single image with an audio file to create a video that lasts the duration of the audio.

**Endpoint:** `POST /image-audio`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `image` (file): Image file (JPG, PNG, etc.)
- `audio` (file): Audio file (MP3, WAV, etc.)

**Response:** Video file (MP4)

**Example (cURL):**
```bash
curl -X POST https://your-app.onrender.com/image-audio \
  -F "image=@photo.jpg" \
  -F "audio=@music.mp3" \
  -o output.mp4
```

**Use Cases:**
- Create podcast cover videos
- Make audio visualizations
- Generate social media posts with audio

---

### 2️⃣ Multiple Images → Slideshow

Create a video slideshow from multiple images with customizable duration per slide.

**Endpoint:** `POST /slideshow`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `images` (files): Multiple image files (up to 20)
- `duration` (string, optional): Seconds per image (default: 3)

**Response:** Video file (MP4)

**Example (cURL):**
```bash
curl -X POST https://your-app.onrender.com/slideshow \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  -F "images=@image3.jpg" \
  -F "duration=5" \
  -o slideshow.mp4
```

**Use Cases:**
- Photo album presentations
- Product showcases
- Event recaps
- Before/after comparisons

---

### 3️⃣ Concatenate Videos

Merge two or more videos into a single continuous video, preserving original audio.

**Endpoint:** `POST /concat-videos`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `video1` (file): First video file
- `video2` (file): Second video file

**Response:** Concatenated video file (MP4)

**Example (cURL):**
```bash
curl -X POST https://your-app.onrender.com/concat-videos \
  -F "video1=@intro.mp4" \
  -F "video2=@main.mp4" \
  -o combined.mp4
```

**Use Cases:**
- Combine video clips
- Create compilations
- Merge intro/outro with main content
- Stitch together recordings

---

### 4️⃣ Video + Audio

Add audio to a video - either replace the original audio or mix it as background music.

**Endpoint:** `POST /video-audio`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `video` (file): Video file
- `audio` (file): Audio file
- `mode` (string): `replace` or `background`
  - `replace`: Removes original audio and uses new audio
  - `background`: Mixes new audio with original audio

**Response:** Video file with audio (MP4)

**Example (cURL):**
```bash
# Replace audio
curl -X POST https://your-app.onrender.com/video-audio \
  -F "video=@clip.mp4" \
  -F "audio=@voiceover.mp3" \
  -F "mode=replace" \
  -o output.mp4

# Add background music
curl -X POST https://your-app.onrender.com/video-audio \
  -F "video=@clip.mp4" \
  -F "audio=@bgmusic.mp3" \
  -F "mode=background" \
  -o output.mp4
```

**Use Cases:**
- Add voiceovers
- Add background music
- Replace poor audio quality
- Dub videos

---

## 🔧 Usage with n8n

FrameFusion works perfectly with n8n automation workflows!

### HTTP Request Node Configuration

**Method:** `POST`  
**URL:** `https://your-app.onrender.com/image-audio` (or any endpoint)  
**Body Content Type:** `Form-Data (Multipart)`

**Body Parameters:**
- Add parameters as shown in API endpoints above
- Use binary data references like `{{$binary.image}}`

**Response Format:** `File`

**Example Workflow:**
1. Trigger (Webhook, Schedule, etc.)
2. HTTP Request to get/generate image
3. HTTP Request to ElevenLabs (generate audio)
4. HTTP Request to FrameFusion `/image-audio`
5. Send to storage/social media

---

## 🌐 Deploy to Render

### One-Click Deploy

1. Fork this repository
2. Sign up for [Render](https://render.com) (free tier available)
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name:** `framefusion` (or your choice)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
6. Click "Create Web Service"

Your API will be live at: `https://your-app-name.onrender.com`

### Free Tier Limitations

Render's free tier includes:
- ✅ 750 hours/month
- ✅ Automatic HTTPS
- ⚠️ 512 MB RAM (may struggle with very large files)
- ⚠️ 0.1 CPU (slower processing)
- ⚠️ Services spin down after 15 minutes of inactivity (~30s cold start)

**Recommended for:** Personal projects, low-volume usage, testing

---

## 📚 Technical Details

### Built With
- **Node.js** - Runtime environment
- **Express** - Web framework
- **FFmpeg** - Media processing engine
- **fluent-ffmpeg** - FFmpeg wrapper for Node.js
- **Multer** - File upload handling

### Processing Specs
- Video codec: H.264 (libx264)
- Audio codec: AAC
- Audio bitrate: 192kbps
- Pixel format: yuv420p (universal compatibility)
- Preset: ultrafast (optimized for free tier)

---

## 🛠️ Advanced Configuration

### Custom FFmpeg Options

You can modify the FFmpeg options in `server.js` for your specific needs:

```javascript
.outputOptions([
  '-c:v libx264',        // Video codec
  '-preset ultrafast',   // Encoding speed (ultrafast, fast, medium, slow)
  '-crf 23',             // Quality (0-51, lower = better)
  '-b:a 192k',           // Audio bitrate
  '-pix_fmt yuv420p'     // Pixel format
])
```

### Environment Variables

You can customize the service with environment variables:

```bash
PORT=3000              # Server port (default: 3000)
MAX_FILE_SIZE=50mb     # Maximum upload size
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. 🍴 Fork the repository
2. 🌿 Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. 💾 Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. 📤 Push to the branch (`git push origin feature/AmazingFeature`)
5. 🎉 Open a Pull Request

### Ideas for Contributions
- Add support for more video formats
- Implement video trimming/cutting
- Add watermark overlay feature
- Create video thumbnails
- Add progress tracking for long operations
- Improve error handling
- Add rate limiting

---

## 💖 Support

If you find FrameFusion useful, consider supporting its development!

<div align="center">

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/advay254)

**[Buy me a coffee ☕](https://ko-fi.com/advay254)**

Your support helps maintain and improve FrameFusion for everyone! 🙏

</div>

---

## 💖 Support

<a href="https://www.buymeacoffee.com/advay254" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

- This service processes media files temporarily and deletes them immediately after processing
- No data is stored or retained on the server
- Use responsibly and respect copyright laws
- The service is provided "as is" without warranty of any kind

---

## 🐛 Known Issues & Troubleshooting

### Service is slow or timing out
- Free tier has limited resources - try smaller files
- Cold starts take 30-60 seconds on Render free tier
- Consider upgrading to paid tier for better performance

### Video concatenation fails
- Ensure videos have the same codec/format
- Try re-encoding videos to match specifications first

### Memory errors
- Reduce file sizes before uploading
- Process one file at a time
- Consider using lower quality settings

---

## 🔮 Roadmap

- [ ] Add video trimming/cutting endpoints
- [ ] Support for GIF output
- [ ] Batch processing support
- [ ] Webhook notifications for long operations
- [ ] Video compression endpoint
- [ ] Add subtitles/captions overlay
- [ ] Video format conversion
- [ ] Thumbnail generation

---

## 📞 Contact & Links

- **GitHub:** [FrameFusion Repository](https://github.com/Advay254/FrameFusion)
- **Issues:** [Report a bug](https://github.com/Advay254/FrameFusion/issues)
- **Ko-fi:** [Support the project](https://ko-fi.com/advay254)

---

<div align="center">

**Made with ❤️ for the automation community**

⭐ Star this repo if you find it useful! ⭐

</div>
