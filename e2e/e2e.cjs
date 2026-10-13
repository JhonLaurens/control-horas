// Prueba de humo E2E: importa un respaldo de la versión HTML y recorre la app contra la API real.
// Uso: APP_URL=http://localhost:8092 CHROME=/ruta/chrome HTML_APP=/ruta/ControlHoras.html node e2e.cjs
// ¡Borra todos los datos de la instancia indicada! Úsalo solo contra una base de pruebas.
const { chromium } = require('playwright-core');
const fs = require('fs');
const APP = process.env.APP_URL || 'http://localhost:8092';
const HTML_APP = process.env.HTML_APP;
const OUT = process.env.SHOTS || '';
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const H = 3600000;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-CO', timezoneId: 'America/Bogota', acceptDownloads: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const api = async (method, path, body) => { const r = await page.request.fetch(APP + '/api' + path, { method, data: body }); return { status: r.status(), body: r.status() === 204 ? null : await r.json().catch(() => null) }; };
  const wait = ms => page.waitForTimeout(ms);

  await page.goto(APP); await wait(600);
  ok((await api('GET', '/health')).body.status === 'UP', 'Health UP a través de nginx/proxy');
  await api('DELETE', '/data'); await page.reload(); await wait(600);
  ok(await page.locator('#bStart').isVisible(), 'Iniciar visible con base vacía');

  // 1) Respaldo exportado desde la versión HTML
  let backupPath;
  if (HTML_APP) {
    const p2 = await ctx.newPage(); await p2.goto('file://' + HTML_APP); await p2.waitForTimeout(400);
    await p2.evaluate(() => {
      const at = (y, m, d, h, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
      const S = { sessions: [
        { id: 'thu', start: at(2026, 10, 8, 6, 30), end: at(2026, 10, 8, 19, 30), pauses: [{ start: at(2026, 10, 8, 12), end: at(2026, 10, 8, 13) }], note: 'Cierre mensual', tag: 'Proyecto Demo' },
        { id: 'fest', start: at(2026, 10, 12, 8), end: at(2026, 10, 12, 12), pauses: [], note: 'Soporte festivo', tag: 'Soporte' },
        { id: 'sat', start: at(2026, 10, 3, 9), end: at(2026, 10, 3, 11), pauses: [], note: '', tag: '' },
        { id: 'lunch', start: at(2026, 10, 6, 7, 30), end: at(2026, 10, 6, 17, 30), pauses: [{ start: at(2026, 10, 6, 12), end: at(2026, 10, 6, 14) }], note: 'Reuniones', tag: 'Proyecto Demo' },
        { id: 'mid', start: at(2026, 10, 1, 22), end: at(2026, 10, 2, 2), pauses: [], note: 'Despliegue', tag: 'Infra' },
        { id: 'man', start: at(2026, 10, 5, 9), end: at(2026, 10, 5, 11), pauses: [], note: '', tag: '', extra: true },
        { id: 'sun5', start: at(2026, 9, 20, 17), end: at(2026, 9, 20, 22), pauses: [], note: '', tag: '' },
        { id: 'satsun', start: at(2026, 9, 26, 23), end: at(2026, 9, 27, 2), pauses: [], note: '', tag: '' },
        { id: 'old', start: at(2025, 12, 10, 17, 30), end: at(2025, 12, 10, 22), pauses: [], note: '', tag: '' },
        { id: 'wed', start: at(2026, 10, 7, 7, 25), end: at(2026, 10, 7, 18, 10), pauses: [{ start: at(2026, 10, 7, 12, 10), end: at(2026, 10, 7, 13, 30) }], note: 'Desarrollo API', tag: 'Proyecto Demo' },
        { id: 'fri', start: at(2026, 10, 9, 7, 35), end: at(2026, 10, 9, 17, 40), pauses: [{ start: at(2026, 10, 9, 12), end: at(2026, 10, 9, 13, 25) }], note: 'Pruebas', tag: 'QA' },
        { id: 'tue', start: at(2026, 10, 13, 7, 30), end: at(2026, 10, 13, 19, 45), pauses: [{ start: at(2026, 10, 13, 12), end: at(2026, 10, 13, 13, 30) }], note: 'Post-festivo', tag: 'Soporte' },
        { id: 'bad', start: 5, end: 1, pauses: [] }
      ], active: { id: 'act', start: at(2026, 10, 9, 20), end: null, pauses: [], note: '', tag: '' },
      settings: { schedStart: '07:30', schedEnd: '17:30', lunch: 90, nightStart: null, nightEnd: '06:00', theme: 'dark', accent: 0, customAccent: null, workdays: [1, 2, 3, 4, 5], hint: true } };
      localStorage.setItem('controlHoras.v1', JSON.stringify(S));
    });
    await p2.reload(); await p2.waitForTimeout(400); await p2.keyboard.press('4'); await p2.waitForTimeout(200);
    const [dl] = await Promise.all([p2.waitForEvent('download'), p2.click('#btnJson')]);
    backupPath = '/tmp/respaldo-html.json'; await dl.saveAs(backupPath); await p2.close();
    // la jornada activa del HTML no debe importarse; quitamos la sesión "tue" del futuro si aplica
  }
  if (backupPath) {
    await page.keyboard.press('4'); await wait(300);
    await page.setInputFiles('#fileImport', backupPath); await wait(1200);
    const st = (await api('GET', '/state')).body;
    const n = st.sessions.length;
    ok(n >= 11, `Importación del respaldo HTML: ${n} sesiones (inválida omitida)`);
    ok(st.active === null, 'La jornada en curso del respaldo no se importa');
    ok((await page.locator('.toasts').innerText()).includes('Importadas'), 'Toast de importación');
    const again = (await api('POST', '/import', JSON.parse(fs.readFileSync(backupPath, 'utf8')))).body;
    ok(again.imported === 0 && again.skipped >= 12, 'Reimportar no duplica: ' + JSON.stringify(again));
  }

  // 2) Clasificación del backend (mismas reglas que el frontend)
  const day = (await api('GET', '/summary/day?date=2026-10-08')).body;
  ok(day.categories.oD === 8.5 * H && day.categories.eD === 3 * H && day.categories.eN === 0.5 * H, 'API día 08-oct: 8,5 ord + 3 ext. diurna + 0,5 ext. nocturna');
  const wk = (await api('GET', '/summary/week?date=2026-10-12')).body;
  ok(wk.goalMs === 34 * H && wk.days[0].festivo === 'Día de la Raza', 'API semana del festivo: meta 34 h y festivo marcado');
  const sun = (await api('GET', '/summary/day?date=2026-09-20')).body;
  ok(sun.categories.fD === 2 * H && sun.categories.fN === 3 * H, 'API domingo 17-22: 2 h dom diurna + 3 h dom nocturna');
  const old = (await api('GET', '/summary/day?date=2025-12-10')).body;
  ok(old.nightStart === '21:00' && old.categories.eN === 1 * H, 'API 10-dic-2025 usa la frontera antigua (21:00)');
  ok((await api('GET', '/summary/month?year=2026&month=13')).status === 400, 'Validación: mes inválido → 400');
  ok((await api('POST', '/sessions', { start: 10, end: 5 })).status === 400, 'Validación: sesión con fin antes del inicio → 400');
  const badSet = await api('PUT', '/settings', { schedStart: '25:00' });
  ok(badSet.status === 400 && /no debe ser nulo|debe coincidir/.test(badSet.body.detail), 'Errores de validación en español: ' + badSet.body.detail.slice(0, 60));

  // 3) Flujo de jornada en la UI
  await page.keyboard.press('1'); await wait(300);
  await page.fill('#inNote', 'Prueba E2E'); await page.fill('#inTag', 'QA'); await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Space'); await wait(1300);
  let st = (await api('GET', '/state')).body;
  ok(st.active && st.active.note === 'Prueba E2E' && st.active.tag === 'QA', 'Espacio inicia jornada (guardada en PostgreSQL con nota y proyecto)');
  ok(await page.locator('#statusPill').innerText() === 'En curso', 'Pill En curso');
  ok((await page.title()).includes('00:00:0'), 'Título con cronómetro: ' + await page.title());
  await page.keyboard.press('p'); await wait(1200);
  st = (await api('GET', '/state')).body; ok(st.active.pauses.length === 1 && st.active.pauses[0].end == null, 'P pausa');
  await page.reload(); await wait(800);
  ok(await page.locator('#statusPill').innerText() === 'En pausa' && (await page.inputValue('#inNote')) === 'Prueba E2E', 'Recargar conserva la jornada en pausa y la nota');
  await page.click('#bPause'); await wait(500);
  await page.keyboard.press('x'); await wait(500);
  st = (await api('GET', '/state')).body; ok(st.active.pauses[0].end != null && st.active.extra === true, 'Reanudar + X marca extra');
  await page.click('#bStop'); await wait(700);
  st = (await api('GET', '/state')).body;
  ok(!st.active && st.sessions.some(s => s.note === 'Prueba E2E' && s.extra), 'Finalizar guarda la sesión');
  ok((await page.locator('.toasts').innerText()).includes('Sesión guardada'), 'Toast sesión guardada');
  // Conflicto: dos inicios seguidos
  await api('POST', '/active/start', {}); const dup = await api('POST', '/active/start', {});
  ok(dup.status === 409, 'API: segunda jornada simultánea → 409'); await api('POST', '/active/stop', {});

  // 4) Sesión manual, edición, eliminar y deshacer
  await page.keyboard.press('n'); await wait(300);
  ok(await page.locator('#dlg').isVisible(), 'N abre diálogo de sesión manual');
  await page.fill('#fSD', '2026-10-02'); await page.fill('#fST', '07:30'); await page.fill('#fED', '2026-10-02'); await page.fill('#fET', '17:30'); await page.fill('#fP', '90'); await page.fill('#fNote', 'Manual E2E');
  ok((await page.innerText('#fCalc')).includes('8 h 30 min'), 'Diálogo calcula 8 h 30 min');
  await page.click('#dlgOk'); await wait(700);
  st = (await api('GET', '/state')).body; const man = st.sessions.find(s => s.note === 'Manual E2E');
  ok(man && man.pauses.length === 1 && man.pauses[0].end - man.pauses[0].start === 90 * 60000, 'Sesión manual guardada con pausa de 90 min');
  await page.keyboard.press('4'); await wait(300); await page.click('[data-r="all"]'); await wait(300);
  await page.click(`[data-edit="${man.id}"]`); await wait(300);
  await page.fill('#fNote', 'Manual editada'); await page.click('#dlgOk'); await wait(600);
  st = (await api('GET', '/state')).body; ok(st.sessions.find(s => s.id === man.id).note === 'Manual editada', 'Editar sesión');
  await page.click(`[data-del="${man.id}"]`); await wait(600);
  ok(!(await api('GET', '/state')).body.sessions.some(s => s.id === man.id), 'Eliminar sesión');
  await page.locator('.toast button', { hasText: 'Deshacer' }).click(); await wait(700);
  ok((await api('GET', '/state')).body.sessions.some(s => s.id === man.id), 'Deshacer restaura la sesión');

  // 5) CSV generado por el backend
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnCsv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8'); const lines = csv.slice(1).split('\r\n');
  const head = lines[0].split(';');
  ok(csv.charCodeAt(0) === 0xFEFF && ['Ordinaria diurna', 'Ordinaria nocturna', 'Extra diurna', 'Extra nocturna', 'Dominical/festivo diurna', 'Dominical/festivo nocturna', 'Sábado/descanso diurna', 'Sábado/descanso nocturna', 'Inicio nocturna aplicado'].every(c => head.includes(c)), 'CSV con BOM y las 8 categorías');
  const r08 = lines.find(l => l.startsWith('2026-10-08')); ok(r08 && r08.includes(';8,50;0,00;3,00;0,50;'), 'CSV fila 08-oct: ' + r08);
  ok(lines.some(l => l.includes('Día de la Raza')) && lines[lines.length - 1].startsWith('TOTAL'), 'CSV con festivo y fila TOTAL');
  console.log('  ' + dl.suggestedFilename());

  // 6) Vistas semana / mes
  await page.keyboard.press('2'); await wait(300); await page.click('[data-shift="1"]'); await wait(400);
  ok((await page.locator('#wChart').innerText()).includes('Festivo'), 'Semana del 12-oct marca festivo');
  ok((await page.locator('#wKpis').innerText()).includes('/ 34 h'), 'Meta semanal con festivo = 34 h');
  ok((await page.locator('#wExt').innerText()).includes('Dominical/festivo diurna'), 'Semana muestra desglose por categoría');
  if (OUT) await page.screenshot({ path: OUT + '/captura-semana.png' });
  await page.keyboard.press('3'); await wait(400);
  ok((await page.locator('#mHeat').innerText()).includes('Día de la Raza') && (await page.locator('#mFest').innerText()).includes('Día de la Raza'), 'Mes muestra Día de la Raza');
  if (OUT) { await page.setViewportSize({ width: 1440, height: 1420 }); await wait(300); await page.screenshot({ path: OUT + '/captura-mes.png' }); await page.setViewportSize({ width: 1440, height: 900 }); }

  // 7) Ajustes persistidos en el servidor
  await page.keyboard.press('5'); await wait(300);
  await page.fill('#sEnd', '18:00'); await page.press('#sEnd', 'Tab'); await wait(1100);
  ok((await api('GET', '/settings')).body.schedEnd === '18:00', 'Ajuste hora de salida guardado en el servidor');
  ok((await page.innerText('#sDerived')).includes('9 h por día'), 'Jornada derivada se actualiza (9 h)');
  await page.selectOption('#sNightMode', 'custom'); await wait(500);
  ok((await api('GET', '/settings')).body.nightStart === '19:00', 'Inicio nocturno personalizado');
  await page.selectOption('#sNightMode', 'auto'); await page.fill('#sEnd', '17:30'); await page.press('#sEnd', 'Tab'); await wait(1100);
  ok((await api('GET', '/settings')).body.nightStart === null && (await api('GET', '/settings')).body.schedEnd === '17:30', 'Volver a valores por defecto');
  await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('t'); await wait(400);
  ok((await api('GET', '/settings')).body.theme === 'light' && await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'T cambia tema y se guarda');
  await page.keyboard.press('t'); await wait(400);

  // 8) Capturas finales
  await page.keyboard.press('1'); await wait(400);
  if (OUT) await page.screenshot({ path: OUT + '/captura-principal.png' });
  await page.keyboard.press('4'); await wait(400);
  if (OUT) await page.screenshot({ path: OUT + '/captura-historial.png' });
  const html = await page.content();
  ok(!/\$\s?\d|COP|valor hora|salario/i.test(html), 'Sin cálculos de dinero en la UI');
  ok(errs.length === 0, 'Sin errores en consola' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
