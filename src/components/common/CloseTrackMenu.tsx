export function CloseTrackMenu() {
  return <button type="button" className="mobile-actions-close" onClick={event => {
    const menu = event.currentTarget.closest("details");
    if (menu) menu.open = false;
  }}>Done</button>;
}
