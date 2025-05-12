// pages/_app.js
import '../styles/global.css';  // Pfad relativ zu _app.js

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}