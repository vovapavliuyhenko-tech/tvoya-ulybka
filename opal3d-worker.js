/* Фоновый поток: строит геометрию 3D-фигур, не блокируя страницу */
import { bakeArrays } from './opal3d-shapes.js';

self.onmessage = e => {
  const { name } = e.data;
  try {
    const { pos, nor } = bakeArrays(name);
    self.postMessage({ name, pos, nor }, [pos.buffer, nor.buffer]);
  } catch (err) {
    self.postMessage({ name, error: String(err) });
  }
};
