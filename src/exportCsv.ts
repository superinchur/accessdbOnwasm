/**
 * RFC 4180 CSV export. NULL → empty cell.
 * Uses CRLF line endings for Excel compatibility.
 */
export function exportToCsv(columns: string[], rows: (string | number | boolean | null)[][]): void {
  const escape = (v: string | number | boolean | null): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const lines: string[] = [
    columns.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ]

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'query-result.csv'
  a.click()
  URL.revokeObjectURL(url)
}
