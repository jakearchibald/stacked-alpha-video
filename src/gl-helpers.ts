const fragmentShaderSource = `
precision mediump float;

// our textures
uniform sampler2D u_frame;

// data
uniform float u_premultipliedAlpha;

// the texCoords passed in from the vertex shader.
varying vec2 v_texCoord;

void main() {
  // Calculate the coordinates for the color and alpha
  vec2 colorCoord = vec2(v_texCoord.x, v_texCoord.y * 0.5);
  vec2 alphaCoord = vec2(v_texCoord.x, 0.5 + v_texCoord.y * 0.5);

  vec4 color = texture2D(u_frame, colorCoord);
  float alpha = texture2D(u_frame, alphaCoord).r;

  gl_FragColor = vec4(color.rgb * mix(alpha, 1.0, u_premultipliedAlpha), alpha);
}
`;

const vertexShaderSource = `
precision mediump float;
attribute vec2 a_position;
uniform mat3 u_matrix;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(u_matrix * vec3(a_position, 1), 1);

  // because we're using a unit quad we can just use
  // the same data for our texcoords.
  v_texCoord = a_position;
}
`;

function loadShader(gl: WebGLRenderingContext, source: string, type: GLenum) {
  const shader = gl.createShader(type);
  if (!shader) throw Error('Unable to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw Error(error || 'unknown error');
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext, shaders: WebGLShader[]) {
  const program = gl.createProgram();
  if (!program) throw Error('Unable to create program');
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw Error(error || 'unknown error');
  }

  return program;
}

const premultipliedAlphaLocations = new WeakMap();

/**
 * Get a GL context for a canvas.
 * This only needs to be done once per canvas.
 */
export function setupGLContext(canvas: HTMLCanvasElement | OffscreenCanvas) {
  const context = canvas.getContext('webgl', {
    antialias: false,
    powerPreference: 'low-power',
    depth: false,
    premultipliedAlpha: true,
  });

  if (!context) {
    throw Error("Couldn't create GL context");
  }

  const frag = loadShader(
    context,
    fragmentShaderSource,
    context.FRAGMENT_SHADER,
  );
  const vert = loadShader(context, vertexShaderSource, context.VERTEX_SHADER);
  const program = createProgram(context, [frag, vert]);
  context.useProgram(program);

  // look up where the vertex data needs to go.
  const positionLocation = context.getAttribLocation(program, 'a_position');

  // look up uniform locations
  const frameLoc = context.getUniformLocation(program, 'u_frame');
  context.uniform1i(frameLoc, 0); // texture unit 0
  const matrixLoc = context.getUniformLocation(program, 'u_matrix');

  premultipliedAlphaLocations.set(
    context,
    context.getUniformLocation(program, 'u_premultipliedAlpha'),
  );

  setPremultipliedAlpha(context, false);

  // provide texture coordinates for the rectangle.
  const positionBuffer = context.createBuffer();
  // prettier-ignore
  const rect = new Float32Array([
    0.0,  0.0,
    1.0,  0.0,
    0.0,  1.0,
    0.0,  1.0,
    1.0,  0.0,
    1.0,  1.0
  ]);

  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer);
  context.bufferData(context.ARRAY_BUFFER, rect, context.STATIC_DRAW);
  context.enableVertexAttribArray(positionLocation);
  context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);
  context.uniformMatrix3fv(matrixLoc, false, [2, 0, 0, 0, -2, 0, -1, 1, 1]);

  const texture = context.createTexture();
  context.bindTexture(context.TEXTURE_2D, texture);
  // Set the parameters so we can render any size image.
  context.texParameteri(
    context.TEXTURE_2D,
    context.TEXTURE_WRAP_S,
    context.CLAMP_TO_EDGE,
  );
  context.texParameteri(
    context.TEXTURE_2D,
    context.TEXTURE_WRAP_T,
    context.CLAMP_TO_EDGE,
  );
  context.texParameteri(
    context.TEXTURE_2D,
    context.TEXTURE_MIN_FILTER,
    context.NEAREST,
  );
  context.texParameteri(
    context.TEXTURE_2D,
    context.TEXTURE_MAG_FILTER,
    context.NEAREST,
  );

  return context;
}

/**
 * Set whether the source video uses premultiplied alpha.
 *
 * Set this to `true` if semi-transparent areas or outlines look too dark.
 */
export function setPremultipliedAlpha(
  context: WebGLRenderingContext,
  premultipliedAlpha: boolean,
): void {
  context.uniform1f(
    premultipliedAlphaLocations.get(context),
    premultipliedAlpha ? 1 : 0,
  );
}

/**
 * Draw a stacked-alpha video frame to a GL context.
 */
export function drawVideo(
  context: WebGLRenderingContext,
  video: HTMLVideoElement,
): void {
  const canvas = context.canvas;
  const width = video.videoWidth;
  const height = Math.floor(video.videoHeight / 2);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    context.viewport(0, 0, width, height);
  }

  context.texImage2D(
    context.TEXTURE_2D,
    0,
    context.RGBA,
    context.RGBA,
    context.UNSIGNED_BYTE,
    video,
  );

  context.drawArrays(context.TRIANGLES, 0, 6);
}
