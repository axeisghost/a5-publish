precision mediump float;

varying vec4 v_position;
uniform float u_heightCut;
uniform vec4 u_colorMult;

void main() {
  if (v_position.y < u_heightCut) {
    discard;
  }
  gl_FragColor = u_colorMult;
}
