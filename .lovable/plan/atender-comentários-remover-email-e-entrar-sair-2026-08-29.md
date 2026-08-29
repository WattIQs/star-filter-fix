# Atender comentários — remover email e Entrar/Sair

## Comentários do usuário
1. **Thread 7cec1a60** — No cabeçalho, quando logado, aparece o email da conta. Remover totalmente a exibição do email.
2. **Thread 6d338ba4** — Remover totalmente o botão/link "Entrar/Sair" do código.

## Causa
O componente `ExportCsvButton` (apesar do nome, é um widget de autenticação) renderiza:
- o email do usuário logado + botão "Sair" (quando logado);
- um link "Entrar" para `/auth` (quando deslogado).

Ele é usado em 3 lugares: cabeçalho desktop (`src/routes/index.tsx`), drawer de leads salvos (`SavedLeadsDrawer.tsx`) e barra de ações mobile (`MobileActions.tsx`).

## O que será feito
1. **Remover o uso de `ExportCsvButton`** nos três arquivos (`index.tsx`, `SavedLeadsDrawer.tsx`, `MobileActions.tsx`), junto com os imports.
2. **Excluir o arquivo** `src/components/sinal-zero/ExportCsvButton.tsx`.
3. O logout continua disponível no menu de perfil (avatar no canto superior direito, `ProfileMenu.tsx`), que já tem o botão "Sair" — ou seja, nenhuma funcionalidade é perdida. O login em `/auth` continua existindo e o redirecionamento automático para `/auth` quando deslogado (AuthGate) não é afetado.

## Validação
- Typecheck + build OK.
- Verificar no preview que o cabeçalho não mostra mais email nem Entrar/Sair (logado e deslogado).
- Responder as duas threads de comentário confirmando a remoção.
