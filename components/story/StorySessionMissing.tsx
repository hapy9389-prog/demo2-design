"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Story } from "@/types/story";
import { createAndEnterSession } from "./createAndEnterSession";

/**
 * `/story/[storyId]`에 sessionId 없이(또는 존재하지 않는/다른 스토리의 sessionId로)
 * 들어왔을 때 보여주는 안내 화면. 페이지 렌더링(GET) 시점에는 절대 세션을 만들지 않고,
 * 사용자가 여기서 "새로 시작"을 직접 눌러야만 세션이 생긴다 — StoryCard.tsx와 똑같이
 * createAndEnterSession()을 통해서만 세션을 만든다.
 */
export function StorySessionMissing({ story }: { story: Story }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const url = await createAndEnterSession(story.id);
      router.push(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
      setStarting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-neutral-200 px-3 py-3">
        <Link
          href="/story"
          aria-label="스토리 목록으로"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-neutral-600 hover:bg-neutral-100"
        >
          ‹
        </Link>
        <p className="truncate font-semibold text-neutral-900">{story.title}</p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-3xl" aria-hidden>
          📖
        </span>
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            열려 있는 세션을 찾을 수 없어요
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            이 링크의 플레이 기록이 없거나 만료됐어요. 새로 시작하거나 스토리 목록으로
            돌아가세요.
          </p>
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {starting ? "시작하는 중..." : "새로 시작"}
          </button>
          <Link
            href="/story"
            className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700"
          >
            스토리 목록으로
          </Link>
        </div>
      </div>
    </div>
  );
}
