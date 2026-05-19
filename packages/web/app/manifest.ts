import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HtoGestão',
    short_name: 'HtoGestão',
    description: 'Sistema de Gestão Agrícola',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#14532d',
    theme_color: '#14532d',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
