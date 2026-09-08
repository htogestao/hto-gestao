// Compara manifest.json (origem) com a saída de 04_verify.sql rodada no
// banco restaurado (CSV: tabela,linhas,checksum). Sai com erro se divergir.
// USO: node backup/compare.mjs out/manifest.json restored.csv
import { readFileSync } from 'node:fs'
const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const restored = Object.fromEntries(
  readFileSync(process.argv[3], 'utf8').trim().split('\n').filter(Boolean)
    .map(l => { const [t, n, h] = l.split(','); return [t, { linhas: Number(n), checksum: h }] })
)
let erros = 0
console.log('tabela'.padEnd(28) + 'origem'.padStart(8) + 'restaurado'.padStart(12) + '  checksum')
for (const [t, o] of Object.entries(manifest.tabelas)) {
  const r = restored[t]
  const ok = r && r.linhas === o.linhas && r.checksum === o.checksum
  if (!ok) erros++
  console.log(t.padEnd(28) + String(o.linhas).padStart(8) + String(r ? r.linhas : '-').padStart(12) + (ok ? '  igual' : '  DIFERENTE'))
}
if (erros) { console.error(`\nFALHOU: ${erros} tabela(s) divergem da origem.`); process.exit(1) }
console.log(`\nOK: ${Object.keys(manifest.tabelas).length} tabelas restauradas idênticas à origem (contagem e checksum).`)
