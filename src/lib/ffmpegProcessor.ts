import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { nexus } from './nexus';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadingPromise: Promise<FFmpeg> | null = null;

/**
 * Initializes and loads FFmpeg WASM core files from CDN.
 */
async function getFFmpeg(onProgress?: (progress: number, message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  if (ffmpegLoadingPromise) {
    return ffmpegLoadingPromise;
  }

  ffmpegLoadingPromise = (async () => {
    const ffmpeg = new FFmpeg();

    if (onProgress) {
      onProgress(5, 'Loading video optimization engine...');
    }

    // Load multi-threaded or single-threaded core
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoadingPromise;
}

export interface ReencodeOptions {
  onProgress?: (progress: number, statusText: string) => void;
}

/**
 * Re-encodes a video file using FFmpeg with strict Bunny.net specifications:
 * - Video Codec: H.264 (libx264)
 * - Audio Codec: AAC (aac)
 * - Pixel Format: yuv420p
 * - moov atom at start: -movflags +faststart
 * - Constant framerate: -vsync cfr
 * - Profile: high - level: 4.0
 */
export async function reencodeVideoForBunny(
  file: File,
  options: ReencodeOptions = {}
): Promise<File> {
  const { onProgress } = options;

  if (onProgress) {
    onProgress(0, 'Your video is being optimized for streaming — this may take a few minutes.');
  }

  // Transcoding runs in the browser via FFmpeg WebAssembly.
  //
  // There was a server-side fast path here that POSTed the whole file to a
  // Netlify function before falling back to WASM. That platform has been
  // removed, so the request could only ever fail — and it failed *after*
  // uploading the entire video, delaying every upload by that round trip for
  // no benefit.
  try {
    const ffmpeg = await getFFmpeg(onProgress);

    const inputFileName = `input_${Date.now()}.${file.name.split('.').pop() || 'mp4'}`;
    const outputFileName = `optimized_${Date.now()}.mp4`;

    if (onProgress) {
      onProgress(15, 'Preparing video file for processing...');
    }

    // Write input file to FFmpeg Virtual File System (VFS)
    await ffmpeg.writeFile(inputFileName, await fetchFile(file));

    // Listen for progress updates
    ffmpeg.on('progress', ({ progress }) => {
      const pct = Math.min(95, Math.max(15, Math.round(15 + progress * 80)));
      if (onProgress) {
        onProgress(pct, 'Your video is being optimized for streaming — this may take a few minutes.');
      }
    });

    if (onProgress) {
      onProgress(20, 'Encoding video (H.264, AAC, yuv420p, faststart)...');
    }

    // Execute FFmpeg with exact Bunny.net specs:
    // -c:v libx264 -c:a aac -pix_fmt yuv420p -movflags +faststart -vsync cfr -profile:v high -level 4.0
    await ffmpeg.exec([
      '-i', inputFileName,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-vsync', 'cfr',
      '-profile:v', 'high',
      '-level', '4.0',
      outputFileName
    ]);

    if (onProgress) {
      onProgress(95, 'Finalizing optimized MP4 file...');
    }

    // Read generated output file from VFS
    const data = await ffmpeg.readFile(outputFileName);
    
    // Clean up VFS memory
    await ffmpeg.deleteFile(inputFileName).catch(() => {});
    await ffmpeg.deleteFile(outputFileName).catch(() => {});

    // Create normalized File object
    const blob = new Blob([data], { type: 'video/mp4' });
    const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || 'video';
    const optimizedFile = new File([blob], `${cleanName}_optimized.mp4`, { type: 'video/mp4' });

    if (onProgress) {
      onProgress(100, 'Video optimization completed successfully.');
    }

    return optimizedFile;
  } catch (wasmErr) {
    console.error('[FFmpegProcessor] WASM processing error:', wasmErr);
    throw new Error(`Video optimization failed: ${(wasmErr as Error).message || 'Unknown encoding error'}`);
  }
}

