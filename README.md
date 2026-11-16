# Preços x Mercado (Next.js + Merchant API)

Página que lista seus produtos com o preço de referência do mercado
(`price_competitiveness_product_view`, Merchant API), com filtros, ordenação e CSV.

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
