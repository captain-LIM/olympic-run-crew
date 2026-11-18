"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadUnlocked } from "@/lib/profile";
import { SOURCE_DOWNLOAD_BASE } from "@/lib/venue3d";
import type { Venue3D, VenueId } from "@/lib/types";

type Status = "idle" | "loading" | "ready" | "error";

/**
 * 카메라 구도용 경계 상자. 방위 표시·대지 경계선처럼 정점은 적은데 멀리 퍼진
 * 보조 요소가 구도를 망치지 않도록, 정점 월드 좌표의 1~99 백분위 범위를 쓴다.
 */
function focusBox(model: THREE.Object3D, maxSamples = 200_000): THREE.Box3 {
  model.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  let total = 0;
  model.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry.attributes.position) {
      meshes.push(o);
      total += o.geometry.attributes.position.count;
    }
  });
  const step = Math.max(1, Math.floor(total / maxSamples));
  const xs: number[] = [], ys: number[] = [], zs: number[] = [];
  const v = new THREE.Vector3();
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      xs.push(v.x); ys.push(v.y); zs.push(v.z);
    }
  }
  if (xs.length < 10) return new THREE.Box3().setFromObject(model);
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  for (const a of [xs, ys, zs]) a.sort((p, q2) => p - q2);
  return new THREE.Box3(
    new THREE.Vector3(q(xs, 0.01), q(ys, 0.005), q(zs, 0.01)),
    new THREE.Vector3(q(xs, 0.99), q(ys, 0.995), q(zs, 0.99)),
  );
}

/**
 * 한국체육산업개발_올림픽공원 공연장 실감형 콘텐츠의 GLB를 meshopt 압축한 모델을 렌더링.
 */
export function VenueViewer({ venues, initial }: { venues: Venue3D[]; initial?: VenueId }) {
  const [venueId, setVenueId] = useState<VenueId>(initial ?? (venues.find((v) => v.modelUrl) ?? venues[0]).venueId);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [unlocked, setUnlocked] = useState<VenueId[]>([]);
  const [cutaway, setCutaway] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ camera: THREE.PerspectiveCamera; controls: OrbitControls; box: THREE.Box3; clip: THREE.Plane } | null>(null);
  const venue = venues.find((v) => v.venueId === venueId) ?? venues[0];

  useEffect(() => setUnlocked(loadUnlocked()), []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !venue.modelUrl) {
      setStatus("idle");
      return;
    }
    let disposed = false;
    setStatus("loading");
    setProgress(0);
    setCutaway(false);

    const w = mount.clientWidth;
    const h = Math.round(w * 0.7);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.localClippingEnabled = true;
    mount.appendChild(renderer.domElement);
    // 단면 보기: y <= constant 인 부분만 남긴다 (기본은 비활성)
    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), Infinity);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f172a");
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(1, 2, 1);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      venue.modelUrl,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        scene.add(model);
        const box = focusBox(model);
        model.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.clippingPlanes = [clip];
        });
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());
        // 경계 구가 화면(세로 시야각 기준)에 들어오도록 거리 계산
        const dist = (size / 2) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.max(1, 1 / camera.aspect) * 0.75;
        camera.position.copy(center).add(new THREE.Vector3(1, 0.75, 1).normalize().multiplyScalar(dist));
        camera.near = size / 1000;
        camera.far = size * 10;
        camera.updateProjectionMatrix();
        controls.target.copy(center);
        ctx.current = { camera, controls, box, clip };
        setStatus("ready");
      },
      (e) => !disposed && e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      () => !disposed && setStatus("error"),
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, [venue]);

  /** 지붕을 잘라 내부를 보여주는 단면 보기 */
  function setCut(on: boolean) {
    const c = ctx.current;
    if (!c) return;
    c.clip.constant = on ? c.box.min.y + (c.box.max.y - c.box.min.y) * 0.45 : Infinity;
    setCutaway(on);
  }

  /** 완주 보상: 지붕을 열고 객석 위에서 플로어(무대)를 내려다보는 시점 */
  function stageView() {
    const c = ctx.current;
    if (!c) return;
    setCut(true);
    const center = c.box.getCenter(new THREE.Vector3());
    const size = c.box.getSize(new THREE.Vector3());
    c.camera.position.set(center.x, c.box.min.y + size.y * 0.7, center.z + size.z * 0.32);
    c.controls.target.set(center.x, c.box.min.y + size.y * 0.05, center.z - size.z * 0.05);
  }

  const isUnlocked = unlocked.includes(venue.venueId);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {venues.map((v) => (
          <button key={v.venueId} onClick={() => setVenueId(v.venueId)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${v.venueId === venue.venueId ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white"}`}>
            {unlocked.includes(v.venueId) ? "🔓 " : ""}{v.venueName}
          </button>
        ))}
      </div>

      <div className="relative min-h-48 overflow-hidden rounded-2xl bg-slate-900">
        <div ref={mountRef} className="w-full [&>canvas]:block [&>canvas]:w-full" />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-200">
            {status === "loading" && `3D 모델 불러오는 중… ${progress}%`}
            {status === "error" && "모델을 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}
            {status === "idle" && (
              <span>
                <b>{venue.venueName}</b>의 실감형 콘텐츠는 {venue.files.map((f) => f.ext).join("·")} 원본만 제공돼요.<br />
                원본 용량이 커서 웹 미리보기는 지원하지 않아요. 아래에서 원본을 내려받을 수 있어요.
              </span>
            )}
          </div>
        )}
      </div>

      {venue.modelUrl && (
        <button
          onClick={() => setCut(!cutaway)}
          disabled={status !== "ready"}
          className="w-full rounded-xl border border-slate-300 bg-white py-3 font-semibold disabled:opacity-40"
        >
          {cutaway ? "🏟️ 외관 보기" : "🔍 지붕 열고 내부 보기"}
        </button>
      )}
      {venue.modelUrl && (
        <button
          onClick={stageView}
          disabled={!isUnlocked || status !== "ready"}
          className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white disabled:bg-slate-300 disabled:text-slate-600"
        >
          {isUnlocked ? "🎤 객석에서 무대 바라보기" : "🔒 이 공연장 크루를 완주하면 '무대 시점'이 열려요"}
        </button>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold">원본 실감형 콘텐츠 ({venue.category})</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {venue.files.map((f) => (
            <li key={f.fileName}>
              <a href={`${SOURCE_DOWNLOAD_BASE}${f.fileName}`} className="inline-block rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:border-violet-500" rel="noopener">
                {f.ext} · {f.fileName}
              </a>
            </li>
          ))}
        </ul>
        <a href={venue.homepage} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-violet-700 underline">공연장 안내 페이지 →</a>
      </section>
      <p className="text-xs text-slate-500">드래그로 회전, 휠·핀치로 확대할 수 있어요. 출처: 한국체육산업개발(주) 올림픽공원 공연장 실감형 콘텐츠 (웹 표시용으로 압축)</p>
    </div>
  );
}
