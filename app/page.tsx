'use client';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';

// Tela de abertura: o logo da estância e um atalho para cada parte do app
const ATALHOS = [
  { href: '/estoque', icone: '▤', nome: 'Estoque', desc: 'Rebanho atual por categoria' },
  { href: '/lancar', icone: '＋', nome: 'Lançar', desc: 'Compra, venda, nascimento, morte…' },
  { href: '/lancamentos', icone: '☰', nome: 'Histórico', desc: 'Todos os lançamentos' },
  { href: '/contagem', icone: '✓', nome: 'Contagem', desc: 'Contar por áudio ou digitando' },
  { href: '/dash', icone: '◧', nome: 'Dash', desc: 'Bovinos, ovinos e áreas' },
  { href: '/relatorios', icone: '▦', nome: 'Relatórios', desc: 'Movimentações, evolução, lotação…' },
  { href: '/financeiro', icone: '$', nome: 'Financeiro', desc: 'Resumo, fluxo de caixa, SW Rural', adm: true },
  { href: '/cadastros', icone: '⚙', nome: 'Cadastros', desc: 'Potreiros, categorias, usuários', gerente: true },
];

export default function Abertura() {
  const { propriedade, sessao } = useApp();
  const itens = ATALHOS.filter(a => (!a.adm || propriedade.papel === 'adm') && (!a.gerente || propriedade.papel !== 'capataz'));
  return (
    <Moldura>
      <section className="abertura">
        <img src="/logo-branco.png" alt="Estância Cerro Chato" />
        <p>Olá, {sessao.nome.split(' ')[0]}</p>
      </section>
      <div className="atalhos">
        {itens.map(a => (
          <Link key={a.href} href={a.href} className="atalho">
            <span className="atalho-icone" aria-hidden>{a.icone}</span>
            <strong>{a.nome}</strong>
            <span className="suave">{a.desc}</span>
          </Link>
        ))}
      </div>
    </Moldura>
  );
}
