'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { transferenciasAConfirmar } from '@/lib/dados';

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
  { href: '/manual', icone: '?', nome: 'Manual', desc: 'Como usar o app, passo a passo' },
];

export default function Abertura() {
  const { propriedade, sessao } = useApp();
  const capataz = propriedade.papel === 'capataz';
  const [aConfirmar, setAConfirmar] = useState(0);
  useEffect(() => {
    if (capataz) { setAConfirmar(0); return; }
    transferenciasAConfirmar(propriedade.id).then(l => setAConfirmar(l.length)).catch(() => setAConfirmar(0));
  }, [propriedade.id, capataz]);
  const itens = ATALHOS.filter(a => capataz ? ['/lancar', '/lancamentos', '/contagem', '/manual'].includes(a.href)
    : (!a.adm || propriedade.papel === 'adm'));
  return (
    <Moldura>
      <section className="abertura">
        <img src="/logo-branco.png" alt="Estância Cerro Chato" />
        <p>Olá, {sessao.nome.split(' ')[0]}</p>
      </section>
      {aConfirmar > 0 && (
        <Link href="/lancamentos" className="botao" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', margin: '0 0 12px' }}>
          {aConfirmar === 1 ? '1 transferência' : `${aConfirmar} transferências`} de outra propriedade para confirmar →
        </Link>
      )}
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
