import type {
  ClasseDefensivo,
  LocalArmazenamento,
  StatusAplicacao,
  TipoMovimentacao,
  UnidadeDefensivo,
  UserRole,
} from './enums'

export interface Profile {
  id: string
  nome: string
  telefone: string | null
  role: UserRole
  ativo: boolean
  created_at: string
}

export interface Fazenda {
  id: string
  nome: string
  municipio: string | null
  uf: string | null
  area_total_ha: number | null
  latitude: number | null
  longitude: number | null
  observacoes: string | null
  created_at: string
  created_by: string | null
}

export interface Talhao {
  id: string
  fazenda_id: string
  nome: string
  cultura_atual: string | null
  area_ha: number | null
  observacoes: string | null
  created_at: string
  fazenda?: Fazenda
}

export interface Defensivo {
  id: string
  nome_comercial: string
  principio_ativo: string
  classe: ClasseDefensivo
  unidade: UnidadeDefensivo
  estoque_minimo: number
  empresa: string | null
  local_armazenamento: LocalArmazenamento | null
  fornecedor_padrao: string | null
  observacoes: string | null
  created_at: string
}

export interface Lote {
  id: string
  defensivo_id: string
  numero_nf: string | null
  fornecedor: string | null
  data_compra: string | null
  quantidade_comprada: number
  quantidade_atual: number
  preco_unitario: number | null
  valor_total: number | null
  data_fabricacao: string | null
  data_vencimento: string | null
  lote_fabricante: string | null
  observacoes: string | null
  created_at: string
  created_by: string | null
  defensivo?: Defensivo
}

export interface LoteFieldView {
  id: string
  defensivo_id: string
  data_compra: string | null
  quantidade_comprada: number
  quantidade_atual: number
  data_fabricacao: string | null
  data_vencimento: string | null
  lote_fabricante: string | null
  observacoes: string | null
  created_at: string
}

export interface Aplicacao {
  id: string
  data: string
  fazenda_id: string
  talhao_id: string
  area_aplicada_ha: number | null
  praga_alvo: string | null
  condicoes_climaticas: string | null
  responsavel_id: string | null
  status: StatusAplicacao
  observacoes: string | null
  created_at: string
  fazenda?: Fazenda
  talhao?: Talhao
  responsavel?: Profile
  itens?: AplicacaoItem[]
}

export interface AplicacaoItem {
  id: string
  aplicacao_id: string
  defensivo_id: string
  lote_id: string
  dose_por_hectare: number | null
  quantidade_usada: number
  quantidade_sobrou: number
  calda_total_l: number | null
  defensivo?: Defensivo
  lote?: Lote
}

export interface Movimentacao {
  id: string
  defensivo_id: string
  lote_id: string | null
  tipo: TipoMovimentacao
  quantidade: number
  data_hora: string
  aplicacao_id: string | null
  usuario_id: string | null
  observacoes: string | null
  defensivo?: Defensivo
  lote?: Lote
  usuario?: Profile
}

// Resultado da função estoque_atual
export interface EstoqueAtual {
  defensivo_id: string
  nome_comercial: string
  principio_ativo: string
  unidade: UnidadeDefensivo
  estoque_minimo: number
  quantidade_total: number
  em_alerta: boolean
}

// Resultado da função lotes_por_vencimento
export interface LoteVencimento {
  lote_id: string
  numero_nf: string | null
  quantidade_atual: number
  data_vencimento: string | null
  dias_para_vencer: number | null
  status_vencimento: 'ok' | 'proximo' | 'vencido'
}
