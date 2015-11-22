uniform mat4 u_worldViewProjection;
uniform vec3 u_lightWorldPos;
uniform mat4 u_world;
uniform mat4 u_viewInverse;
uniform mat4 u_worldInverseTranspose;
uniform vec4 u_moveToCenter;
uniform vec4 u_heightPos;

attribute vec4 a_position;
attribute vec3 a_normal;
attribute vec2 a_texcoord;

varying vec4 v_position;
varying vec3 v_normal;
varying vec3 v_surfaceToLight;
varying vec3 v_surfaceToView;
varying vec2 v_texCoord;

void main() {
  v_texCoord = a_texcoord;
  v_position = (u_worldViewProjection * (a_position)) + u_moveToCenter + u_heightPos;
  v_normal = (u_worldInverseTranspose * vec4(a_normal, 0)).xyz;
  v_surfaceToLight = u_lightWorldPos - (u_world * a_position + u_moveToCenter + u_heightPos).xyz;
  v_surfaceToView = (u_viewInverse[3] - (u_world * a_position + u_moveToCenter + u_heightPos)).xyz;
  gl_Position = v_position;
}