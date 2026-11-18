export const int = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
export const dec = (n: number, c = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });
export const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = (iso: string) => iso.split('-').reverse().join('/');

export const STATUS = {
  rascunho: { nome: 'Em preenchimento', cor: 'var(--alerta)' },
  enviada: { nome: 'Aguardando gerente', cor: 'var(--saida)' },
  fechada: { nome: 'Fechada', cor: 'var(--entrada)' },
} as const;
