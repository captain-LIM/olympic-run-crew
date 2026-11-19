"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SOURCE_DOWNLOAD_BASE } from "@/lib/venue3d";
import type { Venue3D, VenueId } from "@/lib/types";

type Status = "idle" | "waiting" | "loading" | "ready" | "error";

/** 웹 표시용으로 압축한 모델 용량(MB). public/models 기준 */
const MODEL_MB: Partial<Record<VenueId, number>> = { "kspo-dome": 27, "woori-art-hall": 13, handball: 9, "88-lawn": 5, waterside: 3 };

/** 작은 화면·데이터 절약·느린 회선이면 큰 모델은 탭해야 불러온다 */
function shouldAutoLoad(venueId: VenueId): boolean {
  const mb = MODEL_MB[venueId] ?? 10;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /^(slow-2g|2g|3g)$/.test(conn?.effectiveType ?? "")) return false;
  return mb <= 6 || (mb <= 14 && window.innerWidth >= 768) || window.innerWidth >= 1024;
}

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
export function VenueViewer({ venues, initial, autoStage = false }: { venues: Venue3D[]; initial?: VenueId; autoStage?: boolean }) {
  const [venueId, setVenueId] = useState<VenueId>(initial ?? (venues.find((v) => v.modelUrl) ?? venues[0]).venueId);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [unlocked, setUnlocked] = useState<VenueId[]>([]);
  const [cutaway, setCutaway] = useState(false);
  const [wantLoad, setWantLoad] = useState(autoStage);
  const stagePending = useRef(autoStage);
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ camera: THREE.PerspectiveCamera; controls: OrbitControls; box: THREE.Box3; clip: THREE.Plane } | null>(null);
  const venue = venues.find((v) => v.venueId === venueId) ?? venues[0];

  // 완주 보상은 계정(user_rewards)에 저장된다
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { unlocked?: VenueId[] }) => setUnlocked(d.unlocked ?? []))
      .catch(() => setUnlocked([]));
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !venue.modelUrl) {
      setStatus("idle");
      return;
    }
    if (!wantLoad && !shouldAutoLoad(venue.venueId)) {
      setStatus("waiting");
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
    scene.background = new THREE.Color("#17130f");
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4036, 2));
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
  }, [venue, wantLoad]);

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

  // 해금한 무대 시점 링크로 들어오면 모델이 준비되는 대로 바로 무대 시점으로 보여준다
  useEffect(() => {
    if (status === "ready" && stagePending.current && isUnlocked) {
      stagePending.current = false;
      stageView();
    }
  });

  return (
    <div className="stack-sm">
      <div className="chip-row" role="group" aria-label="공연장 선택">
        {venues.map((v) => (
          <button key={v.venueId} onClick={() => { setVenueId(v.venueId); setWantLoad(false); stagePending.current = false; }} aria-pressed={v.venueId === venue.venueId} className="chip">
            {v.venueName}{unlocked.includes(v.venueId) ? " (해금)" : ""}
          </button>
        ))}
      </div>

      <div className="relative min-h-48 overflow-hidden rounded-[20px] bg-ink">
        <div ref={mountRef} className="w-full [&>canvas]:block [&>canvas]:w-full" />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-paper">
            {status === "waiting" && (
              <span>
                <b>{venue.venueName}</b> 3D 모델은 약 {MODEL_MB[venue.venueId] ?? "?"}MB예요.<br />
                <button onClick={() => setWantLoad(true)} className="btn btn--white mt-4">3D 불러오기</button>
              </span>
            )}
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
          className="btn btn--block"
        >
          {cutaway ? "외관 보기" : "지붕 열고 내부 보기"}
        </button>
      )}
      {venue.modelUrl && (
        <button
          onClick={stageView}
          disabled={!isUnlocked || status !== "ready"}
          className="btn btn--solid btn--block"
        >
          {isUnlocked ? "객석에서 무대 바라보기" : "완주하면 '무대 시점'이 열려요"}
        </button>
      )}

      <section className="cell">
        <h2 className="t-cell">원본 실감형 콘텐츠 ({venue.category})</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {venue.files.map((f) => (
            <li key={f.fileName}>
              <a href={`${SOURCE_DOWNLOAD_BASE}${f.fileName}`} className="tag hover:bg-ink hover:text-paper-3" rel="noopener">
                {f.ext} {f.fileName}
              </a>
            </li>
          ))}
        </ul>
        <a href={venue.homepage} target="_blank" rel="noopener noreferrer" className="lnk mt-4 inline-block text-sm">공연장 안내 페이지</a>
      </section>
      <p className="small">드래그로 회전, 휠·핀치로 확대할 수 있어요. 출처: 한국체육산업개발(주) 올림픽공원 공연장 실감형 콘텐츠 (웹 표시용으로 압축)</p>
    </div>
  );
}
