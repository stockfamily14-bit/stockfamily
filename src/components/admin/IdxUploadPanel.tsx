'use client'

import { useCallback, useRef, useState } from 'react'

const BATCH_SIZE = 10

type FileStatus = {
  filename: string
  state: 'pending' | 'uploading' | 'success' | 'error'
  detail?: string
}

export default function IdxUploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [statuses, setStatuses] = useState<FileStatus[]>([])
  const [busy, setBusy] = useState(false)

  const uploadFiles = useCallback(async (fileList: File[]) => {
    const xlsxFiles = fileList.filter((file) =>
      file.name.toLowerCase().endsWith('.xlsx'),
    )

    if (xlsxFiles.length === 0) {
      setStatuses([
        {
          filename: '-',
          state: 'error',
          detail: 'Pilih file .xlsx (Ringkasan Saham IDX).',
        },
      ])
      return
    }

    setBusy(true)
    setStatuses(
      xlsxFiles.map((file) => ({ filename: file.name, state: 'pending' })),
    )

    for (let i = 0; i < xlsxFiles.length; i += BATCH_SIZE) {
      const batch = xlsxFiles.slice(i, i + BATCH_SIZE)
      const names = new Set(batch.map((file) => file.name))

      setStatuses((prev) =>
        prev.map((item) =>
          names.has(item.filename) ? { ...item, state: 'uploading' } : item,
        ),
      )

      const formData = new FormData()
      batch.forEach((file) => formData.append('files', file))

      try {
        const response = await fetch('/api/admin/upload-idx-summary', {
          method: 'POST',
          body: formData,
        })
        const json = await response.json()
        const results: Array<{
          filename: string
          ok: boolean
          tradeDate?: string
          rows?: number
          error?: string
        }> = json.results ?? []

        setStatuses((prev) =>
          prev.map((item) => {
            const match = results.find((row) => row.filename === item.filename)
            if (!match) {
              if (!names.has(item.filename)) return item
              return {
                ...item,
                state: 'error',
                detail: json.message ?? 'Batch gagal.',
              }
            }
            if (match.ok) {
              return {
                ...item,
                state: 'success',
                detail: `${match.rows} baris · ${match.tradeDate}`,
              }
            }
            return {
              ...item,
              state: 'error',
              detail: match.error ?? 'Gagal upload.',
            }
          }),
        )
      } catch (error) {
        setStatuses((prev) =>
          prev.map((item) =>
            names.has(item.filename)
              ? {
                  ...item,
                  state: 'error',
                  detail:
                    error instanceof Error ? error.message : 'Network error.',
                }
              : item,
          ),
        )
      }
    }

    setBusy(false)
  }, [])

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    void uploadFiles(Array.from(files))
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        multiple
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files)
          event.target.value = ''
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)
          onFiles(event.dataTransfer.files)
        }}
        className={`w-full rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragActive
            ? 'border-emerald-400 bg-emerald-500/10'
            : 'border-slate-700 bg-slate-950/50 hover:border-emerald-500/60 hover:bg-emerald-500/5'
        } ${busy ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
      >
        <p className="text-sm font-medium text-slate-200">
          Drag & drop file .xlsx di sini, atau klik untuk pilih file (bisa banyak sekaligus)
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Upload diproses per batch 10 file. Tanggal diambil dari nama file IDX
          (contoh: Ringkasan Saham-20240915.xlsx).
        </p>
      </button>

      {statuses.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          {statuses.map((item) => (
            <div
              key={item.filename}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium text-slate-200">{item.filename}</p>
                {item.detail && (
                  <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  item.state === 'success'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : item.state === 'error'
                      ? 'bg-red-500/15 text-red-400'
                      : item.state === 'uploading'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-slate-800 text-slate-400'
                }`}
              >
                {item.state}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
