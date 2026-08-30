import { Compass } from 'lucide-react'
import { ButtonLink, Card } from '../components/ui'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-8 sm:py-16">
      <Card className="text-center">
        <Compass className="mx-auto text-accent" size={34} aria-hidden="true" />
        <p className="eyebrow mt-4">Page not found</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">That page is not in this guide</h1>
        <p className="mt-2 text-sm text-muted">
          The address may be out of date. Your practice history is still safe on this device.
        </p>
        <ButtonLink to="/" className="mt-5">Return home</ButtonLink>
      </Card>
    </div>
  )
}
