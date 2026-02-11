import { useState, useEffect, useRef } from 'react'
import { onDBChange } from '../db/database.js'

/**
 * Drop-in replacement for dexie-react-hooks `useLiveQuery`.
 *
 * Re-runs `queryFn` on mount, whenever `deps` change, and whenever any
 * database mutation calls `notifyChange()` from database.js.
 *
 * Returns `undefined` while the first fetch is in flight (matches Dexie behaviour).
 */
export function useLiveQuery(queryFn, deps = []) {
  const [data, setData]     = useState(undefined)
  const [version, setVersion] = useState(0)
  const cancelRef = useRef(false)

  // Re-fetch when DB mutates
  useEffect(() => {
    const unsub = onDBChange(() => setVersion(v => v + 1))
    return unsub
  }, [])

  // Run the query
  useEffect(() => {
    cancelRef.current = false
    queryFn()
      .then(result => { if (!cancelRef.current) setData(result) })
      .catch(err   => { console.error('[useLiveQuery]', err) })
    return () => { cancelRef.current = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version])

  return data
}
