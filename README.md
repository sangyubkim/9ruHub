# Sourcing Hub / AI 구매대행 OS (9ruHub)

Amazon US 소싱 → 초안 → 채널 등록/동기화에 더해, **SaaS 멀티테넌트 DB** 위에 추천·주문·물류·수익분석 기반을 쌓는 Next.js + PostgreSQL 앱입니다.

원격: https://github.com/sangyubkim/9ruHub.git

## 제품 단계

| Step | 기능 | 상태 |
|------|------|------|
| 0 | SaaS DB/ERD (tenants, products, orders, shipments, AI) | **완료** |
| 1 | 규칙 추천 + GPT 이유/상세 + 원클릭 초안 | **완료** |
| 2 | 주문 관리 + 중국몰 자동주문 어댑터(스텁) | **완료** |
| 3 | 배대지 + 송장 자동등록 어댑터 | **완료** |
| 4 | AI 수익분석 대시보드 + 운영 비서 | 진행 예정 |
| 5 | SaaS 빌링 / 멀티유저 고도화 | 미착수 |

기존 Phase 1–2 유지: URL/엑셀 초안, 승인→SmartStore/Coupang 등록(키 없으면 스텁), 가격·재고 동기화+스케줄러.

## 기술 스택

- Next.js App Router + Tailwind
- PostgreSQL + Prisma 7 (`prisma.config.ts`, `@prisma/adapter-pg`, client: `src/generated/prisma`)
- Vitest

## Step 0 — SaaS ERD 요약

```mermaid
erDiagram
  tenants ||--o{ tenant_members : has
  users ||--o{ tenant_members : joins
  tenants ||--o{ PriceRule : scopes
  tenants ||--o{ SourceProduct : scopes
  tenants ||--o{ ProductDraft : scopes
  tenants ||--o{ products : scopes
  tenants ||--o{ orders : scopes
  tenants ||--o{ shipments : scopes
  tenants ||--o{ ai_recommendations : scopes
  tenants ||--o{ ai_conversations : scopes
  SourceProduct ||--o{ ProductDraft : drafts
  ProductDraft ||--o{ ChannelListing : lists
  ProductDraft ||--o{ SyncJob : syncs
  products ||--o{ product_price_history : history
  products ||--o{ order_items : sold_as
  orders ||--o{ order_items : contains
  orders ||--|| shipments : ships
  ai_conversations ||--o{ ai_conversation_messages : messages
```

핵심 테이블: `tenants` / `users` / `tenant_members`, `products`, `product_price_history`, `orders` / `order_items`, `shipments`, `ai_recommendations`, `ai_conversations`(+messages).  
비즈니스 테이블은 `tenantId` + 시간 인덱스. 기존 `SourceProduct`→`ProductDraft`→채널 흐름은 유지하며 초안 생성 시 `products`/`product_price_history`에 동기화합니다.

## 실행 방법

### 1) 의존성

```bash
npm install
```

### 2) DB

**권장: Prisma 로컬 Postgres**

```bash
npm run db:dev
```

출력 `DATABASE_URL`을 `.env`에 넣은 뒤:

```bash
npm run db:migrate
npm run db:seed
```

시드: demo 테넌트(`slug=demo`) + owner + 기본 PriceRule.

**대안: Docker**

```bash
docker compose up -d
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sourcing_hub
npm run db:migrate
npm run db:seed
```

### 3) 앱

```bash
npm run dev
```

http://localhost:3000

## 환경변수

`.env`는 커밋하지 않습니다. `.env.example` 참고.

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL |
| `USD_TO_KRW` 등 | 가격 규칙 폴백 |
| `SMARTSTORE_*` / `COUPANG_*` | 채널 API (없으면 스텁) |
| `CRON_SECRET` | 배치 동기화 보호 |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Step 1+ GPT (없으면 템플릿 폴백) |
| `CHINA_MALL_ADAPTER` 등 | Step 2 중국몰 (기본 stub) |
| `FORWARDER_ADAPTER` 등 | Step 3 배대지 (기본 stub) |

## 동기화 스케줄러

```bash
npm run sync:scheduler
# 또는
curl -X POST http://localhost:3000/api/cron/sync
```

## Step 1 — 추천

```bash
npm run recommend:generate
# 또는 UI: /recommendations
# API:
# POST /api/recommendations { "generate": true }
# POST /api/recommendations { "url": "https://www.amazon.com/dp/..." }
# POST /api/recommendations/:id/accept  → 초안 생성/연결
# POST /api/recommendations/:id/ignore
```

점수는 `src/lib/recommend/score.ts` 규칙 엔진이 계산합니다. `OPENAI_API_KEY`가 있으면 이유/상세만 GPT, 없으면 템플릿 폴백.

## Step 2 — 주문 / 중국몰 스텁

```bash
# UI: /orders
# GET  /api/orders
# POST /api/orders
# POST /api/orders/:id/purchase   # China mall adapter (default stub)
```

`CHINA_MALL_ADAPTER=stub` (기본). 공식 API 연동 전까지 실결제 없이 `purchaseRef`만 기록합니다.

## Step 3 — 배대지 / 송장

```bash
# UI: /shipments
# POST /api/shipments { "orderId": "..." }
# POST /api/shipments/:id/track
# POST /api/shipments/:id/invoice { "localCarrier":"CJ", "localTrackingNo":"..." }
```

`FORWARDER_ADAPTER=stub` 기본. 채널 송장 등록도 스텁이며 live 훅 자리만 열어 둡니다.

## 주요 API (현재)

- `POST /api/drafts` `{ "url": "https://www.amazon.com/dp/ASIN" }`
- `POST /api/drafts/import` (multipart `file`)
- `POST /api/drafts/:id/approve`
- `POST /api/drafts/:id/publish`
- `POST /api/drafts/:id/sync`
- `GET|POST /api/recommendations`
- `POST /api/recommendations/:id/accept|ignore`
- `GET|POST /api/orders`
- `GET|PATCH /api/orders/:id`
- `POST /api/orders/:id/purchase`
- `GET|POST /api/shipments`
- `POST /api/shipments/:id/track|invoice`

- `GET /api/channels/status`
- `GET|POST /api/cron/sync`
- `GET /api/templates/excel`

## 테스트

```bash
npm test
npm run smoke:draft
```

## Stage 5 (남은 일)

- 빌링/구독, 테넌트별 API 키 저장
- 세션/초대 기반 멀티유저 UI
- 프로덕션 RLS 또는 미들웨어 강제 테넌트 격리
