import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import {
  getFontFaceStyles,
  getFontLinks,
  getInitialStyles,
} from '@porsche-design-system/components-react/partials'

const porschePartialsPlugin = () => ({
  name: 'porsche-partials',
  transformIndexHtml(html: string) {
    const partials = [
      getInitialStyles(),
      getFontFaceStyles(),
      getFontLinks({ weights: ['regular', 'semi-bold', 'bold'] }),
    ].join('')
    return html.replace('</head>', `${partials}</head>`)
  },
})

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    porschePartialsPlugin(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
  ],
})
