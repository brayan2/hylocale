import { ConnectForm } from '@/components/connect-form'
import { ThemeToggle } from '@/components/theme-toggle'
import { Globe, ShieldCheck, Zap } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Localisation Checker</span>
            <span className="text-xs text-muted-foreground hidden sm:block">by Hygraph</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-xl mx-auto text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full mb-6">
            <Zap className="w-3 h-3" />
            Free &amp; open source
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
            Find missing translations{' '}
            <span className="text-primary">before they hit production</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg leading-relaxed">
            Connect your Hygraph project and instantly see which content entries are missing
            translations across every locale — model by model, locale by locale.
          </p>
        </div>

        {/* Connect card */}
        <ConnectForm />

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-10">
          {[
            { icon: ShieldCheck, label: 'Read-only access' },
            { icon: Globe, label: 'All locales supported' },
            { icon: Zap, label: 'No account required' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full"
            >
              <Icon className="w-3 h-3" />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        <p>
          Open source · Credentials never leave your browser
        </p>
      </footer>
    </main>
  )
}
