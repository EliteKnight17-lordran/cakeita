import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { shade } from '../domain/visual';

/**
 * Block-game cake parts: fondant brick wall, name banner, blocky figures, age number,
 * tree, trophy and bars, and a scalloped board with the message on it. Each one is
 * drawn only when its priced part is picked. Letters are real 3D (bundled font, no download).
 * The figures are generic blocky people, never a game's own characters or logo.
 */

let font: Font | null = null;
function getFont(): Font {
  font ??= new FontLoader().parse(fontJson as unknown as ConstructorParameters<typeof Font>[0]);
  return font;
}

/** Wrap a flat geometry (drawn in the XY plane, depth along Z) around the cake's side. */
function bendOnWall(geo: THREE.BufferGeometry, R: number) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / R;
    const rho = R + p.getZ(i);
    p.setXYZ(i, rho * Math.sin(a), p.getY(i), rho * Math.cos(a));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Lay flat text on the board along an arc in front of the cake (tops of the letters toward the cake). */
function bendOnFloor(geo: THREE.BufferGeometry, R: number) {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / R;
    const rho = R - p.getY(i);
    p.setXYZ(i, rho * Math.sin(a), p.getZ(i), rho * Math.cos(a));
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
}

/** 3D letters, centered, squeezed to fit `maxW` if needed. */
function textGeo(text: string, size: number, depth: number, maxW: number, bevel = true): THREE.BufferGeometry {
  const geo = new TextGeometry(text, {
    font: getFont(),
    size,
    depth,
    curveSegments: 6,
    bevelEnabled: bevel,
    bevelThickness: depth * 0.35,
    bevelSize: size * 0.045,
    bevelSegments: 2,
  });
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const w = b.max.x - b.min.x;
  geo.translate(-(b.min.x + w / 2), -(b.min.y + (b.max.y - b.min.y) / 2), 0);
  if (w > maxW) geo.scale(maxW / w, 1, 1);
  return geo;
}

function useDispose(...geos: Array<THREE.BufferGeometry | null | undefined>) {
  useEffect(() => () => geos.forEach((g) => g?.dispose()), geos); // eslint-disable-line react-hooks/exhaustive-deps
}

// ---------------------------------------------------------------- brick wall

function useBrickTextures(cols: number, rows: number) {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const bw = 64;
    const bh = 30;
    const W = cols * bw;
    const H = rows * bh;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const b = document.createElement('canvas');
    b.width = W;
    b.height = H;
    const gb = b.getContext('2d');
    if (!g || !gb) return null;
    let s = 7;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    g.fillStyle = '#5a3a26'; // mortar
    g.fillRect(0, 0, W, H);
    gb.fillStyle = '#000';
    gb.fillRect(0, 0, W, H);
    const m = 3;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let k = -1; k <= cols; k++) {
        const x = k * bw + off;
        const tone = 0.82 + rnd() * 0.3;
        const base = [150, 92, 60].map((v) => Math.min(255, Math.round(v * tone)));
        g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
        g.beginPath();
        g.roundRect(x + m, r * bh + m, bw - m * 2, bh - m * 2, 4);
        g.fill();
        // A soft highlight along the top of each brick.
        g.fillStyle = 'rgba(255,230,200,0.14)';
        g.fillRect(x + m + 2, r * bh + m + 1, bw - m * 2 - 4, 4);
        gb.fillStyle = '#fff';
        gb.beginPath();
        gb.roundRect(x + m, r * bh + m, bw - m * 2, bh - m * 2, 5);
        gb.fill();
      }
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const bump = new THREE.CanvasTexture(b);
    return { map, bump };
  }, [cols, rows]);
}

/** Fondant brick wall around the lower part of the bottom tier, slightly thicker than the cake. */
export function BrickWall({ r, y, h }: { r: number; y: number; h: number }) {
  const wallH = h * 0.42;
  const rows = 6;
  const brickH = wallH / rows;
  const cols = Math.max(12, Math.round((2 * Math.PI * r) / (brickH * 2.1)));
  const tex = useBrickTextures(cols, rows);
  const R = r + 0.008;
  if (!tex) return null;
  return (
    <group>
      <mesh position={[0, y + wallH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, wallH, 128, 1, true]} />
        <meshStandardMaterial map={tex.map} bumpMap={tex.bump} bumpScale={2.5} roughness={0.62} />
      </mesh>
      {/* the top edge of the wall, so it reads as a layer on the cake */}
      <mesh position={[0, y + wallH, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[r - 0.001, R, 128]} />
        <meshStandardMaterial color="#8a5a3c" roughness={0.6} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- name banner

/** A slanted fondant banner around the front of the bottom tier with the name in white 3D letters. */
export function NameBanner({ r, y, h, word, color, low }: { r: number; y: number; h: number; word: string; color: string; low: boolean }) {
  const bh = h * 0.3;
  const cy = low ? y + h * 0.66 : y + h * 0.55;
  const R = r + 0.004;
  const arcW = Math.min(r * 1.75, Math.max(r * 0.9, word.length * bh * 0.62 + bh));
  const { band, letters } = useMemo(() => {
    const band = new THREE.BoxGeometry(arcW, bh, 0.014, 48, 1, 1);
    // Slant the ends like a sticker-style banner.
    const p = band.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + p.getY(i) * 0.35);
    band.translate(0, 0, 0.007);
    bendOnWall(band, R);
    const letters = textGeo(word, bh * 0.62, 0.012, arcW * 0.86);
    letters.translate(0, 0, 0.016);
    bendOnWall(letters, R);
    return { band, letters };
  }, [word, arcW, bh, R]);
  useDispose(band, letters);
  return (
    <group position={[0, cy, 0]}>
      <mesh geometry={band} castShadow>
        <meshPhysicalMaterial color={color} roughness={0.42} clearcoat={0.2} />
      </mesh>
      <mesh geometry={letters} castShadow>
        <meshPhysicalMaterial color="#ffffff" roughness={0.4} clearcoat={0.15} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- age number

/** Standing fondant number: white faces with a colored rim. */
export function AgeNumber({ text, position, size, rim }: { text: string; position: [number, number, number]; size: number; rim: string }) {
  const geo = useMemo(() => {
    const g = textGeo(text, size, size * 0.16, size * 1.6);
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox!.min.y, 0);
    return g;
  }, [text, size]);
  useDispose(geo);
  return (
    <mesh geometry={geo} position={position} rotation={[0, -0.25, 0]} castShadow>
      <meshPhysicalMaterial attach="material-0" color="#fbfaf7" roughness={0.45} clearcoat={0.1} />
      <meshPhysicalMaterial attach="material-1" color={rim} roughness={0.45} />
    </mesh>
  );
}

// ---------------------------------------------------------------- board

/** White scalloped cake board on the table, with the message in red 3D letters in front. */
export function ScallopBoard({ r, text, textColor }: { r: number; text: string; textColor: string }) {
  const RB = r * 1.48;
  const geo = useMemo(() => {
    const n = 44;
    const shape = new THREE.Shape();
    const steps = n * 8;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const bump = Math.sqrt(Math.abs(Math.sin((t * n) / 2)));
      const rr = RB * (0.982 + 0.018 * bump);
      if (i === 0) shape.moveTo(rr, 0);
      else shape.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: false, curveSegments: 4 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, [RB]);
  const words = useMemo(() => {
    const t = text.trim().toUpperCase();
    if (!t) return null;
    const mid = r + (RB - r) * 0.5;
    const g = textGeo(t, Math.min(0.075, (RB - r) * 0.34), 0.01, mid * 2.3);
    bendOnFloor(g, mid);
    return g;
  }, [text, r, RB]);
  useDispose(geo, words);
  return (
    <group>
      <mesh geometry={geo} position={[0, 0.046, 0]} receiveShadow castShadow>
        <meshStandardMaterial attach="material-0" color="#fbf9f5" roughness={0.55} />
        <meshStandardMaterial attach="material-1" color="#b8ab98" roughness={0.9} />
      </mesh>
      {words && (
        <mesh geometry={words} position={[0, 0.06, 0]} castShadow>
          <meshPhysicalMaterial attach="material-0" color={textColor} roughness={0.4} clearcoat={0.2} />
          <meshPhysicalMaterial attach="material-1" color={shade(textColor, -0.25)} roughness={0.45} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- blocky figures

interface Outfit {
  skin: string;
  hair: string | null;
  hairStyle: 'spikes' | 'flat' | 'cap' | 'helmet';
  jacket: string;
  shirt: string;
  tie: string | null;
  pants: string;
  hands: string;
  shades: boolean;
  metal: boolean;
}

const OUTFITS: Outfit[] = [
  { skin: '#e9b98f', hair: '#2b2d4a', hairStyle: 'spikes', jacket: '#7a5236', shirt: '#f4efe6', tie: '#2a2a2a', pants: '#6b4a33', hands: '#e9b98f', shades: false, metal: false },
  { skin: '#d4a017', hair: '#c79312', hairStyle: 'helmet', jacket: '#d4a017', shirt: '#b8860b', tie: null, pants: '#c79312', hands: '#d4a017', shades: false, metal: true },
  { skin: '#e9b98f', hair: '#6b4228', hairStyle: 'spikes', jacket: '#8a5a32', shirt: '#f4efe6', tie: '#2e6b3a', pants: '#7a5236', hands: '#3c9a4a', shades: false, metal: false },
  { skin: '#e9b98f', hair: '#1d1d1f', hairStyle: 'flat', jacket: '#232326', shirt: '#c92a2a', tie: '#c92a2a', pants: '#232326', hands: '#e9b98f', shades: false, metal: false },
  { skin: '#e9b98f', hair: '#2a2a2a', hairStyle: 'cap', jacket: '#6f7f8f', shirt: '#cfd6dc', tie: null, pants: '#2f6f7a', hands: '#e9b98f', shades: true, metal: false },
];

/** Face and shirt are painted on small canvases (eyes, smile, lapels, tie). */
function useFigureTextures(o: Outfit) {
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const make = (draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      if (!g) return null;
      draw(g);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const face = make((g) => {
      g.fillStyle = o.skin;
      g.fillRect(0, 0, 128, 128);
      if (o.hairStyle === 'helmet') {
        g.fillStyle = '#1b1b1d';
        g.beginPath();
        g.roundRect(22, 40, 84, 44, 10);
        g.fill();
        g.fillStyle = 'rgba(120,200,255,0.35)';
        g.fillRect(30, 46, 30, 6);
        return;
      }
      if (o.shades) {
        g.fillStyle = '#151515';
        g.beginPath();
        g.roundRect(22, 44, 38, 20, 6);
        g.roundRect(68, 44, 38, 20, 6);
        g.fill();
        g.fillRect(56, 50, 16, 5);
      } else {
        g.fillStyle = '#1b1b1d';
        g.beginPath();
        g.ellipse(44, 54, 7, 10, 0, 0, Math.PI * 2);
        g.ellipse(84, 54, 7, 10, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(46, 50, 2.5, 0, Math.PI * 2);
        g.arc(86, 50, 2.5, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = '#1b1b1d';
      g.lineWidth = 5;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(64, 74, 20, 0.2 * Math.PI, 0.8 * Math.PI);
      g.stroke();
    });
    const shirt = make((g) => {
      g.fillStyle = o.jacket;
      g.fillRect(0, 0, 128, 128);
      if (o.metal) {
        // Armor plate lines and a small emblem.
        g.strokeStyle = 'rgba(90,60,0,0.55)';
        g.lineWidth = 4;
        g.strokeRect(18, 14, 92, 100);
        g.beginPath();
        g.moveTo(64, 14);
        g.lineTo(64, 114);
        g.stroke();
        g.fillStyle = '#2e7d4f';
        g.beginPath();
        g.arc(64, 54, 12, 0, Math.PI * 2);
        g.fill();
        return;
      }
      // Shirt showing in a V between the lapels, and the tie.
      g.fillStyle = o.shirt;
      g.beginPath();
      g.moveTo(40, 0);
      g.lineTo(88, 0);
      g.lineTo(64, 78);
      g.closePath();
      g.fill();
      g.strokeStyle = shade(o.jacket, -0.35);
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(36, 0);
      g.lineTo(64, 84);
      g.lineTo(92, 0);
      g.stroke();
      if (o.tie) {
        g.fillStyle = o.tie;
        g.beginPath();
        g.moveTo(58, 4);
        g.lineTo(70, 4);
        g.lineTo(73, 60);
        g.lineTo(64, 72);
        g.lineTo(55, 60);
        g.closePath();
        g.fill();
      }
      g.fillStyle = shade(o.jacket, -0.3);
      g.beginPath();
      g.arc(64, 96, 4, 0, Math.PI * 2);
      g.arc(64, 112, 4, 0, Math.PI * 2);
      g.fill();
    });
    return { face, shirt };
  }, [o]);
}

/** One blocky figure, `H` tall, standing on its feet at the origin, facing +Z. */
function BlockFigure({ H, outfit }: { H: number; outfit: Outfit }) {
  const tex = useFigureTextures(outfit);
  const o = outfit;
  const legH = H * 0.36;
  const torsoH = H * 0.36;
  const headH = H * 0.22;
  const tw = H * 0.4;
  const td = H * 0.2;
  const limb = H * 0.19;
  const mat = (color: string) =>
    o.metal ? <meshStandardMaterial color={color} metalness={0.75} roughness={0.32} /> : <meshPhysicalMaterial color={color} roughness={0.5} clearcoat={0.08} />;
  const rad = H * 0.018;
  const headY = legH + torsoH + headH / 2 + H * 0.004;
  return (
    <group>
      {/* legs */}
      {[-1, 1].map((s) => (
        <RoundedBox key={`l${s}`} args={[limb * 0.98, legH, td * 0.95]} radius={rad} smoothness={2} position={[s * limb * 0.52, legH / 2, 0]} castShadow>
          {mat(o.pants)}
        </RoundedBox>
      ))}
      {/* torso */}
      <RoundedBox args={[tw, torsoH, td]} radius={rad} smoothness={2} position={[0, legH + torsoH / 2, 0]} castShadow>
        {mat(o.jacket)}
      </RoundedBox>
      {tex?.shirt && (
        <mesh position={[0, legH + torsoH / 2, td / 2 + 0.0008]}>
          <planeGeometry args={[tw * 0.96, torsoH * 0.96]} />
          <meshStandardMaterial map={tex.shirt} roughness={o.metal ? 0.35 : 0.55} metalness={o.metal ? 0.6 : 0} />
        </mesh>
      )}
      {/* arms, slightly apart, with hands or gloves at the ends */}
      {[-1, 1].map((s) => (
        <group key={`a${s}`} position={[s * (tw / 2 + limb / 2 + H * 0.005), legH + torsoH, 0]} rotation={[0, 0, s * 0.06]}>
          <RoundedBox args={[limb, torsoH * 0.78, td * 0.95]} radius={rad} smoothness={2} position={[0, -torsoH * 0.39, 0]} castShadow>
            {mat(o.jacket)}
          </RoundedBox>
          <RoundedBox args={[limb, torsoH * 0.24, td * 0.95]} radius={rad} smoothness={2} position={[0, -torsoH * 0.89, 0]} castShadow>
            {mat(o.hands)}
          </RoundedBox>
        </group>
      ))}
      {/* head */}
      <RoundedBox args={[H * 0.27, headH, H * 0.25]} radius={rad * 1.6} smoothness={3} position={[0, headY, 0]} castShadow>
        {mat(o.skin)}
      </RoundedBox>
      {tex?.face && (
        <mesh position={[0, headY, H * 0.125 + 0.0008]}>
          <planeGeometry args={[H * 0.25, headH * 0.94]} />
          <meshStandardMaterial map={tex.face} roughness={0.5} metalness={o.metal ? 0.5 : 0} />
        </mesh>
      )}
      <Hair H={H} o={o} y={headY + headH / 2} />
    </group>
  );
}

function Hair({ H, o, y }: { H: number; o: Outfit; y: number }) {
  if (!o.hair) return null;
  const c = <meshPhysicalMaterial color={o.hair} roughness={o.metal ? 0.3 : 0.6} metalness={o.metal ? 0.7 : 0} />;
  if (o.hairStyle === 'spikes') {
    return (
      <group position={[0, y, 0]}>
        <mesh position={[0, H * 0.012, 0]} castShadow>
          <boxGeometry args={[H * 0.28, H * 0.03, H * 0.26]} />
          {c}
        </mesh>
        {[-0.09, -0.03, 0.03, 0.09].map((x, i) => (
          <mesh key={i} position={[x * H, H * 0.07, (i % 2 ? -0.02 : 0.02) * H]} rotation={[0, 0, -x * 2.5]} castShadow>
            <coneGeometry args={[H * 0.04, H * 0.13, 4]} />
            {c}
          </mesh>
        ))}
      </group>
    );
  }
  if (o.hairStyle === 'cap') {
    return (
      <group position={[0, y, 0]}>
        <mesh position={[0, H * 0.03, 0]} castShadow>
          <boxGeometry args={[H * 0.29, H * 0.06, H * 0.27]} />
          {c}
        </mesh>
        <mesh position={[0, H * 0.005, H * 0.16]} castShadow>
          <boxGeometry args={[H * 0.27, H * 0.015, H * 0.1]} />
          {c}
        </mesh>
      </group>
    );
  }
  if (o.hairStyle === 'helmet') {
    return (
      <mesh position={[0, y + H * 0.02, 0]} castShadow>
        <boxGeometry args={[H * 0.06, H * 0.05, H * 0.27]} />
        {c}
      </mesh>
    );
  }
  return (
    <mesh position={[0, y + H * 0.015, -H * 0.01]} castShadow>
      <boxGeometry args={[H * 0.29, H * 0.05, H * 0.27]} />
      {c}
    </mesh>
  );
}

/** Three figures on top and two standing at the base of the cake. */
export function BlockFigures({ top, topY, base, boardY, crowded }: { top: { r: number }; topY: number; base: { r: number; h: number }; boardY: number; crowded: boolean }) {
  const H = Math.max(0.16, Math.min(0.36, top.r * 0.55));
  const Hb = Math.max(0.18, Math.min(0.42, base.h * 0.62));
  const onTop: Array<{ x: number; z: number; turn: number; o: Outfit }> = [
    { x: -top.r * 0.5, z: -top.r * 0.02, turn: 0.35, o: OUTFITS[0]! },
    { x: -top.r * (crowded ? 0.05 : 0.02), z: -top.r * 0.2, turn: 0.05, o: OUTFITS[1]! },
    { x: top.r * (crowded ? 0.1 : 0.45), z: top.r * (crowded ? 0.3 : -0.05), turn: -0.3, o: OUTFITS[2]! },
  ];
  const atBase = [
    { a: -0.95, o: OUTFITS[3]! },
    { a: 0.95, o: OUTFITS[4]! },
  ];
  return (
    <group>
      {onTop.map((f, i) => (
        <group key={i} position={[f.x, topY, f.z]} rotation={[0, f.turn, 0]}>
          <BlockFigure H={H} outfit={f.o} />
        </group>
      ))}
      {atBase.map((f, i) => {
        const d = base.r + Hb * 0.11;
        return (
          <group key={`b${i}`} position={[Math.sin(f.a) * d, boardY, Math.cos(f.a) * d]} rotation={[0, f.a, 0]}>
            <BlockFigure H={Hb} outfit={f.o} />
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------- props

/** A fondant tree, a small gold trophy and a few silver bars on top. */
export function GameProps({ r, y }: { r: number; y: number }) {
  const s = Math.max(0.7, Math.min(1.5, r * 1.9));
  const cup = useMemo(() => {
    const pts = [
      [0.0001, 0], [0.022, 0], [0.022, 0.006], [0.008, 0.01], [0.006, 0.03], [0.01, 0.036], [0.02, 0.05], [0.024, 0.07], [0.022, 0.072], [0.0001, 0.06],
    ].map(([a, b]) => new THREE.Vector2(a, b));
    return new THREE.LatheGeometry(pts, 24);
  }, []);
  useDispose(cup);
  const bars: Array<[number, number, number, number]> = [
    [-0.36, 0.42, 0.6, 0],
    [0.3, 0.55, -0.3, 0.25],
    [0.72, 0.18, 1.1, 0],
    [-0.62, -0.3, 0.2, 0.2],
    [0.05, -0.55, -0.9, 0],
  ];
  const gold = <meshStandardMaterial color="#d4a017" metalness={0.85} roughness={0.25} />;
  return (
    <group>
      {/* tree */}
      <group position={[-r * 0.18, y, -r * 0.6]} scale={s}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.05, 0.24, 0.05]} />
          <meshPhysicalMaterial color="#7a4e2d" roughness={0.75} />
        </mesh>
        {[
          [0, 0.27, 0, 0.065],
          [-0.05, 0.24, 0.02, 0.05],
          [0.05, 0.245, 0.01, 0.052],
          [0.02, 0.3, -0.03, 0.05],
          [-0.03, 0.31, 0.03, 0.045],
        ].map(([x, yy, z, rr], i) => (
          <mesh key={i} position={[x!, yy!, z!]} castShadow>
            <sphereGeometry args={[rr!, 20, 16]} />
            <meshPhysicalMaterial color={i % 2 ? '#3f9d43' : '#35893a'} roughness={0.38} clearcoat={0.3} />
          </mesh>
        ))}
      </group>
      {/* trophy */}
      <group position={[r * 0.5, y, r * 0.36]} scale={s}>
        <mesh position={[0, 0.004, 0]} castShadow>
          <boxGeometry args={[0.03, 0.008, 0.03]} />
          {gold}
        </mesh>
        <mesh geometry={cup} position={[0, 0.008, 0]} castShadow>
          {gold}
        </mesh>
        {[-1, 1].map((k) => (
          <mesh key={k} position={[k * 0.024, 0.06, 0]} rotation={[0, 0, k * 0.2]} castShadow>
            <torusGeometry args={[0.009, 0.0025, 8, 16, Math.PI]} />
            {gold}
          </mesh>
        ))}
      </group>
      {/* bars */}
      {bars.map(([x, z, turn, tilt], i) => (
        <RoundedBox key={i} args={[0.1 * s, 0.022 * s, 0.032 * s]} radius={0.006 * s} smoothness={2} position={[x * r, y + 0.011 * s + tilt * 0.02, z * r]} rotation={[0, turn, tilt]} castShadow>
          <meshStandardMaterial color="#aeb3ba" metalness={0.55} roughness={0.35} />
        </RoundedBox>
      ))}
    </group>
  );
}
