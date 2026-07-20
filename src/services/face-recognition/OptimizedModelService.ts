import * as faceapi from 'face-api.js';
import { getFaceModelSettings, type FaceDetectionModel } from './FaceModelSettingsService';

// Optimized model loading for faster performance
let optimizedModelsLoaded = false;
let isLoadingOptimizedModels = false;
let modelLoadingFailed = false;
let failureCount = 0;
let lastFailureTime = 0;
const MAX_RETRIES = 3;
const RETRY_COOLDOWN = 30000; // 30 seconds
let faceTracker: Map<string, { descriptor: Float32Array; timestamp: number; box: faceapi.Rect }> = new Map();

// Frame skipping configuration
let frameSkipCounter = 0;
const FRAME_SKIP_COUNT = 3; // Process every 3rd frame for better performance

// Detection cache for faster repeated detections
const detectionCache = new Map<string, { detection: any; timestamp: number }>();
const CACHE_DURATION = 1000; // 1 second cache

type DetectorCandidate = 'ssd' | 'tiny';

export interface OptimizedDetectionOptions {
  inputSize?: number;
  scoreThreshold?: number;
  enableTracking?: boolean;
  skipFrames?: boolean;
  maxFaces?: number;
  classroomMode?: boolean; // Ultra-fast batch detection for 50+ faces
  minFaceSize?: number; // Minimum face size in pixels (filters out distant faces)
}

// Fast model loading with circuit breaker pattern
export async function loadOptimizedModels(): Promise<void> {
  if (optimizedModelsLoaded) {
    console.log('Optimized models already loaded');
    return;
  }

  // Circuit breaker: check if we've failed too many times recently
  const now = Date.now();
  if (modelLoadingFailed && failureCount >= MAX_RETRIES) {
    if (now - lastFailureTime < RETRY_COOLDOWN) {
      throw new Error(`Model loading failed ${failureCount} times. Please wait ${Math.ceil((RETRY_COOLDOWN - (now - lastFailureTime)) / 1000)} seconds before retrying.`);
    } else {
      // Reset after cooldown
      modelLoadingFailed = false;
      failureCount = 0;
    }
  }

  if (isLoadingOptimizedModels) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        clearInterval(checkLoaded);
        reject(new Error('Model loading timeout'));
      }, 30000); // 30 second timeout

      const checkLoaded = setInterval(() => {
        if (optimizedModelsLoaded) {
          clearInterval(checkLoaded);
          clearTimeout(timeout);
          resolve();
        } else if (!isLoadingOptimizedModels && !optimizedModelsLoaded && modelLoadingFailed) {
          clearInterval(checkLoaded);
          clearTimeout(timeout);
          reject(new Error('Optimized model loading failed'));
        }
      }, 100);
    });
  }

  isLoadingOptimizedModels = true;

  try {
    console.log('Loading optimized face recognition models with high-accuracy models...');
    
    // Use more powerful models for better accuracy (SSD MobileNetV1 + full landmarks)
    const preferredModels = [
      { net: faceapi.nets.ssdMobilenetv1, name: 'SSD_MobileNetV1', fallback: faceapi.nets.tinyFaceDetector },
      { net: faceapi.nets.faceLandmark68Net, name: 'FaceLandmark68', fallback: faceapi.nets.faceLandmark68TinyNet },
      { net: faceapi.nets.faceRecognitionNet, name: 'FaceRecognition', fallback: null }
    ];

    // Load models with fallback mechanism
    for (const model of preferredModels) {
      if (!model.net.isLoaded) {
        try {
          console.log(`Loading ${model.name}...`);
          await model.net.load('/models');
          console.log(`${model.name} loaded successfully`);
        } catch (modelError) {
          console.warn(`Failed to load ${model.name}:`, modelError);
          
          // Try fallback if available
          if (model.fallback && !model.fallback.isLoaded) {
            console.log(`Trying fallback model for ${model.name}...`);
            try {
              await model.fallback.load('/models');
              console.log(`Fallback model loaded for ${model.name}`);
            } catch (fallbackError) {
              console.error(`Both primary and fallback models failed for ${model.name}:`, fallbackError);
              throw new Error(`Critical model ${model.name} failed to load`);
            }
          } else {
            throw modelError;
          }
        }
      }
    }

    optimizedModelsLoaded = true;
    isLoadingOptimizedModels = false;
    modelLoadingFailed = false;
    failureCount = 0;
    console.log('Optimized models loaded successfully');
  } catch (error) {
    isLoadingOptimizedModels = false;
    modelLoadingFailed = true;
    failureCount++;
    lastFailureTime = Date.now();
    console.error(`Error loading optimized models (attempt ${failureCount}):`, error);
    throw new Error(`Failed to load face recognition models: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Fast face detection with optimized parameters
export async function detectFacesOptimized(
  input: HTMLVideoElement | HTMLImageElement,
  options: OptimizedDetectionOptions = {}
): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection; }, faceapi.FaceLandmarks68>>[]> {
  
  if (!optimizedModelsLoaded) {
    await loadOptimizedModels();
  }

  // Frame skipping for video input
  if (options.skipFrames && input instanceof HTMLVideoElement) {
    frameSkipCounter++;
    if (frameSkipCounter % FRAME_SKIP_COUNT !== 0) {
      return [];
    }
  }

  // Check cache first
  const cacheKey = getCacheKey(input);
  const cached = detectionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.detection;
  }

  const modelSettings = await getFaceModelSettings();
  const maxFaces = options.classroomMode ? (options.maxFaces || 60) : (options.maxFaces || 5);
  const primary: DetectorCandidate = modelSettings.preferredModel;
  const secondary: DetectorCandidate = primary === 'ssd' ? 'tiny' : 'ssd';
  const modelSequence: DetectorCandidate[] = modelSettings.allowFallback ? [primary, secondary] : [primary];

  const detectWithModel = async (
    model: FaceDetectionModel
  ): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection; }, faceapi.FaceLandmarks68>>[]> => {
    if (model === 'tiny') {
      const tinyThreshold = options.classroomMode ? 0.45 : (options.scoreThreshold || 0.5);
      return faceapi
        .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({
          inputSize: options.classroomMode ? 512 : 416,
          scoreThreshold: tinyThreshold,
        }))
        .withFaceLandmarks()
        .withFaceDescriptors();
    }

    const ssdThreshold = options.classroomMode ? 0.5 : (options.scoreThreshold || 0.6);
    return faceapi
      .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({
        minConfidence: ssdThreshold,
        maxResults: maxFaces,
      }))
      .withFaceLandmarks()
      .withFaceDescriptors();
  };

  try {
    // Detect faces with configurable model + optional fallback flow
    let detections: faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection; }, faceapi.FaceLandmarks68>>[] = [];
    for (const model of modelSequence) {
      detections = await detectWithModel(model);
      if (detections.length > 0) {
        break;
      }
    }

    // Filter out faces that are too small (too far from camera)
    // Default minimum face size is 100 pixels (width or height)
    const minFaceSize = options.minFaceSize ?? 100;
    const nearbyFaces = detections.filter(detection => {
      const box = detection.detection.box;
      const faceSize = Math.min(box.width, box.height);
      const isNearby = faceSize >= minFaceSize;
      if (!isNearby) {
        console.log(`Filtered out distant face: size ${Math.round(faceSize)}px (min: ${minFaceSize}px)`);
      }
      return isNearby;
    });

    // In classroom mode, process all detected faces up to the limit
    const limitedDetections = nearbyFaces.slice(0, maxFaces);

    console.log(`Detected ${detections.length} faces, ${nearbyFaces.length} nearby, processing ${limitedDetections.length}`);

    // Cache the result
    detectionCache.set(cacheKey, {
      detection: limitedDetections,
      timestamp: Date.now()
    });

    // Clean old cache entries
    cleanCache();

    return limitedDetections;
  } catch (error) {
    console.error('Error in optimized face detection:', error);
    return [];
  }
}

// Fast single face detection with tracking
export async function detectSingleFaceOptimized(
  input: HTMLVideoElement | HTMLImageElement,
  options: OptimizedDetectionOptions = {}
): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection; }, faceapi.FaceLandmarks68>> | null> {
  
  const faces = await detectFacesOptimized(input, { ...options, maxFaces: 1 });
  return faces.length > 0 ? faces[0] : null;
}

// Face tracking for reduced processing
export function trackFace(
  faceId: string, 
  descriptor: Float32Array, 
  box: faceapi.Rect
): boolean {
  const existing = faceTracker.get(faceId);
  const now = Date.now();

  if (existing) {
    // Check if face moved significantly
    const distance = faceapi.euclideanDistance(existing.descriptor, descriptor);
    const boxDistance = Math.abs(existing.box.x - box.x) + Math.abs(existing.box.y - box.y);
    
    // Update if face moved or enough time passed
    if (distance > 0.3 || boxDistance > 50 || now - existing.timestamp > 5000) {
      faceTracker.set(faceId, { descriptor, timestamp: now, box });
      return true; // Needs processing
    }
    return false; // Skip processing
  } else {
    faceTracker.set(faceId, { descriptor, timestamp: now, box });
    return true; // New face, needs processing
  }
}

// Optimize detection area (Region of Interest)
export function getOptimizedDetectionRegion(
  canvas: HTMLCanvasElement,
  lastDetection?: faceapi.Rect
): { x: number; y: number; width: number; height: number } {
  
  if (lastDetection) {
    // Expand around last detection area
    const padding = 50;
    return {
      x: Math.max(0, lastDetection.x - padding),
      y: Math.max(0, lastDetection.y - padding),
      width: Math.min(canvas.width, lastDetection.width + padding * 2),
      height: Math.min(canvas.height, lastDetection.height + padding * 2)
    };
  }

  // Center region for initial detection
  const centerRatio = 0.6;
  const offsetX = (canvas.width * (1 - centerRatio)) / 2;
  const offsetY = (canvas.height * (1 - centerRatio)) / 2;
  
  return {
    x: offsetX,
    y: offsetY,
    width: canvas.width * centerRatio,
    height: canvas.height * centerRatio
  };
}

// Utilities
function getCacheKey(input: HTMLVideoElement | HTMLImageElement): string {
  if (input instanceof HTMLVideoElement) {
    // Use current time for video (less caching)
    return `video_${Math.floor(Date.now() / 100)}`;
  } else {
    // Use src for images (more caching)
    return `image_${input.src}`;
  }
}

function cleanCache(): void {
  const now = Date.now();
  for (const [key, value] of detectionCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      detectionCache.delete(key);
    }
  }
}

// Reset tracking data
export function resetTracking(): void {
  faceTracker.clear();
  detectionCache.clear();
  frameSkipCounter = 0;
}

// Check if optimized models are loaded
export function areOptimizedModelsLoaded(): boolean {
  return optimizedModelsLoaded;
}

// Get performance stats
export function getPerformanceStats() {
  return {
    trackedFaces: faceTracker.size,
    cacheSize: detectionCache.size,
    frameSkipCounter,
    modelsLoaded: optimizedModelsLoaded
  };
}

// Get face descriptor from image
export async function getOptimizedFaceDescriptor(
  input: HTMLImageElement | HTMLVideoElement
): Promise<Float32Array | null> {
  const detection = await detectSingleFaceOptimized(input);
  return detection?.descriptor || null;
}