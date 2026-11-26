/*
  Where an element sits, in the units a position:fixed popup is placed in.

  The app zooms the whole page through `document.documentElement.style.zoom`
  (ZoomProvider). Under CSS zoom, getBoundingClientRect reports ZOOMED pixels,
  while top/left/right on a fixed element inside the zoomed root are scaled by
  the zoom again — so a popup placed straight from the rect lands too far by
  the zoom factor. Dividing by the zoom puts both in the same units.

  vw/vh are the viewport in those units too, for "right" anchoring and for
  keeping a popup inside the screen.
*/
export const pageZoom = () => {
  if (typeof document === "undefined") return 1;
  const z = parseFloat(getComputedStyle(document.documentElement).zoom);
  return Number.isFinite(z) && z > 0 ? z : 1;
};

export const anchorRect = (el) => {
  const z = pageZoom();
  const r = el.getBoundingClientRect();
  return {
    top: r.top / z,
    bottom: r.bottom / z,
    left: r.left / z,
    right: r.right / z,
    width: r.width / z,
    height: r.height / z,
    vw: window.innerWidth / z,
    vh: window.innerHeight / z,
  };
};
