'use client';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';

const TELAS = [
  { href: '/financeiro/resumo', nome: 'Resumo financeiro', desc: 'Receitas, despesas, desembolso e resultados 1 a 4 no período' },
  { href: '/financeiro/fluxo-caixa', nome: 'Fluxo de caixa', desc: 'Receitas, despesas e saldo acumulado mês a mês' },
  { href: '/financeiro/importar', nome: 'Importar do SW Rural', desc: 'Traz o relatório de contas por grupo de um mês' },
];

export default function Financeiro() {
  const { propriedade } = useApp();
  return (
    <Moldura>
      <h1>Financeiro</h1>
      {propriedade.papel === 'capataz' ? <p>O financeiro é visível só para gerente e administrador.</p> : (
        <div className="lista">
          {TELAS.map(r => (
            <Link key={r.href} href={r.href} className="cartao item">
              <div><strong>{r.nome}</strong><br /><small>{r.desc}</small></div>
              <span aria-hidden>›</span>
            </Link>
          ))}
        </div>
      )}
    </Moldura>
  );
}
