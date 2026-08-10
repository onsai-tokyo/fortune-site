import { useEffect } from 'react'

interface SeoProps {
  title: string
  description: string
  canonicalPath: string
  noindex?: boolean
}

function setMeta(selector: string, value: string) {
  document.head.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', value)
}

export function Seo({ title, description, canonicalPath, noindex = false }: SeoProps) {
  useEffect(() => {
    const canonicalUrl = new URL(canonicalPath, 'https://fate-lab.com').toString()
    document.title = title
    setMeta('meta[name="description"]', description)
    setMeta('meta[name="robots"]', noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')
    setMeta('meta[property="og:title"]', title)
    setMeta('meta[property="og:description"]', description)
    setMeta('meta[property="og:url"]', canonicalUrl)
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (canonical) canonical.href = canonicalUrl
  }, [title, description, canonicalPath, noindex])

  return null
}
