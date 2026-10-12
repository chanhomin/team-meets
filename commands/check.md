---
description: 프로젝트가 CLAUDE.md의 하드 제약과 SPEC.md의 범위를 지키는지 점검한다 (읽기 전용)
allowed-tools: Glob, Grep, Read, Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---

프로젝트 폴더의 코드가 하드 제약을 지키는지 점검하고 결과만 보고한다.
**파일을 수정하지 않는다.** 위반을 발견해도 고치지 말고 위치와 이유만 알린다.

점검 대상은 `index.html`과 거기서 불러오는 `.js`, `.css` 파일이다. 대상 파일이 아직 없으면 "점검할 코드 없음"이라고 한 줄만 답하고 끝낸다.
`$ARGUMENTS`가 있으면 그 파일이나 폴더만 점검한다.

## 점검 항목

각 항목을 Grep, Glob, Read로 직접 확인한다. 추측으로 통과 처리하지 않는다.

### 1. 금지된 서비스와 플랫폼 API (위반)
다음 패턴을 검색한다: `claude\.use|window\.claude|firebase|firestore|supabase|onSnapshot|XMLHttpRequest|WebSocket|EventSource|sendBeacon`
하나라도 코드에 있으면 위반이다. 주석이나 문서에 적힌 것만이면 "경고(문서 언급)"로 구분한다.

### 2. 외부 요청 (위반 또는 경고)
- `fetch\(|axios|\$\.ajax` 호출이 있으면 목적지를 확인한다. 같은 폴더의 파일을 읽는 `fetch`는 파일을 직접 열었을 때 실패하므로 경고, 외부 서버로 가는 요청은 위반이다.
- `<script src="https?://` 또는 `<link href="https?://` 같은 외부 CDN은 경고로 표시한다. 오프라인이나 CDN 장애 시 동작하지 않는다.

### 3. 계정과 권한 (위반)
다음 단어를 검색한다: `login|signin|sign-in|signup|password|로그인|회원가입|비밀번호|권한|owner|editor|viewer`
UI나 로직에 계정 개념이 있으면 위반이다. 변수명이 우연히 겹친 경우는 맥락을 보고 구분한다.

### 4. 키와 비밀 (위반)
- 코드에서 `sk-[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_\-]{20,}|api[_-]?key|secret|token|Bearer ` 를 검색한다.
- `Glob`으로 `.env*` 파일이 있는지 확인한다.
- `git log -p`는 쓰지 말고, `git status`로 `.env` 같은 파일이 추적 대상인지만 확인한다.

### 5. 파일을 그냥 열어도 동작하는지 (경고)
- `type="module"` 스크립트나 `import ... from` 구문이 있으면 `file://`로 열 때 막힐 수 있다. 위치를 알린다.
- localStorage 읽기(`localStorage.getItem`, `JSON.parse`)가 try/catch 밖에 있으면 경고한다.
- 이 점검은 코드를 읽어서 하는 것이다. **브라우저에서 실제로 열어본 결과가 아니다.**

### 6. 빌드 도구 (위반)
`Glob`으로 `package.json`, `vite.config.*`, `webpack.config.*`, `tsconfig.json`, `node_modules`, `*.jsx`, `*.tsx`, `*.ts`를 찾는다. 있으면 위반이다.

### 7. 화면 수 (위반 기준: 4개 이상)
HTML에서 탭, 뷰, 섹션 전환으로 구분되는 화면을 모두 나열하고 개수를 센다. 3개 이하면 통과다. 어떤 기준으로 셌는지 한 줄 적는다.

### 8. 범위 밖 기능 (경고)
SPEC.md의 "만들지 않을 것"에 해당하는 흔적을 검색한다: `추천|확정|지난주|불러오기|prefers-color-scheme|dark|Notification|캘린더|calendar|메모|location\.hash|URLSearchParams|setInterval`
(`location.hash`, `URLSearchParams`는 링크 공유, `setInterval`은 자동 동기화 시도의 흔적일 수 있다.)
해당하는 기능이 실제로 구현돼 있으면 어느 항목인지 알린다. 단순한 글자 일치는 맥락을 보고 제외한다.

## 보고 형식

아래 표로 한 번에 보고한다. 근거가 있는 항목은 `파일:줄번호`를 적는다.

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 금지 서비스·플랫폼 API | 통과 / 경고 / 위반 | |
| 2 | 외부 요청 | | |
| 3 | 계정·권한 | | |
| 4 | 키·비밀 | | |
| 5 | 파일 직접 열기 호환 | | |
| 6 | 빌드 도구 | | |
| 7 | 화면 수 (N개) | | |
| 8 | 범위 밖 기능 | | |

표 아래에 다음을 쓴다.
- **요약**: 위반 n건, 경고 n건 (한 줄)
- **확인 안 됨**: 이 점검으로는 알 수 없는 것. 반드시 다음 두 가지를 포함한다.
  - `index.html`을 브라우저에서 파일로 직접 열어 동작하는지 (사람이 직접 확인)
  - 공유 코드가 실제 다른 브라우저에서 합쳐지는지 (사람이 직접 확인)
- 위반이 있으면 고치지 않고 "고칠지 알려주세요"로 끝낸다.
