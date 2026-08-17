/**
 * 리마인더 등록 확인을 위한 인라인 시스템 표시. 일반 대화(좌/우 정렬)와 확연히
 * 구분되도록 가운데 정렬하되, 카드/박스 크롬 없이 조용한 여백 노트처럼 보여준다 —
 * 채팅 스크롤 안에 영구히 남는다(임시 배너와 달리 사라지지 않음).
 * 클라이언트 state 기반이라 새로고침하면 사라진다 — MVP에서는 허용된 트레이드오프.
 */
export function ReminderSystemCard({
  content,
  timeLabel,
}: {
  content: string;
  timeLabel: string;
}) {
  return (
    <div className="flex animate-message-in justify-center px-6 py-1">
      <div className="max-w-[85%] text-center text-[11px] leading-relaxed">
        <p className="font-medium text-seal">🔔 리마인더 등록됨</p>
        <p className="mt-0.5 text-ink-soft">
          {content} · {timeLabel}
        </p>
      </div>
    </div>
  );
}
