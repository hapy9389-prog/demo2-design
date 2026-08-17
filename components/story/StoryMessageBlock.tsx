import { StoryMessage } from "@/types/story";

/**
 * 인터랙티브 소설 화면의 메시지 블록. 카톡형 말풍선(components/MessageBubble.tsx)과
 * 시각적으로 명확히 구분한다 — 사용자 입력은 인용 스타일 한 줄로, AI 응답은 여러 문단을
 * 그대로 읽기 좋은 프로즈로 보여준다.
 */
export function StoryMessageBlock({ message }: { message: StoryMessage }) {
  if (message.role === "user") {
    return (
      <p className="animate-message-in border-l-2 border-neutral-300 pl-3 text-sm italic text-neutral-500">
        {message.content}
      </p>
    );
  }

  const paragraphs = message.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="animate-message-in space-y-3 text-[15px] leading-7 text-neutral-800">
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
