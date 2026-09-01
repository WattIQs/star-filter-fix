# Venture Map Perfected

https://github.com/WattIQs/venture-map-hub.git









Os filtros não estão funcionando muito bem quero q vc veja isso,  tipo, as estrelas quando clica n aparece mais nada, ou seja, n entregam oq prometem,  arrume tb tipo, n quero estrelas ou mais quero o número exato ent tipo, 1 estrela, 2 estrelas etc, mas q funcione, e outra coisa, os filtros n estão funcionando o resto eu quero dizer, tipo, eu pego com pouca presença digital e aparece restaurantes super famosos, nem faz sentido isso, ent veja isso dai arrume no caso, faça funcionar tudo perfeitamente

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://star-filter-fix.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35e13e41-09ee-46ef-b966-0a6b92bd48f1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Bug Ledger

### 2026-09-01 — Botão mostrar/ocultar senha desalinhado em `/auth`
- **Sintoma:** O ícone de olho no campo de senha aparecia deslocado para baixo/cima e parcialmente fora do campo, especialmente quando o input recebia foco.
- **Causa raiz:** A regra global `form button { position: relative; ... }` em `src/styles.css` sobrescrevia o `position: absolute` do botão de olho, mantendo-o no fluxo normal e quebrando o posicionamento. Além disso, a animação `focus:-translate-y-0.5` do input deslocava o campo sem mover os ícones absolutos, criando desalinhamento visual.
- **Solução:**
  - Em `src/styles.css`: ajustada a regra global para `form button:not(.absolute)`, preservando o posicionamento absoluto do botão de olho.
  - Em `src/routes/auth.tsx`:
    - Removeu `focus:-translate-y-0.5` do input de senha para garantir que o campo não se desloque em relação ao botão/cadeado.
    - Manteve o botão absoluto com `top-1/2 -translate-y-1/2`, área clicável `h-9 w-9` (36 × 36 px), flexbox centralizado e `shrink-0` no ícone.
    - Adicionou `z-10` no botão e no cadeado para evitar sobreposição.
  - Validado via teste visual automatizado: centro do botão alinhado ao centro do input com offset 0 px.
