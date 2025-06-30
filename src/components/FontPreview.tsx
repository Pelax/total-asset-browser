import React, { useState, useEffect } from 'react';
import { FileItem } from '../types';
import { ChevronLeft, ChevronRight, X, FolderOpen, ExternalLink } from 'lucide-react';

interface FontPreviewProps {
  file: FileItem;
  getFileUrl: (path: string) => string;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigate?: boolean;
  currentIndex?: number;
  totalFiles?: number;
}

export const FontPreview: React.FC<FontPreviewProps> = ({
  file,
  getFileUrl,
  onClose,
  onNavigate,
  canNavigate = false,
  currentIndex = 1,
  totalFiles = 1
}) => {
  const [fontLoaded, setFontLoaded] = useState(false);
  const [fontError, setFontError] = useState(false);

  const fontUrl = getFileUrl(file.path);
  const fontName = file.name.replace(/\.[^/.]+$/, '');

  useEffect(() => {
    const testFont = new FontFace(fontName, `url(${fontUrl})`);
    
    testFont.load()
      .then(() => {
        document.fonts.add(testFont);
        setFontLoaded(true);
        setFontError(false);
      })
      .catch((error) => {
        console.error('Failed to load font:', error);
        setFontError(true);
        setFontLoaded(false);
      });

    return () => {
      document.fonts.delete(testFont);
    };
  }, [fontUrl, fontName]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return; // Don't interfere with input fields
      
      switch (e.key) {
        case 'ArrowLeft':
          if (canNavigate && onNavigate) {
            e.preventDefault();
            onNavigate('prev');
          }
          break;
        case 'ArrowRight':
          if (canNavigate && onNavigate) {
            e.preventDefault();
            onNavigate('next');
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canNavigate, onNavigate, onClose]);

  // Show in folder logic (copied from FilePreview)
  const showInFolder = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/show-in-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: file.path }),
      });
      if (!response.ok) {
        console.log('Show in folder response not ok, but folder likely opened anyway');
      } else {
        console.log('File revealed in explorer successfully');
      }
    } catch (error) {
      console.error('Error showing file in folder:', error);
    }
  };

  // Get the current folder path from file.path
  const getCurrentFolderPath = () => {
    const lastSep = file.path.lastIndexOf('/') !== -1 ? file.path.lastIndexOf('/') : file.path.lastIndexOf('\\');
    return lastSep !== -1 ? file.path.slice(0, lastSep) : '';
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Navigation Arrows */}
      {canNavigate && onNavigate && (
        <>
          <button
            onClick={() => onNavigate('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-gray-800/90 hover:bg-gray-700 rounded-full transition-colors text-white shadow-lg"
            title="Previous file (←)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => onNavigate('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 bg-gray-800/90 hover:bg-gray-700 rounded-full transition-colors text-white shadow-lg"
            title="Next file (→)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
      <div 
        className="bg-gray-800 rounded-xl w-full max-w-2xl mx-auto flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div>
              <h2 className="text-xl font-semibold text-white">{file.name}</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                {canNavigate && (
                  <span>{currentIndex} of {totalFiles}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={showInFolder}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Show in folder"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
            <a
              href={`?path=${encodeURIComponent(getCurrentFolderPath())}&preview=${encodeURIComponent(file.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Preview Content */}
        <div className="flex-1 overflow-hidden">
          <div className="p-6 h-full flex items-center justify-center">
            {fontError ? (
              <p className="text-red-400">Failed to load font</p>
            ) : fontLoaded ? (
              <div style={{ fontFamily: `\"${fontName}\", sans-serif`, fontSize: '2rem', color: 'white', width: '100%', textAlign: 'center' }}>
                The quick brown fox jumps over the lazy dog
              </div>
            ) : (
              <p className="text-orange-400">Loading font...</p>
            )}
          </div>
        </div>
        {/* Navigation hint */}
        {canNavigate && (
          <div className="px-6 pb-4 flex-shrink-0">
            <div className="text-center text-xs text-gray-500">
              Use ← → arrow keys to navigate • Esc to close
            </div>
          </div>
        )}
      </div>
    </div>
  );
};