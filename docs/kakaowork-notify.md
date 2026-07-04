# 카카오워크 연차 알림 연동 가이드

연차 결재 흐름에 맞춰 카카오워크로 알림을 보낸다.

## 동작 개요

| 시점 | 대상 | 방식 |
| --- | --- | --- |
| 연차 신청 | 1차 결재자 | 개인 DM "결재 요청" |
| 결재 단계 전환(1차 승인) | 다음 결재자 | 개인 DM "결재 요청" |
| 최종 승인 | 신청자 | 개인 DM "승인" |
| 최종 승인 | 공지 대화방 | 채널 공지(이름·기간·종류·일수, **사유 제외**) |
| 반려 | 신청자 | 개인 DM "반려 + 사유" |

- 알림은 결재 처리 **응답 이후**(`after()`)에 실행되어 결재 속도에 영향이 없다.
- 외부 호출 실패·타임아웃(4초)은 결재를 막지 않는다(격리).
- App Key 미설정 시 전 기능이 조용히 skip 된다.

## 설정 (관리자)

### 1. 카카오워크 봇 생성 → App Key 발급
1. 카카오워크 **관리자 페이지 → 봇 관리(또는 개발자센터)** 에서 봇(App) 생성
2. 발급된 **App Key**(Bearer 토큰) 복사

### 2. 공지 대화방 conversation_id 확보
1. 연차 승인 공지를 올릴 **단체 대화방**을 만들고 위 **봇을 초대**
2. 해당 대화방의 **conversation_id** 확인
   - 봇 API `GET /v1/conversations` 등으로 조회하거나 관리자 도구로 확인

### 3. 환경변수 등록
로컬 `.env.local` 및 **Vercel 프로젝트 환경변수**에 등록:

```
KAKAOWORK_APP_KEY=<발급받은 App Key>
KAKAOWORK_LEAVE_ANNOUNCE_ID=<공지 대화방 conversation_id>
NEXT_PUBLIC_SITE_URL=https://taxo-two.vercel.app
```

> Vercel: Settings → Environment Variables 에 Production 으로 추가 후 재배포.

### 4. 직원 이메일 일치 확인
- 개인 DM은 **직원의 앱 이메일 == 카카오워크 이메일**로 사용자를 찾는다.
- 이메일이 다르면 해당 직원 DM은 skip 되고 로그가 남는다(결재는 정상).

## 사용 API (봇)

- `GET  /v1/users.find_by_email?email=...` — 이메일로 사용자 조회
- `POST /v1/conversations.open { user_id }` — 1:1 대화 열기
- `POST /v1/messages.send { conversation_id, text }` — 메시지 발송

모든 요청 헤더: `Authorization: Bearer <APP_KEY>`

## 향후 확장

- 복지신청·업무일지 결재로 알림 범위 확대
- 발송 로그 테이블(`notification_log`)로 추적·중복방지
- 메시지 blocks(버튼 등) 리치 포맷 적용
