import { ReactNode } from "react";
import { formatKoreanTime } from "@/lib/time";
import { Character, Message } from "@/types";
import { Avatar } from "./Avatar";

/**
 * "**text**"만 안전하게 <strong>으로 바꾸는 최소 parser. 전체 Markdown을 지원하지
 * 않고 bold 하나만 처리한다(대형 markdown 라이브러리를 추가하지 않기 위함).
 * dangerouslySetInnerHTML을 쓰지 않고 React 엘리먼트/문자열 배열만 반환한다.
 * 닫히지 않은 `**`는 정규식이 매치하지 않으므로 안전하게 원본 텍스트로 남는다.
 *
 * `.+?`(줄바꿈 제외, non-greedy)를 쓴다 — `[^*]+?`처럼 내부에 `*` 문자가 하나라도
 * 있으면 매칭 자체가 깨지는 방식보다 단순하고 안전하다. `**`로 닫히기만 하면 되므로
 * "**A*B**"도 정상 처리된다. `s` 플래그(dotAll)는 의도적으로 넣지 않는다 — `.`이
 * 줄바꿈을 넘지 않으므로 한 bold 구간이 여러 문단에 걸쳐 잘못 이어붙는 것을
 * 구조적으로 막아준다(행동 묘사는 원래 짧은 한 줄이어야 하므로 이 제약이 자연스럽다).
 */
function renderAssistantContent(text: string): ReactNode[] {
  const parts = text.split(/(\*\*.+?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-neutral-600">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export function MessageBubble({
  message,
  character,
}: {
  message: Message;
  character: Character;
}) {
  const isUser = message.role === "user";
  const isReminder = message.origin === "reminder";
  const time = formatKoreanTime(new Date(message.createdAt));

  return (
    <div
      className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"} ${
        isReminder ? "animate-message-in-strong" : "animate-message-in"
      }`}
    >
      {!isUser && <Avatar character={character} size="sm" emphasize={isReminder} />}
      <div className={`flex max-w-[75%] flex-col ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "rounded-br-sm bg-rose-500 text-white"
              : "rounded-bl-sm border border-neutral-200 bg-white text-neutral-900"
          }`}
        >
          {!isUser && isReminder && (
            <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-amber-600">
              <span>🔔</span>
              <span>먼저 말을 걸었어요</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">
            {isUser ? message.content : renderAssistantContent(message.content)}
          </p>
        </div>
        <span className="mt-1 px-1 text-[10px] text-neutral-400">{time}</span>
      </div>
    </div>
  );
}
