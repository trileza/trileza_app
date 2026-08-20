const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Busboy = require('busboy');

if (ffmpegInstaller) {
  ffmpeg.setFfmpegPath(ffmpegInstaller);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  return new Promise((resolve) => {
    try {
      const busboy = Busboy({ headers: event.headers });
      const tmpDir = os.tmpdir();
      let inputPath = '';
      let outputPath = '';
      let fileStream = null;

      busboy.on('file', (fieldname, file, info) => {
        const { filename } = info;
        inputPath = path.join(tmpDir, `input_${Date.now()}_${filename}`);
        outputPath = path.join(tmpDir, `output_${Date.now()}.mp4`);
        fileStream = fs.createWriteStream(inputPath);
        file.pipe(fileStream);
      });

      busboy.on('finish', () => {
        if (!inputPath || !fs.existsSync(inputPath)) {
          return resolve({
            statusCode: 400,
            body: JSON.stringify({ error: 'No video file uploaded' }),
          });
        }

        // Execute FFmpeg encoding with strict Bunny.net specs:
        // Video codec: H.264 (libx264)
        // Audio codec: AAC (aac)
        // Pixel format: yuv420p
        // Faststart: -movflags +faststart
        // Constant framerate: -vsync cfr
        // Profile: high - level: 4.0
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-pix_fmt yuv420p',
            '-movflags +faststart',
            '-vsync cfr',
            '-profile:v high',
            '-level 4.0',
          ])
          .toFormat('mp4')
          .on('error', (err) => {
            console.error('[FFmpeg Backend Error]:', err);
            // Clean up temporary files
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            resolve({
              statusCode: 500,
              body: JSON.stringify({ error: `FFmpeg re-encoding failed: ${err.message}` }),
            });
          })
          .on('end', () => {
            try {
              const buffer = fs.readFileSync(outputPath);
              // Clean up temporary files
              if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

              resolve({
                statusCode: 200,
                headers: {
                  'Content-Type': 'video/mp4',
                  'Content-Disposition': 'attachment; filename="optimized.mp4"',
                },
                body: buffer.toString('base64'),
                isBase64Encoded: true,
              });
            } catch (err) {
              resolve({
                statusCode: 500,
                body: JSON.stringify({ error: `Failed to read re-encoded output: ${err.message}` }),
              });
            }
          })
          .save(outputPath);
      });

      const bodyBuffer = Buffer.from(
        event.body,
        event.isBase64Encoded ? 'base64' : 'utf8'
      );
      busboy.end(bodyBuffer);
    } catch (err) {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: `Upload processing exception: ${err.message}` }),
      });
    }
  });
};
