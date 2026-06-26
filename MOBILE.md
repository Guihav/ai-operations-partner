# 📱 App Mobile (Capacitor) — AI Workforce

O Capacitor já está instalado e configurado. Para gerar o app nativo (iOS/Android), siga estes passos **após exportar o projeto para o GitHub e clonar localmente**.

## Pré-requisitos
- **Android**: [Android Studio](https://developer.android.com/studio) instalado
- **iOS**: macOS + [Xcode](https://apps.apple.com/app/xcode/id497799835) instalado

## Setup inicial (1ª vez)

```bash
# 1. Instalar dependências
bun install

# 2. Build do app web
bun run build

# 3. Adicionar plataformas nativas
bunx cap add ios
bunx cap add android

# 4. Sincronizar web → nativo
bunx cap sync
```

## Rodar em dispositivo / emulador

```bash
# Android
bunx cap run android

# iOS (apenas macOS)
bunx cap run ios
```

Ou abra direto na IDE nativa:

```bash
bunx cap open android   # Abre Android Studio
bunx cap open ios       # Abre Xcode
```

## Hot-reload durante desenvolvimento

Edite `capacitor.config.ts` e descomente as linhas em `server.url` apontando para o preview do Lovable. O app no celular vai recarregar automaticamente a cada mudança que você publicar.

Lembre de **comentar de novo** antes de gerar o build de produção (APK/IPA).

## Atualizar após mudanças

Toda vez que mudar o código web:

```bash
bun run build
bunx cap sync
```

## Configuração do app

- **App ID**: `app.lovable.aiworkforce` (mude em `capacitor.config.ts`)
- **Nome**: AI Workforce
- **Diretório web**: `.output/public` (TanStack Start)

## Publicar nas lojas

- **Android**: Android Studio → `Build → Generate Signed Bundle` → enviar `.aab` para Google Play Console
- **iOS**: Xcode → `Product → Archive` → enviar via App Store Connect

---

Mais detalhes: [capacitorjs.com/docs](https://capacitorjs.com/docs)
