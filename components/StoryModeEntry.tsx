"use client";

import Link from "next/link";

/**
 * 홈 화면에서 Story Mode(/story)로 진입하는 버튼. 별도 컴포넌트로 분리해둔 이유:
 * 향후 "채팅/스토리 탭" UI로 바꿀 때 이 컴포넌트만 탭 바 컴포넌트로 교체하면 되고,
 * HomeScreen.tsx 본문(캐릭터 그리드/스포트라이트) 로직은 다시 건드릴 필요가 없다.
 */
export function StoryModeEntry() {
  return (
    <Link
      href="/story"
      className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-gradient-to-r from-neutral-50 to-white px-4 py-3 text-left shadow-sm transition-transform active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-lg text-white">
          📖
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">스토리 모드</p>
          <p className="text-xs text-neutral-500">인터랙티브 소설을 플레이해보세요</p>
        </div>
      </div>
      <span className="text-neutral-400" aria-hidden>
        ›
      </span>
    </Link>
  );
}
