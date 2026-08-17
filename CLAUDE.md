@AGENTS.md
# CLAUDE.md

# Project Overview

이 프로젝트는 Claude API를 사용하는 AI 캐릭터 채팅 웹앱 MVP이다.

현재 Next.js + TypeScript 기반이며 모바일 메신저 형태의 UI를 사용한다.

이 프로젝트의 핵심 목표는 단순한 AI 채팅이 아니라,
캐릭터가 고유한 성격을 유지하면서 현실의 시간 흐름을 인식하고,
사용자와 지속적인 관계를 형성하는 것처럼 느껴지게 만드는 것이다.

현재 단계에서는 production infrastructure보다
기능 검증, 안정성, 캐릭터 몰입감을 우선한다.


---

# 1. Source of Truth

같은 정보를 여러 파일에 중복 정의하지 않는다.

각 영역의 source of truth는 다음과 같다.

- 캐릭터 목록 / 성격 / 말투 / 이미지 / tagline / systemPrompt
  → `lib/characters.ts`

- 리마인더 요청 판별
  → `lib/reminderGuard.ts`

- 날짜 및 리마인더 시간 계산
  → `lib/time.ts`

- 캐릭터와 마지막 대화 이후 경과 시간 계산
  → `lib/interactionTime.ts`

- 메시지 / 리마인더 persistence
  → `lib/store.ts`

- proactive reminder 처리
  → `lib/scheduler.ts`

- 일반 채팅 및 reminder 생성 API 흐름
  → `app/api/chat/route.ts`

- Shared Memory 데이터 모델 / persistence / dedup / retrieval
  → `lib/memoryStore.ts`

- Shared Memory 추출(Chat/Story 각각의 별도 Claude 호출)
  → `lib/memoryClaude.ts`

- Shared Memory를 Claude prompt 문자열로 포맷팅
  → `lib/memoryPrompt.ts`

CLAUDE.md에는 위 파일들의 실제 데이터나 세부 캐릭터 설정을
불필요하게 복제하지 않는다.


---

# 2. Core Architecture Principle

## LLM과 deterministic logic을 분리한다.

Claude에게 시스템 상태나 정확한 계산을 맡기지 않는다.

Claude가 담당하는 것:

- 자연어 이해
- 캐릭터 답변 생성
- 캐릭터 personality 표현
- 리마인더 요청의 구조화된 정보 추출
- 서버가 제공한 시간 정보를 자연스럽게 표현

서버 코드가 담당하는 것:

- 현재 시각 확인
- 날짜 계산
- triggerAt 계산
- 경과 시간 계산
- 날짜 유효성 검사
- reminder 생성 여부 최종 판단
- duplicate 검사
- characterId 관리
- 상태 저장


예:

잘못된 방식:

Claude에게
"내일 오후 2시가 정확히 언제인지 계산해줘."

올바른 방식:

Claude:
relative_days = 1
hour = 14
minute = 0

서버:
실제 triggerAt 계산


이 원칙을 새로운 기능에서도 유지한다.


---

# 3. Character Architecture

모든 기능은 가능한 한 `characterId` 기반의 공통 시스템으로 구현한다.

새 캐릭터를 추가할 때 다음 기능을 복사하거나 캐릭터별로 따로 구현하지 않는다.

- reminder
- scheduler
- reminderGuard
- 날짜 계산
- Time Awareness
- store
- API route
- polling

캐릭터별 차이는 가능한 한 `lib/characters.ts`의 configuration과
systemPrompt를 통해 표현한다.

캐릭터 상세 성격, 말투, 시간 인식 스타일은
`lib/characters.ts`를 source of truth로 사용한다.

UI에서도 특정 캐릭터 ID를 하드코딩한 분기를 가능한 한 만들지 않는다.


---

# 4. Reminder System

리마인더는 이 프로젝트의 핵심 기능 중 하나다.

사용자는 미래 시점에 캐릭터가 특정 행동이나 발화를 하도록 요청할 수 있다.

예:

- "1분 뒤 알려줘"
- "10분 뒤 공부하라고 해줘"
- "1분 뒤 응원해줘"
- "1분 뒤 잔소리 좀 해줘"
- "내일 오후 2시에 알려줘"
- "모레 오전 9시에 말해줘"
- "3일 뒤 이 시간에 알려줘"
- "8월 20일 오후 3시에 알려줘"


현재 MVP에서 지원하지 않는 것:

- 반복 일정
- 매일 / 매주 / 매월 reminder
- 복잡한 캘린더 일정
- 다국가 timezone


현재 MVP의 시간 기준은 KST(Asia/Seoul)이다.


---

# 5. Reminder Safety Rules

Claude가 `schedule_reminder` tool을 호출했다고 해서
바로 Reminder를 생성해서는 안 된다.

Reminder 생성의 최종 권한은 서버에 있다.

현재 reminder 생성 파이프라인의 핵심 방어 구조를 유지한다.

개념적으로:

1. 현재 user message 확인
2. 미래 시간 표현 확인
3. 행동 / 발화 요청 여부 확인
4. `source_text`가 실제 current user message에서 나온 것인지 확인
5. extraction 검증
6. triggerAt 계산
7. 시간 유효성 검사
8. duplicate 검사
9. Reminder 생성


## 유령 리마인더 회귀 방지

과거에 다음 문제가 발생했다.

사용자:
"3분 뒤 알려줘"

→ 정상 reminder 등록
→ 정상 발화

이후 사용자:
"고마워"

그런데 Claude가 conversation history에 있던
과거 reminder 요청을 다시 읽고 새로운 Reminder를 등록했다.

이를 막기 위해 현재 다음 방어가 존재한다.

- `<current_user_message>` 구분
- reminder hard guard
- `source_text` 검증
- duplicate 검사

이 구조를 제거하거나 임의로 약화시키지 않는다.

특히 일반적인 후속 대화가 reminder를 생성하면 안 된다.

예:

- "고마워"
- "알려줘서 고마워"
- "됐어"
- "응"
- "이제 그만해"
- "다른 얘기하자"


Reminder 인식 범위를 넓힐 때도
false positive가 다시 증가하지 않는지 반드시 확인한다.


---

# 6. Reminder Natural Language Principle

Reminder를 단순히 "알려줘"라는 표현으로만 해석하지 않는다.

사용자가 명확한 미래 시점과 함께
그 시점에 캐릭터에게 행동이나 발화를 요청했다면
Reminder 요청으로 볼 수 있다.

예:

- "1분 뒤 응원해줘"
- "10분 뒤 잔소리 좀 해줘"
- "5분 뒤 힘내라고 말해줘"
- "내일 시험 잘 보라고 응원해줘"

하지만 시간이 없는 일반 요청은 Reminder로 만들지 않는다.

예:

- "응원해줘"
- "잔소리 좀 해줘"

이 경우 일반 대화로 처리한다.

Reminder guard를 수정할 때는
정상 요청을 더 많이 지원하면서도
유령 리마인더 방지 구조가 유지되는지 함께 검증한다.


---

# 7. Time Awareness

캐릭터는 사용자가 해당 캐릭터와 마지막으로 실제 대화한 이후
얼마나 현실 시간이 흘렀는지 인식할 수 있다.

시간 계산은 Claude가 하지 않는다.

서버가:

현재 시각
-
해당 characterId의 마지막 user message 시각

을 이용해 경과 시간을 계산한다.

Claude는 계산된 결과를 전달받아
캐릭터 personality에 맞게 표현한다.


예:

서버 계산:

days = 8
hours = 3
minutes = 40

Claude 표현:

캐릭터에 따라

"일주일 넘게 안 왔네."

또는

"8일하고 3시간 40분이나 지났네."

처럼 달라질 수 있다.


## Time Awareness threshold

현재 기준:

- 30분 미만
  → Time Awareness context 없음

- 30분 ~ 6시간
  → light

- 6시간 ~ 24시간
  → notable

- 1일 ~ 3일
  → several_days

- 3일 ~ 7일
  → long

- 7일 ~ 30일
  → very_long

- 30일 이상
  → extremely_long (very_long보다 반응 강도를 한 단계 더 높이되, 비난·협박·과도한 집착
    강요로 흐르지 않는다)

실제 기준값의 source of truth는 `lib/interactionTime.ts`이다.


## 반복 언급 방지

사용자가 오랜만에 돌아온 첫 메시지에서 시간 경과를 언급한 뒤,
이어지는 모든 답변에서 같은 시간을 반복해서 말하지 않도록 한다.

현재 구조에서는 새 user message가 저장되면
다음 요청부터 last interaction gap이 짧아지기 때문에
Time Awareness context가 자연스럽게 비활성화된다.

이 구조를 불필요하게 복잡하게 만들지 않는다.


---

# 8. Time Awareness Development Override

실제 `Message.createdAt`을 테스트 목적으로 수정하지 않는다.

Time Awareness 테스트는 development-only override를 사용한다.


---

# 9. Shared Memory

Chat과 Story(Guest Character로 초대된 경우만)가 "캐릭터가 사용자에 대해 기억하는 중요한
사실/사건"을 공유하는 별도 계층이다. Chat/Story 전체 대화를 서로 밀어넣지 않는다 —
중요하다고 판단된 기억만 `lib/memoryStore.ts`에 저장하고, 필요할 때 최대 5개만 골라
Claude 호출에 끼워 넣는다.

## 범위

- 이번 단계는 **Guest Character(= `lib/characters.ts`의 Chat Character)만** 대상이다.
  Story 원작 캐릭터(`Story.characters`)는 제외 — 세션 history 안에서만 기억한다.
- Memory는 반드시 `characterId`로 격리된다. 레이가 아는 것과 유이가 아는 것은 섞이지
  않는다.
- 카테고리 taxonomy는 두지 않는다. 모든 memory는 importance + recency로 균일하게
  처리된다.

## 추출 시점

- **Chat**: 해당 캐릭터의 user 메시지 개수가 4의 배수일 때, 기존 Reminder 방어
  파이프라인이 전부 끝나고 응답이 확정된 뒤에만 별도 Claude 호출로 추출한다
  (`app/api/chat/route.ts`).
- **Story**: Guest가 세션에 있는 동안 user 턴 8개마다 미처리 구간을 증분 추출하고
  (`app/api/story/turn/route.ts`), Guest가 제거될 때 남은 구간을 마지막으로 한 번 더
  추출한다(`guests/[characterId]/route.ts` DELETE). 추출 커서(`GuestCharacterSlot.
  lastMemoryExtractedAt`)는 "지금 시각"이 아니라 "실제로 처리된 마지막 메시지의
  createdAt"으로 전진시킨다 — memory가 0개 추출돼도 호출 자체가 성공했다면 커서는
  전진한다(같은 구간이 매 턴 반복 재추출되지 않도록).

두 추출 모두 `schedule_reminder`의 호출·응답 루프와 물리적으로 완전히 분리된 별도
Claude 호출이다(`lib/memoryClaude.ts`). 이 분리를 약화시키지 않는다.

## dedup

`findSimilarMemory`는 Jaccard 유사도 0.8 이상인 근접-중복만 병합 대상으로 삼는다(짧은
문장의 단어 하나 차이나 의미 충돌은 병합하지 않고 별도 행으로 공존시킨다 — 오탐 병합보다
중복 허용을 우선한다). recency는 `createdAt`이 아니라 `updatedAt` 기준이다.

## prompt 주입

Memory는 캐릭터에게 "확정된 사실"이 아니라 "어렴풋한 기억"으로 제시한다. Chat은
`chatWithCharacter`의 `system` 끝에 `<shared_memory>` 블록으로(user 턴이 아님 —
`<current_user_message>`/`source_text` 판정 경계와 분리하기 위함), Story는
`buildGuestCharacterBrief` 안에 게스트별 "기억:" 줄로 덧붙인다. memory가 없으면 두 경로
모두 이 기능 도입 전과 완전히 동일한 출력을 낸다.

# 10. Story Mode Architecture

Story Mode는 Chat Mode와 별개의 독립 시스템이다.

사용자는 미리 정의된 Story 세계관 안에서 자유롭게 행동하거나 대화할 수 있으며,
Claude는 사용자의 입력과 현재까지의 Story history를 바탕으로 인터랙티브 소설 형태로
이야기를 이어간다.

현재 Story 데이터의 source of truth는 다음과 같다.

* Story 목록 / 세계관 / 장르 / 기본 등장인물 / 시작 장면 / 진행 규칙
  → `lib/stories.ts`

* Story system prompt 조립
  → `lib/storyPrompt.ts`

* Story Claude 호출
  → `lib/storyClaude.ts`

* Story session / message / guest character persistence
  → `lib/storyStore.ts`

* Story 진행 API
  → `app/api/story/turn/route.ts`

* Story session 생성 / 조회
  → `app/api/story/sessions/`

* Guest Character 초대 / 제거
  → `app/api/story/sessions/[sessionId]/guests/`

* Story 진행 UI
  → `components/story/StoryScreen.tsx`

Story 데이터를 다른 파일에 중복 정의하지 않는다.

특히 Story의 worldview, rules, characters, openingScene을
완성된 system prompt 형태로 별도 저장하지 않는다.

`buildStorySystemPrompt()`가 요청 시점마다 source of truth에서 조립한다.

---

# 11. Chat Mode와 Story Mode 분리 원칙

Chat Mode와 Story Mode는 의도적으로 분리되어 있다.

다음 기능은 Chat Mode 전용이다.

* Reminder
* Scheduler
* Time Awareness
* Cross Character Awareness의 Chat 동작
* Chat Message Store
* Chat Claude tool 호출

Story Mode에서는 위 기능을 직접 사용하지 않는다.

Story Mode는 다음 파일을 불필요하게 import하거나 재사용하지 않는다.

* `lib/store.ts`
* `lib/scheduler.ts`
* `lib/reminderGuard.ts`
* `lib/time.ts`
* `lib/interactionTime.ts`
* Chat Mode의 reminder tool pipeline

Story Mode의 Claude 호출은 반드시 `lib/storyClaude.ts`를 통해 처리한다.

Chat Mode의 `chatWithCharacter()`를 Story에서 재사용하지 않는다.

이 분리는 기능 중복이 아니라,
두 모드의 목적과 prompt 성격이 다르기 때문에 의도적으로 유지하는 구조다.

---

# 12. Story Session

같은 Story를 여러 번 플레이할 수 있다.

따라서 다음 개념을 구분한다.

* `storyId`
  → 어떤 Story인지 나타냄

* `sessionId`
  → 해당 Story의 특정 플레이 기록

하나의 Story에 여러 Session이 존재할 수 있다.

예:

눈보라 속 산장

* Session A
* Session B
* Session C

각 Session은 서로 다른 다음 상태를 가진다.

* conversation history
* createdAt
* updatedAt
* Guest Character
* Story 진행 내용

Story 화면을 단순 조회하는 것만으로 새로운 Session을 생성하지 않는다.

새 Session 생성은 사용자의 명시적인 "새로 시작" 행동에서만 발생해야 한다.

GET 계열 조회 로직에서 `createStorySession()`을 호출하지 않는다.

---

# 13. Guest Character

사용자는 Chat Mode에서 대화하던 Character를 Story에 Guest Character로 초대할 수 있다.

Guest Character는 `lib/characters.ts`의 Character를 참조한다.

Story 원작 등장인물과 Guest Character는 다른 개념이다.

## Story Character

`lib/stories.ts`

예:

* 서윤
* 하준

해당 Story 세계관에 원래 존재하는 인물이다.

## Guest Character

`lib/characters.ts`

예:

* 레이
* 유이
* 미나
* 루나
* 세라
* 아린

사용자가 Story Session에 초대한 Chat Character다.

두 캐릭터 시스템을 합치거나 하나의 데이터 모델로 강제 통합하지 않는다.

---

# 14. Guest Character Prompt Rules

Guest Character를 Story에 초대할 때
Chat Character의 전체 `systemPrompt`를 Story system prompt에 넣지 않는다.

Chat Character의 systemPrompt에는 다음과 같은 Chat 전용 기능이 포함되어 있기 때문이다.

* 짧은 메신저 답변 형식
* Reminder
* schedule_reminder tool
* Time Awareness
* Chat 전용 반응 규칙

Story에서는 Guest Character의 순수한 캐릭터성만 가져온다.

현재 사용하는 정보:

* `personalitySummary`
* `speechStyle`

Guest Character는 Story 안에서도 자신의 성격과 말투를 유지하지만,
Story 세계관과 진행 규칙을 항상 우선한다.

Prompt 우선순위는 다음 원칙을 유지한다.

Story 세계관
→ Story 진행 규칙
→ Story 원작 등장인물
→ Guest Character
→ Story 공통 규칙

Guest Character가 Story 전체를 지배하거나
원작 등장인물을 밀어내도록 만들지 않는다.

Guest Character는 모든 응답에 반드시 등장할 필요가 없다.

---

# 15. Guest Character 최초 등장

Guest Character가 Session에 초대된 뒤 아직 Story 응답에 등장한 적이 없다면,
다음 Claude 응답에서 자연스럽게 Story 안에 등장시킨다.

예:

* 문이 열리며 들어온다.
* 근처에 있었다는 사실을 발견한다.
* 기존 사건과 관련된 자연스러운 계기로 합류한다.

Guest Character를 설명 없이 갑자기 장면 안에 존재하는 것으로 처리하지 않는다.

최초 등장 강제 지시는 한 번만 적용한다.

이후에는 이미 Story에 합류한 Character로 간주하고 자연스럽게 진행한다.

---

# 16. Guest Character Capacity

현재 MVP에서는 하나의 Story Session에 Guest Character를 최대 1명만 초대할 수 있다.

실제 제한의 source of truth:

`lib/storyStore.ts`

`MAX_GUEST_CHARACTERS_PER_SESSION`

Guest Character 데이터 구조 자체는 배열을 사용한다.

따라서 향후 여러 Guest를 지원할 때
기존 스키마를 불필요하게 다시 설계하지 않는다.

가능하면 기존 배열 구조를 유지하고 capacity만 확장한다.

---

# 17. Story Shared Memory

Shared Memory는 Chat Mode와 Story Mode를 연결하는 유일한 주요 공통 계층이다.

단, 전체 대화 history를 공유하지 않는다.

Character가 사용자에 대해 기억할 가치가 있는 중요한 사실이나 사건만
Memory로 추출하여 공유한다.

예:

Chat:

사용자:
"다음 주에 SQLD 시험이 있어."

Memory:

"사용자는 다음 주 SQLD 시험을 준비하고 있다."

이후 해당 Character가 Story에 Guest로 참여하면
이 Memory를 Story에서도 사용할 수 있다.

Guest Character가 Story에서 경험한 중요한 사건도 다시 Memory로 저장되어
향후 Chat에서 참고될 수 있다.

---

# 18. Memory Isolation

Memory는 반드시 `characterId` 기준으로 분리한다.

예:

레이가 아는 정보
≠
유이가 아는 정보

한 Character의 Memory를 다른 Character에게 전달하지 않는다.

Story 원작 Character에는 현재 Shared Memory를 적용하지 않는다.

Shared Memory 대상은 `lib/characters.ts`의 Chat Character가
Guest Character로 Story에 참여하는 경우로 제한한다.

---

# 19. Story Memory Extraction

Story 진행 중 매 턴마다 Memory extraction Claude 호출을 하지 않는다.

현재 기준:

Guest Character가 Session에 존재하는 동안
user turn이 일정 횟수 누적되면 미처리 구간을 대상으로 Memory를 추출한다.

실제 interval의 source of truth는:

`lib/memoryClaude.ts`

Guest가 Story에서 제거될 때는
아직 처리하지 않은 마지막 구간이 있다면 최종 Memory extraction을 수행한다.

Memory extraction은 Story 응답 생성과 별도의 Claude 호출이다.

Story 답변 생성 실패와 Memory 추출 실패를 서로 결합하지 않는다.

Memory extraction이 실패해도 이미 생성된 Story 응답은 정상 유지되어야 한다.

---

# 20. Memory Extraction Cursor

Story Guest Memory extraction은
각 Guest의 `lastMemoryExtractedAt`을 cursor로 사용한다.

Cursor는 현재 시각으로 갱신하지 않는다.

실제로 Memory extraction에 사용된 마지막 StoryMessage의 `createdAt`으로 갱신한다.

Memory가 0개 추출되더라도
Claude extraction 호출 자체가 정상적으로 성공했다면 cursor는 전진시킨다.

그렇지 않으면 같은 대화 구간이 매 턴 반복해서 extraction되는 문제가 발생할 수 있다.

반대로 Claude 호출 자체가 실패한 경우에는 cursor를 전진시키지 않는다.

다음 턴에서 동일 구간을 다시 처리할 수 있어야 한다.

---

# 21. Story Progress Principle

현재 Story Mode는 고정된 선택지 게임이 아니다.

사용자는 자유롭게 다음과 같은 입력을 할 수 있다.

* 대화
* 행동
* 질문
* 탐색
* 상황에 대한 반응

Claude는 사용자의 입력을 바탕으로 Story를 이어간다.

사용자가 하지 않은 행동, 감정, 대사를
사용자 Character의 것으로 임의로 확정하지 않는다.

잘못된 예:

사용자:
"문을 바라본다."

AI:
"당신은 겁에 질려 문을 열고 밖으로 뛰쳐나갔다."

올바른 방향:

사용자가 명시한 행동까지만 확정하고
그에 대한 환경과 NPC의 반응을 생성한다.

---

# 22. Story Consistency

Story 응답 생성 시 다음 우선순위를 유지한다.

1. 현재 Story 세계관
2. Story rules
3. 지금까지의 Session history
4. Story 원작 Character의 성격
5. Guest Character의 성격과 기억
6. 현재 사용자의 입력

Claude가 즉흥적으로 재미있는 전개를 만드는 것보다
기존 Story의 일관성을 유지하는 것이 더 중요하다.

사용자가 명시적으로 요청하지 않는 이상:

* 갑작스러운 시간 점프
* 설정 변경
* 이미 발생한 사건의 무효화
* Character 성격 급변
* 근거 없는 새로운 핵심 설정 추가

를 피한다.

---

# 23. Story UI State

Story UI에서 서버가 source of truth인 상태를
클라이언트에 별도 영구 source of truth로 중복 저장하지 않는다.

예:

* Session
* Story Message
* Guest Character

위 상태는 서버의 Story Store가 기준이다.

React state는 현재 UI 표현과 즉시 반응을 위한 상태로만 사용한다.

Story 화면 재접속 시
서버에 저장된 Session 상태를 기준으로 복원한다.

---

# 24. Current MVP Scope

현재 Story Mode의 목표는 production 규모의 완성된 게임 엔진이 아니다.

현재 우선순위:

1. 자유로운 AI Story 진행
2. Story 세계관 일관성
3. Guest Character 자연스러운 합류
4. Chat Character personality 유지
5. Shared Memory를 통한 Character 관계 지속성
6. Session 저장 및 이어하기

현재 MVP 범위를 벗어나는 기능은
기존 구조를 불필요하게 복잡하게 만들면서 먼저 구현하지 않는다.

예:

* 대규모 branching graph
* 복잡한 quest engine
* Story Character 전용 장기 Memory
* 다수 Guest Character 동시 상호작용 최적화
* production database
* multiplayer Story

---

# 25. Future Development Principle

새 기능을 개발할 때 먼저 다음을 확인한다.

1. 이 기능은 Chat Mode인가 Story Mode인가 Shared Layer인가?
2. 기존 source of truth가 있는가?
3. 동일한 데이터를 다른 파일에 중복 정의하게 되지 않는가?
4. deterministic logic을 Claude에게 맡기고 있지는 않은가?
5. Chat 전용 기능이 Story Mode로 의도치 않게 유입되지는 않는가?
6. Character별 하드코딩 대신 `characterId` 기반 공통 구조로 만들 수 있는가?
7. 기존 Session / Memory 데이터를 깨뜨리지 않는가?

기능을 추가하기 전에 기존 구조를 최대한 재사용하되,
Chat과 Story의 의도적인 경계를 억지로 통합하지 않는다.

이 프로젝트에서 중요한 것은 코드 수를 줄이는 것 자체가 아니라

**Character의 일관성, Story의 일관성, 상태의 정확성, 기능 간 경계의 명확성**

을 유지하는 것이다.
