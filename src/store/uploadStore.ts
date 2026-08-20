import { create } from 'zustand';
import * as tus from 'tus-js-client';
import { nexus } from '../lib/nexus';
import { inspectVideoFile, type VideoInspectionResult } from '../utils/videoInspector';
import { reencodeVideoForBunny } from '../lib/ffmpegProcessor';
import { executeWithAutoRefresh } from '../utils/authHelper';

export interface ActiveUpload {
  id: string; // `${courseId}-${topicId}`
  courseId: string;
  topicId: string;
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'inspecting' | 'optimizing' | 'uploading' | 'paused' | 'success' | 'failed';
  statusMessage?: string;
  inspectionDetails?: VideoInspectionResult['details'];
  optimizationProgress?: number;
  videoUrl?: string;
  videoId: string;
  tusUploadUrl?: string; // Stored TUS URL for exact byte-level resume
  signature: string;
  expiration: number;
  libraryId: number;
  pullZone: string;
}

interface UploadState {
  activeUploads: Record<string, ActiveUpload>; // topicId -> metadata
  // In-memory active TUS instances
  activeTusUploads: Record<string, tus.Upload>;
  
  // Initialize and load persisted upload states
  initUploads: () => void;
  
  // Start a new upload (or resume from exact byte position if tusUploadUrl exists)
  startUpload: (params: {
    courseId: string;
    topicId: string;
    file: File;
    signature?: string;
    expiration?: number;
    libraryId?: number;
    pullZone?: string;
    videoId?: string;
    tusUploadUrl?: string;
    onProgress?: (progress: number, message?: string) => void;
    onSuccess?: (url: string, videoId: string) => void;
    onError?: (error: Error) => void;
  }) => Promise<void>;

  // Start bulk upload for multiple files sequentially
  startBulkUpload: (params: {
    courseId: string;
    items: Array<{ topicId: string; file: File }>;
    onItemSuccess?: (topicId: string, url: string) => void;
  }) => Promise<void>;
  
  // Pause an active upload (aborts HTTP stream, retains byte offset on server)
  pauseUpload: (topicId: string) => void;
  
  // Resume a paused upload from exact byte position
  resumeUpload: (topicId: string, file?: File) => void;

  // Resume with file fallback
  resumeUploadWithFile: (topicId: string, file: File) => void;
  
  // Clear/remove upload metadata from state and cache
  clearUpload: (topicId: string) => void;
}

const STORAGE_KEY = 'trileza_active_video_uploads';

const loadPersistedUploads = (): Record<string, ActiveUpload> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      const cleaned: Record<string, ActiveUpload> = {};
      for (const [key, upload] of Object.entries(parsed) as [string, ActiveUpload][]) {
        if (upload.status === 'uploading' || upload.status === 'optimizing' || upload.status === 'inspecting') {
          cleaned[key] = { ...upload, status: 'paused', statusMessage: 'Upload paused. Click resume to continue.' };
        } else {
          cleaned[key] = upload;
        }
      }
      return cleaned;
    }
  } catch (e) {
    console.error('[UploadStore] Failed to load persisted uploads:', e);
  }
  return {};
};

const savePersistedUploads = (uploads: Record<string, ActiveUpload>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads));
  } catch (e) {
    console.error('[UploadStore] Failed to save persisted uploads:', e);
  }
};

export const useUploadStore = create<UploadState>((set, get) => ({
  activeUploads: {},
  activeTusUploads: {},

  initUploads: () => {
    const persisted = loadPersistedUploads();
    set({ activeUploads: persisted });
  },

  startUpload: async ({
    courseId,
    topicId,
    file,
    signature: providedSignature,
    expiration: providedExpiration,
    libraryId: providedLibraryId,
    pullZone: providedPullZone,
    videoId: providedVideoId,
    tusUploadUrl: providedTusUrl,
    onProgress,
    onSuccess,
    onError
  }) => {
    const uploadId = `${courseId}-${topicId}`;
    const existingMeta = get().activeUploads[topicId];

    // Step 0: Set status to 'inspecting'
    let currentUploadMeta: ActiveUpload = {
      id: uploadId,
      courseId,
      topicId,
      fileName: file.name,
      fileSize: file.size,
      progress: existingMeta?.progress || 0,
      status: 'inspecting',
      statusMessage: 'Analyzing video format for Bunny.net compatibility...',
      videoId: providedVideoId || existingMeta?.videoId || '',
      tusUploadUrl: providedTusUrl || existingMeta?.tusUploadUrl || undefined,
      signature: providedSignature || existingMeta?.signature || '',
      expiration: providedExpiration || existingMeta?.expiration || 0,
      libraryId: providedLibraryId || existingMeta?.libraryId || 0,
      pullZone: providedPullZone || existingMeta?.pullZone || ''
    };

    const uploads = { ...get().activeUploads, [topicId]: currentUploadMeta };
    set({ activeUploads: uploads });
    savePersistedUploads(uploads);

    if (onProgress) onProgress(2, 'Analyzing video format...');

    let finalFile = file;

    try {
      // If we already have a TUS upload URL on Bunny.net, skip inspection/optimization step & resume immediately!
      const existingTusUrl = providedTusUrl || existingMeta?.tusUploadUrl;

      if (!existingTusUrl) {
        // Step 1: Format Detection
        const inspection = await inspectVideoFile(file);
        console.log('[UploadStore] Format Inspection Result:', inspection);

        currentUploadMeta = {
          ...get().activeUploads[topicId],
          inspectionDetails: inspection.details,
        };

        if (!inspection.isCompatible) {
          console.log('[UploadStore] Video is not fully compliant. Reasons:', inspection.reasons);

          currentUploadMeta.status = 'optimizing';
          currentUploadMeta.statusMessage = 'Your video is being optimized for streaming — this may take a few minutes.';
          currentUploadMeta.optimizationProgress = 0;
          
          set({ activeUploads: { ...get().activeUploads, [topicId]: currentUploadMeta } });
          savePersistedUploads(get().activeUploads);

          // Run FFmpeg Re-encoding Pipeline
          finalFile = await reencodeVideoForBunny(file, {
            onProgress: (optProgress, statusText) => {
              const current = get().activeUploads[topicId];
              if (current) {
                current.optimizationProgress = optProgress;
                current.statusMessage = statusText;
                current.progress = Math.round(optProgress * 0.4);
                set({ activeUploads: { ...get().activeUploads, [topicId]: current } });
                savePersistedUploads(get().activeUploads);
                if (onProgress) onProgress(current.progress, statusText);
              }
            }
          });

          console.log('[UploadStore] Re-encoding completed. Size:', finalFile.size);
        } else {
          console.log('[UploadStore] Video is 100% compliant with Bunny.net standards.');
        }
      }

      // Step 2: Bunny.net Two-Step Upload (Create Video -> Get Upload Signature) if credentials not fully supplied
      let videoId = providedVideoId || existingMeta?.videoId;
      let signature = providedSignature || existingMeta?.signature;
      let expiration = providedExpiration || existingMeta?.expiration;
      let libraryId = providedLibraryId || existingMeta?.libraryId;
      let pullZone = providedPullZone || existingMeta?.pullZone;

      if (!videoId || !signature || !libraryId || !pullZone) {
        currentUploadMeta.statusMessage = 'Creating video entry on Bunny.net...';
        set({ activeUploads: { ...get().activeUploads, [topicId]: currentUploadMeta } });

        // 2a. Create Video Slot on Bunny.net
        const { data: createData, error: createErr } = await executeWithAutoRefresh(() =>
          nexus.functions.invoke('bunny-proxy', {
            body: {
              action: 'create-video',
              payload: { title: finalFile.name }
            }
          })
        );

        const resObj = createData?.data || createData;
        const videoGuid = resObj?.guid || resObj?.data?.guid || createData?.guid;

        if (createErr || !videoGuid) {
          const errDetail = createErr?.message || resObj?.error || (createData as any)?.error;
          console.error('[UploadStore] create-video failed:', { createErr, createData, resObj });
          throw new Error(errDetail || 'Failed to create video slot on Bunny.net');
        }

        videoId = videoGuid;

        // 2b. Generate TUS Upload Signature
        const { data: sigData, error: sigErr } = await executeWithAutoRefresh(() =>
          nexus.functions.invoke('bunny-proxy', {
            body: {
              action: 'get-upload-signature',
              payload: { videoId }
            }
          })
        );

        const sigRes = sigData?.data || sigData;
        const sigObj = sigRes?.signature ? sigRes : (sigRes?.data || sigRes);
        const signatureVal = sigObj?.signature;

        if (sigErr || !signatureVal) {
          const errDetail = sigErr?.message || sigObj?.error || (sigData as any)?.error;
          console.error('[UploadStore] get-upload-signature failed:', { sigErr, sigData, sigObj });
          throw new Error(errDetail || 'Failed to generate TUS upload signature');
        }

        signature = signatureVal;
        expiration = sigObj.expiration;
        libraryId = sigObj.libraryId;
        pullZone = sigObj.pullZone;
      }

      // Step 3: TUS Resumable Upload with Async Promise & Transcode Polling
      currentUploadMeta = {
        ...get().activeUploads[topicId],
        status: 'uploading',
        statusMessage: existingTusUrl ? 'Resuming upload from previous position...' : 'Uploading optimized video to Bunny.net...',
        videoId: videoId!,
        signature: signature!,
        expiration: expiration!,
        libraryId: libraryId!,
        pullZone: pullZone!
      };

      set({ activeUploads: { ...get().activeUploads, [topicId]: currentUploadMeta } });
      savePersistedUploads(get().activeUploads);

      await new Promise<void>((resolve, reject) => {
        // Create TUS upload instance. Passing `uploadUrl` if returning to a paused session enables exact byte-level resume!
        const tusUpload = new tus.Upload(finalFile, {
          endpoint: 'https://video.bunnycdn.com/tusupload',
          uploadUrl: existingTusUrl || undefined,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            'AuthorizationSignature': signature!,
            'AuthorizationExpire': String(expiration!),
            'LibraryId': String(libraryId!),
            'VideoId': videoId!
          },
          metadata: {
            filename: finalFile.name,
            filetype: finalFile.type
          },
          onError: (error) => {
            console.error(`[UploadStore] TUS failed for topic ${topicId}:`, error);
            const currentUploads = { ...get().activeUploads };
            if (currentUploads[topicId]) {
              currentUploads[topicId].status = 'failed';
              currentUploads[topicId].statusMessage = `Upload error: ${error.message}`;
              set({ activeUploads: currentUploads });
              savePersistedUploads(currentUploads);
            }
            if (onError) onError(error);
            reject(error);
          },
          onProgress: (bytesSent, bytesTotal) => {
            const rawPercentage = Math.round((bytesSent / bytesTotal) * 100);
            const isOptimized = currentUploadMeta.inspectionDetails && !currentUploadMeta.inspectionDetails.hasFastStart;
            // Cap upload progress at 90% so the remaining 10% reflects Bunny CDN encoding & distribution
            const displayPercentage = isOptimized
              ? Math.round(40 + (rawPercentage * 0.5))
              : Math.round(rawPercentage * 0.9);

            const currentUploads = { ...get().activeUploads };
            if (currentUploads[topicId]) {
              currentUploads[topicId].progress = displayPercentage;
              currentUploads[topicId].statusMessage = `Uploading: ${rawPercentage}% (${(bytesSent / (1024 * 1024)).toFixed(1)}MB / ${(bytesTotal / (1024 * 1024)).toFixed(1)}MB)`;
              // Capture TUS upload URL as soon as created for resumption
              if (tusUpload.url && currentUploads[topicId].tusUploadUrl !== tusUpload.url) {
                currentUploads[topicId].tusUploadUrl = tusUpload.url;
              }
              set({ activeUploads: currentUploads });
              savePersistedUploads(currentUploads);
              if (onProgress) onProgress(displayPercentage, currentUploads[topicId].statusMessage);
            }
          },
          onSuccess: async () => {
            const playlistUrl = `https://${pullZone}/${videoId}/playlist.m3u8`;
            console.log(`[UploadStore] TUS byte transfer finished for topic ${topicId}. Verifying Bunny CDN transcode status...`);

            const currentUploads = { ...get().activeUploads };
            if (currentUploads[topicId]) {
              currentUploads[topicId].status = 'optimizing';
              currentUploads[topicId].progress = 92;
              currentUploads[topicId].statusMessage = 'Encoding & distributing video on Bunny.net CDN...';
              set({ activeUploads: currentUploads });
              savePersistedUploads(currentUploads);
            }

            // Poll Bunny API to confirm transcoding completion (status 3 or 4)
            let attempts = 0;
            const maxAttempts = 40; // Up to 2 minutes
            let isEncoded = false;

            while (attempts < maxAttempts && !isEncoded) {
              attempts++;
              try {
                const { data: videoRes, error: videoErr } = await nexus.functions.invoke('bunny-proxy', {
                  body: { action: 'get-video', payload: { videoId } }
                });

                if (!videoErr && videoRes?.data) {
                  const videoStatus = videoRes.data.status;
                  console.log(`[UploadStore] Polling Bunny encoding status for video ${videoId}: status = ${videoStatus} (Attempt ${attempts}/${maxAttempts})`);

                  // Bunny Video Status: 3 = Finished, 4 = Resolution finished
                  if (videoStatus === 3 || videoStatus === 4) {
                    isEncoded = true;
                    break;
                  }
                  if (videoStatus === 5) {
                    throw new Error('Bunny.net backend encoding failed for this video file format.');
                  }
                }
              } catch (pollErr) {
                console.warn(`[UploadStore] Transcode status poll warning:`, pollErr);
              }

              // Wait 3 seconds before next check
              await new Promise(r => setTimeout(r, 3000));
            }

            console.log(`[UploadStore] Bunny video ${videoId} encoding verified! Ready to stream.`);

            const finalUploads = { ...get().activeUploads };
            if (finalUploads[topicId]) {
              finalUploads[topicId].status = 'success';
              finalUploads[topicId].progress = 100;
              finalUploads[topicId].statusMessage = 'Upload & Bunny CDN encoding completed! Video ready to stream.';
              finalUploads[topicId].videoUrl = playlistUrl;
              set({ activeUploads: finalUploads });
              savePersistedUploads(finalUploads);
            }

            // Clean up TUS instance
            const currentTus = { ...get().activeTusUploads };
            delete currentTus[topicId];
            set({ activeTusUploads: currentTus });

            if (onSuccess) onSuccess(playlistUrl, videoId!);

            // Step 4: Database Update (Save video GUID and playlist URL)
            if (topicId && !topicId.startsWith('new-') && topicId.length > 8) {
              try {
                const { data: existingLessons } = await nexus.database
                  .from('lessons')
                  .select('*')
                  .eq('module_id', topicId);

                const videoLesson = existingLessons?.find((l: any) => l.type === 'video');
                if (videoLesson) {
                  await nexus.database
                    .from('lessons')
                    .update({ content_url: playlistUrl, video_guid: videoId })
                    .eq('id', videoLesson.id);
                  console.log(`[UploadStore] Updated database for lesson: ${videoLesson.id}`);
                } else {
                  await nexus.database
                    .from('lessons')
                    .insert({
                      module_id: topicId,
                      title: 'Lecture Video',
                      type: 'video',
                      content_url: playlistUrl,
                      video_guid: videoId,
                      sort_order: 0
                    });
                  console.log(`[UploadStore] Created new database record for lesson video`);
                }
              } catch (dbErr) {
                console.error('[UploadStore] Database update warning:', dbErr);
              }
            }

            resolve();
          }
        });

        const tusUploads = { ...get().activeTusUploads };
        tusUploads[topicId] = tusUpload;
        set({ activeTusUploads: tusUploads });

        tusUpload.start();
      });
    } catch (err) {
      console.error(`[UploadStore] Pipeline error for topic ${topicId}:`, err);
      const currentUploads = { ...get().activeUploads };
      if (currentUploads[topicId]) {
        currentUploads[topicId].status = 'failed';
        currentUploads[topicId].statusMessage = (err as Error).message;
        set({ activeUploads: currentUploads });
        savePersistedUploads(currentUploads);
      }
      if (onError) onError(err as Error);
      throw err;
    }
  },

  startBulkUpload: async ({ courseId, items, onItemSuccess }) => {
    console.log(`[UploadStore] Initiating bulk upload queue for ${items.length} videos...`);
    
    // Process items in sequence (queue mode)
    for (const item of items) {
      try {
        await get().startUpload({
          courseId,
          topicId: item.topicId,
          file: item.file,
          onSuccess: (url) => {
            if (onItemSuccess) onItemSuccess(item.topicId, url);
          }
        });
      } catch (err) {
        console.error(`[UploadStore] Bulk upload failed for topic ${item.topicId}:`, err);
      }
    }
  },

  pauseUpload: (topicId) => {
    const upload = get().activeTusUploads[topicId];
    if (upload) {
      // abort(true) stops network requests without discarding state
      upload.abort(true);
    }
    const currentUploads = { ...get().activeUploads };
    if (currentUploads[topicId]) {
      currentUploads[topicId].status = 'paused';
      currentUploads[topicId].statusMessage = 'Upload paused. Click resume to continue from current position.';
      set({ activeUploads: currentUploads });
      savePersistedUploads(currentUploads);
    }
  },

  resumeUpload: (topicId, file) => {
    const meta = get().activeUploads[topicId];
    if (!meta) return;

    const existingTus = get().activeTusUploads[topicId];
    if (existingTus) {
      console.log(`[UploadStore] Resuming active in-memory TUS upload for topic ${topicId}...`);
      meta.status = 'uploading';
      meta.statusMessage = 'Resuming upload...';
      set({ activeUploads: { ...get().activeUploads, [topicId]: meta } });
      savePersistedUploads(get().activeUploads);
      existingTus.start();
      return;
    }

    if (file) {
      console.log(`[UploadStore] Resuming TUS upload with file for topic ${topicId} at URL ${meta.tusUploadUrl}...`);
      get().startUpload({
        courseId: meta.courseId,
        topicId: meta.topicId,
        file,
        signature: meta.signature,
        expiration: meta.expiration,
        libraryId: meta.libraryId,
        pullZone: meta.pullZone,
        videoId: meta.videoId,
        tusUploadUrl: meta.tusUploadUrl
      });
    }
  },

  resumeUploadWithFile: (topicId, file) => {
    get().resumeUpload(topicId, file);
  },

  clearUpload: (topicId) => {
    const uploads = { ...get().activeUploads };
    delete uploads[topicId];
    set({ activeUploads: uploads });
    savePersistedUploads(uploads);

    const tusUploads = { ...get().activeTusUploads };
    if (tusUploads[topicId]) {
      tusUploads[topicId].abort();
      delete tusUploads[topicId];
    }
    set({ activeTusUploads: tusUploads });
  }
}));
