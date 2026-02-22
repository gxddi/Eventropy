/**
 * DragRegion -> Derived from `Drag` (macOS window drag) + `Region` (area).
 * Transparent overlay for macOS title bar dragging via -webkit-app-region.
 */
export default function DragRegion() {
  return <div className="drag-region" />;
}
