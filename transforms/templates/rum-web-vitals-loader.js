// use classic script to avoid CORS issues
const script = document.createElement('script');
script.src = 'https://rum.hlx.page/.rum/web-vitals/dist/web-vitals.iife.js';
script.onload = () => {
  const storeCWV = (measurement) => {
    data.cwv = {};
    data.cwv[measurement.name] = measurement.value;
    sendPing();
  };
  // When loading `web-vitals` using a classic script, all the public
  // methods can be found on the `webVitals` global namespace.
  window.webVitals.getCLS(storeCWV);
  window.webVitals.getFID(storeCWV);
  window.webVitals.getLCP(storeCWV);
};
document.head.appendChild(script);