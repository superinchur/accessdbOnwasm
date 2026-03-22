import { TableMeta } from '../types'
import styles from './Sidebar.module.css'

interface Props {
  tables: TableMeta[]
  activeTable: string | null
  onSelect: (name: string) => void
}

export default function Sidebar({ tables, activeTable, onSelect }: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>Tables</div>
      {tables.length === 0 && (
        <div className={styles.empty}>Open a file to see tables</div>
      )}
      {tables.map(t => (
        <button
          key={t.name}
          className={`${styles.item} ${t.name === activeTable ? styles.active : ''}`}
          onClick={() => onSelect(t.name)}
          title={t.name}
        >
          <span className={styles.icon}>▶</span>
          <span className={styles.name}>{t.name}</span>
          <span className={styles.badge}>
            {t.loading
              ? '…'
              : t.rowCount !== null
              ? t.rowCount.toLocaleString()
              : ''}
          </span>
        </button>
      ))}
    </aside>
  )
}
