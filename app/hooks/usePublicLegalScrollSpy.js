import { useEffect, useState } from "react";

export function usePublicLegalScrollSpy(sectionIds, { rootMargin = "-20% 0px -65% 0px" } = {}) {
  const [activeId, setActiveId] = useState(sectionIds[0] || "");

  useEffect(() => {
    if (typeof window === "undefined" || !sectionIds.length) return undefined;

    const visible = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        });

        if (!visible.size) return;

        const nextActive = [...visible.entries()].sort((left, right) => {
          const leftIndex = sectionIds.indexOf(left[0]);
          const rightIndex = sectionIds.indexOf(right[0]);
          if (left[1] !== right[1]) return right[1] - left[1];
          return leftIndex - rightIndex;
        })[0]?.[0];

        if (nextActive) setActiveId(nextActive);
      },
      { rootMargin, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [rootMargin, sectionIds]);

  return activeId;
}
