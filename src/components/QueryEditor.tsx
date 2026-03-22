import { useEffect, useRef } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { lineNumbers, highlightActiveLineGutter, highlightSpecialChars } from '@codemirror/view'
import { bracketMatching, foldGutter } from '@codemirror/language'
import styles from './QueryEditor.module.css'

interface Props {
  value: string
  onChange: (v: string) => void
  onRun: () => void
  disabled: boolean
}

export default function QueryEditor({ value, onChange, onRun, disabled }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!editorRef.current) return

    const runKeymap = keymap.of([
      {
        key: 'Ctrl-Enter',
        run: () => { onRun(); return true },
      },
      {
        key: 'Mod-Enter',
        run: () => { onRun(); return true },
      },
    ])

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          bracketMatching(),
          foldGutter(),
          sql(),
          oneDark,
          runKeymap,
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              onChange(update.state.doc.toString())
            }
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '12px' },
            '.cm-scroller': { overflow: 'auto', fontFamily: "'Cascadia Code', 'Fira Code', monospace" },
          }),
        ],
      }),
      parent: editorRef.current,
    })

    viewRef.current = view
    return () => view.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep external value in sync when table click changes it
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }
  }, [value])

  // Keep onRun ref current without recreating the editor
  const onRunRef = useRef(onRun)
  useEffect(() => { onRunRef.current = onRun }, [onRun])

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className={styles.label}>SQL Query</span>
        <span className={styles.hint}>Ctrl+Enter to run · SQLite syntax</span>
        <button
          className={styles.runBtn}
          onClick={onRun}
          disabled={disabled}
        >
          ▶ Run
        </button>
      </div>
      <div ref={editorRef} className={styles.editor} />
    </div>
  )
}
