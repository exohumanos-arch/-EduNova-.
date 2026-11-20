import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, RotateCcw, Sparkles, Eye } from 'lucide-react';
import type { StudentAIAnalysis, StudentResult, SubjectStat } from '../types';
import { api } from '../services/api';

interface AcademicObservatory3DProps {
  results: StudentResult[];
  subjectStats: SubjectStat[];
  examId: number;
}

type ViewMode = 'students' | 'subjects';
type CameraPreset = 'amphitheater' | 'top' | 'astrolabe' | 'selected';

interface MonumentRecord {
  id: number;
  kind: ViewMode;
  title: string;
  subtitle: string;
  score: number;
  gradeOrRate: string;
  status: 'PASS' | 'FAIL' | 'PENDING' | 'SUBJECT';
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  capMesh: THREE.Mesh;
  orbitRing: THREE.Mesh;
  columnMesh: THREE.Mesh;
  basePosition: THREE.Vector3;
  studentData?: StudentResult;
  subjectData?: SubjectStat;
}

// Pre-allocated scratch math objects (Zero GC inside animation loop)
const _targetCamPos = new THREE.Vector3();
const _targetControlsLook = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();

function createProceduralFloorTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, size, size);

  // Subtle architectural stone tile variation
  for (let i = 0; i < 64; i++) {
    const x = (i % 8) * 64;
    const y = Math.floor(i / 8) * 64;
    const shade = 14 + ((i * 7) % 9);
    ctx.fillStyle = `rgb(${shade}, ${shade + 10}, ${shade + 26})`;
    ctx.fillRect(x + 1, y + 1, 62, 62);
  }

  // Fine technical coordinate lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.lineWidth = 1;
  for (let p = 0; p <= size; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.72)');
  grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.28)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createOctagonPlinthGeometry(radius: number, height: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const sides = 8;
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
  });
  geo.rotateX(-Math.PI / 2);
  // Shift bottom flush to y = 0
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    geo.translate(0, -geo.boundingBox.min.y, 0);
  }
  return geo;
}

function createLatheCollarGeometry(radius: number): THREE.LatheGeometry {
  const pts = [
    new THREE.Vector2(radius * 0.72, 0),
    new THREE.Vector2(radius * 0.96, 0.05),
    new THREE.Vector2(radius * 0.88, 0.14),
    new THREE.Vector2(radius * 0.95, 0.2),
    new THREE.Vector2(radius * 0.7, 0.26),
  ];
  return new THREE.LatheGeometry(pts, 24);
}

export const AcademicObservatory3D: React.FC<AcademicObservatory3DProps> = ({
  results,
  subjectStats,
  examId,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('students');
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [autoOrbit, setAutoOrbit] = useState<boolean>(false);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [selectedMonument, setSelectedMonument] = useState<{
    id: number;
    kind: ViewMode;
    title: string;
    subtitle: string;
    score: number;
    gradeOrRate: string;
    status: string;
    studentData?: StudentResult;
    subjectData?: SubjectStat;
  } | null>(null);
  const [contextLost, setContextLost] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<StudentAIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Refs synced to Three.js render loop without tearing down WebGL
  const explodeRef = useRef(explodeFactor);
  const autoOrbitRef = useRef(autoOrbit);
  const cameraTransitionRef = useRef<{ active: boolean; pos: THREE.Vector3; target: THREE.Vector3 }>({
    active: false,
    pos: new THREE.Vector3(0, 8.5, 16.5),
    target: new THREE.Vector3(0, 1.8, 0),
  });
  const rebuildTriggerRef = useRef<() => void>(() => {});
  const monumentsRef = useRef<MonumentRecord[]>([]);
  const selectedIdRef = useRef<number | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});
  const dataRef = useRef({ viewMode, results, subjectStats });

  useEffect(() => {
    explodeRef.current = explodeFactor;
    requestRenderRef.current();
  }, [explodeFactor]);

  useEffect(() => {
    autoOrbitRef.current = autoOrbit;
    requestRenderRef.current();
  }, [autoOrbit]);

  useEffect(() => {
    dataRef.current = { viewMode, results, subjectStats };
    selectedIdRef.current = null;
    setSelectedMonument(null);
    setAiAnalysis(null);
    setAiError(null);
    rebuildTriggerRef.current();
  }, [viewMode, results, subjectStats]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL probe (used strictly for rendering cost)
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const bgHex = 0x0b1426;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.022);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 150);
    camera.position.set(0, 8.5, 16.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // 2. Studio Environment Map via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    // 3. Balanced Warm Key + Cool Hemisphere Fill + Rim Light
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    keyLight.position.set(9, 16, 10);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 42;
    const d = 14;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7c3aed, 1.15);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    // 4. Ground Floor + Procedural Grid Texture
    const floorTex = createProceduralFloorTexture();
    floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const shadowTex = createContactShadowTexture();

    const floorGeo = new THREE.CircleGeometry(36, 64);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.78,
      metalness: 0.12,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Subtle concentric amphitheater floor rings (offset Y=0.015 with polygonOffset)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    [3.2, 7.6, 11.4].forEach((radius) => {
      const rGeo = new THREE.RingGeometry(radius - 0.03, radius + 0.03, 72);
      rGeo.rotateX(-Math.PI / 2);
      const rMesh = new THREE.Mesh(rGeo, ringMat);
      rMesh.position.y = 0.015;
      scene.add(rMesh);
    });

    // Instanced Perimeter Marker Bollards (>24 repeated items via InstancedMesh)
    const bollardCount = 28;
    const bollardGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.65, 10);
    bollardGeo.translate(0, 0.325, 0);
    const bollardMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.35,
      metalness: 0.75,
    });
    const bollards = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < bollardCount; i++) {
      const angle = (i / bollardCount) * Math.PI * 2;
      dummy.position.set(Math.cos(angle) * 12.2, 0, Math.sin(angle) * 12.2);
      dummy.rotation.y = -angle;
      const scaleVar = 0.9 + ((i % 3) * 0.08);
      dummy.scale.set(1, scaleVar, 1);
      dummy.updateMatrix();
      bollards.setMatrixAt(i, dummy.matrix);
    }
    bollards.instanceMatrix.needsUpdate = true;
    bollards.computeBoundingSphere();
    scene.add(bollards);

    // 5. Central Hero Sculpture: 7-Part Academic Honor Astrolabe
    const astrolabeGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.82,
      metalness: 0.12,
    });
    const brassMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      roughness: 0.18,
      metalness: 0.94,
      anisotropy: 0.7,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.24,
      metalness: 0.9,
    });
    const coreGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x6366f1,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
      transmission: isSoftwareGl ? 0 : 0.82,
      transparent: true,
      opacity: isSoftwareGl ? 0.65 : 1,
      ior: 1.6,
      thickness: 1.2,
    });

    const dais = new THREE.Mesh(createOctagonPlinthGeometry(1.75, 0.32), stoneMat);
    dais.castShadow = true;
    dais.receiveShadow = true;
    astrolabeGroup.add(dais);

    const astrolabeCollar = new THREE.Mesh(createLatheCollarGeometry(1.25), brassMat);
    astrolabeCollar.position.y = 0.32;
    astrolabeCollar.castShadow = true;
    astrolabeGroup.add(astrolabeCollar);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.35, 16), steelMat);
    stem.position.y = 1.25;
    stem.castShadow = true;
    astrolabeGroup.add(stem);

    const outerGimbal = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.055, 16, 64), brassMat);
    outerGimbal.position.y = 2.65;
    outerGimbal.castShadow = true;
    astrolabeGroup.add(outerGimbal);

    const innerGimbal = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 16, 56), steelMat);
    innerGimbal.position.y = 2.65;
    innerGimbal.rotation.x = Math.PI / 3;
    astrolabeGroup.add(innerGimbal);

    const prismCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), coreGlassMat);
    prismCore.position.y = 2.65;
    astrolabeGroup.add(prismCore);

    const apexFinial = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 8), brassMat);
    apexFinial.position.y = 4.15;
    astrolabeGroup.add(apexFinial);

    const centerShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 4.2),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.65 })
    );
    centerShadow.rotation.x = -Math.PI / 2;
    centerShadow.position.y = 0.01;
    astrolabeGroup.add(centerShadow);
    scene.add(astrolabeGroup);

    // 6. Dynamic Monuments Group (Composite 5-part columns for Students or Subjects)
    const monumentsRoot = new THREE.Group();
    scene.add(monumentsRoot);

    const sharedPlinthGeo = createOctagonPlinthGeometry(0.68, 0.24);
    const sharedCollarGeo = createLatheCollarGeometry(0.54);
    const sharedCapGeo = new THREE.CylinderGeometry(0.28, 0.36, 0.22, 8);
    const sharedOrbitGeo = new THREE.TorusGeometry(0.56, 0.025, 10, 36);
    const sharedShadowGeo = new THREE.PlaneGeometry(1.85, 1.85);
    const sharedHitGeo = new THREE.CylinderGeometry(0.68, 0.68, 4.8, 12);
    sharedHitGeo.translate(0, 2.4, 0);

    const disposableGeos: THREE.BufferGeometry[] = [];
    const disposableMats: THREE.Material[] = [];

    function clearMonuments() {
      while (monumentsRoot.children.length > 0) {
        monumentsRoot.remove(monumentsRoot.children[0]);
      }
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      disposableGeos.length = 0;
      disposableMats.length = 0;
      monumentsRef.current = [];
    }

    function getStatusColor(status: string, score: number): number {
      if (status === 'FAIL') return 0xdc2626;
      if (status === 'PENDING') return 0x64748b;
      if (score >= 90) return 0x10b981;
      if (score >= 75) return 0x5b3df5;
      if (score >= 60) return 0x3b82f6;
      return 0xd97706;
    }

    function buildMonuments() {
      clearMonuments();
      const { viewMode: mode, results: resList, subjectStats: subList } = dataRef.current;

      const items =
        mode === 'students'
          ? resList.map((r) => ({
              id: r.student_id,
              kind: 'students' as ViewMode,
              title: r.name,
              subtitle: `Roll ${r.roll_no} · ${r.branch} Sem ${r.semester}`,
              score: r.percentage,
              gradeOrRate: `Grade ${r.grade} (${r.percentage.toFixed(1)}%)`,
              status: r.status,
              studentData: r,
            }))
          : subList.map((s) => ({
              id: s.subject_id,
              kind: 'subjects' as ViewMode,
              title: s.subject_name,
              subtitle: `${s.subject_code} · Passing ${s.passing_marks}/${s.max_marks}`,
              score: s.max_marks > 0 ? (s.average_marks / s.max_marks) * 100 : 0,
              gradeOrRate: `Avg ${s.average_marks} · Pass Rate ${s.pass_rate}%`,
              status: 'SUBJECT' as const,
              subjectData: s,
            }));

      const total = items.length;
      if (total === 0) {
        requestRender();
        return;
      }

      const arcSpan = Math.min(Math.PI * 1.55, Math.max(Math.PI * 0.75, total * 0.24));
      const startAngle = Math.PI / 2 - arcSpan / 2;
      const radius = mode === 'students' ? 7.6 : 6.4;

      items.forEach((item, idx) => {
        const t = total === 1 ? 0.5 : idx / (total - 1);
        const angle = startAngle + t * arcSpan;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.lookAt(0, 0, 0);

        const colColor = getStatusColor(item.status, item.score);
        const colHeight = Math.max(0.65, (item.score / 100) * 3.8);

        // Part 1: Octagonal Stone Plinth (flush at y = 0)
        const plinth = new THREE.Mesh(sharedPlinthGeo, stoneMat);
        plinth.castShadow = true;
        plinth.receiveShadow = true;
        group.add(plinth);

        // Part 2: Brushed Brass Collar
        const collar = new THREE.Mesh(sharedCollarGeo, brassMat);
        collar.position.y = 0.24;
        group.add(collar);

        // Part 3: Fluted Data Shaft (roughness differs >= 0.25 from brass & stone)
        const colGeo = new THREE.CylinderGeometry(0.32, 0.38, colHeight, 8);
        colGeo.translate(0, colHeight / 2, 0);
        disposableGeos.push(colGeo);

        const colMat = new THREE.MeshStandardMaterial({
          color: colColor,
          roughness: 0.42,
          metalness: 0.22,
          emissive: new THREE.Color(colColor),
          emissiveIntensity: 0.08,
        });
        disposableMats.push(colMat);

        const columnMesh = new THREE.Mesh(colGeo, colMat);
        columnMesh.position.y = 0.48;
        columnMesh.castShadow = true;
        columnMesh.receiveShadow = true;
        group.add(columnMesh);

        // Part 4: Optical Glass Crown Cap
        const capMat = new THREE.MeshPhysicalMaterial({
          color: colColor,
          roughness: 0.08,
          metalness: 0.05,
          clearcoat: 1.0,
          transparent: true,
          opacity: isSoftwareGl ? 0.55 : 0.85,
        });
        disposableMats.push(capMat);
        const capMesh = new THREE.Mesh(sharedCapGeo, capMat);
        capMesh.position.y = 0.48 + colHeight + 0.14;
        group.add(capMesh);

        // Part 5: Orbital Status Ring
        const orbitRingMat = new THREE.MeshStandardMaterial({
          color: item.status === 'FAIL' ? 0xf87171 : 0xe2e8f0,
          roughness: 0.2,
          metalness: 0.88,
        });
        disposableMats.push(orbitRingMat);
        const orbitRing = new THREE.Mesh(sharedOrbitGeo, orbitRingMat);
        orbitRing.position.y = 0.48 + colHeight + 0.18;
        orbitRing.rotation.x = Math.PI / 2.4;
        group.add(orbitRing);

        // Soft Contact Shadow at y = 0.01
        const shadowPlane = new THREE.Mesh(
          sharedShadowGeo,
          new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.5 })
        );
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = 0.01;
        disposableMats.push(shadowPlane.material as THREE.Material);
        group.add(shadowPlane);

        // Invisible Raycast Proxy on Layer 1
        const hitMesh = new THREE.Mesh(
          sharedHitGeo,
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hitMesh.layers.set(1);
        hitMesh.userData.monumentId = item.id;
        disposableMats.push(hitMesh.material as THREE.Material);
        group.add(hitMesh);

        monumentsRoot.add(group);
        monumentsRef.current.push({
          ...item,
          group,
          hitMesh,
          capMesh,
          orbitRing,
          columnMesh,
          basePosition: new THREE.Vector3(x, 0, z),
        });
      });

      requestRender();
    }

    rebuildTriggerRef.current = buildMonuments;

    // 7. OrbitControls & Smooth Damping
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 1.8, 0);
    controls.minDistance = 4.5;
    controls.maxDistance = 28;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;

    controls.addEventListener('start', () => {
      cameraTransitionRef.current.active = false;
    });
    controls.addEventListener('change', () => {
      requestRender();
    });

    // 8. On-Demand / Paced Render Loop
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepScene(dt: number) {
      const sep = explodeRef.current;

      // Subtle Honor Astrolabe idle motion when continuous or transitioning
      outerGimbal.rotation.y += dt * 0.35;
      innerGimbal.rotation.z += dt * 0.45;
      prismCore.rotation.y -= dt * 0.55;

      // Exploded separation & selection highlight damping
      for (const m of monumentsRef.current) {
        const isSel = selectedIdRef.current === m.id;
        const targetLift = sep * 0.9 + (isSel ? 0.35 : 0);
        m.columnMesh.position.y = THREE.MathUtils.damp(m.columnMesh.position.y, 0.48 + targetLift * 0.5, 8, dt);
        const colTop = 0.48 + (m.columnMesh.geometry.boundingBox?.max.y ?? 2);
        m.capMesh.position.y = THREE.MathUtils.damp(m.capMesh.position.y, colTop + 0.14 + targetLift * 1.15, 8, dt);
        m.orbitRing.position.y = THREE.MathUtils.damp(m.orbitRing.position.y, colTop + 0.18 + targetLift * 1.45, 8, dt);
        m.orbitRing.rotation.z += dt * (isSel ? 1.8 : 0.4);
        const mat = m.columnMesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = THREE.MathUtils.damp(mat.emissiveIntensity, isSel ? 0.45 : 0.08, 10, dt);
      }

      if (cameraTransitionRef.current.active) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraTransitionRef.current.pos.x, 5.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraTransitionRef.current.pos.y, 5.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraTransitionRef.current.pos.z, 5.5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, cameraTransitionRef.current.target.x, 5.5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, cameraTransitionRef.current.target.y, 5.5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, cameraTransitionRef.current.target.z, 5.5, dt);

        if (
          camera.position.distanceTo(cameraTransitionRef.current.pos) < 0.04 &&
          controls.target.distanceTo(cameraTransitionRef.current.target) < 0.04
        ) {
          cameraTransitionRef.current.active = false;
        }
      }

      controls.autoRotate = !isSoftwareGl && autoOrbitRef.current;
      controls.autoRotateSpeed = 1.2;
      controls.update();
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const dt = Math.min(clock.getDelta(), 0.05);
        stepScene(dt);
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          const keepAnimating =
            cameraTransitionRef.current.active ||
            (!isSoftwareGl && autoOrbitRef.current);
          if (renderDirty || keepAnimating) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    buildMonuments();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 9. Raycasting for Hover & Click Selection
    _raycaster.layers.set(1);
    let lastMove = 0;

    function updatePointer(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMove < 60) return;
      lastMove = now;
      updatePointer(e);
      _raycaster.setFromCamera(_pointer, camera);
      const hitTargets = monumentsRef.current.map((m) => m.hitMesh);
      const hits = _raycaster.intersectObjects(hitTargets, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    const onPointerDown = (e: PointerEvent) => {
      updatePointer(e);
      _raycaster.setFromCamera(_pointer, camera);
      const hitTargets = monumentsRef.current.map((m) => m.hitMesh);
      const hits = _raycaster.intersectObjects(hitTargets, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.monumentId as number;
        const found = monumentsRef.current.find((m) => m.id === hitId);
        if (found) {
          selectedIdRef.current = found.id;
          setSelectedMonument({
            id: found.id,
            kind: found.kind,
            title: found.title,
            subtitle: found.subtitle,
            score: found.score,
            gradeOrRate: found.gradeOrRate,
            status: found.status,
            studentData: found.studentData,
            subjectData: found.subjectData,
          });
          setAiAnalysis(null);
          setAiError(null);

          // Smoothly focus camera toward clicked monument
          _targetControlsLook.copy(found.basePosition).setY(1.8);
          _targetCamPos.copy(found.basePosition).multiplyScalar(1.55).setY(4.4);
          cameraTransitionRef.current = {
            active: true,
            pos: _targetCamPos.clone(),
            target: _targetControlsLook.clone(),
          };
          requestRender();
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      clearMonuments();
      sharedPlinthGeo.dispose();
      sharedCollarGeo.dispose();
      sharedCapGeo.dispose();
      sharedOrbitGeo.dispose();
      sharedShadowGeo.dispose();
      sharedHitGeo.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      floorTex.dispose();
      shadowTex.dispose();
      envRT.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const applyCameraPreset = (preset: CameraPreset) => {
    if (preset === 'amphitheater') {
      cameraTransitionRef.current = {
        active: true,
        pos: new THREE.Vector3(0, 8.5, 16.5),
        target: new THREE.Vector3(0, 1.8, 0),
      };
    } else if (preset === 'top') {
      cameraTransitionRef.current = {
        active: true,
        pos: new THREE.Vector3(0, 20, 2.2),
        target: new THREE.Vector3(0, 0, 2.5),
      };
    } else if (preset === 'astrolabe') {
      cameraTransitionRef.current = {
        active: true,
        pos: new THREE.Vector3(3.8, 3.6, 5.2),
        target: new THREE.Vector3(0, 2.4, 0),
      };
    } else if (preset === 'selected' && selectedMonument) {
      const m = monumentsRef.current.find((item) => item.id === selectedMonument.id);
      if (m) {
        cameraTransitionRef.current = {
          active: true,
          pos: m.basePosition.clone().multiplyScalar(1.5).setY(4.2),
          target: m.basePosition.clone().setY(1.8),
        };
      }
    }
    requestRenderRef.current();
  };

  const handleAnalyzeSelected = async () => {
    if (!selectedMonument?.studentData) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await api.analyzeStudentAI(selectedMonument.studentData.student_id, examId);
      setAiAnalysis(data);
    } catch (err: any) {
      setAiError(err?.message || 'Unable to generate analysis');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0B1426]">
      {/* Isolated WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full" />

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0B1426] text-white z-20">
          <p className="text-sm font-medium">WebGL rendering context interrupted. Restoring scene...</p>
        </div>
      )}

      {/* Minimal Top-Left Inspector Readout (Solid/rgba surface, no backdrop-filter) */}
      <div className="absolute top-4 left-4 z-10 max-w-sm rounded-lg border border-slate-700/80 bg-[#0F1E3D]/95 p-4 text-white shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-sm font-semibold tracking-tight text-white">
            3D Academic Performance Observatory
          </h2>
          <span className="text-xs font-mono text-slate-300 tabular-nums">
            {viewMode === 'students' ? `${results.length} Students` : `${subjectStats.length} Subjects`}
          </span>
        </div>

        {selectedMonument ? (
          <div className="mt-3 pt-3 border-t border-slate-700/80 space-y-2">
            <div>
              <div className="text-sm font-semibold text-white">{selectedMonument.title}</div>
              <div className="text-xs text-slate-300">{selectedMonument.subtitle}</div>
            </div>
            <div className="flex items-center justify-between text-xs font-mono tabular-nums pt-1">
              <span className="text-slate-300">{selectedMonument.gradeOrRate}</span>
              <span
                className={
                  selectedMonument.status === 'FAIL'
                    ? 'text-red-400 font-semibold'
                    : 'text-emerald-400 font-semibold'
                }
              >
                {selectedMonument.status}
              </span>
            </div>

            {selectedMonument.studentData && (
              <div className="pt-2 space-y-2">
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {Object.entries(selectedMonument.studentData.marks).map(([sub, val]) => (
                    <div
                      key={sub}
                      className="flex items-center justify-between rounded bg-slate-900/80 px-2 py-1 text-slate-200"
                    >
                      <span className="truncate pr-1">{sub}</span>
                      <span className="font-mono tabular-nums font-medium">{val}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleAnalyzeSelected}
                  disabled={aiLoading}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-[#5B3DF5] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4C30D6] transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiLoading ? 'Generating Evaluation...' : 'AI Academic Evaluation'}
                </button>
                {aiError && <p className="text-xs text-red-300">{aiError}</p>}
                {aiAnalysis && (
                  <div className="rounded bg-slate-900/90 p-2.5 text-xs text-slate-200 space-y-1.5 border border-slate-700">
                    <p className="leading-relaxed">{aiAnalysis.summary}</p>
                    <p className="text-emerald-300">
                      <span className="font-semibold">Strengths:</span> {aiAnalysis.strengths.join(', ')}
                    </p>
                    <p className="text-amber-300">
                      <span className="font-semibold">Focus:</span> {aiAnalysis.focusAreas.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            Drag to orbit, scroll to zoom, and click any 3D monument column to inspect marks and run AI diagnostics.
          </p>
        )}
      </div>

      {/* Collapsible Bottom Control Dock (Unified, Zero Side Clutter, No backdrop-filter) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 w-[min(920px,94vw)] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="mb-1.5 inline-flex items-center gap-1.5 rounded-t-md border border-b-0 border-slate-700 bg-[#0F1E3D]/95 px-3 py-1 text-xs font-medium text-slate-200 hover:text-white whitespace-nowrap"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {dockCollapsed ? 'Show Controls' : 'Hide Controls'}
        </button>

        {!dockCollapsed && (
          <div className="w-full rounded-xl border border-slate-700/90 bg-[#0F1E3D]/95 px-4 py-3 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
            {/* Mode Switch */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-900 p-1">
              <button
                type="button"
                onClick={() => setViewMode('students')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === 'students' ? 'bg-[#5B3DF5] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Student Columns
              </button>
              <button
                type="button"
                onClick={() => setViewMode('subjects')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  viewMode === 'subjects' ? 'bg-[#5B3DF5] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Subject Benchmarks
              </button>
            </div>

            {/* Exploded Separation Slider */}
            <label className="flex items-center gap-2.5 text-xs text-slate-200 whitespace-nowrap">
              <span>Inspect Layer</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={explodeFactor}
                onChange={(e) => setExplodeFactor(Number(e.target.value))}
                className="w-24 accent-[#5B3DF5]"
              />
            </label>

            {/* Camera Presets */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyCameraPreset('amphitheater')}
                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Overview
              </button>
              <button
                type="button"
                onClick={() => applyCameraPreset('top')}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 whitespace-nowrap"
              >
                Top Matrix
              </button>
              <button
                type="button"
                onClick={() => applyCameraPreset('astrolabe')}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 whitespace-nowrap"
              >
                Astrolabe
              </button>
              <button
                type="button"
                onClick={() => setAutoOrbit((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors ${
                  autoOrbit
                    ? 'border-[#5B3DF5] bg-[#5B3DF5] text-white'
                    : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Auto-Orbit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
