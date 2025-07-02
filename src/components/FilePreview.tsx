import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Download, ExternalLink, FolderOpen, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, RotateCw, Move3D } from 'lucide-react';
import { FileItem } from '../types';
import { FileTypeIcon } from './FileTypeIcon';
import { formatFileSize, formatDate } from '../utils/formatters';

interface FilePreviewProps {
  file: FileItem;
  onClose: () => void;
  getFileUrl: (path: string) => string;
  getThumbnailUrl: (path: string, size?: number) => string;
  onNavigate?: (direction: 'prev' | 'next') => void;
  canNavigate?: boolean;
  currentIndex?: number;
  totalFiles?: number;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  onClose,
  getFileUrl,
  getThumbnailUrl,
  onNavigate,
  canNavigate = false,
  currentIndex = 1,
  totalFiles = 1
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const modelContainerRef = useRef<HTMLDivElement>(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragStartImagePositionRef = useRef({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [textContent, setTextContent] = useState<string>('');
  const [textLoading, setTextLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [threeScene, setThreeScene] = useState<any>(null);

  const showInFolder = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/show-in-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: file.path }),
      });

      // Don't show error popup since the folder opens fine
      // Just log for debugging purposes
      if (!response.ok) {
        console.log('Show in folder response not ok, but folder likely opened anyway');
      } else {
        console.log('File revealed in explorer successfully');
      }
    } catch (error) {
      // Only log errors, don't show popup since functionality works
      console.error('Error showing file in folder:', error);
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Reset zoom and position when file changes
  useEffect(() => {
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
    setImageNaturalSize({ width: 0, height: 0 });
    setTextContent('');
    setModelError(null);
    
    // Cleanup Three.js scene
    if (threeScene) {
      if (threeScene.cleanup) {
        threeScene.cleanup();
      }
      setThreeScene(null);
    }
  }, [file.path]);

  // Load 3D model - UPDATED with improved geometric centering
  useEffect(() => {
    if (file.fileType === 'models' && modelContainerRef.current) {
      loadThreeJSModel();
    }
  }, [file.path, file.fileType]);

  const loadThreeJSModel = async () => {
    if (!modelContainerRef.current) return;

    setModelLoading(true);
    setModelError(null);

    try {
      // Dynamically import Three.js modules
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

      const container = modelContainerRef.current;
      const width = container.clientWidth;
      const height = container.clientHeight;

      // Create scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x2a2a2a); // Dark gray background

      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

      // Create renderer
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // Clear container and add renderer
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      // Add comprehensive lighting setup - PURE WHITE LIGHTING
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(5, 5, 5);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 50;
      scene.add(directionalLight);

      // Add fill lights - ALL WHITE
      const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.4);
      fillLight1.position.set(-5, 0, 2);
      scene.add(fillLight1);

      const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
      fillLight2.position.set(0, -5, 2);
      scene.add(fillLight2);

      // Add orbit controls - FULL INTERACTIVE CONTROLS RESTORED!
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.minDistance = 0.5;
      controls.maxDistance = 100;
      controls.autoRotate = false;

      // Load model based on file extension
      const fileUrl = getFileUrl(file.path);
      const extension = file.extension?.toLowerCase();

      let loader: any;
      switch (extension) {
        case '.glb':
        case '.gltf':
          loader = new GLTFLoader();
          break;
        case '.fbx':
          loader = new FBXLoader();
          break;
        case '.obj':
          loader = new OBJLoader();
          break;
        default:
          throw new Error(`Unsupported 3D model format: ${extension}`);
      }

      // Load texture
      const loadTexture = async () => {
        try {
          const textureResponse = await fetch(`http://localhost:3001/api/model-texture?path=${encodeURIComponent(file.path)}`);
          if (textureResponse.ok) {
            const textureBlob = await textureResponse.blob();
            const textureUrl = URL.createObjectURL(textureBlob);
            const textureLoader = new THREE.TextureLoader();
            
            return new Promise((resolve, reject) => {
              textureLoader.load(
                textureUrl,
                (texture) => {
                  // Configure texture properly according to type
                  texture.flipY = extension === ".fbx" || extension === ".obj";
                  texture.wrapS = THREE.RepeatWrapping;
                  texture.wrapT = THREE.RepeatWrapping;
                  texture.colorSpace = THREE.SRGBColorSpace;
                  resolve(texture);
                },
                undefined,
                (error) => {
                  console.error('Error loading texture:', error);
                  reject(error);
                }
              );
            });
          }
        } catch (e) {
          console.log('No texture available');
        }
        return null;
      };

      // Load texture first, then model
      const modelTexture = await loadTexture();

      loader.load(
        fileUrl,
        (object: any) => {
          let model;
          
          if (extension === '.glb' || extension === '.gltf') {
            model = object.scene;
          } else {
            model = object;
          }

          // 🎯 IMPROVED: Calculate precise bounding box and center the model properly
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          console.log(`📐 Model bounds - Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}), Size: (${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)})`);
          
          // Create a group to hold the model for better transformation control
          const modelGroup = new THREE.Group();
          modelGroup.add(model);
          
          // Move the model so its geometric center is at the origin (0,0,0)
          model.position.set(-center.x, -center.y, -center.z);
          
          // Calculate optimal scale to ensure the model is fully visible in the preview
          const maxDim = Math.max(size.x, size.y, size.z);
          // Use a more conservative scale factor for the preview to ensure full visibility
          const scale = 2.5 / maxDim; // Reduced from 3.5 to 2.5 for better fit in preview
          modelGroup.scale.setScalar(scale);
          modelGroup.rotation.y = THREE.MathUtils.degToRad(90);


          // Apply materials and textures
          model.traverse((child: any) => {
            if (child.isMesh) {
              if (child.isMesh) {
                child.material.map = modelTexture
                child.material.needsUpdate = true
              }
            }
          });

          scene.add(modelGroup);

          // 🎯 IMPROVED: Position camera for better front-facing view
          // Calculate the scaled bounding sphere radius for optimal camera distance
          const scaledMaxDim = maxDim * scale;
          const boundingSphereRadius = scaledMaxDim * Math.sqrt(3) / 2; // Diagonal of bounding box / 2
          
          // Calculate camera distance based on field of view and bounding sphere
          const fov = camera.fov * (Math.PI / 180); // Convert to radians
          const cameraDistance = boundingSphereRadius / Math.sin(fov / 2);
          
          // Reducing camera distance slightly to display models better
          const paddedDistance = cameraDistance * 0.8;
          
          // 🎯 NEW: Better camera positioning for front-facing view
          // Position camera more towards the front-right-top for better viewing angle
          const cameraX = paddedDistance * 0.8;  // More to the front (positive X)
          const cameraY = paddedDistance * 0.4;  // Slightly elevated
          const cameraZ = paddedDistance * 0.6;  // Less depth, more front-facing
          
          camera.position.set(cameraX, cameraY, cameraZ);
          camera.lookAt(0, 0, 0); // Look at the origin where the model center now is
          controls.target.set(0, 0, 0); // Set orbit controls target to origin
          controls.update();
          
          console.log(`📷 Camera positioned at: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}), distance: ${paddedDistance.toFixed(2)}`);

          setModelLoading(false);
        },
        (progress) => {
          // Loading progress
          const percent = (progress.loaded / progress.total * 100);
          console.log('Loading progress:', percent + '%');
        },
        (error) => {
          console.error('Error loading 3D model:', error);
          setModelError('Failed to load 3D model. The file may be corrupted or in an unsupported format.');
          setModelLoading(false);
        }
      );

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        if (!container) return;
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };

      window.addEventListener('resize', handleResize);

      // Store scene data for cleanup
      setThreeScene({
        scene,
        camera,
        renderer,
        controls,
        cleanup: () => {
          window.removeEventListener('resize', handleResize);
          controls.dispose();
          renderer.dispose();
          scene.clear();
        }
      });

    } catch (error) {
      console.error('Error setting up 3D viewer:', error);
      setModelError('Failed to initialize 3D viewer. Please try again.');
      setModelLoading(false);
    }
  };

  // Cleanup Three.js on unmount
  useEffect(() => {
    return () => {
      if (threeScene?.cleanup) {
        threeScene.cleanup();
      }
    };
  }, [threeScene]);

  // Auto-play audio when file changes or component mounts
  useEffect(() => {
    if (file.fileType === 'audio' && audioRef.current) {
      // Force reload the audio element
      audioRef.current.load();
      
      // Attempt to auto-play after a short delay to ensure the audio is loaded
      const playAudio = async () => {
        try {
          await audioRef.current?.play();
          console.log('Audio auto-play started successfully');
        } catch (error) {
          console.log('Audio auto-play failed (likely due to browser policy):', error);
          // This is expected behavior in many browsers due to autoplay policies
          // The user will need to click play manually
        }
      };

      // Small delay to ensure audio element is ready
      const timeoutId = setTimeout(playAudio, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [file.path, file.fileType]);

  // Force audio/video reload when file changes (keeping existing logic)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
    }
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [file.path]);

  // Load text content for text files
  useEffect(() => {
    if (file.fileType === 'documents' && (file.extension === '.txt' || file.extension === '.url' || file.extension === '.json' || file.extension === '.xml' || file.extension === '.md')) {
      setTextLoading(true);
      fetch(`http://localhost:3001/api/text-content?path=${encodeURIComponent(file.path)}`)
        .then(response => response.json())
        .then(data => {
          if (data.content !== undefined) {
            setTextContent(data.content);
          } else {
            setTextContent('Error loading file content');
          }
        })
        .catch(error => {
          console.error('Error loading text content:', error);
          setTextContent('Error loading file content');
        })
        .finally(() => {
          setTextLoading(false);
        });
    }
  }, [file.path, file.fileType, file.extension]);

  // Update container size on resize
  useEffect(() => {
    const updateContainerSize = () => {
      if (imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  // Handle image load to get natural dimensions
  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageNaturalSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
    }
  };

  // Calculate if image should be scaled down to fit
  const getImageDisplaySize = () => {
    if (!imageNaturalSize.width || !imageNaturalSize.height || !containerSize.width || !containerSize.height) {
      return { width: 'auto', height: 'auto', shouldScale: false };
    }

    // Always show small images at their actual size
    const isSmallImage = imageNaturalSize.width <= containerSize.width && imageNaturalSize.height <= containerSize.height;
    
    if (isSmallImage) {
      // Image fits within container, show at natural size
      return {
        width: imageNaturalSize.width,
        height: imageNaturalSize.height,
        shouldScale: false
      };
    }

    // Image is larger than container, scale it down to fit
    const containerAspect = containerSize.width / containerSize.height;
    const imageAspect = imageNaturalSize.width / imageNaturalSize.height;

    if (imageAspect > containerAspect) {
      // Image is wider, fit to width
      const scaledWidth = containerSize.width;
      const scaledHeight = scaledWidth / imageAspect;
      return {
        width: scaledWidth,
        height: scaledHeight,
        shouldScale: true
      };
    } else {
      // Image is taller, fit to height
      const scaledHeight = containerSize.height;
      const scaledWidth = scaledHeight * imageAspect;
      return {
        width: scaledWidth,
        height: scaledHeight,
        shouldScale: true
      };
    }
  };

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
        case '+':
        case '=':
          if (file.fileType === 'images') {
            e.preventDefault();
            handleZoomIn();
          }
          break;
        case '-':
          if (file.fileType === 'images') {
            e.preventDefault();
            handleZoomOut();
          }
          break;
        case '0':
          if (file.fileType === 'images') {
            e.preventDefault();
            resetZoom();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canNavigate, onNavigate, onClose, file.fileType]);

  const handleZoomIn = () => {
    setImageZoom(prev => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setImageZoom(prev => Math.max(prev / 1.5, 0.1));
  };

  const resetZoom = () => {
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Optimized mouse event handlers using useCallback
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (imageZoom > 1) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      // Store the mouse position and image position at drag start in refs
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      dragStartImagePositionRef.current = { ...imagePosition };
      
      // Add global mouse event listeners for better performance
      const handleGlobalMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        setImagePosition({
          x: dragStartImagePositionRef.current.x + (e.clientX - dragStartRef.current.x),
          y: dragStartImagePositionRef.current.y + (e.clientY - dragStartRef.current.y)
        });
      };

      const handleGlobalMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        setIsDragging(false);
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [imageZoom, imagePosition]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (file.fileType === 'images') {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setImageZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
    }
  }, [file.fileType]);

  // Prevent context menu on image
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const imageDisplaySize = getImageDisplaySize();

  // Parse URL file content
  const parseUrlFile = (content: string) => {
    const lines = content.split('\n');
    const urlLine = lines.find(line => line.startsWith('URL='));
    return urlLine ? urlLine.substring(4) : content;
  };

  // Get syntax highlighting class based on file extension
  const getSyntaxClass = (extension: string) => {
    switch (extension) {
      case '.json':
        return 'language-json';
      case '.xml':
        return 'language-xml';
      case '.md':
        return 'language-markdown';
      default:
        return 'language-text';
    }
  };

  // Get the current folder path from file.path
  const getCurrentFolderPath = () => {
    const lastSep = file.path.lastIndexOf('/') !== -1 ? file.path.lastIndexOf('/') : file.path.lastIndexOf('\\');
    return lastSep !== -1 ? file.path.slice(0, lastSep) : '';
  };

  const renderPreview = () => {
    switch (file.fileType) {
      case 'images':
        return (
          <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height: '60vh' }}>
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex items-center space-x-2 bg-black/50 rounded-lg p-2">
              <button
                onClick={handleZoomOut}
                className="p-1 text-white hover:text-gray-300 transition-colors"
                title="Zoom out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-white text-sm font-mono min-w-12 text-center">
                {Math.round(imageZoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1 text-white hover:text-gray-300 transition-colors"
                title="Zoom in (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={resetZoom}
                className="p-1 text-white hover:text-gray-300 transition-colors"
                title="Reset zoom (0)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Image Container */}
            <div
              ref={imageContainerRef}
              className="w-full h-full flex items-center justify-center select-none"
              onMouseDown={handleMouseDown}
              onWheel={handleWheel}
              onContextMenu={handleContextMenu}
              style={{
                cursor: imageZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none'
              }}
            >
              <img
                ref={imageRef}
                src={getFileUrl(file.path)}
                alt={file.name}
                className="pointer-events-none"
                style={{
                  width: imageDisplaySize.width,
                  height: imageDisplaySize.height,
                  transform: `scale(${imageZoom}) translate(${imagePosition.x / imageZoom}px, ${imagePosition.y / imageZoom}px)`,
                  transformOrigin: 'center center',
                  imageRendering: imageDisplaySize.shouldScale ? 'auto' : 'pixelated',
                  willChange: isDragging ? 'transform' : 'auto',
                  transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                draggable={false}
                onLoad={handleImageLoad}
                onDragStart={(e) => e.preventDefault()}
                onSelectStart={(e) => e.preventDefault()}
              />
            </div>

            {/* Zoom Instructions */}
            {imageZoom === 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                {imageDisplaySize.shouldScale 
                  ? 'Scroll to zoom • Click and drag when zoomed' 
                  : `Actual size: ${imageNaturalSize.width}×${imageNaturalSize.height}px • Scroll to zoom`
                }
              </div>
            )}
          </div>
        );
      
      case 'models':
        return (
          <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height: '60vh' }}>
            {/* 3D Model Controls */}
            <div className="absolute top-4 right-4 z-10 flex items-center space-x-2 bg-black/50 rounded-lg p-2">
              <Move3D className="w-4 h-4 text-white" />
              <span className="text-white text-xs">3D Model</span>
            </div>

            {/* Model Container */}
            <div
              ref={modelContainerRef}
              className="w-full h-full"
              style={{ minHeight: '400px' }}
            />

            {/* Loading State */}
            {modelLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-white">Loading 3D model...</p>
                  <p className="text-gray-400 text-sm">This may take a moment for large files</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {modelError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center p-8">
                  <FileTypeIcon fileType="models" isDirectory={false} className="w-16 h-16 mx-auto mb-4 text-red-400" />
                  <p className="text-red-400 mb-2">Failed to load 3D model</p>
                  <p className="text-gray-400 text-sm">{modelError}</p>
                  <button
                    onClick={loadThreeJSModel}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-sm"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* 3D Controls Instructions */}
            {!modelLoading && !modelError && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white text-xs px-3 py-1 rounded-full">
                Left click + drag to rotate • Right click + drag to pan • Scroll to zoom
              </div>
            )}
          </div>
        );
      
      case 'audio':
        return (
          <div className="bg-gray-900 rounded-lg p-8">
            <audio 
              ref={audioRef}
              controls 
              className="w-full"
              key={file.path} // Force re-render when file changes
              preload="auto" // Preload audio for faster playback
            >
              <source src={getFileUrl(file.path)} />
              Your browser does not support the audio element.
            </audio>
            <div className="mt-4 text-center">
              <p className="text-gray-400 text-sm">
                🎵 Audio will auto-play when opened (if browser allows)
              </p>
            </div>
          </div>
        );
      
      case 'video':
        return (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <video 
              ref={videoRef}
              controls 
              className="w-full max-h-96"
              key={file.path} // Force re-render when file changes
            >
              <source src={getFileUrl(file.path)} />
              Your browser does not support the video element.
            </video>
          </div>
        );
      
      case 'documents':
        if (file.extension === '.txt' || file.extension === '.url' || file.extension === '.json' || file.extension === '.xml' || file.extension === '.md') {
          if (textLoading) {
            return (
              <div className="bg-gray-900 rounded-lg p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-400">Loading file content...</p>
              </div>
            );
          }

          // Special handling for URL files
          if (file.extension === '.url') {
            const url = parseUrlFile(textContent);
            return (
              <div className="bg-gray-900 rounded-lg p-6">
                <div className="mb-4">
                  <h4 className="text-lg font-semibold text-white mb-2">URL Shortcut</h4>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-400 mb-1">Target URL:</p>
                        <p className="text-white font-mono text-sm break-all">{url}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 max-h-64 overflow-auto">
                  <h5 className="text-sm font-medium text-gray-300 mb-2">Raw Content:</h5>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                    <code>{textContent}</code>
                  </pre>
                </div>
              </div>
            );
          }

          // Regular text file display
          return (
            <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-auto">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-300">
                  {file.extension === '.json' ? 'JSON Content' : 
                   file.extension === '.xml' ? 'XML Content' :
                   file.extension === '.md' ? 'Markdown Content' : 'Text Content'}
                </h4>
                <span className="text-xs text-gray-500">
                  {textContent.split('\n').length} lines • {textContent.length} characters
                </span>
              </div>
              <pre className={`text-sm text-gray-300 whitespace-pre-wrap ${getSyntaxClass(file.extension || '')}`}>
                <code>{textContent}</code>
              </pre>
            </div>
          );
        }
        return (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <FileTypeIcon fileType={file.fileType} isDirectory={false} className="w-16 h-16 mx-auto mb-4" />
            <p className="text-gray-400">Preview not available for this file type</p>
          </div>
        );
      
      default:
        return (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <FileTypeIcon fileType={file.fileType} isDirectory={false} className="w-16 h-16 mx-auto mb-4" />
            <p className="text-gray-400">Preview not available for this file type</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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

      <div className="bg-gray-800 rounded-xl w-full max-w-7xl mx-auto flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <FileTypeIcon fileType={file.fileType} isDirectory={false} className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-semibold text-white">{file.name}</h2>
              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <span>{formatFileSize(file.size)} • {formatDate(file.modified)}</span>
                {canNavigate && (
                  <span>{currentIndex} of {totalFiles}</span>
                )}
                {file.fileType === 'images' && imageNaturalSize.width > 0 && (
                  <span>{imageNaturalSize.width}×{imageNaturalSize.height}px</span>
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

        {/* Preview - This is the main content area */}
        <div className="flex-1 overflow-hidden">
          <div className="p-6 h-full">
            {renderPreview()}
          </div>
        </div>

        {/* File Details */}
        <div className="px-6 pb-6 flex-shrink-0">
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">File Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Path:</span>
                <p className="text-white font-mono text-xs break-all">{file.path}</p>
              </div>
              <div>
                <span className="text-gray-400">Type:</span>
                <p className="text-white">{file.fileType}</p>
              </div>
              <div>
                <span className="text-gray-400">Extension:</span>
                <p className="text-white">{file.extension || 'None'}</p>
              </div>
              <div>
                <span className="text-gray-400">Size:</span>
                <p className="text-white">{formatFileSize(file.size)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation hint */}
        {canNavigate && (
          <div className="px-6 pb-4 flex-shrink-0">
            <div className="text-center text-xs text-gray-500">
              Use ← → arrow keys to navigate • {
                file.fileType === 'images' ? 'Scroll to zoom • +/- keys to zoom • 0 to reset' : 
                file.fileType === 'models' ? 'Left click + drag to rotate • Right click + drag to pan • Scroll to zoom' :
                file.fileType === 'audio' ? 'Audio auto-plays when opened' :
                'Esc to close'
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};