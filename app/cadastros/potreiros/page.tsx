'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { listarPotreirosCad, salvarPotreiro } from '@/lib/dados';
import { dec } from '@/lib/formato';
import type { PotreiroCad } from '@/lib/tipos';

const num = (t: string) => Number(t.replace(/\./g, '').replace(',', '.')) || 0;

export default function Potreiros() {
  const { propriedade } = useApp();
  const [lista, setLista] = useState<PotreiroCad[] | null>(null);
  const [editando, setEditando] = useState<PotreiroCad | null>(null);
  const [verInativos, setVerInativos] = useState(false);
  const pode = propriedade.papel !== 'capataz';

  const carregar = () => listarPotreirosCad(propriedade.id).then(l =>
    setLista([...l].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }))));
  useEffect(() => { setLista(null); carregar(); }, [propriedade.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ativos = (lista ?? []).filter(p => p.ativo);
  const visiveis = (lista ?? []).filter(p => verInativos || p.ativo);
  const novo = (): PotreiroCad => ({ propriedade_id: propriedade.id, codigo: '', dominio: 'propria', area_total_ha: 0, area_util_ha: 0, ativo: true });

  if (!pode) return <Moldura><p className="suave">Só o gerente ou o administrador altera os potreiros.</p></Moldura>;
  return (
    <Moldura>
      <Link href="/cadastros" className="suave">← Cadastros</Link>
      <h1 style={{ marginTop: 8 }}>Potreiros</h1>
      <p className="suave" style={{ marginTop: -4 }}>
        {ativos.length} potreiros ativos · {dec(ativos.reduce((s, p) => s + Number(p.area_util_ha), 0), 1)} ha úteis
      </p>
      {!editando && <button className="botao" onClick={() => setEditando(novo())}>＋ Novo potreiro</button>}
      {editando && !editando.id && <Formulario p={editando} aoFechar={async salvo => { setEditando(null); if (salvo) await carregar(); }} />}

      <div className="lista" style={{ marginTop: 14 }}>
        {!lista && <p className="suave">Carregando…</p>}
        {visiveis.map(p => editando && editando.id === p.id
          ? <Formulario key={p.id} p={editando} aoFechar={async salvo => { setEditando(null); if (salvo) await carregar(); }} />
          : (
            <button key={p.id} className="cartao item" style={{ textAlign: 'left', opacity: p.ativo ? 1 : .55, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => setEditando({ ...p })}>
              <div>
                <strong>Potreiro {p.codigo}</strong>{!p.ativo && ' · desativado'}<br />
                <small>{dec(Number(p.area_util_ha), 1)} ha úteis de {dec(Number(p.area_total_ha), 1)} ha{p.dominio === 'arrendada' ? ' · arrendada' : ''}</small>
              </div>
              <span className="suave">Editar</span>
            </button>
          ))}
      </div>
      {(lista ?? []).some(p => !p.ativo) && (
        <button className="botao sec" onClick={() => setVerInativos(v => !v)}>{verInativos ? 'Esconder desativados' : 'Mostrar desativados'}</button>
      )}
    </Moldura>
  );
}

function Formulario({ p, aoFechar }: { p: PotreiroCad; aoFechar: (salvo: boolean) => Promise<void> }) {
  const [f, setF] = useState(p);
  const [total, setTotal] = useState(p.id ? String(p.area_total_ha).replace('.', ',') : '');
  const [util, setUtil] = useState(p.id ? String(p.area_util_ha).replace('.', ',') : '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(extra?: Partial<PotreiroCad>) {
    const reg = { ...f, area_total_ha: num(total) || num(util), area_util_ha: num(util) || num(total), ...extra };
    if (!reg.codigo.trim()) return setErro('Informe o nome ou número do potreiro.');
    if (reg.area_util_ha <= 0) return setErro('Informe a área.');
    if (reg.area_util_ha > reg.area_total_ha) return setErro('A área útil não pode ser maior que a total.');
    setSalvando(true); setErro(null);
    try { await salvarPotreiro({ ...reg, codigo: reg.codigo.trim() }); await aoFechar(true); }
    catch (e) { setErro((e as Error).message.includes('duplicate') ? 'Já existe um potreiro com esse nome e área.' : (e as Error).message); setSalvando(false); }
  }

  return (
    <div className="cartao" style={{ borderColor: 'var(--verde)' }}>
      <strong>{p.id ? `Potreiro ${p.codigo}` : 'Novo potreiro'}</strong>
      <label htmlFor="cod">Nome ou número</label>
      <input id="cod" value={f.codigo} onChange={e => setF({ ...f, codigo: e.target.value })} placeholder="Ex.: 21, 40 B, Umbu" />
      <div className="filtros" style={{ marginTop: 10 }}>
        <div><label htmlFor="tot">Área total (ha)</label><input id="tot" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} /></div>
        <div><label htmlFor="ut">Área útil (ha)</label><input id="ut" inputMode="decimal" value={util} onChange={e => setUtil(e.target.value)} /></div>
      </div>
      <label>Domínio</label>
      <div className="chips">
        {(['propria', 'arrendada'] as const).map(d => (
          <button key={d} type="button" className={`chip ${f.dominio === d ? 'sel' : ''}`} onClick={() => setF({ ...f, dominio: d })}>
            {d === 'propria' ? 'Própria' : 'Arrendada'}
          </button>
        ))}
      </div>
      {erro && <p className="erro">{erro}</p>}
      <button className="botao" disabled={salvando} onClick={() => salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      {p.id && (
        <button className="botao sec" disabled={salvando} style={{ marginTop: 10 }} onClick={() => salvar({ ativo: !p.ativo })}>
          {p.ativo ? 'Desativar potreiro' : 'Reativar potreiro'}
        </button>
      )}
      <button className="excluir" style={{ color: 'var(--suave)', marginTop: 8 }} onClick={() => aoFechar(false)}>Cancelar</button>
      {p.id && p.ativo && <p className="suave" style={{ fontSize: '.85rem', marginBottom: 0 }}>
        Desativar tira o potreiro das listas novas, mas mantém o histórico das contagens antigas.
      </p>}
    </div>
  );
}
