export function centerLyricLine(line: HTMLElement | null, behavior: ScrollBehavior): void {
  const container = line?.closest<HTMLElement>(".expanded-lyrics, #main");
  if (!line || !container) return;
  const bounds = line.getBoundingClientRect();
  container.scrollTo({
    top: Math.max(0, container.scrollTop + bounds.top - container.getBoundingClientRect().top - (container.clientHeight - bounds.height) / 2),
    behavior,
  });
}
