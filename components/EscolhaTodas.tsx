'use client';
// Botões "esta propriedade / todas as propriedades" (só aparecem para quem vê mais de uma)
import { useApp } from '@/lib/contexto';

export default function EscolhaTodas({ todas, setTodas }: { todas: boolean; setTodas: (v: boolean) => void }) {
  const { propriedade, propriedades } = useApp();
  if (propriedades.length < 2) return null;
  return (
    <div className="chips" style={{ marginBottom: 10 }}>
      <button className={`chip ${!todas ? 'sel' : ''}`} onClick={() => setTodas(false)}>{propriedade.nome}</button>
      <button className={`chip ${todas ? 'sel' : ''}`} onClick={() => setTodas(true)}>Todas as propriedades</button>
    </div>
  );
}
