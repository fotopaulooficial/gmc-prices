# Preços x Mercado (Next.js + Merchant API)

Página que lista seus produtos com o preço de referência do mercado
(`price_competitiveness_product_view`, Merchant API), com filtros, ordenação e
exportação no modelo de importação da Tray.

## Exportar preços para a Tray

1. Defina o **desconto sobre a referência** (o preço sugerido é
   `referência − desconto`).
2. Filtre e marque os produtos que deseja atualizar.
3. Clique em **Aprovar seleção**, confira o resumo e gere o arquivo.
4. Importe o arquivo na Tray em **Produtos → Importar produtos do Excel**,
   usando o modelo `modelo.xlsx`.

O botão principal gera um **CSV** com exatamente as 7 colunas do modelo
`app/csv-template/modelo.xlsx`. Como o importador da Tray aceita Excel
(XLS/XLSX), a aprovação também oferece o download da mesma planilha em
**.xlsx**.

Observações do arquivo gerado:

- A coluna **Referência (código fornecedor)** fica vazia porque o relatório do
  Google Merchant não traz esse código. No importador da Tray, confirme que a
  identificação dos produtos é feita pelo **Código do produto (ID)**.
- As colunas de promoção ficam vazias; a exportação altera apenas o preço de
  venda.
- Ofertas de variação (`pt~BR~667-365`) são agrupadas pelo código do produto
  pai (`667`). Quando mais de uma variação do mesmo produto é selecionada, vale
  o menor preço sugerido do grupo.
- A opção **Não aumentar preços** (ativa por padrão) mantém o preço atual
  quando ele já está abaixo do valor sugerido.

## Pré-requisitos
- Node.js 18.18+ (recomendado 20+)
- Projeto Google Cloud já registrado no Merchant Center (`registerGcp`, já feito)
- **Conta de serviço** com chave JSON, adicionada como usuária no Merchant Center
  (Configurações → Pessoas e acesso) com permissão para ver relatórios

## Criar a conta de serviço
1. Console → APIs e serviços → Credenciais → Criar credenciais → Conta de serviço.
2. Abra a conta criada → aba Chaves → Adicionar chave → JSON. Guarde o arquivo.
3. No Merchant Center, adicione o e-mail da conta de serviço
   (`nome@oticas-foto-paulo.iam.gserviceaccount.com`) como usuário.

## Rodar
```bash
npm install
cp .env.example .env.local
# edite .env.local e preencha GOOGLE_SERVICE_ACCOUNT_JSON
npm run dev
```
Abra http://localhost:3000.

`GOOGLE_SERVICE_ACCOUNT_JSON` deve ser o conteúdo do JSON em UMA linha. Atalho:
```bash
# Linux/macOS
node -e "console.log(JSON.stringify(require('./sa-key.json')))"
```
Alternativa: defina `GOOGLE_APPLICATION_CREDENTIALS=C:\caminho\sa-key.json`.

## Publicar
- Defina `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` para proteger a página (ela mostra seus preços).
- Na Vercel/Render/etc., cadastre as mesmas variáveis do `.env.example`.
- Nunca suba a chave JSON para o Git.

## Observações
- Só aparecem produtos que têm preço de referência no relatório.
- Dados em cache por 10 minutos; "Atualizar dados" força nova consulta.
- Se der 401/403: confira se a conta de serviço está no Merchant Center e se o
  registro do projeto (`registerGcp`) foi feito.
