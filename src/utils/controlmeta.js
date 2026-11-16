// Преобразования между формой редактирования controlmeta (UI-state) и телом запроса API,
// используются в SwitchCreatePage и SwitchDetailPage для протоколов tuya_local/tuya_cloud/custom.

export function headersArrayToDict(headers) {
  const dict = {}
  for (const h of headers) {
    if (h.key.trim()) dict[h.key.trim()] = h.value
  }
  return dict
}

export function headersDictToArray(dict) {
  if (!dict) return []
  return Object.entries(dict).map(([key, value]) => ({ key, value: String(value) }))
}

function actionFormToBody(action) {
  const body = {
    request: {
      url: action.request.url,
      method: action.request.method,
      headers: headersArrayToDict(action.request.headers),
      body: action.request.method === 'GET' ? undefined : action.request.body || undefined,
    },
    response: null,
  }
  if (action.response) {
    let map
    try {
      map = JSON.parse(action.response.mapText || '{}')
    } catch {
      throw new Error('Некорректный JSON в поле "Карта значений"')
    }
    body.response = { path: action.response.path, map }
  }
  return body
}

function actionBodyToForm(action) {
  if (!action) {
    return { request: { url: '', method: 'POST', headers: [], body: '' }, response: null }
  }
  return {
    request: {
      url: action.request?.url || '',
      method: action.request?.method || 'POST',
      headers: headersDictToArray(action.request?.headers),
      body: action.request?.body || '',
    },
    response: action.response
      ? { path: action.response.path || '', mapText: JSON.stringify(action.response.map || {}, null, 2) }
      : null,
  }
}

// form: { on, off, sync } → controlmeta JSON для body запроса. Бросает Error при невалидном JSON карты.
export function customFormToControlmeta(form) {
  return {
    on: actionFormToBody(form.on),
    off: actionFormToBody(form.off),
    sync: form.sync ? actionFormToBody(form.sync) : null,
  }
}

// controlmeta (от backend) → form-state для ControlMetaCustom
export function controlmetaToCustomForm(meta) {
  return {
    on: actionBodyToForm(meta?.on),
    off: actionBodyToForm(meta?.off),
    sync: meta?.sync ? actionBodyToForm(meta.sync) : null,
  }
}
