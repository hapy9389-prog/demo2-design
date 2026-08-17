"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MemoryListItem } from "@/types";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; memories: MemoryListItem[] };

const SOURCE_LABEL: Record<"chat" | "story" | "manual", string> = {
  chat: "Chat",
  story: "Story",
  manual: "직접 추가",
};

const MANUAL_MEMORY_MAX_LENGTH = 300;

/**
 * 클릭 가능한 별 5개. 기존 카드의 importance 변경(PATCH)과 추가 폼의 importance
 * 선택(로컬 state) 양쪽에서 재사용한다. n번째 별 클릭 -> onRate(n).
 */
function StarPicker({
  value,
  onRate,
  disabled,
}: {
  value: number;
  onRate: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`중요도 ${n}`}
          onClick={() => onRate(n)}
          className="leading-none text-amber-400 disabled:opacity-40"
        >
          {n <= value ? "★" : "☆"}
        </button>
      ))}
    </span>
  );
}

/**
 * 항상 날짜만 보여준다("8월 16일"), 시:분은 포함하지 않는다. lib/time.ts의
 * formatReminderTime()과 의도적으로 분리된 별도 구현 — lib/time.ts는 import 시
 * side effect가 있는 모듈이라 단순 날짜 표시를 위해 여기서 끌어오지 않는다.
 */
function formatMemoryDate(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * Shared Memory 목록 바텀시트(읽기 전용). 부모(폰 프레임 body)가 `relative`여야 이 안에서
 * `absolute inset-0`이 브라우저 전체가 아니라 폰 화면 안에서만 덮인다.
 *
 * ReminderPanel과 달리 이 컴포넌트는 `open` prop으로 스스로를 숨기지 않는다 — 부모
 * (ChatApp)가 열려 있을 때만 조건부로 마운트한다. 그래서 "닫힘"은 곧 unmount이고,
 * unmount는 state를 통째로 버리고 진행 중이던 fetch의 응답도 자연히 무시하게 만든다
 * (같은 인스턴스가 남아있는 채로 setState를 동기 호출해 "idle로 리셋"하는 방식은
 * react-hooks/set-state-in-effect 린트 규칙과 충돌해 피했다). 다음에 다시 열리면
 * 완전히 새 인스턴스가 마운트되므로 이전 캐릭터의 데이터/로딩 잔상이 보일 수 없다.
 * 열릴 때(=마운트될 때)마다 `characterId` 기준으로 GET /api/memories를 새로 호출한다 —
 * ChatApp의 3초 폴링에는 포함되지 않는다(Memory는 실시간 알림 데이터가 아님).
 */
export function MemoryPanel({
  characterId,
  characterName,
  onClose,
}: {
  characterId: string;
  characterName: string;
  onClose: () => void;
}) {
  // 초기 상태 자체가 "loading"이므로 마운트 시점에 별도로 setState할 필요가 없다
  // (react-hooks/set-state-in-effect가 effect 내부의 동기 setState 호출을 금지하므로,
  // effect 본문에서는 fetch를 "시작"만 하고 결과 반영은 항상 .then/.catch 콜백 안에서만
  // 한다 — 이 콜백들은 진짜 비동기이므로 규칙 대상이 아니다).
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // 현재 유효한 요청만 state에 반영하기 위한 토큰. characterId가 바뀌면(이론상으로만
  // 가능 - 패널이 열려 있는 동안은 배경 클릭이 전체를 덮어 캐릭터 전환이 불가능하지만,
  // 방어적으로 대비한다) 토큰을 새로 발급해 이전 요청의 응답을 무시한다.
  const requestTokenRef = useRef(0);

  // Memory Manager(CRUD) 상태. 전부 이 컴포넌트 로컬 state로만 관리한다 — 별도 상태
  // 관리 라이브러리나 optimistic UI 없이, mutation은 항상 "성공 -> runFetch()로 재조회"
  // 패턴을 쓴다(패널 규모가 작아 optimistic UI의 복잡도가 이득보다 크다는 판단).
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addContent, setAddContent] = useState("");
  const [addImportance, setAddImportance] = useState(3);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const runFetch = useCallback(() => {
    const myToken = ++requestTokenRef.current;
    fetch(`/api/memories?characterId=${encodeURIComponent(characterId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (requestTokenRef.current !== myToken) return; // stale 응답 무시
        if (!res.ok) {
          setState({ status: "error", message: data.error || "기억을 불러오지 못했습니다." });
          return;
        }
        setState({ status: "success", memories: data.memories ?? [] });
      })
      .catch(() => {
        if (requestTokenRef.current !== myToken) return;
        setState({ status: "error", message: "기억을 불러오지 못했습니다." });
      });
  }, [characterId]);

  useEffect(() => {
    runFetch();
    // unmount(=패널 닫힘) 시 진행 중이던 요청을 무효화한다 — 늦게 도착하는 응답이
    // (이미 사라진) 이전 인스턴스의 state를 갱신하는 일은 React가 알아서 막아주지만,
    // 명시적으로 토큰을 무효화해 의도를 분명히 한다.
    const tokenRef = requestTokenRef;
    return () => {
      tokenRef.current++;
    };
  }, [characterId, runFetch]);

  // 재시도 버튼: effect 밖(클릭 이벤트 핸들러)에서 호출되므로 동기 setState가 허용된다.
  const handleRetry = useCallback(() => {
    setState({ status: "loading" });
    runFetch();
  }, [runFetch]);

  // 헤더 새로고침 버튼: 재시도와 달리 로딩 화면으로 갈아엎지 않고 목록을 그대로 둔 채
  // 조용히 다시 불러온다 — 자동 Story Memory 생성처럼 패널을 열어둔 사이 서버 상태가
  // 바뀌었을 수 있는 경우를 사용자가 수동으로 확인하기 위한 용도(별도 polling 없음).
  const handleRefresh = useCallback(() => {
    setActionError(null);
    runFetch();
  }, [runFetch]);

  const handleRate = useCallback(
    async (memoryId: string, importance: number) => {
      setActionError(null);
      setMutatingId(memoryId);
      try {
        const res = await fetch(`/api/memories/${memoryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId, importance }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "중요도를 변경하지 못했습니다.");
        runFetch();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "중요도를 변경하지 못했습니다.");
      } finally {
        setMutatingId(null);
      }
    },
    [characterId, runFetch]
  );

  const handleDeleteClick = useCallback((memoryId: string) => {
    setActionError(null);
    setConfirmingDeleteId(memoryId);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setConfirmingDeleteId(null);
  }, []);

  const handleDeleteConfirm = useCallback(
    async (memoryId: string) => {
      setActionError(null);
      setMutatingId(memoryId);
      try {
        const res = await fetch(`/api/memories/${memoryId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "기억을 삭제하지 못했습니다.");
        setConfirmingDeleteId(null);
        runFetch();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "기억을 삭제하지 못했습니다.");
      } finally {
        setMutatingId(null);
      }
    },
    [characterId, runFetch]
  );

  const handleAddSubmit = useCallback(async () => {
    const trimmed = addContent.trim();
    if (!trimmed) {
      setAddError("기억 내용을 입력해주세요.");
      return;
    }
    setAddError(null);
    setAddSubmitting(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, content: trimmed, importance: addImportance }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "기억을 추가하지 못했습니다.");
      setAddContent("");
      setAddImportance(3);
      setShowAddForm(false);
      runFetch();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "기억을 추가하지 못했습니다.");
    } finally {
      setAddSubmitting(false);
    }
  }, [addContent, addImportance, characterId, runFetch]);

  const handleAddCancel = useCallback(() => {
    setShowAddForm(false);
    setAddContent("");
    setAddImportance(3);
    setAddError(null);
  }, []);

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/30"
      />
      <div className="relative z-10 flex max-h-[70%] animate-sheet-up flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-neutral-200" />
        <div className="flex items-start justify-between border-b border-violet-100 bg-violet-50/40 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-violet-700">
              🧠 {characterName}의 기억
            </h2>
            <p className="mt-0.5 text-xs text-violet-600/70">
              {characterName}가 기억하고 있는 중요한 내용이에요.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={handleRefresh}
              aria-label="새로고침"
              title="새로고침"
              className="text-neutral-400 hover:text-neutral-600"
            >
              ↻
            </button>
            <button onClick={onClose} aria-label="닫기" className="text-neutral-400 hover:text-neutral-600">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {state.status === "loading" && (
            <p className="mt-6 text-center text-xs text-neutral-400">기억을 불러오는 중...</p>
          )}

          {state.status === "error" && (
            <div className="mt-6 text-center text-xs">
              <p className="text-red-500">{state.message}</p>
              <button
                onClick={handleRetry}
                className="mt-2 font-medium text-violet-600 hover:text-violet-800"
              >
                다시 시도
              </button>
            </div>
          )}

          {state.status === "success" && (
            <>
              {actionError && (
                <p className="rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-600">
                  {actionError}
                </p>
              )}

              {state.memories.length === 0 && !showAddForm && (
                <p className="mt-6 text-center text-xs leading-relaxed text-neutral-400">
                  아직 특별히 기억하고 있는 내용이 없어요.
                  <br />
                  <br />
                  대화를 나누거나 함께 Story를 경험하면
                  <br />
                  중요한 기억이 이곳에 쌓입니다.
                </p>
              )}

              {state.memories.map((m) => {
                const isMutating = mutatingId === m.id;
                const isConfirming = confirmingDeleteId === m.id;
                return (
                  <div
                    key={m.id}
                    className="animate-message-in rounded-xl border border-neutral-200 p-3 text-xs"
                  >
                    <p className="text-neutral-800">{m.content}</p>

                    {isConfirming ? (
                      <div className="mt-1.5 flex items-center justify-between text-neutral-500">
                        <span>정말 삭제할까요?</span>
                        <span className="flex gap-2">
                          <button
                            onClick={handleDeleteCancel}
                            disabled={isMutating}
                            className="font-medium text-neutral-500 hover:text-neutral-700 disabled:opacity-40"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => handleDeleteConfirm(m.id)}
                            disabled={isMutating}
                            className="font-medium text-red-500 hover:text-red-700 disabled:opacity-40"
                          >
                            {isMutating ? "삭제 중..." : "삭제"}
                          </button>
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-neutral-400">
                          {SOURCE_LABEL[m.source.type]} ·{" "}
                          <StarPicker
                            value={m.importance}
                            disabled={isMutating}
                            onRate={(n) => handleRate(m.id, n)}
                          />
                        </span>
                        <button
                          onClick={() => handleDeleteClick(m.id)}
                          disabled={isMutating}
                          className="font-medium text-red-500 hover:text-red-700 disabled:opacity-40"
                        >
                          삭제
                        </button>
                      </div>
                    )}

                    <p className="mt-0.5 text-neutral-400">
                      {formatMemoryDate(new Date(m.updatedAt))} 갱신
                    </p>
                  </div>
                );
              })}

              {state.memories.length > 0 && (
                <p className="pt-1 text-center text-[11px] text-neutral-400">
                  총 {state.memories.length}개의 기억
                </p>
              )}

              {showAddForm ? (
                <div className="animate-message-in rounded-xl border border-violet-200 bg-violet-50/30 p-3 text-xs">
                  <textarea
                    value={addContent}
                    onChange={(e) => setAddContent(e.target.value)}
                    maxLength={MANUAL_MEMORY_MAX_LENGTH}
                    rows={3}
                    placeholder="기억할 내용을 적어주세요"
                    disabled={addSubmitting}
                    className="w-full resize-none rounded-lg border border-neutral-300 px-2.5 py-2 text-xs outline-none focus:border-violet-400 disabled:opacity-60"
                  />
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-neutral-400">
                      중요도 <StarPicker value={addImportance} disabled={addSubmitting} onRate={setAddImportance} />
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {addContent.length}/{MANUAL_MEMORY_MAX_LENGTH}
                    </span>
                  </div>
                  {addError && <p className="mt-1.5 text-red-500">{addError}</p>}
                  <div className="mt-2 flex justify-end gap-3">
                    <button
                      onClick={handleAddCancel}
                      disabled={addSubmitting}
                      className="font-medium text-neutral-500 hover:text-neutral-700 disabled:opacity-40"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleAddSubmit}
                      disabled={addSubmitting}
                      className="font-medium text-violet-600 hover:text-violet-800 disabled:opacity-40"
                    >
                      {addSubmitting ? "추가 중..." : "추가"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full rounded-xl border border-dashed border-violet-200 py-2.5 text-xs font-medium text-violet-600 hover:bg-violet-50/50"
                >
                  + 기억 추가
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
