# Sourcing Hub / AI 구매대행 OS (9ruHub)

Amazon US 소싱 → 초안 → 채널 등록/동기화에 더해, **SaaS 멀티테넌트 DB** 위에 추천·주문·물류·수익분석 기반을 쌓는 Next.js + PostgreSQL 앱입니다.

원격: https://github.com/sangyubkim/9ruHub.git

## 제품 단계

| Step | 기능 | 상태 |
|------|------|------|
| 0 | SaaS DB/ERD (tenants, products, orders, shipments, AI) | **완료** |
| ① | AI 상품 발굴 MVP (네이버 키워드 ↔ 1688 원가, 규칙 점수) | **완료** |
| ② | AI 상세페이지 제작 (URL → 제목/키워드/상세/옵션/번역) | **완료** |
| 1 | 규칙 추천 + GPT 이유/상세 + 원클릭 초안 | **완료** |
| 2 | 주문 관리 + 자동주문 파이프라인(1688 스텁·결제 게이트) | **완료** |
| 3 | 배대지 + 송장 자동등록 어댑터 | **완료** |
| 4 | AI 수익분석 대시보드 + 운영 비서 | **완료** |
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
  tenants ||--o{ product_candidates : scopes
  SourceProduct ||--o{ ProductDraft : drafts
  ProductDraft ||--o{ ChannelListing : lists
  ProductDraft ||--o{ SyncJob : syncs
  products ||--o{ product_price_history : history
  products ||--o{ order_items : sold_as
  orders ||--o{ order_items : contains
  orders ||--|| shipments : ships
  product_candidates ||--o{ ai_recommendations : scores
  ai_conversations ||--o{ ai_conversation_messages : messages
```

핵심 테이블: `tenants` / `users` / `tenant_members`, `products`, `product_price_history`, `product_candidates`, `orders` / `order_items`, `shipments`, `ai_recommendations`, `ai_conversations`(+messages).  
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
# Prisma local에서 db push/migrate가 portal 오류면:
# npm run db:apply:discover
# npm run db:apply:ai-detail
npm run db:seed
```

시드: demo 테넌트(`slug=demo`) + owner + 기본 PriceRule + 네이버↔1688 발굴 샘플 후보.

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
| `USD_TO_KRW` / `MARGIN_RATE` / `CHINA_SHIPPING_FEE_KRW` / `INTL_SHIPPING_FEE_KRW` / `CARD_FEE_RATE` / `COMPETITOR_UNDERCUT_RATE` 등 | AI 추천 판매가·PriceRule 폴백 |
| `SMARTSTORE_*` / `COUPANG_*` | 채널 API (없으면 스텁) |
| `CRON_SECRET` | 배치 동기화 보호 |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | AI 상세·발굴 이유·운영 비서 (Gemini, 없으면 템플릿 폴백). `npm run ai:import-gemini`로 9ruTrip에서 가져오기 가능 |
| `DISCOVER_*` / `CNY_TO_KRW` | ① 발굴 어댑터·원가 환산 (기본 스텁) |
| `CHINA_MALL_ADAPTER` / `AUTO_ORDER_*` / `FORWARDER_ADDRESS_*` | Step 2 자동주문 파이프라인 (기본 stub, 결제 게이트) |
| `FORWARDER_ADAPTER` 등 | Step 3 배대지 (기본 stub) |

## 동기화 스케줄러

```bash
npm run sync:scheduler
# 또는
curl -X POST http://localhost:3000/api/cron/sync
```

## ① AI 상품 발굴 MVP (Naver ↔ 1688)

점수는 **코드 규칙**(`src/lib/discover/score.ts`)이 계산합니다. GPT는 추천 이유 문구만 담당합니다.

```bash
# CLI
npm run discover:keyword -- "무선선풍기"
npm run smoke:discover

# UI: /recommendations → 「키워드로 발굴」
# API:
# POST /api/discover { "keyword": "무선선풍기" }
# GET  /api/discover
```

흐름: 수요 어댑터(네이버 스텁) + 공급 어댑터(1688 스텁) → `product_candidates` upsert → 규칙 점수 → `ai_recommendations` 생성 → UI.  
수락 시 Amazon fetch 없이 후보 메타데이터로 `ProductDraft`를 만듭니다.  
쿠팡/Ali/타오바오는 확장 스텁만 두었습니다(`DISCOVER_*_ADAPTER`). 라이브 크롤은 Playwright 이후 단계입니다.

## AI 가격 결정 (추천 판매가)

원가 + 중국/국제배송 + 관세 + 대행수수료에 마진을 얹고, 카드·플랫폼 수수료를 보정한 뒤 **경쟁상품 가격 밴드**로 클램프합니다. 숫자는 `src/lib/pricing/recommend.ts` 규칙 엔진이 계산합니다 (GPT 불필요).

```bash
# UI: /pricing 또는 초안 상세의 「AI 가격 결정」
# API:
# POST /api/pricing/recommend
# {
#   "cost": 20000,
#   "chinaShipping": 3000,
#   "intlShipping": 12000,
#   "dutyRate": 0.08,
#   "cardFeeRate": 0.025,
#   "platformFeeRate": 0.1,
#   "competitors": [59000, 62000, 65000],
#   "applyDraftId": "optional-draft-id"
# }
```

전략: cost-plus → 경쟁 평균보다 소폭 낮게 맞춤(마진 여유 시). 여유 없으면 최소 마진(`MIN_MARGIN_RATE`)으로 클램프. 경쟁가 없으면 cost-plus 그대로.

## Step 1 — 추천 (Amazon / 기존 상품)

```bash
npm run recommend:generate
# 또는 UI: /recommendations (Amazon URL / 기존 스캔)
# API:
# POST /api/recommendations { "generate": true }
# POST /api/recommendations { "url": "https://www.amazon.com/dp/..." }
# POST /api/recommendations/:id/accept  → 초안 생성/연결
# POST /api/recommendations/:id/ignore
```

점수는 `src/lib/recommend/score.ts` 규칙 엔진이 계산합니다. `GEMINI_API_KEY`가 있으면 이유/상세만 Gemini, 없으면 템플릿 폴백.

## ② AI 상세페이지 제작

상품 URL 1개 → 한국어 제목·SEO 키워드·SmartStore형 상세 HTML·옵션명 번역·번역 메모를 생성합니다. GPT는 **콘텐츠만** 담당하며, 키가 없으면 구매대행 고지/혜택/스펙/FAQ 포함 템플릿으로 폴백합니다.

```bash
npm run smoke:ai-detail
# UI: /ai-detail  (미리보기 → 초안 저장)
#     /drafts/:id → 「AI 상세 재생성」
# API:
# POST /api/ai/detail { "url": "https://www.amazon.com/dp/..." }
# POST /api/ai/detail { "url": "...", "save": true }
# POST /api/drafts { "url": "...", "generateAi": true }
# POST /api/drafts/:id/ai-detail
```

결과는 `ProductDraft`의 `titleKo` / `keywords` / `detailHtml` / `options` / `noticeText` / `aiMeta`에 저장됩니다. 추천 수락 시 새 초안에도 AI 상세를 적용합니다.

## Step 2 — 주문 / 자동주문 파이프라인 (1688)

주문 유입 → 1688 소싱 → 장바구니 → **결제 확인 게이트** → 결제 → 배대지 주소 → 완료.

상태: `PENDING` → `SOURCING` → `CART_READY` → `AWAITING_PAYMENT_CONFIRM` → `PAID` → `FORWARDER_ADDRESS_SET` → `PURCHASE_COMPLETE`

```bash
# DB (enum + order_events)
npm run db:apply:auto-order
# 또는 prisma db push / generate

# 스모크 (DB 필요)
npm run smoke:auto-order

# UI: /orders/:id  — 파이프라인 체크리스트 · 자동주문 시작 · 결제 확인 후 계속 · 이벤트 로그
# API:
# POST /api/orders
# GET  /api/orders/:id                    # events 포함
# POST /api/orders/:id/auto-order/start   # 결제 게이트까지
# POST /api/orders/:id/auto-order/confirm-payment  { "confirmPayment": true }
# POST /api/orders/:id/purchase           # 레거시 라인 스텁
```

**기본은 스텁**입니다 (`AUTO_ORDER_ADAPTER=stub`). 라이브 1688/Playwright는 `AUTO_ORDER_LIVE=true` + `AUTO_ORDER_ADAPTER=live-hook` 일 때만 훅이 열리며, 미구성 시에도 실결제 없이 스텁으로 폴백합니다.  
결제 단계는 스텁에서도 `confirmPayment: true`(또는 `AWAITING_PAYMENT_CONFIRM` 게이트) 없이는 진행되지 않습니다. 쿠키/비밀번호는 커밋하지 마세요 — `.env.example` 플레이스홀더만 사용합니다.  
배대지 주소: `FORWARDER_ADDRESS_*` env.

## Step 3 — 배대지 / 송장 자동등록

```
배대지 연동 (입고 → 출고 → 송장번호 수집)
        ↓
스마트스토어 / 쿠팡 / 11번가
        ↓
자동 송장 등록
```

```bash
# UI: /shipments  (배대지 동기화 · 송장 채널등록 · 전체 동기화)
# POST /api/shipments { "orderId": "..." }
# POST /api/shipments/:id/sync-forwarder
# POST /api/shipments/:id/register-invoice { "channels": ["SMARTSTORE","COUPANG","ELEVENST"] }
# POST /api/shipments/sync-all
# POST /api/shipments/:id/track
# POST /api/shipments/:id/invoice   # legacy alias → register-invoice
```

환경 변수 (`.env.example`):

| 변수 | 설명 |
|------|------|
| `FORWARDER_ADAPTER` | `stub`(기본) / `live` |
| `FORWARDER_API_URL` 또는 `FORWARDER_API_BASE` | 배대지 API 베이스 |
| `FORWARDER_API_KEY` | 배대지 API 키 |
| `ELEVENST_API_KEY` / `ELEVENST_API_URL` | 11번가 송장 live용 (없으면 스텁) |

키 없이 `StubForwarderAdapter`로 입고·출고·국내송장까지 결정적으로 데모됩니다. 채널 송장도 키 없으면 스텁으로 채널별 상태가 `channelInvoicePayload.channels`에 기록됩니다.

```bash
npm run db:apply:elevenst   # Channel enum에 ELEVENST 추가 (필요 시)
npm run smoke:forwarder-invoice
```

## Step 4 — 수익분석 / 운영 비서

```bash
# UI: /analytics?period=today|7d|30d|all
# GET  /api/analytics?period=today
# POST /api/analytics/assistant { "question": "오늘 KPI 요약", "period": "today" }
# GET  /api/analytics/assistant
# GET|POST /api/analytics/morning-report
```

집계는 `src/lib/analytics/metrics.ts`가 DB에서 수행합니다. GPT는 스냅샷 JSON만 설명하며, 키 없으면 템플릿 요약으로 `ai_conversations`에 저장합니다.

### 자동 집계 KPI (기본: 오늘, Asia/Seoul)

| 지표 | 공식 |
|------|------|
| 판매 건수 | `orders` 수 (`CANCELLED` 제외, 기간 `orderedAt`) |
| 매출 | `sum(subtotalKrw)` |
| 순이익 | `sum(profitKrw)` |
| 광고비 | `sum(ad_spends.amountKrw)` (기간 `date`) |
| ROI | `순이익 / 광고비` (비율, UI는 ×100%) — 광고비 0이면 0 |
| 환불률 | 환불 주문 수 / 판매 건수 (`REFUNDED` 또는 `refundedKrw > 0`) |

데모: `npx tsx scripts/apply-ad-spend-migration.ts` → `npm run db:seed` → `/analytics`

## 주요 API (현재)

- `POST /api/drafts` `{ "url": "https://www.amazon.com/dp/ASIN", "generateAi"?: true }`
- `POST /api/ai/detail` `{ "url": "...", "save"?: true }`
- `POST /api/drafts/:id/ai-detail`
- `POST /api/drafts/import` (multipart `file`)
- `POST /api/drafts/:id/approve`
- `POST /api/drafts/:id/publish`
- `POST /api/drafts/:id/sync`
- `GET|POST /api/discover` `{ "keyword": "..." }`
- `POST /api/pricing/recommend` `{ cost, chinaShipping?, intlShipping?, competitors?, applyDraftId? }`
- `GET|POST /api/recommendations`
- `POST /api/recommendations/:id/accept|ignore`
- `GET|POST /api/orders`
- `GET|PATCH /api/orders/:id` (GET에 `events` 포함)
- `POST /api/orders/:id/auto-order/start`
- `POST /api/orders/:id/auto-order/confirm-payment` `{ "confirmPayment": true }`
- `POST /api/orders/:id/purchase`
- `GET|POST /api/shipments`
- `POST /api/shipments/:id/sync-forwarder`
- `POST /api/shipments/:id/register-invoice`
- `POST /api/shipments/sync-all`
- `POST /api/shipments/:id/track|invoice`
- `GET /api/analytics`
- `GET|POST /api/analytics/assistant`
- `GET|POST /api/analytics/morning-report`
- `GET|POST /api/cron/morning-report`

- `GET /api/channels/status`
- `GET|POST /api/cron/sync`
- `GET /api/templates/excel`

## 테스트

```bash
npm test
npm run smoke:draft
npm run smoke:ai-detail
npm run smoke:auto-order
npm run smoke:shipment
npm run smoke:forwarder-invoice
npm run smoke:analytics
npm run smoke:discover
```

## Stage 5 (남은 일)

- 빌링/구독, 테넌트별 API 키 저장
- 세션/초대 기반 멀티유저 UI
- 프로덕션 RLS 또는 미들웨어 강제 테넌트 격리
