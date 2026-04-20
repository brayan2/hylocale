'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { validateCredentials } from '@/lib/hygraph'

export function ConnectForm() {
  const router = useRouter()
  const [endpoint, setEndpoint] = useState('')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const trimmedEndpoint = endpoint.trim()
      const trimmedToken = token.trim()

      if (!trimmedEndpoint.startsWith('https://')) {
        throw new Error('Endpoint must start with https://')
      }

      await validateCredentials({ endpoint: trimmedEndpoint, token: trimmedToken })

      sessionStorage.setItem('hg_endpoint', trimmedEndpoint)
      sessionStorage.setItem('hg_token', trimmedToken)

      router.push('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
        setError('Invalid token — make sure you have at least read access to the Content API.')
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setError('Cannot reach the endpoint. Check the URL and try again.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-lg shadow-black/5 dark:shadow-black/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Connect your project</CardTitle>
        <CardDescription>
          Your credentials are used only in this browser session and never sent to any server.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="endpoint">Content API Endpoint</Label>
            <Input
              id="endpoint"
              type="url"
              placeholder="https://api.hygraph.com/v2/..."
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              required
              disabled={loading}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Found in your Hygraph project under API Access → Endpoints
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="token">API Token</Label>
            <div className="relative">
              <Input
                id="token"
                type={showToken ? 'text' : 'password'}
                placeholder="eyJ..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                disabled={loading}
                className="font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use a Permanent Auth Token with read access — no write permissions needed
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full gap-2" disabled={loading || !endpoint || !token}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                Check my project
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
