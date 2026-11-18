'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/lib/contexto';
import { sair, DEMO } from '@/lib/dados';

const ITENS = [
  { href: '/', icone: '⌂', nome: 'Início' },
  { href: '/lancar', icone: '＋', nome: 'Lançar' },
  { href: '/lancamentos', icone: '☰', nome: 'Histórico' },
  { href: '/contagem', icone: '✓', nome: 'Contagem' },
  { href: '/relatorios', icone: '▦', nome: 'Relatórios', tambem: ['/efetivo'] },
];

export default function Moldura({ children, largo }: { children: React.ReactNode; largo?: boolean }) {
  const { propriedades, propriedade, trocarPropriedade } = useApp();
  const path = usePathname();
  return (
    <>
      <header className="topo">
        <strong>Fechamento</strong>
        {propriedades.length > 1 ? (
          <select aria-label="Propriedade" value={propriedade.id} onChange={e => trocarPropriedade(Number(e.target.value))}>
            {propriedades.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        ) : <span style={{ marginLeft: 'auto' }}>{propriedade.nome}</span>}
        {propriedade.papel !== 'capataz' && <Link href="/cadastros" aria-label="Cadastros" title="Cadastros" style={{ color: 'inherit', fontSize: '1.2rem', textDecoration: 'none' }}>⚙</Link>}
        {!DEMO && <button onClick={() => sair()}>Sair</button>}
      </header>
      <main className="pagina" style={largo ? { maxWidth: 'none' } : undefined}>{children}</main>
      <nav className="nav">
        {ITENS.map(i => (
          <Link key={i.href} href={i.href} className={(i.href === '/' ? path === '/' : [i.href, ...(('tambem' in i && i.tambem) || [])].some(h => path.startsWith(h))) ? 'ativo' : ''}>
            <span aria-hidden>{i.icone}</span>{i.nome}
          </Link>
        ))}
      </nav>
    </>
  );
}
