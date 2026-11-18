'use client';
// Contas do resumo financeiro, no modelo da aba "RESUMO FINANCEIRO" da planilha
import type { ContaFin, LancFin } from './dados';

export const APORTE = '1.6', PRO_LABORE = '2.5', INVESTIMENTOS = '2.4', ARROZ = '2.6', EMPRESTIMOS = '2.7', ARRENDAMENTO = '2.1.4.7';
export const comeca = (codigo: string, raiz: string) => codigo === raiz || codigo.startsWith(raiz + '.');

// Rubrica do resumo: conta de nível 4 (ex.: 2.1.1.6 Suplementação Bovinos). Pró-labore fica inteiro em 2.5.
export function rubrica(codigo: string) {
  if (comeca(codigo, PRO_LABORE)) return PRO_LABORE;
  return codigo.split('.').slice(0, 4).join('.');
}

export const ordemCodigo = (a: string, b: string) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1);
  return 0;
};

export function somaPor(ls: LancFin[], chave: (l: LancFin) => string) {
  const m = new Map<string, number>();
  for (const l of ls) { const k = chave(l); m.set(k, (m.get(k) ?? 0) + l.valor); }
  return m;
}

export function nomeConta(contas: ContaFin[], codigo: string) {
  return contas.find(c => c.codigo === codigo)?.nome ?? codigo;
}

export interface Resumo {
  receitas: Map<string, number>;   // por rubrica
  despesas: Map<string, number>;   // por rubrica, com o pró-labore já descontado do aporte
  recPecuaria: number; recOutras: number; recTotal: number;
  despTotal: number; aporte: number; proLaboreBruto: number; proLabore: number;
  investimentos: number; arroz: number; emprestimos: number; arrendamento: number;
  desembolso: number; resultado1: number; resultado2: number; resultado3: number; resultado4: number; desembolsoTotal: number;
}

export function resumir(ls: LancFin[]): Resumo {
  const tot = (raiz: string) => ls.filter(l => comeca(l.conta_codigo, raiz)).reduce((s, l) => s + l.valor, 0);
  const rec = ls.filter(l => comeca(l.conta_codigo, '1')), desp = ls.filter(l => comeca(l.conta_codigo, '2'));
  const receitas = somaPor(rec, l => rubrica(l.conta_codigo));
  const despesas = somaPor(desp, l => rubrica(l.conta_codigo));
  const aporte = tot(APORTE), proLaboreBruto = tot(PRO_LABORE), proLabore = proLaboreBruto - aporte;
  if (despesas.has(PRO_LABORE) || aporte) despesas.set(PRO_LABORE, proLabore);
  const recPecuaria = tot('1.1'), recTotal = tot('1'), recOutras = recTotal - recPecuaria;
  const despTotal = [...despesas.values()].reduce((a, b) => a + b, 0);
  const investimentos = tot(INVESTIMENTOS), arroz = tot(ARROZ), emprestimos = tot(EMPRESTIMOS), arrendamento = tot(ARRENDAMENTO);
  // Como na planilha: despesas pecuárias = total − investimentos − pró-labore − arroz − empréstimos − arrendamento
  const desembolso = despTotal - investimentos - proLabore - arroz - emprestimos - arrendamento;
  const resultado1 = recPecuaria - desembolso, resultado2 = resultado1 - arrendamento,
    resultado3 = resultado2 - investimentos, resultado4 = resultado3 - proLabore;
  return { receitas, despesas, recPecuaria, recOutras, recTotal, despTotal, aporte, proLaboreBruto, proLabore,
    investimentos, arroz, emprestimos, arrendamento, desembolso, resultado1, resultado2, resultado3, resultado4,
    desembolsoTotal: desembolso + arrendamento + investimentos + proLabore };
}
