/**
 * HMI Data Binder
 *
 * IDataSource 배열을 폴링해서 [data-hmi-tag] 요소를 업데이트합니다.
 * 소스 추가/교체는 BinderConfig.sources 배열만 바꾸면 됩니다.
 *
 * 머지 순서: 배열 앞 → 뒤 (나중 소스가 앞 소스를 덮어씀)
 *   [DbSource, ShmSource]  →  SHM이 DB보다 우선 (실시간 우선)
 */
import type { IDataSource } from './sources/data-source'

export interface BinderConfig {
  sources: IDataSource[]
  pollInterval?: number  // ms (기본 2000)
  onTagClick?: (tagId: string, value: string) => void
}

export function startBinder(config: BinderConfig): () => void {
  const { sources, pollInterval = 2000, onTagClick } = config

  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null

  // open() 이 있는 소스(WebSocket 등) 초기화
  Promise.all(sources.map(s => s.open?.())).catch(e =>
    console.error('[HMI binder] source open error:', e),
  )

  setupClickHandlers(onTagClick)

  async function poll() {
    if (stopped) return
    try {
      const results = await Promise.allSettled(sources.map(s => s.fetch()))
      const merged: Record<string, string> = {}
      for (const r of results) {
        if (r.status === 'fulfilled') Object.assign(merged, r.value)
        else console.error('[HMI binder] source fetch error:', r.reason)
      }
      updateDOM(merged)
    } catch (e) {
      console.error('[HMI binder] poll error:', e)
    }
    if (!stopped) timer = setTimeout(poll, pollInterval)
  }

  poll()

  return () => {
    stopped = true
    if (timer != null) clearTimeout(timer)
    sources.forEach(s => s.close?.())
  }
}

// ── DOM 업데이트 ──────────────────────────────────────────────────────────────

function updateDOM(tags: Record<string, string>) {
  for (const [tagId, value] of Object.entries(tags)) {
    document.querySelectorAll<Element>(`[data-hmi-tag="${tagId}"]`).forEach(el => {
      // 텍스트 업데이트
      if (['text', 'tspan', 'div', 'span', 'p'].includes(el.tagName.toLowerCase())) {
        el.textContent = value
      }

      // 상태 색상 클래스
      const dataOn  = el.getAttribute('data-on')
      const dataOff = el.getAttribute('data-off')
      if (dataOn || dataOff) {
        el.classList.remove('hmi-state-on', 'hmi-state-off', 'hmi-state-alarm')
        if      (dataOn  && value === dataOn)  el.classList.add('hmi-state-on')
        else if (dataOff && value === dataOff) el.classList.add('hmi-state-off')
        else                                   el.classList.add('hmi-state-alarm')
      }

      // SVG script에서 읽을 수 있도록 현재값 보존
      el.setAttribute('data-value', value)
    })
  }
}

// ── 클릭 핸들러 ───────────────────────────────────────────────────────────────

function setupClickHandlers(onTagClick?: (tagId: string, value: string) => void) {
  const screen = document.getElementById('hmi-screen')
  if (!screen || !onTagClick) return

  screen.addEventListener('click', (e) => {
    const target = (e.target as Element).closest('[data-hmi-tag]')
    if (!target) return
    onTagClick(
      target.getAttribute('data-hmi-tag')!,
      target.getAttribute('data-value') ?? '',
    )
  })
}
