'use client';
import Link from 'next/link';
import Moldura from '@/components/Moldura';

const RELATORIOS = [
  { href: '/efetivo', nome: 'Evolução do rebanho', desc: 'Estoque inicial, entradas, saídas e estoque final no período, em cabeças e kg' },
  { href: '/relatorios/lotacao', nome: 'Lotação', desc: 'UA/ha e kg/ha da propriedade e de cada potreiro, pelas contagens do período' },
  { href: '/relatorios/movimentacoes', nome: 'Movimentações', desc: 'Compras, vendas, nascimentos, mortes e consumo, com kg e valores' },
];
const EM_BREVE = ['Indicadores produtivos'];

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
