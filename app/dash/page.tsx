'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Moldura from '@/components/Moldura';
import FiltroPeriodo, { inicioUltimos } from '@/components/FiltroPeriodo';
import DashAreas from '@/components/DashAreas';
import DashEspecie from '@/components/DashEspecie';
import { useApp } from '@/lib/contexto';
import { hoje } from '@/lib/dados';
import { dataBR } from '@/lib/formato';

function Dash() {
  const { propriedade, cad } = useApp();
  const sp = useSearchParams(), router = useRouter();
  const abas = [...cad.especies.filter(e => /^(bovino|ovino)/i.test(e.nome)).map(e => ({ id: String(e.id), nome: e.nome })), { id: 'areas', nome: 'Áreas' }];
  const aba = sp.get('aba') ?? abas[0]?.id;
  const [de, setDe] = useState(inicioUltimos(12));
  const [ate, setAte] = useState(hoje());
  const { todas } = useApp();
  return (
    <Moldura permiteTodas largo>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1>Dash</h1>
        <div className="chips" style={{ marginBottom: 12 }}>
          {abas.map(a => <button key={a.id} className={`chip ${a.id === aba ? 'sel' : ''}`} onClick={() => router.replace(`/dash?aba=${a.id}`)}>{a.nome}</button>)}
        </div>
        <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} />
        <p className="suave" style={{ fontSize: '.88rem' }}>{todas ? 'Todas as propriedades' : propriedade.nome} · {dataBR(de)} a {dataBR(ate)}</p>
        {aba === 'areas' ? <DashAreas de={de} ate={ate} todas={todas} /> : <DashEspecie key={aba} especieId={Number(aba)} de={de} ate={ate} todas={todas} />}
      </div>
    </Moldura>
  );
}

export default function Pagina() {
  return <Suspense><Dash /></Suspense>;
}
