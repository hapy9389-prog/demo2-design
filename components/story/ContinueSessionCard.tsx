import Link from "next/link";
import { StorySessionSummary } from "@/types/story";
import { formatRelativeKorean } from "@/lib/storyFormat";

/**
 * 홈 화면 "이어서 하기" 섹션 — 전체 세션 중 updatedAt이 가장 최신인 것 하나만 보여준다.
 * 이미 존재하는 세션으로 이동만 하는 단순 링크라 세션을 새로 만들지 않는다
 * (StoryCard/StorySessionMissing의 "새로 시작"과는 다른 경로).
 */
export function ContinueSessionCard({ session }: { session: StorySessionSummary }) {
  return (
    <Link
      href={`/story/${session.storyId}?sessionId=${session.sessionId}`}
      className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-gradient-to-r from-amber-50 to-white px-4 py-3 shadow-sm transition-transform active:scale-[0.98]"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-amber-600">
          이어서 하기
        </p>
        <p className="truncate text-sm font-semibold text-neutral-900">
          {session.storyTitle}
        </p>
        <p className="truncate text-xs text-neutral-500">
          마지막 플레이: {formatRelativeKorean(session.updatedAt)}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white">
        계속하기
      </span>
    </Link>
  );
}
