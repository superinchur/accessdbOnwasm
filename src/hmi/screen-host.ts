/**
 * HMI Screen Host
 *
 * SVG 파일을 fetch해서 #hmi-screen에 주입하고,
 * SVG 안의 <script> 태그를 실행합니다.
 *
 * 화면 전환 시 이전 binder의 폴링을 정리합니다 (메모리 누수 방지).
 */
import { startBinder, BinderConfig } from './data-binder'

let stopCurrentBinder: (() => void) | null = null

export async function loadScreen(svgUrl: string, config: BinderConfig): Promise<void> {
  // 기존 binder 정지
  if (stopCurrentBinder) {
    stopCurrentBinder()
    stopCurrentBinder = null
  }

  // SVG 로드
  const res = await fetch(svgUrl)
  if (!res.ok) throw new Error(`SVG 로드 실패: ${svgUrl} (${res.status})`)
  const svgText = await res.text()

  // DOM 주입
  const container = document.getElementById('hmi-screen')
  if (!container) throw new Error('#hmi-screen element not found')
  container.innerHTML = svgText

  // <script> 실행 (innerHTML은 스크립트를 실행하지 않음)
  executeScripts(container)

  // 새 binder 시작
  stopCurrentBinder = startBinder(config)
}

/**
 * innerHTML로 주입된 SVG의 <script> 태그는 브라우저가 실행하지 않습니다.
 * 새 <script> 요소로 교체해야 실행됩니다.
 */
function executeScripts(container: Element): void {
  container.querySelectorAll('script').forEach(old => {
    const s = document.createElement('script')
    if (old.src) {
      s.src = old.src
    } else {
      s.textContent = old.textContent
    }
    // 원본 속성 복사
    Array.from(old.attributes).forEach(attr => {
      if (attr.name !== 'src') s.setAttribute(attr.name, attr.value)
    })
    old.replaceWith(s)
  })
}
