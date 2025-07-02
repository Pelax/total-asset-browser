import React from 'react';

interface ModelLoadRequest {
  id: string;
  modelPath: string;
  containerRef: React.RefObject<HTMLDivElement>;
  onLoad: (scene: any) => void;
  onError: (error: string) => void;
  priority: number; // Higher number = higher priority
}

interface LoadingState {
  loading: boolean;
  error: string | null;
  loaded: boolean;
}

interface LoadedModel {
  scene: any;
  renderer: any;
  animationId?: number;
  cleanup: () => void;
  lastUsed: number;
}

class ModelLoadQueue {
  private queue: ModelLoadRequest[] = [];
  private loading: Set<string> = new Set();
  private loadedModels: Map<string, LoadedModel> = new Map();
  private maxConcurrent = 4; // Maximum concurrent loads
  private maxLoaded = 15; // Maximum models to keep loaded in memory
  private abortControllers: Map<string, AbortController> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Run cleanup every 30 seconds to free unused models
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldModels();
    }, 30000);
  }

  addRequest(request: ModelLoadRequest) {
    // Remove any existing request with the same ID
    this.queue = this.queue.filter(r => r.id !== request.id);

    // Update last used time if model is already loaded
    if (this.loadedModels.has(request.id)) {
      const model = this.loadedModels.get(request.id)!;
      model.lastUsed = Date.now();
      request.onLoad(model);
      return;
    }

    // Add new request and sort by priority
    this.queue.push(request);
    this.queue.sort((a, b) => b.priority - a.priority);

    this.processQueue();
  }

  removeRequest(id: string) {
    // Remove from queue
    this.queue = this.queue.filter(r => r.id !== id);

    // Cancel if currently loading
    if (this.loading.has(id)) {
      const controller = this.abortControllers.get(id);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(id);
      }
      this.loading.delete(id);
      this.processQueue(); // Process next in queue
    }
  }

  clearAll() {
    console.log('🧹 Clearing all 3D models from memory...');

    // Clear queue
    this.queue = [];

    // Cancel all loading requests
    for (const [id, controller] of this.abortControllers) {
      controller.abort();
    }
    this.abortControllers.clear();
    this.loading.clear();

    // Aggressively cleanup all loaded models
    this.forceCleanupAllModels();
  }

  private forceCleanupAllModels() {
    let cleanedCount = 0;

    for (const [id, model] of this.loadedModels) {
      this.deepCleanupModel(model);
      cleanedCount++;
    }

    this.loadedModels.clear();

    if (cleanedCount > 0) {
      console.log(`🗑️ Force cleaned ${cleanedCount} 3D models from memory`);

      // Force garbage collection if available (Chrome DevTools)
      if (window.gc) {
        window.gc();
      }
    }
  }

  private cleanupOldModels() {
    if (this.loadedModels.size <= this.maxLoaded) return;

    const now = Date.now();
    const modelsToCleanup: [string, LoadedModel][] = [];

    // Find models that haven't been used in the last 2 minutes
    for (const [id, model] of this.loadedModels) {
      const timeSinceLastUse = now - model.lastUsed;
      if (timeSinceLastUse > 120000) { // 2 minutes
        modelsToCleanup.push([id, model]);
      }
    }

    // Sort by last used time (oldest first) and cleanup excess models
    modelsToCleanup.sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    const excessCount = this.loadedModels.size - this.maxLoaded;
    const toCleanup = Math.max(modelsToCleanup.length, excessCount);

    for (let i = 0; i < Math.min(toCleanup, modelsToCleanup.length); i++) {
      const [id, model] = modelsToCleanup[i];
      this.deepCleanupModel(model);
      this.loadedModels.delete(id);
    }

    if (toCleanup > 0) {
      console.log(`🧹 Auto-cleaned ${toCleanup} old 3D models from memory`);
    }
  }

  private deepCleanupModel(model: LoadedModel) {
    try {
      // Stop animation loop
      if (model.animationId) {
        cancelAnimationFrame(model.animationId);
      }

      // Deep cleanup of Three.js objects
      if (model.scene) {
        // Traverse and dispose of all geometries, materials, and textures
        model.scene.traverse((object: any) => {
          if (object.geometry) {
            object.geometry.dispose();
          }

          if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material: any) => {
              // Dispose of all textures
              Object.keys(material).forEach(key => {
                const value = material[key];
                if (value && value.isTexture) {
                  value.dispose();
                }
              });

              // Dispose of material
              if (material.dispose) {
                material.dispose();
              }
            });
          }
        });

        // Clear the scene
        model.scene.clear();
      }

      // Dispose of renderer and its context
      if (model.renderer) {
        const gl = model.renderer.getContext();
        if (gl) {
          // Force WebGL context cleanup
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
          }
        }

        model.renderer.dispose();
        model.renderer.forceContextLoss();

        // Remove canvas from DOM
        if (model.renderer.domElement && model.renderer.domElement.parentNode) {
          model.renderer.domElement.parentNode.removeChild(model.renderer.domElement);
        }
      }

      // Call custom cleanup if available
      if (model.cleanup) {
        model.cleanup();
      }

    } catch (error) {
      console.warn('Error during model cleanup:', error);
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.forceCleanupAllModels();
  }

  private async processQueue() {
    while (this.queue.length > 0 && this.loading.size < this.maxConcurrent) {
      const request = this.queue.shift()!;

      if (!request.containerRef.current) {
        continue; // Skip if container no longer exists
      }

      this.loading.add(request.id);
      const controller = new AbortController();
      this.abortControllers.set(request.id, controller);

      try {
        const model = await this.loadModel(request, controller.signal);
        if (model && !controller.signal.aborted) {
          // Store loaded model with timestamp
          this.loadedModels.set(request.id, {
            ...model,
            lastUsed: Date.now()
          });

          // Cleanup old models if we have too many
          if (this.loadedModels.size > this.maxLoaded) {
            this.cleanupOldModels();
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          request.onError(error instanceof Error ? error.message : 'Failed to load model');
        }
      } finally {
        this.loading.delete(request.id);
        this.abortControllers.delete(request.id);

        // Process next in queue
        setTimeout(() => this.processQueue(), 0);
      }
    }
  }

  private async loadModel(request: ModelLoadRequest, signal: AbortSignal) {
    const { modelPath, containerRef, onLoad, onError } = request;

    if (!containerRef.current || signal.aborted) return;

    // Dynamically import Three.js modules
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');

    if (signal.aborted) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance" // Prefer dedicated GPU
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    if (signal.aborted) {
      renderer.dispose();
      return;
    }

    // Clear container and add renderer
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Add lighting - PURE WHITE ONLY, NO COLOR TINTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(3, 3, 3);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add additional white fill lights for even illumination
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight1.position.set(-3, 0, 2);
    scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight2.position.set(0, -3, 2);
    scene.add(fillLight2);

    // Load model based on file extension
    const fileUrl = `http://localhost:3001/api/file?path=${encodeURIComponent(modelPath)}`;
    const extension = modelPath.split('.').pop()?.toLowerCase();

    let loader: any;
    switch (extension) {
      case 'glb':
      case 'gltf':
        loader = new GLTFLoader();
        break;
      case 'fbx':
        loader = new FBXLoader();
        break;
      case 'obj':
        loader = new OBJLoader();
        break;
      default:
        throw new Error(`Unsupported 3D model format: ${extension}`);
    }

    if (signal.aborted) {
      renderer.dispose();
      scene.clear();
      return;
    }

    // Load texture
    const loadTexture = async () => {
      try {
        const textureResponse = await fetch(`http://localhost:3001/api/model-texture?path=${encodeURIComponent(modelPath)}`, {
          signal
        });
        if (textureResponse.ok && !signal.aborted) {
          const textureBlob = await textureResponse.blob();
          const textureUrl = URL.createObjectURL(textureBlob);
          const textureLoader = new THREE.TextureLoader();

          return new Promise((resolve, reject) => {
            if (signal.aborted) {
              reject(new Error('Aborted'));
              return;
            }

            textureLoader.load(
              textureUrl,
              (texture) => {
                if (signal.aborted) {
                  reject(new Error('Aborted'));
                  return;
                }
                // Configure texture properly according to type
                texture.flipY = extension === 'fbx' || extension === 'obj';
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.colorSpace = THREE.SRGBColorSpace;
                resolve(texture);
              },
              undefined,
              reject
            );
          });
        }
      } catch (e) {
        if (!signal.aborted) {
          console.log('No texture available');
        }
      }
      return null;
    };

    const modelTexture = await loadTexture();

    if (signal.aborted) {
      renderer.dispose();
      scene.clear();
      return;
    }

    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Aborted'));
        return;
      }

      loader.load(
        fileUrl,
        (object: any) => {
          if (signal.aborted) {
            reject(new Error('Aborted'));
            return;
          }

          let model;

          if (extension === 'glb' || extension === 'gltf') {
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

          // Calculate optimal scale to ensure the model is fully visible
          const maxDim = Math.max(size.x, size.y, size.z);
          // Use a more conservative scale factor to ensure full visibility with padding
          const scale = 3.0 / maxDim; // Reduced from 4.5 to 3.0 for better fit
          modelGroup.scale.setScalar(scale);

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

          console.log(`📷 Camera positioned at: (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}), distance: ${paddedDistance.toFixed(2)}`);

          // Simple auto-rotation for thumbnails
          let rotationSpeed = 0.008; // Slightly slower for better viewing
          let animationId: number;

          // Animation loop
          const animate = () => {
            if (signal.aborted || !container.parentNode) {
              if (animationId) cancelAnimationFrame(animationId);
              return;
            }

            animationId = requestAnimationFrame(animate);

            // Slow auto-rotation around the Y-axis (vertical)
            modelGroup.rotation.y += rotationSpeed;

            renderer.render(scene, camera);
          };
          animate();

          // Store scene data for cleanup
          const sceneData = {
            scene,
            camera,
            renderer,
            animationId,
            cleanup: () => {
              if (animationId) cancelAnimationFrame(animationId);
              renderer.dispose();
              scene.clear();
            }
          };

          onLoad(sceneData);
          resolve(sceneData);
        },
        undefined,
        (error) => {
          if (!signal.aborted) {
            console.error('Error loading 3D model for thumbnail:', error);
            reject(error);
          }
        }
      );
    });
  }
}

// Global queue instance
const modelLoadQueue = new ModelLoadQueue();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  modelLoadQueue.destroy();
});

export const useModelLoader = () => {
  const [loadingStates, setLoadingStates] = React.useState<Map<string, LoadingState>>(new Map());

  const loadModel = React.useCallback((
    id: string,
    modelPath: string,
    containerRef: React.RefObject<HTMLDivElement>,
    priority: number = 0
  ) => {
    // Set loading state
    setLoadingStates(prev => new Map(prev.set(id, { loading: true, error: null, loaded: false })));

    const request: ModelLoadRequest = {
      id,
      modelPath,
      containerRef,
      priority,
      onLoad: (scene) => {
        setLoadingStates(prev => new Map(prev.set(id, { loading: false, error: null, loaded: true })));
      },
      onError: (error) => {
        setLoadingStates(prev => new Map(prev.set(id, { loading: false, error, loaded: false })));
      }
    };

    modelLoadQueue.addRequest(request);

    // Return cleanup function
    return () => {
      modelLoadQueue.removeRequest(id);
      setLoadingStates(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    };
  }, []);

  const cancelLoad = React.useCallback((id: string) => {
    modelLoadQueue.removeRequest(id);
    setLoadingStates(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const clearAllLoads = React.useCallback(() => {
    modelLoadQueue.clearAll();
    setLoadingStates(new Map());
  }, []);

  const getLoadingState = React.useCallback((id: string): LoadingState => {
    return loadingStates.get(id) || { loading: false, error: null, loaded: false };
  }, [loadingStates]);

  return {
    loadModel,
    cancelLoad,
    clearAllLoads,
    getLoadingState
  };
};