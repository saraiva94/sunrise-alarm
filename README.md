# Alarme Solar

Aplicativo mobile que agenda alarmes com base no horario do nascer do sol da sua cidade.

## Sobre

O Alarme Solar e um app React Native que resolve um problema simples: acordar no horario certo para ver o nascer do sol. O usuario informa sua localizacao (por cidade, estado ou CEP) e o app consulta uma API de dados astronomicos para calcular o horario exato do nascer do sol, agendando notificacoes com antecedencia configuravel.

Alem do alarme solar, o app oferece desafios cognitivos e fisicos para garantir que o usuario realmente acordou (problemas matematicos, jogos de memoria e contagem de passos via acelerometro), alertas inteligentes de sono que notificam 90, 60 e 30 minutos antes do horario ideal de dormir, e um sistema de ranking entre usuarios baseado em sequencia de dias com alarme ativo.

## Stack

| Camada | Tecnologia | Proposito |
|--------|------------|-----------|
| Runtime | React Native 0.73 + TypeScript 5.0 | Framework mobile multiplataforma |
| Navegacao | React Navigation 7 (Native Stack) | Roteamento com stacks condicionais por estado de auth |
| Backend | Supabase (Auth + Database + Storage) | Autenticacao, persistencia de dados e armazenamento de midia |
| Estado global | React Context + useReducer | Auth, subscription e theme como providers; formularios complexos via reducer |
| Estado servidor | TanStack React Query 5 | Cache e sincronizacao de dados remotos |
| Notificacoes | Notifee | Agendamento com AlarmManager, full-screen intents e canais Android |
| Audio | react-native-sound | Reproducao de sons locais e remotos com bypass de modo silencioso (iOS) |
| Sensores | react-native-sensors | Leitura de acelerometro para contagem de passos |
| Midia | react-native-youtube-iframe + WebView | Player de YouTube, Vimeo, video/audio direto e uploads Supabase |
| Localizacao | Geolocation + Nominatim + ViaCEP | GPS nativo, geocodificacao reversa e busca por CEP |
| Monetizacao | react-native-iap | Assinaturas via Google Play Billing |
| Validacao | Zod 4 | Schemas declarativos com validacao cross-field |
| Estilizacao | NativeWind 4 (Tailwind) + StyleSheet | Utility-first styling com fallback para StyleSheet nativo |

## Funcionalidades

- Alarme baseado no horario real do nascer do sol para qualquer cidade brasileira
- Alarme manual com horario customizado
- Antecipacao configuravel (acordar X minutos antes do nascer do sol)
- Tres tipos de desafio para desligar o alarme: matematica, memoria e contagem de passos
- Tres niveis de dificuldade por desafio (facil, medio, dificil)
- Alertas inteligentes de sono (90, 60 e 30 minutos antes do horario de dormir)
- Suporte a midia no alarme: YouTube, YouTube Shorts, Vimeo, video direto, audio direto e uploads
- 6 sons de alarme embutidos com preview antes de selecionar
- Busca de localizacao por cidade/estado, CEP ou GPS do dispositivo
- Ranking de usuarios por sequencia de dias com alarme ativo
- Perfil com vinculacao de redes sociais (Instagram, Twitter/X, TikTok)
- Sistema de assinaturas com tiers: free, trial, monthly, yearly e premium
- Painel administrativo com controle de usuarios (acesso por role ou email)
- Slide-to-unlock para desligar o alarme
- Vibracoes customizadas por tipo de alarme
- Deep linking para fluxos de OAuth e reset de senha

## Arquitetura

O app usa stacks condicionais no React Navigation: se o usuario nao esta autenticado, apenas as telas de Auth e ResetPassword sao montadas; ao autenticar, o stack principal substitui o anterior sem navegacao manual. O estado de autenticacao e resolvido em tres camadas simultaneas (listener de sessao, handler de deep link e chamada sincrona de getSession) para evitar flash de tela errada em cold start. Formularios complexos como o de criacao de alarme consolidam mais de 20 campos em um unico useReducer com actions tipadas. O tratamento de notificacoes usa persistencia dupla (memoria + AsyncStorage) para garantir que alarmes disparados em background, foreground ou cold start sempre naveguem para a tela correta. Servicos externos (sunrise API, Nominatim, ViaCEP, Supabase) ficam isolados em modulos dentro de `src/services/`, sem acoplamento com componentes de UI.

## Como rodar localmente

### Pre-requisitos

- Node.js >= 18
- JDK 17
- Android SDK (compileSdk 35, buildTools 35.0.0)
- Android Studio ou emulador Android configurado
- React Native CLI

### Passos

```bash
# 1. Clonar o repositorio
git clone <url-do-repositorio>
cd SunriseAlarmRN

# 2. Instalar dependencias
npm install

# 3. Criar arquivo de variaveis de ambiente
cp .env.example .env
# Preencher as variaveis no .env (ver secao abaixo)

# 4. Iniciar o Metro Bundler
npm start

# 5. Em outro terminal, rodar no Android
npm run android
```

## Variaveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variaveis:

| Variavel | Descricao |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave publica (anon) do Supabase |

## Configuracao da Edge Function verify-purchase

A Edge Function `verify-purchase` valida receipts de assinatura com a Google Play Developer API antes de ativar o premium no Supabase.

### 1. Adicionar coluna purchase_token na tabela profiles

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS purchase_token text;
```

### 2. Configurar o secret da Google Service Account

No Google Cloud Console do seu projeto:
1. Vá em **IAM & Admin > Service Accounts**
2. Crie (ou use) uma service account com a role **Android Publisher**
3. Gere uma chave JSON para essa service account
4. No Google Play Console, va em **Settings > API access** e vincule o projeto GCP

Depois, configure o secret no Supabase:

```bash
# Copie o conteudo do arquivo JSON da service account
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"...",...}'
```

### 3. Deploy da Edge Function

```bash
supabase functions deploy verify-purchase --project-ref qfceadbmjlwjqryjzbcc
```
