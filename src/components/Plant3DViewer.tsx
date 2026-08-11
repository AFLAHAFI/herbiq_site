import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Plant } from '../types';
import {
  RotateCcw,
  Play,
  Pause,
  Maximize2,
  RefreshCw,
  Sparkles,
  Check,
  EyeOff,
  Move
} from 'lucide-react';

interface Plant3DViewerProps {
  plant: Plant;
  arMode?: boolean;
  onExitAR?: () => void;
  onSelectPlantDetail?: (plantId: string) => void;
}

export const Plant3DViewer: React.FC<Plant3DViewerProps> = ({
  plant,
  arMode = false,
  onExitAR,
  onSelectPlantDetail,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // States
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(!arMode);
  const [activeHotspot, setActiveHotspot] = useState<'flowers' | 'leaves' | 'stem' | 'seed' | null>(null);
  const [showHUDOverlay, setShowHUDOverlay] = useState<boolean>(true);
  
  // AR & Camera states
  const [plantPlaced, setPlantPlaced] = useState<boolean>(false);
  const [plantScale, setPlantScale] = useState<number>(1.0);
  const [plantRotationY, setPlantRotationY] = useState<number>(0);
  const [webXRSupported, setWebXRSupported] = useState<boolean>(false);
  const [webXRActive, setWebXRActive] = useState<boolean>(false);

  // Three.js references
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const plantGroupRef = useRef<THREE.Group | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);

  // WebXR Refs for animation loop
  const hitTestSourceRequestedRef = useRef(false);
  const hitTestSourceRef = useRef<any>(null);
  const webXRActiveRef = useRef(false);
  
  useEffect(() => {
    webXRActiveRef.current = webXRActive;
  }, [webXRActive]);

  // Check WebXR support on mount
  useEffect(() => {
    if ('xr' in navigator && (navigator as any).xr?.isSessionSupported) {
      (navigator as any).xr
        .isSessionSupported('immersive-ar')
        .then((supported: boolean) => {
          setWebXRSupported(supported);
        })
        .catch(() => setWebXRSupported(false));
    }
  }, []);

  // Helper to construct organic procedural 3D plant specimens
  const createProceduralPlantSpecimen = (plantId: string, category: string): THREE.Group => {
    const group = new THREE.Group();

    // Ground shadow pedestal / pot base (in AR mode, pot is minimalist ground anchor)
    if (!arMode) {
      const potMat = new THREE.MeshStandardMaterial({
        color: 0x0d1b3a,
        roughness: 0.3,
        metalness: 0.3,
      });
      const potGeo = new THREE.CylinderGeometry(0.8, 0.6, 1.2, 32);
      const potMesh = new THREE.Mesh(potGeo, potMat);
      potMesh.position.y = -0.6;
      potMesh.castShadow = true;
      potMesh.receiveShadow = true;
      group.add(potMesh);

      // Soil layer
      const soilMat = new THREE.MeshStandardMaterial({ color: 0x1f293d, roughness: 0.9 });
      const soilMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.1, 32), soilMat);
      soilMesh.position.y = 0.01;
      group.add(soilMesh);
    }

    if (plantId === 'neem') {
      // NEEM (Azadirachta indica) MODEL
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
      const mainTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.5, 12), trunkMat);
      mainTrunk.position.y = 1.25;
      mainTrunk.castShadow = true;
      group.add(mainTrunk);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4, side: THREE.DoubleSide });
      const leafGeo = new THREE.BufferGeometry();
      // Simple pointed leaflet shape
      const vertices = new Float32Array([
        0, 0, 0,
        0.05, 0.15, 0,
        0, 0.3, 0,
        -0.05, 0.15, 0
      ]);
      const indices = [0, 1, 2, 2, 3, 0];
      leafGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      leafGeo.setIndex(indices);
      leafGeo.computeVertexNormals();

      // Branches
      for(let b=0; b<5; b++) {
        const bHeight = 1.0 + b * 0.3;
        const bAngle = b * Math.PI * 0.7;
        const branchGroup = new THREE.Group();
        branchGroup.position.set(0, bHeight, 0);
        branchGroup.rotation.y = bAngle;
        branchGroup.rotation.z = 0.5;
        
        const branchStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 1.2, 8), trunkMat);
        branchStem.position.y = 0.6;
        branchStem.castShadow = true;
        branchGroup.add(branchStem);

        // Compound leaves (pinnate)
        for(let l=0; l<10; l++) {
          const lHeight = 0.3 + l * 0.08;
          for(let side=-1; side<=1; side+=2) {
             const leaflet = new THREE.Mesh(leafGeo, leafMat);
             leaflet.position.set(0, lHeight, 0);
             leaflet.rotation.z = side * 1.0;
             leaflet.rotation.x = 0.2;
             leaflet.castShadow = true;
             branchGroup.add(leaflet);
          }
        }
        group.add(branchGroup);
      }
    } else if (plantId === 'turmeric') {
      // TURMERIC (Curcuma longa) MODEL
      const stemMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.3 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.3, side: THREE.DoubleSide });
      
      const numLeaves = 8;
      for (let i = 0; i < numLeaves; i++) {
        const leafGroup = new THREE.Group();
        const angle = (i / numLeaves) * Math.PI * 2;
        leafGroup.rotation.y = angle;
        
        // Leaf stem (petiole)
        const petiole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.8, 8), stemMat);
        petiole.position.set(0, 0.4, 0);
        petiole.rotation.x = 0.3 + (i*0.05);
        leafGroup.add(petiole);
        
        // Broad lance-shaped leaf
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.4, 0.8, 0, 1.8);
        shape.quadraticCurveTo(-0.4, 0.8, 0, 0);
        const geo = new THREE.ShapeGeometry(shape);
        const leaf = new THREE.Mesh(geo, leafMat);
        leaf.position.set(0, 0.75, 0.1);
        leaf.rotation.x = 0.4 + (i*0.05);
        leaf.castShadow = true;
        leafGroup.add(leaf);
        
        group.add(leafGroup);
      }
    } else if (plantId === 'aloe-vera' || category === 'Succulent') {
      // ALOE VERA MODEL
      const leafMatBright = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        roughness: 0.25,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
      const leavesCount = 14;
      for (let i = 0; i < leavesCount; i++) {
        const angle = (i / leavesCount) * Math.PI * 2 + (i % 2) * 0.2;
        const leafGroup = new THREE.Group();

        const leafLen = 1.4 + Math.random() * 0.3;
        
        // Creating a curved thick fleshy leaf
        const shape = new THREE.Shape();
        shape.moveTo(-0.15, 0);
        shape.lineTo(0.15, 0);
        shape.quadraticCurveTo(0.05, leafLen * 0.5, 0, leafLen);
        shape.quadraticCurveTo(-0.05, leafLen * 0.5, -0.15, 0);
        
        const extrudeSettings = { depth: 0.1, bevelEnabled: true, bevelSegments: 2, steps: 2, bevelSize: 0.02, bevelThickness: 0.02 };
        const leafGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        leafGeo.translate(0, 0, -0.05); // center depth
        
        const leafMesh = new THREE.Mesh(leafGeo, leafMatBright);
        leafMesh.castShadow = true;
        leafMesh.rotation.x = 0.4 + (i / leavesCount) * 0.3;
        leafGroup.add(leafMesh);

        leafGroup.rotation.y = angle;
        group.add(leafGroup);
      }
    } else {
      // TULSI (Holy Basil) / Default
      const tulsiStemMat = new THREE.MeshStandardMaterial({ color: 0x701a75, roughness: 0.55 });
      const mainStemMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), tulsiStemMat);
      mainStemMesh.position.y = 1.1;
      mainStemMesh.castShadow = true;
      group.add(mainStemMesh);

      const tulsiLeafMatBright = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.25, side: THREE.DoubleSide });
      const tulsiLeafMatDark = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.3, side: THREE.DoubleSide });
      
      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, 0);
      leafShape.bezierCurveTo(0.18, 0.1, 0.22, 0.3, 0.18, 0.5);
      leafShape.lineTo(0.14, 0.52);
      leafShape.lineTo(0.16, 0.62);
      leafShape.lineTo(0.1, 0.65);
      leafShape.lineTo(0.12, 0.75);
      leafShape.lineTo(0, 0.9);
      leafShape.lineTo(-0.12, 0.75);
      leafShape.lineTo(-0.1, 0.65);
      leafShape.lineTo(-0.16, 0.62);
      leafShape.lineTo(-0.14, 0.52);
      leafShape.lineTo(-0.18, 0.5);
      leafShape.bezierCurveTo(-0.22, 0.3, -0.18, 0.1, 0, 0);
      const leafGeo = new THREE.ShapeGeometry(leafShape);

      const branchTiers = 5;
      for (let tier = 0; tier < branchTiers; tier++) {
        const tierY = 0.4 + tier * 0.32;
        const tierAngleOffset = (tier % 2) * (Math.PI / 2);

        for (let side = 0; side < 2; side++) {
          const bAngle = tierAngleOffset + side * Math.PI;
          const branchGroup = new THREE.Group();

          const bStem = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.8 - tier * 0.1, 0.035), tulsiStemMat);
          bStem.rotation.z = -0.6;
          bStem.position.set(0.3, 0, 0);
          bStem.castShadow = true;
          branchGroup.add(bStem);

          for (let l = 0; l < 4; l++) {
            const leafMesh = new THREE.Mesh(leafGeo, l % 2 === 0 ? tulsiLeafMatBright : tulsiLeafMatDark);
            leafMesh.castShadow = true;
            leafMesh.position.set(0.15 + l * 0.14, (l * 0.05), l % 2 === 0 ? 0.08 : -0.08);
            leafMesh.rotation.set(0.3, l * 0.4, 0.2);
            leafMesh.scale.set(0.65 - tier * 0.08, 0.65 - tier * 0.08, 0.65 - tier * 0.08);
            branchGroup.add(leafMesh);
          }
          branchGroup.position.set(0, tierY, 0);
          branchGroup.rotation.y = bAngle;
          group.add(branchGroup);
        }
      }
    }

    return group;
  };

  // Main Three.js Scene Setup & Loop
  useEffect(() => {
    if (!mountRef.current) return;

    setLoading(true);

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    if (!arMode) {
      scene.background = new THREE.Color(0x060b18);
      scene.fog = new THREE.FogExp2(0x060b18, 0.08);
    } else {
      scene.background = null; 
    }

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.4, arMode ? 3.5 : 4.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // VERY IMPORTANT FOR WEBXR
    renderer.xr.enabled = true;
    rendererRef.current = renderer;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, arMode ? 1.6 : 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x00e5ff, 2.0);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x10b981, 1.5);
    fillLight.position.set(-4, 3, -2);
    scene.add(fillLight);

    // Target Placement Ring for AR Mode Hit Testing
    const ringGeo = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const reticle = new THREE.Mesh(ringGeo, ringMat);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    reticleRef.current = reticle;

    // Plant Group
    const plantGroup = new THREE.Group();
    scene.add(plantGroup);
    plantGroupRef.current = plantGroup;
    
    // Hide plant in AR until placed
    if (arMode) {
        plantGroup.visible = false;
    }

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.minDistance = 1.0;
    controls.maxDistance = 8.0;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 2.0;
    controlsRef.current = controls;

    // Load plant GLB or generate 3D specimen fallback
    if (plant.model3D) {
      const loader = new GLTFLoader();
      loader.load(
        plant.model3D,
        (gltf) => {
          plantGroup.add(gltf.scene);
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2.5 / (maxDim || 1);
          gltf.scene.scale.set(scale, scale, scale);
          gltf.scene.position.sub(center.multiplyScalar(scale));

          setLoading(false);
        },
        undefined,
        (err) => {
          const specimen = createProceduralPlantSpecimen(plant.id, plant.category);
          plantGroup.add(specimen);
          setLoading(false);
        }
      );
    } else {
      const specimen = createProceduralPlantSpecimen(plant.id, plant.category);
      plantGroup.add(specimen);
      setLoading(false);
    }

    // WebXR Hit Testing Controller Select Event
    const controller = renderer.xr.getController(0);
    controller.addEventListener('select', () => {
      if (reticleRef.current && reticleRef.current.visible && plantGroupRef.current) {
        plantGroupRef.current.position.setFromMatrixPosition(reticleRef.current.matrix);
        plantGroupRef.current.visible = true;
        setPlantPlaced(true);
      }
    });
    scene.add(controller);

    // Animation loop via setAnimationLoop (crucial for WebXR)
    renderer.setAnimationLoop((timestamp: number, frame: any) => {
      controls.update();

      if (frame && webXRActiveRef.current) {
        const session = renderer.xr.getSession();
        if (session) {
          const referenceSpace = renderer.xr.getReferenceSpace();
          
          if (!hitTestSourceRequestedRef.current) {
            session.requestReferenceSpace('viewer').then((refSpace) => {
              session.requestHitTestSource({ space: refSpace }).then((source) => {
                hitTestSourceRef.current = source;
              });
            });
            session.addEventListener('end', () => {
              hitTestSourceRequestedRef.current = false;
              hitTestSourceRef.current = null;
            });
            hitTestSourceRequestedRef.current = true;
          }

          if (hitTestSourceRef.current && reticleRef.current) {
            const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current);
            if (hitTestResults.length > 0) {
              const hit = hitTestResults[0];
              if (referenceSpace) {
                const pose = hit.getPose(referenceSpace);
                if (pose) {
                   reticleRef.current.visible = true;
                   reticleRef.current.matrix.fromArray(pose.transform.matrix);
                }
              }
            } else {
              reticleRef.current.visible = false;
            }
          }
        }
      }

      renderer.render(scene, camera);
    });

    // Resize handling
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mountRef.current);

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, [plant, arMode]);

  // Sync transforms (Scale & Rotation)
  useEffect(() => {
    if (plantGroupRef.current) {
      plantGroupRef.current.scale.set(plantScale, plantScale, plantScale);
      plantGroupRef.current.rotation.y = plantRotationY;
    }
  }, [plantScale, plantRotationY]);

  // Sync autoRotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  // Trigger WebXR Immersive Session if supported
  const handleStartWebXRSession = async () => {
    if (!('xr' in navigator) || !rendererRef.current) return;
    try {
      const session = await (navigator as any).xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: document.getElementById('ar-overlay-root') || document.body },
      });
      setWebXRActive(true);
      await rendererRef.current.xr.setSession(session);

      session.addEventListener('end', () => {
        setWebXRActive(false);
        setPlantPlaced(false);
        if (plantGroupRef.current) plantGroupRef.current.visible = false;
        if (onExitAR) onExitAR();
      });
    } catch (err) {
      console.warn('WebXR session failed to launch:', err);
    }
  };

  const focusHotspot = (spot: 'flowers' | 'leaves' | 'stem' | 'seed') => {
    if (activeHotspot === spot) {
      handleReset();
      return;
    }
    setActiveHotspot(spot);
    setAutoRotate(false);
    if (!cameraRef.current || !controlsRef.current) return;

    if (spot === 'flowers') {
      cameraRef.current.position.set(0, 2.3, 1.4);
      controlsRef.current.target.set(0, 2.1, 0);
    } else if (spot === 'leaves') {
      cameraRef.current.position.set(0.9, 1.3, 1.3);
      controlsRef.current.target.set(0.2, 1.1, 0);
    } else if (spot === 'stem') {
      cameraRef.current.position.set(0, 0.8, 1.3);
      controlsRef.current.target.set(0, 0.6, 0);
    } else if (spot === 'seed') {
      cameraRef.current.position.set(-0.6, 1.8, 1.2);
      controlsRef.current.target.set(0, 1.7, 0);
    }
    controlsRef.current.update();
  };

  const handleReset = () => {
    setPlantScale(1.0);
    setPlantRotationY(0);
    setActiveHotspot(null);
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 1.4, arMode ? 3.5 : 4.2);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.reset();
    }
  };

  return (
    <div id="ar-overlay-root" className="relative w-full h-[520px] sm:h-[600px] rounded-3xl overflow-hidden bg-[#060B18] border-2 border-[#00E5FF]/30 shadow-2xl flex flex-col justify-between">
      
      {/* 3D WebGL Canvas Layer */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full z-10 cursor-grab active:cursor-grabbing"
      />

      {/* TOP HUD STATUS BAR */}
      <div className="relative z-20 p-4 sm:p-5 flex items-center justify-between pointer-events-none">
        
        {/* AR Status Indicator Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#060B18]/85 backdrop-blur-md border border-[#00E5FF]/40 text-xs font-mono text-[#00E5FF] pointer-events-auto glow-cyan">
          <div className={`w-2 h-2 rounded-full ${arMode ? 'bg-[#10B981] animate-ping' : 'bg-[#00E5FF]'}`} />
          <span>
            {arMode
              ? webXRActive
                ? 'WEBXR SESSION ACTIVE'
                : 'AR READY'
              : '3D BOTANICAL MUSEUM'}
          </span>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Toggle HUD Details Overlay */}
          {!arMode && (
            <button
              onClick={() => setShowHUDOverlay(!showHUDOverlay)}
              className={`px-3 py-2 rounded-xl backdrop-blur-md border text-xs font-bold transition-all ${
                showHUDOverlay
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40'
                  : 'bg-[#060B18]/85 text-[#94A3B8] border-[#00E5FF]/20'
              }`}
            >
              <span>{showHUDOverlay ? 'HUD On' : 'HUD Off'}</span>
            </button>
          )}

          {/* WebXR Launch Button */}
          {arMode && webXRSupported && !webXRActive && (
            <button
              onClick={handleStartWebXRSession}
              className="px-3.5 py-1.5 rounded-xl bg-[#00E5FF] text-[#060B18] font-bold text-xs hover:brightness-110 transition-all shadow-md flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch WebXR (View In Your Space)</span>
            </button>
          )}

          {/* Auto rotate toggle */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            id="ar-autorotate-btn"
            title={autoRotate ? 'Pause Rotation' : 'Rotate 360°'}
            className="p-2.5 rounded-xl bg-[#060B18]/85 backdrop-blur-md text-[#94A3B8] hover:text-[#00E5FF] border border-[#00E5FF]/30 transition-all"
          >
            {autoRotate ? <Pause className="w-4 h-4 text-[#00E5FF]" /> : <Play className="w-4 h-4" />}
          </button>

          {/* Reset Camera View */}
          <button
            onClick={handleReset}
            id="ar-reset-btn"
            title="Reset Specimen View"
            className="p-2.5 rounded-xl bg-[#060B18]/85 backdrop-blur-md text-[#94A3B8] hover:text-[#00E5FF] border border-[#00E5FF]/30 transition-all"
          >
            <RotateCcw className="w-4 h-4 text-[#00E5FF]" />
          </button>

          {/* Exit AR Mode */}
          {arMode && onExitAR && !webXRActive && (
            <button
              onClick={onExitAR}
              id="ar-exit-btn"
              className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/40 text-xs font-bold transition-all flex items-center gap-1"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Exit AR</span>
            </button>
          )}
        </div>
      </div>

      {/* BOTANICAL SPECIMEN HUD OVERLAYS (Inspired by HerbiQ Robot Interface Card) */}
      {!arMode && showHUDOverlay && (
        <>
          {/* Top-Left Title & Scientific Details Card */}
          <div className="absolute top-16 left-4 z-20 max-w-[240px] sm:max-w-[280px] p-4 rounded-2xl bg-[#060B18]/85 backdrop-blur-md border border-[#00E5FF]/30 space-y-1.5 shadow-2xl pointer-events-auto">
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#00E5FF] uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-[#10B981]" />
              <span>HerbiQ Botanical Display</span>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-1">
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#F8FAFC]">
                  {plant.name}
                </h2>
                <span className="text-sm font-bold text-[#F59E0B] font-serif">{plant.malayalamName}</span>
              </div>
              <p className="text-xs italic text-[#00E5FF] font-medium pt-0.5">{plant.scientificName}</p>
              <p className="text-[11px] text-[#94A3B8]">Family: <span className="text-[#F8FAFC]">{plant.family}</span></p>
            </div>
          </div>

          {/* Right-Side Interactive Botanical Feature Cards (Flowers, Leaves, Stem, Seed) */}
          <div className="absolute top-16 right-4 z-20 hidden md:flex flex-col gap-2.5 max-w-[170px] pointer-events-auto">
            <div className="text-[10px] font-mono text-[#00E5FF] uppercase tracking-wider text-right px-1">
              Interactive Hotspots
            </div>

            <button
              onClick={() => focusHotspot('flowers')}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                activeHotspot === 'flowers'
                  ? 'bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF] glow-cyan shadow-lg'
                  : 'bg-[#060B18]/85 border-[#00E5FF]/20 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#00E5FF]/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#F8FAFC]">
                <span>🌸 Flowers</span>
                {activeHotspot === 'flowers' && <Check className="w-3 h-3 text-[#00E5FF]" />}
              </div>
            </button>

            <button
              onClick={() => focusHotspot('leaves')}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                activeHotspot === 'leaves'
                  ? 'bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF] glow-cyan shadow-lg'
                  : 'bg-[#060B18]/85 border-[#00E5FF]/20 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#00E5FF]/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#F8FAFC]">
                <span>🍃 Leaves</span>
                {activeHotspot === 'leaves' && <Check className="w-3 h-3 text-[#00E5FF]" />}
              </div>
            </button>

            <button
              onClick={() => focusHotspot('stem')}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                activeHotspot === 'stem'
                  ? 'bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF] glow-cyan shadow-lg'
                  : 'bg-[#060B18]/85 border-[#00E5FF]/20 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#00E5FF]/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#F8FAFC]">
                <span>🪵 Stem</span>
                {activeHotspot === 'stem' && <Check className="w-3 h-3 text-[#00E5FF]" />}
              </div>
            </button>

            <button
              onClick={() => focusHotspot('seed')}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                activeHotspot === 'seed'
                  ? 'bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF] glow-cyan shadow-lg'
                  : 'bg-[#060B18]/85 border-[#00E5FF]/20 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#00E5FF]/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#F8FAFC]">
                <span>🫘 Seed / Fruit</span>
                {activeHotspot === 'seed' && <Check className="w-3 h-3 text-[#00E5FF]" />}
              </div>
            </button>
          </div>

          <div className="absolute bottom-16 left-4 z-20 pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#060B18]/85 backdrop-blur-md border border-[#00E5FF]/30 text-[11px] font-semibold text-[#00E5FF]">
              <RotateCcw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
              <span>360° Interactive 3D Model</span>
            </div>
          </div>
        </>
      )}

      {/* FLOATING AR INTERACTIVE CONTROL PANEL (In WebXR Mode) */}
      {webXRActive && plantPlaced && (
        <div className="relative z-20 p-4 mx-4 mb-2 rounded-2xl bg-[#060B18]/90 backdrop-blur-md border border-[#00E5FF]/30 space-y-3 pointer-events-auto shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            
            <div className="flex items-center gap-2">
               <span className="text-[#10B981] font-bold">Plant Anchored in Space</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span className="text-[10px] text-[#94A3B8]">Scale:</span>
                <input
                  type="range"
                  min="0.4"
                  max="2.5"
                  step="0.1"
                  value={plantScale}
                  onChange={(e) => setPlantScale(parseFloat(e.target.value))}
                  className="w-20 accent-[#00E5FF] cursor-pointer"
                />
                <span className="text-[10px] font-mono text-[#00E5FF]">{plantScale.toFixed(1)}x</span>
              </div>

              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span className="text-[10px] text-[#94A3B8]">Rotate:</span>
                <input
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.1"
                  value={plantRotationY}
                  onChange={(e) => setPlantRotationY(parseFloat(e.target.value))}
                  className="w-20 accent-[#00E5FF] cursor-pointer"
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* BOTTOM HINT BAR */}
      <div className="relative z-20 p-4 flex items-center justify-between text-[11px] text-[#94A3B8] pointer-events-none bg-gradient-to-t from-[#060B18]/90 to-transparent">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>
            {arMode && webXRActive
              ? 'Point camera at surface. Tap ring to place. Use sliders to scale/rotate.'
              : arMode
              ? 'Click Launch WebXR to enter immersive AR mode.'
              : 'Drag to inspect 360° • Scroll/pinch to zoom'}
          </span>
        </span>
        <span className="font-mono text-[#00E5FF] hidden sm:inline">
          {plant.name} • {plant.scientificName}
        </span>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#060B18]/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-[#00E5FF] animate-pulse">Loading 3D Botanical Specimen...</p>
        </div>
      )}

    </div>
  );
};
