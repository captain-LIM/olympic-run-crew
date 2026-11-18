"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ColladaLoader } from "three/examples/jsm/loaders/ColladaLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadUnlocked } from "@/lib/profile";
import type { Venue, VenueId } from "@/lib/types";

type Status = "loading" | "ready" | "missing" | "error";

/**
 * 한국체육산업개발_올림픽공원 공연장 실감형 콘텐츠(15127487)의 DAE 파일을 렌더링.
 * 파일은 public/models/<venue.modelFile> 에 둔다.
 */
export function VenueViewer({ venues, initial }: { venues: Venue[]; initial?: VenueId }) {
  const [venueId, setVenueId] = useState<VenueId>(initial ?? venues[0].id);
  const [status, setStatus] = useState<Status>("loading");
  const [unlocked, setUnlocked] = useState<VenueId[]>([]);
  const mountRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{ camera: THREE.PerspectiveCamera; controls: OrbitControls; box: THREE.Box3 } | null>(null);
  const venue = venues.find((v) => v.id === venueId)!;

  useEffect(() => setUnlocked(loadUnlocked()), []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !venue.modelFile) return;
    let disposed = false;
    setStatus("loading");

    const w = mount.clientWidth;
    const h = Math.round(w * 0.65);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f172a");
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
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

    const url = `/models/${venue.modelFile}`;
    fetch(url, { method: "HEAD" })
      .then((r) => {
        if (disposed) return;
        if (!r.ok) return setStatus("missing");
        new ColladaLoader().load(
          url,
          (collada) => {
            if (disposed) return;
            const model = collada.scene;
            scene.add(model);
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3()).length();
            const center = box.getCenter(new THREE.Vector3());
            camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.45, size * 0.6));
            camera.near = size / 1000;
            camera.far = size * 10;
            camera.updateProjectionMatrix();
            controls.target.copy(center);
            ctx.current = { camera, controls, box };
            setStatus("ready");
          },
          undefined,
          () => !disposed && setStatus("error"),
        );
      })
      .catch(() => !disposed && setStatus("missing"));
    loop();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      ctx.current = null;
    };
  }, [venue]);

  /** 완주 보상: 무대 중앙 · 객석 눈높이 시점 */
  function stageView() {
    const c = ctx.current;
    if (!c) return;
    const center = c.box.getCenter(new THREE.Vector3());
    const size = c.box.getSize(new THREE.Vector3());
    c.camera.position.set(center.x, c.box.min.y + size.y * 0.15, center.z + size.z * 0.35);
    c.controls.target.set(center.x, c.box.min.y + size.y * 0.1, center.z - size.z * 0.2);
  }

  const isUnlocked = unlocked.includes(venueId);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {venues.map((v) => (
          <button key={v.id} onClick={() => setVenueId(v.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${v.id === venueId ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white"}`}>
            {unlocked.includes(v.id) ? "🔓 " : ""}{v.name}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-slate-900">
        <div ref={mountRef} className="w-full [&>canvas]:block [&>canvas]:w-full" />
        {status !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-200">
            {status === "loading" && "3D 모델 불러오는 중…"}
            {status === "error" && "모델을 읽지 못했어요. DAE 파일 형식을 확인하세요."}
            {status === "missing" && (
              <span>
                <b>{venue.name}</b> 모델 파일이 아직 없어요.<br />
                공공데이터포털 &lsquo;올림픽공원 공연장 실감형 콘텐츠&rsquo;의 DAE 파일을<br />
                <code className="rounded bg-slate-700 px-1">public/models/{venue.modelFile}</code> 로 저장하세요.
              </span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={stageView}
        disabled={!isUnlocked || status !== "ready"}
        className="w-full rounded-xl bg-violet-600 py-3 font-semibold text-white disabled:bg-slate-300 disabled:text-slate-600"
      >
        {isUnlocked ? "🎤 무대 앞 시점으로 보기" : "🔒 크루 완주 시 '무대 앞 시점' 해금"}
      </button>
      <p className="text-xs text-slate-500">드래그로 회전, 휠·핀치로 확대할 수 있어요. 출처: 한국체육산업개발(주) 올림픽공원 공연장 실감형 콘텐츠</p>
    </div>
  );
}
