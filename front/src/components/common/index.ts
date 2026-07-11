/**
 * common/index.ts — Barrel de exportaciones de componentes compartidos
 *
 * Re-exporta todos los componentes de uso general para que
 * los imports sean limpios: import { CustomSelect, LoadingScreen } from '../common';
 */
export { CustomSelect } from './CustomSelect';
export { LoadingScreen } from './LoadingScreen';
export { EmptyState } from './EmptyState';
export { NameCell } from './NameCell';
export { StepProgressBar } from './StepProgressBar';
export { CategorySelector, DEFAULT_CATEGORIES, SEARCH_CATEGORIES } from './CategorySelector';
export { ModalOverlay } from './ModalOverlay';
export { ChatWidget } from './ChatWidget';
