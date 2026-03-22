# TODOS

## accessdb-bridge

**Priority: P2** — CEF waitForBridge 타임아웃 시 UI 에러 표시
- **What:** `waitForBridge()` 5초 타임아웃 시 현재 throw만 발생. CEF 앱에서 catch 후 사용자에게 "브리지를 시작할 수 없습니다" 메시지 표시 필요.
- **Why:** 타임아웃이 발생해도 사용자가 빈 화면만 보게 됨 — 침묵한 실패.
- **Context:** CEF TypeScript의 `initDB()` 에서 `waitForBridge()` 호출. try/catch + alert() 또는 오버레이 UI 추가 필요. 브리지 서버가 안정화된 후 작업.
- **Depends on:** accessdb-bridge 구현 완료 후

**Priority: P3** — CEF CSP 설정 실제 검증
- **What:** CEF 앱의 CSP(Content Security Policy)가 `http://127.0.0.1:3456` fetch를 허용하는지 실제 CEF 환경에서 테스트.
- **Why:** CSP가 막혀 있으면 전체 아키텍처가 동작하지 않음. CEF 초기화 옵션에 `--disable-web-security` 또는 CSP 헤더 허용 설정 필요할 수 있음.
- **Context:** 설계 문서 ⚠️ 첫 번째 확인 사항. 브리지 exe가 빌드되면 즉시 CEF 환경에서 curl 테스트 + TypeScript fetch 테스트로 확인.
- **Depends on:** accessdb-bridge 구현 완료 후

**Priority: P2** — 브리지 포트 충돌 (다중 인스턴스)
- **What:** 현재 포트 3456 하드코딩. Tauri 앱 여러 인스턴스 동시 실행 시 두 번째 브리지가 `EADDRINUSE`로 즉시 종료됨.
- **Why:** 두 번째 Tauri 인스턴스는 브리지 없이 실행됨 — 조용한 실패.
- **Pros:** 랜덤 포트 자동 탐지 → 다중 인스턴스 지원.
- **Cons:** Tauri에서 CEF로 실제 포트 번호를 전달하는 IPC 메커니즘 필요 (복잡도 증가).
- **Context:** 브리지 안정화 후 작업. `get_bridge_port` Tauri command 추가 + CEF TypeScript의 `BRIDGE` URL 동적 결정 패턴.
- **Effort:** M → CC: S | **Depends on:** accessdb-bridge 구현 완료 후

**Priority: P3** — 캐시 LRU 제한 (메모리 누적)
- **What:** 현재 `Map<string, CacheEntry>` 캐시는 항목 제거 없음. 사용자가 수십 개의 .accdb를 열면 각 DB가 in-memory SQLite 인스턴스를 유지.
- **Why:** 장시간 실행 시 메모리 누적. 큰 DB 파일은 수백MB 가능.
- **Pros:** 가장 최근 N개만 유지 → 안정적인 메모리 풋프린트.
- **Cons:** LRU 구현 추가 (간단하지만 코드 증가).
- **Context:** 사용 패턴이 단일 .accdb 대부분이면 낮은 우선순위. 여러 DB 동시 사용 시 P2로 승격.
- **Effort:** M → CC: S | **Depends on:** accessdb-bridge 구현 완료 후

## Completed
<!-- 완료된 항목은 여기로 이동: **Completed:** vX.Y.Z.W (YYYY-MM-DD) -->
