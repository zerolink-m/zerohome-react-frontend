# Миграция кодов: старый формат -> cursedapi v1.1

Конверт: `{code:int, error:str|null, data}` -> `{code:"XXX", code_detail, error:{...}, metadata:{...}, data:{...}}`.
HTTP-статус теперь определяется кодом (`app.core.codes.http_status`), а не всегда 400.

| Старый код | Старое имя | Новый код | Новое имя | HTTP | Примечание |
|---|---|---|---|---|---|
| 0 | OK | 000 / 001 / 003 / 007 | SUCCESS / CREATED / EDITED / DELETED | 200/201 | по операции; 201 -> 001 |
| 5 | FRONTEND_UPDATE_AVAILABLE | 020 | FRONTEND_UPDATE_AVAILABLE | 200 | кастомный (020-029) |
| 50 | BAD_REQUEST | 040 | BAD_REQUEST | 400 | валидация тела/query -> 109 (422), см. ниже |
| 51 | EMAIL_TAKEN | 139 | EMAIL_TAKEN | 400 | старый HTTP 409 -> по спеке 400 |
| 52 | BAD_CREDENTIALS | 138 | BAD_CREDENTIALS | 400 | старый HTTP 401 -> по спеке 400 |
| 53 | UNAUTHORIZED | 042 | TOKEN_ERROR | 401 | детализация: 043 истёк, 044 неверный ключ, 045 алгоритм, 046 нет токена, 149 битый формат |
| 54 | FORBIDDEN_ROLE | 050 | FORBIDDEN_ROLE | 403 | |
| 55 | FORBIDDEN_RESOURCE | 051 | FORBIDDEN_RESOURCE | 403 | |
| 56 | NOT_FOUND | 081 (082) | NOT_FOUND / OBJECT_NOT_FOUND | 404 | для объектов предпочтительно 082; неизвестный путь -> 083 |
| 58 | PTZ_NOT_CONFIGURED | 176 | PTZ_NOT_CONFIGURED | 409 | кастомный (176-200) |
| 59 | PTZ_LOCKED | 110 | LOCKED | 423 | стандартный |
| 60 | INVITATION_INVALID | 178 | INVITATION_INVALID | 400 | кастомный |
| 61 | RECORDING_NOT_ALLOWED | 062 | RECORDING_NOT_ALLOWED | 403 | кастомный (061-080) |
| 62 | RECORDING_NOT_CONFIGURED | 177 | RECORDING_NOT_CONFIGURED | 409 | кастомный |
| 63 | RATE_LIMITED | 114 / 173 / 172 | RATE_LIMITED / ENDPOINT_RATE_LIMITED / LOGIN_RATE_LIMITED | 429 | глобальный лимит 114; per-endpoint 173; `auth_login` 172 |
| 64 | PUSH_INVALID | 179 | PUSH_INVALID | 400 | кастомный |
| 65 | SHARE_INVALID | 180 | SHARE_INVALID | 400 | кастомный |
| 66 | TUYA_LOCAL_NOT_ALLOWED | 061 | TUYA_LOCAL_NOT_ALLOWED | 403 | кастомный |
| 67 | FRONTEND_UPDATE_NEEDED | 063 | FRONTEND_UPDATE_NEEDED | 403 | кастомный |
| 68 | CONNECTION_INVALID | 190 | CONNECTION_INVALID | 400 | кастомный |
| 99 | SERVER_ERROR | 201 | SERVER_ERROR | 500 | |

Новые автоматические коды ядра: 109 (валидация, 422, `error.fields`), 160/118 (query), 117 (битый JSON),
121 (пустое тело), 107 (не JSON Content-Type), 096 (405), 083 (маршрут не найден), 114/173/172 (429),
143/144/145/183/188/189 (query-списки), 181/182/184/215 (функции/expand), 146 (размер bulk).

Старые числовые константы сохранены как алиасы в `app/core/codes.py` (BAD_REQUEST, UNAUTHORIZED, OK, PTZ_LOCKED ...)
и указывают на новые строковые коды. Алиасы и `ok()` помечены DEPRECATED и удаляются после миграции роутеров.
Кастомные коды 216-220 (5xx) не использованы.
