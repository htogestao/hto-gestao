export type UserRole = 'admin' | 'viewer' | 'field'

export type ClasseDefensivo =
  | 'herbicida'
  | 'fungicida'
  | 'inseticida'
  | 'acaricida'
  | 'adjuvante'
  | 'espalhante_adesivo'
  | 'fertilizante'
  | 'fertilizante_foliar'
  | 'adubo_foliar'
  | 'nematicida'
  | 'inoculante'
  | 'maturador'
  | 'regulador_crescimento'
  | 'ativador_crescimento'
  | 'biologico'
  | 'fungicida_herbicida'
  | 'outro'

export const CLASSE_LABELS: Record<ClasseDefensivo, string> = {
  herbicida: 'Herbicida',
  fungicida: 'Fungicida',
  inseticida: 'Inseticida',
  acaricida: 'Acaricida',
  adjuvante: 'Adjuvante',
  espalhante_adesivo: 'Espalhante Adesivo',
  fertilizante: 'Fertilizante',
  fertilizante_foliar: 'Fertilizante Foliar',
  adubo_foliar: 'Adubo Foliar',
  nematicida: 'Nematicida',
  inoculante: 'Inoculante',
  maturador: 'Maturador',
  regulador_crescimento: 'Regulador de Crescimento',
  ativador_crescimento: 'Ativador de Crescimento',
  biologico: 'Biológico',
  fungicida_herbicida: 'Fungicida/Herbicida',
  outro: 'Outro',
}

export type UnidadeDefensivo = 'L' | 'kg'

export type LocalArmazenamento =
  | 'quartinho'
  | 'container'
  | 'quartinho_container'
  | 'outro'

export const LOCAL_LABELS: Record<LocalArmazenamento, string> = {
  quartinho: 'Quartinho',
  container: 'Container',
  quartinho_container: 'Quartinho/Container',
  outro: 'Outro',
}

export type TipoMovimentacao =
  | 'entrada'
  | 'saida_aplicacao'
  | 'devolucao_sobra'
  | 'ajuste'
  | 'descarte'

export type StatusAplicacao = 'em_andamento' | 'encerrada'

export type StatusVencimento = 'ok' | 'proximo_30' | 'proximo_60' | 'proximo_90' | 'vencido'
