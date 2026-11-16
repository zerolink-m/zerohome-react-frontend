# ZeroCams API (cursedapi v1.1)

Base URL: `/v1`. Весь JSON-API построен по стандарту **cursedapi v1.1** (спека локально: [`docs/cursedapi/`](docs/cursedapi/README.md); это данные стандарта). Единственный источник истины для этого документа — код (`app/routers/**`, `app/schemas/**`, `app/deps/**`, `app/core/**`) и тесты (`tests/`). Таблица соответствия старых числовых кодов новым: [`docs/migration_codes.md`](docs/migration_codes.md).

Обозначения в таблицах эндпоинтов:

- **Права** — кто допускается: `public` (без токена), `access` (действующий bearer сессии: user или admin), `admin` (только роль admin из БД), `access | share:<type>` (bearer ИЛИ share-токен, см. «Аутентификация»).
- **Тело** — содержимое `data` запроса (`data.<ключ>`); все тела — Request object `{data, options}` (см. ниже). `—` = тела нет.
- **Ответ** — ключ в `data` ответа. `custom` — не CursedJSON (бинарный/потоковый/WebSocket ответ, без конверта на успехе; ошибки до начала отдачи тела — обычный конверт).
- Rate limit указан в конце каждого раздела в формате «ёмкость / пополнение в минуту» на IP.

---

## 1. Общие соглашения

### 1.1 Envelope

Каждый JSON-ответ (успех и ошибка) — конверт из пяти полей, все присутствуют всегда:

```json
{
  "code": "000",
  "code_detail": "Success.",
  "error": {},
  "metadata": {
    "request_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "generated_at": 1760000000,
    "duration": 0.012345,
    "cursed_version": "1.1"
  },
  "data": {}
}
```

- `code` — трёхзначная **строка** (`"000"`..`"255"`). HTTP-статус определяется кодом (`app/core/codes.py`).
- `code_detail` — фиксированное английское описание кода.
- `error` — `{}` при успехе; при ошибке Error object: `{"error": "<текст>", "fields": {...}, "query": {...}, "path": {...}, "headers": {...}, "hint": "...", "docs": "..."}` (присутствуют только непустые секции). Секции `fields`/`query`/`path`/`headers` содержат Field objects: `{"error": "...", "required": true, "type": "string", "actual_type": "int", "min_length": 1, "max_length": 64, "actual_length": 70, "min": 1, "max": 255, "enum": [...], "pattern": "...", "format": "email", "unknown": true, "value": ..., "nested": {...}, "items": {...}}` (только применимые ключи; значения чувствительных полей — `password`, `token` и т.п. — не эхо-возвращаются). Текст `error.error` может быть на русском или английском; опираться нужно на `code`.
- `metadata` — `request_id`, `generated_at` (unix), `duration` (сек), `cursed_version`; опционально `page` (`{current, pages}` — только в списках), `expand`, `warnings` (список строк, например при игнорировании admin-only полей в `PATCH /users`), `deprecated`.
- `data` — Data object (всегда объект): `{<ключ ресурса>: {...}}` для одиночных, `{settings: {...}, <ключ во мн. числе>: [...]}` для списков, `{}` если нечего вернуть и при ошибках (кроме Bulk, где `data` несёт Bulk object).

Ошибка валидации (пример):

```json
{
  "code": "109", "code_detail": "Validation error.",
  "error": {"error": "Some fields are invalid",
            "fields": {"email": {"error": "invalid format", "type": "string", "format": "email", "value": "x"}}},
  "metadata": {"request_id": "…", "generated_at": 1760000000, "duration": 0.003, "cursed_version": "1.1"},
  "data": {}
}
```

Ключи объектов в запросах и ответах — в `snake_case`. Все схемы запросов строгие: **неизвестные поля отклоняются** (`109`, `fields.<name>.unknown = true`).

### 1.2 Request object

Все `POST`/`PATCH` (и необязательное тело bulk-`DELETE` у switches/connections) принимают:

```json
{
  "data":    { "<ключ ресурса>": { "...поля...": "..." } },
  "options": { "partial_allowed": false }
}
```

- `Content-Type: application/json` обязателен при непустом теле (иначе `107`/HTTP 415). Пустое тело = `121`; битый JSON = `117`.
- Для одиночных операций: `data.<ключ>` — объект (`data.cam`, `data.user`, `data.credentials` и т.д.; ключ указан в таблице). Отсутствие ключа/обёртки/не-объект = `109` (`error.fields.<ключ>` или `fields.data`). «Плоские» тела старого API отклоняются кодом `109`.
- Для bulk: `data.<ключ во мн. числе>` — непустой массив объектов (пустой = `121`).
- `options.partial_allowed` — только `bool` (иначе `109`); неизвестные ключи `options` игнорируются. Резервный источник — query `?partial_allowed=true|false|1|0|yes|no|on|off` (`options` приоритетнее; невалидное значение query = `118`).
- Тела без `data` обязательны не везде: `POST /v1/auth/new-refresh`, `/auth/logout`, `/invitations/{id}/accept|decline`, `/connections/{id}/sync`, `/cams/{id}/motion/start|stop` тела не читают.

### 1.3 Коды ответов (только используемые проектом)

Полный справочник — [`docs/cursedapi/docs/codes.md`](docs/cursedapi/docs/codes.md). Ниже коды, которые реально выдаёт код проекта (включая автоматические — ядро, валидация, rate limit).

**Успех**

| Код | HTTP | Где / смысл |
|---|---|---|
| `000` | 200 | Успех (чтение, список, `config` актуален, `health`, `version`, ...) |
| `001` | 201 | Создано (включая полностью успешный bulk-POST) |
| `002` | 201 | Bulk-POST: создана часть (`partial_allowed=true`, есть и успехи, и ошибки) |
| `003` | 200 | Изменено (включая полностью успешный bulk-PATCH) |
| `004` | 200 | Bulk-PATCH: изменена часть |
| `005` | 200 | Не изменено: PATCH не поменял ни одного значения (в `data` всё равно возвращается объект) |
| `007` | 200 | Удалено (включая bulk-DELETE целиком) |
| `008` | 200 | Bulk-DELETE: удалена часть |
| `010` | 200 | Авторизован (`POST /auth/login`, выдан bearer сессии) |
| `012` | 200 | Пустой результат: список без записей (`data.settings` и пустой массив присутствуют) |
| `018` | 200 | Выход выполнен (`POST /auth/logout`) |
| `019` | 200 | Старый refresh обменян (`POST /auth/new-refresh`, выдан bearer сессии) |
| `020` | 200 | Доступно обновление фронтенда (`GET /config`, данные отдаются) |

**Ошибки клиента**

| Код | HTTP | Смысл в проекте |
|---|---|---|
| `040` | 400 | Общая ошибка запроса: неверный формат `v` в `/config`; HLS отключён; PTZ-значение вне диапазона камеры; невалидные `record_metadata` (путь недоступен); неизвестный/ненастроенный `control_proto` у выключателя |
| `042` | 401 | Ошибка токена: схема не `Bearer`; неизвестный/отозванный bearer, старый access JWT или неподходящий share-токен; share-токен не подходит ресурсу/отозван; сессия/пользователь не найдены; User-Agent не совпал (сессия удалена) |
| `043` | 401 | Токен истёк |
| `044` | 401 | Токен подписан неверным ключом (в т.ч. **share-токен на эндпоинте с обычным access**) |
| `045` | 401 | Недопустимый алгоритм токена |
| `046` | 401 | Токен не передан |
| `149` | 400 | Неверный формат старого JWT при `/auth/new-refresh` (непрозрачный неизвестный bearer → `042`) |
| `050` | 403 | Недостаточно роли (нужен admin) |
| `051` | 403 | Доступ к ресурсу запрещён для этого объекта (чужая сущность / не владелец) |
| `061` | 403 | `tuya_local` не разрешён пользователю (`allow_tuya_local != 1`) |
| `062` | 403 | Запись не разрешена пользователю (`allow_record != 1`) |
| `063` | 403 | Версия фронтенда устарела, обновление обязательно (`GET /config`) |
| `082` | 404 | Объект не найден (в т.ч. «не видим пользователю») |
| `083` | 404 | Маршрут не найден |
| `084` | 404 | Файл не найден (HLS-сегмент) |
| `096` | 405 | Метод не разрешён |
| `107` | 415 | `Content-Type` тела не `application/json` |
| `109` | 422 | Ошибка валидации тела/пути (`error.fields` / `error.path`), в т.ч. неверный список `{ids}`; также итог bulk, где все элементы провалились по разным причинам |
| `110` | 423 | PTZ заблокирован предыдущей командой (на 3 сек) |
| `114` | 429 | Глобальный rate limit (300 запросов/мин на IP) |
| `117` | 400 | Битый JSON |
| `118` | 400 | Невалидные query-параметры (в т.ч. `?partial_allowed`, `period`, `from`/`to`/`at`, неверный `order`, неверный синтаксис списков) |
| `121` | 400 | Пустое тело (или пустой массив в bulk) |
| `138` | 400 | Неверный email или пароль |
| `139` | 400 | Email уже занят |
| `143` | 400 | Недопустимое поле `sort_by` |
| `144` | 400 | Недопустимая колонка `search_column` |
| `145` | 400 | Неверные `limit`/`offset` (не число, `limit < 1`, `offset < 0`) |
| `146` | 400 | Превышен размер bulk-запроса (элементов в теле или `{ids}` в пути) |
| `160` | 422 | Не передан обязательный query-параметр (автоматический код валидации) |
| `172` | 429 | Слишком много попыток логина (`POST /auth/login`) |
| `173` | 429 | Rate limit эндпоинта |
| `176` | 409 | PTZ не настроен / камера не отвечает по ONVIF / камера отклонила учётные данные ONVIF (неверный логин/пароль или блокировка) |
| `223` | 502 | Ошибка связи/протокола ONVIF с камерой (сеть, SOAP-ошибка, разбор ответа) |
| `177` | 409 | Запись для камеры не настроена |
| `178` | 400 | Некорректное приглашение (владелец, дубликат) |
| `180` | 400 | Некорректная share-ссылка (тип для устройства, TTL вне диапазона) |
| `183` | 400 | `limit` больше максимума эндпоинта |
| `188` | 422 | Пустая позиция в списке `search`/`search_column`/`search_method`/`sort_by`/`order` |
| `189` | 422 | Длины списков `search`, `search_column`, сравнений `search_method` не совпадают |
| `190` | 400 | Некорректное соединение (невалидный `meta`, соединение отключено при `/sync`) |

**Ошибки сервера**

| Код | HTTP | Смысл |
|---|---|---|
| `201` | 500 | Внутренняя ошибка (не стартовал стрим/HLS, не получен снимок, ошибка переключения выключателя, необработанное исключение) |
| `215` | 501 | Параметр `expand` не реализован (на всех списках) |

Остальные коды справочника проектом не выдаются. Ошибочный HTTP-статус от Starlette/FastAPI вне приложения-логики отображается так: 404 «Not Found» → `083`, 405 → `096`, прочие по таблице `_HTTP_TO_CODE` (`app/core/errors.py`).

### 1.4 Аутентификация

Одна сессия — один непрозрачный bearer-токен (32 случайных байта, base64url). В БД хранится только SHA-256 токена; роль берётся из текущей записи пользователя. Источник истины — БД: logout и удаление сессии немедленно отзывают токен во всех воркерах. Сессия истекает при `last_seen <= now - 30 суток` и физически удаляется при обращении, перечислении сессий и фоновым заданием (раз в час, включая запуск). `last_seen` записывается не чаще раза в 60 секунд (UTC Unix seconds): период бездействия отсчитывается от **сохранённого** времени. Значение может отставать от последнего запроса менее чем на 60 секунд. Изменение версии браузера (только цифры в User-Agent) обновляет UA; иное изменение удаляет сессию.

| Токен | Выдаётся | Принимается |
|---|---|---|
| **bearer сессии** | `POST /auth/register`, `POST /auth/login`, разовый `POST /auth/new-refresh` | все защищённые эндпоинты (роль admin определяется по БД) |
| **старый session JWT** | ранее выданный токен | только `POST /auth/new-refresh`, пока JWT и сессия действительны |
| **share JWT** | `POST /shares` (поле `token`) | только эндпоинты с пометкой `share:<type>` (см. ниже) |

**Переход:** старый access JWT не принимается ни на одном маршруте, даже при существующей сессии. Клиент обменивает старый session/refresh JWT один раз через `/auth/new-refresh`; если его нет или он истёк, требуется повторный login. Миграция сохраняет старые строки сессий с `token_hash = NULL` для обмена; повторный/конкурентный обмен невозможен после первого успешного commit. Новый токен никогда не появляется в ответе до commit. Перед запуском новой версии обязательно применить Alembic-миграцию `47400_session_bearer`; существующие строки не удаляются. До завершения перехода оставьте прежний `JWT_SECRET_SESSION`: смена ключа делает старые refresh JWT непригодными для обмена; секреты старых access JWT более не используются. Старый `/auth/access` удалён.

Передача:

- `Authorization: Bearer <token>` — везде.
- `?token=<token>` — **только** на эндпоинтах, которые встраиваются в `<video>`/`<img>`/`hls.js`/WebSocket: стрим, PTZ, live-снимок, HLS, `GET|POST /switches/{id}/state`, файл и снимок записи, WebRTC. Header `Authorization: Bearer` на них имеет приоритет. На остальных эндпоинтах `?token=` игнорируется (будет `046`).
- **Dash-encoding**: в `?token=` клиент может вставлять `-` после каждых 10 символов (обход CDN/WAF). Проверяются обе формы — исходная и снятая по позициям; это поддерживается и на WebSocket. Заголовок передаётся без преобразования.

Правила проверки:

| Ситуация | Код |
|---|---|
| Нет `Authorization` / пустой Bearer (на query-эндпоинтах — нет ни header, ни `?token=`) | `046` (401) |
| Схема не `Bearer` на обычном эндпоинте | `042` |
| Токен просрочен | `043` |
| Неизвестный/отозванный bearer, старый access JWT или неподходящий тип токена | `042` (401) |
| Неверная подпись/формат/алгоритм legacy refresh JWT на `/auth/new-refresh` | `042`–`045`, `149` |
| Сессия пользователя без роли admin на admin-эндпоинте | `050` (403) |
| Share-токен на `share:*` эндпоинте, но другой `type`/`device_type`/`device_id`/`filename`, либо запись `shares` удалена (токен отозван) | `042` |

Все ответы 401 содержат `WWW-Authenticate: Bearer`.

**Share-токены** (создание — `POST /shares`):

| `type` | `device_type` | Даёт доступ к |
|---|---|---|
| `stream` | `cams` | `GET /cams/{id}/stream`, `GET|POST /cams/{id}/ptz`, `GET /cams/{id}/snapshot`, `GET /cams/{id}/hls/**`, WS `/cams/{id}/webrtc` (только этой камеры) |
| `device_use` | `switches` | `GET|POST /switches/{id}/state` (только этого выключателя) |
| `record` | `cams` | `GET /cams/{id}/recordings/{recording_id}/file` и `/snapshot` — только для камеры и файла из токена |

Share-токен не даёт доступа к остальным эндпоинтам: на них он даёт `401/044`. Share-токен обходит проверки видимости/приглашений для своей камеры/выключателя.

Видимость устройств для bearer сессии: **admin** видит и управляет всем; **владелец** (`owner`) — своими; **приглашённый** — чужими устройствами с `enabled = 1` и приглашением `status = accepted` на его email (только просмотр/использование, без изменения и удаления, поля с кредами скрыты). Невидимый объект даёт `082`, видимый, но без права изменения — `051`.

### 1.5 List-query (GET-списки)

Параметры (все необязательные), общие для списков `users`, `sessions`, `cams`, `switches`, `connections`, `invitations`, `shares`, `recordings`, `motion_events`:

| Параметр | По умолчанию | Описание |
|---|---|---|
| `limit` | 25 | 1..255 (у отдельных списков меньше, см. раздел ресурса). Нечисло/<1 → `145`; больше макс. → `183` |
| `offset` | 0 | ≥ 0, иначе `145` |
| `sort_by` | — | Поле(я) через запятую из белого списка эндпоинта; чужое поле → `143` |
| `order` | `ascending` | `asc`/`ascending`/`desc`/`descending` (регистр не важен); одно значение для всех `sort_by` либо по одному на каждое; иное → `118` |
| `search` | — | Искомые значения (список через запятую) |
| `search_column` | — | Колонки (из белого списка; иначе `144`). `search` и `search_column` — только вместе, иначе `118` |
| `search_method` | `include` | Сравнения и связки (см. ниже) |
| `expand` | — | Не реализован: любой `expand` → `215` (501) |

Списки в параметрах разделяются запятой; значение с запятой берётся в кавычки: `search='Smith, John'` (внутри кавычки удваиваются). Пустая позиция (`a,,b` или хвостовая запятая) → `188`; битые кавычки → `118`.

**Мультипоиск.** `search`, `search_column`, `search_method` читаются позиционно. Сравнения: `equals`, `exactly` (оба `=`; для int-колонок значение должно быть числом, иначе `118`), `include` (`LIKE %v%`, по умолчанию), `starts`, `ends`, `exclude` (`NOT LIKE %v%`). Связки: `and`, `or` (по умолчанию), `and_not`, `or_not`. Реализована трактовка README cursedapi: **связка — отдельный токен `search_method` между двумя сравнениями**, сама условия не создаёт и присоединяет следующее условие к предыдущему; вычисление слева направо без приоритетов, без скобок. Одна колонка / одно сравнение распространяются на все значения. Несовпадение длин → `189`; связка не между сравнениями или неизвестный токен → `118`. Пример: `?search=john,doe,jane&search_column=name,surname,name&search_method=equals,or,include,and_not,include` читается как `name = john OR surname LIKE %doe% AND NOT name LIKE %jane%` (слева направо).

**Ответ списка** — код `000` (или `012`, если записей нет), в `data` всегда `settings` (эхо запроса; `sort_by`/`search*` — как переданы, либо `null`) и массив под ключом ресурса; `metadata.page = {current, pages}`:

```json
{
  "code": "000", "code_detail": "Success.", "error": {},
  "metadata": {"request_id": "…", "generated_at": 1760000000, "duration": 0.01, "cursed_version": "1.1",
               "page": {"current": 1, "pages": 1}},
  "data": {
    "settings": {"total": 2, "limit": 25, "offset": 0, "order": "ascending",
                 "sort_by": null, "search": null, "search_method": null, "search_column": null},
    "cams": [ {"id": 1}, {"id": 2} ]
  }
}
```

`settings.total` — общее число записей после фильтра (до limit/offset).

### 1.6 Bulk

Эндпоинты `…/bulk` и `…/bulk/{ids}` (где `{ids}` — целые через запятую, например `1,2,5`; дубликаты молча отбрасываются, порядок сохраняется; нецелая позиция → `109` с `error.path.ids`). Лимиты: **users 100, sessions 100, cams 100, switches 100, connections 50** (у invitations, shares, push-settings, motion, stats bulk нет). Превышение (элементов в теле или `ids` в пути) → `146`.

| Операция | Путь | Тело |
|---|---|---|
| Создание | `POST /<ресурс>/bulk` | `data.<множ.>[]` — массив объектов создания |
| Чтение | `GET /<ресурс>/bulk/{ids}` | — |
| Изменение | `PATCH /<ресурс>/bulk/{ids}` | у cams, switches, connections: `data.<множ.>[]` — массив патчей, **i-й элемент применяется к i-му id** (длина массива = числу ids, иначе `109`); у users: один объект `data.user`, применяется ко всем ids |
| Удаление | `DELETE /<ресурс>/bulk/{ids}` | у switches и connections — необязательное тело `{options}`; у users/sessions/cams — только `?partial_allowed=` |

Режимы:

- **Атомарный** (`partial_allowed` не задан/`false`): первая же ошибка отклоняет весь запрос кодом этой ошибки (`109`, `082`, `051`, ...); ничего не применяется. Ответ успеха — `001`/`003`/`007`, `data.<множ.> = [объекты]` (для удаления — `[{"id": n}]`).
- **Частичный** (`partial_allowed=true`): применяется всё, что можно; если есть и успехи, и ошибки — `002`/`004`/`008` и Bulk object:

```json
{
  "code": "004", "code_detail": "Partially edited successfully.", "error": {},
  "metadata": {"…": "…"},
  "data": {"cams": {
    "succeeded": [ {"id": 1, "name": "z"} ],
    "failed": [ {"id": 7, "error": {"error": "Object not found"}} ]
  }}
}
```

  В `failed[].id` — id объекта (PATCH/DELETE) либо **индекс элемента запроса** (POST). Если провалились все элементы — HTTP-ошибка с общим кодом причины (если причина у всех одна; иначе `109`), а `data.<множ.>` несёт `{succeeded: [], failed: [...]}`.
- Невалидные элементы в атомарном режиме дают `109` без применения чего-либо.

Различия по ресурсам: `GET /cams|switches|connections|sessions/bulk/{ids}` атомарны — при любом отсутствующем **или невидимом** id (чужая камера неотличима от несуществующей) весь запрос отвечает `082`, ни один объект не возвращается; `partial_allowed` для GET не поддерживается; `GET /users/bulk/{ids}` при чужих id отвечает `051`. В ответе `GET bulk` `settings.total` = число запрошенных id, `limit` = то же число, `offset` = 0.

### 1.7 Заголовки

Во всех ответах приложения (включая ошибки и OPTIONS):

| Заголовок | Значение |
|---|---|
| `cursed-version` | `1.1` |
| `cursed-duration` | время обработки, сек |
| `cursed-request-id` | уникальный id запроса (совпадает с `metadata.request_id`) |
| `cursed-deprecation` | `true` — только на устаревших маршрутах (сейчас таких нет) |
| `Cache-Control: no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0` | по умолчанию; у эндпоинтов, выставляющих свой `Cache-Control` (файл записи, снимок записи, HLS-сегмент), он сохраняется |

**Rate limit.** Глобальный лимит 300 запросов/мин на IP (ёмкость 300, пополнение 300/мин) применяется к каждому запросу; заголовки `cursed-rate-limit-limit`, `cursed-rate-limit-remaining`, `cursed-rate-limit-reset` (unix-время полного пополнения), `cursed-rate-limit-policy` (`300;w=60`) возвращаются на успешных ответах. Отдельные лимиты эндпоинтов (указаны в разделах) — отдельные «корзины» на IP; при превышении: HTTP 429, код `173` (логин — `172`, глобальный — `114`), заголовки `Retry-After` и `cursed-retry-after` (сек), а для лимита эндпоинта — свои `cursed-rate-limit-*` с `remaining: 0`. Лимит проверяется до аутентификации.

**Корзины rate limit эндпоинтов** (на IP; имя корзины уникально для набора лимитов — одинаковое имя имеют только эндпоинты с одинаковым лимитом):

| Корзина | Ёмкость / в мин. | Эндпоинты |
|---|---|---|
| `cams_snapshot_live` | 600 / 600 | `GET /cams/{id}/snapshot` |
| `cams_recording_snapshot` | 3000 / 3000 (кэш 1 очко, генерация 3) | `GET /cams/{id}/recordings/{rid}/snapshot` |
| `switches_state_read` | 300 / 300 | `GET /switches/{id}/state` |
| `switches_state_write` | 30 / 30 | `POST /switches/{id}/state` |
| `cams_webrtc` | 20 / 20 | подключение WS `/cams/{id}/webrtc` |
| `webrtc_ice` | 60 / 60 | `GET /webrtc/ice` |
| `cams_stream` | 30 / 30 (open 10, attach 3) | `GET /cams/{id}/stream` |
| `cams_hls` | 50 / 50 | HLS |
| `cams_ptz_move` / `cams_recording_file` | 15 / 15 · 20 / 20 | PTZ POST · файл записи |
| `*_read` (users, cams, switches, connections, shares, invitations, push_settings, motion) | 60 / 60 | чтение |
| `*_write` (users, cams, switches, shares, invitations, push_settings) | 20 / 20 | запись |
| `connections_write` · `motion_write` · `motion_control` · `motion_photo` | 10 / 10 · 30 / 30 · 10 / 10 · 100 / 60 | |
| `stats` · `config` · `config_time` | 20 / 20 · 20 / 120 · 20 / 120 | `config_time`: `GET /config/time` |
| `auth_register` / `auth_login` / `auth_access` / `auth_logout` | 3 / 0.3 · 5 / 1 · 20 / 20 · 30 / 30 | |


**OPTIONS** на любой существующий путь (включая пути с id) возвращает `000` с `data.endpoint = {path, methods, supported_functions}` и заголовки:

| Заголовок | Значение |
|---|---|
| `Allow` | методы пути (включая OPTIONS) |
| `cursed-supported-functions` | список через запятую из `limit, offset, sort_by, order, search, search_method, search_column, multi_search, pagination, bulk, partial, streaming` и кастомных `x-*` (у `GET /cams/{id}/recordings` — `x-time_range`) |
| `cursed-version` | `1.1` |
| `cursed-bulk` / `cursed-max-bulk` | `on`/`off`; максимум элементов либо `off` |
| `cursed-paging` / `cursed-paging-max-limit` | `on`/`off`; максимальный `limit` (если есть) |
| `cursed-streaming` | `on` у стрим-эндпоинтов |
| `cursed-search` | `on`, если есть поиск |
| `cursed-auth` | `bearer` или `bearer,token` (если эндпоинт принимает `?token=`) либо `off` |
| `cursed-accept` | `application/json` |
| `cursed-cache` | `off` |

OPTIONS на неизвестный путь — `083` (404). OPTIONS учитывает глобальный rate limit.

### 1.8 Служебные пути

Без авторизации, формат CursedJSON:

| Метод | Путь | Ответ |
|---|---|---|
| GET | `/v1/health` | `data = {"status": "ok"}` |
| GET | `/v1/version` | `data.version = {"api": "v1", "supported": ["v1"], "cursed": "1.1", "app": "<версия приложения>"}` |
| GET | `/v1/docs` | Swagger UI (FastAPI), custom, не CursedJSON |
| GET | `/v1/openapi.json` | OpenAPI-схема FastAPI, custom |

---

## 2. Config

Префикс `/v1/config`. Права: `public`. Rate limit `GET /config`: 20 / 120 в мин. (`config`).

| Метод | Путь | Тело | Ответ | Ошибки |
|---|---|---|---|---|
| GET | `/v1/config?v=…` | — | `data.config = {version, actual_version}` (коды `000`/`020`) | `063`, `040`, `173` |
| GET | `/v1/config/frontend` | — | `data.config = {version}` — версия приложения | — |
| GET | `/v1/config/frontend/supported_streams` | — | `data.streams[]` — доступные форматы стриминга | — |
| GET | `/v1/config/time` | — | `data.time` — текущее время UTC, unix timestamp (целое, секунды). Открытый, без токена; rate limit `config_time` 20 / 120 | `173` |

### Логика версий фронтенда (`GET /v1/config?v=vM.m.p-Channel`)

Клиент передаёт `v` строго в формате `vMAJOR.MINOR.PATCH-Channel`: числа 0..99, `Channel` ∈ `Release | Beta | Alpha` (например `v3.5.1-Release`). Сервер сопоставляет версию с шаблонами из `frontend_versions.json` (кэш 20 минут; шаблоны вида `v3.(0-4).(0-9)-*`; при нескольких совпадениях побеждает самый специфичный) и отвечает:

| Результат | HTTP | `code` | `data` |
|---|---|---|---|
| Версия актуальна | 200 | `000` | `{"config": {"version": "<v клиента>", "actual_version": "<версия приложения>"}}` |
| Обновление доступно (клиент работоспособен) | 200 | `020` | то же, данные отдаются |
| Обновление **обязательно** | 403 | `063` | `{}` (данных нет) |
| `v` не передан | 403 | `063` | `{}` |
| Ни один шаблон не подошёл (или файл версий пуст) | 403 | `063` | `{}` |
| `v` неверного формата (например `1.2.3`) | 400 | `040` | `{}`; `error.query.v = {"error": "must match vMAJOR.MINOR.PATCH-Release|Beta|Alpha"}` |

Пример `020`:

```json
{"code": "020", "code_detail": "A frontend update is available.", "error": {},
 "metadata": {"…": "…"},
 "data": {"config": {"version": "v3.2.0-Beta", "actual_version": "v3.5.1-Release"}}}
```

`GET /config/time` пример: `{"code": "000", ..., "data": {"time": 1761912000}}`.

`GET /config/frontend/supported_streams` пример: `{"streams": [{"format": "fmp4", "enabled": true, "readonly": true, "name": "Fragmented MP4", "description": "...", "latency": "2-5s", "endpoint": "/v1/cams/{id}/stream", "mime_type": "video/mp4", "features": ["low_latency","seek","pause"]}]}`. К `fmp4` добавляются `hls` (если включён HLS; `endpoint: /v1/cams/{id}/hls/playlist.m3u8`, `mime_type: application/vnd.apple.mpegurl`) и `webrtc` (если включён WebRTC и задан STUN; `endpoint: /v1/cams/{id}/webrtc`, `protocol: websocket`).

---

## 3. Auth

Префикс `/v1/auth`. Тело — Request object.

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| POST | `/v1/auth/register` | public | `data.user = {name, surname, email, password}` | `001` (201), `data = {"user":{"id":n},"token":"<bearer>"}` | `109`, `139`, `173` |
| POST | `/v1/auth/login` | public | `data.credentials = {email, password}` | `010`, `data = {"token": "<bearer>"}` | `109`, `138`, `172` |
| POST | `/v1/auth/new-refresh` | старый session JWT | — | `019`, `data = {"token": "<bearer>"}` | `042`–`046`, `149` |
| POST | `/v1/auth/logout` | bearer | — | `018`, `data.session = {"id": sid}` | `042`–`046` |

Поля: `name`, `surname` — 1..64; `email` — валидный email ≤ 255 (приводится к нижнему регистру); `password` — 1..128. Регистрация всегда создаёт роль `user`.

- **register/login**: создают запись сессии (`ua` из `User-Agent`, `ip`); возвращают одноразово показанный непрозрачный bearer-токен. При регистрации выдаются также `data.user.id`.
- **new-refresh**: проверяет подпись, срок и владельца старого session JWT, существование и срок сессии, User-Agent по прежнему правилу; атомарно заменяет пустой `token_hash` новым хешем. Только один конкурентный запрос может успешно обменять JWT; повторный запрос получает `042`. Не принимает старый access JWT, новый bearer или истёкший refresh.
- **logout**: удаляет сессию, на которую указывает bearer.
- Rate limit: register 3 / 0.3 в мин; login 5 / 1 в мин (код `172`); new-refresh 20 / 20; logout 30 / 30.

---

## 4. Users

Префикс `/v1/users`. Ключи тела: `user` (один), `users` (bulk). Права доступа к объекту: admin — любой пользователь; user — только себя (чужой → `051`).

Объект `user` (`UserOut`; пароль наружу не отдаётся):

```json
{"id": 1, "name": "Ivan", "surname": "Petrov", "email": "ivan@example.com", "role": "user",
 "allow_record": 0, "allow_tuya_local": 0, "motion_detection_allowed": 0,
 "push": null, "push_metadata": null, "added_at": 1760000000, "updated_at": 1760000000}
```

`push` — `null | "telegram"`; `push_metadata` — `null | {"telegram": {"bot_token": "...", "telegram_id": 123}}`.

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/users` | access (user видит только себя) | list-query | `data.users[]` + `settings` | `143`–`145`, `183`, `188`, `189`, `118`, `215` |
| POST | `/v1/users` | admin | `data.user = {name, surname, email, password, role?}` | `001`, `data.user` | `050`, `109`, `139` |
| POST | `/v1/users/bulk` | admin | `data.users[]` (≤ 100) | Bulk (`001`/`002`) | `050`, `109`, `121`, `139`, `146` |
| GET | `/v1/users/bulk/{ids}` | access | — | `data.users[]` в порядке ids | `051`, `082`, `109`, `146` |
| PATCH | `/v1/users/bulk/{ids}` | access | `data.user` (один патч для всех ids) | Bulk (`003`/`004`) | `051`, `082`, `109`, `139`, `146` |
| DELETE | `/v1/users/bulk/{ids}` | admin | `?partial_allowed` | Bulk (`007`/`008`), `[{id}]` | `050`, `082`, `109`, `146` |
| GET | `/v1/users/me` | access (действующий bearer; текущий пользователь) | — | `data.user` | `082` |
| GET | `/v1/users/{id}` | access (своё или admin) | — | `data.user` | `051`, `082` |
| PATCH | `/v1/users/{id}` | access (своё или admin) | `data.user = {…}` (все поля необязательны) | `003`/`005`, `data.user` | `051`, `082`, `109`, `139` |
| DELETE | `/v1/users/{id}` | admin | — | `007`, `data.user = {"id": n}` | `050`, `082` |

- Поля создания: `name`, `surname` 1..64, `email` ≤ 255, `password` 1..128, `role` ∈ `admin|user` (по умолчанию `user`).
- Поля патча (`UserPatch`): `name`, `surname`, `email`, `password`, `role`, `allow_record` (0/1), `allow_tuya_local` (0/1), `motion_detection_allowed` (0/1), `push` (`telegram`), `push_metadata`. `role`, `allow_record`, `allow_tuya_local`, `motion_detection_allowed` меняет только **admin**; от обычного пользователя эти поля молча отбрасываются, в `metadata.warnings` попадает `"Fields ignored (admin only): …"`. `push = "telegram"` требует `push_metadata.telegram`; `push_metadata` без `push` — `109`. Если ничего не изменилось — `005`.
- Удаление пользователя каскадно удаляет его камеры (с приглашениями и share-ссылками, останавливает стримы), выключатели (с приглашениями и ссылками), соединения и сессии. Удаление самого себя не запрещено.
- Сортировка/поиск по: `id, name, surname, email, role, added_at, updated_at`.
- Rate limit: чтение 60 / 60 (`users_read`), запись 20 / 20 (`users_write`; общая корзина с sessions).

---

## 5. Sessions

Префикс `/v1/users/{user_id}/sessions`. Доступ: свои сессии или admin (иначе `051`); несуществующий пользователь → `082`. Ключи: `session`, `sessions`. Bulk лимит 100.

Объект `session`: `{"id": 3, "uid": 1, "ua": "Mozilla/5.0 …", "ip": "203.0.113.5", "last_login": 1760000000, "last_seen": 1760000000, "updated_at": 1760000000, "added_at": 1760000000}`.

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/users/{user_id}/sessions` | access (свои/admin) | list-query | `data.sessions[]` + `settings` | `051`, `082`, query-коды |
| GET | `/v1/users/{user_id}/sessions/bulk/{ids}` | access | — | `data.sessions[]` | `051`, `082`, `109`, `146` |
| DELETE | `/v1/users/{user_id}/sessions/bulk/{ids}` | access | `?partial_allowed` | Bulk `007`/`008`, `[{id}]` | `051`, `082`, `109`, `146` |
| GET | `/v1/users/{user_id}/sessions/{id}` | access | — | `data.session` | `051`, `082` |
| DELETE | `/v1/users/{user_id}/sessions/{id}` | access | — | `007`, `data.session = {"id": n}` | `051`, `082` |

Сортировка/поиск по: `id, uid, ua, ip, last_login, added_at, updated_at`. Сессия чужого пользователя (id не принадлежит `user_id`) → `082`. Rate limit — как у users.

---

## 6. Cams

Префикс `/v1/cams`. Ключи: `cam`, `cams`. Bulk лимит 100.

Объект камеры зависит от прав: **владелец/admin** получают `CamOutFull`, **приглашённый** — `CamOutRestricted`.

`CamOutFull`:

```json
{"id": 1, "owner": 1, "name": "Gate", "enabled": 1, "notify": 0,
 "protocol": "rtsp", "address": "192.168.1.10", "port": 554, "path": "/stream1",
 "username": "admin", "password": "secret",
 "control_protocol": "onvif", "control_address": "192.168.1.10", "control_port": 80,
 "control_username": "admin", "control_password": "secret",
 "onvif_enabled": 0, "onvif_snapshot_enabled": 0, "onvif_ptz_enabled": 0,
 "record": 0, "record_type": null, "record_metadata": null,
 "updated_at": 1760000000, "added_at": 1760000000}
```

`CamOutRestricted` содержит только: `id, owner, name, enabled, protocol, address, port, path, control_protocol, onvif_enabled, onvif_snapshot_enabled, onvif_ptz_enabled, record, record_type, updated_at, added_at` (без `notify`, `username`, `password`, `control_address|port|username|password`, `record_metadata`).

Поля создания (`CamCreate`): `protocol` (`rtsp`, **обязательно**), `address` 1..255 (**обязательно**), `port` 1..65535 (**обязательно**), `username` 1..255 (**обязательно**), `password` 1..128 (**обязательно**), `name` ≤ 255, `enabled` 0/1, `notify` 0/1, `path` ≤ 255, `control_protocol` (`onvif`), `control_address`, `control_port` 1..65535, `control_username`, `control_password`. Запись и ONVIF-флаги настраиваются отдельными эндпоинтами. Патч (`CamPatch`) — те же поля, все необязательные. Включение `notify` (0→1) отправляет push-уведомление. Изменение любых `control_*` сбрасывает ONVIF-кэш.

### 6.1 CRUD

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/cams` | access (видимые) | list-query | `data.cams[]` + `settings` | query-коды |
| POST | `/v1/cams` | access | `data.cam = {…}` | `001`, `data.cam` (владелец — вызвавший) | `109` |
| POST | `/v1/cams/bulk` | access | `data.cams[]` | Bulk `001`/`002` | `109`, `121`, `146` |
| GET | `/v1/cams/bulk/{ids}` | access | — | `data.cams[]` в порядке ids; любой отсутствующий/невидимый id → `082` для всего запроса | `082`, `109`, `146` |
| PATCH | `/v1/cams/bulk/{ids}` | access (владелец/admin) | `data.cams[]` — i-й патч к i-му id | Bulk `003`/`004` | `051`, `082`, `109`, `146` |
| DELETE | `/v1/cams/bulk/{ids}` | access (владелец/admin) | `?partial_allowed` | Bulk `007`/`008`, `[{id}]` | `051`, `082`, `109`, `146` |
| GET | `/v1/cams/{id}` | access (видимая) | — | `data.cam` | `082` |
| PATCH | `/v1/cams/{id}` | access (владелец/admin) | `data.cam = {…}` | `003`/`005`, `data.cam` | `051`, `082`, `109` |
| DELETE | `/v1/cams/{id}` | access (владелец/admin) | — | `007`, `data.cam = {"id": n}` | `051`, `082` |

Сортировка/поиск по: `id, name, address, protocol, enabled, added_at, updated_at`. Без `sort_by` порядок по `id`. Удаление камеры останавливает стрим/HLS, удаляет приглашения и share-ссылки. Rate limit: чтение 60 / 60 (`cams_read`), запись 20 / 20 (`cams_write`).

### 6.2 Стрим, PTZ, снимок (share:stream)

Права для четырёх эндпоинтов ниже: **access | share:stream** (`Authorization` или dash-encoded `?token=`). Для bearer сессии действует видимость камеры (`082`), приглашённый тоже может стримить и управлять PTZ.

| Метод | Путь | Тело | Ответ | Ошибки |
|---|---|---|---|---|
| GET | `/v1/cams/{id}/stream` | — | **custom**: поток `video/mp4` (fragmented MP4) | `042`–`046`, `082`, `173`, `201` |
| GET | `/v1/cams/{id}/ptz` | — | `data.ptz = {"pan": 0.0, "tilt": 0.0, "zoom": 0.0}` | `176`, `223`, `082`, auth-коды |
| POST | `/v1/cams/{id}/ptz` | `data.ptz = {pan?, tilt?, zoom?}` (хотя бы одно, float, без NaN/Inf) | `data.ptz = {"id", "pan", "tilt", "zoom"}` (echo команды) | `176`, `223`, `110`, `040`, `109`, auth-коды |
| GET | `/v1/cams/{id}/snapshot` | — | **custom**: `image/jpeg` (ONVIF-снимок; иначе при `INGEST_ENABLED` и живом хабе — последний GOP хаба, декодированный локальным ffmpeg без нового подключения к камере (кадр может быть старше «сейчас» до длины GOP, ~3 с); иначе кадр через ffmpeg из RTSP). Формат ответа не меняется | `082`, `173`, `201`, auth-коды |

- Стрим: ёмкость бюджета `cams_stream` 30 / 30 в мин.; открытие нового стрима стоит 10 очков, подключение к уже активному — 3.
- Стрим при `INGEST_ENABLED`: источник — постоянный ingest камеры (перекодировка по требованию, общая для всех зрителей). Формат ответа не меняется. При перезапуске ingest (смена настроек камеры, сбой, плановый перезапуск без зрителей) поток завершается штатно, клиент должен переподключиться (новый init-сегмент).
- PTZ: `176` — не задан `control_protocol`, камера не отвечает по ONVIF, PTZ не поддерживается или камера отклонила учётные данные ONVIF (после отказа/блокировки камера не опрашивается по ONVIF `ONVIF_AUTH_BACKOFF_SECONDS` (1800 с), ошибка отдаётся сразу; сбрасывается сменой `control_*` или ONVIF-настроек); `223` — прочая ошибка связи/протокола ONVIF; `040` — значение вне диапазона камеры; `110` — после успешной команды камера блокируется на 3 сек. Rate limit: GET 60 / 60 (`cams_read`), POST 15 / 15 (`cams_ptz_move`).
- Снимок: 600 / 600 (`cams_snapshot_live`). Любая ошибка ONVIF-снимка (включая отказ авторизации и backoff) не отдаётся клиенту: используется фолбэк (хаб / RTSP).

Ошибка до начала отдачи потока/файла — обычный конверт (например `201` при неудачном запуске стрима); после старта потока ошибка конвертом не передаётся.

### 6.3 ONVIF-настройки

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| PATCH | `/v1/cams/{id}/onvif` | access (владелец/admin) | `data.onvif = {onvif_enabled?, onvif_snapshot_enabled?, onvif_ptz_enabled?}` (0/1) | `003`, `data.onvif = {"id", "onvif_enabled", "onvif_snapshot_enabled", "onvif_ptz_enabled"}` | `051`, `082`, `109` |

Rate limit 20 / 20 (`cams_write`). Всегда возвращает `003` (даже без изменений). Приглашённый (не владелец) получает `051`.

### 6.4 Запись и записи

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/cams/{id}/recording` | access (владелец/admin) | — | `data.recording_config = {record, record_type, record_metadata}` | `051`, `082` |
| PATCH | `/v1/cams/{id}/recording` | access (владелец/admin; у пользователя `allow_record = 1`) | `data.recording_config = {record?, record_type?, record_metadata?}` | `003`/`005`, `data.recording_config` | `062`, `051`, `082`, `109`, `040` |
| GET | `/v1/cams/{id}/recordings` | access (видимая камера) | list-query + `from`, `to` (unix-секунды) | `data.recordings[]` + `settings` | `177`, `082`, `118`, query-коды |
| GET | `/v1/cams/{id}/recordings/{recording_id}` | access (видимая камера) | — | `data.recording` | `177`, `082` |
| GET | `/v1/cams/{id}/recordings/{recording_id}/file` | access \| share:record | — | **custom**: файл (`video/mp4`) | `177`, `082`, auth-коды |
| GET | `/v1/cams/{id}/recordings/{recording_id}/snapshot?at=<сек>` | access \| share:record | — | **custom**: `image/jpeg` | `177`, `082`, `118`, `201`, `173` |

- `record_type` — `local`; `record_metadata = {"local": {"path": "<каталог>"}}`. При `record = 1` обязательны `record_type` (иначе `109`) и существующий читаемый каталог (иначе `040`). `062` — у пользователя не включён `allow_record`.
- Объект `recording`: `{"id": "2026-01-01_12-00.mp4", "filename": "2026-01-01_12-00.mp4", "format": "mp4", "started_at": 1760000000, "size_bytes": 1048576}`. `id` = имя файла. Поддерживаются файлы `.mp4`; `started_at` — mtime файла.
- Список записей: свой лимит — по умолчанию **10**, максимум **100**; сортировка/поиск по `id, filename, format, started_at, size_bytes`; по умолчанию новые первыми (`started_at` по убыванию). `from`/`to` — фильтр по `started_at` (неверное число → `118`). OPTIONS показывает `x-time_range`. Фильтрация и сортировка выполняются в памяти по файловой системе.
- Файл: для валидного видео отдаётся `Cache-Control: public, max-age=2073600`. Снимок: `at` — секунда видео (≥ 0, иначе `118`); кэшированный снимок — `Cache-Control: public, max-age=2073600`; ошибка генерации — `201`.
- `record`-share-токен (с `?token=` dash-encoded) действует только для одной камеры и одного файла (`filename` токена = `recording_id`); для остальных эндпоинтов записей нужен access.
- Rate limit: чтение 60 / 60 (`cams_read`), запись 20 / 20, файл 20 / 20 (`cams_recording_file`), снимок записи — бюджет `cams_recording_snapshot` 3000 / 3000: кэш 1 очко, генерация 3 очка.

### 6.5 HLS (если `HLS_ENABLED`)

Права: **access | share:stream**. Бюджет `cams_hls` 50 / 50, 1 очко за запрос.

| Метод | Путь | Ответ | Ошибки |
|---|---|---|---|
| GET | `/v1/cams/{id}/hls/playlist.m3u8` | **custom**: `application/vnd.apple.mpegurl`; если токен передан в `?token=`, он дописывается к URL каждого сегмента | `040` (HLS отключён), `082`, `201`, `173` |
| GET | `/v1/cams/{id}/hls/{segment}` | **custom**: `video/mp2t`, сегмент `*.ts` (долгий кэш) | `040`, `084` (не `.ts`/нет файла), `082`, `201`, `173` |

HLS-сессия запускается первым запросом плейлиста и останавливается после `HLS_IDLE_TIMEOUT_SECONDS` без запросов; после перезапуска источника нумерация сегментов продолжается, а плейлист помечается `EXT-X-DISCONTINUITY`.

### 6.6 WebRTC (если `WEBRTC_ENABLED`)

`WS /v1/cams/{id}/webrtc?token=<bearer или share:stream токен>` — **custom WebSocket** (не CursedJSON). Токен — только в query, dash-кодирование поддерживается (обязателен; без него — отказ рукопожатия). Любая ошибка авторизации/конфигурации закрывает соединение **`close(1008)`** с причиной (WebRTC отключён, токен недействителен/ссылка отозвана, камера не найдена, ошибка авторизации). Права на камеру проверяются так же, как у stream/PTZ: access-токен — владелец, admin или приглашённый (accepted, камера `enabled`); чужая/невидимая или несуществующая камера → `close(1008)`; share-токен — тип `stream` для этой камеры и неотозванная ссылка. Rate limit подключения: 20 / 20 (`cams_webrtc`), при превышении — `close(1008)`.

Протокол (JSON-сообщения): сервер → клиент `{"type": "offer", "sdp": "..."}`; клиент → сервер `{"type": "answer", "sdp": "..."}` и `{"type": "ice_candidate", "candidate": ...}`; ошибки: `{"type": "error", "message": "..."}` (нет SDP, неизвестный тип сообщения, ошибка обработки answer — после неё соединение закрывается).

**ICE-серверы для клиента.** `GET /v1/webrtc/ice` — `Authorization: Bearer <bearer сессии или share:stream токен>` (share-токен любой камеры, ссылка не отозвана; `?token=` не принимается; session-токен и share других типов — `042`; без токена — `046`). Rate limit 60 / 60 (`webrtc_ice`, `173`). Ответ `000`: `data.ice = {"ice_servers": [{"urls": ["stun:..."]}, {"urls": ["turn:host:3478?transport=udp", "turns:host:5349?transport=tcp"], "username": "<unix-время истечения>", "credential": "<HMAC-SHA1 base64>"}], "ttl": 3600}`. STUN — из `WEBRTC_STUN_SERVER`; TURN (udp) — `WEBRTC_TURN_SERVER` + `WEBRTC_TURN_SECRET` с временными учётными данными (coturn `use-auth-secret`, срок `WEBRTC_TURN_CREDENTIAL_TTL_SECONDS`, по умолчанию 3600); `turns:` (tcp) добавляется при заданном `WEBRTC_TURNS_SERVER`. Секрет в ответ не попадает; если TURN не настроен — только STUN, если ничего нет — `ice_servers: []`. Эндпоинт не зависит от `WEBRTC_ENABLED`.

**Адреса в SDP.** При `WEBRTC_HIDE_PRIVATE_CANDIDATES=true` (по умолчанию) в SDP-offer сервера нет кандидатов с адресами 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10, 0.0.0.0, `::1`, `fc00::/7`, `fe80::/10` (и IPv4-mapped вариантов); `raddr` приватного происхождения заменяется на `0.0.0.0 rport 0`, `c=`/`m=` указывают на первый оставшийся кандидат или `0.0.0.0:9`. Публичность обеспечивают relay (TURN сервера) и server-reflexive (STUN); при заданных `WEBRTC_PUBLIC_IP` и `WEBRTC_UDP_PORT_MIN/MAX` дополнительно добавляется srflx-кандидат `WEBRTC_PUBLIC_IP:<локальный порт>` (нужен проброс UDP 1:1 этого диапазона). Клиентам из той же LAN нужен hairpin NAT либо relay.

При `INGEST_ENABLED` и онлайн-хабе камеры видео берётся из постоянного ingest (камера не опрашивается заново на каждое подключение, первый кадр быстрее; иначе — прежний путь через RTSP). При перезапуске ingest сервер закрывает WS кодом `1012` (причина «Поток завершён»): клиент переподключается, новая сессия стартует на новом потоке; прочие сбои потока — `1011`.

**Звук.** Если у камеры есть аудиодорожка (она объявлена в init-сегменте ingest-хаба), в offer добавляется второй `m=audio` (sendonly, Opus, моно 48 кГц), синхронизированный с видео общей временной шкалой; решение принимается до создания offer — без звука в потоке (или без хаба: прямой RTSP-путь только видео) аудио-трансивера нет. Звук включён по умолчанию, отключается `WEBRTC_AUDIO_ENABLED=false`. Сбой аудио-декодера не обрывает сессию: дальше идёт тишина, видео продолжается.

---

## 7. Switches

Префикс `/v1/switches`. Ключи: `switch`, `switches`. Bulk лимит 100. Видимость — как у камер (владелец/admin/приглашённый с `enabled=1`; невидимый — `082`). Список возвращает только корневые выключатели (`parent = null`); у «мастер»-выключателя в ответе есть массив `children` (видимые дочерние каналы), у одиночного `GET` и bulk-GET — тоже.

`SwitchOutFull` (владелец/admin):

```json
{"id": 5, "owner": 1, "name": "Light", "enabled": 1, "notify": 0,
 "control_protocol": "tuya_cloud",
 "control_metadata": {"access_id": "…", "access_secret": "…", "endpoint": "openapi.tuyaeu.com", "device_id": "…", "dp_codes": null, "dp_code": "switch_1", "region": null},
 "state": 0, "state_updated_at": 1760000000, "updated_at": 1760000000, "added_at": 1760000000,
 "children": null}
```

`SwitchOutRestricted` (приглашённый): `id, owner, name, enabled, control_protocol, state, updated_at, added_at, children` (без `notify`, `control_metadata`, `state_updated_at`).

Поля создания: `control_protocol` ∈ `tuya_local|tuya_cloud|custom` (**обязательно**), `control_metadata` (объект; формат зависит от протокола, лишние ключи отклоняются), `name` ≤ 255, `enabled` 0/1, `notify` 0/1.

`control_metadata`:

- `tuya_local`: `{device_id, ip, local_key, version}` (все обязательны; требуется `allow_tuya_local = 1` у пользователя, иначе `061`).
- `tuya_cloud`: `{access_id, access_secret, endpoint, device_id}` + `dp_codes` (список; для мастер-строки) **или** `dp_code` (строка; взаимоисключающие), `region` (необязательно).
- `custom`: `{on: {request, response?}, off: {request, response?}, sync?: {request, response}}`, где `request = {url (http/https), method (GET|POST|PUT|PATCH|DELETE), headers?, body?}`, `response = {path ("status://" | "header://<имя>" | "json://body…"), map: {<значение>: 0|1}}`.

Патч (`SwitchPatch`): `name, enabled, notify, control_protocol, control_metadata`; `control_metadata` без `control_protocol` — `109`. Для авто-синхронизируемых выключателей (`added_by = auto`, создаются соединением) разрешены только `name`, `enabled`, `notify`; изменение `control_*` или удаление → `051`.

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/switches` | access (видимые) | list-query | `data.switches[]` + `settings` | query-коды |
| POST | `/v1/switches` | access | `data.switch = {…}` | `001`, `data.switch` | `061`, `109` |
| POST | `/v1/switches/bulk` | access | `data.switches[]` | Bulk `001`/`002` | `061`, `109`, `121`, `146` |
| GET | `/v1/switches/bulk/{ids}` | access | — | `data.switches[]` | `082`, `109`, `146` |
| PATCH | `/v1/switches/bulk/{ids}` | access (владелец/admin) | `data.switches[]` — i-й патч к i-му id | Bulk `003`/`004` | `051`, `061`, `082`, `109`, `146` |
| DELETE | `/v1/switches/bulk/{ids}` | access (владелец/admin) | необязательное `{options}` или `?partial_allowed` | Bulk `007`/`008` | `051`, `082`, `109`, `146` |
| GET | `/v1/switches/{switch_id}` | access (видимый) | — | `data.switch` | `082` |
| PATCH | `/v1/switches/{switch_id}` | access (владелец/admin) | `data.switch = {…}` | `003`/`005`, `data.switch` | `051`, `061`, `082`, `109` |
| DELETE | `/v1/switches/{switch_id}` | access (владелец/admin) | — | `007`, `data.switch = {"id": n}` | `051`, `082` |
| GET | `/v1/switches/{id}/state` | access \| share:device_use | — | `data.state = {"state": 0\|1, "state_updated_at": n}` | `082`, auth-коды |
| POST | `/v1/switches/{id}/state` | access \| share:device_use | `data.state = {"state": 0\|1}` | `data.state = {"state", "state_updated_at"}` | `082`, `109`, `201`, auth-коды |

- `POST …/state` отправляет команду устройству; при ошибке — `201`; для мастер-строки состояние применяется ко всем дочерним, для дочерней пересчитывается агрегат мастера. Для приглашённого `GET state` доступен только при видимом (`enabled=1`) выключателе; через share-токен — всегда для своего выключателя. Неизвестный `control_protocol` у выключателя → `040`.
- Сортировка/поиск по: `id, name, enabled, control_protocol, state, added_at, updated_at`.
- Rate limit: чтение 60 / 60 (`switches_read`), запись 20 / 20 (`switches_write`), состояние — раздельные корзины: GET 300 / 300 (`switches_state_read`), POST 30 / 30 (`switches_state_write`).

---

## 8. Connections

Префикс `/v1/connections`. Ключи: `connection`, `connections`. Bulk лимит **50**. Подключения к внешним облакам (сейчас только `tuya_cloud`); синхронизация создаёт выключатели `added_by = auto`. Видимость: admin — все, остальные — только свои (чужое — `082`). Секреты (`access_secret`) в ответах не возвращаются.

Объект `connection`:

```json
{"id": 2, "uid": 1, "provider": "tuya_cloud", "name": "My Tuya",
 "meta": {"access_id": "abc", "endpoint": "openapi.tuyaeu.com", "tuya_uid": null},
 "enabled": 1, "last_synced_at": 1760000000, "last_sync_error": null,
 "added_at": 1760000000, "updated_at": 1760000000}
```

Создание: `provider` = `tuya_cloud` (**обязательно**), `name` 1..255 (**обязательно**), `meta` (**обязательно**: `{access_id, access_secret, endpoint, tuya_uid?}`; `endpoint` — код региона `cn|us|us-e|eu|eu-w|in|sg` либо хост из справочника Tuya; неверный `meta` → `109`), `enabled` 0/1 (по умолчанию 1). Патч: `name`, `enabled`, `meta` (замена целиком; `provider` неизменяем). Невалидный `meta` в патче → `190`. После создания/изменения `meta`/`enabled` при `enabled = 1` выполняется немедленная синхронизация (ошибка синхронизации пишется в `last_sync_error`, а не возвращается).

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/connections` | access | list-query | `data.connections[]` + `settings` | query-коды |
| POST | `/v1/connections` | access | `data.connection = {…}` | `001`, `data.connection` | `109` |
| POST | `/v1/connections/bulk` | access | `data.connections[]` (≤ 50) | Bulk `001`/`002` | `109`, `121`, `146` |
| GET | `/v1/connections/bulk/{ids}` | access | — | `data.connections[]` | `082`, `109`, `146` |
| PATCH | `/v1/connections/bulk/{ids}` | access (владелец/admin) | `data.connections[]` — i-й патч к i-му id | Bulk `003`/`004` | `051`, `082`, `109`, `146`, `190` |
| DELETE | `/v1/connections/bulk/{ids}` | access (владелец/admin) | необязательное `{options}` или `?partial_allowed` | Bulk `007`/`008` | `051`, `082`, `109`, `146` |
| GET | `/v1/connections/{connection_id}` | access | — | `data.connection` | `082` |
| PATCH | `/v1/connections/{connection_id}` | access (владелец/admin) | `data.connection = {…}` | `003`/`005`, `data.connection` | `051`, `082`, `109`, `190` |
| DELETE | `/v1/connections/{connection_id}` | access (владелец/admin) | — | `007`, `data.connection = {"id": n}` | `051`, `082` |
| POST | `/v1/connections/{connection_id}/sync` | access (владелец/admin) | — | `000`, `data.connection` | `082`, `051`, `190` (соединение выключено) |

Удаление соединения удаляет его авто-выключатели (вместе с их приглашениями и share-ссылками). Сортировка/поиск по: `id, provider, name, enabled, added_at, updated_at`. Rate limit: чтение 60 / 60 (`connections_read`), запись и sync 10 / 10 (`connections_write`).

---

## 9. Invitations

Префикс `/v1/invitations`. Ключи: `invitation`, `invitations`. Приглашает пользователя по email к использованию камеры или выключателя; приглашённый получает доступ после `accept`.

Объект `invitation`: `{"id": 4, "device_type": "cams", "device_id": 1, "email": "friend@example.com", "invited_by": 1, "status": "pending", "added_at": 1760000000, "updated_at": null}` (`status`: `pending|accepted`; `updated_at` может быть `null`).

Видимость: admin — все; остальные — отправленные ими или адресованные на их email (иначе `082`).

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/invitations` | access | list-query | `data.invitations[]` + `settings` | query-коды |
| GET | `/v1/invitations/{id}` | access (видимое) | — | `data.invitation` | `082` |
| POST | `/v1/invitations` | access (владелец устройства/admin) | `data.invitation = {device_type: "cams"\|"switches", device_id, email}` | `001`, `data.invitation` (`status = pending`) | `082`, `051`, `178`, `109` |
| POST | `/v1/invitations/{id}/accept` | access (адресат или admin) | — | `003`/`005`, `data.invitation` | `082`, `051` |
| POST | `/v1/invitations/{id}/decline` | access (адресат или admin) | — | `007`, `data.invitation = {"id": n}` (приглашение удаляется) | `082`, `051` |
| DELETE | `/v1/invitations/{id}` | access (отправитель, адресат или admin) | — | `007`, `data.invitation = {"id": n}` | `082`, `051` |

`178` — приглашение владельца устройства или повторное приглашение того же email на то же устройство. `accept` отправителем (не адресатом и не admin) → `051`; повторный `accept` → `005`. Сортировка/поиск по: `id, device_type, device_id, email, status, invited_by, added_at, updated_at`. Rate limit: чтение 60 / 60, запись (включая accept/decline) 20 / 20.

---

## 10. Shares

Префикс `/v1/shares`. Ключи: `share`, `shares`. Share-ссылка = запись + JWT-токен (`type`, `device_type`, `device_id`, `filename`); удаление записи **отзывает** токен.

Объект `share` (`SharingOut`): `{"id": 7, "uid": 1, "type": "stream", "device_type": "cams", "device_id": 1, "filename": null, "updated_at": 1760000000, "added_at": 1760000000}`.

Видимость: admin — все; остальные — только свои (чужие — `082`).

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/shares` | access | list-query | `data.shares[]` + `settings` | query-коды |
| GET | `/v1/shares/{id}` | access (своё/admin) | — | `data.share` | `082` |
| POST | `/v1/shares` | access (владелец устройства/admin) | `data.share = {device_type, device_id, type, filename?, ttl_seconds?}` | `001`, `data.share = {"id", "type", "device_type", "device_id", "filename", "token", "expires_at"}` | `180`, `082`, `051`, `109`, `177` |
| DELETE | `/v1/shares/{id}` | access (своё/admin) | — | `007`, `data.share = {"id": n}` | `082` |

- Допустимые пары: камеры — `type` ∈ `stream|record`; выключатели — только `device_use`; иное → `180`. `type = record` требует `filename` (имя существующего файла записи камеры; иначе `082`/`177`); для остальных типов `filename` недопустим (`109`).
- `ttl_seconds`: по умолчанию минимальный TTL конфигурации; допустимый диапазон задаётся конфигурацией `[SHARE_TOKEN_MIN_TTL_SECONDS, SHARE_TOKEN_MAX_TTL_SECONDS]` (в тестах 60..3600), вне диапазона → `180` (схема сама допускает 1..31536000). `expires_at` — unix-время истечения токена. Токен возвращается **только при создании**.
- Сортировка/поиск по: `id, uid, type, device_type, device_id, added_at, updated_at`. Rate limit: чтение 60 / 60, запись 20 / 20.

Пример ответа создания:

```json
{"code": "001", "code_detail": "Created successfully.", "error": {}, "metadata": {"…": "…"},
 "data": {"share": {"id": 7, "type": "stream", "device_type": "cams", "device_id": 1,
                    "filename": null, "token": "eyJ…", "expires_at": 1760003600}}}
```

---

## 11. Push settings

Персональные настройки уведомлений пользователя для устройства. Ключ: `push_settings`. Доступ к устройству: admin, владелец или приглашённый с принятым приглашением (иначе `051`; устройство не найдено — `082`). Запись настроек создаётся автоматически с дефолтами при первом `GET`/`PATCH` (в том числе `GET` имеет побочный эффект создания).

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/cams/{cam_id}/push-settings` | access | — | `data.push_settings` | `051`, `082` |
| PATCH | `/v1/cams/{cam_id}/push-settings` | access | `data.push_settings = {…}` | `003`/`005`, `data.push_settings` | `051`, `082`, `109` |
| GET | `/v1/switches/{switch_id}/push-settings` | access | — | `data.push_settings` | `051`, `082` |
| PATCH | `/v1/switches/{switch_id}/push-settings` | access | `data.push_settings = {…}` | `003`/`005`, `data.push_settings` | `051`, `082`, `109` |

Объект (значения по умолчанию в скобках; в патче все поля необязательны):

```json
{"id": 1, "user_id": 1, "device_type": "cams", "device_id": 1,
 "enabled": 1, "motion_detection_enabled": 0, "motion_min_confidence": 0.6, "motion_min_object_size": 0.02,
 "motion_cooldown_seconds": 0, "motion_detect_person": 1, "motion_detect_dog": 1, "motion_detect_cat": 1,
 "motion_detect_car": 1, "motion_license_plate_ocr": 1,
 "notify_offline": 1, "notify_online": 1, "notify_state_change": 1,
 "created_at": 1760000000, "updated_at": 1760000000}
```

Ограничения: флаги 0/1; `motion_min_confidence`, `motion_min_object_size` — 0.0..1.0; `motion_cooldown_seconds` ≥ 0. Новые поля создают `109`. Rate limit: чтение 60 / 60 (`push_settings_read`), запись 20 / 20 (`push_settings_write`).

---

## 12. Motion

Детекция движения камеры. Ключи: `motion_event`, `motion_events`, `motion`. Доступ к камере (чтение): admin, владелец или приглашённый с принятым приглашением (иначе `051`; камера/событие не найдены — `082`). Управление и удаление — владелец/admin (иначе `051`).

Объект `motion_event`: `{"id": 10, "cam_id": 1, "detected_at": 1760000000, "object_type": "person", "confidence": 0.87, "object_size": 0.12, "license_plate": null, "photo_filename": "…jpg", "bbox_x": 10, "bbox_y": 20, "bbox_width": 100, "bbox_height": 200, "notified_user_ids": "1,2"}`.

| Метод | Путь | Права | Тело | Ответ | Ошибки |
|---|---|---|---|---|---|
| GET | `/v1/cams/{cam_id}/motion/events` | access (чтение камеры) | list-query | `data.motion_events[]` + `settings` | `051`, `082`, query-коды |
| GET | `/v1/motion/events/{event_id}` | access (чтение камеры) | — | `data.motion_event` | `051`, `082` |
| GET | `/v1/motion/events/{event_id}/photo` | access (чтение камеры) | — | **custom**: `image/jpeg` | `051`, `082` (нет события или файла) |
| DELETE | `/v1/motion/events/{event_id}` | access (владелец/admin) | — | `007`, `data.motion_event = {"id": n}` (удаляет и фото) | `051`, `082` |
| GET | `/v1/cams/{cam_id}/motion/status` | access (чтение камеры) | — | `data.motion = {"cam_id", "is_active"}` | `051`, `082` |
| POST | `/v1/cams/{cam_id}/motion/start` | access (владелец/admin) | — | `000`, `data.motion = {"cam_id", "started", "is_active"}` | `051`, `082` |
| POST | `/v1/cams/{cam_id}/motion/stop` | access (владелец/admin) | — | `000`, `data.motion = {"cam_id", "stopped", "is_active"}` | `051`, `082` |

- Список событий: по умолчанию **limit 50**, максимум **200**; без `sort_by` — новые первыми (`detected_at` по убыванию; в `settings.order` при этом будет `descending`, `sort_by` — `null`). Сортировка/поиск по: `id, detected_at, object_type, confidence, object_size, license_plate`.
- `start`: у владельца камеры должен быть `motion_detection_allowed = 1` (иначе `051`; проверяется и для admin).
- Каталог фото событий задаётся настройкой `MOTION_FILES_DIR` (по умолчанию `motion_files`, относительный путь — от корня проекта). Rate limit: чтение 60 / 60 (`motion_read`), фото 100 / 60 (`motion_photo`), удаление 30 / 30 (`motion_write`), start/stop 10 / 10 (`motion_control`).

---

## 13. Stats

Префикс `/v1/stats`. Только для admin: bearer сессии без роли admin → `050`. Rate limit 20 / 20 (`stats`). Ошибки: `050`, `042`–`046`, `149`, `173`.

| Метод | Путь | Query | Ответ |
|---|---|---|---|
| GET | `/v1/stats` | `period` (часы, 1..168, по умолч. 24; иначе `118`) | `data = {system, streams, cameras, recordings, motion, users, errors, performance}` — все объекты ниже сразу |
| GET | `/v1/stats/system` | — | `data.system = {cpu_percent, memory: {…}, disk: {…}, network: {…}, uptime_seconds}` |
| GET | `/v1/stats/streams` | — | `data.streams = {active_streams: {<cam_id>: n}, total_clients}` |
| GET | `/v1/stats/cameras` | — | `data.cameras = {total, enabled, disabled, onvif_enabled, ptz_enabled, recording_enabled, ingest}`. `ingest` — `null`, если `INGEST_ENABLED=false` или ingest не запущен; иначе объект `{<cam_id>: {running, state, last_error, restarts, seconds_since_data, uptime_seconds, consumers, has_init, has_gop}}` по камерам в ingest: `running` — воркер жив; `state` — `connecting`/`online`/`offline`; `last_error` — последняя ошибка (URL с логином/паролем маскируется, сам RTSP-URL не отдаётся) или `null`; `restarts` — число перезапусков ffmpeg с запуска сервиса; `seconds_since_data` — секунд с последних данных (`null`, если данных не было); `uptime_seconds` — аптайм текущего процесса ffmpeg (`null`, если не запущен); `consumers` — число подписчиков хаба; `has_init`/`has_gop` — есть ли init-сегмент / буфер GOP. Остальные поля не изменились |
| GET | `/v1/stats/recordings` | — | `data.recordings = {total_recordings, total_size_gb, total_size_bytes}` |
| GET | `/v1/stats/motion` | `period` (1..168, по умолч. 24) | `data.motion = {period_hours, total_events, events_by_object: {…}, avg_confidence, license_plates_detected, top_cameras: [{…}]}` |
| GET | `/v1/stats/users` | — | `data.users = {total_users, active_sessions, active_shares}` |
| GET | `/v1/stats/errors` | — | `data.errors = {errors_by_type: {…}, http_4xx, http_5xx, rtsp_failures, onvif_failures}` |
| GET | `/v1/stats/performance` | — | `data.performance = {endpoints: {…}, snapshots: {…}}` |

---

## 14. Известные отличия от cursedapi v1.1 / замечания

Расхождения со спекой и особенности реализации (описаны как в коде):

1. **`search_method`**: `docs/query.md` и `README.md` cursedapi описывают связки по-разному (query.md: «связка — токен `search_method` той же позиции, тройка без сравнения»; README: связки стоят между сравнениями). Реализована трактовка README: связка — отдельный токен между двумя сравнениями, не потребляет пары `search`/`search_column`.
2. **Коды списков**: `query.md` называет код `107` для пустой позиции списка, неверного `order` и неизвестного `expand`; реализованы коды `codes.md`: пустая позиция — `188`, неверный `order` — `118`, неизвестный `expand` — `184` (недостижим: ни один список не объявляет `expand`, любой `expand` даёт `215`). `181`/`182` (функция не поддерживается/отключена) в текущих эндпоинтах недостижимы.
3. **`cursed-auth`**: спека перечисляет значения `bearer`/`token`/`off`; для эндпоинтов, принимающих и header, и `?token=`, выдаётся `bearer,token`.
4. ~~Bulk-GET камер молча пропускал невидимые id~~ — **решено**: `GET /cams/bulk/{ids}` теперь атомарен (`082`, как у остальных).
5. **Bulk-PATCH**: у `users` один объект `data.user` для всех ids; у `cams`/`switches`/`connections` — позиционный массив.
6. **Bulk-DELETE и `partial_allowed`**: у `users`/`sessions`/`cams` флаг читается только из query; тело `options` у `DELETE` принимают лишь `switches` и `connections`.
7. ~~Общие rate-limit корзины с разной ёмкостью~~ — **решено**: у каждого эндпоинта своя корзина (см. таблицу в разделе 1), `cams_webrtc` подключён к WebRTC.
8. **Dash-декодирование** `?token=` применяется к любому токену в query на share-эндпоинтах (в том числе к bearer сессии); WebRTC также декодирует.
9. **Фото motion**: отсутствие файла фото даёт `082` (не `084`).
10. **Запись/снимок записи**: `GET /cams/{id}/recordings/{recording_id}` (метаданные) требует access; share:record принимается только для `file` и `snapshot` (докстринг `resolve_record_access` упоминает «meta»).
11. ~~PATCH с `null` для необнуляемых колонок~~ — **решено**: явный `null` для NOT NULL полей (камеры: `name, enabled, notify, protocol, address, port, path, username, password`, `onvif_*`; пользователи: `name, surname, email, password, role, motion_detection_allowed`; выключатели: `name, enabled, notify`; соединения: `name, enabled, meta`; `push-settings` и motion ONVIF — все поля) даёт `109`. `null` по-прежнему допустим для обнуляемых: `control_*` камеры, `record`/`record_type`/`record_metadata`, `allow_record`, `allow_tuya_local`, `push`, `push_metadata`, `control_protocol`/`control_metadata` выключателя.
12. **Удалённые эндпоинты старого API**: `POST /auth/refresh`, `PATCH /users/me`, `/users/me/invitations*` в коде отсутствуют; логин возвращает только `token` (bearer сессии), а не пользователя/сессию.
13. Проверка тестов: `/opt/zerocams_venv_new/bin/python -m pytest -q` из корня проекта.
