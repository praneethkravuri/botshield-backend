import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

export function findInformationScrollRoot(element) {
  for (
    let parent = element?.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    if (parent === document.body || parent === document.documentElement)
      return null;
    if (/(auto|scroll|overlay)/.test(window.getComputedStyle(parent).overflowY))
      return parent;
  }
  return null;
}

export function useEmbeddedInformationNavigation(sections, contentRef) {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(sections[0]?.id || "");
  const requestedId = useRef("");

  const revealSection = useCallback(
    (id) => {
      if (!sections.some((section) => section.id === id)) return;
      const section = contentRef.current?.querySelector(`[id="${id}"]`);
      if (!section) return;
      requestedId.current = id;
      setActiveId(id);
      const heading = section.querySelector("h2");
      heading?.setAttribute("tabindex", "-1");
      heading?.focus({ preventScroll: true });
      section.scrollIntoView({
        block: "start",
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
          .matches
          ? "instant"
          : "smooth",
      });
    },
    [contentRef, sections],
  );

  useEffect(() => {
    revealSection(hash.slice(1));
  }, [hash, revealSection]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const root = findInformationScrollRoot(contentRef.current);
    const visible = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        // Short sections near the end cannot always align with the viewport's
        // top. Keep an explicitly selected, visible section current until the
        // merchant resumes scrolling, rather than highlighting its predecessor.
        if (visible.has(requestedId.current)) setActiveId(requestedId.current);
        else {
          const firstVisible = sections.find(({ id }) => visible.has(id));
          if (firstVisible) setActiveId(firstVisible.id);
        }
      },
      { root, rootMargin: "-24px 0px 0px", threshold: [0, 0.1, 0.5, 1] },
    );

    sections.forEach(({ id }) => {
      const target = contentRef.current?.querySelector(`[id="${id}"]`);
      if (target) observer.observe(target);
    });
    const scrollTarget = root || window;
    const resumeTracking = () => {
      requestedId.current = "";
    };
    const resumeOnKey = (event) => {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        resumeTracking();
    };
    // Interaction listeners only: no per-frame scroll handlers or polling.
    scrollTarget.addEventListener("wheel", resumeTracking, { passive: true });
    scrollTarget.addEventListener("touchstart", resumeTracking, {
      passive: true,
    });
    scrollTarget.addEventListener("keydown", resumeOnKey);
    return () => {
      observer.disconnect();
      scrollTarget.removeEventListener("wheel", resumeTracking);
      scrollTarget.removeEventListener("touchstart", resumeTracking);
      scrollTarget.removeEventListener("keydown", resumeOnKey);
    };
  }, [contentRef, sections]);

  const selectSection = useCallback(
    (event, id) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      // Keep the router state and Shopify parameters without adding a history
      // entry for each section the merchant reads.
      if (hash !== `#${id}`)
        navigate(
          { pathname, search, hash: `#${id}` },
          { replace: true, preventScrollReset: true },
        );
      else revealSection(id);
      const menu = event.currentTarget.closest("details");
      if (menu) menu.open = false;
    },
    [hash, navigate, pathname, revealSection, search],
  );

  return { activeId, selectSection };
}
