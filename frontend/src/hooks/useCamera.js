'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Client-side image compression helper.
 * Resizes image to max 640px width maintaining aspect ratio and encodes as JPEG 0.7 quality.
 * Result is typically 30KB - 90KB (well under 150KB for 2G/3G networks).
 */
export async function compressImage(source, maxWidth = 640, quality = 0.7) {
  return new Promise((resolve, reject) => {
    let img;
    if (source instanceof HTMLVideoElement || source instanceof HTMLCanvasElement) {
      const canvas = document.createElement('canvas');
      let width = source.videoWidth || source.width || 640;
      let height = source.videoHeight || source.height || 480;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // Horizontal flip for selfie preview mirror feel
      ctx.drawImage(source, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Canvas compression failed'));
          const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
          resolve({
            file,
            blob,
            dataUrl: canvas.toDataURL('image/jpeg', quality),
          });
        },
        'image/jpeg',
        quality
      );
    } else if (source instanceof File || source instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          let width = image.width;
          let height = image.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(image, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Image compression failed'));
              const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
              resolve({
                file,
                blob,
                dataUrl: canvas.toDataURL('image/jpeg', quality),
              });
            },
            'image/jpeg',
            quality
          );
        };
        image.onerror = reject;
        image.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    } else {
      reject(new Error('Unsupported source type for compression'));
    }
  });
}

/**
 * useCamera hook
 * Manages front camera stream with canvas snapshot and file input fallback.
 */
export function useCamera() {
  const [stream, setStream] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null); // { file, dataUrl, blob }
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const startCamera = useCallback(async () => {
    setError(null);
    setLoading(true);

    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setPermissionDenied(true);
      setError('कैमरा API उपलब्ध नहीं है। कृपया फ़ाइल चुनें।');
      setLoading(false);
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setCameraActive(true);
      setPermissionDenied(false);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('getUserMedia error, enabling file fallback:', err);
      setPermissionDenied(true);
      setError('कैमरा अनुमति नहीं मिली। आप फ़ोटो अपलोड कर सकते हैं।');
      setCameraActive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current) {
      throw new Error('Video preview not available');
    }
    try {
      const result = await compressImage(videoRef.current, 640, 0.7);
      setCapturedPhoto(result);
      stopCamera();
      return result;
    } catch (err) {
      setError('फोटो खींचने में समस्या आई: ' + err.message);
      throw err;
    }
  }, [stopCamera]);

  const handleFileUpload = useCallback(async (file) => {
    if (!file) return;
    try {
      setLoading(true);
      const result = await compressImage(file, 640, 0.7);
      setCapturedPhoto(result);
      setError(null);
      return result;
    } catch (err) {
      setError('फ़ोटो प्रोसेस करने में त्रुटि: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const retake = useCallback(() => {
    setCapturedPhoto(null);
    setError(null);
    startCamera();
  }, [startCamera]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    videoRef,
    fileInputRef,
    cameraActive,
    capturedPhoto,
    permissionDenied,
    error,
    loading,
    startCamera,
    stopCamera,
    capturePhoto,
    handleFileUpload,
    retake,
    clearPhoto: () => setCapturedPhoto(null),
  };
}
