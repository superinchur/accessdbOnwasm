import { useRef, useState } from 'react'
import styles from './DropZone.module.css'

interface Props {
  onFile: (buffer: ArrayBuffer, name: string) => void
}

export default function DropZone({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      if (e.target?.result instanceof ArrayBuffer) {
        onFile(e.target.result, file.name)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) readFile(file)
  }

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ''}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div className={styles.icon}>🗄</div>
      <div className={styles.title}>Drop an Access database here</div>
      <div className={styles.sub}>or click to browse · .mdb and .accdb supported</div>
      <input
        ref={inputRef}
        type="file"
        accept=".mdb,.accdb"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
        }}
      />
    </div>
  )
}
