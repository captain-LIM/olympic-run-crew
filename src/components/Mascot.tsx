import Image from "next/image";

/** 마스코트 시트(public/mascot)에서 잘라낸 포즈. 크기는 잘라낸 원본 픽셀. */
const POSES = {
  hero: { w: 1100, h: 589 }, // 폰을 들고 올림픽공원을 달리는 메인 장면 (배경 포함)
  cheer: { w: 327, h: 307 }, // 야광봉 응원
  phone: { w: 301, h: 306 }, // 폰으로 확인
  run: { w: 335, h: 304 }, // 달리기
  rest: { w: 335, h: 272 }, // 잔디밭에서 휴식
  concert: { w: 292, h: 265 }, // 공연장 뒷모습
  peek: { w: 280, h: 268 }, // 기둥 뒤에서 빼꼼
} as const;

export type MascotPose = keyof typeof POSES;

/** 장식용 이미지라 대체 텍스트는 비워 두고 스크린리더에서 숨긴다. */
export function Mascot({ pose, className, sizes, priority = false }: { pose: MascotPose; className?: string; sizes?: string; priority?: boolean }) {
  const { w, h } = POSES[pose];
  return (
    <Image
      src={`/mascot/${pose}.png`}
      width={w}
      height={h}
      alt=""
      aria-hidden="true"
      priority={priority}
      sizes={sizes}
      draggable={false}
      className={`pointer-events-none h-auto select-none ${className ?? ""}`}
    />
  );
}
