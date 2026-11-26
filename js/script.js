'use strict';
const D = AgroDatos;
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state = D.initialState(), currentId = '', stagedPhoto = null, filters = {}, captureStep = 1, toastTimer;
let parcelDraft = {};
const icons = {
    leaf: '<path d="M4 15C3 5 13 3 21 3c1 10-4 16-12 14M4 21 17 8"/>',
    home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
    plot: '<path d="M3 8 12 3l9 5-9 5zM3 13l9 5 9-5M3 18l9 5 9-5"/>',
    camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    chat: '<path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z"/><path d="M7 10h10M7 14h6"/>',
    bell: '<path d="M5 16V9a7 7 0 0 1 14 0v7l2 2H3zM9 21h6"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
    sync: '<path d="M3 11a9 9 0 0 1 16-6l2 3M21 3v5h-5M21 13a9 9 0 0 1-16 6l-2-3M3 21v-5h5"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4m2-17a3 3 0 0 1 0 6m4 11v-4a6 6 0 0 0-4-6"/>',
    book: '<path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
const link = (href, label, kind = 'button primary') => `<a class="${kind}" href="#${href}">${label}</a>`;
const button = (action, label, kind = 'button primary', extra = '') => `<button type="button" class="${kind}" data-action="${action}" ${extra}>${label}</button>`;
const badge = (label, kind = '') => `<span class="badge ${kind}">${esc(label)}</span>`;
const date = v => v ? new Date(v.includes('T') ? v : v + 'T12:00:00Z').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Lima' }) : 'Por coordinar';
const field = (name, label, type = 'text', value = '', help = '', extra = '') => `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${help ? `aria-describedby="${name}-help"` : ''} ${extra}>${help ? `<p class="help" id="${name}-help">${help}</p>` : ''}</div>`;
const select = (name, label, options, value = '', help = '') => `<div class="field"><label for="${name}">${label}</label><select name="${name}" id="${name}" ${help ? `aria-describedby="${name}-help"` : ''}><option value="">Seleccionar</option>${options.map(o => {
    let v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
    return `<option value="${esc(v)}" ${value === v ? 'selected' : ''}>${esc(t)}</option>`;
}).join('')}</select>${help ? `<p class="help" id="${name}-help">${help}</p>` : ''}</div>`;
const textarea = (name, label, value = '', help = '') => `<div class="field"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" rows="3" maxlength="2500" ${help ? `aria-describedby="${name}-help"` : ''}>${esc(value)}</textarea>${help ? `<p class="help" id="${name}-help">${help}</p>` : ''}</div>`;
const check = (name, label, checked = false) => `<label class="checkbox"><input type="checkbox" name="${name}" id="${name}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
const errorBox = () => '<div class="form-error" role="alert" tabindex="-1" hidden></div>';
const empty = (title, text, action = '') => `<div class="empty">${icon('leaf')}<h2>${title}</h2><p>${text}</p>${action}</div>`;
const note = (text, kind = 'info') => `<div class="notice ${kind}">${icon(kind === 'warning' ? 'shield' : 'eye')}<div>${text}</div></div>`;
const heading = (eyebrow, title, text, action = '') => `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1 tabindex="-1">${title}</h1>${text ? `<p class="intro">${text}</p>` : ''}</div>${action}</div>`;
const parcelFor = c => state.parcels.find(p => p.id === c.parcelId);
function mutate(fn) {
    requireConnection();
    return fn();
}
function announce(text) {
    $('#announcer').textContent = '';
    requestAnimationFrame(() => $('#announcer').textContent = text);
}
function toast(text) {
    $('#toast').textContent = text;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').hidden = true, 6500);
    announce(text);
}
function showError(form, error) {
    const el = form?.querySelector('.form-error');
    if (el) {
        el.textContent = error.message;
        el.hidden = false;
        el.id = form.id + '-error';
        const rules = [[/teléfono/i, 'phone'], [/clave/i, 'password'], [/acepta/i, 'localConsent'], [/cultivo/i, 'crop'], [/nombre de la parcela/i, 'parcelName'], [/selecciona una parcela/i, 'parcelId'], [/órgano/i, 'organ'], [/descripción de lo observado/i, 'symptoms'], [/fecha.*observación/i, 'observationDate']];
        let firstInvalid;
        for (const [pattern, name] of rules) {
            const control = form.elements.namedItem(name);
            if (pattern.test(error.message) && control && (!['organ', 'symptoms'].includes(name) || !control.value.trim())) {
                control.setAttribute('aria-invalid', 'true');
                control.setAttribute('aria-describedby', [document.getElementById(name + '-help')?.id, el.id].filter(Boolean).join(' '));
                firstInvalid ??= control;
            }
        }
        (firstInvalid || el).focus();
    }
    else
        toast(error.message);
}
function go(route) {
    if (location.hash === '#' + route) {
        render();
    }
    else
        location.hash = route;
}
function safeCase() {
    const c = D.getCase(state, currentId);
    if (!c) {
        throw Error('Este caso no está disponible para el perfil. Vuelve a tu bandeja.');
    }
    return c;
}
const photos=new Map();
async function photoStore(id,data){requireConnection();photos.set(id,data);}
async function photoRead(id){return photos.get(id)||'';}
async function encodePhoto(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw Error('Elige una fotografía JPG, PNG o WebP.');
    }
    if (file.size > 12 * 1024 * 1024) {
        throw Error('La imagen supera 12 MB. Usa un archivo más pequeño.');
    }
    const photo = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(Error('No se pudo leer la fotografía.'));
        reader.readAsDataURL(file);
    });
    const preview = new Image();
    preview.src = photo;
    try {
        await preview.decode();
        return photo;
    } catch {
        throw Error('El archivo no contiene una imagen válida. Cambia la fotografía.');
    }
}
async function hydratePhotos() {
    for (const el of document.querySelectorAll('[data-photo]')) {
        try {
            const src = await photoRead(el.dataset.photo);
            if (src) {
                el.src = src;
            }
            else {
                el.alt = 'Fotografía no disponible en tu cuaderno. Añade nueva evidencia.';
                el.classList.add('missing-photo');
            }
        }
        catch (e) {
            el.alt = e.message;
        }
    }
}
function photoTag(id, alt = 'Fotografía de la observación', className = 'case-photo') {
    return `<img class="${className}" data-photo="${esc(id)}" alt="${alt}">`;
}
function logo() {
    return `<a class="logo" href="#${state.session ? 'home' : 'landing'}"><img src="iconos/hoja.svg" width="40" height="40" alt=""><span>Agro<span class="logo-light">Alerta</span></span></a>`;
}
function landing() {
    return `<header class="landing-header">${logo()}<nav aria-label="Principal"><a href="#como-funciona">Cómo funciona</a><a href="#para-quien">Para quién</a>${link(state.session ? 'home' : 'access', state.session ? 'Ir a mi espacio' : 'Entrar', 'button primary')}</nav></header>
<main id="main" class="landing-main">
    <section class="landing-hero">
    <div class="hero-copy"><p class="eyebrow">CUADERNO DE CAMPO</p><h1 tabindex="-1">Cuidar lo que<br>cultivas empieza<br>por <em>observar.</em></h1><p class="hero-sub">Registra tus parcelas, fotografía los cambios en el cultivo y consulta la evolución de cada caso.</p>
    <div class="actions">${link('access', `Comenzar observación ${icon('arrow')}`)}<a class="text-link" href="#como-funciona">Conoce el recorrido</a></div><p class="subtle">${icon('shield')} Tú decides qué información compartir.</p></div>
<div class="hero-visual"><img class="hero-field" src="imagenes/hero-agricola.jpg" alt="Cultivo de hortalizas de hoja en campo abierto"></div>
    </section>

<section class="landing-section" id="como-funciona"><div class="section-title"><p class="eyebrow">CÓMO FUNCIONA</p><h2>De una fotografía al seguimiento.</h2><p>Conserva lo que observas y entiende lo que aún falta saber.</p></div><div class="steps-cards">${[['01', 'camera', 'Documenta la señal', 'Revisa el enfoque, la luz y el órgano antes de guardar tu fotografía.'], ['02', 'eye', 'Comprende los límites', 'Distingue una observación de una conclusión y prepara tu consulta.'], ['03', 'calendar', 'Sigue la evolución', 'Añade observaciones con fecha y consulta tu agenda de revisión.']].map(([n, i, t, d]) => `<article class="step-card"><div><span class="step-number">${n}</span>${icon(i)}</div><h3>${t}</h3><p>${d}</p>
    </article>`).join('')}</div>
    </section>
<section class="audience landing-section" id="para-quien"><img src="imagenes/cultivo-ejemplo.jpg" alt="Detalle de hortalizas de hoja en cultivo" loading="lazy"><div><p class="eyebrow">QUIÉNES LO USAN</p><h2>Un mismo campo.<br>Tres formas de acompañarlo.</h2><p><strong>Productores:</strong> documentan y siguen sus casos.</p><p><strong>Cooperativas:</strong> organizan la atención por zona y prioridad.</p><p><strong>Especialistas:</strong> revisan la evidencia y registran el seguimiento.</p>${link('access', 'Elegir mi perfil', 'button secondary')}</div>
    </section>
<footer class="landing-footer">${logo()}<p><a href="creditos.html" target="_blank" rel="noopener">Créditos de las fotografías</a> · <a href="#privacy">Privacidad y alcance</a></p></footer></main>`;
}
const profiles = new Map();
async function profileKey(role, phone, password) {
    const bytes=new TextEncoder().encode(role+'|'+phone+'|'+password);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function access() {
    return `<main id="main" class="access-layout">
    <aside class="access-story">${logo()}<img src="imagenes/cultivo-ejemplo.jpg" alt="Cultivo de hojas verdes"><div><p class="eyebrow">AGROALERTA</p><h2>Cada observación<br>cuenta.</h2></div>
    </aside><section class="access-panel">${link('landing', '← Volver al inicio', 'text-link')}${heading('MI CUADERNO', 'Tu espacio en AgroAlerta', 'Selecciona el perfil con el que vas a trabajar.')}
<form id="access-form" novalidate>${errorBox()}<fieldset class="role-options"><legend>¿Cómo participas?</legend>${[['productor', 'Productor', 'Registro mis parcelas y observaciones.'], ['cooperativa', 'Cooperativa', 'Coordino la atención por zona y cultivo.'], ['especialista', 'Especialista', 'Reviso consultas y registro observaciones.']].map(([v, t, d]) => `<label class="role-option"><input type="radio" name="role" value="${v}" ${(state.session?.role || 'productor') === v ? 'checked' : ''}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}</fieldset>
<details class="register-details" ${profiles.size?'open':''}><summary>Acceso con perfil personal</summary>
    ${field('displayName','Nombre para mostrar','text','','Para crear un perfil.','maxlength="60" autocomplete="off"')}
    ${field('phone','Teléfono','tel','','Celular de 9 dígitos.','maxlength="16" inputmode="tel" autocomplete="off"')}
    ${field('password','Clave','password','','Al menos 8 caracteres.','maxlength="80" autocomplete="off"')}
    ${check('localConsent','Acepto usar los datos de mi perfil en este cuaderno.')}
    <div class="actions"><button class="button secondary" type="submit" name="mode" value="register">Crear perfil</button>
    <button class="button secondary" type="submit" name="mode" value="enter">Abrir mi perfil</button></div></details>
<button class="button primary wide" name="mode" value="profile" type="submit">Entrar al cuaderno ${icon('arrow')}</button>
    </form></section></main>`;
}
function authorizedZone(c) {
    const request = state.requests.find(r => r.caseId === c.id && r.consent.image && !r.revoked);
    return request?.consent.zone ? parcelFor(c).zone : 'Por coordinar · zona no autorizada';
}
function comparison(c) {
    const paired = c.observations.filter(o => o.photoId).sort((a, b) => a.date.localeCompare(b.date));
    const last = paired.at(-1);
    if (!last) {
        return '<p class="help comparison-hint">Añade una segunda fotografía para compararla con la inicial.</p>';
    }
    return `<section class="comparison"><h3>Comparación fotográfica</h3><div class="photo-pair">
    <figure>${photoTag(c.photoId, 'Fotografía inicial de la comparación', 'pair-photo')}<figcaption>Inicial · ${date(c.date)}</figcaption></figure>
    <figure>${photoTag(last.photoId, 'Fotografía más reciente de la comparación', 'pair-photo')}<figcaption>Seguimiento · ${date(last.date)}</figcaption></figure>
    </div><p class="help">Las diferencias de luz, distancia y ángulo pueden cambiar lo que se aprecia.</p>
    </section>`;
}
function reviewHistory(c) {
    const revisions = c.reviewHistory || (c.review ? [c.review] : []);
    const guidance = c.orientationHistory || (c.orientation ? [c.orientation] : []);
    const entries = [
        ...revisions.map(r => ({ at: r.at, title: r.outcome, text: r.reason, author: r.author })),
        ...guidance.map(o => ({ at: o.at, title: 'Orientación', text: o.text, author: o.author }))
    ].sort((a, b) => b.at.localeCompare(a.at));
    return entries.length ? `<details class="review-history" open><summary>Historial de revisión (${entries.length})</summary>
    <ol>${entries.map(entry => `<li><strong>${esc(entry.title)}</strong><p>${esc(entry.text)}</p><small>${esc(entry.author)} · ${date(entry.at)}</small></li>`).join('')}</ol></details>` : '<p class="help">Aquí quedarán la fecha, la decisión y el motivo de cada revisión.</p>';
}
function risk() {
    const reports = state.reports.filter(r => r.public && r.expires >= D.today() && r.status !== 'Descartado');
    const zones = [...new Set(reports.map(r => r.zone))].sort();
    const zone = decodeURIComponent(currentId);
    const visible = reports.filter(r => !zone || r.zone === zone);
    return `${heading('CONTEXTO TERRITORIAL', 'Riesgo local', 'Consulta las señales compartidas en tu cuaderno por zona aproximada.')}
    <div class="two-column">
    <section class="panel"><h2>Reportes vigentes</h2>
    ${select('riskZone', 'Filtrar por zona', zones, zone).replace('>Seleccionar<', '>Todas las zonas<')}
    <p class="help" role="status">${visible.length} reportes · ${esc(zone || 'Todas las zonas')}</p>
    ${visible.length ? visible.map(r => `<article class="territory-row"><div>${badge(r.status, 'amber')}<h3>${esc(r.crop)} · ${esc(r.zone)}</h3><p>Fuente: ${esc(r.source)}. Vigente hasta ${date(r.expires)}.</p></div>
    </article>`).join('') : empty('Sin reportes vigentes', 'La ausencia de reportes no indica ausencia de plagas.')}
    </section>
    <aside class="panel"><h2>Riesgo sin calcular</h2><p>Consulta los reportes vigentes de tu zona para decidir qué parcelas revisar.</p>${link('protocol', 'Consultar guía de observación', 'button secondary')}</aside></div>`;
}
function coordination() {
    if (!state.coopLinked) {
        return coop();
    }
    return `${heading('COOPERATIVA', 'Coordinación', 'Comprueba el origen y la vigencia de una guía antes de compartirla.')}
    <div class="two-column">
    <section class="panel"><h2>Compartir protocolo común</h2>
    <form id="share-protocol-form" novalidate>${errorBox()}${select('protocolVersion', 'Cultivo y versión', D.PROTOCOLS.map(p => [p.id, p.crop + ' · ' + p.version + ' · ' + p.status]), 'OBS-1')}
    <button class="button primary" type="submit">Comprobar y distribuir</button>
    </form></section>
    <aside class="panel"><h2>Versiones disponibles</h2>${D.PROTOCOLS.map(p => `<div class="territory-row">${badge(p.status, 'amber')}<h3>${esc(p.version)} · ${esc(p.crop)}</h3><p>${esc(p.author)}. ${esc(p.source)}.</p></div>`).join('')}
    <p class="help">La distribución requiere validación agronómica. Ninguna de estas versiones está autorizada como tratamiento.</p>
    ${link('coop', 'Volver al tablero', 'text-link')}</aside></div>`;
}
function reports() {
    const allowed = state.cases.filter(c => D.getCase(state, c.id));
    if (!allowed.length) {
        return `${heading('ESPECIALISTA', 'Informes', 'Consulta las fichas autorizadas en esta sesión.')}${empty('Sin casos autorizados', 'La ficha estará disponible cuando el productor comparta una consulta.')}`;
    }
    const selected = currentId ? allowed.find(c => c.id === currentId) : allowed[0];
    if (!selected) {
        throw Error('La ficha seleccionada ya no está autorizada.');
    }
    const p = parcelFor(selected);
    return `${heading('ESPECIALISTA', 'Informes', 'Consulta el historial de revisión de un caso.')}
    <section class="panel narrow"><h2>Ficha de revisión</h2>${select('reportCase', 'Caso autorizado', allowed.map(c => [c.id, c.id + ' · ' + parcelFor(c).crop]), selected.id)}
    <article id="ficha-informe">${badge(selected.status)}<h3>${esc(selected.id)} · ${esc(p.crop)}</h3>
    <dl class="context-list"><div><dt>Observación</dt><dd>${date(selected.date)}</dd></div><div><dt>Zona compartida</dt><dd>${esc(authorizedZone(selected))}</dd></div><div><dt>Órgano</dt><dd>${esc(selected.organ)}</dd></div></dl>
    <p>${esc(selected.symptoms)}</p>${reviewHistory(selected)}
    </article>
    ${link('reviewcase/' + selected.id, 'Abrir revisión profesional', 'button secondary')}</section>`;
}
const navigation = [['home', 'home', 'Mi espacio'], ['parcels', 'plot', 'Mis parcelas'], ['advice', 'chat', 'Consultas'], ['risk', 'eye', 'Riesgo local'], ['community', 'bell', 'Comunidad'], ['protocol', 'book', 'Guía de observación'], ['coop', 'people', 'Cooperativa'], ['coordination', 'people', 'Coordinación'], ['inspections', 'calendar', 'Inspecciones'], ['reports', 'book', 'Informes'], ['review', 'eye', 'Revisión de casos'], ['queue', 'sync', 'Estado de envíos'], ['privacy', 'shield', 'Privacidad y ayuda']];
function shell(content, route) {
    const role = state.session?.role;
    const visible = navigation.filter(([r]) => !(role !== 'productor' && ['parcels', 'advice', 'queue'].includes(r)) && !(role !== 'cooperativa' && ['coop', 'coordination'].includes(r)) && !(role !== 'especialista' && ['inspections', 'review', 'reports'].includes(r)));
    return `<div class="app-shell">
    <aside class="sidebar">${logo()}<p class="sidebar-label">ESPACIO DE TRABAJO</p><nav aria-label="Módulos">${visible.map(([r, i, t]) => `<a href="#${r}" class="nav-link ${route === r ? 'active' : ''}" ${route === r ? 'aria-current="page"' : ''}>${icon(i)}<span>${t}</span></a>`).join('')}</nav><div class="sidebar-profile"><span class="avatar">${role === 'productor' ? 'P' : role === 'cooperativa' ? 'C' : 'E'}</span><div><strong>${esc(state.session?.name||D.ROLES[role]||'Visitante')}</strong><a href="#access">Cambiar perfil</a></div></div>
    </aside>
<div class="workspace"><header class="workspace-header"><span class="workspace-label">Cuaderno de campo</span><span class="connection" id="connection">${navigator.onLine ? '● Con conexión' : '○ Sin conexión'}</span><a href="#privacy" class="help-link">Ayuda ${icon('shield')}</a></header><div class="mobile-brand">${logo()}<a href="#access">${D.ROLES[role]} · Cambiar</a></div><nav class="mobile-nav" aria-label="Módulos móvil">${visible.map(([r, i, t]) => `<a class="${route === r ? 'active' : ''}" href="#${r}" ${route === r ? 'aria-current="page"' : ''}>${icon(i)}${t}</a>`).join('')}</nav><main id="main" class="page-content">${content}</main><footer class="app-footer">AgroAlerta · Cuaderno de campo <span></span></footer></div></div>`;
}
function caseCard(c) {
    const p = parcelFor(c);
    return `<article class="case-card">${photoTag(c.photoId)}<div class="case-card-body">
    <div class="card-meta">${badge(c.status, 'amber')}<span>${date(c.date)}</span></div><h3><a href="#case/${c.id}">${esc(p?.name || 'Parcela')} · ${esc(p?.crop)}</a></h3><p>${esc(c.symptoms)}</p><div class="case-bottom"><span>${esc(c.id)} · Responsable: tú</span><a href="#result/${c.id}" class="text-link">Ver resultado ${icon('arrow')}</a></div></div>
    </article>`;
}
function home() {
    const r = state.session.role;
    if (r === 'cooperativa') {
        return coop();
    }
    if (r === 'especialista') {
        return reviewList();
    }
    return `${heading('PRODUCTOR', 'Mi cuaderno de campo', 'Organiza tus parcelas, documenta señales y acompaña cada caso.', link('capture', `${icon('plus')} Nuevo caso`))}
<div class="dashboard-top">
    <section class="dashboard-hero"><img src="imagenes/hero-agricola.jpg" alt="Hortalizas cultivadas al aire libre"><div><p class="eyebrow">UNA MIRADA A TIEMPO</p><h2>Conoce lo que pasa<br>en tu parcela.</h2><p>Una buena fotografía y un poco de contexto<br>son el primer paso.</p>${link('capture', `${icon('camera')} Registrar observación`, 'button light')}</div>
    </section><aside class="agenda-card"><p class="eyebrow">TU PRÓXIMA MIRADA</p><h2>Agenda de revisión</h2>${state.reminders.some(r => r.date >= D.today()) ? state.reminders.filter(r => r.date >= D.today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3).map(r => `<a class="agenda-item" href="#case/${r.caseId}"><span class="date-block">${date(r.date)}</span><span>${esc(state.parcels.find(p => p.id === r.parcelId)?.name)}<small>Agenda de revisión</small></span>${icon('arrow')}</a>`).join('') : `<div class="agenda-empty">${icon('calendar')}<p>Aún no tienes revisiones.<br>Programa una desde tu caso.</p></div>`}</aside></div>
<div class="metrics"><div>${icon('plot')}<span><strong>${state.parcels.length}</strong> parcelas registradas</span></div><div>${icon('camera')}<span><strong>${state.cases.length}</strong> observaciones</span></div><div>${icon('chat')}<span><strong>${state.requests.filter(r => !r.revoked).length}</strong> consultas</span></div></div>
<div class="section-row"><h2>Observaciones recientes</h2>${link('parcels', 'Ver mis parcelas', 'text-link')}</div>${state.cases.length ? `<div class="case-grid">${state.cases.slice(-4).reverse().map(caseCard).join('')}</div>` : empty('Tu primera observación empieza aquí', 'Primero registra una parcela. Después podrás asociar una fotografía y seguir su evolución.', link('parcels', 'Registrar mi parcela', 'button secondary'))}
<div class="care-note">${icon('shield')}<div><strong>Permisos de las consultas</strong><p>Puedes autorizar la fotografía y la zona por separado.</p></div><a href="#privacy">Revisar privacidad →</a></div>`;
}
function parcels() {
    const page = document.getElementById('plantilla-parcelas').content.cloneNode(true);
    for (const input of page.querySelectorAll('input[name]')) {
        input.setAttribute('value', parcelDraft[input.name] || '');
    }
    const list = page.querySelector('.lista-parcelas');
    list.innerHTML = state.parcels.length ? state.parcels.map(p => {
        const cases = state.cases.filter(c => c.parcelId === p.id);
        const latest = cases.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
        const picture = latest ? photoTag(latest.photoId, 'Última observación de esta parcela', 'parcel-photo') :
            '<img class="parcel-photo" src="imagenes/cultivo-ejemplo.jpg" alt="Hortalizas en surcos, imagen ilustrativa">';
        return `<article class="tarjeta-parcela">
      <figure class="imagen imagen-tarjeta">${picture}<figcaption>${latest ? 'Última observación' : 'Foto ilustrativa'}</figcaption></figure>
      <div class="tarjeta-contenido"><header><h3 id="titulo-${esc(p.id)}" tabindex="-1">${esc(p.name)} <span class="crop-label">· ${esc(p.crop)}</span></h3></header>
      <p>${esc(p.zone)}</p><p class="help">${cases.length} ${cases.length === 1 ? 'observación' : 'observaciones'}</p>
      <div class="actions">${link('capture/' + p.id, 'Nuevo caso', 'button primary')}${link('history/' + p.id, 'Ver historial', 'text-link')}</div></div>
    </article>`;
    }).join('') : `<div class="estado-vacio"><div class="estado-vacio-icono" aria-hidden="true">${icon('plot')}</div><div class="estado-vacio-texto"><h3>Aún no tienes parcelas registradas</h3><p>Al guardar la primera, podrás añadirle una observación y consultar su historial aquí.</p></div></div>`;
    return page.firstElementChild.outerHTML;
}
function history(id) {
    const p = state.parcels.find(p => p.id === id);
    if (!p) {
        return empty('Parcela no disponible', 'Vuelve a tus parcelas.', link('parcels', 'Mis parcelas'));
    }
    const cases = state.cases.filter(c => c.parcelId === id).sort((a, b) => b.date.localeCompare(a.date));
    return `${heading('HISTORIAL POR PARCELA', esc(p.name), esc(p.crop) + ' · ' + esc(p.zone), link('capture/' + id, 'Nuevo caso'))}${cases.length ? `<div class="case-grid">${cases.map(caseCard).join('')}</div>` : empty('Esta parcela aún no tiene casos', 'El historial estará disponible cuando registres tu primera observación.', link('capture/' + id, 'Registrar observación'))}`;
}
let openedCaptureRoute = '';
function capture() {
    if (!state.parcels.length) {
        return `${heading('NUEVO CASO', 'Primero, ubica tu cultivo.', 'La observación debe quedar asociada a una parcela.')}${empty('Registra una parcela para continuar', 'Basta con su nombre y cultivo. No necesitas compartir una ubicación exacta.', link('parcels', 'Registrar parcela'))}`;
    }
    if (openedCaptureRoute !== location.hash && currentId && state.parcels.some(p => p.id === currentId) && state.draft?.parcelId !== currentId) {
        mutate(() => {
            state.parcelDrafts ??= {};
            if (state.draft) {
                state.parcelDrafts[state.draft.parcelId] = state.draft;
            }
            state.draft = state.parcelDrafts[currentId] || null;
            delete state.parcelDrafts[currentId];
        });
        stagedPhoto = null;
        captureStep = 1;
    }
    openedCaptureRoute = location.hash;
    const draft = state.draft || { parcelId: currentId || state.parcels[0].id, date: D.today(), organ: '', symptoms: '', photoId: '', quality: '', urgency: 'normal' };
    if (!state.draft) {
        state.draft = draft;
    }
    return `${heading('DOCUMENTAR UNA SEÑAL', 'Nuevo caso', 'Fotografía la señal y registra lo que observaste.')}
<ol class="stepper" aria-label="Pasos de registro"><li class="${captureStep === 1 ? 'current' : 'done'}"><span>1</span> Fotografía</li><li class="${captureStep === 2 ? 'current' : ''}"><span>2</span> Contexto</li><li><span>3</span> Resultado preliminar</li></ol>
<div class="capture-layout">
    <section class="panel capture-panel">
    <form id="capture-form" novalidate>${errorBox()}<div ${captureStep === 1 ? '' : 'hidden'} id="photo-step">
    <div class="section-row"><div><p class="eyebrow">PASO 1 DE 3</p><h2>Una foto con contexto.</h2></div>${icon('camera')}</div><p>Acércate a la señal y evita sombras. Incluye el órgano afectado y conserva una foto del conjunto.</p><div class="upload-area" id="drop-zone" ${stagedPhoto?"hidden":""}>${draft.photoId ? photoTag(draft.photoId, 'Fotografía actual; se conserva hasta confirmar el cambio', 'capture-photo') : `<div class="upload-empty">${icon('camera')}<h3>¿Qué estás observando?</h3><p>Toma una foto o elige una de tu galería.</p></div>`}<div class="upload-actions"><label class="button primary" for="camera-file">${icon('camera')} Tomar foto</label><input class="sr-only" id="camera-file" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"><label class="button secondary" for="gallery-file">${icon('plus')} ${draft.photoId ? 'Cambiar fotografía' : 'Elegir de galería'}</label><input class="sr-only" id="gallery-file" type="file" accept="image/jpeg,image/png,image/webp"></div><p class="help">JPG, PNG o WebP · Hasta 12 MB. Si la cámara no está disponible, usa la galería.</p></div>
${stagedPhoto ? `<section class="staged-photo"><h3>Revisa la nueva fotografía</h3><img src="${stagedPhoto}" alt="Nueva fotografía pendiente de confirmar">
    <div class="actions">${button('confirm-photo', 'Usar esta fotografía')}${button('cancel-photo', draft.photoId?'Conservar la anterior':'Elegir otra fotografía', 'button secondary')}</div>
    </section>` : ''}
${draft.photoId ? `<div class="actions">${button('zoom-draft', 'Ampliar imagen', 'button secondary')}<span class="saved-label">${icon('check')} Imagen confirmada</span></div>
    <fieldset class="quality-options"><legend>¿Cómo ves tu fotografía?</legend>${[['clara', 'Puedo distinguir el detalle'], ['insuficiente', 'Está borrosa o tengo dudas']].map(([v, t]) => `<label class="radio"><input type="radio" name="quality" value="${v}" ${draft.quality === v ? 'checked' : ''}>${t}</label>`).join('')}</fieldset>` : ''}
${stagedPhoto?'':button('photo-next', `Añadir contexto ${icon('arrow')}`, 'button primary wide')}</div>
<div ${captureStep === 2 ? '' : 'hidden'} id="context-step"><p class="eyebrow">PASO 2 DE 3</p><h2>Cuéntanos lo que ves.</h2>${select('parcelId', 'Parcela', state.parcels.map(p => [p.id, p.name + ' · ' + p.crop]), draft.parcelId)}<div class="form-grid">${select('organ', 'Órgano observado', ['Hoja', 'Tallo', 'Fruto', 'Raíz', 'Planta completa'], draft.organ)}${field('observationDate', 'Fecha de observación', 'date', draft.date, 'No inferimos la fecha de la fotografía.', `max="${D.today()}"`)}</div>${textarea('symptoms', 'Descripción de la señal', draft.symptoms, 'Describe color, forma, distribución y desde cuándo la observas. Evita asumir una causa.')}${select('urgency', '¿Con qué prioridad pides revisión?', [['normal', 'Normal declarada'], ['alta', 'Alta declarada por mí']], draft.urgency, 'Selecciona la prioridad de tu consulta.')}<div class="actions">${button('photo-back', '← Revisar fotografía', 'button secondary')}<button class="button primary" type="submit">Guardar y ver resultado ${icon('arrow')}</button></div></div>
    </form></section>
    <aside class="capture-guide"><div class="guide-icon">${icon('eye')}</div><p class="eyebrow">MEJOR EVIDENCIA</p><h2>Revisa tu fotografía</h2><ul class="checklist"><li>Luz natural, sin reflejos.</li><li>La señal aparece enfocada.</li><li>Se distingue el órgano observado.</li><li>No aparecen personas ni datos privados.</li></ul><div class="guide-divider"></div>
    </aside></div>`;
}
function result() {
    const c = safeCase(), p = parcelFor(c);
    return `${heading('PASO 3 DE 3 · ' + esc(c.id), 'Resultado preliminar', esc(p.name) + ' · ' + esc(p.crop), link('case/' + c.id, 'Ver seguimiento', 'button secondary'))}
<div class="result-layout"><div class="result-status">${badge('Evaluación inicial', 'amber')}<h2>${c.result === 'inconcluso' ? 'Se necesita otra fotografía' : 'Observación lista para revisión'}</h2><p class="result-lead">${c.result === 'inconcluso' ? 'El detalle marcado como dudoso dificulta la revisión.' : 'La fotografía y los síntomas están listos para la consulta.'}</p><div class="certainty"><span>Causa de la señal</span><strong>Pendiente de identificar</strong></div></div>
<section class="panel evidence-panel">${photoTag(c.photoId, 'Evidencia guardada por el productor', 'result-photo')}${button('zoom-case', 'Ampliar fotografía', 'button secondary wide')}<dl class="context-list"><div><dt>Órgano</dt><dd>${esc(c.organ)}</dd></div><div><dt>Fecha</dt><dd>${date(c.date)}</dd></div><div><dt>Calidad declarada</dt><dd>${c.quality === 'clara' ? 'Detalle visible según el usuario' : 'Insuficiente o dudosa'}</dd></div></dl><h3>Lo que registraste</h3><p>${esc(c.symptoms)}</p>
    </section>
<section class="result-content">
<div class="panel"><h3>Lo visible y lo que falta saber</h3><div class="evidence-split"><div><span class="mini-label">TU EVIDENCIA</span><p>Fotografía, ${esc(c.organ.toLowerCase())}, fecha y descripción.</p></div><div><span class="mini-label">LÍMITE</span><p>No confirma causa, salud del cultivo ni eficacia de un tratamiento.</p></div></div><h3>¿Qué podría ayudar?</h3><p>Una fotografía del reverso, otra del conjunto y una descripción de cómo se distribuye la señal en la parcela.</p><details><summary>¿Puede haber otras explicaciones?</summary><p>Distintas causas pueden producir señales parecidas. La fotografía y tu relato no permiten descartar condiciones del entorno, daño físico o agentes biológicos. </p></details></div>
<div class="next-step"><div>${icon('chat')}<h3>Prepara una segunda mirada.</h3><p>Revisa qué evidencia compartirás y qué necesitas preguntar.</p></div>${link('consult/' + c.id, 'Solicitar revisión')}${link('capture/' + p.id, 'Registrar nueva evidencia', 'text-link')}</div>
    </section></div>`;
}
function caseDetail() {
    const c = safeCase(), p = parcelFor(c), r = state.requests.find(r => r.caseId === c.id && !r.revoked);
    return `${heading(esc(c.id) + ' · ' + esc(p.crop), esc(p.name), 'Consulta las observaciones de la parcela en orden de fecha.', link('result/' + c.id, 'Ver resultado', 'button secondary'))}
<div class="two-column">
    <section class="stack">
    <article class="panel timeline"><h2>Seguimiento del caso</h2>${badge(c.status)}${comparison(c)}<div class="timeline-item"><span class="timeline-dot"></span><div><p class="eyebrow">${date(c.date)} · OBSERVACIÓN INICIAL</p><h3>${esc(c.organ)}</h3><p>${esc(c.symptoms)}</p>${photoTag(c.photoId, 'Fotografía original', 'timeline-photo')}</div></div>${c.observations.slice().sort((a, b) => a.date.localeCompare(b.date)).map(o => `<div class="timeline-item"><span class="timeline-dot"></span><div><p class="eyebrow">${date(o.date)} · EVOLUCIÓN</p><p>${esc(o.note)}</p>${o.photoId ? photoTag(o.photoId, 'Nueva evidencia de evolución', 'timeline-photo') : ''}</div></div>`).join('')}<p class="help">Comparar fotografías no demuestra causalidad ni eficacia.</p>
    </article>
<section class="panel"><h2>Respuesta de revisión</h2>${c.orientation ? `${badge('Orientación', 'amber')}<p><strong>${esc(c.orientation.author)}</strong> · ${date(c.orientation.at)}</p><p>${esc(c.orientation.text)}</p><p><strong>Referencia declarada:</strong> ${esc(c.orientation.reference)}</p><p><strong>Condiciones:</strong> ${esc(c.orientation.conditions)}</p><p><strong>Límites:</strong> ${esc(c.orientation.limits)}</p>` : `<p class="empty-line"><strong>Sin respuesta.</strong> La orientación aparecerá aquí cuando se registre.</p>`}${c.review ? `<p>Revisión: <strong>${esc(c.review.outcome)}</strong> · ${esc(c.review.reason)}</p>` : ''}${r ? `<p>Consulta ${esc(r.id)} · ${esc(r.status)}</p><div class="thread">${r.messages.map(m => `<p><strong>Productor · ${date(m.at)}:</strong> ${esc(m.text)}</p>`).join('')}</div>
    <form id="clarify-form" novalidate>${errorBox()}${textarea('clarification', 'Pedir aclaración en este hilo', '', 'Añade tu pregunta al hilo de esta consulta.')}<button class="button secondary" type="submit">Guardar aclaración</button>
    </form>` : link('consult/' + c.id, 'Preparar consulta', 'button secondary')}</section>
    </section>
<aside class="stack">
    <section class="panel"><h2>Añadir evolución</h2>
    <form id="evolution-form" novalidate>${errorBox()}${field('followDate', 'Fecha', 'date', D.today(), '', `min="${c.date}" max="${D.today()}"`)}${textarea('followNote', 'Nueva observación', '', 'Describe cambios sin asumir que un tratamiento los causó.')}<div class="field"><label for="followPhoto">Fotografía adicional (opcional)</label><input id="followPhoto" type="file" name="followPhoto" accept="image/jpeg,image/png,image/webp"></div><button class="button primary wide" type="submit">Guardar evolución</button>
    </form></section>
<section class="panel"><h2>Programar revisión</h2>
    <form id="reminder-form" novalidate>${errorBox()}${field('reminderDate', 'Día de revisión', 'date', D.today(), '', `min="${D.today()}"`)}${select('channel', 'Canal', [['agenda', 'Agenda de revisión'], ['notification', 'Solicitar notificación del navegador']], 'agenda')}<p class="help">La fecha se mostrará en tu agenda de revisión.</p><button class="button secondary wide" type="submit">Guardar recordatorio</button>
    </form>${state.reminders.filter(r => r.caseId === c.id).map(r => `<p class="saved-label">${icon('calendar')} ${date(r.date)} · Agenda de revisión</p>`).join('')}</section><section class="panel"><h2>Estado del caso</h2><form id="close-case-form" novalidate>${errorBox()}
    ${select('caseStatus','Nuevo estado',['Resuelto','Continúa en seguimiento','Requiere visita'],c.status)}
    ${textarea('closeReason','Motivo del cambio')}<button class="button secondary" type="submit">Actualizar estado</button></form>
    ${(c.decisions||[]).map(entry=>`<p><strong>${esc(entry.status)}</strong> · ${date(entry.date)}<br>${esc(entry.reason)}</p>`).join('')}</section>
    ${link('report/' + c.id, 'Preparar reporte de foco', 'button secondary wide')}</aside></div>`;
}
function consult() {
    const c = safeCase(), p = parcelFor(c);
    return `${heading('SEGUNDA MIRADA', 'Prepara tu consulta.', 'Revisa la evidencia antes de autorizar el intercambio.')}<div class="two-column">
    <section class="panel"><h2>Qué se compartirá</h2>${photoTag(c.photoId, 'Fotografía seleccionada para consulta', 'consult-photo')}<dl class="context-list"><div><dt>Caso</dt><dd>${esc(c.id)}</dd></div><div><dt>Cultivo</dt><dd>${esc(p.crop)}</dd></div><div><dt>Descripción</dt><dd>${esc(c.symptoms)}</dd></div><div><dt>Destinatario</dt><dd>Bandeja del especialista</dd></div></dl><p class="help">No compartimos nombre del productor, teléfono ni coordenadas. La zona solo se incluye con tu permiso.</p>
    </section><section class="panel">
    <form id="consult-form" novalidate>${errorBox()}${textarea('question', '¿Qué necesitas consultar?', '', 'Por ejemplo: ¿qué otra fotografía ayudaría a revisar esta señal?')}<fieldset><legend>Permisos para esta consulta</legend>${check('shareImage', 'Autorizo compartir la imagen y el contexto del caso.')}${check('shareZone', 'También autorizo compartir la zona aproximada: ' + esc(p.zone) + '.')}</fieldset><button class="button primary wide" type="submit">Solicitar revisión</button>${link('case/' + c.id, 'Conservar mi caso privado', 'text-link')}</form>
    </section></div>`;
}
function advice() {
    return `${heading('ACOMPAÑAMIENTO', 'Mis consultas', 'Consulta el estado y el hilo de cada solicitud.')}${state.requests.length ? `<div class="stack">${state.requests.map(r => `<article class="panel request-row"><div>${badge(r.status, r.revoked ? '' : 'amber')}<h2>${esc(r.id)}</h2><p>${esc(r.question)}</p><p class="help">${esc(r.caseId)} · Destinatario: especialista · ${date(r.created)}</p></div>
    <div class="stack">${link('case/' + r.caseId, 'Abrir hilo', 'button secondary')}${link('queue', 'Ver estado de envíos', 'text-link')}</div>
    </article>`).join('')}</div>` : empty('Aún no hay consultas', 'Desde el resultado de un caso puedes preparar una revisión con consentimiento.', link('parcels', 'Ir a mis parcelas'))}`;
}
function protocol() {
    const p = D.PROTOCOLS[0];
    return `${heading('GUÍA DE OBSERVACIÓN', 'Antes de actuar, documenta.', 'Una secuencia para registrar mejor. No es un protocolo de tratamiento validado.')}<div class="two-column">
    <section class="panel">
    <div class="section-row"><h2>Registro de señales en hortalizas</h2>${badge(p.status, 'amber')}</div><dl class="context-list"><div><dt>Autor</dt><dd>${p.author}</dd></div><div><dt>Versión</dt><dd>${p.version}</dd></div><div><dt>Cultivo / condición</dt><dd>Hortalizas · documentación de una señal</dd></div><div><dt>Fuente y alcance</dt><dd>${p.source}. <a href="${p.url}" target="_blank" rel="noopener">Leer referencia institucional</a></dd></div></dl>${note('<strong>No aplicable como tratamiento.</strong> Falta validación agronómica. Si necesitas decidir un manejo, busca asesoría profesional.', 'warning')}
<ol class="protocol-steps"><li><h3>Observa el conjunto.</h3><p>Describe en qué plantas y órganos aparece la señal.</p><p class="precaution">Precaución: evita exponerte a áreas con aplicaciones recientes; respeta las indicaciones de seguridad del predio.</p></li><li><h3>Conserva una imagen de detalle.</h3><p>Revisa enfoque y luz. Registra otra perspectiva si no distingues la señal.</p><p class="precaution">Precaución: no pruebes frutos ni manipules sustancias para obtener evidencia.</p></li><li><h3>Añade fecha y contexto.</h3><p>Separa lo observado de tus suposiciones. Organiza una nueva observación.</p><p class="precaution">Un producto «orgánico» no garantiza inocuidad. Esta guía no recomienda productos, umbrales ni dosis.</p></li></ol>
    </section><aside class="stack">
    <section class="panel"><h2>Comprender las precauciones</h2>
    <form id="safety-form" novalidate>${errorBox()}${check('understood', 'Comprendo las precauciones de documentación y los límites de esta guía.')}<button class="button secondary wide" type="submit">Reconocer lectura</button>
    </form><details><summary>Necesito una aclaración</summary><p>Leer la guía no confirma que sea seguro aplicar un tratamiento. Si una precaución no está clara, detén esa acción y consulta a un profesional.</p></details>
    </section><section class="panel"><h2>¿Necesitas asesoría?</h2><p>Prepara un caso con evidencia y una pregunta concreta.</p>${link(state.session?.role === 'productor' ? 'parcels' : state.session?.role === 'cooperativa' ? 'coop' : 'review', 'Revisar casos', 'button primary wide')}</section>
    </aside></div>`;
}
function report() {
    const c = safeCase();
    return `${heading('COMUNIDAD CON PRIVACIDAD', 'Reportar una señal.', 'Un posible foco debe verificarse antes de interpretarse como una alerta.')}<section class="panel narrow">
    <form id="report-form" novalidate>${errorBox()}<p><strong>Evidencia:</strong> ${esc(c.id)} · ${esc(parcelFor(c).crop)}. La fotografía y descripción permanecen asociadas al caso.</p>${field('reportZone', 'Zona aproximada', 'text', '', 'Solo distrito o sector. No escribas dirección ni coordenadas.', 'maxlength="100"')}${field('expires', 'Vigencia del reporte', 'date', D.today())}${check('diffusion', 'Autorizo mostrar zona aproximada, cultivo y reporte en la comunidad.')}${note('Sin autorización, el reporte queda <strong>privado</strong>. Se ocultan identidad, teléfono y coordenadas exactas.')}<button class="button primary" type="submit">Registrar reporte</button>
    </form></section>`;
}
function community() {
    const publicReports = state.reports.filter(r => r.public), privateReports = state.session?.role === 'productor' ? state.reports.filter(r => !r.public) : [];
    return `${heading('UNA MIRADA COMPARTIDA', 'Comunidad', 'Consulta reportes por cultivo y zona.')}${note('Comprueba la fecha de vigencia y el estado de revisión de cada reporte.')}${publicReports.length ? `<div class="case-grid">${publicReports.map(r => `<article class="panel alert-card">${badge(r.expires < D.today() ? 'Vencido · historial' : r.status, 'amber')}<h2>${esc(r.crop)} · ${esc(r.zone)}</h2><p><strong>Origen:</strong> ${esc(r.source)}</p><p><strong>Ámbito:</strong> zona aproximada</p><p><strong>Observación:</strong> ${date(r.created)} · <strong>Vigencia:</strong> ${date(r.expires)}</p><p>${esc(r.reason) || 'Pendiente de verificación.'}</p>${state.session.role === 'especialista' ? link('verify/' + r.id, 'Revisar reporte', 'button secondary') : ''}</article>`).join('')}</div>` : empty('Sin avisos activos', 'Los reportes que se autoricen aparecerán con su vigencia y estado de verificación.')}${privateReports.length ? `<section class="panel"><h2>Tus reportes privados</h2>${privateReports.map(r => `<p>${esc(r.id)} · ${esc(r.crop)} · ${badge('Privado')}</p>`).join('')}</section>` : ''}`;
}
function coop() {
    if (!state.coopLinked) {
        return `${heading('COOPERATIVA','Coordinación de campo','')}<section class="panel narrow"><h2>Tablero de hortalizas</h2><p>Consulta la atención por cultivo, zona y fecha.</p>${button('join-coop','Abrir tablero')}</section>`;
    }
    const rows = D.filterCoop(state, filters);
    return `${heading('COORDINACIÓN CON CONTEXTO', 'Tablero cooperativo', 'Organiza las solicitudes por fecha, cultivo y prioridad.')}<div class="metrics"><div><strong>3</strong><span>casos de referencia</span></div><div><strong>1</strong><span>revisión requerida</span></div><div><strong>1</strong><span>completar evidencia</span></div></div><details class="panel"><summary>Resumen por fecha y estado</summary><ul>${D.COOP_EXAMPLES.map(c => c.date).filter((day, i, days) => days.indexOf(day) === i).sort().reverse().map(day => `<li><strong>${date(day)}</strong> · ${Object.entries(D.COOP_EXAMPLES.filter(c => c.date === day).reduce((counts, c) => {
        counts[c.status] = (counts[c.status] || 0) + 1;
        return counts;
    }, {})).map(([status, n]) => esc(status) + ' (' + n + ')').join(', ')}</li>`).join('')}</ul></details>
    <section class="panel">
    <form id="filters-form" class="filter-form">
    <div class="form-grid">${select('filterCrop', 'Cultivo', ['Tomate', 'Lechuga', 'Papa'], filters.crop)}${select('filterZone', 'Zona', ['Sector norte', 'Sector sur'], filters.zone)}${select('filterStatus', 'Estado', ['Revisión requerida', 'Completar evidencia', 'En seguimiento'], filters.status)}</div>
    <div class="actions"><button class="button primary" type="submit">Aplicar filtros</button>${button('clear-filters', 'Limpiar filtros', 'button secondary')}</div>
    </form></section>
    <div class="section-row"><h2>Prioridad de atención</h2><p id="filter-count" role="status">${rows.length} de 3 casos · orden: revisión requerida primero</p></div>${rows.length ? `<div class="stack">${rows.map(c => `<article class="panel coop-case">${icon(c.complete ? 'eye' : 'camera')}<div><p class="eyebrow">${c.id} · ${date(c.date)}</p><h3>${c.crop} · ${c.zone}</h3><p>${c.reason}</p></div><div>${badge(c.status, c.complete ? '' : 'amber')}<p class="help">Urgencia: ${c.urgency}</p></div>
    </article>`).join('')}</div>` : empty('Ningún caso coincide', 'Filtros activos: ' + esc([filters.crop, filters.zone, filters.status].filter(Boolean).join(' / ')) + '. Puedes limpiarlos para volver a ver los tres registros.', button('clear-filters', 'Limpiar filtros', 'button secondary'))}
${link('coordination', 'Abrir coordinación de protocolos', 'button secondary')}`;
}
function reviewList() {
    const available = state.requests.filter(r => r.consent.image && !r.revoked);
    return `${heading('BANDEJA DEL ESPECIALISTA', 'Casos por revisar', 'Consulta los casos que cuentan con permiso para revisión.')}${available.length ? `<div class="stack">${available.map(r => {
        const c = D.getCase(state, r.caseId), p = parcelFor(c);
        return `<article class="panel request-row"><div>${badge(r.status, 'amber')}<h2>${esc(p.crop)} · ${esc(c.organ)}</h2><p>${esc(r.question)}</p><p class="help">${esc(r.caseId)} · Zona: ${r.consent.zone ? esc(p.zone) : 'No autorizada'} · Sin identidad del productor</p></div>${link('reviewcase/' + c.id, 'Revisar evidencia', 'button primary')}</article>`;
    }).join('')}</div>` : empty('Sin casos compartidos', 'Las consultas aparecerán aquí cuando el productor comparta la imagen.')}`;
}
function reviewCase() {
    const c = safeCase();
    return `${heading('ESPECIALISTA', 'Revisión profesional', 'Caso ' + esc(c.id) + '. La revisión se añade al historial y conserva la observación original.')}<div class="two-column">
    <section class="panel">${photoTag(c.photoId, 'Fotografía compartida para revisión', 'result-photo')}<h2>Evidencia y contexto declarados</h2>${badge(c.status)}<dl class="context-list"><div><dt>Cultivo</dt><dd>${esc(parcelFor(c).crop)}</dd></div><div><dt>Zona</dt><dd>${esc(authorizedZone(c))}</dd></div></dl><p>${esc(c.organ)} · ${date(c.date)} · ${esc(c.symptoms)}</p><h3>Identificación de la causa</h3><p>La causa está pendiente de identificar.</p>
    <form id="review-form" novalidate>${errorBox()}${select('reviewOutcome', 'Decisión de revisión', ['Aceptar registro', 'Solicitar corrección', 'Inconcluso'], c.review?.outcome || '')}${textarea('reviewReason', 'Motivo y evidencia adicional necesaria', c.review?.reason || '')}<button class="button primary" type="submit">Guardar revisión</button>
    </form></section>
    <section class="panel"><h2>Orientación sin prescripción</h2>${reviewHistory(c)}<form id="orientation-form" novalidate>${errorBox()}${textarea('orientation', 'Orientación', c.orientation?.text || '', 'Describe la próxima observación o revisión.')}${field('reference', 'Referencia de la orientación', 'text', c.orientation?.reference || '', 'Indica la publicación o guía consultada.', 'maxlength="500"')}${textarea('conditions', 'Condiciones de uso', c.orientation?.conditions || '')}${textarea('limits', 'Límites y necesidad de consulta', c.orientation?.limits || '')}<button class="button secondary" type="submit">Guardar orientación</button>
    </form></section></div>`;
}
function inspections() {
    const available = state.requests.filter(r => r.consent.image && !r.revoked);
    return `${heading('TRABAJO DE CAMPO', 'Inspecciones', 'Agenda por parcela y zona autorizada.')}<div class="two-column">
    <section class="stack">${state.inspections.some(i => D.getCase(state, i.caseId)) ? state.inspections.filter(i => D.getCase(state, i.caseId)).sort((a, b) => authorizedZone(D.getCase(state, a.caseId)).localeCompare(authorizedZone(D.getCase(state, b.caseId))) || a.date.localeCompare(b.date)).map((i, index, items) => {
        const c = D.getCase(state, i.caseId), zone = authorizedZone(c), newGroup = !index || zone !== authorizedZone(D.getCase(state, items[index - 1].caseId));
        return `${newGroup ? `<h2 class="zone-group">${esc(zone)}</h2>` : ''}<article class="panel"><p class="eyebrow">${esc(i.id)} · ${date(i.date)}</p><h2>${esc(i.parcel)}</h2><p>Zona: ${esc(zone)} · Ventana: ${esc(i.window)}</p><p>Inspector: especialista · ${badge(i.status, 'amber')}</p>${c ? `<p><strong>Observación:</strong> ${esc(i.observation) || 'Pendiente'}</p><p><strong>Interpretación del revisor:</strong> ${esc(i.inference) || 'Sin conclusión'}</p>` : '<p>La evidencia del caso ya no está autorizada.</p>'}</article>`;
    }).join('') : empty('Sin inspecciones programadas', 'Elige un caso compartido para registrar una ventana y una observación parcial.')}</section>
    <section class="panel"><h2>Registrar inspección</h2>
    <form id="inspection-form" novalidate>${errorBox()}${select('inspectionCase', 'Caso autorizado', available.map(r => [r.caseId, r.caseId]))}${field('inspectionDate', 'Fecha de inspección', 'date', D.today())}${field('window', 'Ventana acordada (opcional)', 'text', '', 'Sin acuerdo, se registra «Por coordinar».', 'maxlength="100"')}${textarea('inspectionObservation', 'Observación de campo')}${textarea('inspectionInference', 'Interpretación del revisor (opcional)', '', 'Se conserva separada de la observación; no hay inferencia automática.')}${check('partial', 'Guardar como evaluación parcial; falta evidencia.', true)}<button class="button primary wide" type="submit">Guardar inspección</button>
    </form></section></div>`;
}
function verify() {
    const r = state.reports.find(r => r.id === currentId && r.public);
    if (!r) {
        throw Error('El reporte no está disponible.');
    }
    return `${heading('REVISIÓN TERRITORIAL', 'Verificar reporte', 'Revisa el ámbito y la evidencia antes de decidir.')}<section class="panel narrow"><p><strong>Reporte:</strong> ${esc(r.id)} · ${esc(r.zone)} · ${esc(r.crop)}</p><p>Ámbito: zona aproximada. Identidad y coordenadas ocultas.</p>${D.getCase(state, r.caseId) ? photoTag(D.getCase(state, r.caseId).photoId, 'Fotografía autorizada del reporte', 'timeline-photo') : ''}<p>${D.getCase(state, r.caseId) ? 'La evidencia está autorizada para este revisor.' : 'Evidencia no autorizada; solicita permiso antes de verificar.'}</p>
    <form id="verify-form" novalidate>${errorBox()}${select('verification', 'Decisión', ['En verificación', 'Verificado', 'Descartado'], 'En verificación')}${textarea('verificationReason', 'Motivo y evidencia revisada')}${check('sufficient', 'Revisé la evidencia disponible para esta decisión.')}<button class="button primary" type="submit">Guardar verificación</button>
    </form></section>`;
}
function queue() {
    const requests = state.requests.filter(r => !r.revoked);
    return `${heading('CONSULTAS','Estado de envíos','Consulta el estado de cada solicitud.',button('refresh-sent','Actualizar','button secondary'))}
    ${requests.length ? requests.map(r=>`<article class="panel request-row"><div>${badge(r.status)}<h2>${esc(r.id)}</h2>
      <p>${esc(r.question)}</p><p class="help">${date(r.created)} · Caso ${esc(r.caseId)}</p></div>
      ${link('case/'+r.caseId,'Abrir seguimiento','button secondary')}</article>`).join('') :
      empty('Aún no hay solicitudes','Puedes solicitar una revisión desde el resultado de un caso.',link('parcels','Mis parcelas','button secondary'))}`;
}
function privacy() {
    const preferences = state.session?.role==='productor' ? `<section class="panel"><h2>Permisos</h2><form id="privacy-form" novalidate>
    ${errorBox()}${check('privacyImage','Compartir imágenes y contexto en las consultas',state.privacy.image)}
    ${check('privacyZone','Incluir la zona aproximada',state.privacy.zone)}
    ${check('privacyCommunity','Compartir reportes con la comunidad',state.privacy.community)}
    <p class="help">Al retirar un permiso se conserva tu historial y se restringe el acceso al contenido compartido.</p>
    <button class="button primary" type="submit">Guardar preferencias</button></form></section>`:'';
    return `${heading('AGROALERTA','Ayuda y privacidad','')}
    <div class="two-column">${preferences}<section class="panel"><h2>Preguntas frecuentes</h2>
    <details open><summary>¿Cómo agrego una fotografía?</summary><p>En Mis parcelas, abre Nuevo caso. Selecciona la imagen, comprueba el detalle y confirma antes de registrar los síntomas.</p></details>
    <details><summary>¿Cómo solicito una revisión?</summary><p>Desde Resultado preliminar, selecciona Solicitar revisión, escribe tu pregunta y elige qué datos compartir.</p></details>
    <details><summary>¿Dónde encuentro el historial?</summary><p>Selecciona Ver historial en la tarjeta de una parcela. Abre un caso para consultar sus observaciones, decisiones y próximas revisiones.</p></details>
    <p><a href="creditos.html" target="_blank" rel="noopener">Créditos fotográficos</a></p></section></div>`;
}

let renderedHash='';
function render() {
    if(!reachable || !navigator.onLine)return;
    renderedHash=location.hash;
    const parts = location.hash.slice(1).split('/');
    let route = parts[0] || 'landing';
    currentId = parts[1] || '';
    if (route !== 'capture') openedCaptureRoute = '';
    if (['como-funciona', 'para-quien'].includes(route)) {
        if (!$('.landing-main')) {
            $('#app').innerHTML = landing();
        }
        document.getElementById(route)?.scrollIntoView();
        return;
    }
    if (!state.session && !['landing', 'access', 'privacy'].includes(route)) {
        go('access');
        return;
    }
    const producerOnly = ['parcels', 'history', 'capture', 'result', 'case', 'consult', 'advice', 'report', 'queue'];
    const expertOnly = ['review', 'reviewcase', 'inspections', 'verify', 'reports'];
    try {
        if (producerOnly.includes(route) && state.session.role !== 'productor') {
            throw Error('Este recorrido pertenece al perfil productor. Cambia de perfil para continuar.');
        }
        if (expertOnly.includes(route) && state.session.role !== 'especialista') {
            throw Error('Este recorrido requiere el perfil especialista.');
        }
        if (['coordination', 'coop'].includes(route) && state.session?.role !== 'cooperativa') {
            throw Error('Este recorrido requiere el perfil cooperativa.');
        }
        const views = { landing, access, home, parcels, history: () => history(currentId), capture, result, case: caseDetail, consult, advice, risk, coordination, reports, community, protocol, report, coop, review: reviewList, reviewcase: reviewCase, inspections, verify, queue, privacy };
        const content = ((Object.hasOwn(views, route) ? views[route] : null) || (() => empty('Página no disponible', 'Regresa al inicio para continuar.', link('home', 'Mi espacio'))))();
        $('#app').innerHTML = route === 'landing' || route === 'access' ? content : state.session ? shell(content, route) : `<header class="landing-header">${logo()}</header><main id="main" class="page-content">${content}</main>`;
    }
    catch (e) {
        $('#app').innerHTML = shell(empty('Acceso al recorrido restringido', esc(e.message), link('home', 'Volver a mi espacio')), route);
    }
    document.title = (document.querySelector('h1')?.textContent || 'Tu campo') + ' · AgroAlerta';
    for (const form of document.forms) {
        for (const control of form.querySelectorAll('[aria-invalid]'))
            control.removeAttribute('aria-invalid');
    }
    hydratePhotos();
    const title = document.querySelector('h1');
    title?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    announce(document.title);
}
function captureValues() {
    if (!state.draft || !$('#capture-form')) {
        return;
    }
    const f = $('#capture-form');
    state.draft = { ...state.draft, parcelId: f.parcelId.value, organ: f.organ.value, date: f.observationDate.value, symptoms: f.symptoms.value, urgency: f.urgency.value, quality: f.querySelector('[name="quality"]:checked')?.value || state.draft.quality };
}
document.addEventListener('input', e => {
    if(!reachable || !navigator.onLine)return;
    if (e.target.hasAttribute('aria-invalid')) {
        const control = e.target;
        control.removeAttribute('aria-invalid');
        const help = document.getElementById(control.id + '-help');
        if (help) control.setAttribute('aria-describedby', help.id);
        else control.removeAttribute('aria-describedby');
        const message = control.form?.querySelector('.form-error');
        if (message && !control.form.querySelector('[aria-invalid]')) message.hidden = true;
    }
    if (e.target.form?.id === 'parcel-form') parcelDraft[e.target.name] = e.target.value;
    if (e.target.closest('#capture-form') && e.target.type !== 'file') {
        try {
            captureValues();
            requireConnection();
        }
        catch (error) {
            showError($('#capture-form'), error);
        }
    }
});
document.addEventListener('change', async (e) => {
    if (!['camera-file', 'gallery-file'].includes(e.target.id)) {
        return;
    }
    if (!e.target.files?.length || !await connect()) {
        return;
    }
    const f = $('#capture-form');
    const routeAtSelection = location.hash;
    try {
        const candidate = await encodePhoto(e.target.files[0]);
        if (routeAtSelection !== location.hash || !$('#capture-form')) {
            return;
        }
        stagedPhoto = candidate;
        captureValues();
        render();
        document.querySelector('[data-action="confirm-photo"]')?.focus({preventScroll:true});
        announce('Revisa la nueva fotografía antes de confirmarla.');
    }
    catch (error) {
        showError(f, error);
    }
});
document.querySelector('.skip').addEventListener('click', e => {
    e.preventDefault();
    const main = $('#main');
    if (main) {
        main.tabIndex = -1;
        main.focus();
        main.scrollIntoView();
    }
});
document.addEventListener('change', e => {
    if (e.target.id === 'riskZone' || e.target.id === 'reportCase') {
        const prefix = e.target.id === 'riskZone' ? 'risk' : 'reports';
        go(prefix + '/' + encodeURIComponent(e.target.value));
    }
});
document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) {
        return;
    }
    const action = el.dataset.action;
    if(!await connect() || !el.isConnected)return;
    try {
        if (action === 'confirm-photo') {
            if (!stagedPhoto) {
                return;
            }
            el.disabled = true;
            const id = D.uid('IMG'), candidate = stagedPhoto;
            await photoStore(id, candidate);
            if (stagedPhoto !== candidate || !$('#capture-form')) {
                return;
            }
            mutate(() => state.draft.photoId = id);
            stagedPhoto = null;
            render();
            toast('Fotografía confirmada.');
        }
        if (action === 'cancel-photo') {
            stagedPhoto = null;
            render();
        }
        if (action === 'photo-next') {
            captureValues();
            if (!state.draft.photoId) {
                throw Error('Añade y confirma una fotografía antes de continuar.');
            }
            if (stagedPhoto) {
                throw Error('Confirma la nueva fotografía o conserva la anterior.');
            }
            if (!state.draft.quality) {
                throw Error('Indica cómo ves la calidad de tu fotografía.');
            }
            requireConnection();
            captureStep = 2;
            render();
        }
        if (action === 'photo-back') {
            captureValues();
            requireConnection();
            captureStep = 1;
            render();
        }
        if (action === 'zoom-draft' || action === 'zoom-case') {
            const id = action === 'zoom-draft' ? state.draft.photoId : safeCase().photoId;
            const src = await photoRead(id);
            if (!src) {
                throw Error('No se encontró la fotografía guardada.');
            }
            $('#full-image').src = src;
            $('#image-dialog').showModal();
        }
        if(action==='join-coop'){mutate(()=>state.coopLinked=true);render();}
        if(action==='refresh-sent'){render();toast('Estado actualizado.');}
        if (action === 'clear-filters') {
            filters = {};
            render();
        }
    }
    catch (error) {
        el.disabled = false;
        showError(el.closest('form') || $('#capture-form'), error);
    }
});
$('#close-image').addEventListener('click', () => $('#image-dialog').close());
document.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target, fd = new FormData(form), value = k => String(fd.get(k) || ''), checked = k => fd.has(k), submit = e.submitter;
    if(form.dataset.sending)return;
    form.dataset.sending='1';
    try {
        if(!await connect() || !form.isConnected)return;
        if (form.id === 'access-form') {
            const role = value('role');
            if (!D.ROLES[role]) {
                throw Error('Selecciona tu perfil.');
            }
            const mode=submit?.value||'profile';
            const phone=value('phone').replace(/[\s()-]/g,'').replace(/^\+51/,'');
            const profile=profiles.get(role);
            let name='';
            if(mode==='register'){
                if(profile)throw Error('Este perfil ya está creado. Usa Abrir mi perfil.');
                name=value('displayName').trim();
                if(!name)throw Error('Escribe el nombre para tu perfil.');
                if(!D.validPhone(phone))throw Error('Teléfono inválido. Ingresa un celular de nueve dígitos.');
                if(value('password').length<8)throw Error('La clave debe tener al menos ocho caracteres.');
                if(!checked('localConsent'))throw Error('Acepta las condiciones del perfil para continuar.');
                const key=await profileKey(role,phone,value('password'));
                requireConnection();
                profiles.set(role,{key,name});
            }else if(mode==='enter'||profile){
                if(!profile || await profileKey(role,phone,value('password'))!==profile.key)
                    throw Error('Revisa el teléfono y la clave del perfil seleccionado.');
                name=profile.name;
            }
            mutate(()=>{state.session={role,name,started:new Date().toISOString()};});
            go('home');
            toast('Perfil seleccionado.');
        }
        if (form.id === 'parcel-form') {
            const parcel = mutate(() => D.addParcel(state, { name: value('parcelName'), crop: value('crop'), zone: value('zone') }));
            parcelDraft = {};
            render();
            document.getElementById('titulo-' + parcel.id).focus();
            toast('Parcela registrada.');
        }
        if (form.id === 'capture-form') {
            if (submit?.disabled) {
                return;
            }
            if (captureStep !== 2 || stagedPhoto || !state.draft?.quality) {
                throw Error('Confirma la fotografía y añade contexto antes de guardar.');
            }
            captureValues();
            submit.disabled = true;
            submit.textContent = 'Guardando observación…';
            announce('Guardando la observación.');
            const c = mutate(() => D.addCase(state, state.draft));
            captureStep = 1;
            go('result/' + c.id);
            toast('Observación registrada.');
        }
        if (form.id === 'consult-form') {
            const r = mutate(() => {
                const r = D.requestReview(state, currentId, { question: value('question'), image: checked('shareImage'), zone: checked('shareZone') });
                state.privacy.image = true;
                if (checked('shareZone')) {
                    state.privacy.zone = true;
                }
                return r;
            });
            go('queue');
            toast('Consulta ' + r.id + ' registrada.');
        }
        if (form.id === 'evolution-form') {
            if (submit.disabled) {
                return;
            }
            submit.disabled = true;
            const targetId = currentId;
            let photoId;
            const f = fd.get('followPhoto');
            if (f?.size) {
                const data = await encodePhoto(f);
                photoId = D.uid('IMG');
                await photoStore(photoId, data);
            }
            mutate(() => D.addObservation(state, targetId, { date: value('followDate'), note: value('followNote'), photoId }));
            render();
            toast('Evolución añadida sin cambiar la observación original.');
        }
        if (form.id === 'reminder-form') {
            let channel = value('channel');
            if (channel === 'notification' && 'Notification' in window) {
                if (Notification.permission === 'default') {
                    await Notification.requestPermission();
                }
            }
            mutate(() => D.addReminder(state, currentId, value('reminderDate'), channel));
            render();
            toast('Revisión guardada en la agenda.');
        }
        if (form.id === 'clarify-form') {
            const text = value('clarification').trim();
            if (!text) {
                throw Error('Escribe la aclaración antes de guardarla.');
            }
            mutate(() => {
                const r = state.requests.find(r => r.caseId === currentId && !r.revoked);
                if (!r) {
                    throw Error('La consulta ya no está autorizada.');
                }
                r.messages.push({ text, at: new Date().toISOString() });
            });
            render();
            toast('Aclaración guardada en el mismo hilo.');
        }
        if (form.id === 'safety-form') {
            if (!checked('understood')) {
                throw Error('Si no comprendes una precaución, abre la aclaración antes de continuar.');
            }
            toast('Lectura registrada.');
        }
        if (form.id === 'report-form') {
            if (!D.validDate(value('expires'))) {
                throw Error('Indica una fecha válida de vigencia.');
            }
            mutate(() => {
                D.addReport(state, currentId, { zone: value('reportZone'), community: checked('diffusion'), expires: value('expires') });
                if (checked('diffusion')) {
                    state.privacy.community = true;
                }
            });
            go('community');
            toast(checked('diffusion') ? 'Reporte registrado para verificación.' : 'Reporte guardado como privado.');
        }
        if (form.id === 'filters-form') {
            filters = { crop: value('filterCrop'), zone: value('filterZone'), status: value('filterStatus') };
            render();
        }
        if (form.id === 'share-protocol-form') {
            mutate(() => D.shareProtocol(state, value('protocolVersion')));
            toast('Distribución registrada.');
        }
        if (form.id === 'review-form') {
            mutate(() => D.reviewCase(state, currentId, { outcome: value('reviewOutcome'), reason: value('reviewReason') }));
            render();
            toast('Revisión guardada. Original conservado.');
        }
        if (form.id === 'orientation-form') {
            mutate(() => D.orientCase(state, currentId, { text: value('orientation'), reference: value('reference'), conditions: value('conditions'), limits: value('limits') }));
            render();
            toast('Orientación guardada con referencia y límites.');
        }
        if (form.id === 'inspection-form') {
            const c = D.getCase(state, value('inspectionCase'));
            if (!c) {
                throw Error('Selecciona un caso compartido autorizado.');
            }
            if (!D.validDate(value('inspectionDate')) || value('inspectionDate') > D.today()) {
                throw Error('La fecha de una inspección registrada no puede ser futura.');
            }
            if (!value('inspectionObservation').trim() && !checked('partial')) {
                throw Error('Registra una observación o guarda la evaluación parcial.');
            }
            mutate(() => {
                const r = state.requests.find(r => r.caseId === c.id && !r.revoked), p = parcelFor(c);
                state.inspections.push({ id: D.uid('IN'), caseId: c.id, parcel: p.name, zone: r.consent.zone ? p.zone : 'Por coordinar · zona no autorizada', date: value('inspectionDate'), window: value('window') || 'Por coordinar', observation: value('inspectionObservation'), inference: value('inspectionInference'), status: checked('partial') ? 'Parcial · falta evidencia' : 'Registrada', inspector: 'Especialista' });
                D.event(state, 'Inspección guardada', c.id);
            });
            render();
            toast('Inspección guardada en la agenda.');
        }
        if (form.id === 'verify-form') {
            mutate(() => D.verifyReport(state, currentId, { status: value('verification'), reason: value('verificationReason'), sufficient: checked('sufficient') }));
            go('community');
            toast('Verificación registrada.');
        }
        if(form.id==='close-case-form'){
            const c=safeCase();
            const status=value('caseStatus'),reason=value('closeReason').trim();
            if(!['Resuelto','Continúa en seguimiento','Requiere visita'].includes(status)||!reason)throw Error('Elige un estado y escribe el motivo.');
            mutate(()=>{c.decisions??=[];c.decisions.push({previous:c.status,status,reason,date:D.today()});c.status=status;});
            render();toast('Estado del caso actualizado.');
        }
        if (form.id === 'privacy-form') {
            if (state.session?.role !== 'productor') {
                throw Error('Solo el productor puede cambiar sus permisos.');
            }
            mutate(() => D.revokePrivacy(state, { image: checked('privacyImage'), zone: checked('privacyZone'), community: checked('privacyCommunity') }));
            render();
            toast('Permisos actualizados.');
        }
    }
    catch (error) {
        if (submit) {
            submit.disabled = false;
            if (form.id === 'capture-form') {
                submit.textContent = 'Guardar y ver resultado';
            }
        }
        showError(form, error);
    } finally {delete form.dataset.sending;}
});
window.addEventListener('hashchange', async () => {
    if(!await connect())return;
    try {
        captureValues();
        if (state.draft) {
            requireConnection();
        }
        stagedPhoto = null;
        captureStep = 1;
    }
    catch (e) {
        toast(e.message);
    }
    render();
});
let reachable = false;
let ping;
let networkVersion = 0;
let connectionPanel;
function showConnectionError() {
    reachable = false;
    if (!connectionPanel) {
        connectionPanel = document.createElement('dialog');
        connectionPanel.className='network-dialog';
        connectionPanel.setAttribute('aria-labelledby','connection-heading');
        connectionPanel.innerHTML='<h2 id="connection-heading">Conexión interrumpida</h2><p>Conéctate a internet para continuar.</p><button class="button primary" type="button">Reintentar</button>';
        connectionPanel.addEventListener('cancel',e=>e.preventDefault());
        connectionPanel.querySelector('button').addEventListener('click',()=>connect());
        document.body.append(connectionPanel);
    }
    if(!connectionPanel.open)connectionPanel.showModal();
}
async function verifyConnection() {
    if (!navigator.onLine || !['http:', 'https:'].includes(location.protocol)) return false;
    if (ping) return ping;
    const version = networkVersion;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    ping = fetch('iconos/hoja.svg', { method: 'HEAD', cache: 'no-store', signal: controller.signal })
        .then(response => response.ok && version === networkVersion && navigator.onLine)
        .catch(() => false);
    try {
        reachable = await ping;
        return reachable;
    } finally {
        clearTimeout(timeout);
        ping = null;
    }
}
async function connect() {
    if(!await verifyConnection()){showConnectionError();return false;}
    const recover=connectionPanel?.open;
    if(recover)connectionPanel.close();
    if(!document.querySelector('#app main') || (recover && renderedHash!==location.hash))render();
    return true;
}
function requireConnection() {
    if(!reachable || !navigator.onLine)throw Error('Conéctate a internet para continuar.');
}
window.addEventListener('offline',()=>{networkVersion++;showConnectionError();});
window.addEventListener('online',()=>connect());
window.addEventListener('pageshow',()=>{connect();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)connect();});
setInterval(()=>{if(!document.hidden)connect();},30000);
connect();
