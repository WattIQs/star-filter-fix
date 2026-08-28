# Plano de melhorias — Sinal Zero

## Objetivo
Transformar o Sinal Zero em uma ferramenta de prospecção mais confiável, rápida e rentável: corrigir inconsistências técnicas, elevar a experiência do usuário, adicionar funcionalidades que aumentam a taxa de conversão de leads e preparar a base para monetização.

## Fase 1 — Fundação: qualidade e correções (semana 1)

### 1.1 Unificar persistência de leads salvos
- **Problema:** `src/lib/saved-leads.ts` e `src/lib/store.ts` guardam leads em `localStorage` com chaves diferentes. Componentes importam de módulos distintos, então um lead salvo pode não aparecer para exportação ou vice-versa.
- **Ação:** Escolher um único módulo (`saved-leads.ts`), migrar dados da chave antiga automaticamente e atualizar todos os imports.
- **Validação:** Salvar um lead, abrir o drawer de salvos e exportar CSV devem mostrar o mesmo registro.

### 1.2 Alinhar classificação de sinais
- **Problema:** `SignalLevel` no tipo é `"zero" | "weak" | "full"`, mas `SignalBadge` e `FiltersMenu` usam `"medium" | "high"`. Isso gera inconsistência visual e de filtro.
- **Ação:** Padronizar tudo para `zero | weak | full`, com labels "Sinal Zero", "Sinal Fraco", "Presença Digital". Atualizar `MapCanvas`, `PlaceRow` e `FiltersMenu`.
- **Validação:** Filtros e badges devem refletir o mesmo nível para o mesmo lead.

### 1.3 Tratar verificação externa desabilitada
- **Problema:** Quando `GOOGLE_SEARCH_API_KEY` e `GOOGLE_SEARCH_CX` não estão configurados, a verificação retorna `external: false`. A UI mostra "A verificação Google não está configurada no servidor." e esvazia resultados.
- **Ação:** Usar os dados do OSM como fallback, manter os resultados visíveis e mostrar um aviso sutil (banner ou tooltip) em vez de erro bloqueante.
- **Validação:** Filtros de presença devem funcionar mesmo sem chave Google, usando os dados já extraídos das tags OSM.

### 1.4 Filtro "Ocultar grandes redes/franquias"
- **Problema:** O usuário relatou que restaurantes famosos aparecem em "pouca presença digital". A função `hasWellKnownBrand` já detecta marcas, mas não é usada nos filtros.
- **Ação:** Adicionar flag `knownBrand` ao tipo `Establishment` e um toggle no `FiltersMenu` para excluir grandes redes das buscas de oportunidade.
- **Validação:** Ativar o filtro deve remover McDonald's, Burger King, Starbucks etc. dos resultados.

## Fase 2 — Experiência do usuário (semana 1-2)

### 2.1 Painel de estatísticas da varredura
- Mostrar, após a varredura:
  - total de estabelecimentos encontrados;
  - quantos são Sinal Zero / Fraco / Presença Digital;
  - quantos têm WhatsApp, Instagram ou site;
  - quantos estão sem nota pública.
- Local: topo da lista de leads, como cards compactos.

### 2.2 Estados vazios acionáveis
- Quando não há resultados, exibir:
  - causa provável (filtros muito restritivos, área sem dados, verificação desligada);
  - botão "Limpar filtros";
  - dica de busca mais ampla.

### 2.3 Melhorar destaque do lead selecionado
- No mapa, ao clicar em um card, centralizar e abrir um popup com nome, categoria e botões de contato.
- Na lista, manter o card selecionado visível ao trocar de aba no mobile.

### 2.4 Tooltips educativos nos filtros
- Adicionar textos explicativos curtos no `FiltersMenu`:
  - "Sinal Zero = nenhum site, Instagram ou WhatsApp confirmado."
  - "Sem nota pública = OSM não tem avaliação para este local."

### 2.5 Acessibilidade e feedback
- Garantir que todos os botões tenham `aria-label` quando só ícones.
- Adicionar `role="status"` nas mensagens de carregamento e erro.
- Melhorar contraste dos textos secundários.

## Fase 3 — Funcionalidades novas (semana 2)

### 3.1 Modo "Só oportunidades"
- Botão rápido no header que aplica de uma vez:
  - Sinal Zero ou Sinal Fraco;
  - com WhatsApp ou Instagram válido;
  - sem site próprio;
  - ocultar grandes redes.
- Isso entrega exatamente o que o usuário pediu: leads com pouca presença digital mas contatáveis.

### 3.2 Compartilhar busca por URL
- Salvar na query string:
  - localização (lat, lon, zoom);
  - categorias ativas;
  - filtros de sinal, contato, preço e nota;
  - termo de busca.
- Ao abrir um link, restaurar o estado e, se necessário, reexecutar a varredura.
- Impacto: usuários podem compartilhar listas prontas de leads.

### 3.3 Histórico de buscas recentes
- Salvar as últimas 10 buscas no `localStorage`.
- Mostrar na barra de busca ao focar com campo vazio.
- Permitir reexecutar com um clique.

### 3.4 Notas e status nos leads salvos
- No drawer de leads salvos, permitir adicionar:
  - notas textuais;
  - status: "Não contactado", "Contactado", "Interessado", "Fechado", "Descartado".
- Incluir esses campos no export CSV.

### 3.5 Exportar em múltiplos formatos
- Além de CSV, oferecer exportação em JSON e em texto simples (lista de nomes + WhatsApp).

## Fase 4 — Performance e estabilidade (semana 2-3)

### 4.1 Paginação / virtualização da lista
- **Problema:** Listas grandes recriam muitos cards e markers, travando o mobile.
- **Ação:**
  - Limitar renderização inicial a 50 leads;
  - botão "Carregar mais" ou scroll infinito;
  - virtualizar a lista quando passar de 100 itens.

### 4.2 Otimizar o MapCanvas
- Evitar recriar todos os `circleMarker` a cada filtro.
- Atualizar apenas visibilidade, cor e raio dos markers existentes.
- Usar `L.markerClusterGroup` quando houver muitos pontos.

### 4.3 Cache de verificação por sessão
- A `verificationCacheRef` já existe, mas é limpa a cada nova varredura.
- **Ação:** Manter cache durante a sessão e invalidar apenas quando o usuário mudar de área.

### 4.4 Debounce e limitação de requisições
- Aplicar debounce de 300ms nos filtros para evitar múltiplas chamadas de verificação.
- Limitar varreduras simultâneas e mostrar tempo estimado.

## Fase 5 — Base para monetização (semana 3)

### 5.1 Contador de uso
- Registrar número de varreduras e leads salvos no `localStorage`.
- Quando atingir um limite gratuito (ex: 10 varreduras/dia), exibir CTA para plano premium.

### 5.2 Tela de planos
- Criar rota `/planos` com:
  - Gratuito: 10 varreduras/dia, 50 leads salvos.
  - Pro: varreduras ilimitadas, leads ilimitados, exportação em lote, múltiplos usuários.
- Apenas a estrutura visual; integração de pagamento fica para etapa futura.

### 5.3 SEO e landing page
- Melhorar `title`, `description`, `og:image` e adicionar `canonical`.
- Criar seção explicativa na landing page para conversão orgânica.

## Ordem de execução recomendada
1. Fase 1 (correções críticas).
2. Fase 2 (UX rápida, alto impacto visual).
3. Fase 3.1 (modo "Só oportunidades") — resolve a dor principal relatada.
4. Fase 3.2 a 3.5 (funcionalidades de retenção).
5. Fase 4 (performance).
6. Fase 5 (monetização).

## Critérios de conclusão
- Build passa (`bun run typecheck` e `bun run build`).
- Filtros de estrelas, sinais e presença funcionam corretamente.
- Leads salvos aparecem consistentemente em todos os pontos.
- A experiência no mobile é fluida para varreduras com até 200 resultados.
- Nenhum erro bloqueante quando a verificação Google está desligada.
