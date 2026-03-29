declare function fbq(...args: unknown[]): void

function fire(...args: unknown[]) {
  if (typeof fbq !== 'undefined') {
    fbq(...args)
  }
}

export const pixel = {
  trackCompleteRegistration() {
    fire('track', 'CompleteRegistration')
  },
  trackPurchase(value: number = 2000) {
    fire('track', 'Purchase', { value, currency: 'JPY' })
  },
  trackViewContent(contentName: string) {
    fire('track', 'ViewContent', { content_name: contentName })
  },
}
