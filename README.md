# Burmalda Music — iOS App

React Native + Expo приложение для NodeShift Music.

## Требования (Windows)

- Node.js 20+
- npm или yarn
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Аккаунт на expo.dev (бесплатный)

## Установка

```bash
cd /opt/iosapp         # или скопируй на Windows
npm install
```

## Локальный запуск (Expo Go / симулятор)

```bash
npx expo start
```

## Сборка IPA (EAS Build — без Mac)

1. Войди в EAS:
```bash
eas login
```

2. Создай проект (один раз):
```bash
eas build:configure
```

3. Собери IPA:
```bash
# Preview (внутреннее распространение, без App Store)
eas build --platform ios --profile preview

# Production
eas build --platform ios --profile production
```

EAS собирает на своих серверах — Mac не нужен.
Готовый .ipa скачиваешь с expo.dev.

## Установка IPA без App Store

Используй **AltStore** или **Sideloadly**:
- Скачай AltStore на iPhone: altstore.io
- Установи IPA через AltStore на компьютере

## Автообновления (OTA)

После каждого изменения JS-кода (без нативных изменений):
```bash
eas update --branch production --message "Описание обновления"
```

Приложение автоматически скачает обновление при следующем запуске.
**Нет 7-дневного лимита** — EAS Update для production-сборок не имеет ограничений.

## Ассеты (нужно заменить)

- `assets/icon.png` — 1024×1024, иконка приложения (используй favicon NodeShift)
- `assets/splash.png` — 1284×2778, экран загрузки

Скачай favicon с nodeshift.space и сделай квадратный вариант 1024×1024.

## Структура

```
app/
  auth.tsx          — Экран входа (OAuth NodeShift Cloud)
  (tabs)/
    index.tsx       — Главная
    library.tsx     — Библиотека треков
    search.tsx      — Поиск
    profile.tsx     — Профиль
components/
  Player.tsx        — Полноэкранный плеер (стиль Apple Music)
  MiniPlayer.tsx    — Мини-плеер над табами
hooks/
  useAudio.ts       — Воспроизведение через expo-av
  useAuth.ts        — Авторизация
services/
  api.ts            — API клиент (music.nodeshift.space)
store/
  index.ts          — Zustand (плеер + авторизация)
constants/
  theme.ts          — Цвета, шрифты, отступы
```
