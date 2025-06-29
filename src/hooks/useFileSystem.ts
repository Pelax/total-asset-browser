import { useState, useCallback } from 'react';
import { DirectoryResponse, FileItem } from '../types';

const API_BASE = 'http://localhost:3001/api';

export const useFileSystem = () => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browseDirectory = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const url = new URL(`${API_BASE}/browse`);
      if (path) url.searchParams.set('path', path);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to browse directory' }));
        throw new Error(errorData.error || 'Failed to browse directory');
      }
      
      const data: DirectoryResponse = await response.json();
      setCurrentPath(data.currentPath);
      setItems(data.items);
    } catch (err) {
      console.error('Browse directory error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const getThumbnailUrl = useCallback((filePath: string, size = 200) => {
    const url = new URL(`${API_BASE}/thumbnail`);
    url.searchParams.set('path', filePath);
    url.searchParams.set('size', size.toString());
    return url.toString();
  }, []);

  const getFolderPreviewUrl = useCallback((folderPath: string, size = 200) => {
    const url = new URL(`${API_BASE}/folder-preview`);
    url.searchParams.set('path', folderPath);
    url.searchParams.set('size', size.toString());
    return url.toString();
  }, []);

  const getFileUrl = useCallback((filePath: string) => {
    const url = new URL(`${API_BASE}/file`);
    url.searchParams.set('path', filePath);
    return url.toString();
  }, []);

  const getModelTextureUrl = useCallback((modelPath: string) => {
    const url = new URL(`${API_BASE}/model-texture`);
    url.searchParams.set('path', modelPath);
    return url.toString();
  }, []);

  return {
    currentPath,
    items,
    loading,
    error,
    browseDirectory,
    getThumbnailUrl,
    getFolderPreviewUrl,
    getFileUrl,
    getModelTextureUrl
  };
};