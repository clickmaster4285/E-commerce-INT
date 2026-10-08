"use client";

import { useEffect, useState } from "react";

export default function useScrollFade(scrollRef, contentKey) {
  const [fadeEdges, setFadeEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;

    let frameId = 0;
    const updateEdges = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        const left = element.scrollLeft > 2;
        const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 2;
        setFadeEdges((current) =>
          current.left === left && current.right === right
            ? current
            : { left, right },
        );
      });
    };

    updateEdges();
    element.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
      resizeObserver.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [scrollRef, contentKey]);

  return {
    fadeLeft: fadeEdges.left,
    fadeRight: fadeEdges.right,
    fadeClassName: `${fadeEdges.left ? "fade-left " : ""}${fadeEdges.right ? "fade-right" : ""}`.trim(),
  };
}
