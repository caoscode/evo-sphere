export interface Camera {
  x: number; // world-space center
  y: number;
  zoom: number; // pixels per world unit
  minZoom: number;
  maxZoom: number;
}

export function createCamera(): Camera {
  return {
    x: 0,
    y: 0,
    zoom: 0.8,
    minZoom: 0.05,
    maxZoom: 10,
  };
}

export function screenToWorld(
  cam: Camera,
  sx: number,
  sy: number,
  viewW: number,
  viewH: number,
): { x: number; y: number } {
  return {
    x: (sx - viewW / 2) / cam.zoom + cam.x,
    y: (sy - viewH / 2) / cam.zoom + cam.y,
  };
}

export function getVisibleBounds(
  cam: Camera,
  viewW: number,
  viewH: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const halfW = viewW / 2 / cam.zoom;
  const halfH = viewH / 2 / cam.zoom;
  return {
    minX: cam.x - halfW,
    minY: cam.y - halfH,
    maxX: cam.x + halfW,
    maxY: cam.y + halfH,
  };
}

export function panCamera(cam: Camera, dxScreen: number, dyScreen: number): void {
  cam.x -= dxScreen / cam.zoom;
  cam.y -= dyScreen / cam.zoom;
}

export function zoomCamera(
  cam: Camera,
  factor: number,
  focusScreenX: number,
  focusScreenY: number,
  viewW: number,
  viewH: number,
): void {
  // World point under cursor before zoom
  const wx = (focusScreenX - viewW / 2) / cam.zoom + cam.x;
  const wy = (focusScreenY - viewH / 2) / cam.zoom + cam.y;

  cam.zoom = Math.max(cam.minZoom, Math.min(cam.maxZoom, cam.zoom * factor));

  // Adjust camera so world point stays under cursor
  cam.x = wx - (focusScreenX - viewW / 2) / cam.zoom;
  cam.y = wy - (focusScreenY - viewH / 2) / cam.zoom;
}
