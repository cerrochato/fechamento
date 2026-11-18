'use client';
// Botão "Exportar PDF" e cabeçalho com o logo que só aparece no papel/PDF.
// Usa a impressão do navegador: no computador e no celular dá para escolher "Salvar como PDF".
import { useApp } from '@/lib/contexto';
import { dataBR } from '@/lib/formato';
import { hoje } from '@/lib/dados';

export default function Imprimir({ de, ate }: { de?: string; ate?: string }) {
  const { propriedade, todas } = useApp();
  return (
    <>
      <div className="so-impressao cabecalho-pdf">
        <img src="/logo.png" alt="Estância Cerro Chato" />
        <div>
          <strong>{todas ? 'Todas as propriedades' : propriedade.nome}</strong>
          {de && ate && <span>Período: {dataBR(de)} a {dataBR(ate)}</span>}
          <span>Emitido em {dataBR(hoje())}</span>
        </div>
      </div>
      <button type="button" className="botao sec nao-imprime" style={{ width: 'auto', marginTop: 0, padding: '8px 14px', fontSize: '.92rem' }} onClick={() => window.print()}>
        ⤓ Exportar PDF
      </button>
    </>
  );
}
