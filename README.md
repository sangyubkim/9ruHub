# Sourcing Hub / AI 구매대행 OS (9ruHub)

**Amazon US 우선** 소싱 → 발굴 → 초안 → 채널 등록/동기화 → 주문·물류·수익분석까지 쌓는 Next.js + PostgreSQL 앱입니다.  
중국(1688) 자동 소싱은 계정 이슈로 **기본 OFF**(코드·레거시 UI만 유지).

원격: https://github.com/sangyubkim/9ruHub.git

> **문서 운영:** 개발 **현재 상태 / 진행 과정 / 다음 방향**은 이 README를 기준으로 계속 갱신합니다.  
> 기능 단위가 끝날 때마다 아래 「개발 현황」과 관련 절을 업데이트하세요.

---

## 개발 현황 (살아있는 로그)

### 현재 상태 (2026-07-26)

| 영역 | 상태 | 비고 |
|------|------|------|
| 네이버 수요 (오픈API 쇼핑 + 검색광고) | **Live** | `NAVER_CLIENT_*`, `NAVER_SEARCHAD_*` |
| 주간 자동 발굴 (네이버 수요 → Amazon URL 대기) | **Live** | `/recommendations` 「이번 주 추천 새로고침」 · `supplyMode=demand_only` |
| 연관 키워드 확장 | **Live(선택)** | 검색광고 연관어, 체크 시 |
| **Amazon US 소싱·초안·추천** | **주력 · 동작** | URL/ASIN → **PA-API 우선** · HTML 폴백 · 차단 시 FALLBACK |
| Amazon PA-API 5.0 | **연동 완료** | `AMAZON_PAAPI_*` 키 필요 · `npm run smoke:amazon-paapi` |
| 1688 공급 자동검색 | **OFF(stub)** | UI 기본 숨김 · `NEXT_PUBLIC_SHOW_1688_UI=true` 시에만 |
| 1688 실원가 | **레거시** | URL + 수동 CNY (비활성 UI) |
| **시장성 판정** (최소가 vs 경쟁×1.15) | **완료** | SELL / 합배송필요 / 비추천 · 발굴 점수 반영 · 카드 UI |
| **더베이 항공 kg 요금표** | **완료** | 셀러 등급 · CNY 경로 (레거시) |
| **몰테일 미국 LBS 요금표** | **완료** | Amazon 경로 기본 · 유류할증 $1 · USD→KRW |
| **상품 실무게 수집** | **완료(best-effort)** | Amazon 파싱 → 국제배송 견적 · 실패 시 500g |
| 쿠팡 / 알리 / 타오바오 발굴 | **확장 스텁만** | |
| AI 문구 (Gemini) | **선택** | 한도 초과 시 템플릿 폴백 · 점수는 코드 |
| 채널 등록 SS/쿠팡 | **키 있으면 live / 없으면 스텁** | |
| 주문·배대지·수익분석 | **골격+스텁** | |
| SaaS 빌링·멀티유저 | **미착수** | |
| 앱 네비게이션 | **완료** | 왼쪽 사이드바 · 업무 흐름별 메뉴명 |

### 진행 과정 (최근)

1. 발굴 MVP 골격 (네이버↔1688 스텁 + 규칙 점수)
2. Gemini 연동 (추천 이유·상세 문구만)
3. **네이버 실데이터** — 쇼핑검색 + 검색광고 검색량
4. **1688 URL → 실원가** (자동 파싱 실패 시 수동 CNY)
5. **주간 자동 발굴** — 카테고리 시드 → (선택) 연관어 확장 → 추천 목록
6. 스캔 결과 표 + NEW 배지, PENDING 자동 교체
7. 추천 **무시 / 삭제 / 일괄 정리**
8. **시장성 판정** — 가짜 경쟁가(발굴 추정가) 제거, 네이버 시세 + 합배송 시나리오
9. **더베이 항공 요금표** — 고정 1.5만원 대신 무게 구간(셀러)으로 국제배송 계산
10. **몰테일 미국 요금표** — LBS·USD + 유류할증, Amazon 경로에 적용
11. **왼쪽 사이드바 UI** — 발굴·가격 / 상품 등록 / 운영 그룹, 모바일 접이식 메뉴
12. **상품 실무게 수집** — Amazon Shipping/Item Weight, 1688 净重/毛重 → `estimateIntlShipping`
13. **1688 키워드 자동검색** — 검색 HTML 파싱 + 상세 보강, 실패 시 stub
14. **발굴 점수×시장성** — SELL +15 / 합배송 +5 / 비추천 −25·PASS 강등 · 카드에 판매가·경쟁가 강조
15. **1688 실검색 안정화** — marketOffer API → HTML → Playwright · 선택 storageState 로그인
16. **Amazon-first 전환** — 추천 UI 주력을 Amazon URL로, 1688 UI 기본 숨김
17. **Amazon URL 추천 강화** — 몰테일 배송·네이버 시세·시장성 · 폴백($29.99) FALLBACK 배지
18. **Amazon PA-API 5.0** — GetItems(SigV4) 공식 조회 · HTML/폴백 후순위
19. **주간 추천 Amazon-first** — 네이버 수요 카드 → 운영자 Amazon URL 붙이기 · PA-API SearchItems는 승인 후

### 다음 방향 (우선순위)

1. Associates/PA-API 승인 후 SearchItems로 ASIN 자동 제안  
2. PA-API 키 발급·스모크 검증  
3. 채널 API·등록 live · SaaS  
4. 1688은 보류(해외 가입/제재) |

### 목표 스펙 vs 지금 (발굴)

목표: 네이버가 “이번 주 수요”를 고르고, 운영자가 Amazon URL·원가를 붙여 확정한다.

| 목표 | 지금 |
|------|------|
| Amazon URL → 추천·초안 | **동작** |
| 주간 키워드 발굴 | **수요 전용** (`demand_only`) · Amazon URL 수동 부착 |
| 경쟁·마진·배송 | 몰테일 US + 네이버 시세(시장성) · URL 부착 후 재산정 |

---

## 제품 단계

| Step | 기능 | 상태 |
|------|------|------|
| 0 | SaaS DB/ERD (tenants, products, orders, shipments, AI) | **완료** |
| ① | AI 상품 발굴 (Amazon URL 주력 + 네이버 수요 · 1688 레거시 OFF) | **진행 중** |
| ② | AI 상세페이지 제작 | **완료** (키 없으면 템플릿) |
| 1 | 규칙 추천 + AI 이유/상세 + 원클릭 초안 | **완료** |
| 2 | 주문 관리 + 자동주문 파이프라인(1688 스텁·결제 게이트) | **골격** |
| 3 | 배대지 + 송장 자동등록 어댑터 | **골격** |
| 4 | AI 수익분석 대시보드 + 운영 비서 | **골격** |
| 5 | SaaS 빌링 / 멀티유저 고도화 | 미착수 |

기존 유지: Amazon URL/엑셀 초안, 승인→SmartStore/Coupang 등록(키 없으면 스텁), 가격·재고 동기화+스케줄러.

## 기술 스택

- Next.js App Router + Tailwind
- PostgreSQL + Prisma 7 (`prisma.config.ts`, `@prisma/adapter-pg`, client: `src/generated/prisma`)
- Vitest
- AI: Gemini (`GEMINI_API_KEY`) — 점수·KPI는 코드, 문구만 AI

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
| `USD_TO_KRW` / `MARGIN_RATE` / `SHIPPING_FEE_KRW` / `CHINA_SHIPPING_FEE_KRW` / `INTL_SHIPPING_FEE_KRW` / `CARD_FEE_RATE` 등 | 초안·추천 판매가 (배송비는 배대지 실견적 기준으로 조정) |
| `SMARTSTORE_*` / `COUPANG_*` | 채널 API (없으면 스텁) |
| `CRON_SECRET` | 배치 보호 |
| `GEMINI_API_KEY` / `GEMINI_MODEL` / `AI_PROVIDER` | 문구용 Gemini (`npm run ai:import-gemini`) |
| `AMAZON_PAAPI_ACCESS_KEY` / `SECRET_KEY` / `PARTNER_TAG` | Amazon PA-API 5.0 (미국 Associates) |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 오픈API 쇼핑검색 |
| `NAVER_SEARCHAD_ACCESS_KEY` / `SECRET_KEY` / `CUSTOMER_ID` | 검색광고 월간 검색량·연관어 |
| `DISCOVER_NAVER_MODE` | `auto`(키 있으면 live) / `stub` / `live` |
| `DISCOVER_*` / `CNY_TO_KRW` / `DISCOVER_WEEKLY_*` | 발굴·주간 스캔 (`DISCOVER_WEEKLY_SUPPLY_MODE=demand_only` 기본) |
| `CHINA_MALL_ADAPTER` / `AUTO_ORDER_*` / `FORWARDER_*` | 자동주문·배대지 (기본 stub) |

## 동기화·배치

```bash
npm run sync:scheduler
# POST /api/cron/sync
# POST /api/cron/morning-report
# POST /api/cron/discover-weekly   # 주간 자동 발굴 (CRON_SECRET)
```

## ① AI 상품 발굴 (Amazon-first)

점수는 **코드 규칙**. Gemini는 추천 이유 문구만 (한도 시 템플릿).

### UI (`/recommendations`)

1. **Amazon URL / 기존 스캔** — 직접 URL·ASIN → 추천 카드  
2. **이번 주 네이버 수요 후보** — 시드 스캔 → 「Amazon URL 필요」카드 → URL(+USD) 붙이기  
3. **정리** — 무시 / 삭제 / 일괄 정리  
4. **레거시 네이버↔1688** — `NEXT_PUBLIC_SHOW_1688_UI=true` 일 때만 표시  

### 주간 루틴 (운영)

1. 「이번 주 추천 새로고침」실행  
2. 상위 수요 카드 확인 (검색량·경쟁·시세)  
3. Amazon.com에서 상품 찾아 URL 붙이기 (실가는 수동/PA-API)  
4. 시장성 SELL이면 원클릭 초안  

### CLI

```bash
npm run discover:keyword -- "무선선풍기"   # 레거시 1688 경로
npm run discover:weekly -- seasonal_home --limit=2   # demand_only 기본
npm run discover:weekly -- all --expand
npx tsx scripts/smoke-naver-demand.ts 무선선풍기
npm run smoke:discover
# 1688 키워드 검색만 (중국어 키워드 권장)
npm run smoke:1688-search -- 无线风扇
```

권장 운영: **주간 수요 카드 → Amazon URL 부착**, 또는 직접 URL을 `/recommendations`·`/drafts/new`에 붙이기.  

**Amazon PA-API (로봇 차단 회피):** Associates 가입·API 승인 후 `.env`에 키 설정.

```bash
# .env
AMAZON_PAAPI_ACCESS_KEY=...
AMAZON_PAAPI_SECRET_KEY=...
AMAZON_PAAPI_PARTNER_TAG=yourtag-20

npm run smoke:amazon-paapi -- B0CQXG17RL
```

조회 순서: PA-API GetItems → HTML 스크래핑 → FALLBACK($29.99).  

레거시 1688: `DISCOVER_1688_MODE=stub`(기본). UI는 `NEXT_PUBLIC_SHOW_1688_UI=true` 필요.  
`1688:session` / Playwright 실검색은 비권장(계정 제재).

### API

```text
POST /api/discover              { "keyword": "무선선풍기" }
POST /api/discover/weekly       { "category": "all", "expandRelated": true, "supplyMode": "demand_only", "replacePending": true }
POST /api/recommendations/:id/amazon-url   { "url": "https://www.amazon.com/dp/...", "costUsd": 19.99 }
POST /api/recommendations/:id/supply-url   { "supplyUrl": "https://detail.1688.com/offer/....html", "costPriceCny": 23 }
POST /api/recommendations/:id/accept|ignore|unignore|delete
POST /api/recommendations/cleanup   { "mode": "pending"|"pending_stub"|"keep_top"|"purge_ignored" }
GET|POST /api/cron/discover-weekly
```

시드 키워드: `src/lib/discover/seed-keywords.ts`  
수요 전용 발굴: `src/lib/discover/demand-only.ts`  
네이버 live: `src/lib/discover/demand/naver-live.ts`  
Amazon URL 부착: `src/lib/discover/apply-amazon-url.ts`  
1688 URL: `src/lib/discover/supply/fetch-1688-offer.ts`

### 가격이 두 갈래인 이유

| | 발굴 카드 | 초안 판매가 |
|--|-----------|-------------|
| 용도 | 빠른 스크리닝 | 등록용 cost-plus |
| 계산 | 원가×환율×`DISCOVER_LANDED_MULTIPLIER` + 목표마진 | 원가+국제배송+대행+관세+수수료+마진 |
| 기본 배송 | 배수에 포함 | `SHIPPING_FEE_KRW` 등 (기본 1.5만원 → 소형엔 과할 수 있음) |

## AI 가격 결정 (추천 판매가 + 시장성)

원가 + 중국/국제배송 + 관세 + 대행수수료에 마진을 얹고, 카드·플랫폼 수수료를 보정한 뒤 **경쟁상품 가격 밴드**로 클램프합니다. (`src/lib/pricing/recommend.ts`)

추가로 **시장성 판정** (`src/lib/pricing/viability.ts`):

```
최소판매가 ≤ 경쟁평균 × MARKET_CEILING_RATE(1.15)  → SELL
합배송(N건) 가정 최소가만 천장 이하               → NEED_CONSOLIDATION
그 외                                              → NOT_RECOMMENDED
경쟁가 없음                                        → NO_MARKET_DATA
```

발굴 후보→초안 생성 시 경쟁가는 **네이버 쇼핑 최저가 샘플**만 사용합니다.  
발굴 추정 판매가(예: 9,800원)를 경쟁가로 넣지 않습니다.

**국제배송 (더베이 항공 · 셀러)** — `src/lib/forwarder/rates/thebay-air.ts`

| 청구무게 | 요금 |
|----------|------|
| 0.5kg | 3,200원 |
| 1.0kg | 5,000원 |
| … | … |
| 4.0kg | 15,800원 |

무게: Amazon/1688 페이지에서 파싱되면 그 값을 쓰고, 없으면 `DEFAULT_SHIPPING_WEIGHT_G=500`.  
`FORWARDER_SHIPPING_MODE=flat`이면 예전처럼 고정 `SHIPPING_FEE_KRW` 사용.  
파서: `src/lib/product/parse-weight.ts` (초안 `costBreakdown.weightGrams` / 후보 `rawMetrics.weightGrams`).

**몰테일 미국 (일반회원)** — `src/lib/forwarder/rates/malltail-air.ts`

| 청구 LBS | 기본 USD | +유류 $1 |
|----------|----------|----------|
| 0.5 | 10.98 | 11.98 |
| 1 | 11.99 | 12.99 |
| 2 | 13.99 | 14.99 |
| … | … | … |

`feeKrw = totalUsd × USD_TO_KRW`. 델라웨어 센터비는 `MALLTAIL_CENTER_FEE_USD`(기본 0).

부가 정책(안내 기준, 견적에 반영):

- 통관 수수료 / 검수비 / 검역비 **무료** (가산 0)
- 상품보험료 **$15 상당 포함** (별도 청구 없음)
- 부피무게 **50% 할인** 후 실무게와 비교해 청구 LBS 산정 (`dimsInches` 입력 시)

```bash
# UI: /pricing — currency CNY→더베이 / USD→몰테일
# POST /api/pricing/recommend { "cost": 23, "currency": "CNY", "weightGrams": 300 }
# POST /api/pricing/recommend { "cost": 29.99, "currency": "USD", "weightGrams": 300 }
```

## Step 1 — 추천 (Amazon / 기존 상품)

```bash
npm run recommend:generate
# UI: /recommendations (Amazon URL / 기존 스캔)
```

## ② AI 상세페이지 제작

```bash
npm run smoke:ai-detail
# UI: /ai-detail , /drafts/:id 「AI 상세 재생성」
```

## Step 2 — 주문 / 자동주문 (1688)

상태: `PENDING` → `SOURCING` → `CART_READY` → `AWAITING_PAYMENT_CONFIRM` → `PAID` → `FORWARDER_ADDRESS_SET` → `PURCHASE_COMPLETE`

기본 스텁 (`AUTO_ORDER_ADAPTER=stub`). 결제 게이트 필수.

```bash
npm run db:apply:auto-order
npm run smoke:auto-order
# UI: /orders/:id
```

## Step 3 — 배대지 / 송장

```bash
npm run smoke:forwarder-invoice
# UI: /shipments
```

키 없으면 스텁. 11번가: `ELEVENST_*`.

## Step 4 — 수익분석 / 운영 비서

```bash
# UI: /analytics
# GET|POST /api/analytics/morning-report
```

KPI는 DB 집계, Gemini는 설명 문구만.

## 주요 API (현재)

- `POST /api/drafts` · `POST /api/ai/detail` · `POST /api/drafts/:id/ai-detail|approve|publish|sync`
- `GET|POST /api/discover` · `POST /api/discover/weekly`
- `POST /api/recommendations/:id/accept|ignore|unignore|delete|supply-url`
- `POST /api/recommendations/cleanup`
- `POST /api/pricing/recommend`
- `GET|POST /api/orders` · auto-order start/confirm-payment
- `GET|POST /api/shipments` · sync-forwarder · register-invoice
- `GET /api/analytics` · assistant · morning-report
- `GET|POST /api/cron/sync` · `morning-report` · `discover-weekly`
- `GET /api/channels/status`

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
npm run smoke:gemini
npx tsx scripts/smoke-naver-demand.ts 무선선풍기
```

## Stage 5 (남은 일 · SaaS)

- 빌링/구독, 테넌트별 API 키 저장
- 세션/초대 기반 멀티유저 UI
- 프로덕션 RLS 또는 미들웨어 강제 테넌트 격리
- 배포 (Docker/클라우드) + cron 운영
