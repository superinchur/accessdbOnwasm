/**
 * WebSocket Data Source (Push source 예시)
 *
 * 서버가 JSON 메시지를 push합니다:
 *   {"PUMP_001_STATUS":"RUN","PUMP_001_SPEED":"1450"}
 *
 * 사용:
 *   new WsSource('ws://localhost:8080/tags')
 */
import type { IDataSource } from './data-source'

export class WsSource implements IDataSource {
  private ws: WebSocket | null = null
  private _cache: Record<string, string> = {}

  constructor(private readonly url: string) {}

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => resolve()

      this.ws.onerror = (e) => reject(new Error(`WsSource: 연결 실패 — ${this.url}`))

      this.ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string) as Record<string, string>
          // 수신한 값을 캐시에 머지 (전체 교체가 아닌 부분 업데이트 지원)
          Object.assign(this._cache, data)
        } catch {
          console.error('[WsSource] 파싱 실패:', e.data)
        }
      }

      this.ws.onclose = () => {
        console.warn('[WsSource] 연결 종료:', this.url)
      }
    })
  }

  async fetch(): Promise<Record<string, string>> {
    // Push source: 마지막으로 받은 캐시를 그대로 반환
    return { ...this._cache }
  }

  close(): void {
    this.ws?.close()
    this.ws = null
  }
}
