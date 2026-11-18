'use client';
import { useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import FiltroPeriodo, { inicioUltimos } from '@/components/FiltroPeriodo';
import DashAreas from '@/components/DashAreas';
import { useApp } from '@/lib/contexto';
import { hoje } from '@/lib/dados';
import { dataBR } from '@/lib/formato';

export default function Areas() {
  const { propriedade } = useApp();
  const [de, setDe] = useState(inicioUltimos(12));
  const [ate, setAte] = useState(hoje());
  const [todas, setTodas] = useState(false);
  return (
    <Moldura>
      <Link href="/relatorios" className="suave">← Relatórios</Link>
      <h1 style={{ marginTop: 8 }}>Áreas</h1>
      <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} todas={todas} setTodas={setTodas} />
      <p className="suave" style={{ fontSize: '.88rem' }}>{todas ? 'Todas as propriedades' : propriedade.nome} · {dataBR(de)} a {dataBR(ate)}</p>
      <DashAreas de={de} ate={ate} todas={todas} />
    </Moldura>
  );
}
