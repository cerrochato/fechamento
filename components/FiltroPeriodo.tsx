'use client';
// Filtro comum dos relatórios: propriedade (esta ou todas) e período livre com atalhos.
import { useApp } from '@/lib/contexto';
import { hoje, mesesAntes } from '@/lib/dados';

export function mesAtras(n: number) {
  const [a, m] = hoje().split('-').map(Number);
  const ini = new Date(Date.UTC(a, m - 1 - n, 1)), fim = new Date(Date.UTC(a, m - n, 0));
  return { de: ini.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) };
}

export default function FiltroPeriodo({ de, ate, setDe, setAte, todas, setTodas }: {
  de: string; ate: string; setDe: (v: string) => void; setAte: (v: string) => void;
  todas: boolean; setTodas: (v: boolean) => void;
}) {
  const { propriedade, propriedades } = useApp();
  const ano = Number(hoje().slice(0, 4));
  const atalho = (d: string, a: string) => { setDe(d); setAte(a); };
  return (
    <>
      {propriedades.length > 1 && (
        <div className="chips" style={{ marginBottom: 10 }}>
          <button className={`chip ${!todas ? 'sel' : ''}`} onClick={() => setTodas(false)}>{propriedade.nome}</button>
          <button className={`chip ${todas ? 'sel' : ''}`} onClick={() => setTodas(true)}>Todas as propriedades</button>
        </div>
      )}
      <div className="filtros">
        <div><label htmlFor="de">De</label><input id="de" type="date" value={de} onChange={e => e.target.value && setDe(e.target.value)} /></div>
        <div><label htmlFor="ate">Até</label><input id="ate" type="date" value={ate} onChange={e => e.target.value && setAte(e.target.value)} /></div>
      </div>
      <div className="chips" style={{ marginTop: 10 }}>
        <button className="chip" onClick={() => atalho(mesAtras(1).de, mesAtras(1).ate)}>Mês passado</button>
        <button className="chip" onClick={() => atalho(mesesAntes(hoje(), 3), hoje())}>Últimos 3 meses</button>
        <button className="chip" onClick={() => atalho(mesesAntes(hoje(), 12), hoje())}>Últimos 12 meses</button>
        <button className="chip" onClick={() => atalho(`${ano}-01-01`, hoje())}>Este ano</button>
        <button className="chip" onClick={() => atalho(`${ano - 1}-01-01`, `${ano - 1}-12-31`)}>Ano {ano - 1}</button>
      </div>
    </>
  );
}
