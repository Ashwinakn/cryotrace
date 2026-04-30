/**
 * CryoTrace Offline Queue
 *
 * Buffers API write operations when the device is offline.
 * Automatically flushes buffered operations when connectivity is restored.
 *
 * Usage:
 *   import { offlineQueue } from '../lib/offlineQueue'
 *   offlineQueue.enqueue({ url: '/handoffs', method: 'POST', body: {...} })
 */

export interface QueuedAction {
  id: string
  url: string
  method: 'POST' | 'PUT' | 'PATCH'
  body: any
  headers?: Record<string, string>
  queuedAt: string // ISO timestamp
  label: string    // Human-readable description for the UI
}

const STORAGE_KEY = 'ct_offline_queue'

function load(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function save(queue: QueuedAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

function generateId(): string {
  return `oq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

class OfflineQueue {
  private flushing = false

  enqueue(action: Omit<QueuedAction, 'id' | 'queuedAt'>): void {
    const queue = load()
    queue.push({ ...action, id: generateId(), queuedAt: new Date().toISOString() })
    save(queue)
    console.info(`[OfflineQueue] Queued "${action.label}" (${queue.length} pending)`)
  }

  getPending(): QueuedAction[] {
    return load()
  }

  getPendingCount(): number {
    return load().length
  }

  remove(id: string): void {
    save(load().filter(a => a.id !== id))
  }

  clear(): void {
    save([])
  }

  async flush(): Promise<{ succeeded: number; failed: number }> {
    if (this.flushing) return { succeeded: 0, failed: 0 }
    this.flushing = true

    const queue = load()
    if (queue.length === 0) {
      this.flushing = false
      return { succeeded: 0, failed: 0 }
    }

    console.info(`[OfflineQueue] Flushing ${queue.length} queued actions...`)

    let succeeded = 0
    let failed = 0
    const token = localStorage.getItem('ct_token')

    for (const action of queue) {
      try {
        const res = await fetch(`/api${action.url}`, {
          method: action.method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(action.headers || {}),
          },
          body: JSON.stringify(action.body),
        })
        if (res.ok) {
          this.remove(action.id)
          succeeded++
          console.info(`[OfflineQueue] ✅ "${action.label}" synced`)
        } else {
          // Server-side rejection (e.g. 400 bad payload) — remove to avoid infinite retry
          if (res.status >= 400 && res.status < 500) {
            console.warn(`[OfflineQueue] ❌ "${action.label}" rejected (${res.status}) — discarding`)
            this.remove(action.id)
          } else {
            failed++
          }
        }
      } catch {
        // Network still down — leave in queue
        failed++
      }
    }

    this.flushing = false
    console.info(`[OfflineQueue] Flush complete: ${succeeded} succeeded, ${failed} failed`)
    return { succeeded, failed }
  }
}

export const offlineQueue = new OfflineQueue()

// Auto-flush when connectivity returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.info('[OfflineQueue] Connection restored — auto-flushing...')
    const result = await offlineQueue.flush()
    if (result.succeeded > 0) {
      // Dispatch a custom event so components can refresh
      window.dispatchEvent(new CustomEvent('offlineQueueFlushed', { detail: result }))
    }
  })
}
