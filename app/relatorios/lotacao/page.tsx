'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import FiltroPeriodo, { inicioUltimos } from '@/components/FiltroPeriodo';
import { useApp } from '@/lib/contexto';
import { cargaContagem, hoje, listarContagens, potreiros } from '@/lib/dados';
import { dataBR, dec, int } from '@/lib/formato';
import type { Contagem, LinhaCarga, Potreiro, Propriedade } from '@/lib/tipos';

const UA = 450; // kg por unidade animal
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

// Uma contagem (a última de cada mês, já enviada ou fechada) com a carga por potreiro
interface Foto { mes: string; contagem: Contagem; carga: LinhaCarga[] }
interface Dados { prop: Propriedade; pots: Potreiro[]; area: number; fotos: Foto[] }

async function carregar(prop: Propriedade, de: string, ate: string): Promise<Dados> {
  const [cs, pots] = await Promise.all([listarContagens(prop.id), potreiros(prop.id)]);
  const porMes = new Map<string, Contagem>();
  for (const c of cs) {
    if (c.status === 'rascunho' || c.data < de || c.data > ate) continue;
    const m = c.data.slice(0, 7), atual = porMes.get(m);
    if (!atual || c.data > atual.data) porMes.set(m, c);
  }
  const fotos = await Promise.all([...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(async ([mes, contagem]) => ({ mes, contagem, carga: await cargaContagem(contagem.id) })));
  return { prop, pots, area: pots.reduce((s, p) => s + Number(p.area_util_ha ?? 0), 0), fotos };
}

const kgDe = (f: Foto) => f.carga.reduce((s, l) => s + Number(l.quilos), 0);
const cabDe = (f: Foto) => f.carga.reduce((s, l) => s + Number(l.cabecas), 0);
const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

export default function Lotacao() {
  const { propriedade, propriedades } = useApp();
  const [de, setDe] = useState(inicioUltimos(12));
  const [ate, setAte] = useState(hoje());
  const [todas, setTodas] = useState(false);
  const [mesAMes, setMesAMes] = useState(false);
  const [dados, setDados] = useState<Dados[] | null>(null);

  useEffect(() => {
    setDados(null);
    Promise.all((todas ? propriedades : [propriedade]).map(p => carregar(p, de, ate))).then(setDados);
  }, [propriedade, propriedades, todas, de, ate]);

  return (
    <Moldura largo={mesAMes}>
      <div style={mesAMes ? { maxWidth: 1400, margin: '0 auto' } : undefined}>
      <Link href="/relatorios" className="suave">← Relatórios</Link>
      <h1 style={{ marginTop: 8 }}>Lotação</h1>
      <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} todas={todas} setTodas={setTodas} />
      <p className="suave" style={{ fontSize: '.88rem' }}>
        {todas ? 'Todas as propriedades' : propriedade.nome} · {dataBR(de)} a {dataBR(ate)} · usa a última contagem enviada ou fechada de cada mês · 1 UA = {UA} kg
      </p>
      {!dados && <p className="suave">Calculando…</p>}
      {dados && dados.every(d => !d.fotos.length) && <p className="suave">Nenhuma contagem enviada ou fechada no período.</p>}
      {dados && dados.length > 1 && dados.some(d => d.fotos.length) && <Geral dados={dados} />}
      {dados && dados.map(d => d.fotos.length > 0 && (
        <Propriedade1 key={d.prop.id} d={d} mesAMes={mesAMes} setMesAMes={setMesAMes} />
      ))}
      </div>
    </Moldura>
  );
}

// Soma das propriedades, mês a mês (área total x kg total)
function Geral({ dados }: { dados: Dados[] }) {
  const meses = [...new Set(dados.flatMap(d => d.fotos.map(f => f.mes)))].sort();
  const linhas = meses.map(m => {
    let kg = 0, cab = 0, area = 0;
    for (const d of dados) {
      const f = d.fotos.find(x => x.mes === m);
      if (f) { kg += kgDe(f); cab += cabDe(f); area += d.area; }
    }
    return { m, kg, cab, area };
  });
  const uas = linhas.map(l => (l.area ? l.kg / UA / l.area : 0));
  return (
    <section>
      <h2>Todas as propriedades</h2>
      <Resumo media={media(uas)} max={Math.max(...uas)} min={Math.min(...uas)} area={Math.max(...linhas.map(l => l.area))} />
      <div className="rolagem">
        <table>
          <thead><tr><th>Mês</th><th>Cabeças</th><th>kg vivo</th><th>Área útil ha</th><th>kg/ha</th><th>UA/ha</th></tr></thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.m}><td>{nomeMes(l.m)}</td><td>{int(l.cab)}</td><td>{int(l.kg)}</td><td>{dec(l.area, 1)}</td>
                <td>{l.area ? int(l.kg / l.area) : '·'}</td><td>{l.area ? dec(l.kg / UA / l.area) : '·'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Resumo({ media, max, min, area }: { media: number; max: number; min: number; area: number }) {
  return (
    <div className="cartao" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
      <div><small className="suave">Lotação média</small><br /><strong style={{ fontSize: '1.3rem' }}>{dec(media)} UA/ha</strong></div>
      <div><small className="suave">Maior mês</small><br /><strong>{dec(max)} UA/ha</strong></div>
      <div><small className="suave">Menor mês</small><br /><strong>{dec(min)} UA/ha</strong></div>
      <div><small className="suave">Área útil</small><br /><strong>{dec(area, 1)} ha</strong></div>
    </div>
  );
}

function Propriedade1({ d, mesAMes, setMesAMes }: { d: Dados; mesAMes: boolean; setMesAMes: (v: boolean) => void }) {
  const uas = d.fotos.map(f => (d.area ? kgDe(f) / UA / d.area : 0));
  // por potreiro: UA/ha em cada mês (0 quando estava vazio)
  const ids = new Set<number | null>(d.pots.map(p => p.id));
  for (const f of d.fotos) for (const l of f.carga) ids.add(l.potreiro_id);
  const linhas = [...ids].map(id => {
    const p = d.pots.find(x => x.id === id);
    const area = p ? Number(p.area_util_ha ?? 0) : 0;
    const nome = p?.codigo ?? d.fotos.flatMap(f => f.carga).find(l => l.potreiro_id === id)?.potreiro ?? 'Sem potreiro';
    const porMes = d.fotos.map(f => {
      const l = f.carga.find(x => x.potreiro_id === id);
      return { cab: l ? Number(l.cabecas) : 0, ua: l && area ? Number(l.quilos) / UA / area : 0 };
    });
    const usados = porMes.filter(x => x.cab > 0).length;
    return { id, nome, area, porMes, usados, mediaCab: media(porMes.map(x => x.cab)), mediaUa: media(porMes.map(x => x.ua)), maxUa: Math.max(0, ...porMes.map(x => x.ua)) };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));

  return (
    <section>
      <h2>{d.prop.nome}</h2>
      <Resumo media={media(uas)} max={Math.max(...uas)} min={Math.min(...uas)} area={d.area} />
      <div className="rolagem">
        <table>
          <thead><tr><th>Mês</th><th>Contagem</th><th>Cabeças</th><th>kg vivo</th><th>kg/ha</th><th>UA/ha</th></tr></thead>
          <tbody>
            {d.fotos.map(f => (
              <tr key={f.mes}><td>{nomeMes(f.mes)}</td>
                <td><Link href={`/contagem/ver?id=${f.contagem.id}`}>{dataBR(f.contagem.data)}</Link></td>
                <td>{int(cabDe(f))}</td><td>{int(kgDe(f))}</td>
                <td>{d.area ? int(kgDe(f) / d.area) : '·'}</td><td>{d.area ? dec(kgDe(f) / UA / d.area) : '·'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 18 }}>Por potreiro</h3>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '.9rem', margin: '6px 0 10px' }}>
        <input type="checkbox" checked={mesAMes} onChange={e => setMesAMes(e.target.checked)} style={{ width: 'auto' }} /> Mostrar UA/ha de cada mês
      </label>
      <div className="rolagem">
        <table>
          <thead><tr><th>Potreiro</th><th>Área ha</th><th>Meses ocupado</th><th>Cab. média</th><th>UA/ha média</th><th>UA/ha máx.</th>
            {mesAMes && d.fotos.map(f => <th key={f.mes}>{nomeMes(f.mes)}</th>)}</tr></thead>
          <tbody>
            {linhas.map(l => (
              <tr key={String(l.id)} style={l.usados ? undefined : { opacity: .5 }}>
                <td>{l.nome}</td><td>{l.area ? dec(l.area, 1) : '·'}</td><td>{l.usados} de {d.fotos.length}</td>
                <td>{l.mediaCab ? int(l.mediaCab) : '·'}</td><td>{l.area && l.mediaUa ? dec(l.mediaUa) : '·'}</td><td>{l.area && l.maxUa ? dec(l.maxUa) : '·'}</td>
                {mesAMes && l.porMes.map((x, i) => <td key={i}>{x.ua ? dec(x.ua) : x.cab ? int(x.cab) + ' cab' : '·'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="suave" style={{ fontSize: '.82rem' }}>A média por potreiro conta os meses vazios como zero. kg vivo vem das cabeças e do peso médio informados na contagem.</p>
    </section>
  );
}
