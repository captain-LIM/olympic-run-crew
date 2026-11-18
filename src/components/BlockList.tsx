"use client";

import { useState } from "react";

export function BlockList({ initial }: { initial: { userId: number; nickname: string }[] }) {
  const [blocks, setBlocks] = useState(initial);
  async function unblock(userId: number) {
    const res = await fetch(`/api/blocks/${userId}`, { method: "DELETE" });
    if (res.ok) setBlocks((b) => b.filter((x) => x.userId !== userId));
  }
  if (blocks.length === 0) return <p className="text-sm text-slate-500">차단한 사용자가 없어요.</p>;
  return (
    <ul className="divide-y">
      {blocks.map((b) => (
        <li key={b.userId} className="flex items-center justify-between py-2">
          <span>{b.nickname}</span>
          <button onClick={() => unblock(b.userId)} className="text-sm text-violet-700 underline">차단 해제</button>
        </li>
      ))}
    </ul>
  );
}
