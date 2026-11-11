# Gold Packs

Website em português para colecionadores. Landing page, catálogo com pesquisa e filtros, coleção por usuário e comunidade de aberturas.

## Desenvolvimento

Node 24 ou superior. Sem dependências de execução.

- `npm test`: testes do servidor com SQLite em memória e R2 simulado.
- `npm run build`: gera Worker e assets em `dist/`.

O Worker usa bindings `DB` (Cloudflare D1) e `BUCKET` (R2). O schema está em `drizzle/`. A identidade vem dos headers autenticados da plataforma Sites. Todas as alterações exigem usuário autenticado e origem correspondente. Cartas e vídeos só podem ser excluídos por seus autores.

Imagens: JPG/PNG/WebP até 5 MB. Vídeos: MP4/WebM até 64 MB ou links YouTube/Vimeo. O catálogo inicial usa os dados do HTML fornecido e identifica os valores como referência. O site não fornece cotação automática.

Acesso inicial privado. Mudanças de público devem ser feitas pelos controles Sites.

## Código fornecido e catálogo

A página principal está em `index.html`. O HTML original enviado foi preservado em `reference/index.html`; o catálogo mantém as classes `carta`, `informacoes`, `nome-personagem`, `categoria`, `preco` e `btn-comprar`. Categoria, preço máximo, busca e ordenação funcionam em conjunto. Preços aceitam o formato brasileiro, por exemplo `1.500,00`.

Os nomes, categorias, valores e links de compra das seis entradas do arquivo enviado estão em `assets/cards.json`. Links de compra abrem o WhatsApp somente por ação do visitante. Os valores não são cotações automáticas. Arkanon e Lymara têm valor não informado.

As seis imagens Magick IA correspondentes aos anexos foram obtidas do [projeto original Dev em Dobro](https://github.com/devemdobro/magick-ia-szpc), preservando a arte e os créditos. Origem e hashes estão em `assets/provenance.json`. As outras ilustrações customizadas exibidas no chat não estão disponíveis como arquivos no workspace. Nicol Bolas e Umbreon usam um estado de imagem pendente em vez de uma ilustração diferente.
