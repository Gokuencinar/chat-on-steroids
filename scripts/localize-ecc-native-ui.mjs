/** Add newly introduced ECC learning / OpenAI dictation strings without rewriting existing catalog values. */
import { readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const es = {
  'ECC 2.2.3 — CoS-compatible Skills': 'ECC 2.2.3 — Skills compatibles con CoS',
  'Only independently reviewed ECC workflows that work with CoS tools are included. Claude-only hooks, external API requirements and platform-dependent scripts are omitted. Install only the workflows you need (64 active Skill limit).': 'Solo se incluyen los flujos ECC revisados individualmente que funcionan con las herramientas de CoS. Se omiten los hooks exclusivos de Claude, los requisitos de API externas y los scripts dependientes de la plataforma. Instala únicamente los flujos que necesites (máximo de 64 Skills activas).',
  'Show more ECC skills': 'Mostrar más Skills ECC',
  'ECC — Project knowledge and security': 'ECC — Conocimiento y seguridad del proyecto',
  'Save decisions and lessons explicitly in your approved project. Notes stay local, are treated as unreviewed data, and are never automatically included in chats. Security review examines selected configuration files without executing them.': 'Guarda decisiones y lecciones de forma explícita en tu proyecto autorizado. Las notas permanecen en el equipo, se consideran datos sin revisar y nunca se incluyen automáticamente en las conversaciones. La auditoría de seguridad examina determinados archivos de configuración sin ejecutarlos.',
  'Local project': 'Proyecto local',
  'Choose a project': 'Selecciona un proyecto',
  'Project memory': 'Memoria del proyecto',
  'Search memories': 'Buscar recuerdos',
  'Save a reviewed lesson or decision': 'Guardar una lección o decisión revisada',
  'Kind': 'Tipo',
  'Lesson': 'Lección',
  'Decision': 'Decisión',
  'Title': 'Título',
  'Knowledge': 'Conocimiento',
  'Save project knowledge': 'Guardar conocimiento del proyecto',
  'Static security audit': 'Auditoría estática de seguridad',
  'Scan selected project': 'Analizar el proyecto seleccionado',
  'ECC — Continuous learning': 'ECC — Aprendizaje continuo',
  'Refresh instincts': 'Actualizar instintos',
  'Native Windows observer. Learns tool workflows from short, content-free events in this project only. Disabled by default. Unreviewed instincts are never inserted into prompts, run as code or promoted globally.': 'Observador nativo de Windows. Aprende los flujos de herramientas a partir de eventos breves, sin contenido, únicamente de este proyecto. Está desactivado de forma predeterminada. Los instintos no revisados nunca se insertan en los prompts, se ejecutan como código ni se promueven globalmente.',
  'Enable continuous learning for the selected project': 'Activar el aprendizaje continuo en el proyecto seleccionado',
  'Choose a project first.': 'Primero selecciona un proyecto.',
  'Corrections and preferences': 'Correcciones y preferencias',
  'Record an explicit correction yourself. CoS will not infer your intentions from private chat transcripts.': 'Registra tú mismo una corrección explícita. CoS no deducirá tus intenciones a partir de conversaciones privadas.',
  'Practice you want CoS to learn': 'Práctica que quieres que aprenda CoS',
  'Search existing solutions before editing': 'Buscar soluciones existentes antes de editar',
  'Read source before changing it': 'Leer el código antes de modificarlo',
  'Run tests after changes': 'Ejecutar pruebas después de los cambios',
  'Reproduce errors before fixing': 'Reproducir los errores antes de corregirlos',
  'Ask before destructive operations': 'Preguntar antes de operaciones destructivas',
  'Investigate errors instead of unbounded retries': 'Investigar los errores en lugar de reintentar sin límite',
  'Record this correction': 'Registrar esta corrección',
  'Learned instincts': 'Instintos aprendidos',
  'Review evolution proposals': 'Revisar propuestas de evolución',
  'Export / import': 'Exportar / importar',
  'Export instincts as JSON': 'Exportar instintos a JSON',
  'Instinct bundle (contains no conversation history)': 'Paquete de instintos (sin historial de conversaciones)',
  'Import bundle': 'Importar paquete',
  'Clear project observations': 'Borrar observaciones del proyecto',
  'Dictation provider': 'Motor de dictado',
  'Windows dictation (local)': 'Dictado de Windows (local)',
  'OpenAI transcription (cloud)': 'Transcripción de OpenAI (nube)',
  'Search project memories': 'Buscar en la memoria del proyecto',
  'What was learned?': '¿Qué se ha aprendido?',
  'Evidence, decisions and validation — no secrets': 'Pruebas, decisiones y validación — sin datos secretos',
  'Paste an exported ECC learning JSON bundle here to review an import': 'Pega aquí un paquete JSON de aprendizaje ECC exportado para revisar su importación',
  'Choose Windows offline recognition or optional OpenAI API transcription. OpenAI uploads recorded audio after you stop.': 'Elige el reconocimiento local de Windows o la transcripción opcional de la API de OpenAI. OpenAI recibirá el audio grabado después de que detengas el dictado.',
  'Loading project learning…': 'Cargando el aprendizaje del proyecto…',
  'Could not load project learning.': 'No se pudo cargar el aprendizaje del proyecto.',
  'No learned instincts yet. A minimum of 20 observations is required.': 'Aún no hay instintos aprendidos. Se necesitan al menos 20 observaciones.',
  'Revoke approval': 'Revocar aprobación',
  'Approve for this project': 'Aprobar para este proyecto',
  'Choose a project first.': 'Primero selecciona un proyecto.',
  'Enable project learning to record corrections.': 'Activa el aprendizaje del proyecto para registrar correcciones.',
  'Explicit learning preference recorded.': 'Preferencia de aprendizaje registrada explícitamente.',
  'No reviewable evolution proposals yet.': 'Aún no hay propuestas de evolución para revisar.',
  'Draft only: not installed or executed.': 'Solo un borrador: no está instalado ni se ejecutará.',
  'Local learning export prepared for review.': 'Exportación de aprendizaje local preparada para su revisión.',
  'Choose a valid small JSON bundle first.': 'Primero selecciona un paquete JSON válido y pequeño.'
  , 'No matching memories for this project.': 'No se han encontrado recuerdos para este proyecto.'
  , 'Read note': 'Leer nota'
  , 'Choose a project and enter a title and note.': 'Selecciona un proyecto e introduce un título y una nota.'
  , 'Project knowledge saved.': 'Conocimiento del proyecto guardado.'
  , 'No findings in inspected files.': 'No se han detectado problemas en los archivos examinados.'
};

const html = readFileSync('src/renderer/index.html', 'utf8');
const dom = new JSDOM(html);
const { document } = dom.window;
const existing = JSON.parse(readFileSync('src/renderer/locales/zh-CN.json', 'utf8'));
const required = new Set();
const walker = document.createTreeWalker(document.body, 4);
while (walker.nextNode()) {
  const node = walker.currentNode;
  if (node.parentElement?.closest('script, style, svg, code, kbd, textarea, [translate="no"]')) continue;
  const key = node.textContent.replace(/\s+/g, ' ').trim();
  if (/[a-zA-Z]{2}/.test(key) && !existing[key]) required.add(key);
}
for (const node of document.querySelectorAll('[title], [placeholder], [aria-label]')) {
  if (node.closest('[translate="no"]')) continue;
  for (const attr of ['title', 'placeholder', 'aria-label']) {
    const key = node.getAttribute(attr);
    if (key && /[a-zA-Z]{2}/.test(key) && !existing[key]) required.add(key);
  }
}
for (const match of readFileSync('src/renderer/ecc-learning-ui.ts', 'utf8').matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g))
  required.add(match[1]);
for (const match of readFileSync('src/renderer/ecc-workspace.ts', 'utf8').matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g))
  required.add(match[1]);
const paths = ['es','zh-CN','zh-TW','ja','ko','tr','vi','fr','pt-PT','pt-BR','de','ru'];
for (const locale of paths) {
  const file = `src/renderer/locales/${locale}.json`;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const missing = [...required].filter(key => !Object.hasOwn(data, key));
  // English fallback is intentional for locales whose translations have not yet
  // been reviewed. Never disguise it as an independently verified translation.
  for (const key of missing) data[key] = locale === 'es' ? (es[key] ?? key) : key;
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
  process.stdout.write(`${locale}: added ${missing.length} keys\n`);
}
