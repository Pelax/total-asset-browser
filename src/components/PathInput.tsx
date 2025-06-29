import React, { useState } from 'react';
import { Folder, Search } from 'lucide-react';

interface PathInputProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const PathInput: React.FC<PathInputProps> = ({ currentPath, onNavigate }) => {
  const [inputPath, setInputPath] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputPath.trim()) {
      onNavigate(inputPath.trim());
      setInputPath('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Browse to path...</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <div className="flex items-center space-x-2 bg-gray-700 rounded-lg px-3 py-2 flex-1">
        <Folder className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          placeholder="Enter path (e.g., C:\Games\Assets or /home/user/assets)"
          className="bg-transparent flex-1 text-white placeholder-gray-400 outline-none"
          autoFocus
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
      >
        Go
      </button>
      <button
        type="button"
        onClick={() => {
          setIsOpen(false);
          setInputPath('');
        }}
        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
      >
        Cancel
      </button>
    </form>
  );
};