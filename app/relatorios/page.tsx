'use client';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';

const RELATORIOS = [
  { href: '/relatorios/movimentacoes', nome: 'Movimentações', desc: 'Compras, vendas, nascimentos, mortes e consumo, com kg e valores' },
  { href: '/efetivo', nome: 'Evolução do rebanho', desc: 'Estoque inicial, entradas, saídas e estoque final no período, em cabeças e kg' },
  { href: '/relatorios/areas', nome: 'Áreas', desc: 'Uso da área (campo nativo, pastagem, arroz…), área de pecuária e lotação' },
  { href: '/relatorios/lotacao', nome: 'Lotação', desc: 'UA/ha e kg/ha da propriedade e de cada potreiro, pelas contagens do período' },
  { href: '/relatorios/indicadores', nome: 'Indicadores produtivos', desc: 'Mortalidade, desfrute, kg produzidos por ha e carga animal' },
  { href: '/relatorios/financeiro', nome: 'Resumo financeiro', desc: 'Receitas, despesas, desembolso e resultados 1 a 4 no período', fin: true },
  { href: '/relatorios/fluxo-caixa', nome: 'Fluxo de caixa', desc: 'Receitas, despesas e saldo acumulado mês a mês', fin: true },
  { href: '/relatorios/importar-sw', nome: 'Importar do SW Rural', desc: 'Traz o relatório de contas por grupo de um mês para o financeiro', fin: true },
];
const EM_BREVE: string[] = [];

export default function Relatorios() {
  const { propriedade } = useApp();
  const lista = RELATORIOS.filter(r => !('fin' in r) || propriedade.papel !== 'capataz');
  return (
    <Moldura>
      <h1>Relatórios</h1>
      <div className="lista">
        {lista.map(r => (
          <Link key={r.href} href={r.href} className="cartao item">
            <div><strong>{r.nome}</strong><br /><small>{r.desc}</small></div>
            <span aria-hidden>›</span>
          </Link>
        ))}
        {EM_BREVE.map(n => (
          <div key={n} className="cartao item" style={{ opacity: .55 }}>
            <div><strong>{n}</strong><br /><small>Em construção</small></div>
          </div>
        ))}
      </div>
    </Moldura>
  );
}
