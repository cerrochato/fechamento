'use client';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';

export default function Cadastros() {
  const { propriedade, sessao } = useApp();
  const gerente = propriedade.papel !== 'capataz';
  const itens = [
    { href: '/cadastros/potreiros', nome: 'Potreiros', desc: `Áreas e potreiros de ${propriedade.nome}`, pode: gerente },
    { href: '/cadastros/avaliacao', nome: 'Avaliação do rebanho', desc: 'R$/kg de cada categoria, usado no inventário e no patrimônio', pode: gerente },
    { href: '/cadastros/categorias', nome: 'Categorias de animais', desc: 'Nomes, peso médio e ordem nos relatórios', pode: sessao.adm },
    { href: '/cadastros/propriedades', nome: 'Propriedades', desc: 'Estâncias cadastradas no sistema', pode: sessao.adm },
    { href: '/cadastros/usuarios', nome: 'Usuários e acessos', desc: 'Quem entra no app e o que pode fazer', pode: sessao.adm },
  ].filter(i => i.pode);
  return (
    <Moldura>
      <h1>Cadastros</h1>
      {itens.length === 0 && <p className="suave">Os cadastros são feitos pelo gerente ou pelo administrador.</p>}
      <div className="lista">
        {itens.map(i => (
          <Link key={i.href} href={i.href} className="cartao item">
            <div><strong>{i.nome}</strong><br /><small>{i.desc}</small></div>
            <span aria-hidden>›</span>
          </Link>
        ))}
      </div>
    </Moldura>
  );
}
