import ReactDOM from "react-dom/client";
const root = ReactDOM.createRoot(document.getElementById("root")!);
if (new URLSearchParams(location.search).get('overlay') === 'lyrics') {
  void Promise.all([import('./components/lyrics/FloatingLyrics'), import('./theme')]).then(([{ FloatingLyrics }, { initializeTheme }]) => {
    initializeTheme();
    root.render(<FloatingLyrics />);
  });
} else {
  void Promise.all([import('./App'), import('./theme'), import('./style.css')]).then(([{ App }, { initializeTheme }]) => {
    initializeTheme();
    root.render(<App />);
  });
}
