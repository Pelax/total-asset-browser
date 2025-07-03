import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ currentPath, onNavigate }) => {
  const pathParts = currentPath.split(/[/\\]/).filter(Boolean);

  const buildPath = (index: number) => {
    if (index === -1) return '';
    return pathParts.slice(0, index + 1).join('/');
  };

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-300 mb-6">
      <button
        onClick={() => onNavigate('')}
        className="flex items-center space-x-1 hover:text-white transition-colors"
      >
        <Home className="w-4 h-4" />
        <span>Home</span>
      </button>

      {pathParts.map((part, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-4 h-4 text-gray-500" />
          <button
            onClick={() => onNavigate(buildPath(index))}
            className="hover:text-white transition-colors truncate max-w-32"
            title={part}
          >
            {part}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
};