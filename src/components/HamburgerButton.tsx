import { Menu, X } from "lucide-react";

/**
 * HamburgerButtonProps -> Derived from `Hamburger` (menu icon) + `Button` + `Props`.
 */
interface HamburgerButtonProps {
  /** isOpen -> Whether the sidebar is currently visible */
  isOpen: boolean;
  /** onToggle -> Callback to flip sidebar state */
  onToggle: () => void;
}

/**
 * HamburgerButton -> Fixed-position toggle for the collapsible sidebar.
 * Renders Menu icon when closed, X icon when open.
 */
export default function HamburgerButton({ isOpen, onToggle }: HamburgerButtonProps) {
  return (
    !isOpen && (
      <button className="hamburger-btn" onClick={onToggle} aria-label="Toggle sidebar">
        <Menu size={18} />
      </button>
    )
  );
}
