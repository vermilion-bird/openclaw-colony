'use client'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Pause, Play } from 'lucide-react'

interface Props {
  instanceId: string
  onClose: () => void
}

export function LogViewer({ instanceId, onClose }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [paused, setPaused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  useEffect(() => {
    const es = new EventSource(`/api/instances/${instanceId}/logs`)
    es.onmessage = (e) => {
      if (pausedRef.current) return
      const text: string = JSON.parse(e.data)
      setLines(prev => [...prev.slice(-500), text])
    }
    return () => es.close()
  }, [instanceId])

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, paused])

  function togglePause() {
    pausedRef.current = !pausedRef.current
    setPaused(p => !p)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>实例日志</DialogTitle>
          <Button size="sm" variant="outline" onClick={togglePause} className="mr-8">
            {paused ? <><Play className="w-3 h-3 mr-1" />继续</> : <><Pause className="w-3 h-3 mr-1" />暂停</>}
          </Button>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto bg-black rounded p-3 font-mono text-xs text-green-400 space-y-0.5">
          {lines.map((line, i) => <div key={i}>{line}</div>)}
          <div ref={bottomRef} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
