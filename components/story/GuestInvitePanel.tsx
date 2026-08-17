"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CHARACTERS } from "@/lib/characters";
import { Character } from "@/types";

/**
 * Guest Character 초대/제거 바텀시트. components/ReminderPanel.tsx와 같은 셸 패턴
 * (`absolute inset-0 z-40` 백드롭 + `animate-sheet-up` 시트) — 부모(StoryScreen 루트)가
 * `relative`라 폰 프레임 안에서만 덮인다. 캐릭터 카탈로그(CHARACTERS)는 정적 모듈이라
 * 별도 API 없이 클라이언트에서 바로 읽는다.
 */
export function GuestInvitePanel({
  open,
  currentGuest,
  onClose,
  onInvite,
  onRemove,
}: {
  open: boolean;
  /** 현재 세션에 초대된 게스트(MVP: 최대 1명). 없으면 null. */
  currentGuest: Character | null;
  onClose: () => void;
  onInvite: (characterId: string) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleInvite = async (characterId: string) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onInvite(characterId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "초대에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  const handleRemove = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onRemove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "제거에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/30"
      />
      <div className="relative z-10 flex max-h-[70%] animate-sheet-up flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-800">
            {currentGuest ? "게스트 캐릭터" : "캐릭터 초대"}
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-neutral-400 hover:text-neutral-600"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="px-4 pt-2 text-xs text-rose-500">{error}</p>
        )}

        {currentGuest ? (
          <div className="flex flex-col items-center gap-3 p-6">
            <Avatar character={currentGuest} size="xl" />
            <div className="text-center">
              <p className="font-semibold text-neutral-900">{currentGuest.name}</p>
              <p className="text-xs text-neutral-500">{currentGuest.tagline}</p>
            </div>
            <button
              onClick={handleRemove}
              disabled={pending}
              className="mt-1 rounded-full border border-rose-200 px-4 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 disabled:opacity-50"
            >
              {pending ? "제거하는 중..." : "제거하기"}
            </button>
            <p className="text-center text-[11px] text-neutral-400">
              다른 캐릭터로 바꾸려면 먼저 제거한 뒤 다시 초대해주세요.
            </p>
          </div>
        ) : (
          <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto p-3">
            {CHARACTERS.map((character) => (
              <button
                key={character.id}
                onClick={() => handleInvite(character.id)}
                disabled={pending}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                <Avatar character={character} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {character.name}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{character.tagline}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
