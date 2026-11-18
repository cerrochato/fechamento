'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { criarContagem, hoje, listarContagens } from '@/lib/dados';
import { dataBR, STATUS } from '@/lib/formato';
import type { Contagem } from '@/lib/tipos';

export default function Contagens() {
  const { propriedade, sessao } = useApp();
  const router = useRouter();
  const [lista, setLista] = useState<Contagem[] | null>(null);
  const [data, setData] = useState(hoje());
  const [criando, setCriando] = useState(false);
  const gerente = propriedade.papel !== 'capataz';

  const ordem = { enviada: 0, rascunho: 1, fechada: 2 } as const;
  useEffect(() => {
    setLista(null);
    listarContagens(propriedade.id).then(l => setLista([...l].sort((a, b) => ordem[a.status] - ordem[b.status] || b.data.localeCompare(a.data))));
  }, [propriedade.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ultima = lista ? [...lista].sort((a, b) => b.data.localeCompare(a.data))[0] : undefined;
  const aberta = lista?.find(c => c.status === 'rascunho');
  const pendentes = (lista ?? []).filter(c => c.status === 'enviada');

  async function nova(copiar: boolean) {
    setCriando(true);
    const id = await criarContagem(propriedade.id, data, sessao, copiar && ultima ? ultima.id : undefined);
    router.push(`/contagem/ver?id=${id}`);
  }

  return (
    <Moldura>
      <h1>Contagem de campo</h1>

      {gerente && pendentes.length > 0 && (
        <Link href={`/contagem/ver?id=${pendentes[0].id}`} className="aviso" style={{ display: 'block', marginBottom: 12 }}>
          <strong>{pendentes.length === 1 ? '1 contagem aguardando' : `${pendentes.length} contagens aguardando`} seu fechamento →</strong>
        </Link>
      )}

      <Link href="/gravar" className="botao" style={{ textAlign: 'center', marginTop: 0, marginBottom: 12 }}>
        🎙 Gravar contagem por áudio
      </Link>
      <p className="suave" style={{ fontSize: '.88rem', marginTop: -4 }}>Funciona sem sinal: o áudio fica no celular e é enviado quando a internet voltar.</p>

      {aberta ? (
        <Link href={`/contagem/ver?id=${aberta.id}`} className="botao" style={{ textAlign: 'center' }}>
          Continuar contagem de {dataBR(aberta.data)}
        </Link>
      ) : (
        <div className="cartao">
          <strong>Nova contagem</strong>
          <label htmlFor="data">Dia da contagem</label>
          <input id="data" type="date" value={data} max={hoje()} onChange={e => setData(e.target.value)} />
          {ultima && (
            <button className="botao" disabled={criando} onClick={() => nova(true)}>
              Começar a partir da contagem de {dataBR(ultima.data)}
            </button>
          )}
          <button className={`botao ${ultima ? 'sec' : ''}`} disabled={criando} onClick={() => nova(false)} style={ultima ? { marginTop: 10 } : undefined}>
            Começar em branco
          </button>
          {ultima && <p className="suave" style={{ fontSize: '.88rem', marginBottom: 0 }}>
            A partir da anterior: já vem com os mesmos potreiros e categorias, você só corrige o que mudou.
          </p>}
        </div>
      )}

      <h2>Contagens</h2>
      {!lista && <p className="suave">Carregando…</p>}
      <div className="lista">
        {(lista ?? []).map(c => (
          <Link key={c.id} href={`/contagem/ver?id=${c.id}`} className="cartao item">
            <div><strong>{dataBR(c.data)}</strong>{c.observacao && <><br /><small>{c.observacao}</small></>}</div>
            <span style={{ color: STATUS[c.status].cor, fontWeight: 600, fontSize: '.9rem' }}>{STATUS[c.status].nome}</span>
          </Link>
        ))}
      </div>
    </Moldura>
  );
}
