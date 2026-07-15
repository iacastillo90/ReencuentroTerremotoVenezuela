/**
 * components/modals/reportFormConstants.ts — Constantes del formulario de reporte
 *
 * Separadas de ReportSteps.tsx para que Fast Refresh (HMR de Vite)
 * pueda parchear los componentes sin recargar la página. Vite no permite
 * exportar constantes de módulo junto con componentes en el mismo archivo
 * si se quiere Fast Refresh.
 *
 * Cada array tiene la estructura { val, label, ... } para usarse con
 * CustomSelect o botones de selección visual.
 */
export const COLORS_PIEL = [
  { val: 'clara', hex: '#fadcbc', label: 'Clara' },
  { val: 'trigueña', hex: '#d2996c', label: 'Trigueña' },
  { val: 'morena', hex: '#8d5524', label: 'Morena' },
  { val: 'oscura', hex: '#3d2314', label: 'Oscura' },
];

export const COLORS_CABELLO = [
  { val: 'negro', hex: '#000000', label: 'Negro' },
  { val: 'castaño', hex: '#5c3a21', label: 'Castaño' },
  { val: 'rubio', hex: '#d6b85a', label: 'Rubio' },
  { val: 'canoso', hex: '#d9d9d9', label: 'Canoso' },
  { val: 'pelirrojo', hex: '#ad3e17', label: 'Pelirrojo' },
  { val: 'sin cabello', hex: '#e8c39e', label: 'Sin cabello' },
];

export const COLORS_OJOS = [
  { val: 'marrones', hex: '#5c3a21', label: 'Marrones' },
  { val: 'negro', hex: '#000000', label: 'Negro' },
  { val: 'verde', hex: '#5b8a53', label: 'Verde' },
  { val: 'azul', hex: '#3b82f6', label: 'Azul' },
  { val: 'gris', hex: '#808080', label: 'Gris' },
];

export const COMPLEXION = [
  { val: 'delgada', title: 'Delgada' },
  { val: 'media', title: 'Media' },
  { val: 'robusta', title: 'Robusta' },
];

export const SENAS = [
  { val: 'cicatrices', label: 'Cicatrices', desc: 'Marca visible en la piel por herida o cirugía' },
  { val: 'marca_nacimiento', label: 'Marca de nacimiento', desc: 'Mancha o marca presente desde el nacimiento' },
  { val: 'vello_facial', label: 'Vello facial', desc: 'Barba, bigote o patillas' },
  { val: 'amputaciones', label: 'Amputaciones / ausencia de miembros', desc: 'Falta parcial o total de una extremidad' },
  { val: 'lentes', label: 'Lentes', desc: 'Usa anteojos de forma habitual' },
  { val: 'tatuajes', label: 'Tatuajes', desc: 'Diseño permanente en la piel' },
  { val: 'lunares', label: 'Lunares visibles', desc: 'Lunar de tamaño o ubicación notable' },
  { val: 'aparatos', label: 'Uso de aparatos ortopédicos visibles', desc: 'Bastón, silla de ruedas o aparato ortodóntico' },
];
