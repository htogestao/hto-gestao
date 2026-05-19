/**
 * Gera ícones PWA simples usando canvas (Node.js + canvas)
 * Execute: node generate-icons.mjs
 *
 * Se não tiver canvas instalado, use o método alternativo:
 * Coloque manualmente os arquivos icon-192.png e icon-512.png em public/icons/
 */

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Fundo verde escuro
  ctx.fillStyle = '#14532d'
  ctx.fillRect(0, 0, size, size)

  // Círculo verde claro
  ctx.fillStyle = '#16a34a'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2)
  ctx.fill()

  // Letra H
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${size * 0.45}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('H', size / 2, size / 2)

  return canvas.toBuffer('image/png')
}

const iconsDir = join(__dirname, 'public', 'icons')
if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true })

try {
  writeFileSync(join(iconsDir, 'icon-192.png'), generateIcon(192))
  writeFileSync(join(iconsDir, 'icon-512.png'), generateIcon(512))
  console.log('✅ Ícones gerados em public/icons/')
} catch (e) {
  console.error('❌ Erro:', e.message)
  console.log('\nInstale o canvas: npm install canvas')
  console.log('Ou coloque ícones PNG manualmente em packages/web/public/icons/')
}
