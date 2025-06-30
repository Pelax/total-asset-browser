import React, { useEffect, useState } from 'react';
import { useFileSystem } from './hooks/useFileSystem';
import { Breadcrumb } from './components/Breadcrumb';
import { FileGrid } from './components/FileGrid';
import { PathInput } from './components/PathInput';
import { FavoritePaths } from './components/FavoritePaths';
import { Loader2, AlertCircle, Folder } from 'lucide-react';

function App() {
  const { 
    currentPath, 
    items, 
    loading, 
    error, 
    browseDirectory, 
    getThumbnailUrl,
    getFolderPreviewUrl,
    getFileUrl 
  } = useFileSystem();

  const [hasInitialized, setHasInitialized] = useState(false);

  // Wrap browseDirectory to update the URL
  const browseDirectoryAndUpdateUrl = (path) => {
    browseDirectory(path);
    if (path) {
      const url = new URL(window.location.href);
      url.searchParams.set('path', path);
      window.history.pushState({}, '', url);
    } else {
      // Remove ?path if no path
      const url = new URL(window.location.href);
      url.searchParams.delete('path');
      window.history.pushState({}, '', url.pathname);
    }
  };

  useEffect(() => {
    if (hasInitialized) return;

    // Check if there's a path in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const pathParam = urlParams.get('path');
    
    if (pathParam) {
      browseDirectory(pathParam);
      setHasInitialized(true);
      return;
    }

    // Check for favorites and start with the first one
    const saved = localStorage.getItem('gameAssetBrowser_favorites');
    if (saved) {
      try {
        const favorites = JSON.parse(saved);
        if (favorites.length > 0) {
          browseDirectory(favorites[0].path);
        }
      } catch (e) {
        // Invalid JSON in localStorage, ignore
      }
    }
    
    setHasInitialized(true);
  }, [browseDirectory, hasInitialized]);

  const showWelcomeScreen = !currentPath && !loading && !error;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Total Asset Browser</h1>
              <p className="text-gray-400 text-sm">Browse and preview your game assets from anywhere on your system</p>
            </div>
            <PathInput currentPath={currentPath} onNavigate={browseDirectoryAndUpdateUrl} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Access Favorites */}
        <FavoritePaths onNavigate={browseDirectoryAndUpdateUrl} />

        {/* Welcome Screen */}
        {showWelcomeScreen && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Folder className="w-16 h-16 mx-auto mb-4 text-gray-500" />
              <h2 className="text-xl font-semibold text-white mb-2">Welcome to Total Asset Browser</h2>
              <p className="text-gray-400 mb-4">Add favorite paths above or use the search bar to browse to a directory</p>
            </div>
          </div>
        )}

        {/* Breadcrumb */}
        {currentPath && (
          <Breadcrumb currentPath={currentPath} onNavigate={browseDirectoryAndUpdateUrl} />
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3 text-indigo-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading directory...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3 text-red-400 bg-red-500/10 px-6 py-4 rounded-lg border border-red-500/20">
              <AlertCircle className="w-6 h-6" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* File Grid */}
        {!loading && !error && currentPath && (
          <>
            {/* Stats */}
            <div className="mb-6 text-sm text-gray-400">
              {items.length} items • {items.filter(item => item.isDirectory).length} folders • {items.filter(item => !item.isDirectory).length} files
            </div>

            <FileGrid
              items={items}
              onNavigate={browseDirectoryAndUpdateUrl}
              getThumbnailUrl={getThumbnailUrl}
              getFolderPreviewUrl={getFolderPreviewUrl}
              getFileUrl={getFileUrl}
              currentPath={currentPath}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;