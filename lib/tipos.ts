export type Papel = 'adm' | 'gerente' | 'capataz';

export interface Propriedade { id: number; nome: string; papel: Papel }
export interface Especie { id: number; nome: string }
export interface Categoria { id: number; especie_id: number; nome: string; peso_padrao_kg: number | null; ordem: number; ativa: boolean }
export interface Ocorrencia { codigo: string; nome: string; sinal: 1 | -1; exige_valor: boolean; exige_causa: boolean; ordem: number }
export interface Causa { id: number; nome: string }
export interface Potreiro { id: number; propriedade_id: number; codigo: string; area_util_ha: number; ativo: boolean }
export interface Contraparte { id: number; nome: string }

export interface Movimentacao {
  id: number;
  propriedade_id: number;
  data: string;               // AAAA-MM-DD
  categoria_id: number;
  ocorrencia: string;
  quantidade: number;
  causa_morte_id: number | null;
  potreiro_id: number | null;
  contraparte_id: number | null;
  peso_medio_kg: number | null;
  valor_kg: number | null;
  valor_total: number | null;
  observacao: string | null;
  origem?: string;
}

export type NovaMovimentacao = Omit<Movimentacao, 'id' | 'contraparte_id'> & {
  contraparte_id: number | null;
  contraparte_nova?: string;  // nome digitado que ainda não existe no cadastro
};

export interface LinhaEstoque { categoria_id: number; especie_id: number; categoria: string; cabecas: number; peso_padrao_kg: number | null }

export interface LinhaEfetivo {
  especie: string; categoria: string; estoque_inicial: number;
  aquisicao: number; venda_int_entrada: number; venda_int_saida: number; nascimento: number;
  venda: number; morte: number; consumo: number; tcat_entrada: number; tcat_saida: number;
  estoque_final: number; quilos_final: number;
}

export interface Cadastros {
  especies: Especie[];
  categorias: Categoria[];
  ocorrencias: Ocorrencia[];
  causas: Causa[];
  contrapartes: Contraparte[];
}

export type StatusContagem = 'rascunho' | 'enviada' | 'fechada';
export interface Contagem { id: number; propriedade_id: number; data: string; status: StatusContagem; observacao: string | null }
export interface LinhaContagem {
  id: number; contagem_id: number; potreiro_id: number | null; categoria_id: number;
  cabecas: number; peso_medio_kg: number | null; observacao: string | null;
  contado_em?: string | null;   // dia em que este potreiro/categoria foi contado de fato
}
export interface LinhaFechamento {
  categoria_id: number; especie_id: number; categoria: string;
  teorico: number; contado: number; diferenca: number; quilos: number;
}
export interface LinhaCarga {
  potreiro_id: number | null; potreiro: string; area_util_ha: number | null;
  cabecas: number; quilos: number; kg_ha: number | null; ua_ha: number | null;
}

export type StatusAudio = 'enviado' | 'transcrito' | 'aplicado' | 'erro';
export interface AudioContagem {
  id: number; propriedade_id: number; contagem_id: number | null; arquivo: string;
  gravado_em: string; criado_em?: string; duracao_seg: number | null; status: StatusAudio; transcricao: string | null; erro: string | null;
}

// Cadastros (telas de administração)
export type Dominio = 'propria' | 'arrendada';
export interface PotreiroCad {
  id?: number; propriedade_id: number; codigo: string; dominio: Dominio;
  area_total_ha: number; area_util_ha: number; ativo: boolean;
}
export interface PropriedadeCad {
  id?: number; nome: string; apelido: string | null; municipio: string | null; uf: string | null;
  valor_hectare: number | null; ativa: boolean;
}
export interface Acesso { propriedade_id: number; papel: 'gerente' | 'capataz' }
export interface UsuarioCad {
  id: string; nome: string; email: string | null; whatsapp: string | null; adm: boolean; ativo: boolean; acessos: Acesso[];
}
export interface NovoUsuario {
  nome: string; email: string; senha: string; whatsapp: string | null; adm: boolean; acessos: Acesso[];
}
