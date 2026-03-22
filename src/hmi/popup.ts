/**
 * 태그 클릭 시 상세 조회 팝업
 */
import { DbSource } from './sources/db-source'

export function showPopup(tagId: string, currentValue: string, file: string): void {
  const popup = document.getElementById('hmi-popup')!

  // XSS 방지: textContent 사용
  const overlay = document.createElement('div')
  overlay.className = 'popup-overlay'
  overlay.onclick = () => { popup.hidden = true }

  const box = document.createElement('div')
  box.className = 'popup-box'
  box.onclick = (e) => e.stopPropagation()

  const header = document.createElement('div')
  header.className = 'popup-header'
  const title = document.createElement('span')
  title.textContent = tagId
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕'
  closeBtn.onclick = () => { popup.hidden = true }
  header.append(title, closeBtn)

  const body = document.createElement('div')
  body.className = 'popup-body'
  const valueEl = document.createElement('div')
  valueEl.className = 'popup-value'
  valueEl.textContent = currentValue
  const detailEl = document.createElement('div')
  detailEl.className = 'popup-detail'
  detailEl.id = 'popup-detail'
  detailEl.textContent = '조회 중...'
  body.append(valueEl, detailEl)

  box.append(header, body)
  overlay.append(box)
  popup.replaceChildren(overlay)
  popup.hidden = false

  // 상세 쿼리 — SQL 파라미터는 bridge /query로 전달 (tagId는 읽기 전용 DB 조회용)
  const src = new DbSource(file, `SELECT * FROM TAG_MST WHERE TAG_ID = '${tagId.replace(/'/g, "''")}'`)
  src.fetch()
    .catch(() => null)
    .then(result => {
      const detail = document.getElementById('popup-detail')
      if (!detail) return
      if (!result || Object.keys(result).length === 0) {
        detail.textContent = '상세 데이터 없음'
        return
      }
      // XSS 방지: textContent로 각 항목 렌더링
      detail.replaceChildren(
        ...Object.entries(result).map(([k, v]) => {
          const row = document.createElement('div')
          const key = document.createElement('b')
          key.textContent = k
          row.append(key, `: ${v}`)
          return row
        }),
      )
    })
}
