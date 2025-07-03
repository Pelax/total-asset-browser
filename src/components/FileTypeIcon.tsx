import React from 'react';
import {
  Image,
  Box,
  Music,
  Video,
  FileText,
  Folder,
  FolderOpen,
  File,
  Type
} from 'lucide-react';

interface FileTypeIconProps {
  fileType: string;
  isDirectory: boolean;
  hasAssets?: boolean;
  className?: string;
}

export const FileTypeIcon: React.FC<FileTypeIconProps> = ({
  fileType,
  isDirectory,
  hasAssets,
  className = "w-6 h-6"
}) => {
  if (isDirectory) {
    return hasAssets ?
      <FolderOpen className={`${className} text-emerald-400`} /> :
      <Folder className={`${className} text-gray-400`} />;
  }

  switch (fileType) {
    case 'images':
      return <Image className={`${className} text-blue-400`} />;
    case 'models':
      return <Box className={`${className} text-purple-400`} />;
    case 'audio':
      return <Music className={`${className} text-green-400`} />;
    case 'video':
      return <Video className={`${className} text-red-400`} />;
    case 'documents':
      return <FileText className={`${className} text-yellow-400`} />;
    case 'fonts':
      return <Type className={`${className} text-orange-400`} />;
    default:
      return <File className={`${className} text-gray-400`} />;
  }
};