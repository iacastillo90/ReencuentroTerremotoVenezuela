import { ShieldCheck, BookOpen, AlertTriangle, Activity, LifeBuoy } from 'lucide-react';
import './Manual.css';

const PROTOCOL_SECTIONS = [
  {
    title: 'ANTES DEL SISMO (PREPARACIÓN)',
    tone: 'blue' as const,
    icon: <BookOpen size={18} />,
    items: [
      { strong: 'Prepara un bolso de emergencia:', text: 'Agua embotellada, linterna, baterías, radio portátil, silbato, botiquín de primeros auxilios y copia de documentos.' },
      { strong: 'Identifica zonas seguras:', text: 'Reconoce las columnas de concreto armado de tu vivienda, plazas abiertas alejadas del tendido eléctrico o canchas deportivas cercanas.' },
      { strong: 'Asegura objetos pesados:', text: 'Sujeta firmemente estantes, televisores o calentadores que puedan colapsar.' },
    ],
  },
  {
    title: 'DURANTE EL SISMO (ACCIÓN)',
    tone: 'red' as const,
    icon: <AlertTriangle size={18} />,
    items: [
      { strong: 'Agáchate, cúbrete y sujétate:', text: 'Busca refugio debajo de una mesa resistente o colócate en posición fetal junto a una columna estructural.' },
      { strong: 'Aléjate de ventanas:', text: 'Evita vidrios, ventanas, paredes exteriores y cualquier estructura que pueda desprenderse.' },
      { strong: 'No uses ascensores:', text: 'La tecnología de ascensores puede fallar por falta de fluido eléctrico. Usa las escaleras solo una vez cese la sacudida.' },
    ],
  },
  {
    title: 'DESPUÉS DEL SISMO (SUPERVIVENCIA)',
    tone: 'green' as const,
    icon: <LifeBuoy size={18} />,
    items: [
      { strong: 'Evacua de forma ordenada:', text: 'Dirígete a espacios abiertos predefinidos. Cierra el suministro de gas y electricidad si es seguro hacerlo.' },
      { strong: 'Sintoniza radio de emergencia:', text: 'En caso de colapso de internet móvil, sintoniza la banda de Radioaficionados de Venezuela (146.520 MHz VHF) para reportes oficiales.' },
      { strong: 'Usa esta plataforma responsablemente:', text: 'Si encuentras a una persona desorientada, inicia sesión, graba un video descriptivo y súbelo para alertar a las redes de rescate.' },
    ],
  },
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
          <p className="manual-hero-sub">Protocolos oficiales de actuación y normativas de seguridad ciudadana en situaciones de crisis.</p>
        </div>
      </header>

      <section className="surface-card manual-block">
        <h3 className="manual-block-title"><Activity size={18} /> Manual de actuación ciudadana (FUNVISIS / Protección Civil)</h3>
        <div className="manual-protocols">
          {PROTOCOL_SECTIONS.map(section => (
            <div key={section.title} className={`manual-protocol tone-${section.tone}`}>
              <h4>{section.icon} {section.title}</h4>
              <ul>
                {section.items.map(item => (
                  <li key={item.strong}><strong>{item.strong}</strong> {item.text}</li>
                ))}
              </ul>
            </div>
          ))}
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
