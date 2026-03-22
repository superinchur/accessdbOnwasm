export interface TableMeta {
  name: string
  rowCount: number | null  // null = not yet loaded
  loaded: boolean
  loading: boolean
  error: string | null
}

export interface QueryResult {
  columns: string[]
  rows: (string | number | boolean | null)[][]
  duration: number
  error: string | null
}
