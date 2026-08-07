"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/// Render outside the layout, directly on document.body. Member 4.
///
/// `position: fixed` is only relative to the viewport while no ancestor has a
/// transform, filter or containment. Any one of those makes the ancestor the
/// containing block instead, and a dialog that thought it was centred on the
/// screen is centred on whatever element happens to enclose it.
///
/// That is not hypothetical here. The page-load reveal puts an animated
/// transform on the wrapper around every view, so every dialog in the
/// application was being positioned against a page several thousand pixels tall
/// — the backdrop still covered the screen, and the card sat far below the fold.
/// It looked like the dialog had failed to open.
///
/// Fixing the animation would fix it today and leave the trap in place for the
/// next transform anybody adds. A portal removes the class of bug: nothing an
/// ancestor does can reach a child that is not inside it.
///
/// Mounted first, because document does not exist while this renders on the
/// server. Returning null for that pass is correct rather than a workaround — a
/// dialog has nothing to contribute to the initial HTML.

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
