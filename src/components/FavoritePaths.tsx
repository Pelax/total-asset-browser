import React, { useState, useEffect } from 'react';
import { Star, Plus, X, Folder } from 'lucide-react';

interface FavoritePathsProps {
  onNavigate: (path: string) => void;
}

interface FavoritePath {
  id: string;
  name: string;
  path: string;
}

export const FavoritePaths: React.FC<FavoritePathsProps> = ({ onNavigate }) => {
  const [favorites, setFavorites] = useState<FavoritePath[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newFavorite, setNewFavorite] = useState({ name: '', path: '' });

  useEffect(() => {
    const saved = localStorage.getItem('gameAssetBrowser_favorites');
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
    // Removed default favorites - starts empty now
  }, []);

  const saveFavorites = (newFavorites: FavoritePath[]) => {
    setFavorites(newFavorites);
    localStorage.setItem('gameAssetBrowser_favorites', JSON.stringify(newFavorites));
  };

  const addFavorite = () => {
    if (newFavorite.name && newFavorite.path) {
      const favorite: FavoritePath = {
        id: Date.now().toString(),
        name: newFavorite.name,
        path: newFavorite.path
      };
      saveFavorites([...favorites, favorite]);
      setNewFavorite({ name: '', path: '' });
      setIsAdding(false);
    }
  };

  const removeFavorite = (id: string) => {
    saveFavorites(favorites.filter(f => f.id !== id));
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Star className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Quick Access</h3>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Path</span>
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 p-4 bg-gray-900 rounded-lg border border-gray-600">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={newFavorite.name}
                onChange={(e) => setNewFavorite({ ...newFavorite, name: e.target.value })}
                placeholder="e.g., Game Assets"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Path</label>
              <input
                type="text"
                value={newFavorite.path}
                onChange={(e) => setNewFavorite({ ...newFavorite, path: e.target.value })}
                placeholder="e.g., C:\Games\Assets or /home/user/assets"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={addFavorite}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewFavorite({ name: '', path: '' });
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {favorites.map((favorite) => (
          <div
            key={favorite.id}
            className="group relative bg-gray-900 hover:bg-gray-700 border border-gray-600 hover:border-indigo-500 rounded-lg p-3 cursor-pointer transition-all duration-200"
            onClick={() => onNavigate(favorite.path)}
          >
            <div className="flex items-center space-x-3">
              <Folder className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-white truncate">{favorite.name}</h4>
                <p className="text-xs text-gray-400 truncate">{favorite.path}</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeFavorite(favorite.id);
              }}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {favorites.length === 0 && !isAdding && (
        <div className="text-center py-8 text-gray-400">
          <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No favorite paths yet. Add some for quick access!</p>
        </div>
      )}
    </div>
  );
};