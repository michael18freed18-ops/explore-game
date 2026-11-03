// @ts-nocheck
import { buildChunkGeometry } from "./chunkData.js";

self.onmessage = (e) => {
  const { id, cx, cz, seg, token } = e.data;
  const g = buildChunkGeometry(cx, cz, seg);
  self.postMessage(
    {
      id,
      cx,
      cz,
      token,
      positions: g.positions,
      colors: g.colors,
      indices: g.indices,
      props: g.props,
    },
    { transfer: [g.positions.buffer, g.colors.buffer, g.indices.buffer, g.props.buffer] },
  );
};
