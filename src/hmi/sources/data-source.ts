/**
 * HMI Data Source 인터페이스
 *
 * 모든 데이터 소스는 이 인터페이스를 구현합니다.
 *
 * Pull source (DB, SHM, REST):
 *   fetch()가 매번 fresh 데이터를 가져옴
 *
 * Push source (WebSocket, MQTT, Redis pub/sub):
 *   open()에서 연결 후 내부 캐시 유지
 *   fetch()는 _cache 반환 (binder의 폴링 루프와 자연스럽게 통합)
 *
 * 배열 순서 = 머지 우선순위 (나중 소스가 앞 소스를 덮어씀)
 *   예: [DbSource, ShmSource]  →  SHM 값이 DB 값보다 우선
 */
export interface IDataSource {
  /**
   * 현재 태그값 맵을 반환합니다.
   * { TAG_ID: value, ... }
   */
  fetch(): Promise<Record<string, string>>

  /**
   * 연결 초기화. binder 시작 시 자동으로 호출됩니다.
   * WebSocket 연결, MQTT 구독, Redis 연결 등에 사용합니다.
   * Pull source는 구현하지 않아도 됩니다.
   */
  open?(): Promise<void>

  /**
   * 연결 해제. binder 정지 시 자동으로 호출됩니다.
   * WebSocket close, MQTT unsubscribe 등에 사용합니다.
   */
  close?(): void
}
