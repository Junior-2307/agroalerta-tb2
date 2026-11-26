const AgroDatos = (() => {


    const ROLES = { productor: 'Productor', cooperativa: 'Cooperativa', especialista: 'Especialista' };
    const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const uid = prefix => prefix + '-' + crypto.randomUUID().slice(0, 8);
    const initialState = () => ({ schema: 1, session: null, parcels: [], cases: [], requests: [], reports: [], reminders: [], inspections: [], shares: [], draft: null, coopLinked: false, privacy: { image: false, zone: false, community: false }, events: [] });

    const validPhone = value => /^(?:\+51)?9\d{8}$/.test(value.replace(/[\s()-]/g, ''));
    const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
    function event(state, type, ref) {
        state.events.push({ id: uid('EV'), type, ref, actor: ROLES[state.session?.role] || 'Visitante', at: new Date().toISOString() });
    }
    function addParcel(state, input) {
        if (state.session?.role !== 'productor') {
            throw Error('Selecciona el perfil productor para registrar una parcela.');
        }
        if (!input.name?.trim()) {
            throw Error('Escribe el nombre de la parcela.');
        }
        if (!input.crop?.trim()) {
            throw Error('Selecciona el cultivo. El borrador se conserva.');
        }
        const p = { id: uid('PA'), name: input.name.trim(), crop: input.crop.trim(), zone: input.zone?.trim() || 'Sin zona declarada', owner: 'productor', created: today() };
        state.parcels.push(p);
        event(state, 'Parcela registrada', p.id);
        return p;
    }
    function addCase(state, input) {
        if (state.session?.role !== 'productor') {
            throw Error('Solo el productor registra observaciones de sus parcelas.');
        }
        if (!state.parcels.some(p => p.id === input.parcelId)) {
            throw Error('Selecciona una parcela válida antes de guardar.');
        }
        if (!input.photoId) {
            throw Error('Añade una fotografía y revísala antes de continuar.');
        }
        if (!input.organ || !input.symptoms?.trim()) {
            throw Error('Completa el órgano y la descripción de lo observado.');
        }
        if (!validDate(input.date) || input.date > today()) {
            throw Error('La fecha de observación debe ser válida y no futura.');
        }
        const c = { id: uid('CA'), parcelId: input.parcelId, photoId: input.photoId, date: input.date, organ: input.organ, symptoms: input.symptoms.trim(), quality: input.quality || 'insuficiente', urgency: input.urgency || 'normal', status: input.quality === 'clara' ? 'Observación registrada' : 'Inconcluso', result: input.quality === 'clara' ? 'pendiente' : 'inconcluso', owner: 'productor', created: new Date().toISOString(), observations: [], review: null, orientation: null };
        state.cases.push(c);
        state.draft = null;
        event(state, 'Observación registrada', c.id);
        return c;
    }
    function getCase(state, id, role = state.session?.role) {
        const c = state.cases.find(c => c.id === id);
        if (!c) {
            return null;
        }
        if (role === 'productor') {
            return c;
        }
        if (role === 'especialista' && state.requests.some(r => r.caseId === id && r.consent.image && !r.revoked)) {
            return c;
        }
        return null;
    }
    function requestReview(state, caseId, input) {
        const c = getCase(state, caseId);
        if (!c || state.session?.role !== 'productor') {
            throw Error('Caso fuera del ámbito del perfil.');
        }
        if (!input.image) {
            throw Error('El caso sigue privado. Autoriza compartir la imagen para preparar la revisión.');
        }
        if (!input.question?.trim()) {
            throw Error('Escribe qué necesitas consultar.');
        }
        const existing = state.requests.find(r => r.caseId === caseId && !r.revoked);
        if (existing) {
            return existing;
        }
        const r = { id: uid('CO'), caseId, question: input.question.trim(), consent: { image: true, zone: !!input.zone }, status: 'Pendiente de revisión', created: new Date().toISOString(), messages: [], revoked: false };
        state.requests.push(r);
        c.status = 'Revisión solicitada';
        event(state, 'Consulta registrada', r.id);
        return r;
    }

    function addObservation(state, id, input) {
        const c = getCase(state, id);
        if (!c || state.session?.role !== 'productor') {
            throw Error('Caso no disponible.');
        }
        if (!validDate(input.date) || input.date < c.date || input.date > today()) {
            throw Error('La fecha debe estar entre la observación inicial y hoy.');
        }
        if (!input.note?.trim() && !input.photoId) {
            throw Error('Añade una descripción o una fotografía de evolución.');
        }
        c.observations.push({ id: uid('OB'), date: input.date, note: input.note?.trim() || '', photoId: input.photoId || null });
        event(state, 'Evolución registrada', id);
    }
    function addReminder(state, id, date, channel = 'agenda') {
        const c = getCase(state, id);
        if (!c || state.session?.role !== 'productor') {
            throw Error('Caso no disponible.');
        }
        if (!validDate(date) || date < today()) {
            throw Error('Elige hoy o una fecha futura para la revisión.');
        }
        const r = { id: uid('AG'), caseId: id, parcelId: c.parcelId, date, channel: 'agenda', requestedChannel: channel };
        state.reminders.push(r);
        event(state, 'Revisión en agenda', id);
        return r;
    }
    function addReport(state, id, input) {
        const c = getCase(state, id);
        if (!c || state.session?.role !== 'productor') {
            throw Error('Caso no disponible.');
        }
        if (!input.zone?.trim()) {
            throw Error('Indica solo una zona aproximada.');
        }
        if (!c.photoId) {
            throw Error('El reporte necesita evidencia.');
        }
        const r = { id: uid('FO'), caseId: id, zone: input.zone.trim(), crop: state.parcels.find(p => p.id === c.parcelId).crop, public: !!input.community, status: input.community ? 'En verificación' : 'Privado', reason: '', expires: input.expires || today(), source: 'Reporte de campo', created: today() };
        state.reports.push(r);
        event(state, 'Reporte registrado', r.id);
        return r;
    }
    function revokePrivacy(state, input) {
        state.privacy = { image: !!input.image, zone: !!input.zone, community: !!input.community };
        if (!input.image) {
            state.requests.forEach(r => {
                r.revoked = true;
                r.status = 'Permiso retirado';
                r.consent.image = false;
            });
        }
        if (!input.zone) {
            state.requests.forEach(r => {
                r.consent.zone = false;
            });
        }
        if (!input.community) {
            state.reports.forEach(r => {
                r.public = false;
                r.status = 'Privado';
            });
        }
        event(state, 'Preferencias de privacidad guardadas', 'privacy');
    }
    function reviewCase(state, id, input) {
        const c = getCase(state, id);
        if (!c || state.session?.role !== 'especialista') {
            throw Error('No tienes un caso compartido para revisar.');
        }
        if (!input.reason?.trim()) {
            throw Error('Explica el motivo de la revisión.');
        }
        if (!['Aceptar registro', 'Solicitar corrección', 'Inconcluso'].includes(input.outcome)) {
            throw Error('Elige el resultado de revisión.');
        }
        c.reviewHistory ??= c.review ? [c.review] : [];
        c.review = { outcome: input.outcome, reason: input.reason.trim(), author: 'Especialista', at: new Date().toISOString(), original: c.result };
        c.reviewHistory.push(c.review);
        for(const r of state.requests.filter(r=>r.caseId===id && !r.revoked))r.status='Revisión registrada';
        c.status = input.outcome === 'Inconcluso' ? 'Falta información' : 'Revisado';
        event(state, 'Revisión añadida', id);
    }
    function orientCase(state, id, input) {
        const c = getCase(state, id);
        if (!c || state.session?.role !== 'especialista') {
            throw Error('Caso no autorizado para este perfil.');
        }
        if (!input.text?.trim() || !input.reference?.trim() || !input.conditions?.trim() || !input.limits?.trim()) {
            throw Error('Completa orientación, referencia, condiciones y límites.');
        }

        if (/(\d+(?:[.,]\d+)?\s*(mg|g|kg|ml|l|cc|ppm|%)(?:\b|\/))|dosis|dosificar|aplicar.{0,25}\d/i.test(input.text + ' ' + input.conditions)) {
            throw Error('La orientación admite observaciones sin dosis. Revisa el texto antes de guardar.');
        }
        c.orientationHistory ??= c.orientation ? [c.orientation] : [];
        c.orientation = { text: input.text.trim(), reference: input.reference.trim(), conditions: input.conditions.trim(), limits: input.limits.trim(), author: 'Especialista', at: new Date().toISOString() };
        c.orientationHistory.push(c.orientation);
        event(state, 'Orientación guardada', id);
    }
    function verifyReport(state, id, input) {
        if (state.session?.role !== 'especialista') {
            throw Error('Selecciona el perfil especialista.');
        }
        const r = state.reports.find(r => r.id === id && r.public);
        if (!r) {
            throw Error('Reporte privado o no disponible.');
        }
        if (!input.reason?.trim()) {
            throw Error('Registra el motivo y la evidencia revisada.');
        }
        const c = getCase(state, r.caseId);
        if (input.status === 'Verificado' && (!c || !input.sufficient)) {
            throw Error('Sin evidencia autorizada suficiente, el reporte debe permanecer en revisión.');
        }
        if (!['Verificado', 'Descartado', 'En verificación'].includes(input.status)) {
            throw Error('Estado inválido.');
        }
        r.status = input.status;
        r.reason = input.reason.trim();
        event(state, 'Verificación', id);
    }
    const COOP_EXAMPLES = [
        {
            id: "CC-001",
            crop: "Tomate",
            zone: "Sector norte",
            status: "Revisión requerida",
            date: "2026-11-05",
            urgency: "Alta declarada",
            reason: "El productor pide revisión",
            complete: true
        },
        {
            id: "CC-002",
            crop: "Lechuga",
            zone: "Sector sur",
            status: "Completar evidencia",
            date: "2026-11-04",
            urgency: "Normal declarada",
            reason: "Falta fotografía de detalle",
            complete: false
        },
        {
            id: "CC-003",
            crop: "Tomate",
            zone: "Sector sur",
            status: "En seguimiento",
            date: "2026-11-03",
            urgency: "Normal declarada",
            reason: "Revisión de evolución pendiente",
            complete: true
        }
    ];
    const PROTOCOLS = [
        {
            id: "OBS-1",
            crop: "Hortalizas",
            version: "1.0",
            author: "Equipo AgroAlerta",
            status: "En revisión",
            source: "Guía de observación. Referencia: SENASA (2020)",
            url: "https://www.senasa.gob.pe/senasacontigo/miles-de-agricultores-ya-aplican-control-biologico-para-manejo-de-plagas/"
        },
        {
            id: "OBS-0",
            crop: "Hortalizas",
            version: "0.9",
            author: "Equipo AgroAlerta",
            status: "Retirada",
            source: "Archivo de guías",
            url: null
        }
    ];
    function filterCoop(state, filters = {}) {
        if (state.session?.role !== 'cooperativa' || !state.coopLinked) {
            return [];
        }
        return COOP_EXAMPLES.filter(c => (!filters.crop || c.crop === filters.crop) && (!filters.zone || c.zone === filters.zone) && (!filters.status || c.status === filters.status)).sort((a, b) => Number(b.status === 'Revisión requerida') - Number(a.status === 'Revisión requerida'));
    }

    function shareProtocol(state, id) {
        if (state.session?.role !== 'cooperativa' || !state.coopLinked) {
            throw Error('Primero abre el tablero de la cooperativa.');
        }
        const p = PROTOCOLS.find(p => p.id === id);
        if (!p || p.status !== 'Validado') {
            throw Error('Esta versión aún no está aprobada para distribución.');
        }

        state.shares.push({ id: uid('DI'), protocolId: id, version: p.version, author: p.author, at: new Date().toISOString() });
    }
    return { ROLES, today, uid, initialState, validPhone, validDate, event, addParcel, addCase, getCase, requestReview, addObservation, addReminder, addReport, revokePrivacy, reviewCase, orientCase, verifyReport, COOP_EXAMPLES, filterCoop, PROTOCOLS, shareProtocol };
})();
