import mediaInfoFactory from 'mediainfo.js';

export interface VideoInspectionResult {
  isCompatible: boolean;
  reasons: string[];
  details: {
    container: string;
    videoCodec: string;
    audioCodec: string;
    pixelFormat: string;
    framerateMode: string; // 'CFR' | 'VFR' | 'Unknown'
    hasFastStart: boolean;
    duration: number; // in seconds
    width: number;
    height: number;
  };
}

/**
 * Checks if the MP4 moov atom comes before the mdat atom (FastStart).
 */
async function checkFastStart(file: File): Promise<boolean> {
  try {
    // Read the first 512KB to search for 'moov' atom
    const chunkSize = Math.min(file.size, 512 * 1024);
    const buffer = new Uint8Array(await file.slice(0, chunkSize).arrayBuffer());
    
    let moovOffset = -1;
    let mdatOffset = -1;

    for (let i = 0; i < buffer.length - 8; i++) {
      // Atoms are 4 bytes size + 4 bytes name ('moov', 'mdat')
      const atomName = String.fromCharCode(buffer[i + 4], buffer[i + 5], buffer[i + 6], buffer[i + 7]);
      if (atomName === 'moov' && moovOffset === -1) {
        moovOffset = i;
      }
      if (atomName === 'mdat' && mdatOffset === -1) {
        mdatOffset = i;
      }
      if (moovOffset !== -1 && mdatOffset !== -1) break;
    }

    if (moovOffset !== -1 && mdatOffset !== -1) {
      return moovOffset < mdatOffset;
    }
    
    // If moov is found in the first chunk, faststart is true
    if (moovOffset !== -1) return true;

    // If moov was not found in the header chunk, it is likely at the end of the file
    return false;
  } catch (err) {
    console.warn('[VideoInspector] FastStart check failed, defaulting to false:', err);
    return false;
  }
}

/**
 * Fallback inspection using HTML5 Video element metadata.
 */
function inspectWithVideoElement(file: File): Promise<Partial<VideoInspectionResult['details']>> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration || 0,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({});
    };

    video.src = objectUrl;
  });
}

/**
 * Inspects a video file to verify full compatibility with Bunny.net encoding pipeline.
 */
export async function inspectVideoFile(file: File): Promise<VideoInspectionResult> {
  const reasons: string[] = [];
  let container = file.type || file.name.split('.').pop()?.toLowerCase() || '';
  let videoCodec = 'Unknown';
  let audioCodec = 'Unknown';
  let pixelFormat = 'Unknown';
  let framerateMode = 'Unknown';
  let width = 0;
  let height = 0;
  let duration = 0;

  // 1. FastStart check
  const hasFastStart = await checkFastStart(file);
  if (!hasFastStart) {
    reasons.push('moov atom is not at the start of the file (faststart/web-optimized missing)');
  }

  // 2. Format & Codec inspection using MediaInfo.js
  try {
    const mediaInfo = await mediaInfoFactory({
      format: 'object',
      locateFile: () => 'https://cdn.jsdelivr.net/npm/mediainfo.js@0.3.3/dist/mediainfo.wasm',
    });

    const getSize = () => file.size;
    const readChunk = (chunkSize: number, offset: number) =>
      new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            resolve(new Uint8Array(e.target.result as ArrayBuffer));
          } else {
            reject(new Error('Failed to read file chunk'));
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize));
      });

    const result = (await mediaInfo.analyzeData(getSize, readChunk)) as any;
    mediaInfo.close();

    if (result && result.media && result.media.track) {
      const tracks = result.media.track;

      // General Track
      const generalTrack = tracks.find((t: any) => t['@type'] === 'General');
      if (generalTrack) {
        container = generalTrack.Format || container;
        duration = parseFloat(generalTrack.Duration || '0');
      }

      // Video Track
      const videoTrack = tracks.find((t: any) => t['@type'] === 'Video');
      if (videoTrack) {
        videoCodec = (videoTrack.Format || videoTrack.CodecID || '').toString();
        width = parseInt(videoTrack.Width || '0', 10);
        height = parseInt(videoTrack.Height || '0', 10);
        framerateMode = videoTrack.FrameRate_Mode === 'VFR' ? 'VFR' : 'CFR';

        // Chroma Subsampling / Pixel Format
        const chroma = videoTrack.ChromaSubsampling || '';
        const colorSpace = videoTrack.ColorSpace || '';
        const bitDepth = videoTrack.BitDepth || '8';

        if (chroma === '4:2:0' && bitDepth === '8' && (colorSpace === 'YUV' || colorSpace === '')) {
          pixelFormat = 'yuv420p';
        } else {
          pixelFormat = `${colorSpace}_${chroma}_${bitDepth}bit`.toLowerCase();
        }
      }

      // Audio Track
      const audioTrack = tracks.find((t: any) => t['@type'] === 'Audio');
      if (audioTrack) {
        audioCodec = (audioTrack.Format || audioTrack.CodecID || '').toString();
      }
    }
  } catch (err) {
    console.warn('[VideoInspector] MediaInfo.js parsing error, attempting fallback inspection:', err);
    const videoDetails = await inspectWithVideoElement(file);
    width = videoDetails.width || width;
    height = videoDetails.height || height;
    duration = videoDetails.duration || duration;
  }

  // Normalize extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'mp4') {
    reasons.push(`File format is .${ext} instead of .mp4`);
  }

  // Verify Video Codec (Must be H.264 / AVC)
  const isH264 = /h\.?264|avc|avc1/i.test(videoCodec);
  if (!isH264 && videoCodec !== 'Unknown') {
    reasons.push(`Video codec is ${videoCodec} instead of H.264 (libx264)`);
  }

  // Verify Audio Codec (Must be AAC)
  const isAAC = /aac|mp4a/i.test(audioCodec);
  if (!isAAC && audioCodec !== 'Unknown' && audioCodec !== '') {
    reasons.push(`Audio codec is ${audioCodec} instead of AAC`);
  }

  // Verify Pixel Format (Must be yuv420p)
  if (pixelFormat !== 'yuv420p' && pixelFormat !== 'Unknown') {
    reasons.push(`Pixel format is ${pixelFormat} instead of yuv420p`);
  }

  // Verify Framerate Mode (Must be CFR)
  if (framerateMode === 'VFR') {
    reasons.push('Framerate is Variable (VFR) instead of Constant (CFR)');
  }

  // Final Compatibility Verdict
  const isCompatible = reasons.length === 0;

  return {
    isCompatible,
    reasons,
    details: {
      container,
      videoCodec: isH264 ? 'H.264' : videoCodec,
      audioCodec: isAAC ? 'AAC' : audioCodec,
      pixelFormat,
      framerateMode,
      hasFastStart,
      duration,
      width,
      height,
    },
  };
}
