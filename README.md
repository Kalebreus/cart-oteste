# Gold Packs

Website em português para colecionadores. Landing page, catálogo com pesquisa e filtros, coleção por usuário e comunidade de aberturas.

## Desenvolvimento

Node 24 ou superior. Sem dependências de execução.

- `npm test`: testes do servidor com SQLite em memória e R2 simulado.
- `npm run build`: gera Worker e assets em `dist/`.

O Worker usa bindings `DB` (Cloudflare D1) e `BUCKET` (R2). O schema está em `drizzle/`. A identidade vem dos headers autenticados da plataforma Sites. Todas as alterações exigem usuário autenticado e origem correspondente. Cartas e vídeos só podem ser excluídos por seus autores.

Imagens: JPG/PNG/WebP até 5 MB. Vídeos: MP4/WebM até 64 MB ou links YouTube/Vimeo. O catálogo inicial usa os dados do HTML fornecido e identifica os valores como referência. O site não fornece cotação automática.

Link de divulgação: https://gold-packs-club.aromaticearth4.chatgpt.site/

A navegação e a leitura do catálogo e da comunidade ficam disponíveis ao público. Cadastro de cartas, publicações, curtidas e gerenciamento exigem login. Mudanças de público são feitas pelos controles Sites.

## Código fornecido e catálogo

A página principal está em `index.html`. O HTML original enviado foi preservado em `reference/index.html`; o catálogo mantém as classes `carta`, `informacoes`, `nome-personagem`, `categoria`, `preco` e `btn-comprar`. Categoria, preço máximo, busca e ordenação funcionam em conjunto. Preços aceitam o formato brasileiro, por exemplo `1.500,00`.

Os nomes, categorias, valores e links de compra das seis entradas do arquivo enviado estão em `assets/cards.json`. Links de compra abrem o WhatsApp somente por ação do visitante. Os valores não são cotações automáticas. Arkanon e Lymara têm valor não informado.

As seis imagens Magick IA correspondentes aos anexos foram obtidas do [projeto original Dev em Dobro](https://github.com/devemdobro/magick-ia-szpc), preservando a arte e os créditos. Origem e hashes estão em `assets/provenance.json`. As outras ilustrações customizadas exibidas no chat não estão disponíveis como arquivos no workspace. As artes personalizadas sem arquivo original acessível usam um estado de imagem pendente em vez de uma ilustração diferente.

## Catálogo completo das cartas apresentadas

O acervo de referência contém 19 cartas: Pokémon (4), Yu-Gi-Oh! (3), Magic (6) e Magick IA (6). Todas aparecem inicialmente no catálogo e podem ser filtradas por jogo. Os seis valores expressamente fornecidos foram mantidos; as outras treze cartas têm valor não informado.

Doze imagens correspondentes aos anexos estão incorporadas: seis Magick IA; Greninja ex espanhol TWM 214/167; Charizard VSTAR japonês S12a 212/172; Stonecoil Serpent SLD 1226; Tibalt, Cosmic Impostor KHM 308 (verso); Nicol Bolas, Dragon-God na arte personalizada Paul Goddard; e Sol Ring alter cósmico. A origem dos arquivos está em `assets/provenance.json`.

Sete artes originais ainda precisam dos arquivos anexos: Umbreon ex MoonlightFox, Lorena’s Gengar ex, Sarabi, the Golden One, Favored Hoplite personalizado, Mago do Caos YuGi35, Live☆Twin Lil-la Treat personalizado e Legendario Pescador Toon. Os registros já existem, sem substituição por outras ilustrações.

## Divulgação e descoberta

A página inclui endereço canônico, metadados Open Graph e Twitter para prévias de compartilhamento. `robots.txt` permite a leitura da página pública e informa o `sitemap.xml`. A presença desses arquivos facilita a descoberta e não garante indexação por buscadores.

Este projeto usa um Worker com D1/R2 para cadastro, autenticação e arquivos. O GitHub pode guardar o código-fonte. GitHub Pages sozinho não executa o backend deste projeto.

## Baixar o código

Uma cópia do código, imagens disponíveis e testes pode ser baixada em https://gold-packs-club.aromaticearth4.chatgpt.site/downloads/gold-packs-codigo.zip. O ZIP contém os arquivos fonte e a configuração do Site, sem credenciais, registros do banco de dados ou vídeos enviados. Para enviar manualmente ao GitHub, extraia o ZIP e envie os arquivos da pasta `gold-packs` ao repositório.

## GitHub Pages

Site público no GitHub Pages: https://kalebreus.github.io/cart-oteste/.

`npm run build` atualiza o Worker e a pasta estática `docs/`. Para gerar somente a interface Pages, use `npm run build:pages`. Nas configurações GitHub Pages, use a origem `GitHub Actions`. O workflow `.github/workflows/deploy-pages.yml` gera `docs/` e publica o artefato a cada alteração relevante na branch `main`; também pode ser executado manualmente pela aba Actions. A pasta `docs/` é gerada; edite os arquivos fonte na raiz e em `src/`.

A interface Pages mostra a página inicial, o catálogo e a comunidade. As leituras públicas vêm do serviço Sites, com CORS limitado ao domínio `https://kalebreus.github.io`. Login, coleção, cadastro, publicação e gerenciamento abrem o serviço de dados em navegação normal, preservando a autenticação existente. A interface Pages não recebe cookies, tokens ou chaves do serviço. Imagens de referência são servidas localmente em `/cart-oteste/assets/`; mídias enviadas pelos usuários continuam no serviço de armazenamento.
