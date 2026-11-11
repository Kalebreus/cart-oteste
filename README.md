# Gold Packs

Website em português para colecionadores. Landing page, catálogo com pesquisa e filtros, coleção por usuário e comunidade de aberturas.

## Desenvolvimento

Node 24 ou superior. Sem dependências de execução.

- `npm test`: testes do servidor com SQLite em memória e R2 simulado.
- `npm run build`: gera Worker e assets em `dist/`.

O Worker usa bindings `DB` (Cloudflare D1) e `BUCKET` (R2). O schema está em `drizzle/`. A identidade vem dos headers autenticados da plataforma Sites. Todas as alterações exigem usuário autenticado e origem correspondente. Cartas e vídeos só podem ser excluídos por seus autores.

Imagens: JPG/PNG/WebP até 5 MB. Vídeos: MP4/WebM até 64 MB ou links YouTube/Vimeo. As imagens de cartas iniciais provêm do CDN Pokémon TCG; os valores são demonstrativos e estão identificados. O site não fornece cotação automática.

Acesso inicial privado. Mudanças de público devem ser feitas pelos controles Sites.
