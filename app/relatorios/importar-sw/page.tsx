'use client';
// Importação do relatório "Contas por grupo" do SW Rural: um arquivo .csv por mês
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { contasFinanceiras, hoje, importacoesSW, importarSW, lancamentosFinanceiros, type ImportacaoSW, type LinhaSW } from '@/lib/dados';
import { dataBR, reais } from '@/lib/formato';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

interface Lido { arquivo: string; todas: LinhaSW[]; folhas: LinhaSW[]; totRec?: number; totDesp?: number }

// Lê o .csv do SW (separador ;, números 1.234,56, acentos em Windows-1252)
async function lerArquivo(f: File): Promise<Lido> {
  const buf = await f.arrayBuffer();
  let txt = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
  const todas: LinhaSW[] = [];
  let totRec: number | undefined, totDesp: number | undefined;
  for (const bruta of txt.split(/\r?\n/)) {
    const cols = bruta.split(';').map(c => c.trim().replace(/^"|"$/g, '').trim());
    if (cols.length < 2) continue;
    const m = cols[0].match(/^(\d+(?:\.\d+)*)\s*-\s*(.*)$/);
    if (m && /^-?[\d.]+(,\d+)?$/.test(cols[1])) todas.push({ codigo: m[1], nome: m[2].trim(), valor: num(cols[1]) });
    else if (/^total receitas$/i.test(cols[0])) totRec = num(cols[1]);
    else if (/^total despesas$/i.test(cols[0])) totDesp = num(cols[1]);
  }
  // só as contas sem contas filhas no arquivo: as de cima são somas e contariam em dobro
  const folhas = todas.filter(l => !todas.some(o => o.codigo.startsWith(l.codigo + '.')));
  return { arquivo: f.name, todas, folhas, totRec, totDesp };
}

function mesPassado() {
  const [a, m] = hoje().split('-').map(Number);
  return new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 7);
}

export default function ImportarSW() {
  const { propriedade } = useApp();
  const [mes, setMes] = useState(mesPassado());
  const [lido, setLido] = useState<Lido | null>(null);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [chave, setChave] = useState(0);   // recria o campo de arquivo depois de importar
  const [feitas, setFeitas] = useState<(ImportacaoSW & { rec: number; desp: number })[] | null>(null);
  const [codigos, setCodigos] = useState<Set<string>>(new Set());
  const pode = propriedade.papel !== 'capataz';

  async function recarregar() {
    const [imps, contas] = await Promise.all([importacoesSW(propriedade.id), contasFinanceiras()]);
    setCodigos(new Set(contas.map(c => c.codigo)));
    const ls = imps.length ? await lancamentosFinanceiros(propriedade.id, imps[imps.length - 1].mes, imps[0].mes.slice(0, 8) + '28') : [];
    setFeitas(imps.map(i => {
      const doMes = ls.filter(l => l.data === i.mes);
      return { ...i, rec: doMes.filter(l => l.conta_codigo.startsWith('1')).reduce((s, l) => s + l.valor, 0), desp: doMes.filter(l => l.conta_codigo.startsWith('2')).reduce((s, l) => s + l.valor, 0) };
    }));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setFeitas(null); if (pode) recarregar(); }, [propriedade]);

  async function escolher(f: File | undefined) {
    setErro(''); setMsg(''); setLido(null);
    if (!f) return;
    try {
      const l = await lerArquivo(f);
      if (!l.folhas.length) throw new Error('Não encontrei contas neste arquivo. Ele precisa ser o relatório de contas por grupo exportado do SW Rural, em .csv.');
      setLido(l);
    } catch (e) { setErro((e as Error).message); }
  }

  if (!pode) return <Moldura><p>A importação do financeiro é só para gerente e administrador.</p></Moldura>;

  const soma = (p: string) => lido ? lido.folhas.filter(l => l.codigo.startsWith(p)).reduce((s, l) => s + l.valor, 0) : 0;
  const rec = soma('1'), desp = soma('2');
  const confere = (v: number, t?: number) => t === undefined || Math.abs(v - t) < 0.01;
  const novas = lido ? lido.todas.filter(l => !codigos.has(l.codigo)) : [];
  const jaTem = feitas?.find(f => f.mes === mes + '-01');
  const comValor = lido ? lido.folhas.filter(l => Math.abs(l.valor) >= 0.005).sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)) : [];

  async function importar() {
    if (!lido) return;
    setSalvando(true); setErro('');
    try {
      await importarSW(propriedade.id, mes + '-01', lido.arquivo, lido.folhas, novas);
      setMsg(`${nomeMes(mes + '-01')} importado: receitas ${reais(rec)}, despesas ${reais(desp)}.`);
      setLido(null); setChave(k => k + 1);
      const [a, m] = mes.split('-').map(Number);
      setMes(new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 7));
      await recarregar();
    } catch (e) { setErro((e as Error).message); }
    setSalvando(false);
  }

  return (
    <Moldura>
      <Link href="/relatorios" className="suave">← Relatórios</Link>
      <h1 style={{ marginTop: 8 }}>Importar do SW Rural</h1>
      <p className="suave" style={{ marginTop: -4 }}>
        No SW Rural, exporte o relatório de contas por grupo de <strong>um mês</strong> em .csv. Aqui, escolha o mês e o arquivo.
        Se o mês já tiver sido importado, os valores dele são substituídos pelos do arquivo novo.
      </p>

      <section className="cartao">
        <p style={{ margin: '0 0 10px' }}>Propriedade: <strong>{propriedade.nome}</strong></p>
        <div className="filtros">
          <div><label htmlFor="mes">Mês do relatório</label><input id="mes" type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} /></div>
          <div><label htmlFor="arq">Arquivo do SW (.csv)</label><input key={chave} id="arq" type="file" accept=".csv,text/csv" onChange={e => escolher(e.target.files?.[0])} /></div>
        </div>
        {jaTem && <p className="aviso">{nomeMes(jaTem.mes)} já foi importado em {dataBR(jaTem.importado_em.slice(0, 10))}. Importar de novo substitui os valores desse mês.</p>}
        {erro && <p className="erro">{erro}</p>}
        {msg && <p className="ok">✓ {msg}</p>}

        {lido && (
          <>
            <h2>Conferência do arquivo</h2>
            <table>
              <tbody>
                <tr><td>Receitas</td><td>{reais(rec)}</td><td className={confere(rec, lido.totRec) ? 'ok' : 'erro'}>{lido.totRec === undefined ? '' : confere(rec, lido.totRec) ? '✓ bate com o total do arquivo' : `total do arquivo: ${reais(lido.totRec)}`}</td></tr>
                <tr><td>Despesas</td><td>{reais(desp)}</td><td className={confere(desp, lido.totDesp) ? 'ok' : 'erro'}>{lido.totDesp === undefined ? '' : confere(desp, lido.totDesp) ? '✓ bate com o total do arquivo' : `total do arquivo: ${reais(lido.totDesp)}`}</td></tr>
                <tr><td>Contas com valor</td><td>{comValor.length}</td><td className="suave">de {lido.folhas.length} contas no arquivo</td></tr>
              </tbody>
            </table>
            {novas.length > 0 && <p className="aviso">{novas.length} conta(s) do arquivo ainda não existem no plano de contas e serão criadas: {novas.slice(0, 6).map(c => `${c.codigo} ${c.nome}`).join(' · ')}{novas.length > 6 ? '…' : ''}</p>}
            <details style={{ marginTop: 10 }}>
              <summary>Ver as contas com valor</summary>
              <div className="rolagem" style={{ marginTop: 8 }}>
                <table>
                  <tbody>{comValor.map(l => <tr key={l.codigo}><td>{l.codigo} · {l.nome}</td><td>{reais(l.valor)}</td></tr>)}</tbody>
                </table>
              </div>
            </details>
            <button className="botao" style={{ marginTop: 14 }} disabled={salvando} onClick={importar}>
              {salvando ? 'Importando…' : `Importar como ${nomeMes(mes + '-01')}`}
            </button>
          </>
        )}
      </section>

      <section style={{ marginTop: 18 }}>
        <h2>Meses importados</h2>
        {!feitas ? <p className="suave">Carregando…</p> : !feitas.length ? <p className="suave">Nenhum mês importado ainda.</p> : (
          <div className="rolagem">
            <table>
              <thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Importado em</th></tr></thead>
              <tbody>{feitas.map(f => <tr key={f.id}><td>{nomeMes(f.mes)}</td><td>{reais(f.rec)}</td><td>{reais(f.desp)}</td><td className="suave">{dataBR(f.importado_em.slice(0, 10))}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <p className="suave" style={{ fontSize: '.82rem' }}>Os valores aparecem no <Link href="/relatorios/financeiro">Resumo financeiro</Link> e no <Link href="/relatorios/fluxo-caixa">Fluxo de caixa</Link>.</p>
      </section>
    </Moldura>
  );
}
