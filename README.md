# 태형이와 경은이의 부자 되기 프로젝트 💰

둘이 같이 쓰는 가계부 웹앱이에요. 아이폰 홈 화면에 추가해서 앱처럼 써요.

- **주소:** https://usagii809.github.io/KETH_Buza_GOGO/
- **기술:** TypeScript · React · Vite · Tailwind CSS · Firebase(로그인, Firestore) · PWA

## 처음 한 번만

1. [Node.js](https://nodejs.org) 22 버전을 설치해요.
2. 이 폴더에서 `npm install`을 실행해요.

## 자주 쓰는 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 내 컴퓨터에서 미리보기 (저장하면 바로 반영) |
| `npm test` | 계산 로직 자동 테스트 |
| `npm run build` | 배포용 파일 만들기 (`dist/`) |

## 배포

`main` 브랜치에 올리면 GitHub Actions가 테스트 → 빌드 → GitHub Pages 배포까지 자동으로 해요.
처음 한 번은 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿔야 해요.

## 폴더 구조

```
src/
  features/          기능별 폴더 (화면 + 계산)
    budget/          예산 · 예상 저축액 · 도넛 · 가용 예산 · 항목별 예산
    expenses/        지출 기록 · 내역 · 사용처 자동완성
    goals/           저축 목표
    recurring/       매달 자동 기록
    report/          월말 성적표
    noSpend/         무지출 챌린지
    trend/           지난달 오늘과 비교 · 최근 6개월 지출 그래프
    quips/           지출 페이스별 오늘의 한마디 (문구는 quips.ts에서 추가)
    settings/        설정 · 백업/복원
    auth/            로그인
  data/              Firebase 읽기/쓰기 (db.ts), 실시간 구독 (hooks.ts)
  lib/               카테고리, 날짜, 금액 포맷 같은 공통 도구 + 테스트
  ui/                시트, 토스트, 확인창, 입력칸 같은 공통 부품
  App.tsx            화면 조립
e2e/                 가짜 DB로 화면을 띄워보는 테스트용 설정
```

- **새 기능**은 `src/features/`에 폴더를 하나 만들고 `App.tsx`에 붙이면 돼요.
- **돈 계산**은 각 기능의 `calc.ts`에 있고, `src/lib/calc.test.ts`에 테스트가 있어요. 계산을 바꾸면 `npm test`로 확인해 주세요.
- **DB 구조**(`ledgers/shared_household/...`)는 예전 index.html 버전과 같아서 기존 데이터를 그대로 써요.

## Firestore 데이터

| 경로 | 내용 |
|---|---|
| `config/defaultBudget` | 기본 예산 |
| `months/{YYYY-MM}` | 달별 예산 (첫 지출 때 그 달 예산이 고정됨) |
| `transactions/{id}` | 지출 내역 (`auto: true`면 자동 기록) |
| `recurring/{id}` | 매달 자동 기록 규칙 |
| `goals/{id}` | 저축 목표 |
