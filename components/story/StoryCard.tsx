"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Story } from "@/types/story";
import { createAndEnterSession } from "./createAndEnterSession";

/**
 * 홈 스토리 목록의 카드 한 칸. components/CharacterCard.tsx의 그리드 카드 레이아웃을
 * 참고했다. 클릭하면 항상 새 StorySession을 만들고(기존 세션 자동 재사용 안 함) 그
 * 세션으로 이동한다 — "새로운 Story 시작"의 유일한 진입점.
 */
export function StoryCard({ story }: { story: Story }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // components/Avatar.tsx와 동일한 패턴: coverImage가 지정돼 있어도 파일이 실제로
  // 없거나 로드에 실패하면 onError로 감지해 이모지로 폴백한다.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(story.coverImage) && !imageFailed;

  const handleClick = async () => {
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
    <button
      type="button"
      onClick={handleClick}
      disabled={starting}
      className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-neutral-100 text-3xl">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.coverImage}
            alt={story.title}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span aria-hidden>{starting ? "…" : "📖"}</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2.5">
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          {story.genre}
        </span>
        <p className="truncate text-sm font-semibold text-neutral-900">{story.title}</p>
        <p className="line-clamp-2 text-xs text-neutral-500">{story.description}</p>
        {error && <p className="text-[11px] text-rose-500">{error}</p>}
      </div>
    </button>
  );
}
