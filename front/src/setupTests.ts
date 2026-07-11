/**
 * setupTests.ts — Configuración global de tests (Vitest)
 *
 * PROPÓSITO:
 *   Vitest ejecuta este archivo antes de cada test suite.
 *   Importa @testing-library/jest-dom para extender los
 *   matchers de Jest/Vitest con utilidades como:
 *   - toBeInTheDocument()
 *   - toHaveClass()
 *   - toBeVisible()
 *   - toHaveTextContent()
 *   Y otros que usamos en los tests de componentes.
 *
 * NOTA:
 *   Vitest ya tiene jsdom configurado en vite.config.ts,
 *   no necesitamos setup adicional para el DOM.
 */
import '@testing-library/jest-dom'
