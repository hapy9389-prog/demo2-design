"use client";

import { ReminderWithCharacter } from "@/types";
import { HomeRow, SpotlightPick } from "@/lib/homeStatus";
import { StoryModeEntry } from "./StoryModeEntry";
import { CharacterCard } from "./CharacterCard";
import { HomeReminderSummary } from "./HomeReminderSummary";
import { HomeHero } from "./HomeHero";

export type { HomeRow };

/**
 * 홈 화면. 헤더(고정) + 스크롤 영역(Hero → 리마인더 요약 → 캐릭터 레일 → Story 티저)으로
 * 구성된 오케스트레이터. 캐릭터 "상태" 판단은 여기서 하지 않고 lib/homeStatus.ts에 맡긴다.
 *
 * "Modern Character Entertainment App" 2차 리디자인에서 섹션 순서를 재배치했다: Story
 * 진입부는 더 이상 최상단이 아니라 캐릭터 레일 아래(맨 끝)로 옮겨서, 스크롤 끝에서 "다른
 * 분위기의 문"처럼 마무리되게 한다. 박스/구분선 대신 섹션 간 여백 자체가 구획 역할을 한다.
 */
export function HomeScreen({
  rows,
  spotlight,
  reminders,
  pendingReminderCount,
  bellPulseTick,
  onSelect,
  onOpenReminders,
}: {
  rows: HomeRow[];
  /** Hero에 띄울 캐릭터. 캐릭터가 하나도 없을 때만 null(현재 앱에서는 발생하지 않음). */
  spotlight: SpotlightPick | null;
  reminders: ReminderWithCharacter[];
  pendingReminderCount: number;
  /** 리마인더/proactive 메시지가 도착할 때마다 증가 — bell 아이콘 강조 애니메이션 재생용. */
  bellPulseTick: number;
  onSelect: (characterId: string) => void;
  onOpenReminders: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-paper-sunken px-4 py-4">
        <h1 className="text-lg font-bold text-ink">AI 캐릭터 채팅</h1>
        <button
          onClick={onOpenReminders}
          aria-label="리마인더 목록 열기"
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-seal-soft text-lg text-seal transition-opacity hover:opacity-80"
        >
          <span
            key={bellPulseTick}
            className={bellPulseTick > 0 ? "inline-block animate-bell-ring" : "inline-block"}
          >
            🔔
          </span>
          {pendingReminderCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-seal px-1 text-[10px] font-semibold text-white">
              {pendingReminderCount}
            </span>
          )}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pb-4">
        {spotlight && (
          <div className="px-4 pt-6">
            <HomeHero pick={spotlight} onSelect={onSelect} />
          </div>
        )}

        <div className="mt-8">
          <HomeReminderSummary reminders={reminders} onOpenReminders={onOpenReminders} />
        </div>

        <p className="px-4 pb-2 pt-8 text-xs font-medium uppercase tracking-wide text-ink-soft">
          캐릭터
        </p>
        <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2">
          {rows.map((row) => (
            <CharacterCard key={row.character.id} row={row} onSelect={onSelect} />
          ))}
        </div>

        <div className="mt-10">
          <StoryModeEntry />
        </div>
      </div>
    </div>
  );
}
