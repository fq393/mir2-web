/** Shared logical-pixel typography for Canvas labels and DOM overlays.
 * 9 pt at 96 dpi = 12 CSS px. FState equipment descriptions explicitly use 9 pt.
 * Songti SC is a macOS fallback, not the Windows SimSun bitmap rasterizer.
 * See docs/typography-audit.md for source and fidelity limits.
 */
export const CLASSIC_FONT_FAMILY = '"NSimSun","SimSun","Songti SC",serif';
export const CLASSIC_TEXT_SIZE = 12;
export const classicFont = (size = CLASSIC_TEXT_SIZE): string => `${size}px ${CLASSIC_FONT_FAMILY}`;
