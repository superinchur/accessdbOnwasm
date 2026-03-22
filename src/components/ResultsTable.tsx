import { QueryResult } from '../types'
import { exportToCsv } from '../exportCsv'
import styles from './ResultsTable.module.css'

const PAGE_SIZE = 100

interface Props {
  result: QueryResult | null
  page: number
  onPageChange: (p: number) => void
}

export default function ResultsTable({ result, page, onPageChange }: Props) {
  if (!result) {
    return (
      <div className={styles.empty}>
        Run a query to see results
      </div>
    )
  }

  if (result.error) {
    return <div className={styles.error}>{result.error}</div>
  }

  if (result.columns.length === 0) {
    return (
      <div className={styles.meta}>
        Query executed successfully in {result.duration}ms — no rows returned.
      </div>
    )
  }

  const totalRows = result.rows.length
  const totalPages = Math.ceil(totalRows / PAGE_SIZE)
  const pageRows = result.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className={styles.wrapper}>
      <div className={styles.meta}>
        <span className={styles.count}>{totalRows.toLocaleString()} rows</span>
        <span className={styles.timing}>— {result.duration}ms</span>
        {totalRows > 0 && (
          <button
            className={styles.exportBtn}
            onClick={() => exportToCsv(result.columns, result.rows)}
          >
            Export CSV
          </button>
        )}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {result.columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className={cell === null ? styles.null : ''}>
                    {cell === null ? 'NULL' : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button onClick={() => onPageChange(page - 1)} disabled={page === 0}>← Prev</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}>Next →</button>
        </div>
      )}
    </div>
  )
}
