const GOOGLE_MAPS_API_KEY = "AIzaSyD2_5rM437hdvl22M0akhWj20oohLwnB8g";

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if (loadPromise) return loadPromise;

  if ((window as any).google?.maps) {
    loadPromise = Promise.resolve();
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export { GOOGLE_MAPS_API_KEY };
