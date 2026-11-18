'use client';
import Link from 'next/link';
import Moldura from '@/components/Moldura';

const RELATORIOS = [
  { href: '/relatorios/movimentacoes', nome: 'Movimentações', desc: 'Compras, vendas, nascimentos, mortes e consumo, com kg e valores' },
  { href: '/efetivo', nome: 'Evolução do rebanho', desc: 'Estoque inicial, entradas, saídas e estoque final no período, em cabeças e kg' },
  { href: '/relatorios/areas', nome: 'Áreas', desc: 'Uso da área (campo nativo, pastagem, arroz…), área de pecuária e lotação' },
  { href: '/relatorios/lotacao', nome: 'Lotação', desc: 'UA/ha e kg/ha da propriedade e de cada potreiro, pelas contagens do período' },
  { href: '/relatorios/indicadores', nome: 'Indicadores produtivos', desc: 'Natalidade, mortalidade, desfrute e kg produzidos por ha' },
];
const EM_BREVE: string[] = [];

export default function Relatorios() {
  return (
    <Moldura>
      <h1>Relatórios</h1>
      <div className="lista">
        {RELATORIOS.map(r => (
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
