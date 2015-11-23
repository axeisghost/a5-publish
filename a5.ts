///<reference path='./typings/tsd.d.ts'/>
///<reference path="./localTypings/webglutils.d.ts"/>

/*
 * Portions of this code are
 * Copyright 2015, Blair MacIntyre.
 * 
 * Portions of this code taken from http://webglfundamentals.org, at https://github.com/greggman/webgl-fundamentals
 * and are subject to the following license.  In particular, from 
 *    http://webglfundamentals.org/webgl/webgl-less-code-more-fun.html
 *    http://webglfundamentals.org/webgl/resources/primitives.js
 * 
 * Those portions Copyright 2014, Gregg Tavares.
 * All rights reserved.
 */

import loader = require('./loader');
var funcKeyPressed = undefined;
var keypressed = undefined;
var mouseclicked = undefined;
var leftBorder = 0.0625;
var rightBorder = 0.9383;
var blocks = 13;
var canvasSpacing = (rightBorder - leftBorder) / 13;
var letterTexture = [];
var maximumLetter = 14;
////////////////////////////////////////////////////////////////////////////////////////////
// stats module by mrdoob (https://github.com/mrdoob/stats.js) to show the performance 
// of your graphics

////////////////////////////////////////////////////////////////////////////////////////////
// utilities
var rand = function(min: number, max?: number) {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
};

var randInt = function(range) {
  return Math.floor(Math.random() * range);
};
var degToRad = function(d) {
  return d * Math.PI / 180;
}

var generateArrays = function(numsOfvertexInOneAxis: number) {
  var arrays = {
    position: { numComponents: 3, data: []},
    texcoord: { numComponents: 2, data: []},
    normal:   { numComponents: 3, data: []},
    indices:  { numComponents: 3, data: []},
  };
  for (var ii = 0; ii < numsOfvertexInOneAxis; ii++) {
    for (var jj = 0; jj < numsOfvertexInOneAxis; jj++) {
      arrays.position.data.push(jj * (10.0 / (numsOfvertexInOneAxis - 1)) - 5.0, ii * (10.0 / (numsOfvertexInOneAxis - 1)) - 5.0, 0);
      arrays.texcoord.data.push(jj * (1.0 / (numsOfvertexInOneAxis - 1)), ii * (1.0 / (numsOfvertexInOneAxis - 1)));
      arrays.normal.data.push(0, 0, -1);
      if ((ii != numsOfvertexInOneAxis - 1) && (jj != numsOfvertexInOneAxis - 1)) {
        arrays.indices.data.push(jj + ii * numsOfvertexInOneAxis, jj + ii * numsOfvertexInOneAxis + 1, jj + (ii + 1) * numsOfvertexInOneAxis);
        arrays.indices.data.push(jj + ii * numsOfvertexInOneAxis + 1, jj + (ii + 1) * numsOfvertexInOneAxis, jj + (ii + 1) * numsOfvertexInOneAxis + 1);
      }
    }
  }
  var trueTextcoord = [];
  for (var ii = 0; ii < arrays .texcoord.data.length / 2; ii++) {
    var tempentry = arrays .texcoord.data[ii];
    arrays .texcoord.data[ii] = arrays .texcoord.data[arrays .texcoord.data.length - ii - 1];
    arrays .texcoord.data[arrays .texcoord.data.length - ii - 1] = tempentry;
    
  }
  for (var ii = 0; ii < arrays .texcoord.data.length; ii+=2) {
    var tempentry = arrays .texcoord.data[ii];
    arrays .texcoord.data[ii] = arrays .texcoord.data[ii + 1];
    arrays .texcoord.data[ii + 1] = tempentry;
  }
  return arrays;
}
////////////////////////////////////////////////////////////////////////////////////////////
// get some of our canvas elements that we need
var canvas = <HTMLCanvasElement>document.getElementById("webgl");
var getPixelCanvas = <HTMLCanvasElement>document.getElementById("getPixel");
//var myctx = canvas.getContext("2d");
////////////////////////////////////////////////////////////////////////////////////////////
// some simple interaction using the mouse.
// we are going to get small motion offsets of the mouse, and use these to rotate the object
//
// our offset() function from assignment 0, to give us a good mouse position in the canvas 
function offset(e: MouseEvent): GLM.IArray {
    e = e || <MouseEvent> window.event;

    var target = <Element> e.target || e.srcElement,
        rect = target.getBoundingClientRect(),
        offsetX = e.clientX - rect.left,
        offsetY = e.clientY - rect.top;

    return vec2.fromValues(offsetX, offsetY);
}



// start things off with a down press
canvas.onmousedown = (ev: MouseEvent) => {
    mouseclicked = offset(ev);
}


document.onkeypress = (event: KeyboardEvent) => {
  var sound = new Howl({
    urls: ['sounds/type.wav']
  }).play();
  keypressed = event.keyCode;
  if (event.keyCode == 32) {
    event.preventDefault();
  }
}

document.onkeydown = (event: KeyboardEvent) => {
  if (event.keyCode == 8 || event.keyCode == 27) {
    funcKeyPressed = event.keyCode;
    event.preventDefault();
  }
}
////////////////////////////////////////////////////////////////////////////////////////////
// start things off by calling initWebGL
initWebGL();

function initWebGL() {
  // get the rendering context for webGL
  var gl: WebGLRenderingContext = getWebGLContext(canvas);
  if (!gl) {
    return;  // no webgl!  Bye bye
  }
  for (var ii = 0; ii < 90; ii++) {
    var myimg = new Image();
    letterTexture.push(myimg);
  }
  // turn on backface culling and zbuffering
  //gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  // attempt to download and set up our GLSL shaders.  When they download, processed to the next step
  // of our program, the "main" routing
  // 
  // YOU SHOULD MODIFY THIS TO DOWNLOAD ALL YOUR SHADERS and set up all four SHADER PROGRAMS,
  // THEN PASS AN ARRAY OF PROGRAMS TO main().  You'll have to do other things in main to deal
  // with multiple shaders and switch between them
  loader.loadFiles(['shaders/a3-shader.vert.c', 'shaders/a3-shader.frag.c',
                    'shaders/a3-shader-line.vert', 'shaders/a3-shader-line.frag'], function (shaderText) {
    var program = createProgramFromSources(gl, [shaderText[0], shaderText[1]]);
    var lineprogram = createProgramFromSources(gl, [shaderText[2], shaderText[3]]);
    for (var ii = 0; ii < 90; ii++) {
      var tempImg = new Image();
      tempImg.onload = (function(value) {
        return function() {
          letterTexture[value].src = this.src;
        }
      })(ii);
      var filename = "char" + (ii + 33).toString() + ".jpg";
      tempImg.src = "letterTexture/" + filename;
    }
    main(gl, program, lineprogram);
  }, function (url) {
      alert('Shader failed to download "' + url + '"');
  }); 
}

////////////////////////////////////////////////////////////////////////////////////////////
// webGL is set up, and our Shader program has been created.  Finish setting up our webGL application       
function main(gl: WebGLRenderingContext, program: WebGLProgram, lineprogram: WebGLProgram) {
  
  // use the webgl-utils library to create setters for all the uniforms and attributes in our shaders.
  // It enumerates all of the uniforms and attributes in the program, and creates utility functions to 
  // allow "setUniforms" and "setAttributes" (below) to set the shader variables from a javascript object. 
  // The objects have a key for each uniform or attribute, and a value containing the parameters for the
  // setter function
  var uniformSetters = createUniformSetters(gl, program);
  var attribSetters  = createAttributeSetters(gl, program);

  var arrays = generateArrays(2);
  var scaleFactor = 10;
  var center = vec4.fromValues(70 * scaleFactor,0,0,0);
  var lineArrays = {position: { numComponents: 3, data: [0, 1, 0, 0, -1, 0]},
                indices: {numComponents: 1, data: [0, 1]}};
  var bufferInfo = createBufferInfoFromArrays(gl, arrays);
  var lineBufferInfo = createBufferInfoFromArrays(gl, lineArrays);
  var cameraAngleRadians = degToRad(0);
  var fieldOfViewRadians = degToRad(60);
  var cameraHeight = 50;

  var uniformsThatAreTheSameForAllObjects = {
    u_lightWorldPos:         [0, 0, -200],
    u_viewInverse:           mat4.create(),
    u_lightColor:            [1, 1, 1, 1],
    u_ambient:               [0.1, 0.1, 0.1, 0.1]
  };

  var uniformsThatAreComputedForEachObject = {
    u_worldViewProjection:   mat4.create(),
    u_world:                 mat4.create(),
    u_worldInverseTranspose: mat4.create(),
  };
  
  var uniformsForLine = {
    u_worldViewProjection:   mat4.create(),
    u_colorMult: [0,0,0,1],
    u_centerx: vec4.create(),
    u_heightCut: 0.0
  }

  // var texture = .... create a texture of some form

  var baseColor = rand(240);
  var objectState = { 
      materialUniforms: {
        u_colorMult:             chroma.hsv(rand(baseColor, baseColor + 120), 0.5, 1).gl(),
        //u_diffuse:               texture,
        u_specular:              [0, 0, 0, 1],
        u_shininess:             10000,
        u_specularFactor:        0.75,
        u_moveToCenter:          undefined,
        u_heightPos:             undefined
      }
  };

  var letterParams = [];
  // for (var ii = 0; ii < letterParams.length; ii++) {
  //   letterParams[ii] = {
  //     //centerPos: -70 + ii * (140 / (letterParams.length - 1)),
  //     height: 50,
  //     u_colorMult: chroma.hsv(rand(baseColor, baseColor + 120), 0.5, 1).gl(),
  //     time: 0.0,
  //     rotationMatrix: mat4.create(),
  //     letterMod: undefined,
  //     renderOrNot: false
  //   };
  // }
  
  var count = 0;
  var beginning = 0;
  
  // some variables we'll reuse below
  var projectionMatrix = mat4.create();
  var viewMatrix = mat4.create();
  var rotationMatrix = mat4.create();
  var matrix = mat4.create();  // a scratch matrix
  var invMatrix = mat4.create();
  var axisVector = vec3.create();
  requestAnimationFrame(drawScene);
  
  var loaded = true;
  for (var ii = 0; ii < 90; ii++) {
    if (!letterTexture[ii].complete) {
      loaded = false;
    }
  }

  // Draw the scene.
  function drawScene(time: number) {
    // var ctx = canvas.getContext("2d");
    // ctx.rect(20,20,150,100);
    // ctx.fillStyle="red";
    // ctx.fill();
    time *= 0.001; 
   
    // measure time taken for the little stats meter

    // if the window changed size, reset the WebGL canvas size to match.  The displayed size of the canvas
    // (determined by window size, layout, and your CSS) is separate from the size of the WebGL render buffers, 
    // which you can control by setting canvas.width and canvas.height
    resizeCanvasToDisplaySize(canvas);

    // Set the viewport to match the canvas
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // Clear the canvas AND the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compute the projection matrix
    var aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(projectionMatrix,fieldOfViewRadians, aspect, 1, 3000);
    // projectionMatrix[15] = 1;
    // console.log(aspect);
    // mat4.ortho(projectionMatrix, -115, 115, -57, 57, 1, 2000);
    // console.log(projectionMatrix);
    // Compute the camera's matrix using look at.
    var cameraPosition = [0, 0, -800];
    var target = [0, 0, 0];
    var up = [0, 1, 0];
    var cameraMatrix = mat4.lookAt(uniformsThatAreTheSameForAllObjects.u_viewInverse, cameraPosition, target, up);

    // Make a view matrix from the camera matrix.
    mat4.invert(viewMatrix, cameraMatrix);
    
    // tell WebGL to use our shader program (will need to change this)
    gl.useProgram(program);
    uniformSetters = createUniformSetters(gl, program);
    attribSetters  = createAttributeSetters(gl, program);
    // Setup all the needed attributes and buffers.  
    setBuffersAndAttributes(gl, attribSetters, bufferInfo);

    // Set the uniforms that are the same for all objects.  Unlike the attributes, each uniform setter
    // is different, depending on the type of the uniform variable.  Look in webgl-util.js for the
    // implementation of  setUniforms to see the details for specific types       
    setUniforms(uniformSetters, uniformsThatAreTheSameForAllObjects);
   
    ///////////////////////////////////////////////////////
    // Compute the view matrix and corresponding other matrices for rendering.
    // first make a copy of our rotationMatrix
    // console.log(matrix);
    // console.log(rotationMatrix);
    //mat4.translate(matrix, matrix, [-center[0] * scaleFactor, -center[1] * scaleFactor, -center[2] * scaleFactor]);
    if (keypressed) {
      //beginning = beginning % letterParams.length;
        var adder = {
          height: rand(-300,300),
          u_colorMult: chroma.hsv(rand(baseColor, baseColor + 120), 0.5, 1).gl(),
          time: 0.0,
          rotationMatrixZ: mat4.create(),
          rotationMatrixY: mat4.create(),
          letterMod: undefined,
          renderOrNot: true,
          spinning: false,
          spinSpeed: 0.0,
          accel: 0.0,
          letterInd: keypressed,
          linetop: undefined
        }
        if (keypressed == 32) {
          adder.renderOrNot = false;
        } else {
          var rotateZAng = degToRad(rand(-15,15));
          adder.linetop = ((- adder.height * 0.4 + 320) - Math.cos(rotateZAng) * 36) / 640;
          var zAxis = vec3.transformMat4(axisVector, vec3.fromValues(0,0,1), mat4.create());
          mat4.rotate(adder.rotationMatrixZ, mat4.create(), rotateZAng, zAxis);
          
        }
        if (letterParams.length >= maximumLetter) {
          letterParams.shift();
        }
        letterParams.push(adder);
        blocks = Math.max(13, letterParams.length);
        canvasSpacing = (rightBorder - leftBorder) / blocks;
        keypressed = undefined;
    }
    if (funcKeyPressed) {
      if (funcKeyPressed == 27) {
        letterParams = [];
      } else if (funcKeyPressed == 8) {
        letterParams.pop();
      }
      funcKeyPressed = undefined;
    }
    // // Set the uniforms we just computed
    var spacing = 140 / Math.max(blocks, letterParams.length - 1);
    for (var ii = 0; ii < letterParams.length; ii++) {
      if (letterParams[ii].renderOrNot) {
        mat4.copy(matrix, letterParams[ii].rotationMatrixY);
        if (letterParams[ii].spinning) {
          if (letterParams[ii].time < 34.0) {
            letterParams[ii].time += 1.0;
            var yAxis = vec3.transformMat4(axisVector, vec3.fromValues(0,1,0), mat4.create());
            //mat4.invert(matrix, matrix);
            mat4.rotate(matrix, matrix, degToRad(letterParams[ii].spinSpeed), yAxis);
            letterParams[ii].spinSpeed = letterParams[ii].spinSpeed - letterParams[ii].accel;
          } else {
            letterParams[ii].time = 0.0;
            letterParams[ii].spinning = false;
            letterParams[ii].spinSpeed = 0.0;
            letterParams[ii].accel = 0.0;
            letterParams[ii].rotationMatrixY = mat4.create();
            matrix = mat4.create();
          }
        }
        mat4.copy(letterParams[ii].rotationMatrixY, matrix);
        // add a translate and scale to the object World xform, so we have:  R * T * S
        mat4.multiply(matrix, letterParams[ii].rotationMatrixY, letterParams[ii].rotationMatrixZ);
        //mat4.translate(matrix, rotationMatrix, [center[0] * scaleFactor, center[1] * scaleFactor, center[2] * scaleFactor]);
        mat4.scale(matrix, matrix, [scaleFactor, scaleFactor, scaleFactor]);
        mat4.copy(uniformsThatAreComputedForEachObject.u_world, matrix);
        
        // get proj * view * world
        mat4.multiply(matrix, viewMatrix, uniformsThatAreComputedForEachObject.u_world);
        mat4.multiply(uniformsThatAreComputedForEachObject.u_worldViewProjection, projectionMatrix, matrix);
        // get worldInvTranspose.  For an explaination of why we need this, for fixing the normals, see
        // http://www.unknownroad.com/rtfm/graphics/rt_normals.html
        mat4.transpose(uniformsThatAreComputedForEachObject.u_worldInverseTranspose, 
                      mat4.invert(matrix, uniformsThatAreComputedForEachObject.u_world));
        setUniforms(uniformSetters, uniformsThatAreComputedForEachObject);
      // Set the uniforms that are specific to the this object.
        objectState.materialUniforms.u_moveToCenter = vec4.fromValues(((-0.5 * spacing * (letterParams.length - 1)) + ii * spacing) * scaleFactor, 0, 0, 0);
        //console.log(objectState.materialUniforms.u_moveToCenter);
        objectState.materialUniforms.u_heightPos = vec4.fromValues(0, letterParams[ii].height, 0, 0);
        objectState.materialUniforms.u_colorMult = letterParams[ii].u_colorMult;
        setUniforms(uniformSetters, objectState.materialUniforms);
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
      
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, letterTexture[letterParams[ii].letterInd - 33]);
        // Draw the geometry.   Everything is keyed to the ""
        gl.drawElements(gl.TRIANGLES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
      }
    }
    if (mouseclicked) {
      if (canvas) {
        if (gl) {
          var clickedPoint = new Uint8Array(4);
          gl.readPixels(mouseclicked[0],gl.canvas.height - mouseclicked[1],1,1,gl.RGBA,gl.UNSIGNED_BYTE,clickedPoint);
          if (clickedPoint[0] != 0 || clickedPoint[1] != 0 || clickedPoint[2] != 0 || clickedPoint[3] != 0) {
            var clickedletter;
            var distToCen = Infinity;
            for (var ii = 0; ii < letterParams.length; ii++) {
              var centerOnCanvas = (0.5 - (letterParams.length - 1) * canvasSpacing / 2 + ii * canvasSpacing) * gl.canvas.width;
              if (Math.abs(centerOnCanvas - mouseclicked[0]) < distToCen) {
                distToCen = Math.abs(centerOnCanvas - mouseclicked[0]);
                clickedletter = ii;
              }
            }
            if (!letterParams[clickedletter].spinning) {
              letterParams[clickedletter].spinning = true;
              letterParams[clickedletter].time = 0.0;
              letterParams[clickedletter].accel = (Math.floor(distToCen / (canvasSpacing * 0.5 * canvas.width * 0.25)) + 1) * 360 * 2 / 36.0 / 36.0;
              letterParams[clickedletter].spinSpeed = letterParams[clickedletter].accel * 36.0;
              var sound = new Howl({
                urls: ['sounds/coins.wav']
              }).play();
            }
          }
        }
      }
      mouseclicked = undefined;
    }
    
    gl.useProgram(lineprogram);
    uniformSetters = createUniformSetters(gl, lineprogram);
    attribSetters  = createAttributeSetters(gl, lineprogram);
    for (var ii = 0; ii < letterParams.length; ii++) {
      if (letterParams[ii].renderOrNot) {
        var centerx = -((letterParams.length - 1) * canvasSpacing * 2 / 2) + ii * canvasSpacing * 2;
        uniformsForLine.u_centerx = vec4.fromValues(centerx, 0, 0, 0);
        uniformsForLine.u_heightCut = 1 - letterParams[ii].linetop * 2;
        setBuffersAndAttributes(gl, attribSetters, lineBufferInfo);
        setUniforms(uniformSetters, uniformsForLine);
        gl.lineWidth(1.0);
        gl.drawElements(gl.LINES, 2, gl.UNSIGNED_SHORT, 0);
      }
    }

    requestAnimationFrame(drawScene);
  }
}

