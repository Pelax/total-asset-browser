export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  fileType: string;
  hasAssets?: boolean;
  firstAsset?: {
    path: string;
    type: string;
  } | null;
  size: number;
  modified: string;
  extension: string | null;
}

export interface DirectoryResponse {
  currentPath: string;
  parentPath: string;
  items: FileItem[];
}