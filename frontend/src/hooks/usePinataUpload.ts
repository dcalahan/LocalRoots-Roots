'use client';

import { useState, useCallback } from 'react';
import { uploadImage, uploadMetadata } from '@/lib/pinata';
import type { UploadResult } from '@/lib/pinata';

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: Error | null;
  result: UploadResult | null;
}

/**
 * Hook for uploading files to Pinata/IPFS
 */
export function usePinataUpload() {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    result: null,
  });

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
      result: null,
    });
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<UploadResult | null> => {
    setState({
      isUploading: true,
      progress: 0,
      error: null,
      result: null,
    });

    try {
      // Simulate progress since Pinata SDK doesn't provide progress
      setState((prev) => ({ ...prev, progress: 30 }));

      const result = await uploadImage(file);

      setState({
        isUploading: false,
        progress: 100,
        error: null,
        result,
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Upload failed');
      setState({
        isUploading: false,
        progress: 0,
        error: err,
        result: null,
      });
      return null;
    }
  }, []);

  const uploadJson = useCallback(
    async (data: Record<string, unknown>, name?: string): Promise<UploadResult | null> => {
      setState({
        isUploading: true,
        progress: 0,
        error: null,
        result: null,
      });

      try {
        setState((prev) => ({ ...prev, progress: 50 }));

        const result = await uploadMetadata(data, name);

        setState({
          isUploading: false,
          progress: 100,
          error: null,
          result,
        });

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Upload failed');
        setState({
          isUploading: false,
          progress: 0,
          error: err,
          result: null,
        });
        return null;
      }
    },
    []
  );

  return {
    ...state,
    uploadFile,
    uploadJson,
    reset,
  };
}

/**
 * Hook for uploading multiple files
 */
export function useMultipleUpload() {
  const [uploads, setUploads] = useState<Map<string, UploadState>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(async (files: File[]): Promise<UploadResult[]> => {
    setIsUploading(true);
    const results: UploadResult[] = [];

    for (const file of files) {
      const key = file.name;

      setUploads((prev) => {
        const next = new Map(prev);
        next.set(key, { isUploading: true, progress: 0, error: null, result: null });
        return next;
      });

      try {
        const result = await uploadImage(file);
        results.push(result);

        setUploads((prev) => {
          const next = new Map(prev);
          next.set(key, { isUploading: false, progress: 100, error: null, result });
          return next;
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Upload failed');
        setUploads((prev) => {
          const next = new Map(prev);
          next.set(key, { isUploading: false, progress: 0, error: err, result: null });
          return next;
        });
      }
    }

    setIsUploading(false);
    return results;
  }, []);

  const reset = useCallback(() => {
    setUploads(new Map());
    setIsUploading(false);
  }, []);

  return {
    uploads,
    isUploading,
    uploadFiles,
    reset,
  };
}
