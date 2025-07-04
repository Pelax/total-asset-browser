import React, { useState, useEffect } from 'react';
import { FileItem } from '../types';
import { FileTypeIcon } from './FileTypeIcon';
import { formatFileSize, formatDate } from '../utils/formatters';
import { FilePreview } from './FilePreview';
import { Model3DThumbnail } from './Model3DThumbnail';
import { useModelLoader } from '../hooks/useModelLoader';
import { FontPreview } from './FontPreview';
import { FolderOpen } from 'lucide-react';

interface FileGridProps {
  items: FileItem[];
  onNavigate: (path: string) => void;
  getThumbnailUrl: (path: string, size?: number) => string;
  getFolderPreviewUrl: (path: string, size?: number) => string;
  getFileUrl: (path: string) => string;
  currentPath: string;
}

export const FileGrid: React.FC<FileGridProps> = ({
  items,
  onNavigate,
  getThumbnailUrl,
  getFolderPreviewUrl,
  getFileUrl,
  currentPath
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const { clearAllLoads } = useModelLoader();

  // Open preview if preview param is present in URL on mount or when items change
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const previewName = urlParams.get('preview');
    if (previewName && items.length > 0) {
      const file = items.find(item => !item.isDirectory && item.name === previewName);
      if (file) setSelectedFile(file);
    }
  }, [items]);

  // Update URL when preview is opened/closed
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedFile) {
      url.searchParams.set('preview', selectedFile.name);
      window.history.pushState({}, '', url);
    } else {
      url.searchParams.delete('preview');
      window.history.pushState({}, '', url);
    }
  }, [selectedFile]);

  // Clear all model loads when navigating to a new directory
  useEffect(() => {
    return () => {
      clearAllLoads();
    };
  }, [items, clearAllLoads]);

  const handleItemClick = (item: FileItem) => {
    if (item.isDirectory) {
      // Clear all loads when navigating away
      clearAllLoads();
      onNavigate(item.path);
    } else {
      setSelectedFile(item);
    }
  };

  const getFileTypeColor = (fileType: string, isDirectory: boolean, hasAssets?: boolean) => {
    if (isDirectory) {
      return hasAssets ? 'border-gray-500/30 bg-emerald-500/5' : 'border-gray-500/30 bg-gray-500/5';
    }

    switch (fileType) {
      case 'images': return 'border-blue-500/30 bg-blue-500/5';
      case 'models': return 'border-purple-500/30 bg-purple-500/5';
      case 'audio': return 'border-green-500/30 bg-green-500/5';
      case 'video': return 'border-red-500/30 bg-red-500/5';
      case 'documents': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'fonts': return 'border-orange-500/30 bg-orange-500/5';
      default: return 'border-gray-500/30 bg-gray-500/5';
    }
  };

  // Get only files (not directories) for navigation, sorted by extension
  const files = items
    .filter(item => !item.isDirectory)
    .sort((a, b) => {
      const extA = a.name.split('.').pop()?.toLowerCase() || '';
      const extB = b.name.split('.').pop()?.toLowerCase() || '';
      if (extA < extB) return -1;
      if (extA > extB) return 1;
      return a.name.localeCompare(b.name);
    });
  const currentFileIndex = selectedFile ? files.findIndex(file => file.path === selectedFile.path) : -1;

  const navigateToFile = (direction: 'prev' | 'next') => {
    if (currentFileIndex === -1) return;

    let newIndex;
    if (direction === 'prev') {
      newIndex = currentFileIndex > 0 ? currentFileIndex - 1 : files.length - 1;
    } else {
      newIndex = currentFileIndex < files.length - 1 ? currentFileIndex + 1 : 0;
    }

    setSelectedFile(files[newIndex]);
  };

  // Enhanced thumbnail rendering with 3D model support and priority loading
  const renderThumbnail = (item: FileItem, index: number) => {
    const thumbnailSize = 200;

    // Calculate priority based on position (earlier items get higher priority)
    const priority = Math.max(100 - index, 0);

    // Folder with assets preview - FIXED FOR 3D MODELS!
    if (item.isDirectory && item.hasAssets && item.firstAsset) {
      // If the first asset is a 3D model, render it as 3D!
      if (item.firstAsset.type === 'models') {
        return (
          <div className="w-full h-full relative">
            <Model3DThumbnail
              modelPath={item.firstAsset.path}
              getFileUrl={getFileUrl}
              className="w-full h-full rounded-md"
              priority={priority + 50} // Folder previews get higher priority
            />
            <div className="absolute bottom-2 right-2 bg-gray-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
              Folder
            </div>
          </div>
        );
      }

      // For other asset types, use the server-generated preview
      return (
        <>
          <img
            src={getFolderPreviewUrl(item.path, thumbnailSize)}
            alt={`Preview of ${item.name}`}
            className="w-full h-full object-cover rounded-md"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
          <div className="hidden flex items-center justify-center">
            <FileTypeIcon
              fileType={item.fileType}
              isDirectory={item.isDirectory}
              hasAssets={item.hasAssets}
              className="w-12 h-12"
            />
          </div>
          <div className="absolute bottom-2 right-2 bg-gray-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
            Folder
          </div>
        </>
      );
    }

    // Images - show actual image preview
    if (!item.isDirectory && item.fileType === 'images') {
      return (
        <>
          <img
            src={getThumbnailUrl(item.path, thumbnailSize)}
            alt={item.name}
            className="w-full h-full object-cover rounded-md"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
          <div className="absolute bottom-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
            Image
          </div>
          <div className="hidden flex items-center justify-center">
            <FileTypeIcon
              fileType={item.fileType}
              isDirectory={item.isDirectory}
              className="w-12 h-12"
            />
          </div>
        </>
      );
    }

    // 3D Models - RENDER ACTUAL 3D MODEL with priority loading
    if (!item.isDirectory && item.fileType === 'models') {
      return (
        <div className="w-full h-full relative">
          <Model3DThumbnail
            modelPath={item.path}
            getFileUrl={getFileUrl}
            className="w-full h-full rounded-md"
            priority={priority}
          />
          {/* 3D Model indicator */}
          <div className="absolute bottom-2 right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg z-10">
            3D
          </div>
        </div>
      );
    }

    // Font files - show font preview
    if (!item.isDirectory && item.fileType === 'fonts') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-600 to-orange-800 rounded-md relative">
          <div className="text-center">
            <div className="text-white/90 text-2xl font-bold mb-2">Aa</div>
            <div className="text-white/70 text-xs">Font</div>
          </div>
          <div className="absolute bottom-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
            Font
          </div>
        </div>
      );
    }

    // Audio files - show waveform-style preview
    if (!item.isDirectory && item.fileType === 'audio') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-600 to-green-800 rounded-md">
          <div className="flex items-end space-x-1 h-16">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="bg-white/80 rounded-sm animate-pulse"
                style={{
                  width: '3px',
                  height: `${Math.random() * 60 + 10}%`,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
          <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
            Audio
          </div>
        </div>
      );
    }

    // Video files - show film strip preview
    if (!item.isDirectory && item.fileType === 'video') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-600 to-red-800 rounded-md relative">
          <div className="w-16 h-12 bg-black/50 rounded border-2 border-white/50 flex items-center justify-center">
            <div className="w-0 h-0 border-l-4 border-l-white border-y-2 border-y-transparent ml-1"></div>
          </div>
          {/* Film strip holes */}
          <div className="absolute left-1 top-0 bottom-0 flex flex-col justify-evenly">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-2 h-2 bg-black/30 rounded-full" />
            ))}
          </div>
          <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-evenly">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="w-2 h-2 bg-black/30 rounded-full" />
            ))}
          </div>
          <div className="absolute bottom-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
            Video
          </div>
        </div>
      );
    }

    // Documents - show document preview
    if (!item.isDirectory && item.fileType === 'documents') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-md relative">
          <div className="w-12 h-16 bg-white rounded shadow-lg flex flex-col">
            <div className="h-2 bg-yellow-400 rounded-t"></div>
            <div className="flex-1 p-1 space-y-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-0.5 bg-gray-300 rounded" style={{ width: `${80 + Math.random() * 20}%` }} />
              ))}
            </div>
          </div>
          <div className="absolute bottom-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
            Doc
          </div>
        </div>
      );
    }

    // Default icon for other file types
    return (
      <div className="w-full h-full flex items-center justify-center">
        <FileTypeIcon
          fileType={item.fileType}
          isDirectory={item.isDirectory}
          hasAssets={item.hasAssets}
          className="w-12 h-12"
        />
      </div>
    );
  };

  const showInFolder = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/show-in-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: currentPath }),
      });

      if (!response.ok) {
        console.log('Show in folder response not ok, but folder likely opened anyway');
      } else {
        console.log('Folder opened in explorer successfully');
      }
    } catch (error) {
      console.error('Error opening folder in explorer:', error);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <FileTypeIcon fileType="folder" isDirectory={true} className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No files found in this directory</p>
          <button
            onClick={showInFolder}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 mx-auto transition-colors"
            title="Open in Explorer"
          >
            <FolderOpen size={16} />
            Open in Explorer
          </button>
        </div>
      </div>
    );
  }

  // Filter items based on search query
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort directories first, then files, and apply search filter
  const sortedAndFilteredItems = [
    ...filteredItems.filter(item => item.isDirectory),
    ...filteredItems.filter(item => !item.isDirectory).sort((a, b) => {
      const extA = a.name.split('.').pop()?.toLowerCase() || '';
      const extB = b.name.split('.').pop()?.toLowerCase() || '';
      if (extA < extB) return -1;
      if (extA > extB) return 1;
      return a.name.localeCompare(b.name);
    })
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={showInFolder}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap"
          title="Open in Explorer"
        >
          <FolderOpen size={16} />
          Open in Explorer
        </button>
      </div>
      {filteredItems.length === 0 ? (
        <div className="col-span-full text-center py-12 text-gray-400">
          No items found matching "{searchQuery}"
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {sortedAndFilteredItems.map((item, index) => (
          item.isDirectory ? (
            <a
              key={item.path}
              href={`?path=${encodeURIComponent(item.path)}`}
              onClick={e => {
                if (!(e.ctrlKey || e.metaKey || e.button === 1)) {
                  e.preventDefault();
                  handleItemClick(item);
                }
              }}
              className={
                `group cursor-pointer rounded-xl border-2 transition-all duration-300
                hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/20
                ${getFileTypeColor(item.fileType, item.isDirectory, item.hasAssets)}
                backdrop-blur-sm`
              }
            >
              <div className="p-4">
                {/* Enhanced Thumbnail with Priority Loading */}
                <div className="aspect-square mb-3 rounded-lg overflow-hidden bg-gray-800/50 flex items-center justify-center relative shadow-lg">
                  {renderThumbnail(item, index)}
                </div>
                {/* File Info */}
                <div className="space-y-2">
                  <h3 className="font-medium text-white truncate group-hover:text-indigo-300 transition-colors text-sm" title={item.name}>
                    {item.name}
                  </h3>
                </div>
              </div>
            </a>
          ) : (
            <a
              key={item.path}
              href={`?path=${encodeURIComponent(currentPath)}&preview=${encodeURIComponent(item.name)}`}
              onClick={e => {
                if (!(e.ctrlKey || e.metaKey || e.button === 1)) {
                  e.preventDefault();
                  handleItemClick(item);
                }
              }}
              className={
                `group cursor-pointer rounded-xl border-2 transition-all duration-300
                hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/20
                ${getFileTypeColor(item.fileType, item.isDirectory, item.hasAssets)}
                backdrop-blur-sm`
              }
            >
              <div className="p-4">
                {/* Enhanced Thumbnail with Priority Loading */}
                <div className="aspect-square mb-3 rounded-lg overflow-hidden bg-gray-800/50 flex items-center justify-center relative shadow-lg">
                  {renderThumbnail(item, index)}
                </div>
                {/* File Info */}
                <div className="space-y-2">
                  <h3 className="font-medium text-white truncate group-hover:text-indigo-300 transition-colors text-sm" title={item.name}>
                    {item.name}
                  </h3>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p className="font-mono">{formatFileSize(item.size)}</p>
                    <p className="opacity-75">{formatDate(item.modified)}</p>
                  </div>
                </div>
              </div>
            </a>
          )
          ))}
        </div>
      )}

      {selectedFile && (
        selectedFile.fileType === 'fonts' ? (
          <FontPreview
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            getFileUrl={getFileUrl}
            onNavigate={navigateToFile}
            canNavigate={files.length > 1}
            currentIndex={currentFileIndex + 1}
            totalFiles={files.length}
          />
        ) : (
          <FilePreview
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            getFileUrl={getFileUrl}
            getThumbnailUrl={getThumbnailUrl}
            onNavigate={navigateToFile}
            canNavigate={files.length > 1}
            currentIndex={currentFileIndex + 1}
            totalFiles={files.length}
          />
        )
      )}
    </>
  );
};