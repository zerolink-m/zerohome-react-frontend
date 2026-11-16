# Changelog - 26.10.2026

## Реализованы новые эндпоинты API

### 1. Motion Detection (Детекция движения)
- **GET /api/cams/{id}/motion/status** - получение статуса детекции движения
- **POST /api/cams/{id}/motion/start** - запуск детекции движения
- **POST /api/cams/{id}/motion/stop** - остановка детекции движения

### 2. Motion Events (События детекции)
- **GET /api/motion/{id}** - получение конкретного события
- **GET /api/cams/{id}/motion** - список событий с пагинацией и фильтрацией
- **DELETE /api/motion/{id}** - удаление события
- **GET /api/motion/{id}/photo** - получение фотографии события

### 3. Push Settings (Настройки уведомлений)
- **GET /api/cams/{id}/push** - получение настроек push-уведомлений для камеры
- **PATCH /api/cams/{id}/push** - обновление настроек (enabled, only_person, only_with_photo)
- **GET /api/switches/{id}/push** - получение настроек push для выключателя
- **PATCH /api/switches/{id}/push** - обновление настроек

### 4. ONVIF Settings (Настройки ONVIF)
- **PATCH /api/cams/{id}/onvif** - обновление настроек ONVIF (onvif_enabled, onvif_snapshot_enabled, onvif_ptz_enabled)

## Новые компоненты

### Компоненты камер
- **MotionDetection** - управление детекцией движения (старт/стоп)
- **MotionEventsList** - список событий движения с фильтрацией и пагинацией
- **PushSettings** - настройки push-уведомлений для камер
- **OnvifSettings** - управление настройками ONVIF

### Компоненты выключателей
- **SwitchPushSettings** - настройки push-уведомлений для выключателей

## Обновленные страницы

### CamDetailPage
Добавлены новые вкладки:
- **Motion** - детекция движения и список событий
- **Push** - настройки уведомлений
- **ONVIF** - настройки ONVIF

### SwitchDetailPage
Добавлена вкладка:
- **Push** - настройки уведомлений

## Новые API модули
- **src/api/motion.js** - API для работы с событиями движения
- **src/types/motion.js** - TypeScript типы для событий движения

## Обновленные API модули
- **src/api/cams.js** - добавлены методы для motion detection, push settings, ONVIF
- **src/api/switches.js** - добавлены методы для push settings, исправлена ошибка синтаксиса

## Исправления
- Исправлены импорты useToast во всех новых компонентах (используется из ToastContext)
- Исправлена синтаксическая ошибка в switches.js (пропущенные {} в параметрах по умолчанию)
- Все компоненты используют правильный API для работы с тостами (toast.success/toast.error)

## Стилизация
- Добавлены стили для всех новых компонентов в styles/components.css
- Стили следуют существующему дизайну приложения
