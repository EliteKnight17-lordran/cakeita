import { ContactShadows, Environment, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MOTIFS, motifFill } from '../domain/motifs';
import { shade, type CakeVisual } from '../domain/visual';
import { candleStripes, crumbBump, frostingBump, strawberrySkin } from './textures';

/**
 * Parametric 3D cake. Every mesh comes from the same parts list that is priced,
 * so the picture can't promise something the price doesn't include.
 * Works offline: no HDR maps, no web fonts, no model files. Lighting comes from
 * soft "studio" light panels rendered once on the device, and the frosting
 * texture is drawn on a canvas.
 */

const K = 0.12; // world units per inch

function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return true;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

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
      ctx.fillText(text, 512, 128);
    } else {
      // Piped icing: a soft shadow under the line gives it some height.
      ctx.fillStyle = 'rgba(40,20,20,0.28)';
      ctx.fillText(text, 516, 134);
      ctx.fillStyle = color;
      ctx.fillText(text, 512, 128);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 510, 125);
      ctx.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [text, color, style]);
}

function frostingMaterial(v: CakeVisual): THREE.MeshPhysicalMaterialParameters {
  const kind = v.covering === 'fondant' || v.covering === 'ganache' || v.covering === 'whipped' || v.covering === 'naked' ? v.covering : 'buttercream';
  const bumpMap = frostingBump(kind) ?? undefined;
  switch (v.covering) {
    case 'fondant':
      return { color: v.frosting, roughness: 0.42, clearcoat: 0.12, clearcoatRoughness: 0.6, sheen: 0.4, sheenColor: '#ffffff', sheenRoughness: 0.5, bumpMap, bumpScale: 0.6 };
    case 'ganache':
      return { color: v.frosting, roughness: 0.16, clearcoat: 0.9, clearcoatRoughness: 0.12, bumpMap, bumpScale: 0.4 };
    case 'whipped':
      return { color: v.frosting, roughness: 0.82, sheen: 0.7, sheenColor: '#ffffff', sheenRoughness: 0.8, bumpMap, bumpScale: 2.2 };
    case 'naked':
      return { color: '#fffaf0', roughness: 0.75, transparent: true, opacity: 0.5, bumpMap, bumpScale: 1.6 };
    default:
      return { color: v.frosting, roughness: 0.58, sheen: 0.45, sheenColor: '#fff6ee', sheenRoughness: 0.6, bumpMap, bumpScale: 1.6 };
  }
}

/** A frosted tier with a soft, rounded top edge (real frosting never has a sharp rim). */
function useTierGeometry(r: number, h: number) {
  return useMemo(() => {
    const e = Math.min(0.03, h * 0.16, r * 0.2);
    const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, 0), new THREE.Vector2(r - 0.004, 0), new THREE.Vector2(r, 0.005)];
    pts.push(new THREE.Vector2(r, h - e));
    for (let i = 1; i <= 8; i++) {
      const t = (i / 8) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r - e + Math.cos(t) * e, h - e + Math.sin(t) * e));
    }
    pts.push(new THREE.Vector2(0.0001, h));
    return new THREE.LatheGeometry(pts, 112);
  }, [r, h]);
}

function Tier({ v, r, h, y, isTop }: { v: CakeVisual; r: number; h: number; y: number; isTop: boolean }) {
  const mat = frostingMaterial(v);
  const geo = useTierGeometry(r, h);
  const crumb = crumbBump() ?? undefined;
  const piped = v.covering === 'buttercream' || v.covering === 'whipped';
  const pearlCount = Math.round((2 * Math.PI * r) / 0.04);
  return (
    <group position={[0, y, 0]}>
      {v.covering === 'naked' ? (
        <>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, h * (i / 3) + h / 6 - 0.006, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[r - 0.004, r - 0.004, h / 3 - 0.02, 72]} />
              <meshStandardMaterial color={v.sponge} roughness={0.95} bumpMap={crumb} bumpScale={3} />
            </mesh>
          ))}
          {[1, 2].map((i) => (
            <mesh key={`f${i}`} position={[0, (h * i) / 3, 0]}>
              <cylinderGeometry args={[r, r, 0.03, 72]} />
              <meshPhysicalMaterial color="#fff8ee" roughness={0.6} sheen={0.5} sheenColor="#ffffff" />
            </mesh>
          ))}
          <mesh position={[0, h / 2, 0]}>
            <cylinderGeometry args={[r + 0.003, r + 0.003, h, 72, 1, true]} />
            <meshPhysicalMaterial {...mat} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh position={[0, h - 0.004, 0]}>
            <cylinderGeometry args={[r, r, 0.012, 72]} />
            <meshPhysicalMaterial color="#fff8ee" roughness={0.6} sheen={0.5} sheenColor="#ffffff" />
          </mesh>
        </>
      ) : (
        <mesh geometry={geo} castShadow receiveShadow>
          <meshPhysicalMaterial {...mat} />
        </mesh>
      )}
      {piped && <ShellBorder r={r} y={0.012} color={v.accent} size={1} />}
      {piped && isTop && !v.drip && <ShellBorder r={r - 0.022} y={h - 0.004} color={v.accent} size={0.75} />}
      {v.covering === 'fondant' && (
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[r + 0.0025, r + 0.0025, 0.036, 112, 1, true]} />
          <meshPhysicalMaterial color={v.accent} roughness={0.32} sheen={1} sheenColor={shade(v.accent, 0.4)} sheenRoughness={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
      {v.pearls && (
        <Instances count={pearlCount} seed={3} build={(i, m) => {
          const a = (i / pearlCount) * Math.PI * 2;
          m.position.set(Math.cos(a) * (r + 0.012), v.covering === 'fondant' ? 0.045 : 0.03, Math.sin(a) * (r + 0.012));
        }}>
          <sphereGeometry args={[0.019, 14, 10]} />
          <meshPhysicalMaterial color="#fdf8ee" roughness={0.15} clearcoat={1} clearcoatRoughness={0.1} sheen={0.6} sheenColor="#fff2f8" />
        </Instances>
      )}
    </group>
  );
}

/** Piped shell border, like a real buttercream border (many small teardrops in a ring). */
function ShellBorder({ r, y, color, size }: { r: number; y: number; color: string; size: number }) {
  const n = Math.max(18, Math.round((2 * Math.PI * r) / (0.036 * size)));
  const build = useMemo(
    () => (i: number, o: THREE.Object3D) => {
      const a = (i / n) * Math.PI * 2;
      o.position.set(Math.cos(a) * (r + 0.006), y + 0.006 * size, Math.sin(a) * (r + 0.006));
      o.rotation.set(0, -a + Math.PI / 2, -0.35);
      o.scale.set(1.6 * size, 0.95 * size, 1.05 * size);
    },
    [n, r, y, size],
  );
  return (
    <Instances count={n} seed={1} build={build}>
      <sphereGeometry args={[0.019, 14, 10]} />
      <meshPhysicalMaterial color={color} roughness={0.55} sheen={0.5} sheenColor={shade(color, 0.3)} />
    </Instances>
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
  const gold = color === '#d4af37';
  const drips = useMemo(() => {
    const rnd = seeded(5);
    const n = Math.max(14, Math.round(r * 52));
    return Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.12, len: 0.03 + rnd() ** 1.6 * 0.17, w: 0.009 + rnd() * 0.007 }));
  }, [r]);
  const stem = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, -0.5, 0), []);
  const buildStem = useMemo(
    () => (i: number, o: THREE.Object3D) => {
      const d = drips[i]!;
      o.position.set(Math.cos(d.a) * (r + 0.004), y + 0.004, Math.sin(d.a) * (r + 0.004));
      o.scale.set(d.w, d.len + 0.004, d.w);
    },
    [drips, r, y],
  );
  const buildBulb = useMemo(
    () => (i: number, o: THREE.Object3D) => {
      const d = drips[i]!;
      o.position.set(Math.cos(d.a) * (r + 0.004), y - d.len, Math.sin(d.a) * (r + 0.004));
      o.scale.set(d.w * 1.25, d.w * 1.45, d.w * 1.25);
    },
    [drips, r, y],
  );
  const mat = <meshPhysicalMaterial color={color} roughness={gold ? 0.25 : 0.14} clearcoat={gold ? 0.3 : 1} clearcoatRoughness={0.08} metalness={gold ? 0.9 : 0} />;
  return (
    <group>
      {/* glossy pool on top, with a rounded lip where it spills over */}
      <mesh position={[0, y + 0.004, 0]} receiveShadow>
        <cylinderGeometry args={[r - 0.004, r - 0.004, 0.014, 112]} />
        {mat}
      </mesh>
      <mesh position={[0, y + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r - 0.004, 0.009, 12, 112]} />
        {mat}
      </mesh>
      <instancedMesh args={[stem, undefined, drips.length]} castShadow ref={(m) => fill(m, drips.length, buildStem)}>
        {mat}
      </instancedMesh>
      <Instances count={drips.length} seed={1} build={buildBulb}>
        <sphereGeometry args={[1, 12, 10]} />
        {mat}
      </Instances>
    </group>
  );
}

function fill(m: THREE.InstancedMesh | null, n: number, build: (i: number, o: THREE.Object3D) => void) {
  if (!m) return;
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    o.scale.set(1, 1, 1);
    build(i, o);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  }
  m.instanceMatrix.needsUpdate = true;
}

/** Rose parts merged into a few meshes (built once, shared by every rose) so phones draw them fast. */
let roseParts: { inner: THREE.BufferGeometry; outer: THREE.BufferGeometry; leaves: THREE.BufferGeometry } | null = null;
function getRoseParts() {
  if (roseParts) return roseParts;
  const petal = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 0.95, 0, Math.PI * 0.42);
  const inner: THREE.BufferGeometry[] = [];
  const outer: THREE.BufferGeometry[] = [];
  const o = new THREE.Object3D();
  const holder = new THREE.Object3D();
  holder.add(o);
  [3, 5, 7].forEach((n, k) => {
    for (let i = 0; i < n; i++) {
      const rad = 0.019 + k * 0.007;
      holder.rotation.set(0, (i / n) * Math.PI * 2 + k * 0.6, 0);
      o.position.set(0.004 + k * 0.009, 0.012 - k * 0.006, 0);
      o.rotation.set(0, Math.PI / 2, -(0.25 + k * 0.42));
      o.scale.set(rad, rad * 1.15, rad);
      holder.updateMatrixWorld(true);
      (k === 0 ? inner : outer).push(petal.clone().applyMatrix4(o.matrixWorld));
    }
  });
  const bud = new THREE.SphereGeometry(1, 12, 10).applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(0, 0.012, 0), new THREE.Quaternion(), new THREE.Vector3(0.015, 0.02, 0.015)));
  inner.push(bud);
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(0.025, 0.02, 0, 0.065);
  sh.quadraticCurveTo(-0.025, 0.02, 0, 0);
  const leaves = [0.4, 2.6].map((a) => {
    o.position.set(Math.cos(a) * 0.03, -0.002, Math.sin(a) * 0.03);
    o.rotation.set(-Math.PI / 2 + 0.25, 0, a - Math.PI / 2);
    o.scale.set(1, 1, 1);
    holder.rotation.set(0, 0, 0);
    holder.updateMatrixWorld(true);
    return new THREE.ShapeGeometry(sh, 6).applyMatrix4(o.matrixWorld);
  });
  roseParts = { inner: mergeGeometries(inner.map((g) => g.toNonIndexed()))!, outer: mergeGeometries(outer.map((g) => g.toNonIndexed()))!, leaves: mergeGeometries(leaves.map((g) => g.toNonIndexed()))! };
  return roseParts;
}

/** A rose made of cupped petals in a spiral, with two leaves. */
function Rose({ position, color, size = 1, turn = 0 }: { position: [number, number, number]; color: string; size?: number; turn?: number }) {
  const parts = getRoseParts();
  const inner = shade(color, -0.12);
  return (
    <group position={position} scale={size * 2.3} rotation={[0, turn, 0]}>
      <mesh geometry={parts.inner} castShadow>
        <meshPhysicalMaterial color={inner} roughness={0.5} sheen={0.8} sheenColor="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={parts.outer} castShadow>
        <meshPhysicalMaterial color={color} roughness={0.5} sheen={0.9} sheenColor="#ffffff" sheenRoughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={parts.leaves}>
        <meshStandardMaterial color="#4f8a4b" roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Little sprigs of baby's breath between the roses. */
function BabysBreath({ position }: { position: [number, number, number] }) {
  const build = useMemo(
    () => (_i: number, o: THREE.Object3D, rnd: () => number) => {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 0.07;
      o.position.set(Math.cos(a) * d, rnd() * 0.05, Math.sin(a) * d);
    },
    [],
  );
  return (
    <group position={position}>
      <Instances count={22} seed={17} build={build}>
        <sphereGeometry args={[0.009, 8, 6]} />
        <meshStandardMaterial color="#fffdf8" roughness={0.8} />
      </Instances>
    </group>
  );
}

/** Piped rosettes: a spiral of icing that rises as it closes, like a real 1M tip swirl. */
function Rosettes({ r, y, color }: { r: number; y: number; color: string }) {
  const n = Math.max(6, Math.round(r * 10));
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const ang = t * Math.PI * 2 * 2.3;
      const rad = 0.058 * (1 - 0.8 * t);
      pts.push(new THREE.Vector3(Math.cos(ang) * rad, 0.016 + 0.05 * t, Math.sin(ang) * rad));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.019, 8, false);
  }, []);
  const build = useMemo(
    () => (i: number, o: THREE.Object3D) => {
      const a = (i / n) * Math.PI * 2;
      o.position.set(Math.cos(a) * (r - 0.08), y, Math.sin(a) * (r - 0.08));
      o.rotation.set(0, a * 3, 0);
    },
    [n, r, y],
  );
  return (
    <instancedMesh args={[geo, undefined, n]} castShadow ref={(m) => {
      if (!m) return;
      const o = new THREE.Object3D();
      const rnd = seeded(2);
      for (let i = 0; i < n; i++) {
        build(i, o);
        o.rotation.y += rnd();
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }}>
      <meshPhysicalMaterial color={color} roughness={0.55} sheen={0.6} sheenColor={shade(color, 0.3)} />
    </instancedMesh>
  );
}

/** Candles in a ring, or along the back edge when words or a topper sit in front. */
function Candles({ n, r, y, color, back = false }: { n: number; r: number; y: number; color: string; back?: boolean }) {
  const ring = back ? r * 0.74 : n === 1 ? 0 : Math.min(r * 0.6, 0.08 + n * 0.02);
  const angle = (i: number) => (back ? (n === 1 ? Math.PI * 1.25 : Math.PI + 0.3 + (i / (n - 1)) * (Math.PI - 0.6)) : (i / n) * Math.PI * 2);
  const stripes = candleStripes(color) ?? undefined;
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const a = angle(i);
        const x = Math.cos(a) * ring;
        const z = Math.sin(a) * ring;
        return (
          <group key={i} position={[x, y, z]} scale={1.7}>
            <mesh position={[0, 0.07, 0]} castShadow>
              <cylinderGeometry args={[0.008, 0.009, 0.14, 16]} />
              <meshPhysicalMaterial map={stripes} roughness={0.35} clearcoat={0.4} />
            </mesh>
            <mesh position={[0, 0.146, 0]}>
              <cylinderGeometry args={[0.0012, 0.0012, 0.014, 4]} />
              <meshBasicMaterial color="#2a2018" />
            </mesh>
            <mesh position={[0, 0.165, 0]} scale={[0.008, 0.017, 0.008]}>
              <sphereGeometry args={[1, 12, 10]} />
              <meshStandardMaterial color="#ffd36b" emissive="#ff9a1f" emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.165, 0]}>
              <sphereGeometry args={[0.028, 12, 10]} />
              <meshBasicMaterial color="#ffc861" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Fruits({ r, y }: { r: number; y: number }) {
  const skin = strawberrySkin() ?? undefined;
  const berryGeo = useMemo(() => {
    const prof = [[0.0001, 0], [0.01, 0.006], [0.021, 0.02], [0.028, 0.036], [0.027, 0.05], [0.019, 0.059], [0.0001, 0.062]].map(([x, yy]) => new THREE.Vector2(x, yy));
    return new THREE.LatheGeometry(prof, 20);
  }, []);
  const items = useMemo(() => {
    const rnd = seeded(21);
    return Array.from({ length: 10 }, (_, i) => {
      const a = rnd() * Math.PI * 2;
      const d = (0.2 + rnd() * 0.62) * (r - 0.1);
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, berry: i % 3 === 0, rot: rnd() * 0.9, spin: rnd() * Math.PI * 2 };
    });
  }, [r]);
  return (
    <group position={[0, y, 0]}>
      {items.map((f, i) =>
        f.berry ? (
          <mesh key={i} position={[f.x, 0.028, f.z]} castShadow>
            <sphereGeometry args={[0.028, 16, 12]} />
            <meshPhysicalMaterial color="#34407a" roughness={0.55} sheen={0.8} sheenColor="#9aa7d6" />
          </mesh>
        ) : (
          <group key={i} position={[f.x, 0.06, f.z]} rotation={[Math.PI - 0.6 - f.rot * 0.4, f.spin, 0]} scale={1.9}>
            <mesh geometry={berryGeo} position={[0, -0.031, 0]} castShadow>
              <meshPhysicalMaterial map={skin} roughness={0.3} clearcoat={0.6} clearcoatRoughness={0.2} />
            </mesh>
            <mesh position={[0, 0.032, 0]}>
              <cylinderGeometry args={[0.022, 0.012, 0.005, 7]} />
              <meshStandardMaterial color="#3f7f35" roughness={0.6} />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

function Figure({ y, color, x, z }: { y: number; color: string; x: number; z: number }) {
  return (
    <group position={[x, y, z]}>
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

/**
 * Printed cardstock theme topper on a gold pick: each motif layer is a thin extruded shape,
 * printed on both faces like the real thing. Shapes come from the same data as the 2D cake.
 */
function MotifTopper({ motif, position, size }: { motif: NonNullable<CakeVisual['motif']>; position: [number, number, number]; size: number }) {
  const layers = useMemo(() => {
    const def = MOTIFS[motif.key];
    const loader = new SVGLoader();
    return def.layers.map((l, i) => {
      const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${l.d}"/></svg>`);
      const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1.2, bevelEnabled: false, curveSegments: 10 });
      geo.translate(-50, -50, i * 0.9);
      return { geo, color: motifFill(l.fill, motif), metal: l.fill === 'gold' || l.fill === '#b8901c' };
    });
  }, [motif]);
  useEffect(() => () => layers.forEach((l) => l.geo.dispose()), [layers]);
  const s = size / 100;
  const lift = 0.13 + size * 0.5;
  // The back is the same cut-out seen from behind (mirrored), so both sides share one outline.
  const face = (back: boolean) => (
    <group position={[0, 0, back ? -0.001 : 0.001]}>
      {layers.map((l, i) => (
        <mesh key={i} geometry={l.geo} scale={[s, -s, (back ? -s : s) * 0.6]} castShadow>
          <meshStandardMaterial color={l.color} roughness={l.metal ? 0.3 : 0.55} metalness={l.metal ? 0.55 : 0} />
        </mesh>
      ))}
    </group>
  );
  return (
    <group position={position}>
      <mesh position={[0, lift / 2 - 0.02, 0]}>
        <cylinderGeometry args={[0.005, 0.005, lift, 6]} />
        <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.3} />
      </mesh>
      <group position={[0, lift, 0]}>
        {face(false)}
        {face(true)}
      </group>
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

/** What the cake stands on. */
function CakeStand({ r, kind }: { r: number; kind: CakeVisual['stand'] }) {
  if (kind === 'gold') return <GoldPedestal r={r} />;
  if (kind === 'wood') return <WoodSlab r={r} />;
  return <PorcelainStand r={r} />;
}

/** Gold pedestal stand (weddings, debuts): wide plate on a tall fluted stem. */
function GoldPedestal({ r }: { r: number }) {
  const geo = useMemo(() => {
    const R = r * 1.32;
    const F = Math.max(0.14, R * 0.55);
    const pts = [
      [0.0001, -0.16], [F, -0.16], [F + 0.008, -0.15], [F * 0.8, -0.135], [0.05, -0.115], [0.03, -0.08], [0.045, -0.06], [0.026, -0.03], [0.03, -0.005], [0.08, 0.014],
      [R * 0.92, 0.028], [R, 0.034], [R + 0.006, 0.046], [R - 0.004, 0.052], [R * 0.95, 0.048], [0.0001, 0.048],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 96);
  }, [r]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.28} emissive="#3a2a00" emissiveIntensity={0.25} />
    </mesh>
  );
}

/** Rustic wooden slab: a thick round of wood with bark on the side and rings on top. */
function WoodSlab({ r }: { r: number }) {
  const R = r * 1.38;
  const top = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    if (!g) return null;
    g.fillStyle = '#c99a63';
    g.fillRect(0, 0, 256, 256);
    const rnd = seeded(3);
    for (let i = 26; i > 0; i--) {
      g.strokeStyle = i % 2 ? 'rgba(120,78,40,0.35)' : 'rgba(235,200,150,0.35)';
      g.lineWidth = 1.5 + rnd() * 2;
      g.beginPath();
      g.ellipse(128 + rnd() * 3, 128 + rnd() * 3, i * 4.8, i * 4.6, rnd(), 0, Math.PI * 2);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group>
      <mesh position={[0, -0.055, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R * 0.98, R * 1.02, 0.2, 48, 1, true]} />
        <meshStandardMaterial color="#5b3a22" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.046, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[R * 0.98, 64]} />
        <meshStandardMaterial map={top} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** White porcelain cake stand: plate with a lip, stem and foot. */
function PorcelainStand({ r }: { r: number }) {
  const geo = useMemo(() => {
    const R = r * 1.3;
    const F = Math.max(0.12, R * 0.5);
    const pts = [
      [0.0001, -0.16], [F, -0.16], [F + 0.006, -0.154], [F * 0.75, -0.142], [0.04, -0.12], [0.032, -0.05], [0.036, -0.012], [0.07, 0.012],
      [R * 0.9, 0.026], [R, 0.034], [R + 0.004, 0.044], [R - 0.004, 0.05], [R * 0.95, 0.047], [0.0001, 0.047],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 96);
  }, [r]);
  return (
    <mesh geometry={geo} castShadow receiveShadow>
      <meshPhysicalMaterial color="#fbf8f3" roughness={0.18} clearcoat={0.8} clearcoatRoughness={0.1} />
    </mesh>
  );
}

/** A slice cut out of the front of the cake: the gap is a quarter turn, facing the camera. */
const CUT_HALF = Math.PI / 4;
const dir = (a: number) => new THREE.Vector3(Math.sin(a), 0, Math.cos(a));

/** Cut face texture: sponge layers with filling between, a frosting coat on the outside and top. */
function useCutTexture(v: CakeVisual, h: number, r: number) {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const W = 256;
    const H = Math.max(64, Math.round((W * h) / r));
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) return null;
    const naked = v.covering === 'naked';
    const filling = naked || v.covering === 'fondant' ? '#fff3e2' : v.covering === 'ganache' ? '#4a2a1a' : v.frosting;
    const coat = naked ? null : v.frosting;
    const coatW = coat ? Math.round(W * (v.covering === 'fondant' ? 0.03 : 0.05)) : 0;
    const coatTop = coat ? Math.round(H * 0.07) : 0;
    g.fillStyle = v.sponge;
    g.fillRect(0, 0, W, H);
    // Crumb: tiny darker and lighter specks.
    const rnd = seeded(7);
    for (let i = 0; i < (W * H) / 30; i++) {
      g.fillStyle = rnd() > 0.5 ? shade(v.sponge, -0.12) : shade(v.sponge, 0.18);
      g.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
    }
    // Two filling layers split the inside into three sponges.
    const inside = H - coatTop;
    const fill = Math.max(4, Math.round(inside * 0.07));
    g.fillStyle = filling;
    for (const f of [1 / 3, 2 / 3]) g.fillRect(0, coatTop + Math.round(inside * f - fill / 2), W - coatW, fill);
    if (coat) {
      g.fillStyle = coat;
      g.fillRect(0, 0, W, coatTop);
      g.fillRect(W - coatW, 0, coatW, H);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [v.sponge, v.frosting, v.covering, h, r]);
}

/** One flat cut face from the middle of the tier out to its edge, at angle a. */
function CutFace({ v, r, h, y, a }: { v: CakeVisual; r: number; h: number; y: number; a: number }) {
  const tex = useCutTexture(v, h, r);
  const geo = useMemo(() => {
    const d = dir(a).multiplyScalar(r + 0.004);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, d.x, 0, d.z, d.x, h, d.z, 0, h, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return g;
  }, [a, r, h]);
  return (
    <mesh geometry={geo} position={[0, y, 0]}>
      <meshStandardMaterial map={tex} roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

type Layer = { r: number; h: number; y: number };
/** Fresh roses arranged the way the customer picked: side cluster, cascade, crown or scattered. */
function Flowers({ v, top, topY, stack }: { v: CakeVisual; top: Layer; topY: number; stack: Layer[] }) {
  const colors = [v.accent, '#fff6ef', shade(v.accent, 0.35)];
  const base = stack[0]!;
  const roses: Array<{ p: [number, number, number]; s: number }> = [];
  const breath: Array<[number, number, number]> = [];
  const onEdge = (l: Layer, a: number, f: number, k = 0.92): [number, number, number] => [Math.cos(a) * l.r * k, l.y + l.h * f, Math.sin(a) * l.r * k];
  if (v.flowerStyle === 'crown') {
    for (let i = 0; i < 7; i++) roses.push({ p: [Math.cos((i / 7) * Math.PI * 2) * top.r * 0.8, topY + 0.004, Math.sin((i / 7) * Math.PI * 2) * top.r * 0.8], s: 0.85 });
    for (let i = 0; i < 7; i++) breath.push([Math.cos(((i + 0.5) / 7) * Math.PI * 2) * top.r * 0.84, topY + 0.01, Math.sin(((i + 0.5) / 7) * Math.PI * 2) * top.r * 0.84]);
  } else if (v.flowerStyle === 'cascade') {
    // From the top edge, spiralling down the front-right of every tier to the board.
    roses.push({ p: [top.r * 0.55, topY + 0.006, top.r * 0.3], s: 1.2 });
    roses.push({ p: [top.r * 0.78, topY + 0.004, -top.r * 0.05], s: 0.95 });
    const tiers = [...stack].reverse();
    let a = 0.35;
    tiers.forEach((l) => {
      for (const f of [0.75, 0.4, 0.08]) {
        roses.push({ p: onEdge(l, a, f, 0.96), s: 0.9 });
        a += 0.32;
      }
      breath.push(onEdge(l, a - 0.5, 0.55, 1.0));
    });
    roses.push({ p: [Math.cos(a) * (base.r + 0.04), 0.07, Math.sin(a) * (base.r + 0.04)], s: 1.0 });
  } else if (v.flowerStyle === 'scatter') {
    const rnd = seeded(11);
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2;
      const d = 0.25 + rnd() * 0.55;
      roses.push({ p: [Math.cos(a) * top.r * d, topY + 0.004, Math.sin(a) * top.r * d], s: 0.6 });
    }
    stack.forEach((l, i) => {
      for (let k = 0; k < 4; k++) roses.push({ p: onEdge(l, (k / 4) * Math.PI * 2 + i, 0.5, 0.99), s: 0.55 });
    });
  } else {
    roses.push({ p: [top.r * 0.5, topY + 0.006, top.r * 0.35], s: 1.25 });
    roses.push({ p: [top.r * 0.78, topY + 0.004, -top.r * 0.12], s: 1.05 });
    roses.push({ p: [top.r * 0.22, topY + 0.004, top.r * 0.72], s: 0.95 });
    breath.push([top.r * 0.62, topY + 0.01, top.r * 0.62]);
    if (stack.length > 1) {
      roses.push({ p: [base.r * 0.92, base.y + base.h * 0.98, base.r * 0.3], s: 1.1 });
      breath.push([base.r * 0.86, base.y + base.h, base.r * 0.48]);
    }
  }
  return (
    <group>
      {roses.map((r, i) => (
        <Rose key={i} position={r.p} color={colors[i % 3]!} size={r.s} turn={i * 0.9} />
      ))}
      {breath.map((p, i) => (
        <BabysBreath key={`b${i}`} position={p} />
      ))}
    </group>
  );
}

function CakeModel({ v, spin, cut = false }: { v: CakeVisual; spin: number; cut?: boolean }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const target = useRef(spin);
  target.current = spin;
  const invalidate = useThree((st) => st.invalidate);
  // Clipping planes in world space that remove the wedge; they turn with the cake.
  const planes = useMemo(() => [new THREE.Plane(), new THREE.Plane()], []);
  const placePlanes = (turn: number) => {
    // Clipped where both distances are negative, i.e. inside the wedge.
    planes[0]!.set(dir(-CUT_HALF + turn + Math.PI / 2).negate(), 0);
    planes[1]!.set(dir(CUT_HALF + turn + Math.PI / 2), 0);
  };
  useLayoutEffect(() => {
    placePlanes(group.current?.rotation.y ?? 0);
    body.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m || o.userData.cutFace) return;
      for (const mat of Array.isArray(m) ? m : [m]) {
        const want = cut ? planes : null;
        if (mat.clippingPlanes !== want) {
          mat.clippingPlanes = want;
          mat.clipIntersection = true;
          mat.needsUpdate = true;
        }
      }
    });
    invalidate();
  });
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    if (cut) placePlanes(g.rotation.y);
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
  // Piped words must stand out from whatever is on top (drip or frosting).
  const topColor = v.drip ? v.dripColor : v.frosting;
  const textColor = isLight(topColor) ? (isLight(v.accent) ? '#6b2e1f' : v.accent) : '#fff8f0';
  const pipedTex = useTextTexture(v.textStyle === 'piped' ? v.text : '', textColor, 'piped');
  const acrylicTex = useTextTexture(v.textStyle === 'acrylic' ? v.text : '', v.accent, 'acrylic');
  // Topper placement: in the middle, or to one side (the figure goes opposite a topper).
  const side = v.topperSpot === 'side';
  const figureX = v.motif || acrylicTex ? -top.r * 0.45 : side ? -top.r * 0.42 : 0;

  return (
    <group ref={group}>
      <CakeStand r={base.r} kind={v.stand} />
      {/* cake board under the bottom tier */}
      <mesh position={[0, 0.054, 0]} receiveShadow>
        <cylinderGeometry args={[base.r + 0.03, base.r + 0.03, 0.012, 96]} />
        <meshPhysicalMaterial color="#efe8de" metalness={0.55} roughness={0.32} clearcoat={0.5} />
      </mesh>

      {cut &&
        stack.map((s, i) => (
          <group key={`cut${i}`} userData={{ cutFace: true }}>
            <CutFace v={v} r={s.r} h={s.h} y={s.y} a={-CUT_HALF} />
            <CutFace v={v} r={s.r} h={s.h} y={s.y} a={CUT_HALF} />
          </group>
        ))}
      <group ref={body}>
      {stack.map((s, i) => (
        <Tier key={i} v={v} r={s.r} h={s.h} y={s.y} isTop={i === stack.length - 1} />
      ))}

      {v.drip && <Drip r={top.r} y={topY} color={v.dripColor} />}
      {v.sprinkles && <Sprinkles r={top.r} y={topY + (v.drip ? 0.012 : 0)} />}
      {v.rosettes && <Rosettes r={top.r} y={topY} color={v.accent} />}
      {v.fruits && <Fruits r={top.r} y={topY} />}
      {v.gold && <GoldLeaf r={top.r} y={top.y} h={top.h} />}
      {v.flowers && <Flowers v={v} top={top} topY={topY} stack={stack} />}
      {v.candles > 0 && <Candles n={v.candles} r={top.r} y={topY} color={v.accent} back={!!v.text || !!v.motif || v.figure} />}
      {v.figure && <Figure y={topY} color={v.accent} x={figureX} z={v.motif || acrylicTex || side ? top.r * 0.15 : 0} />}
      {v.motif && (
        <MotifTopper
          motif={v.motif}
          size={Math.max(0.2, top.r * (acrylicTex || side ? 0.62 : 0.85))}
          position={acrylicTex ? [top.r * 0.5, topY, top.r * 0.05] : side ? [top.r * 0.42, topY, -top.r * 0.18] : [0, topY, -top.r * 0.3]}
        />
      )}

      {pipedTex && (
        <mesh position={[0, topY + (v.drip ? 0.024 : 0.006), top.r * 0.15]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
          <planeGeometry args={[top.r * 1.6, top.r * 0.4]} />
          <meshBasicMaterial map={pipedTex} transparent depthWrite={false} />
        </mesh>
      )}
      {acrylicTex && (
        <group position={[side && !v.motif ? top.r * 0.3 : 0, topY, -top.r * 0.2]}>
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
    </group>
  );
}

/**
 * The camera is placed once when the canvas starts. When the cake grows or shrinks (bento to
 * 3 tiers, a topper added), glide to the new distance from the same angle the customer is looking.
 */
function Reframe({ dist, lookY }: { dist: number; lookY: number }) {
  const camera = useThree((st) => st.camera);
  const invalidate = useThree((st) => st.invalidate);
  const controls = useThree((st) => st.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const goal = useRef<THREE.Vector3 | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const target = new THREE.Vector3(0, lookY, 0);
    const dir = camera.position.clone().sub(controls?.target ?? target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.62, 0.92);
    goal.current = target.add(dir.normalize().multiplyScalar(dist * Math.hypot(0.62, 0.92)));
    invalidate();
  }, [dist, lookY, camera, controls, invalidate]);
  useFrame((_, dt) => {
    const g = goal.current;
    if (!g) return;
    camera.position.lerp(g, Math.min(1, dt * 5));
    if (camera.position.distanceTo(g) < 0.002) {
      camera.position.copy(g);
      goal.current = null;
    }
    controls?.update();
    invalidate();
  });
  return null;
}

export interface Cake3DProps {
  visual: CakeVisual;
  spin: number;
  autoRotate: boolean;
  /** No graphics chip: skip studio lighting and shadows, lower resolution. */
  lite?: boolean;
  onReady?: (canvas: HTMLCanvasElement) => void;
  /** Show the inside: a slice is cut out of the front. */
  cut?: boolean;
}

export default function Cake3D({ visual, spin, autoRotate, lite = false, onReady, cut = false }: Cake3DProps) {
  const cakeH = visual.tiers.reduce((a, t) => a + t.h * K, 0);
  // Leave room for whatever stands on top (theme topper on its pick, acrylic words).
  const topR = (visual.tiers[visual.tiers.length - 1]!.d / 2) * K * 1.6;
  const onTop = visual.motif ? 0.13 + Math.max(0.2, topR * 0.85) * 1.2 : visual.textStyle === 'acrylic' ? 0.28 : 0;
  const totalH = cakeH + onTop * 0.7;
  const maxR = Math.max(...visual.tiers.map((t) => (t.d / 2) * K * 1.6));
  const dist = Math.max(1.8, Math.max(totalH * 2.7, maxR * 4.3));
  const lookY = totalH * 0.45;
  // Start sharp; if this phone can't keep up, drop the resolution (and shadows) instead of stuttering.
  const [dpr, setDpr] = useState(lite ? 1 : 1.75);
  const [lowPower, setLowPower] = useState(lite);
  return (
    <Canvas
      shadows={!lowPower}
      dpr={dpr}
      frameloop={autoRotate ? 'always' : 'demand'}
      camera={{ position: [0, lookY + dist * 0.62, dist * 0.92], fov: 36, near: 0.05, far: 50 }}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        onReady?.(gl.domElement);
      }}
    >
      {!lite && <PerformanceMonitor onDecline={() => setDpr(1)} onFallback={() => { setDpr(1); setLowPower(true); }} flipflops={2} />}
      {/* Soft studio light, rendered once on the device (no downloads). */}
      {!lite && (
      <Environment resolution={128} frames={1} environmentIntensity={0.85}>
        <Lightformer form="rect" intensity={2.4} color="#fff4e8" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#ffffff" position={[-5, 2, 2]} rotation-y={Math.PI / 2} scale={[5, 4, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ffe3ee" position={[5, 1.5, -1]} rotation-y={-Math.PI / 2} scale={[5, 3, 1]} />
        <Lightformer form="ring" intensity={1.6} color="#ffffff" position={[2, 3, 6]} scale={2.5} />
        <Lightformer form="rect" intensity={0.5} color="#f6e6d6" position={[0, -3, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} />
      </Environment>
      )}
      <ambientLight intensity={lite ? 0.55 : 0.18} />
      <hemisphereLight args={['#fff6ea', '#d9c7b0', lite ? 0.7 : 0.35]} />
      <directionalLight position={[2.5, 4, 2]} intensity={1.35} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} color="#ffe1ec" />
      <CakeModel v={visual} spin={spin} cut={cut} />
      <Reframe dist={dist} lookY={lookY} />
      {!lowPower && <ContactShadows position={[0, -0.161, 0]} opacity={0.45} scale={maxR * 6} blur={2.6} far={1.2} />}
      <OrbitControls
        makeDefault
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
