"use client";

import { useEffect, useRef, useState } from "react";
import { MODE_LABEL } from "@/lib/matching";
import { formatKstDate, kstDateString } from "@/lib/time";
import type { Course, Crew } from "@/lib/types";

const W = 1080;
const H = 1350;
const FONT = '"SUIT Variable", "Malgun Gothic", sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) {
      lines.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + "…";
  }
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** 완주 기록 카드. 닉네임·연락처 없이 공연·코스·거리·인원만 담아 이미지로 저장/공유한다. */
export function RecordCard({ crew, course, eventTitle }: { crew: Pick<Crew, "mode" | "paceMinPerKm" | "startAt" | "eventStartAt"> & { memberCount: number }; course: Course; eventTitle: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { await document.fonts.load(`800 60px "SUIT Variable"`); } catch { /* 기본 글꼴 사용 */ }
      const mascot = await loadImage("/mascot/cheer.png");
      const canvas = canvasRef.current;
      if (!alive || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#7fc8fb");
      g.addColorStop(0.55, "#d9efff");
      g.addColorStop(1, "#ffffff");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#14213f";
      ctx.textBaseline = "alphabetic";
      ctx.font = `700 40px ${FONT}`;
      ctx.fillText("공연 전 한 바퀴", 80, 130);

      ctx.font = `800 64px ${FONT}`;
      wrap(ctx, eventTitle, W - 160, 2).forEach((l, i) => ctx.fillText(l, 80, 270 + i * 82));

      ctx.fillStyle = "#1747c9";
      ctx.font = `800 260px ${FONT}`;
      ctx.fillText(String(course.distanceKm), 80, 700);
      const kmW = ctx.measureText(String(course.distanceKm)).width;
      ctx.font = `800 80px ${FONT}`;
      ctx.fillText("km", 80 + kmW + 20, 700);

      ctx.fillStyle = "#14213f";
      ctx.font = `700 46px ${FONT}`;
      ctx.fillText(`${course.name} · ${MODE_LABEL[crew.mode]}`, 80, 790);
      ctx.font = `500 40px ${FONT}`;
      ctx.fillText(`${formatKstDate(kstDateString(new Date(crew.eventStartAt)))} 공연 전`, 80, 860);
      ctx.fillText(`크루 ${crew.memberCount}명 · ${crew.paceMinPerKm}분/km`, 80, 920);

      if (mascot) {
        const h = 300;
        const w = (mascot.width / mascot.height) * h;
        ctx.drawImage(mascot, W - w - 60, H - h - 110, w, h);
      }
      ctx.fillStyle = "#14213f";
      ctx.font = `700 34px ${FONT}`;
      ctx.fillText("오늘도 공연 전에 한 바퀴 완주!", 80, H - 90);
    })();
    return () => { alive = false; };
  }, [crew, course, eventTitle]);

  function toBlob(): Promise<Blob | null> {
    return new Promise((res) => canvasRef.current?.toBlob(res, "image/png") ?? res(null));
  }

  async function save() {
    const blob = await toBlob();
    if (!blob) return setNote("이미지를 만들지 못했어요.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "공연전한바퀴-기록.png";
    a.click();
    URL.revokeObjectURL(a.href);
    setNote("이미지를 저장했어요.");
  }

  async function share() {
    const blob = await toBlob();
    if (!blob) return setNote("이미지를 만들지 못했어요.");
    const file = new File([blob], "공연전한바퀴-기록.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: "공연 전 한 바퀴 완주!" });
      else await save();
    } catch { /* 공유 취소 */ }
  }

  return (
    <section className="cell stack-sm" aria-label="완주 기록 카드">
      <h2 className="t-cell">오늘의 기록 카드</h2>
      <canvas ref={canvasRef} width={W} height={H} className="mx-auto block w-full max-w-sm rounded-2xl border border-rule" role="img" aria-label={`${eventTitle} 전 ${course.name} ${course.distanceKm}km 완주 기록`} />
      <div className="grid grid-cols-2 gap-3">
        <button onClick={save} className="btn">이미지 저장</button>
        <button onClick={share} className="btn btn--solid">공유하기</button>
      </div>
      {note && <p role="status" className="small">{note}</p>}
      <p className="small">닉네임과 연락처는 카드에 들어가지 않아요.</p>
    </section>
  );
}
