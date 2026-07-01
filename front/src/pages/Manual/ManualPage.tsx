import { ShieldCheck, Activity } from 'lucide-react';
import './Manual.css';

const GUIDELINES = [
  { strong: '1. La seguridad es primero:', text: 'Nunca pongas en riesgo tu vida ni la de otras personas para obtener una imagen.' },
  { strong: '2. Prioriza la dignidad:', text: 'Graba con respeto, evitando escenas que humillen, expongan o revictimicen a las personas.' },
  { strong: '3. Obtén consentimiento cuando sea posible:', text: 'Explica el propósito del registro y pide autorización antes de tomar imágenes o videos.' },
  { strong: '4. En niños, extrema la protección:', text: 'Si un niño está acompañado, solicita autorización al adulto responsable. Evita primeros planos innecesarios y situaciones que comprometan su privacidad.' },
  { strong: '5. Registra información útil:', text: 'Incluye la ubicación aproximada, fecha, hora y cualquier dato relevante que pueda facilitar la identificación o el reencuentro.' },
  { strong: '6. Captura imágenes claras:', text: 'Graba con buena iluminación, mantén la cámara estable y procura mostrar el rostro o características distintivas sin exagerar el acercamiento.' },
  { strong: '7. Haz videos cortos:', text: 'Entre 10 y 30 segundos suele ser suficiente para registrar información útil.' },
  { strong: '8. Identifica características importantes:', text: 'Menciona o registra ropa, accesorios, lesiones visibles, tatuajes, cicatrices o cualquier rasgo distintivo. En mascotas, incluye collar, placa, color, tamaño y características particulares.' },
  { strong: '9. No difundas información sensible:', text: 'Evita publicar datos personales, documentos de identidad o ubicaciones exactas que puedan poner en riesgo a las personas.' },
  { strong: '10. Verifica antes de compartir:', text: 'Confirma que el contenido sea reciente, auténtico y corresponda al lugar indicado. La información incorrecta puede dificultar los reencuentros y afectar las labores de respuesta.' }
];

const POLICIES = [
  {
    title: '1. Cero exposición de direcciones',
    text: 'Para mitigar riesgos delincuenciales de oportunidad, vandalismo u ocupación ilegal, está estrictamente prohibido publicar direcciones de viviendas particulares específicas, especialmente si están vacías o colapsadas por el sismo.',
    highlight: 'Las ubicaciones deben reportarse usando exclusivamente puntos de referencia comunitarios amplios (ej. "Entrada de la Plaza Bolívar", "Punto de control de Defensa Civil en Chacao").',
  },
  {
    title: '2. Uso exclusivo de instituciones verificadas',
    text: 'Para prevenir noticias falsas, pánico colectivo o desinformación táctica, la capacidad de reportar nuevos casos está restringida a personal verificado de instituciones de socorro, rescatistas acreditados y medios autorizados.',
    extra: 'Los ciudadanos y familiares actúan como consultores mediante las herramientas de búsqueda (tradicional o con IA) y pueden actualizar reportes con sus códigos cortos de gestión.',
  },
  {
    title: '3. Tratamiento ético y respeto a las víctimas',
    text: 'Cualquier imagen, video o nota de voz subida debe tener como único propósito facilitar la localización y reunificación de personas o animales. Queda prohibida la difusión de contenido explícito o morboso que atente contra la dignidad de los damnificados. El contenido inapropiado se modera y elimina de inmediato.',
  },
  {
    title: '4. Protección reforzada de menores (LOPNNA)',
    text: 'Nunca se expone públicamente el nombre, foto, ubicación exacta ni contacto de personas menores de 18 años. Sus casos aparecen siempre como "Caso protegido" y solo organizaciones verificadas pueden gestionarlos. No se envían datos de menores a sistemas de IA externos.',
  },
];

export function ManualPage() {
  return (
    <div className="manual-page page-content narrow">
      <header className="manual-hero">
        <span className="manual-hero-ico"><ShieldCheck size={26} /></span>
        <div>
          <p className="eyebrow">Seguridad y actuación</p>
          <h2>Manual y políticas</h2>
          <p className="manual-hero-sub">Buenas prácticas de reporte ético y políticas de seguridad ciudadana.</p>
        </div>
      </header>

      <section className="surface-card manual-block">
        <h3 className="manual-block-title"><Activity size={18} /> Guía de buenas prácticas para reportes</h3>
        <div className="manual-protocols">
          <div className="manual-protocol tone-blue">
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {GUIDELINES.map(item => (
                <li key={item.strong} style={{ lineHeight: '1.4' }}>
                  <strong style={{ display: 'block', marginBottom: '0.2rem' }}>{item.strong}</strong> 
                  <span style={{ color: 'var(--clr-text-muted)' }}>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="surface-card manual-block">
        <h3 className="manual-block-title"><ShieldCheck size={18} /> Políticas de seguridad humanitaria</h3>
        <div className="manual-policies">
          {POLICIES.map(policy => (
            <div key={policy.title} className="manual-policy">
              <h4>{policy.title}</h4>
              <p>{policy.text}</p>
              {policy.highlight && <p className="manual-policy-hl">{policy.highlight}</p>}
              {policy.extra && <p className="manual-policy-extra">{policy.extra}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
