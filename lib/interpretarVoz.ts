// Transforma a fala do capataz em linhas de contagem.
// Ex.: "potreiro 21, 224 vaquilhona de cria, 190 ovelhas de cria e 195 cordeiros.
//       Potreiro 40 b: 15 touros de 2 anos"
//   -> [{potreiro 21, Vaquilhona cria, 224}, {21, Ovelha de cria, 190}, {21, Cordeiro (M/F), 195},
//       {40 b, Touro 2A, 15}]
// Funciona sem internet e sem custo: é só comparação de texto com os cadastros.

export interface ItemCadastro { id: number; nome: string }
export interface Interpretado {
  potreiro_id: number | null;
  potreiro: string | null;
  categoria_id: number | null;
  categoria_falada: string;
  cabecas: number;
}
export interface ResultadoVoz { itens: Interpretado[]; naoEntendido: string[] }

const PARADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'na', 'no', 'tem', 'temos', 'ha', 'cabecas', 'cabeca', 'animais', 'mais']);

export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[(),.;:!?/]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// números por extenso -> dígitos ("duzentos e vinte e quatro" -> "224")
// ---------------------------------------------------------------------------
const UNID: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300,
  trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600,
  seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
};

function numerosPorExtenso(palavras: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < palavras.length) {
    const w = palavras[i];
    if (w in UNID || (w === 'mil' && out.length === 0)) {
      let total = 0, atual = 0, j = i, usou = false, ultimo = Infinity;
      while (j < palavras.length) {
        const p = palavras[j];
        // as partes de um número vão diminuindo (cento, noventa, cinco); se subir, começou outro número
        if (p in UNID) { if (UNID[p] >= ultimo) break; atual += UNID[p]; ultimo = UNID[p] || 1; usou = true; j++; }
        else if (p === 'mil') { total += (atual || 1) * 1000; atual = 0; ultimo = Infinity; usou = true; j++; }
        else if (p === 'e' && usou && j + 1 < palavras.length && (palavras[j + 1] in UNID)) { j++; }
        else break;
      }
      out.push(String(total + atual));
      i = j;
    } else { out.push(w); i++; }
  }
  return out;
}

// "2 anos", "dois anos", "de 2 anos" -> "2a"; plurais simples -> singular
// nomes do dia a dia -> nome do cadastro
const APELIDOS: [RegExp, string][] = [
  [/\b(cavalos?|potros?|matungos?)\b/g, 'equinos m'],
  [/\b(eguas?|potrancas?)\b/g, 'equinos f'],
  [/\b(bezerros?|bezerras?)\b/g, 'terneiro'],
  [/\b(borregos?)\b/g, 'carneiro'],
];

function preparar(texto: string): string {
  let t = numerosPorExtenso(normalizar(texto).split(' ')).join(' ');
  for (const [re, por] of APELIDOS) t = t.replace(re, por);
  t = t.replace(/\bde (\d) anos?\b/g, '$1a').replace(/\b(\d) anos?\b/g, '$1a').replace(/\b(\d) a\b(?! [a-z]\b)/g, '$1a');
  t = t.replace(/\b(\d)\s+e\s+meio\b/g, '$1');
  return t;
}

function singular(w: string): string {
  if (/^\d/.test(w) || w.length <= 3) return w;
  if (w.endsWith('oes')) return w.slice(0, -3) + 'ao';     // capoes -> capao
  if (w.endsWith('aes')) return w.slice(0, -3) + 'ao';
  if (w.endsWith('es') && /(r|z|s)es$/.test(w)) return w.slice(0, -2); // touros? nao; carneiros ok abaixo
  if (w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function tokens(s: string): string[] {
  return s.split(' ').filter(w => w && !PARADAS.has(w)).map(singular);
}

// ---------------------------------------------------------------------------
// Casamento com cadastros
// ---------------------------------------------------------------------------

function melhorCategoria(frase: string, categorias: ItemCadastro[]): ItemCadastro | null {
  const ft = tokens(frase);
  if (!ft.length) return null;
  let melhor: ItemCadastro | null = null, nota = 0;
  for (const c of categorias) {
    const ct = tokens(preparar(c.nome).replace(/\bm f\b/, ''));
    if (!ct.length) continue;
    const comuns = ct.filter(t => ft.includes(t)).length;
    if (!comuns || !ft.includes(ct[0])) continue;              // a primeira palavra (vaca, touro...) tem que aparecer
    // penaliza palavras da categoria que não foram faladas (ex.: "vaca" não deve virar "vaca de cria")
    const n = comuns / ct.length - (ct.length - comuns) * 0.01 + comuns * 0.001;
    if (n > nota) { nota = n; melhor = c; }
  }
  return nota >= 0.5 ? melhor : null;
}

function prefixoPotreiro(resto: string, potreiros: ItemCadastro[]): { pot: ItemCadastro; usado: number } | null {
  const palavras = resto.split(' ');
  let melhor: { pot: ItemCadastro; usado: number } | null = null;
  for (const p of potreiros) {
    const cod = preparar(p.nome).replace(/\b(\d)a\b/g, '$1 a').split(' ');
    const alvo = palavras.slice(0, cod.length).join(' ').replace(/\b(\d)a\b/g, '$1 a');
    const alvoTokens = alvo.split(' ').slice(0, cod.length);
    if (alvoTokens.join(' ') === cod.join(' ') && (!melhor || cod.length > melhor.usado)) melhor = { pot: p, usado: cod.length };
  }
  return melhor;
}

export function interpretarContagem(
  fala: string, potreiros: ItemCadastro[], categorias: ItemCadastro[], potreiroAtual: ItemCadastro | null = null,
): ResultadoVoz {
  const texto = preparar(fala);
  const itens: Interpretado[] = [];
  const naoEntendido: string[] = [];

  // divide em blocos por "potreiro" / "invernada"
  const blocos = texto.split(/\b(?:potreiro|invernada|piquete)\b/);
  let pot: ItemCadastro | null = potreiroAtual;
  blocos.forEach((bloco, i) => {
    let resto = bloco.trim();
    if (!resto) return;
    if (i > 0) {
      const p = prefixoPotreiro(resto, potreiros);
      if (p) { pot = p.pot; resto = resto.split(' ').slice(p.usado).join(' '); }
      else { naoEntendido.push('potreiro ' + resto.split(' ').slice(0, 2).join(' ')); pot = null; resto = resto.split(' ').slice(1).join(' '); }
    }
    // pares "número + nome da categoria"
    const partes = resto.split(/\b(\d+)\b/).map(s => s.trim());
    // partes = [antes, num, texto, num, texto, ...]
    if (partes[0] && tokens(partes[0]).length) naoEntendido.push(partes[0]);
    for (let k = 1; k < partes.length; k += 2) {
      const n = Number(partes[k]);
      const frase = partes[k + 1] ?? '';
      const cat = melhorCategoria(frase, categorias);
      if (cat && n > 0) {
        itens.push({ potreiro_id: pot?.id ?? null, potreiro: pot?.nome ?? null, categoria_id: cat.id, categoria_falada: frase, cabecas: n });
      } else if (frase || n) {
        naoEntendido.push(`${n} ${frase}`.trim());
      }
    }
  });
  return { itens, naoEntendido };
}
