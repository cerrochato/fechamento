'use client';
import Moldura from '@/components/Moldura';
import { MANUAL_HTML } from '@/lib/manualHtml';

export default function Manual() {
  return (
    <Moldura>
      <div className="titulo-rel">
        <h1>Manual do app</h1>
        <a className="botao sec nao-imprime" href="/manual.pdf" download="Manual do app Fechamento.pdf"
          style={{ width: 'auto', marginTop: 0, padding: '8px 14px', textDecoration: 'none' }}>⤓ Baixar PDF</a>
      </div>
      <article className="manual" dangerouslySetInnerHTML={{ __html: MANUAL_HTML }} />
    </Moldura>
  );
}
