import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  ConnectorEvent,
  ConnectorError,
  ConnectorErrorType,
  requestRoninWalletConnector,
} from '@sky-mavis/tanto-connect'

type RoninConnector = Awaited<ReturnType<typeof requestRoninWalletConnector>>

interface AuthState {
  address: string | null
  isConnected: boolean
  loading: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [connector, setConnector] = useState<RoninConnector | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const connectorRef = useRef<RoninConnector | null>(null)

  const disconnect = useCallback(() => {
    connectorRef.current?.disconnect?.()
    connectorRef.current = null
    setConnector(null)
    setAddress(null)
    setError(null)
  }, [])

  const connect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let c = connector ?? connectorRef.current
      if (!c) {
        try {
          c = await requestRoninWalletConnector()
          connectorRef.current = c
          setConnector(c)
        } catch (e: unknown) {
          if (e instanceof ConnectorError && e.name === ConnectorErrorType.PROVIDER_NOT_FOUND) {
            setError(ConnectorErrorType.PROVIDER_NOT_FOUND)
            window.open('https://wallet.roninchain.com', '_blank')
          }
          setLoading(false)
          return
        }
      }
      const result = await c.connect()
      if (result && typeof result === 'object' && 'account' in result) {
        setAddress((result as { account: string }).account)
      }
    } catch (e: unknown) {
      if (e instanceof ConnectorError) {
        if (e.name === ConnectorErrorType.PROVIDER_NOT_FOUND) {
          setError(ConnectorErrorType.PROVIDER_NOT_FOUND)
          window.open('https://wallet.roninchain.com', '_blank')
        } else {
          setError(e.message ?? String(e))
        }
      } else {
        setError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      setLoading(false)
    }
  }, [connector])

  useEffect(() => {
    let mounted = true
    let c: RoninConnector | null = null
    requestRoninWalletConnector()
      .then((roninConnector) => {
        if (!mounted) return
        c = roninConnector
        connectorRef.current = roninConnector
        setConnector(roninConnector)

        roninConnector.on(ConnectorEvent.CONNECT, (result: unknown) => {
          const r = result as { account?: string }
          if (mounted && r?.account) setAddress(r.account)
        })
        roninConnector.on(ConnectorEvent.ACCOUNTS_CHANGED, (accounts: unknown) => {
          const a = accounts as string[]
          if (mounted && a?.[0]) setAddress(a[0])
        })
        roninConnector.on(ConnectorEvent.DISCONNECT, () => {
          if (mounted) {
            setAddress(null)
            connectorRef.current = null
            setConnector(null)
          }
        })

        void roninConnector.autoConnect?.()?.then((result: unknown) => {
          const r = result as { account?: string } | null
          if (mounted && r?.account) setAddress(r.account)
        })
      })
      .catch((e: unknown) => {
        if (mounted && e instanceof ConnectorError) {
          setError(e.name)
        }
      })
    return () => {
      mounted = false
      c?.disconnect?.()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        address,
        isConnected: !!address,
        loading,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
