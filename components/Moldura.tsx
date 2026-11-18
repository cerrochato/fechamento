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
  { href: '/dash', icone: '◧', nome: 'Dash' },
  { href: '/relatorios', icone: '▦', nome: 'Relatórios', tambem: ['/efetivo'] },
  { href: '/financeiro', icone: '$', nome: 'Financeiro', fin: true },
];

// permiteTodas: a tela sabe somar todas as propriedades, então o seletor do topo oferece "Todas as propriedades"
export default function Moldura({ children, largo, permiteTodas }: { children: React.ReactNode; largo?: boolean; permiteTodas?: boolean }) {
  const { propriedades, propriedade, trocarPropriedade, todas, setTodas } = useApp();
  const mostraTodas = permiteTodas && todas;
  const path = usePathname();
  // aba Financeiro só para gerente e adm
  const itens = ITENS.filter(i => !('fin' in i) || propriedade.papel !== 'capataz');
  return (
    <>
      <header className="topo nao-imprime">
        <Link href="/" className="marca" aria-label="Início"><img src="/logo-branco.png" alt="Estância Cerro Chato" /></Link>
        {propriedades.length > 1 ? (
          <select aria-label="Propriedade" value={mostraTodas ? 'todas' : propriedade.id}
            onChange={e => (e.target.value === 'todas' ? setTodas(true) : trocarPropriedade(Number(e.target.value)))}>
            {propriedades.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            {permiteTodas && <option value="todas">Todas as propriedades</option>}
          </select>
        ) : <span style={{ marginLeft: 'auto' }}>{propriedade.nome}</span>}
        {propriedade.papel !== 'capataz' && <Link href="/cadastros" aria-label="Cadastros" title="Cadastros" style={{ color: 'inherit', fontSize: '1.2rem', textDecoration: 'none' }}>⚙</Link>}
        {!DEMO && <button onClick={() => sair()}>Sair</button>}
      </header>
      <main className="pagina" style={largo ? { maxWidth: 'none' } : undefined}>{children}</main>
      <nav className="nav nao-imprime" style={{ gridTemplateColumns: `repeat(${itens.length}, 1fr)` }}>
        {itens.map(i => (
          <Link key={i.href} href={i.href} className={(i.href === '/' ? path === '/' : [i.href, ...(('tambem' in i && i.tambem) || [])].some(h => path.startsWith(h))) ? 'ativo' : ''}>
            <span aria-hidden>{i.icone}</span>{i.nome}
          </Link>
        ))}
      </nav>
    </>
  );
}
