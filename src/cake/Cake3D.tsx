import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { shade, type CakeVisual } from '../domain/visual';

/**
 * Parametric 3D cake. Every mesh comes from the same parts list that is priced,
 * so the picture can't promise something the price doesn't include.
 * Works offline: no HDR maps, no web fonts, no model files.
 */

const K = 0.12; // world units per inch

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function useTextTexture(text: string, color: string, style: 'piped' | 'acrylic') {
  return useMemo(() => {
    if (!text || typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, c.width, c.height);
    let size = 120;
    const font = (s: number) => `italic 700 ${s}px Georgia, 'Times New Roman', serif`;
    ctx.font = font(size);
    while (ctx.measureText(text).width > 960 && size > 40) {
      size -= 6;
      ctx.font = font(size);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (style === 'acrylic') {
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#7a5c0a';
      ctx.strokeText(text, 512, 128);
      ctx.fillStyle = '#d9b13b';
    } else {
      ctx.fillStyle = color;
    }
    ctx.fillText(text, 512, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [text, color, style]);
}

function frostingMaterial(v: CakeVisual): THREE.MeshPhysicalMaterialParameters {
  switch (v.covering) {
    case 'fondant':
      return { color: v.frosting, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.5 };
    case 'ganache':
      return { color: v.frosting, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 };
    case 'whipped':
      return { color: v.frosting, roughness: 0.95 };
    case 'naked':
      return { color: '#fffaf0', roughness: 0.9, transparent: true, opacity: 0.45 };
    default:
      return { color: v.frosting, roughness: 0.7 };
  }
}

function Tier({ v, r, h, y, isTop }: { v: CakeVisual; r: number; h: number; y: number; isTop: boolean }) {
  const mat = frostingMaterial(v);
  const border = v.covering === 'buttercream' || v.covering === 'whipped';
  const pearlCount = Math.round((2 * Math.PI * r) / 0.035);
  return (
    <group position={[0, y, 0]}>
      {v.covering === 'naked' ? (
        <>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, h * (i / 3) + h / 6 - 0.006, 0]} castShadow>
              <cylinderGeometry args={[r - 0.004, r - 0.004, h / 3 - 0.02, 64]} />
              <meshStandardMaterial color={v.sponge} roughness={0.95} />
            </mesh>
          ))}
          {[1, 2].map((i) => (
            <mesh key={`f${i}`} position={[0, (h * i) / 3, 0]}>
              <cylinderGeometry args={[r, r, 0.03, 64]} />
              <meshStandardMaterial color="#fffaf0" roughness={0.8} />
            </mesh>
          ))}
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[r + 0.003, r + 0.003, h, 64, 1, true]} />
            <meshPhysicalMaterial {...mat} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, h - 0.004, 0]}>
            <cylinderGeometry args={[r, r, 0.012, 64]} />
            <meshStandardMaterial color="#fffaf0" roughness={0.8} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r, r, h, 96, 1]} />
          <meshPhysicalMaterial {...mat} />
        </mesh>
      )}
      {border && (
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.022, 10, 96]} />
          <meshStandardMaterial color={v.accent} roughness={0.7} />
        </mesh>
      )}
      {border && isTop && (
        <mesh position={[0, h, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r - 0.01, 0.016, 10, 96]} />
          <meshStandardMaterial color={v.accent} roughness={0.7} />
        </mesh>
      )}
      {v.pearls && (
        <Instances count={pearlCount} seed={3} build={(i, m) => {
          const a = (i / pearlCount) * Math.PI * 2;
          m.position.set(Math.cos(a) * (r + 0.012), 0.03, Math.sin(a) * (r + 0.012));
        }}>
          <sphereGeometry args={[0.016, 12, 12]} />
          <meshPhysicalMaterial color="#fdf8ee" roughness={0.2} clearcoat={1} />
        </Instances>
      )}
    </group>
  );
}

/** Small helper for many identical meshes (sprinkles, pearls, gold flakes). */
function Instances({ count, seed, build, children }: { count: number; seed: number; build: (i: number, o: THREE.Object3D, rnd: () => number) => void; children: React.ReactNode; colors?: string[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    const rnd = seeded(seed);
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      build(i, o, rnd);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, seed, build]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
      {children}
    </instancedMesh>
  );
}

function Sprinkles({ r, y }: { r: number; y: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = Math.round(r * r * 900);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    const rnd = seeded(11);
    const palette = ['#e0457b', '#4a7bd0', '#f5d34a', '#5fae6b', '#ffffff', '#f29a3b'].map((c) => new THREE.Color(c));
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * (r - 0.03);
      o.position.set(Math.cos(a) * d, y + 0.008, Math.sin(a) * d);
      o.rotation.set(Math.PI / 2, 0, rnd() * Math.PI);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, palette[i % palette.length]!);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, r, y]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <capsuleGeometry args={[0.006, 0.018, 2, 6]} />
      <meshStandardMaterial roughness={0.5} />
    </instancedMesh>
  );
}

function Drip({ r, y, color }: { r: number; y: number; color: string }) {
  const drips = useMemo(() => {
    const rnd = seeded(5);
    const n = Math.max(10, Math.round(r * 40));
    return Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2 + rnd() * 0.1, len: 0.05 + rnd() * 0.14 }));
  }, [r]);
  return (
    <group>
      <mesh position={[0, y + 0.006, 0]}>
        <cylinderGeometry args={[r + 0.006, r + 0.006, 0.02, 96]} />
        <meshPhysicalMaterial color={color} roughness={0.2} clearcoat={0.8} metalness={color === '#d4af37' ? 0.7 : 0} />
      </mesh>
      {drips.map((d, i) => (
        <mesh key={i} position={[Math.cos(d.a) * (r + 0.006), y - d.len / 2, Math.sin(d.a) * (r + 0.006)]}>
          <capsuleGeometry args={[0.014, d.len, 4, 8]} />
          <meshPhysicalMaterial color={color} roughness={0.2} clearcoat={0.8} metalness={color === '#d4af37' ? 0.7 : 0} />
        </mesh>
      ))}
    </group>
  );
}

function Flower({ position, color, size = 1 }: { position: [number, number, number]; color: string; size?: number }) {
  return (
    <group position={position} scale={size}>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.035, 0, Math.sin(a) * 0.035]} rotation={[0, -a, 0.5]} scale={[1.3, 0.5, 0.9]}>
            <sphereGeometry args={[0.032, 12, 10]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.012, 0]}>
        <sphereGeometry args={[0.02, 12, 10]} />
        <meshStandardMaterial color="#f5d34a" roughness={0.6} />
      </mesh>
      <mesh position={[0.07, -0.01, 0.02]} rotation={[0.3, 0.6, 0.3]} scale={[1.6, 0.3, 0.7]}>
        <sphereGeometry args={[0.03, 10, 8]} />
        <meshStandardMaterial color="#5f9e5f" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Rosettes({ r, y, color }: { r: number; y: number; color: string }) {
  const n = Math.max(8, Math.round(r * 22));
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * (r - 0.045), y + 0.02, Math.sin(a) * (r - 0.045)]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.022, 0.014, 8, 16]} />
              <meshStandardMaterial color={color} roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.012, 0]}>
              <sphereGeometry args={[0.016, 10, 8]} />
              <meshStandardMaterial color={shade(color, 0.15)} roughness={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Candles({ n, r, y, color }: { n: number; r: number; y: number; color: string }) {
  const ring = n === 1 ? 0 : Math.min(r * 0.55, 0.05 + n * 0.012);
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const x = Math.cos(a) * ring;
        const z = Math.sin(a) * ring;
        return (
          <group key={i} position={[x, y, z]}>
            <mesh position={[0, 0.07, 0]} castShadow>
              <cylinderGeometry args={[0.009, 0.009, 0.14, 12]} />
              <meshStandardMaterial color={i % 2 ? '#fffaf3' : color} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.16, 0]}>
              <coneGeometry args={[0.012, 0.04, 12]} />
              <meshStandardMaterial color="#ffb400" emissive="#ff9a00" emissiveIntensity={1.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Fruits({ r, y }: { r: number; y: number }) {
  const items = useMemo(() => {
    const rnd = seeded(21);
    return Array.from({ length: 9 }, (_, i) => {
      const a = rnd() * Math.PI * 2;
      const d = (0.3 + rnd() * 0.6) * (r - 0.06);
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, berry: i % 3 === 0, rot: rnd() * 0.8 };
    });
  }, [r]);
  return (
    <group position={[0, y, 0]}>
      {items.map((f, i) =>
        f.berry ? (
          <mesh key={i} position={[f.x, 0.02, f.z]}>
            <sphereGeometry args={[0.022, 12, 10]} />
            <meshStandardMaterial color="#2c3e8f" roughness={0.4} />
          </mesh>
        ) : (
          <group key={i} position={[f.x, 0.035, f.z]} rotation={[f.rot, 0, f.rot]}>
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.03, 0.07, 12]} />
              <meshStandardMaterial color="#d23a3a" roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.036, 0]}>
              <cylinderGeometry args={[0.03, 0.02, 0.01, 8]} />
              <meshStandardMaterial color="#3f8f3f" />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

function Figure({ y, r, color }: { y: number; r: number; color: string }) {
  return (
    <group position={[-r * 0.45, y, r * 0.15]}>
      <mesh position={[0, 0.07, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.06, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.17, 0]} castShadow>
        <sphereGeometry args={[0.04, 16, 14]} />
        <meshStandardMaterial color="#f6d2b8" roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.013, 0.18, 0.036]}>
          <sphereGeometry args={[0.006, 8, 8]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}
    </group>
  );
}

function GoldLeaf({ r, y, h }: { r: number; y: number; h: number }) {
  const build = useMemo(
    () => (_i: number, o: THREE.Object3D, rnd: () => number) => {
      const a = rnd() * Math.PI * 2;
      o.position.set(Math.cos(a) * (r + 0.002), y + h * (0.2 + rnd() * 0.7), Math.sin(a) * (r + 0.002));
      o.rotation.set(0, -a + Math.PI / 2, rnd() * Math.PI);
      const s = 0.6 + rnd() * 0.9;
      o.scale.set(s, s, s);
    },
    [r, y, h],
  );
  return (
    <Instances count={22} seed={9} build={build}>
      <planeGeometry args={[0.05, 0.035]} />
      <meshStandardMaterial color="#d4af37" metalness={0.6} roughness={0.25} emissive="#5a4300" side={THREE.DoubleSide} />
    </Instances>
  );
}

function CakeModel({ v, spin }: { v: CakeVisual; spin: number }) {
  const group = useRef<THREE.Group>(null);
  const target = useRef(spin);
  target.current = spin;
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const diff = target.current - g.rotation.y;
    if (Math.abs(diff) < 0.0005) return;
    g.rotation.y += diff * Math.min(1, dt * 6);
    state.invalidate(); // keep animating the turn; otherwise the canvas sleeps (saves battery)
  });

  const stack = useMemo(() => {
    let y = 0.06;
    return v.tiers.map((t) => {
      const r = (t.d / 2) * K * 1.6;
      const h = t.h * K * 1.0;
      const item = { r, h, y };
      y += h;
      return item;
    });
  }, [v.tiers]);
  const top = stack[stack.length - 1]!;
  const topY = top.y + top.h;
  const base = stack[0]!;
  const pipedTex = useTextTexture(v.textStyle === 'piped' ? v.text : '', v.drip && v.dripColor !== '#d4af37' ? '#fff8f0' : v.accent, 'piped');
  const acrylicTex = useTextTexture(v.textStyle === 'acrylic' ? v.text : '', v.accent, 'acrylic');

  return (
    <group ref={group}>
      {/* cake stand */}
      <mesh position={[0, 0.03, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[base.r * 1.22, base.r * 1.18, 0.03, 64]} />
        <meshPhysicalMaterial color="#f4ece1" roughness={0.3} clearcoat={0.4} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.15, 24]} />
        <meshPhysicalMaterial color="#efe5d8" roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <cylinderGeometry args={[base.r * 0.55, base.r * 0.6, 0.02, 48]} />
        <meshPhysicalMaterial color="#efe5d8" roughness={0.3} />
      </mesh>

      {stack.map((s, i) => (
        <Tier key={i} v={v} r={s.r} h={s.h} y={s.y} isTop={i === stack.length - 1} />
      ))}

      {v.drip && <Drip r={top.r} y={topY} color={v.dripColor} />}
      {v.sprinkles && <Sprinkles r={top.r} y={topY + (v.drip ? 0.012 : 0)} />}
      {v.rosettes && <Rosettes r={top.r} y={topY} color={v.accent} />}
      {v.fruits && <Fruits r={top.r} y={topY} />}
      {v.gold && <GoldLeaf r={top.r} y={top.y} h={top.h} />}
      {v.flowers && (
        <group>
          <Flower position={[top.r * 0.55, topY + 0.03, top.r * 0.35]} color={v.accent} size={1.2} />
          <Flower position={[top.r * 0.75, topY + 0.01, -top.r * 0.1]} color="#fffaf3" />
          <Flower position={[top.r * 0.3, topY + 0.02, top.r * 0.7]} color={shade(v.accent, 0.3)} size={0.9} />
          {stack.length > 1 && <Flower position={[base.r * 0.95, base.y + base.h * 0.9, base.r * 0.3]} color={v.accent} size={1.1} />}
        </group>
      )}
      {v.candles > 0 && <Candles n={v.candles} r={top.r} y={topY} color={v.accent} />}
      {v.figure && <Figure y={topY} r={top.r} color={v.accent} />}

      {pipedTex && (
        <mesh position={[0, topY + (v.drip ? 0.024 : 0.006), top.r * 0.15]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <planeGeometry args={[top.r * 1.6, top.r * 0.4]} />
          <meshBasicMaterial map={pipedTex} transparent depthWrite={false} />
        </mesh>
      )}
      {acrylicTex && (
        <group position={[0, topY, -top.r * 0.2]}>
          <mesh position={[0, 0.2, 0]}>
            <planeGeometry args={[Math.max(0.35, top.r * 1.4), Math.max(0.09, top.r * 0.35)]} />
            <meshBasicMaterial map={acrylicTex} transparent side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * Math.max(0.12, top.r * 0.5), 0.09, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.18, 6]} />
              <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.3} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export interface Cake3DProps {
  visual: CakeVisual;
  spin: number;
  autoRotate: boolean;
  onReady?: (canvas: HTMLCanvasElement) => void;
}

export default function Cake3D({ visual, spin, autoRotate, onReady }: Cake3DProps) {
  const totalH = visual.tiers.reduce((a, t) => a + t.h * K, 0);
  const maxR = Math.max(...visual.tiers.map((t) => (t.d / 2) * K * 1.6));
  const dist = Math.max(1.8, Math.max(totalH * 2.7, maxR * 4.3));
  const lookY = totalH * 0.45;
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop={autoRotate ? 'always' : 'demand'}
      camera={{ position: [0, lookY + dist * 0.62, dist * 0.92], fov: 36, near: 0.05, far: 50 }}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
      onCreated={({ gl }) => onReady?.(gl.domElement)}
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#fff6ea', '#d9c7b0', 0.6]} />
      <directionalLight position={[2.5, 4, 2]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#ffe1ec" />
      <CakeModel v={visual} spin={spin} />
      <ContactShadows position={[0, -0.14, 0]} opacity={0.35} scale={maxR * 6} blur={2.4} far={1.5} />
      <OrbitControls
        target={[0, lookY, 0]}
        enablePan={false}
        minDistance={dist * 0.55}
        maxDistance={dist * 1.8}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate={autoRotate}
        autoRotateSpeed={1.2}
        enableDamping
      />
    </Canvas>
  );
}
