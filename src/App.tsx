import { useEffect, useState, useCallback, useRef } from 'react'
import { initSqlEngine, loadMdbFile, ensureTableLoaded, runQuery } from './db'
import { TableMeta, QueryResult } from './types'
import Sidebar from './components/Sidebar'
import QueryEditor from './components/QueryEditor'
import ResultsTable from './components/ResultsTable'
import DropZone from './components/DropZone'
import styles from './App.module.css'

type EngineState = 'loading' | 'ready' | 'error'

export default function App() {
  const [engineState, setEngineState] = useState<EngineState>('loading')
  const [fileName, setFileName] = useState<string | null>(null)
  const [tables, setTables] = useState<TableMeta[]>([])
  const [activeTable, setActiveTable] = useState<string | null>(null)
  const [sqlText, setSqlText] = useState('')
  const [result, setResult] = useState<QueryResult | null>(null)
  const [resultPage, setResultPage] = useState(0)
  const [running, setRunning] = useState(false)
  const sqlRef = useRef(sqlText)
  useEffect(() => { sqlRef.current = sqlText }, [sqlText])

  // Boot sql.js on mount
  useEffect(() => {
    initSqlEngine()
      .then(() => setEngineState('ready'))
      .catch(() => setEngineState('error'))
  }, [])

  const handleFile = useCallback((buffer: ArrayBuffer, name: string) => {
    try {
      const tableNames = loadMdbFile(buffer)
      setFileName(name)
      setTables(tableNames.map(n => ({
        name: n,
        rowCount: null,
        loaded: false,
        loading: false,
        error: null,
      })))
      setActiveTable(null)
      setResult(null)
      setSqlText('')
    } catch (e) {
      alert(`Failed to open file: ${e instanceof Error ? e.message : e}`)
    }
  }, [])

  const loadTable = useCallback(async (tableName: string) => {
    setTables(prev => prev.map(t =>
      t.name === tableName ? { ...t, loading: true, error: null } : t
    ))
    try {
      const { rowCount } = await ensureTableLoaded(tableName)
      setTables(prev => prev.map(t =>
        t.name === tableName ? { ...t, loaded: true, loading: false, rowCount } : t
      ))
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setTables(prev => prev.map(t =>
        t.name === tableName ? { ...t, loading: false, error: msg } : t
      ))
      return false
    }
  }, [])

  const handleTableClick = useCallback(async (name: string) => {
    setActiveTable(name)
    const q = `SELECT * FROM \`${name}\` LIMIT 100`
    setSqlText(q)
    await loadTable(name)
    // Run the query after loading
    const t0 = performance.now()
    try {
      const { columns, rows } = runQuery(q)
      setResult({ columns, rows, duration: Math.round(performance.now() - t0), error: null })
      setResultPage(0)
    } catch (e) {
      setResult({ columns: [], rows: [], duration: 0, error: String(e) })
    }
  }, [loadTable])

  const handleRun = useCallback(async () => {
    if (running) return
    setRunning(true)
    const q = sqlRef.current.trim()

    // Extract table names referenced in the query and ensure they're loaded
    const referenced = [...q.matchAll(/(?:FROM|JOIN)\s+[`"]?(\w+)[`"]?/gi)]
      .map(m => m[1])
    for (const name of referenced) {
      const table = tables.find(t => t.name === name)
      if (table && !table.loaded && !table.loading) {
        await loadTable(name)
      }
    }

    const t0 = performance.now()
    try {
      const { columns, rows } = runQuery(q)
      setResult({ columns, rows, duration: Math.round(performance.now() - t0), error: null })
      setResultPage(0)
    } catch (e) {
      setResult({ columns: [], rows: [], duration: 0, error: String(e) })
    }
    setRunning(false)
  }, [running, tables, loadTable])

  const totalRows = tables.reduce((s, t) => s + (t.rowCount ?? 0), 0)

  return (
    <div className={styles.app}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <span className={styles.logo}>🗄 AccessDB</span>
        <label className={styles.openBtn}>
          Open file
          <input
            type="file"
            accept=".mdb,.accdb"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = ev => {
                if (ev.target?.result instanceof ArrayBuffer) {
                  handleFile(ev.target.result, file.name)
                }
              }
              reader.readAsArrayBuffer(file)
              e.target.value = ''
            }}
          />
        </label>
        {fileName && (
          <>
            <span className={styles.fileName}>{fileName}</span>
            <span className={styles.badge}>
              {tables.length} table{tables.length !== 1 ? 's' : ''}
              {totalRows > 0 && ` · ${totalRows.toLocaleString()} rows loaded`}
            </span>
          </>
        )}
        <span className={styles.spacer} />
        <span className={styles.engine}>
          {engineState === 'loading' && '⏳ Loading engine…'}
          {engineState === 'error' && '❌ Engine failed'}
          {engineState === 'ready' && (fileName ? '● Ready' : '● Engine ready')}
        </span>
      </header>

      {/* Body */}
      <div className={styles.body}>
        {!fileName ? (
          <DropZone onFile={handleFile} />
        ) : (
          <>
            <Sidebar
              tables={tables}
              activeTable={activeTable}
              onSelect={handleTableClick}
            />
            <div className={styles.main}>
              <QueryEditor
                value={sqlText}
                onChange={setSqlText}
                onRun={handleRun}
                disabled={engineState !== 'ready' || running}
              />
              <div className={styles.results}>
                <ResultsTable
                  result={result}
                  page={resultPage}
                  onPageChange={setResultPage}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <footer className={styles.statusbar}>
        <span>sql.js (SQLite in WASM)</span>
        <span>·</span>
        <span>mdb-reader (Access parser)</span>
        <span>·</span>
        <span>SQLite syntax — use LIMIT, not TOP</span>
      </footer>
    </div>
  )
}
