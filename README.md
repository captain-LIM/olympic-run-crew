# 🎤🏃 공연 전 한 바퀴

**같은 공연을 보러 온 사람들끼리, 공연 전 1시간 올림픽공원을 함께 걷고 달리는 번개 매칭 서비스**

> 한국체육산업개발(주) 개방 공공데이터 활용 공모전 출품작
> 활용 데이터: 올림픽공원 대관정보 · 주차장 혼잡도 정보 · 올림픽공원 공연장 실감형 콘텐츠

---

## 기획 배경

KSPO DOME, 올림픽홀 같은 올림픽공원 공연장의 관객은 공연 시작 몇 시간 전에 도착하는 경우가 많습니다. 굿즈를 사고, 주차 혼잡을 피하고, 입장 대기를 하다 보면 **공연 전에 1~3시간이 그냥 지나갑니다.** 이 시간은 대부분 근처 카페나 공연장 앞에서 혼자 보내게 됩니다.

반면 바로 옆에는 산책로와 러닝 코스가 좋은 올림픽공원이 있습니다.

**"공연 전 대기시간"이라는 숨은 수요**를 **"같은 공연을 좋아하는 사람과 공원을 한 바퀴 도는 경험"**으로 바꾸는 것이 이 서비스의 목표입니다.

- **관람객:** 혼자 기다리던 시간이 같은 취향을 가진 사람과의 가벼운 만남이 됩니다.
- **공원 운영:** 관객을 특정 주차장과 공연장 앞에서 공원 곳곳으로 **분산**시킵니다.
- **공연장:** 실감형 콘텐츠로 공연장을 미리 경험하게 해 기대감과 재방문을 높입니다.

## 핵심 기능

| 기능 | 설명 |
|---|---|
| 🎫 **공연별 매칭 룸** | 대관정보 API의 공연(700여 건)을 검색해 고르고 티켓의 날짜·시각을 입력하면, **같은 공연·같은 날짜** 관객끼리 매칭 풀이 만들어집니다. |
| ⚡ **번개 매칭** | 같은 공연, 같은 날짜, 같은 모드(산책/조깅/러닝), 출발 시각 ±15분, 페이스 ±1분/km 조건으로 크루를 찾습니다. 맞는 크루가 없으면 새 번개를 엽니다. |
| ⏱️ **입장 시간 역산** | `공연 시작 − 입장 여유 30분 − 코스 소요 − 공연장까지 이동`을 계산해 공연에 늦지 않는 출발 시각만 허용합니다. |
| 📈 **공연일 혼잡 예측** | 주차 혼잡 이력과 공연장 규모를 합쳐 **"이 공연은 몇 시부터 관객이 몰리고, 몇 시에 가장 붐비는지"**를 30분 단위로 예측하고, 가장 한산한 **추천 산책 시간**을 알려줍니다. |
| 🅿️ **혼잡 기반 분산 추천** | 출발 시각의 예측 혼잡도가 높으면 공연장 바로 앞이 아닌 공원 안쪽 집결지로 분산시킵니다. |
| 👤 **회원가입·로그인** | 이메일·비밀번호 계정(scrypt 해시, httpOnly 세션 쿠키). 크루·채팅·보상이 계정에 저장됩니다. |
| 💬 **크루 채팅** | 크루 멤버끼리만 보이는 채팅. 도배 방지(1초 간격)와 500자 제한이 있고, 공연 3시간 후 종료됩니다. |
| 🚨 **신고·차단** | 크루원·메시지 신고(사유 선택), 서로 다른 2명 이상이 신고한 메시지는 자동으로 가려집니다. 차단하면 서로의 채팅이 보이지 않고 같은 번개에 매칭·참여되지 않습니다. |
| 📍 **위치 체크인** | 집결지 반경 300m 안에서 GPS로 체크인합니다. 수동 체크인도 지원합니다. |
| 🏟️ **실감형 3D 공연장** | 공연장 3D 모델을 웹에서 회전하고 확대해 볼 수 있습니다. |
| 🎁 **완주 보상** | 크루 코스를 완주하면 해당 공연장의 **'무대 앞 시점'**이 해금됩니다. |
| 🛡️ **안전 설계** | 만 14세 미만은 이용할 수 없고, 10대는 10대 전용 크루로 분리합니다. 실명과 연락처는 받지 않고, 집결지는 공개 장소만 씁니다. |

## 활용 공공데이터

| 데이터 | 제공 형태 | 서비스 내 활용 |
|---|---|---|
| [한국체육산업개발(주)_올림픽공원대관정보](https://www.data.go.kr/data/15015212/openapi.do) | OpenAPI (XML, `api.kcisa.kr`) | 행사명(`title`)·대관장소(`spatial`)로 **공연 카탈로그와 매칭 룸**을 만듭니다. 장소를 공연장으로 매핑합니다 (체조경기장→KSPO DOME, K아트홀→우리금융아트홀, 뮤즈라이브→올림픽홀 등). |
| [한국체육산업개발_주차장 혼잡도 정보](https://www.data.go.kr/data/15164156/fileData.do) | CSV (`data/parking-congestion.csv`) | 주차구역 13곳의 원활/혼잡/만차 기록으로 **시간대별 혼잡 이력 지수와 구역별 상태**를 계산합니다. 이 값으로 코스·집결지 추천을 분산시킵니다. |
| [한국체육산업개발_올림픽공원 공연장 실감형 콘텐츠](https://www.data.go.kr/data/15127487/fileData.do) | CSV (`data/venue-3d-contents.csv`) + 3D 파일 | 공연장별 3D 파일 목록을 읽고, GLB 원본을 압축한 모델을 웹 뷰어로 렌더링해 **공연장 미리보기와 완주 보상**에 씁니다. |

### 데이터 처리 방식

- **대관정보:** 응답에 행사 날짜 필드(`temporalCoverage`)가 비어 있습니다. 그래서 공연 카탈로그로만 쓰고, **날짜·시각은 사용자가 티켓 기준으로 입력**합니다. 중복 공연은 제거하고 최근 공연부터 보여줍니다. API 호출은 하루 단위로 캐시합니다.
- **주차장 혼잡도:** 원본의 `등록시간` 분:초 자리에 월:일 값이 들어가 있어 **'시'만 사용**합니다. 혼잡 이력 지수는 `(요일유형·시간대 ±1h 기록의 가중치 합: 원활 0 / 혼잡 0.6 / 만차 1) ÷ 관측일 수`를 0~1로 정규화한 값입니다. 원본(EUC-KR)은 UTF-8로 변환해 저장했습니다.
- **실감형 콘텐츠:** 원본 GLB를 [glTF-Transform](https://gltf-transform.dev) meshopt로 압축해 `public/models/`에 넣었습니다. KSPO DOME은 SketchUp DAE 원본(453MB, 메시 10만 개·삼각형 263만 개)만 제공되어, 직접 만든 스트리밍 변환기(`scripts/sketchup-dae-to-glb.mjs`)로 GLB로 변환한 뒤 압축했습니다(453MB → 26MB). 5개 공연장 모두 웹에서 3D로 볼 수 있고, 실내 공연장은 **지붕을 잘라 내부를 보는 단면 보기**를 지원합니다.
- **API 장애 대비:** 대관정보 API 호출이 실패하면 기본 공연 목록으로 대체되어 서비스는 계속 동작합니다.

### 혼잡 예측 모델 (`src/lib/prediction.ts`)

```
예측지수(t) = min(1, 기저(t) × 0.6 + 공연부하(t))
  기저     = 주차장 혼잡도 CSV로 만든 요일유형·시간대 혼잡 이력 지수 (분 단위 보간)
  공연부하 = 규모계수 × max(본 도착 분포, 조기 도착 분포)
             본 도착: 공연 70분 전 중심(σ 45분) / 조기 도착(굿즈·대기): 공연 3시간 전 중심(σ 60분)
  규모계수 = (공연장 수용 인원 / 15,000)^0.6   — KSPO DOME 만석 공연 = 1
```

- **관객 몰림 시작:** 공연부하가 0.3을 넘는 첫 시각
- **추천 산책 시간:** 출발 가능 구간(공연 150분 전 ~ 45분 전) 중 예측지수 평균이 가장 낮은 60분 구간
- 예) 토요일 18시 KSPO DOME 공연 → 14:30부터 관객 몰림, 17:00 전후 최고, 추천 산책 15:30~16:30
- 공연일과 주차 기록을 직접 연결한 데이터가 없어 도착 분포·규모계수는 가정값입니다. '올림픽공원 차량입출차·공연·날씨 연계 데이터(15164822)'로 보정할 수 있습니다.

## 서비스 흐름

```
공연 목록 (대관정보 + 혼잡도)
   └─▶ 공연 선택 → 티켓 날짜·시각 입력 → 📈 공연일 혼잡 예측 · 추천 산책 시간
         ├─ (로그인/회원가입)
         ├─ 조건 입력 (모드 · 페이스 · 출발 시각)
         ├─ 같은 공연 크루 찾기 ──▶ 참여
         └─ 새 번개 열기 (예측 혼잡 반영 코스 추천 · 입장 시간 검증)
               └─▶ 크루룸
                     ├─ 출발/공연 카운트다운 · 집결지 지도
                     ├─ 💬 크루 채팅 · 🚨 신고/차단
                     ├─ 위치 체크인 → 완주
                     └─▶ 🎁 공연장 3D '무대 시점' 해금 (계정에 저장)
```

## 기술 스택

- **Framework:** Next.js 15 (App Router) · React 19 · TypeScript
- **Styling:** Tailwind CSS 4 (모바일 우선)
- **DB:** MySQL 8 (mysql2) · 스키마 `db/schema.sql`
- **Auth:** scrypt 비밀번호 해시 · DB 세션(토큰 SHA-256 저장) · httpOnly 쿠키
- **3D:** Three.js (GLTFLoader + meshopt, OrbitControls)
- **Data:** fast-xml-parser (공공데이터 XML 파싱)
- **Test:** Vitest

## 시작하기

```bash
git clone https://github.com/captain-LIM/olympic-run-crew.git
cd olympic-run-crew
npm install
cp .env.example .env.local   # 값 채우기 (아래 참고)
npm run db:migrate           # MySQL 테이블 생성
npm run dev
```

브라우저에서 http://localhost:3000 에 접속합니다.

### MySQL 준비

MySQL 8에 데이터베이스와 앱 전용 계정을 만들고 `.env.local`에 접속 정보를 넣습니다.

```sql
CREATE DATABASE olympic_run_crew CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'orc_app'@'localhost' IDENTIFIED BY '<비밀번호>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON olympic_run_crew.* TO 'orc_app'@'localhost';
```

```bash
DATABASE_URL=mysql://orc_app:<비밀번호>@localhost:3306/olympic_run_crew
```

테이블: `users` · `sessions` · `crews` · `crew_members` · `messages` · `reports` · `blocks` · `user_rewards` (모든 시각은 UTC 저장)

### 공공데이터 API 연결

1. [공공데이터포털](https://www.data.go.kr)에서 '한국체육산업개발(주)_올림픽공원대관정보'를 활용신청합니다.
2. `.env.example`을 `.env.local`로 복사하고 서비스키를 넣습니다. (`.env.local`은 git에 올라가지 않습니다)

```bash
KSPO_RENTAL_SERVICE_KEY=발급받은_서비스키
```

주차장 혼잡도와 실감형 콘텐츠는 파일 데이터라 저장소에 포함되어 있어 별도 설정이 필요 없습니다.

### 3D 모델 다시 만들기

원본은 [올림픽공원 공연장 안내 페이지](https://www.ksponco.or.kr/menu.es?mid=a10405050100)에서 받을 수 있습니다. 원본 GLB를 받은 뒤 아래 명령으로 압축합니다.

```bash
npx @gltf-transform/cli@4.1.1 optimize SKHandBall.glb public/models/handball.glb --compress meshopt --texture-compress false
```

KSPO DOME(DAE 원본)은 먼저 GLB로 변환한 뒤 같은 방식으로 압축합니다.

```bash
# kspodome_dae.zip 압축 해제 후
npm run convert:dae -- "<경로>/source/temp_export/temp_export.dae" "<경로>/source/temp_export/temp_export,<경로>/textures" kspo-dome-raw.glb
npx @gltf-transform/cli@4.1.1 optimize kspo-dome-raw.glb public/models/kspo-dome.glb --compress meshopt --texture-compress false
```

| 공연장 | 원본 | 웹용 파일 |
|---|---|---|
| KSPO DOME | `kspodome_dae.zip` (DAE 453MB) | `kspo-dome.glb` (26MB) |
| SK핸드볼경기장 | `skhandball_glb.zip` (75MB) | `handball.glb` (9MB) |
| 우리금융아트홀 | `woori_glb.zip` (162MB) | `woori-art-hall.glb` (13MB) |
| 88잔디마당 | `88_glb.zip` (10MB) | `88-lawn.glb` (5MB) |
| 수변무대 | `lake_glb.zip` (24MB) | `waterside.glb` (3MB) |

### 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run db:migrate` | MySQL 스키마 적용 (반복 실행 안전) |
| `npm test` | 유닛 테스트 (매칭 · 혼잡 예측 · 비밀번호 해시 · XML/CSV 파싱) |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | 린트 |

## 프로젝트 구조

```
src/
├─ app/
│  ├─ page.tsx                 # 홈: 공연 목록 + 혼잡도
│  ├─ events/[id]/page.tsx     # 공연 상세: 번개 찾기 / 열기
│  ├─ crews/[id]/page.tsx      # 크루룸
│  ├─ venues/page.tsx          # 공연장 3D 뷰어
│  ├─ login · signup · account # 로그인 · 회원가입 · 내 계정(내 번개, 차단 관리)
│  └─ api/                     # auth · shows · crews(+messages) · reports · blocks · prediction · congestion
├─ components/                 # ShowSearch · CrewFinder · PredictionCard · CrewRoom · CrewChat · ReportDialog · VenueViewer …
└─ lib/
   ├─ matching.ts              # 매칭 · 입장 시간 검증 · 코스 추천 (순수 함수)
   ├─ congestion.ts            # 혼잡 이력 지수 계산 (순수 함수)
   ├─ prediction.ts            # 공연일 혼잡 예측 (순수 함수)
   ├─ auth.ts · password.ts    # 세션 · 비밀번호 해시
   ├─ db.ts · store.ts         # MySQL 풀 · 크루/채팅/신고/차단 저장소
   ├─ venue3d.ts · park.ts     # 실감형 콘텐츠 CSV 파싱 · 공연장/코스 좌표
   └─ data/                    # 데이터 로더 (대관정보 API · 혼잡도 CSV · 실감형 CSV)
db/schema.sql                  # MySQL 스키마
data/                          # 공공데이터 CSV (UTF-8 변환본)
public/models/                 # 웹용 압축 3D 모델 (GLB)
```

## 매칭 규칙

| 항목 | 기준 |
|---|---|
| 같은 공연 | 대관정보의 동일 행사 + 같은 공연 날짜 |
| 모드 | 산책(기본 12분/km) · 가벼운 조깅(7.5분/km) · 러닝(5.5분/km) |
| 출발 시각 | ±15분 이내 |
| 페이스 | ±1분/km 이내 |
| 출발 가능 시간 | 공연 시작 150분 전부터, 입장 30분 전 도착이 가능한 시각까지 |
| 정원 | 2~8명 |
| 연령 | 10대는 10대 전용 크루, 성인은 성인 크루 |

## 한계와 향후 계획

- **공연 일정:** 대관정보 API에 날짜가 없고 2022년 공연까지만 있어, 사용자가 날짜를 입력합니다. 타 기관 데이터(예: KOPIS 공연예술통합전산망)와 연계하면 일정을 자동으로 채울 수 있습니다.
- **좌표와 코스:** 코스·공연장 좌표는 근사값입니다. 주차구역(P1A~P11)의 위치 정보가 공개되면 구역 단위 분산 안내로 확장할 수 있습니다.
- **예측 보정:** 혼잡 예측의 도착 분포·규모계수는 가정값입니다. 입출차·공연 연계 데이터(15164822)로 보정할 계획입니다.
- **실시간 채팅:** 현재 3초 간격 폴링입니다. 사용자가 많아지면 WebSocket/SSE로 전환합니다.
- **신고 처리:** 신고는 DB에 쌓이고 메시지 자동 가림까지 동작합니다. 운영자 검토 화면은 추후 추가합니다.
- **날씨 연계:** 기상청 단기예보와 연계해 비가 오거나 폭염인 날에는 실내 대기 모드로 전환합니다.

## 데이터 출처

본 서비스는 공공데이터포털(data.go.kr)에서 제공하는 한국체육산업개발(주)의 공공데이터를 활용했습니다.
