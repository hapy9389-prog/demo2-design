import Link from "next/link";
import { StorySessionSummary } from "@/types/story";
import { formatRelativeKorean } from "@/lib/storyFormat";

/** 홈 화면 "내 스토리 기록" 섹션 — 과거 StorySession을 최신순으로 나열한다. */
export function StoryHistoryList({ sessions }: { sessions: StorySessionSummary[] }) {
  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((session) => (
        <Link
          key={session.sessionId}
          href={`/story/${session.storyId}?sessionId=${session.sessionId}`}
          className="flex flex-col gap-0.5 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 shadow-sm transition-transform active:scale-[0.98]"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-neutral-900">
              {session.storyTitle}
            </p>
            <span className="shrink-0 text-[11px] text-neutral-400">
              {formatRelativeKorean(session.updatedAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs text-neutral-500">{session.title}</p>
            <span className="shrink-0 text-[11px] text-neutral-400">
              {session.messageCount}개 메시지
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
