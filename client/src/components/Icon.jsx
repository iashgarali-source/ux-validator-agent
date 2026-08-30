/**
 * Thin wrapper around the real Arvo icon font (o9con — 1067 icons, shipped
 * from the design-system repo at packages/assets/o9con). Renders the actual
 * glyph, not a lucide-react substitute.
 *
 * Usage: <Icon name="paperclip" size={20} />
 *
 * Accessibility: the glyph itself is always aria-hidden — per the Arvo
 * accessibility contract, icon-only controls get their accessible name from
 * the parent button's `aria-label`, never from the icon.
 */
export default function Icon({ name, size = 20, className = "", style, ...props }) {
  return (
    <i
      className={`o9con o9con-${name} ${className}`.trim()}
      style={{ fontSize: size, lineHeight: 1, ...style }}
      aria-hidden="true"
      {...props}
    />
  );
}
