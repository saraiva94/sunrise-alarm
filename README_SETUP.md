# SunriseAlarmRN - Setup

## Configurar variáveis de ambiente

1. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
2. Preencha os valores no `.env` com suas credenciais do Supabase.

## Configurar keystore para release build (Android)

1. Coloque o arquivo `sunrise-alarm-release.keystore` na pasta `android/app/`.
2. Edite `android/gradle.properties` e preencha as senhas:
   ```
   RELEASE_STORE_PASSWORD=<sua-senha>
   RELEASE_KEY_PASSWORD=<sua-senha>
   ```
3. **Senha do keystore: `sunrise2026`** — armazene em local seguro (gerenciador de senhas, variável de CI, etc.). Nunca commite senhas no repositório.

## Build

```bash
# Debug
npx react-native run-android

# Release
cd android && ./gradlew assembleRelease
```
