import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';
import sharp from 'sharp';
import os from 'os';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Cache for thumbnails
const thumbnailCache = new Map();

// Supported file types
const SUPPORTED_EXTENSIONS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'],
  models: ['.glb', '.gltf', '.fbx', '.obj', '.dae', '.3ds'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'],
  video: ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
  documents: ['.txt', '.json', '.xml', '.md', '.url']
};

const getFileType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  for (const [type, extensions] of Object.entries(SUPPORTED_EXTENSIONS)) {
    if (extensions.includes(ext)) return type;
  }
  return 'unknown';
};

// ENHANCED colormap finder with MUCH better FBX/OBJ support
const findColormap = (modelPath) => {
  try {
    const modelDir = path.dirname(modelPath);
    const modelName = path.basename(modelPath, path.extname(modelPath));
    const modelExt = path.extname(modelPath).toLowerCase();
    
    console.log(`\n=== 🔍 ENHANCED TEXTURE SEARCH for ${modelExt.toUpperCase()} model: ${modelPath} ===`);
    console.log(`Model directory: ${modelDir}`);
    console.log(`Model name: ${modelName}`);
    
    // ENHANCED search locations with more comprehensive patterns
    const searchLocations = [
      // Same directory as model
      modelDir,
      // Common texture subdirectories
      path.join(modelDir, 'Textures'),
      path.join(modelDir, 'textures'),
      path.join(modelDir, 'Materials'),
      path.join(modelDir, 'materials'),
      path.join(modelDir, 'Maps'),
      path.join(modelDir, 'maps'),
      path.join(modelDir, 'Images'),
      path.join(modelDir, 'images'),
      // Parent directory patterns
      path.dirname(modelDir),
      path.join(path.dirname(modelDir), 'Textures'),
      path.join(path.dirname(modelDir), 'textures'),
      path.join(path.dirname(modelDir), 'Materials'),
      path.join(path.dirname(modelDir), 'materials'),
      // Sibling directories
      path.join(path.dirname(modelDir), 'Textures'),
      path.join(path.dirname(modelDir), 'Materials'),
    ];
    
    // ENHANCED texture names with FBX/OBJ specific patterns
    const textureNames = [
      // Model-specific names (highest priority)
      `${modelName}.png`,
      `${modelName}.jpg`,
      `${modelName}.jpeg`,
      `${modelName}.tga`,
      `${modelName}.bmp`,
      
      // FBX/OBJ common patterns
      `${modelName}_diffuse.png`,
      `${modelName}_diffuse.jpg`,
      `${modelName}_Diffuse.png`,
      `${modelName}_Diffuse.jpg`,
      `${modelName}_albedo.png`,
      `${modelName}_albedo.jpg`,
      `${modelName}_Albedo.png`,
      `${modelName}_Albedo.jpg`,
      `${modelName}_color.png`,
      `${modelName}_color.jpg`,
      `${modelName}_Color.png`,
      `${modelName}_Color.jpg`,
      `${modelName}_colormap.png`,
      `${modelName}_colormap.jpg`,
      `${modelName}_texture.png`,
      `${modelName}_texture.jpg`,
      `${modelName}_map.png`,
      `${modelName}_map.jpg`,
      
      // Common generic names
      'diffuse.png', 'diffuse.jpg', 'Diffuse.png', 'Diffuse.jpg',
      'albedo.png', 'albedo.jpg', 'Albedo.png', 'Albedo.jpg',
      'color.png', 'color.jpg', 'Color.png', 'Color.jpg',
      'colormap.png', 'colormap.jpg', 'ColorMap.png', 'ColorMap.jpg',
      'texture.png', 'texture.jpg', 'Texture.png', 'Texture.jpg',
      'base.png', 'base.jpg', 'Base.png', 'Base.jpg',
      'material.png', 'material.jpg', 'Material.png', 'Material.jpg',
      'map.png', 'map.jpg', 'Map.png', 'Map.jpg',
      
      // TGA format (common in game assets)
      `${modelName}.tga`,
      'diffuse.tga', 'Diffuse.tga',
      'albedo.tga', 'Albedo.tga',
      'color.tga', 'Color.tga',
      'texture.tga', 'Texture.tga',
      
      // BMP format
      `${modelName}.bmp`,
      'diffuse.bmp', 'Diffuse.bmp',
      'texture.bmp', 'Texture.bmp'
    ];
    
    // Search in each location
    for (const location of searchLocations) {
      if (!fs.existsSync(location)) {
        console.log(`❌ Location does not exist: ${location}`);
        continue;
      }
      
      console.log(`🔍 Searching in: ${location}`);
      
      // First, try specific texture names
      for (const textureName of textureNames) {
        const texturePath = path.join(location, textureName);
        if (fs.existsSync(texturePath)) {
          console.log(`✅ FOUND TEXTURE: ${texturePath}`);
          return texturePath;
        }
      }
      
      // If no specific names found, look for any image file with intelligent scoring
      try {
        const files = fs.readdirSync(location);
        console.log(`📁 Files in ${location}:`, files.slice(0, 15)); // Log first 15 files
        
        // Look for image files with intelligent scoring
        const imageFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.png', '.jpg', '.jpeg', '.tga', '.bmp'].includes(ext);
        }).map(file => {
          // Score files based on likelihood of being the main texture
          let score = 0;
          const fileName = file.toLowerCase();
          const fileNameNoExt = path.basename(file, path.extname(file)).toLowerCase();
          const modelNameLower = modelName.toLowerCase();
          
          // Exact model name match (highest score)
          if (fileNameNoExt === modelNameLower) score += 100;
          
          // Model name contained in filename
          if (fileName.includes(modelNameLower)) score += 50;
          
          // Common texture keywords
          if (fileName.includes('diffuse')) score += 30;
          if (fileName.includes('albedo')) score += 25;
          if (fileName.includes('color')) score += 20;
          if (fileName.includes('texture')) score += 15;
          if (fileName.includes('material')) score += 10;
          if (fileName.includes('map')) score += 8;
          if (fileName.includes('base')) score += 5;
          
          // Prefer PNG and JPG over other formats
          const ext = path.extname(file).toLowerCase();
          if (ext === '.png') score += 3;
          if (ext === '.jpg' || ext === '.jpeg') score += 2;
          
          // Penalize normal maps, bump maps, etc.
          if (fileName.includes('normal')) score -= 20;
          if (fileName.includes('bump')) score -= 20;
          if (fileName.includes('height')) score -= 15;
          if (fileName.includes('rough')) score -= 15;
          if (fileName.includes('metal')) score -= 15;
          if (fileName.includes('spec')) score -= 10;
          if (fileName.includes('ao')) score -= 10;
          if (fileName.includes('occlusion')) score -= 10;
          
          return { file, score };
        }).sort((a, b) => b.score - a.score);
        
        if (imageFiles.length > 0 && imageFiles[0].score > 0) {
          const bestMatch = path.join(location, imageFiles[0].file);
          console.log(`✅ FOUND BEST MATCH: ${bestMatch} (score: ${imageFiles[0].score})`);
          console.log(`🏆 Top candidates:`, imageFiles.slice(0, 3).map(f => `${f.file} (${f.score})`));
          return bestMatch;
        }
        
        // If no good matches, try the first image file as last resort
        if (imageFiles.length > 0) {
          const fallback = path.join(location, imageFiles[0].file);
          console.log(`⚠️ FALLBACK TEXTURE: ${fallback}`);
          return fallback;
        }
        
      } catch (e) {
        console.log(`❌ Error reading directory ${location}:`, e.message);
        continue;
      }
    }
    
    console.log(`❌ NO TEXTURE FOUND for model: ${modelPath}`);
    return null;
  } catch (e) {
    console.error(`💥 Error finding colormap for ${modelPath}:`, e);
    return null;
  }
};

// Generate 3D model thumbnail - IMPROVED VERSION
const generate3DModelThumbnail = async (modelPath, size) => {
  try {
    console.log(`\n=== Generating 3D thumbnail for: ${modelPath} ===`);
    
    // First, try to find and use the colormap texture as thumbnail
    const colormapPath = findColormap(modelPath);
    
    if (colormapPath) {
      console.log(`✓ Using colormap texture as thumbnail: ${colormapPath}`);
      try {
        // Create a thumbnail from the colormap texture with 3D styling
        const textureBuffer = await sharp(colormapPath)
          .resize(size, size, { fit: 'contain', background: { r: 42, g: 42, b: 42, alpha: 1 } })
          .jpeg({ quality: 95 })
          .toBuffer();
        
        // Add 3D overlay to indicate it's a model
        const overlayBuffer = await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        })
        .composite([
          {
            input: textureBuffer,
            top: 0,
            left: 0
          },
          {
            input: Buffer.from(`
              <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <!-- 3D indicator badge -->
                <circle cx="${size - 20}" cy="20" r="12" fill="#8b5cf6" opacity="0.9" stroke="white" stroke-width="2"/>
                <text x="${size - 20}" y="20" text-anchor="middle" dy="0.3em" 
                      fill="white" font-size="8" font-family="Arial" font-weight="bold">
                  3D
                </text>
                
                <!-- Subtle gradient overlay for depth -->
                <defs>
                  <radialGradient id="depthGrad" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" style="stop-color:white;stop-opacity:0.1" />
                    <stop offset="100%" style="stop-color:black;stop-opacity:0.2" />
                  </radialGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#depthGrad)" />
              </svg>
            `),
            top: 0,
            left: 0
          }
        ])
        .jpeg({ quality: 90 })
        .toBuffer();
        
        console.log('✓ Successfully generated texture-based 3D thumbnail');
        return overlayBuffer;
        
      } catch (e) {
        console.log('Failed to process colormap texture, falling back to icon');
      }
    }
    
    // If no texture found or texture processing failed, generate enhanced 3D icon
    console.log('Generating enhanced 3D model icon');
    return await generateEnhanced3DIcon(modelPath, size);
    
  } catch (error) {
    console.error('Error generating 3D thumbnail:', error);
    return await generateEnhanced3DIcon(modelPath, size);
  }
};

// Generate enhanced 3D model icon with better visual appeal
const generateEnhanced3DIcon = async (modelPath, size) => {
  const modelTypeColors = {
    '.glb': { primary: '#8b5cf6', secondary: '#a78bfa' },
    '.gltf': { primary: '#8b5cf6', secondary: '#a78bfa' }, 
    '.fbx': { primary: '#06b6d4', secondary: '#67e8f9' },
    '.obj': { primary: '#10b981', secondary: '#6ee7b7' },
    '.dae': { primary: '#f59e0b', secondary: '#fbbf24' },
    '.3ds': { primary: '#ef4444', secondary: '#f87171' }
  };
  
  const ext = path.extname(modelPath).toLowerCase();
  const colors = modelTypeColors[ext] || { primary: '#8b5cf6', secondary: '#a78bfa' };
  
  const canvas = Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#374151;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1f2937;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="cubeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colors.secondary};stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:${colors.primary};stop-opacity:0.8" />
        </linearGradient>
        <linearGradient id="topGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colors.secondary};stop-opacity:0.7" />
          <stop offset="100%" style="stop-color:${colors.primary};stop-opacity:0.6" />
        </linearGradient>
        <linearGradient id="sideGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:0.6" />
          <stop offset="100%" style="stop-color:${colors.primary};stop-opacity:0.4" />
        </linearGradient>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="4" dy="4" stdDeviation="6" flood-color="black" flood-opacity="0.3"/>
        </filter>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge> 
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#bgGrad)" rx="12"/>
      
      <!-- 3D Cube with enhanced depth and lighting -->
      <g transform="translate(${size/2}, ${size/2})" filter="url(#shadow)">
        <!-- Back faces for depth -->
        <polygon points="-${size/8},-${size/5} ${size/8},-${size/5} ${size/6},-${size/3} -${size/6},-${size/3}" 
                 fill="${colors.primary}" opacity="0.2" stroke="white" stroke-width="0.5"/>
        <polygon points="${size/8},-${size/5} ${size/6},-${size/3} ${size/6},${size/6} ${size/8},${size/4}" 
                 fill="${colors.primary}" opacity="0.2" stroke="white" stroke-width="0.5"/>
        
        <!-- Main cube faces -->
        <!-- Front face -->
        <polygon points="-${size/6},-${size/8} ${size/6},-${size/8} ${size/6},${size/3} -${size/6},${size/3}" 
                 fill="url(#cubeGrad)" stroke="white" stroke-width="2" opacity="0.9" filter="url(#glow)"/>
        <!-- Top face -->
        <polygon points="-${size/6},-${size/8} -${size/8},-${size/3} ${size/8},-${size/3} ${size/6},-${size/8}" 
                 fill="url(#topGrad)" stroke="white" stroke-width="2" opacity="0.8"/>
        <!-- Right face -->
        <polygon points="${size/6},-${size/8} ${size/8},-${size/3} ${size/8},${size/6} ${size/6},${size/3}" 
                 fill="url(#sideGrad)" stroke="white" stroke-width="2" opacity="0.6"/>
        
        <!-- Highlight lines for extra depth -->
        <line x1="-${size/6}" y1="-${size/8}" x2="${size/6}" y2="-${size/8}" stroke="white" stroke-width="1" opacity="0.6"/>
        <line x1="-${size/6}" y1="-${size/8}" x2="-${size/8}" y2="-${size/3}" stroke="white" stroke-width="1" opacity="0.6"/>
        <line x1="${size/6}" y1="-${size/8}" x2="${size/8}" y2="-${size/3}" stroke="white" stroke-width="1" opacity="0.6"/>
      </g>
      
      <!-- File extension label with better styling -->
      <text x="50%" y="82%" text-anchor="middle" dy="0.3em" 
            fill="white" font-size="${size/11}" font-family="Arial" font-weight="bold" opacity="0.9"
            filter="url(#shadow)">
        ${ext.substring(1).toUpperCase()}
      </text>
      
      <!-- Enhanced 3D indicator badge -->
      <g filter="url(#shadow)">
        <circle cx="${size - 22}" cy="22" r="14" fill="${colors.primary}" opacity="0.9" stroke="white" stroke-width="2"/>
        <circle cx="${size - 22}" cy="22" r="14" fill="url(#cubeGrad)" opacity="0.3"/>
        <text x="${size - 22}" y="22" text-anchor="middle" dy="0.3em" 
              fill="white" font-size="9" font-family="Arial" font-weight="bold">
          3D
        </text>
      </g>
      
      <!-- Subtle corner highlights -->
      <circle cx="15" cy="15" r="3" fill="white" opacity="0.1"/>
      <circle cx="${size-15}" cy="${size-15}" r="3" fill="white" opacity="0.1"/>
    </svg>
  `);
  
  return await sharp(canvas)
    .resize(size, size)
    .jpeg({ quality: 90 })
    .toBuffer();
};

// Find first asset in a directory - PRIORITIZE 3D MODELS FOR FOLDER PREVIEWS
const findFirstAsset = (dirPath) => {
  try {
    const items = fs.readdirSync(dirPath);
    
    // FIRST PRIORITY: Look for 3D models (they make the best folder previews!)
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      try {
        const stats = fs.statSync(itemPath);
        if (!stats.isDirectory()) {
          const fileType = getFileType(itemPath);
          if (fileType === 'models') {
            console.log(`✓ Found 3D model for folder preview: ${itemPath}`);
            return { path: itemPath, type: fileType };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // SECOND PRIORITY: Look for images (good for previews)
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      try {
        const stats = fs.statSync(itemPath);
        if (!stats.isDirectory()) {
          const fileType = getFileType(itemPath);
          if (fileType === 'images') {
            return { path: itemPath, type: fileType };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // If no images or models, look for any other supported asset
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      try {
        const stats = fs.statSync(itemPath);
        if (!stats.isDirectory()) {
          const fileType = getFileType(itemPath);
          if (fileType !== 'unknown') {
            return { path: itemPath, type: fileType };
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    // Recursively check subdirectories (but only one level deep to avoid performance issues)
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      try {
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
          const subAsset = findFirstAsset(itemPath);
          if (subAsset) {
            return subAsset;
          }
        }
      } catch (e) {
        continue;
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
};

// Get directory contents
app.get('/api/browse', async (req, res) => {
  try {
    let dirPath = req.query.path;
    
    // If no path provided, start with user's home directory
    if (!dirPath) {
      dirPath = os.homedir();
    }
    
    console.log('Browsing directory:', dirPath);
    
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const items = fs.readdirSync(dirPath);
    const results = [];

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      try {
        const itemStats = fs.statSync(itemPath);
        const isDirectory = itemStats.isDirectory();
        
        let fileType = 'folder';
        let hasAssets = false;
        let firstAsset = null;
        
        if (!isDirectory) {
          fileType = getFileType(itemPath);
        } else {
          // Check if folder contains assets and find the first one
          try {
            const folderContents = fs.readdirSync(itemPath);
            hasAssets = folderContents.some(file => {
              const fileType = getFileType(path.join(itemPath, file));
              return fileType !== 'unknown';
            });
            
            if (hasAssets) {
              firstAsset = findFirstAsset(itemPath);
            }
          } catch (e) {
            // Permission denied or other error
          }
        }

        results.push({
          name: item,
          path: itemPath,
          isDirectory,
          fileType,
          hasAssets,
          firstAsset,
          size: itemStats.size,
          modified: itemStats.mtime.toISOString(),
          extension: isDirectory ? null : path.extname(item).toLowerCase()
        });
      } catch (error) {
        // Skip files we can't access
        continue;
      }
    }

    // Sort: directories first, then by name
    results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      currentPath: dirPath,
      parentPath: path.dirname(dirPath),
      items: results
    });
  } catch (error) {
    console.error('Error browsing directory:', error);
    res.status(500).json({ error: 'Failed to browse directory: ' + error.message });
  }
});

// Generate thumbnail with improved caching
app.get('/api/thumbnail', async (req, res) => {
  try {
    const filePath = req.query.path;
    const size = parseInt(req.query.size) || 200;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Create a more specific cache key that includes file modification time
    const stats = fs.statSync(filePath);
    const cacheKey = `${filePath}-${size}-${stats.mtime.getTime()}`;
    
    if (thumbnailCache.has(cacheKey)) {
      const cachedBuffer = thumbnailCache.get(cacheKey);
      res.set('Content-Type', 'image/jpeg');
      return res.send(cachedBuffer);
    }

    const fileType = getFileType(filePath);
    let thumbnailBuffer;

    switch (fileType) {
      case 'images':
        if (path.extname(filePath).toLowerCase() === '.svg') {
          // For SVG, just serve the file directly
          const svgContent = fs.readFileSync(filePath);
          res.set('Content-Type', 'image/svg+xml');
          return res.send(svgContent);
        } else {
          thumbnailBuffer = await sharp(filePath)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .jpeg({ quality: 90 })
            .toBuffer();
        }
        break;
        
      case 'models':
        // Generate texture-based 3D model thumbnail
        console.log(`Generating 3D model thumbnail for: ${filePath}`);
        thumbnailBuffer = await generate3DModelThumbnail(filePath, size);
        break;
        
      default:
        // Generate a colored square with file type icon
        const canvas = Buffer.from(`
          <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#374151"/>
            <text x="50%" y="50%" text-anchor="middle" dy="0.3em" 
                  fill="white" font-size="${size/8}" font-family="Arial">
              ${fileType.toUpperCase()}
            </text>
          </svg>
        `);
        
        thumbnailBuffer = await sharp(canvas)
          .resize(size, size)
          .jpeg({ quality: 80 })
          .toBuffer();
        break;
    }

    // Cache the thumbnail with the new cache key
    thumbnailCache.set(cacheKey, thumbnailBuffer);
    
    // Clean up old cache entries (keep only last 100)
    if (thumbnailCache.size > 100) {
      const keys = Array.from(thumbnailCache.keys());
      for (let i = 0; i < keys.length - 100; i++) {
        thumbnailCache.delete(keys[i]);
      }
    }
    
    res.set('Content-Type', 'image/jpeg');
    res.send(thumbnailBuffer);
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail: ' + error.message });
  }
});

// Generate folder preview thumbnail - NOW WITH 3D MODEL SUPPORT!
app.get('/api/folder-preview', async (req, res) => {
  try {
    const folderPath = req.query.path;
    const size = parseInt(req.query.size) || 200;
    
    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const cacheKey = `folder-preview-${folderPath}-${size}`;
    
    if (thumbnailCache.has(cacheKey)) {
      const cachedBuffer = thumbnailCache.get(cacheKey);
      res.set('Content-Type', 'image/jpeg');
      return res.send(cachedBuffer);
    }

    // Find the first asset in the folder (prioritizes 3D models now!)
    const firstAsset = findFirstAsset(folderPath);
    
    if (!firstAsset) {
      return res.status(404).json({ error: 'No assets found in folder' });
    }

    let thumbnailBuffer;

    if (firstAsset.type === 'images') {
      if (path.extname(firstAsset.path).toLowerCase() === '.svg') {
        // For SVG, create a thumbnail using sharp
        const svgContent = fs.readFileSync(firstAsset.path);
        thumbnailBuffer = await sharp(Buffer.from(svgContent))
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .jpeg({ quality: 90 })
          .toBuffer();
      } else {
        thumbnailBuffer = await sharp(firstAsset.path)
          .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .jpeg({ quality: 90 })
          .toBuffer();
      }
    } else if (firstAsset.type === 'models') {
      // 🎉 FOR 3D MODELS IN FOLDER PREVIEWS - USE THE SAME AWESOME THUMBNAIL GENERATION!
      console.log(`🎯 Generating 3D model thumbnail for folder preview: ${firstAsset.path}`);
      thumbnailBuffer = await generate3DModelThumbnail(firstAsset.path, size);
    } else {
      // For non-image, non-model assets, create a colored thumbnail with type indicator
      const typeColors = {
        audio: '#10b981',
        video: '#ef4444',
        documents: '#f59e0b'
      };
      
      const color = typeColors[firstAsset.type] || '#6b7280';
      
      const canvas = Buffer.from(`
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${color};stop-opacity:0.8" />
              <stop offset="100%" style="stop-color:${color};stop-opacity:0.4" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)"/>
          <text x="50%" y="40%" text-anchor="middle" dy="0.3em" 
                fill="white" font-size="${size/10}" font-family="Arial" font-weight="bold">
            ${firstAsset.type.toUpperCase()}
          </text>
          <text x="50%" y="65%" text-anchor="middle" dy="0.3em" 
                fill="white" font-size="${size/16}" font-family="Arial" opacity="0.8">
            ASSET
          </text>
        </svg>
      `);
      
      thumbnailBuffer = await sharp(canvas)
        .resize(size, size)
        .jpeg({ quality: 80 })
        .toBuffer();
    }

    // Cache the thumbnail
    thumbnailCache.set(cacheKey, thumbnailBuffer);
    
    res.set('Content-Type', 'image/jpeg');
    res.send(thumbnailBuffer);
  } catch (error) {
    console.error('Error generating folder preview:', error);
    res.status(500).json({ error: 'Failed to generate folder preview: ' + error.message });
  }
});

// Serve files
app.get('/api/file', (req, res) => {
  try {
    const filePath = req.query.path;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.set('Content-Type', mimeType);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Failed to serve file: ' + error.message });
  }
});

// Get text file content
app.get('/api/text-content', (req, res) => {
  try {
    const filePath = req.query.path;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileType = getFileType(filePath);
    if (fileType !== 'documents') {
      return res.status(400).json({ error: 'Not a text file' });
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const extension = path.extname(filePath).toLowerCase();
    
    res.json({
      content,
      extension,
      encoding: 'utf8'
    });
  } catch (error) {
    console.error('Error reading text file:', error);
    res.status(500).json({ error: 'Failed to read text file: ' + error.message });
  }
});

// Get colormap texture for 3D model - ENHANCED VERSION
app.get('/api/model-texture', (req, res) => {
  try {
    const modelPath = req.query.path;
    
    console.log(`\n🎨 Model texture request for: ${modelPath}`);
    
    if (!modelPath || !fs.existsSync(modelPath)) {
      console.log(`❌ Model file not found: ${modelPath}`);
      return res.status(404).json({ error: 'Model file not found' });
    }

    const colormapPath = findColormap(modelPath);
    
    if (!colormapPath) {
      console.log(`❌ No colormap texture found for: ${modelPath}`);
      return res.status(404).json({ error: 'No colormap texture found' });
    }

    console.log(`✅ Serving colormap texture: ${colormapPath}`);

    const mimeType = mime.lookup(colormapPath) || 'image/png';
    res.set('Content-Type', mimeType);
    
    const fileStream = fs.createReadStream(colormapPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('💥 Error serving model texture:', error);
    res.status(500).json({ error: 'Failed to serve model texture: ' + error.message });
  }
});

// Show file in system explorer
app.post('/api/show-in-folder', (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const platform = os.platform();
    let command;

    switch (platform) {
      case 'win32':
        // Windows - use explorer with /select to highlight the file
        command = `explorer /select,"${filePath.replace(/\//g, '\\')}"`;
        break;
      case 'darwin':
        // macOS - use open with -R to reveal in Finder
        command = `open -R "${filePath}"`;
        break;
      case 'linux':
        // Linux - try different file managers
        const fileManager = process.env.XDG_CURRENT_DESKTOP?.toLowerCase();
        if (fileManager?.includes('gnome')) {
          command = `nautilus --select "${filePath}"`;
        } else if (fileManager?.includes('kde')) {
          command = `dolphin --select "${filePath}"`;
        } else {
          // Fallback - open the containing directory
          const dirPath = path.dirname(filePath);
          command = `xdg-open "${dirPath}"`;
        }
        break;
      default:
        return res.status(400).json({ error: 'Unsupported operating system' });
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error opening file in explorer:', error);
        return res.status(500).json({ error: 'Failed to open file in explorer' });
      }
      res.json({ success: true, message: 'File revealed in explorer' });
    });

  } catch (error) {
    console.error('Error showing file in folder:', error);
    res.status(500).json({ error: 'Failed to show file in folder: ' + error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Total Asset Browser API running on http://localhost:${PORT}`);
  console.log(`📁 Starting directory: ${os.homedir()}`);
});