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
- **Sintoma:** O ícone de olho no campo de senha aparecia deslocado para cima e parcialmente cortado, especialmente quando o input recebia foco.
- **Causa:** O botão absoluto era posicionado em relação ao wrapper do input, mas não acompanhava a animação `focus:-translate-y-0.5` do campo; o ícone também não tinha garantia de centralização nem área clicável mínima confortável.
- **Solução (em `src/routes/auth.tsx`):**
  - Adicionada classe `peer` no input e `peer-focus:-translate-y-0.5` no botão, para que o botão suba junto com o campo no focus e permaneça centralizado.
  - Aumentada a área clicável para `h-9 w-9` (36 × 36 px).
  - Garantida centralização vertical com `top-1/2 -translate-y-1/2`, flexbox e `shrink-0` no ícone.
  - Adicionado `z-10` no botão e no ícone de cadeado para evitar sobreposição.
  - Reduzido `active:scale-95` para evitar clipping visual durante o clique.
