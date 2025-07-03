import React, { useEffect, useRef, useState } from 'react';
import { FileTypeIcon } from './FileTypeIcon';
import { useModelLoader } from '../hooks/useModelLoader';

interface Model3DThumbnailProps {
  modelPath: string;
  getFileUrl: (path: string) => string;
  className?: string;
  priority?: number; // Higher number = higher priority
}

export const Model3DThumbnail: React.FC<Model3DThumbnailProps> = ({
  modelPath,
  className = '',
  priority = 0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [threeScene] = useState<any>(null);
  const { loadModel, cancelLoad, getLoadingState } = useModelLoader();
  
  // Generate unique ID for this thumbnail
  const thumbnailId = React.useMemo(() => `thumbnail-${modelPath}-${Date.now()}`, [modelPath]);
  
  const loadingState = getLoadingState(thumbnailId);

  useEffect(() => {
    if (!containerRef.current) return;

    // Start loading the model
    const cleanup = loadModel(thumbnailId, modelPath, containerRef, priority);

    return () => {
      // Cleanup when component unmounts or modelPath changes
      cleanup();
      if (threeScene?.cleanup) {
        threeScene.cleanup();
      }
    };
  }, [modelPath, priority, loadModel, thumbnailId]);

  // Cancel loading when component is no longer visible (intersection observer)
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            // Component is not visible, cancel loading if still loading
            if (loadingState.loading) {
              cancelLoad(thumbnailId);
            }
          }
        });
      },
      {
        rootMargin: '100px', // Start loading when within 100px of viewport
        threshold: 0
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [cancelLoad, thumbnailId, loadingState.loading]);

  if (loadingState.error) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-purple-600 to-purple-800 ${className}`}>
        <FileTypeIcon fileType="models" isDirectory={false} className="w-12 h-12 text-white" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ minHeight: '150px' }}
      />
      
      {loadingState.loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80 rounded-md">
          <div className="text-center">
            <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-white text-xs">Loading 3D...</p>
          </div>
        </div>
      )}
    </div>
  );
};