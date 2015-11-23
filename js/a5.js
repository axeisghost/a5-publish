///<reference path='./typings/tsd.d.ts'/>
///<reference path="./localTypings/webglutils.d.ts"/>
define(["require", "exports", './loader'], function (require, exports, loader) {
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
    var rand = function (min, max) {
        if (max === undefined) {
            max = min;
            min = 0;
        }
        return min + Math.random() * (max - min);
    };
    var randInt = function (range) {
        return Math.floor(Math.random() * range);
    };
    var degToRad = function (d) {
        return d * Math.PI / 180;
    };
    var generateArrays = function (numsOfvertexInOneAxis) {
        var arrays = {
            position: { numComponents: 3, data: [] },
            texcoord: { numComponents: 2, data: [] },
            normal: { numComponents: 3, data: [] },
            indices: { numComponents: 3, data: [] },
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
        for (var ii = 0; ii < arrays.texcoord.data.length / 2; ii++) {
            var tempentry = arrays.texcoord.data[ii];
            arrays.texcoord.data[ii] = arrays.texcoord.data[arrays.texcoord.data.length - ii - 1];
            arrays.texcoord.data[arrays.texcoord.data.length - ii - 1] = tempentry;
        }
        for (var ii = 0; ii < arrays.texcoord.data.length; ii += 2) {
            var tempentry = arrays.texcoord.data[ii];
            arrays.texcoord.data[ii] = arrays.texcoord.data[ii + 1];
            arrays.texcoord.data[ii + 1] = tempentry;
        }
        return arrays;
    };
    ////////////////////////////////////////////////////////////////////////////////////////////
    // get some of our canvas elements that we need
    var canvas = document.getElementById("webgl");
    var getPixelCanvas = document.getElementById("getPixel");
    //var myctx = canvas.getContext("2d");
    ////////////////////////////////////////////////////////////////////////////////////////////
    // some simple interaction using the mouse.
    // we are going to get small motion offsets of the mouse, and use these to rotate the object
    //
    // our offset() function from assignment 0, to give us a good mouse position in the canvas 
    function offset(e) {
        e = e || window.event;
        var target = e.target || e.srcElement, rect = target.getBoundingClientRect(), offsetX = e.clientX - rect.left, offsetY = e.clientY - rect.top;
        return vec2.fromValues(offsetX, offsetY);
    }
    // start things off with a down press
    canvas.onmousedown = function (ev) {
        mouseclicked = offset(ev);
    };
    document.onkeypress = function (event) {
        var sound = new Howl({
            urls: ['sounds/type.wav']
        }).play();
        keypressed = event.keyCode;
        if (event.keyCode == 32) {
            event.preventDefault();
        }
    };
    document.onkeydown = function (event) {
        if (event.keyCode == 8 || event.keyCode == 27) {
            funcKeyPressed = event.keyCode;
            event.preventDefault();
        }
    };
    ////////////////////////////////////////////////////////////////////////////////////////////
    // start things off by calling initWebGL
    initWebGL();
    function initWebGL() {
        // get the rendering context for webGL
        var gl = getWebGLContext(canvas);
        if (!gl) {
            return; // no webgl!  Bye bye
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
                tempImg.onload = (function (value) {
                    return function () {
                        letterTexture[value].src = this.src;
                    };
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
    function main(gl, program, lineprogram) {
        // use the webgl-utils library to create setters for all the uniforms and attributes in our shaders.
        // It enumerates all of the uniforms and attributes in the program, and creates utility functions to 
        // allow "setUniforms" and "setAttributes" (below) to set the shader variables from a javascript object. 
        // The objects have a key for each uniform or attribute, and a value containing the parameters for the
        // setter function
        var uniformSetters = createUniformSetters(gl, program);
        var attribSetters = createAttributeSetters(gl, program);
        var arrays = generateArrays(2);
        var scaleFactor = 10;
        var center = vec4.fromValues(70 * scaleFactor, 0, 0, 0);
        var lineArrays = { position: { numComponents: 3, data: [0, 1, 0, 0, -1, 0] },
            indices: { numComponents: 1, data: [0, 1] } };
        var bufferInfo = createBufferInfoFromArrays(gl, arrays);
        var lineBufferInfo = createBufferInfoFromArrays(gl, lineArrays);
        var cameraAngleRadians = degToRad(0);
        var fieldOfViewRadians = degToRad(60);
        var cameraHeight = 50;
        var uniformsThatAreTheSameForAllObjects = {
            u_lightWorldPos: [0, 0, -200],
            u_viewInverse: mat4.create(),
            u_lightColor: [1, 1, 1, 1],
            u_ambient: [0.1, 0.1, 0.1, 0.1]
        };
        var uniformsThatAreComputedForEachObject = {
            u_worldViewProjection: mat4.create(),
            u_world: mat4.create(),
            u_worldInverseTranspose: mat4.create(),
        };
        var uniformsForLine = {
            u_worldViewProjection: mat4.create(),
            u_colorMult: [0, 0, 0, 1],
            u_centerx: vec4.create(),
            u_heightCut: 0.0
        };
        // var texture = .... create a texture of some form
        var baseColor = rand(240);
        var objectState = {
            materialUniforms: {
                u_colorMult: chroma.hsv(rand(baseColor, baseColor + 120), 0.5, 1).gl(),
                //u_diffuse:               texture,
                u_specular: [0, 0, 0, 1],
                u_shininess: 10000,
                u_specularFactor: 0.75,
                u_moveToCenter: undefined,
                u_heightPos: undefined
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
        var matrix = mat4.create(); // a scratch matrix
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
        function drawScene(time) {
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
            mat4.perspective(projectionMatrix, fieldOfViewRadians, aspect, 1, 3000);
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
            attribSetters = createAttributeSetters(gl, program);
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
                    height: rand(-300, 300),
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
                };
                if (keypressed == 32) {
                    adder.renderOrNot = false;
                }
                else {
                    var rotateZAng = degToRad(rand(-15, 15));
                    adder.linetop = ((-adder.height * 0.4 + 320) - Math.cos(rotateZAng) * 36) / 640;
                    var zAxis = vec3.transformMat4(axisVector, vec3.fromValues(0, 0, 1), mat4.create());
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
                }
                else if (funcKeyPressed == 8) {
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
                            var yAxis = vec3.transformMat4(axisVector, vec3.fromValues(0, 1, 0), mat4.create());
                            //mat4.invert(matrix, matrix);
                            mat4.rotate(matrix, matrix, degToRad(letterParams[ii].spinSpeed), yAxis);
                            letterParams[ii].spinSpeed = letterParams[ii].spinSpeed - letterParams[ii].accel;
                        }
                        else {
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
                    mat4.transpose(uniformsThatAreComputedForEachObject.u_worldInverseTranspose, mat4.invert(matrix, uniformsThatAreComputedForEachObject.u_world));
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
                        gl.readPixels(mouseclicked[0], gl.canvas.height - mouseclicked[1], 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, clickedPoint);
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
            attribSetters = createAttributeSetters(gl, lineprogram);
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
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImE1LnRzIl0sIm5hbWVzIjpbIm9mZnNldCIsImluaXRXZWJHTCIsIm1haW4iLCJtYWluLmRyYXdTY2VuZSJdLCJtYXBwaW5ncyI6IkFBQUEseUNBQXlDO0FBQ3pDLHFEQUFxRDs7SUFnQnJELElBQUksY0FBYyxHQUFHLFNBQVMsQ0FBQztJQUMvQixJQUFJLFVBQVUsR0FBRyxTQUFTLENBQUM7SUFDM0IsSUFBSSxZQUFZLEdBQUcsU0FBUyxDQUFDO0lBQzdCLElBQUksVUFBVSxHQUFHLE1BQU0sQ0FBQztJQUN4QixJQUFJLFdBQVcsR0FBRyxNQUFNLENBQUM7SUFDekIsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO0lBQ2hCLElBQUksYUFBYSxHQUFHLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNwRCxJQUFJLGFBQWEsR0FBRyxFQUFFLENBQUM7SUFDdkIsSUFBSSxhQUFhLEdBQUcsRUFBRSxDQUFDO0lBQ3ZCLDRGQUE0RjtJQUM1Rix1RkFBdUY7SUFDdkYsbUJBQW1CO0lBRW5CLDRGQUE0RjtJQUM1RixZQUFZO0lBQ1osSUFBSSxJQUFJLEdBQUcsVUFBUyxHQUFXLEVBQUUsR0FBWTtRQUMzQyxFQUFFLENBQUMsQ0FBQyxHQUFHLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQztZQUN0QixHQUFHLEdBQUcsR0FBRyxDQUFDO1lBQ1YsR0FBRyxHQUFHLENBQUMsQ0FBQztRQUNWLENBQUM7UUFDRCxNQUFNLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQztJQUMzQyxDQUFDLENBQUM7SUFFRixJQUFJLE9BQU8sR0FBRyxVQUFTLEtBQUs7UUFDMUIsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDO0lBQzNDLENBQUMsQ0FBQztJQUNGLElBQUksUUFBUSxHQUFHLFVBQVMsQ0FBQztR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QSxJQUFJQSxDQUFDQSxDQUFDQSxDQUFDQTs0QkFDakNBLFlBQVlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLElBQUlBLElBQUlBLEdBQUdBLENBQUNBOzRCQUM3QkEsSUFBSUEsS0FBS0EsR0FBR0EsSUFBSUEsQ0FBQ0EsYUFBYUEsQ0FBQ0EsVUFBVUEsRUFBRUEsSUFBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsQ0FBQ0EsRUFBQ0EsQ0FBQ0EsRUFBQ0EsQ0FBQ0EsQ0FBQ0EsRUFBRUEsSUFBSUEsQ0FBQ0EsTUFBTUEsRUFBRUEsQ0FBQ0EsQ0FBQ0E7NEJBQ2xGQSw4QkFBOEJBOzRCQUM5QkEsSUFBSUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsTUFBTUEsRUFBRUEsTUFBTUEsRUFBRUEsUUFBUUEsQ0FBQ0EsWUFBWUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsU0FBU0EsQ0FBQ0EsRUFBRUEsS0FBS0EsQ0FBQ0EsQ0FBQ0E7NEJBQ3pFQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxTQUFTQSxHQUFHQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxTQUFTQSxHQUFHQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxLQUFLQSxDQUFDQTt3QkFDbkZBLENBQUNBO3dCQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTs0QkFDTkEsWUFBWUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsSUFBSUEsR0FBR0EsR0FBR0EsQ0FBQ0E7NEJBQzVCQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxRQUFRQSxHQUFHQSxLQUFLQSxDQUFDQTs0QkFDbENBLFlBQVlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLEdBQUdBLEdBQUdBLENBQUNBOzRCQUNqQ0EsWUFBWUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsS0FBS0EsR0FBR0EsR0FBR0EsQ0FBQ0E7NEJBQzdCQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxlQUFlQSxHQUFHQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQSxDQUFD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RUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsWUFBWUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsRUFBQ0EsRUFBRUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsTUFBTUEsR0FBR0EsWUFBWUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsRUFBQ0EsQ0FBQ0EsRUFBQ0EsQ0FBQ0EsRUFBQ0EsRUFBRUEsQ0FBQ0EsSUFBSUEsRUFBQ0EsRUFBRUEsQ0FBQ0EsYUFBYUEsRUFBQ0EsWUFBWUEsQ0FBQ0EsQ0FBQ0E7d0JBQzVHQSxFQUFFQSxDQUFDQSxDQUFDQSxZQUFZQSxDQUFDQSxDQUFDQSxDQUFDQSxJQUFJQSxDQUFDQSxJQUFJQSxZQUFZQSxDQUFDQSxDQUFDQSxDQUFDQSxJQUFJQSxDQUFDQSxJQUFJQSxZQUFZQSxDQUFDQSxDQUFDQSxDQUFDQSxJQUFJQSxDQUFDQSxJQUFJQSxZQUFZQSxDQUFDQSxDQUFDQSxDQUFDQSxJQUFJQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTs0QkFDakdBLElBQUlBLGFBQWFBLENBQUNBOzRCQUNsQkEsSUFBSUEsU0FBU0EsR0FBR0EsUUFBUUEsQ0FBQ0E7NEJBQ3pCQSxHQUFHQSxDQUFDQSxDQUFDQSxHQUFHQSxDQUFDQSxFQUFFQSxHQUFHQSxDQUFDQSxFQUFFQSxFQUFFQSxHQUFHQSxZQUFZQSxDQUFDQSxNQUFNQSxFQUFFQSxFQUFFQSxFQUFFQSxFQUFFQSxDQUFDQTtnQ0FDaERBLElBQUlBLGNBQWNBLEdBQUdBLENBQUNBLEdBQUdBLEdBQUdBLENBQUNBLFlBQVlBLENBQUNBLE1BQU1BLEdBQUdBLENBQUNBLENBQUNBLEdBQUdBLGFBQWFBLEdBQUdBLENBQUNBLEdBQUdBLEVBQUVBLEdBQUdBLGFBQWFBLENBQUNBLEdBQUdBLEVBQUVBLENBQUNBLE1BQU1BLENBQUNBLEtBQUtBLENBQUNBO2dDQUNsSEEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsSUFBSUEsQ0FBQ0EsR0FBR0EsQ0FBQ0EsY0FBY0EsR0FBR0EsWUFBWUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsR0FBR0EsU0FBU0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7b0NBQzNEQSxTQUFTQSxHQUFHQSxJQUFJQSxDQUFDQSxHQUFHQSxDQUFDQSxjQUFjQSxHQUFHQSxZQUFZQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQTtvQ0FDdkRBLGFBQWFBLEdBQUdBLEVBQUVBLENBQUNBO2dDQUNyQkEsQ0FBQ0E7NEJBQ0hBLENBQUNBOzRCQUNEQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQSxZQUFZQSxDQUFDQSxhQUFhQSxDQUFDQSxDQUFDQSxRQUFRQSxDQUFDQSxDQUFDQSxDQUFDQTtnQ0FDMUNBLFlBQVlBLENBQUNBLGFBQWFBLENBQUNBLENBQUNBLFFBQVFBLEdBQUdBLElBQUlBLENBQUNBO2dDQUM1Q0EsWUFBWUEsQ0FBQ0EsYUFBYUEsQ0FBQ0EsQ0FBQ0EsSUFBSUEsR0FBR0EsR0FBR0EsQ0FBQ0E7Z0NBQ3ZDQSxZQUFZQSxDQUFDQSxhQUFhQSxDQUFDQSxDQUFDQSxLQUFLQSxHQUFHQSxDQUFDQSxJQUFJQSxDQUFDQSxLQUFLQSxDQUFDQSxTQUFTQSxHQUFHQSxDQUFDQSxhQUFhQSxHQUFHQSxHQUFHQSxHQUFHQSxNQUFNQSxDQUFDQSxLQUFLQSxHQUFHQSxJQUFJQSxDQUFDQSxDQUFDQSxHQUFHQSxDQUFDQSxDQUFDQSxHQUFHQSxHQUFHQSxHQUFHQSxDQUFDQSxHQUFHQSxJQUFJQSxHQUFHQSxJQUFJQSxDQUFDQTtnQ0FDdElBLFlBQVlBLENBQUNBLGFBQWFBLENBQUNBLENBQUNBLFNBQVNBLEdBQUdBLFlBQVlBLENBQUNBLGFBQWFBLENBQUNBLENBQUNBLEtBQUtBLEdBQUdBLElBQUlBLENBQUNBO2dDQUNqRkEsSUFBSUEsS0FBS0EsR0FBR0EsSUFBSUEsSUFBSUEsQ0FBQ0E7b0NBQ25CQSxJQUFJQSxFQUFFQSxDQUFDQSxrQkFBa0JBLENBQUNBO2lDQUMzQkEsQ0FBQ0EsQ0FBQ0EsSUFBSUEsRUFBRUEsQ0FBQ0E7NEJBQ1pBLENBQUNBO3dCQUNIQSxDQUFDQTtvQkFDSEEsQ0FBQ0E7Z0JBQ0hBLENBQUNBO2dCQUNEQSxZQUFZQSxHQUFHQSxTQUFTQSxDQUFDQTtZQUMzQkEsQ0FBQ0E7WUFFREEsRUFBRUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsV0FBV0EsQ0FBQ0EsQ0FBQ0E7WUFDM0JBLGNBQWNBLEdBQUdBLG9CQUFvQkEsQ0FBQ0EsRUFBRUEsRUFBRUEsV0FBV0EsQ0FBQ0EsQ0FBQ0E7WUFDdkRBLGFBQWFBLEdBQUlBLHNCQUFzQkEsQ0FBQ0EsRUFBRUEsRUFBRUEsV0FBV0EsQ0FBQ0EsQ0FBQ0E7WUFDekRBLEdBQUdBLENBQUNBLENBQUNBLEdBQUdBLENBQUNBLEVBQUVBLEdBQUdBLENBQUNBLEVBQUVBLEVBQUVBLEdBQUdBLFlBQVlBLENBQUNBLE1BQU1BLEVBQUVBLEVBQUVBLEVBQUVBLEVBQUVBLENBQUNBO2dCQUNoREEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsWUFBWUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsV0FBV0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7b0JBQ2pDQSxJQUFJQSxPQUFPQSxHQUFHQSxDQUFDQSxDQUFDQSxDQUFDQSxZQUFZQSxDQUFDQSxNQUFNQSxHQUFHQSxDQUFDQSxDQUFDQSxHQUFHQSxhQUFhQSxHQUFHQSxDQUFDQSxHQUFHQSxDQUFDQSxDQUFDQSxHQUFHQSxFQUFFQSxHQUFHQSxhQUFhQSxHQUFHQSxDQUFDQSxDQUFDQTtvQkFDNUZBLGVBQWVBLENBQUNBLFNBQVNBLEdBQUdBLElBQUlBLENBQUNBLFVBQVVBLENBQUNBLE9BQU9BLEVBQUVBLENBQUNBLEVBQUVBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBO29CQUM5REEsZUFBZUEsQ0FBQ0EsV0FBV0EsR0FBR0EsQ0FBQ0EsR0FBR0EsWUFBWUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsT0FBT0EsR0FBR0EsQ0FBQ0EsQ0FBQ0E7b0JBQy9EQSx1QkFBdUJBLENBQUNBLEVBQUVBLEVBQUVBLGFBQWFBLEVBQUVBLGNBQWNBLENBQUNBLENBQUNBO29CQUMzREEsV0FBV0EsQ0FBQ0EsY0FBY0EsRUFBRUEsZUFBZUEsQ0FBQ0EsQ0FBQ0E7b0JBQzdDQSxFQUFFQSxDQUFDQSxTQUFTQSxDQUFDQSxHQUFHQSxDQUFDQSxDQUFDQTtvQkFDbEJBLEVBQUVBLENBQUNBLFlBQVlBLENBQUNBLEVBQUVBLENBQUNBLEtBQUtBLEVBQUVBLENBQUNBLEVBQUVBLEVBQUVBLENBQUNBLGNBQWNBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBO2dCQUNyREEsQ0FBQ0E7WUFDSEEsQ0FBQ0E7WUFFREEscUJBQXFCQSxDQUFDQSxTQUFTQSxDQUFDQSxDQUFDQTtRQUNuQ0EsQ0FBQ0E7SUFDSEQsQ0FBQ0EiLCJmaWxlIjoiYTUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy88cmVmZXJlbmNlIHBhdGg9Jy4vdHlwaW5ncy90c2QuZC50cycvPlxuLy8vPHJlZmVyZW5jZSBwYXRoPVwiLi9sb2NhbFR5cGluZ3Mvd2ViZ2x1dGlscy5kLnRzXCIvPlxuXG4vKlxuICogUG9ydGlvbnMgb2YgdGhpcyBjb2RlIGFyZVxuICogQ29weXJpZ2h0IDIwMTUsIEJsYWlyIE1hY0ludHlyZS5cbiAqIFxuICogUG9ydGlvbnMgb2YgdGhpcyBjb2RlIHRha2VuIGZyb20gaHR0cDovL3dlYmdsZnVuZGFtZW50YWxzLm9yZywgYXQgaHR0cHM6Ly9naXRodWIuY29tL2dyZWdnbWFuL3dlYmdsLWZ1bmRhbWVudGFsc1xuICogYW5kIGFyZSBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgbGljZW5zZS4gIEluIHBhcnRpY3VsYXIsIGZyb20gXG4gKiAgICBodHRwOi8vd2ViZ2xmdW5kYW1lbnRhbHMub3JnL3dlYmdsL3dlYmdsLWxlc3MtY29kZS1tb3JlLWZ1bi5odG1sXG4gKiAgICBodHRwOi8vd2ViZ2xmdW5kYW1lbnRhbHMub3JnL3dlYmdsL3Jlc291cmNlcy9wcmltaXRpdmVzLmpzXG4gKiBcbiAqIFRob3NlIHBvcnRpb25zIENvcHlyaWdodCAyMDE0LCBHcmVnZyBUYXZhcmVzLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqL1xuXG5pbXBvcnQgbG9hZGVyID0gcmVxdWlyZSgnLi9sb2FkZXInKTtcbnZhciBmdW5jS2V5UHJlc3NlZCA9IHVuZGVmaW5lZDtcbnZhciBrZXlwcmVzc2VkID0gdW5kZWZpbmVkO1xudmFyIG1vdXNlY2xpY2tlZCA9IHVuZGVmaW5lZDtcbnZhciBsZWZ0Qm9yZGVyID0gMC4wNjI1O1xudmFyIHJpZ2h0Qm9yZGVyID0gMC45MzgzO1xudmFyIGJsb2NrcyA9IDEzO1xudmFyIGNhbnZhc1NwYWNpbmcgPSAocmlnaHRCb3JkZXIgLSBsZWZ0Qm9yZGVyKSAvIDEzO1xudmFyIGxldHRlclRleHR1cmUgPSBbXTtcbnZhciBtYXhpbXVtTGV0dGVyID0gMTQ7XG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gc3RhdHMgbW9kdWxlIGJ5IG1yZG9vYiAoaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi9zdGF0cy5qcykgdG8gc2hvdyB0aGUgcGVyZm9ybWFuY2UgXG4vLyBvZiB5b3VyIGdyYXBoaWNzXG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyB1dGlsaXRpZXNcbnZhciByYW5kID0gZnVuY3Rpb24obWluOiBudW1iZXIsIG1heD86IG51bWJlcikge1xuICBpZiAobWF4ID09PSB1bmRlZmluZWQpIHtcbiAgICBtYXggPSBtaW47XG4gICAgbWluID0gMDtcbiAgfVxuICByZXR1cm4gbWluICsgTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pO1xufTtcblxudmFyIHJhbmRJbnQgPSBmdW5jdGlvbihyYW5nZSkge1xuICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogcmFuZ2UpO1xufTtcbnZhciBkZWdUb1JhZCA9IGZ1bmN0aW9uKGQpIHtcbiAgcmV0dXJuIGQgKiBNYXRoLlBJIC8gMTgwO1xufVxuXG52YXIgZ2VuZXJhdGVBcnJheXMgPSBmdW5jdGlvbihudW1zT2Z2ZXJ0ZXhJbk9uZUF4aXM6IG51bWJlcikge1xuICB2YXIgYXJyYXlzID0ge1xuICAgIHBvc2l0aW9uOiB7IG51bUNvbXBvbmVudHM6IDMsIGRhdGE6IFtdfSxcbiAgICB0ZXhjb29yZDogeyBudW1Db21wb25lbnRzOiAyLCBkYXRhOiBbXX0sXG4gICAgbm9ybWFsOiAgIHsgbnVtQ29tcG9uZW50czogMywgZGF0YTogW119LFxuICAgIGluZGljZXM6ICB7IG51bUNvbXBvbmVudHM6IDMsIGRhdGE6IFtdfSxcbiAgfTtcbiAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IG51bXNPZnZlcnRleEluT25lQXhpczsgaWkrKykge1xuICAgIGZvciAodmFyIGpqID0gMDsgamogPCBudW1zT2Z2ZXJ0ZXhJbk9uZUF4aXM7IGpqKyspIHtcbiAgICAgIGFycmF5cy5wb3NpdGlvbi5kYXRhLnB1c2goamogKiAoMTAuMCAvIChudW1zT2Z2ZXJ0ZXhJbk9uZUF4aXMgLSAxKSkgLSA1LjAsIGlpICogKDEwLjAgLyAobnVtc09mdmVydGV4SW5PbmVBeGlzIC0gMSkpIC0gNS4wLCAwKTtcbiAgICAgIGFycmF5cy50ZXhjb29yZC5kYXRhLnB1c2goamogKiAoMS4wIC8gKG51bXNPZnZlcnRleEluT25lQXhpcyAtIDEpKSwgaWkgKiAoMS4wIC8gKG51bXNPZnZlcnRleEluT25lQXhpcyAtIDEpKSk7XG4gICAgICBhcnJheXMubm9ybWFsLmRhdGEucHVzaCgwLCAwLCAtMSk7XG4gICAgICBpZiAoKGlpICE9IG51bXNPZnZlcnRleEluT25lQXhpcyAtIDEpICYmIChqaiAhPSBudW1zT2Z2ZXJ0ZXhJbk9uZUF4aXMgLSAxKSkge1xuICAgICAgICBhcnJheXMuaW5kaWNlcy5kYXRhLnB1c2goamogKyBpaSAqIG51bXNPZnZlcnRleEluT25lQXhpcywgamogKyBpaSAqIG51bXNPZnZlcnRleEluT25lQXhpcyArIDEsIGpqICsgKGlpICsgMSkgKiBudW1zT2Z2ZXJ0ZXhJbk9uZUF4aXMpO1xuICAgICAgICBhcnJheXMuaW5kaWNlcy5kYXRhLnB1c2goamogKyBpaSAqIG51bXNPZnZlcnRleEluT25lQXhpcyArIDEsIGpqICsgKGlpICsgMSkgKiBudW1zT2Z2ZXJ0ZXhJbk9uZUF4aXMsIGpqICsgKGlpICsgMSkgKiBudW1zT2Z2ZXJ0ZXhJbk9uZUF4aXMgKyAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdmFyIHRydWVUZXh0Y29vcmQgPSBbXTtcbiAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IGFycmF5cyAudGV4Y29vcmQuZGF0YS5sZW5ndGggLyAyOyBpaSsrKSB7XG4gICAgdmFyIHRlbXBlbnRyeSA9IGFycmF5cyAudGV4Y29vcmQuZGF0YVtpaV07XG4gICAgYXJyYXlzIC50ZXhjb29yZC5kYXRhW2lpXSA9IGFycmF5cyAudGV4Y29vcmQuZGF0YVthcnJheXMgLnRleGNvb3JkLmRhdGEubGVuZ3RoIC0gaWkgLSAxXTtcbiAgICBhcnJheXMgLnRleGNvb3JkLmRhdGFbYXJyYXlzIC50ZXhjb29yZC5kYXRhLmxlbmd0aCAtIGlpIC0gMV0gPSB0ZW1wZW50cnk7XG4gICAgXG4gIH1cbiAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IGFycmF5cyAudGV4Y29vcmQuZGF0YS5sZW5ndGg7IGlpKz0yKSB7XG4gICAgdmFyIHRlbXBlbnRyeSA9IGFycmF5cyAudGV4Y29vcmQuZGF0YVtpaV07XG4gICAgYXJyYXlzIC50ZXhjb29yZC5kYXRhW2lpXSA9IGFycmF5cyAudGV4Y29vcmQuZGF0YVtpaSArIDFdO1xuICAgIGFycmF5cyAudGV4Y29vcmQuZGF0YVtpaSArIDFdID0gdGVtcGVudHJ5O1xuICB9XG4gIHJldHVybiBhcnJheXM7XG59XG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gZ2V0IHNvbWUgb2Ygb3VyIGNhbnZhcyBlbGVtZW50cyB0aGF0IHdlIG5lZWRcbnZhciBjYW52YXMgPSA8SFRNTENhbnZhc0VsZW1lbnQ+ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJ3ZWJnbFwiKTtcbnZhciBnZXRQaXhlbENhbnZhcyA9IDxIVE1MQ2FudmFzRWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImdldFBpeGVsXCIpO1xuLy92YXIgbXljdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIHNvbWUgc2ltcGxlIGludGVyYWN0aW9uIHVzaW5nIHRoZSBtb3VzZS5cbi8vIHdlIGFyZSBnb2luZyB0byBnZXQgc21hbGwgbW90aW9uIG9mZnNldHMgb2YgdGhlIG1vdXNlLCBhbmQgdXNlIHRoZXNlIHRvIHJvdGF0ZSB0aGUgb2JqZWN0XG4vL1xuLy8gb3VyIG9mZnNldCgpIGZ1bmN0aW9uIGZyb20gYXNzaWdubWVudCAwLCB0byBnaXZlIHVzIGEgZ29vZCBtb3VzZSBwb3NpdGlvbiBpbiB0aGUgY2FudmFzIFxuZnVuY3Rpb24gb2Zmc2V0KGU6IE1vdXNlRXZlbnQpOiBHTE0uSUFycmF5IHtcbiAgICBlID0gZSB8fCA8TW91c2VFdmVudD4gd2luZG93LmV2ZW50O1xuXG4gICAgdmFyIHRhcmdldCA9IDxFbGVtZW50PiBlLnRhcmdldCB8fCBlLnNyY0VsZW1lbnQsXG4gICAgICAgIHJlY3QgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG4gICAgICAgIG9mZnNldFggPSBlLmNsaWVudFggLSByZWN0LmxlZnQsXG4gICAgICAgIG9mZnNldFkgPSBlLmNsaWVudFkgLSByZWN0LnRvcDtcblxuICAgIHJldHVybiB2ZWMyLmZyb21WYWx1ZXMob2Zmc2V0WCwgb2Zmc2V0WSk7XG59XG5cblxuXG4vLyBzdGFydCB0aGluZ3Mgb2ZmIHdpdGggYSBkb3duIHByZXNzXG5jYW52YXMub25tb3VzZWRvd24gPSAoZXY6IE1vdXNlRXZlbnQpID0+IHtcbiAgICBtb3VzZWNsaWNrZWQgPSBvZmZzZXQoZXYpO1xufVxuXG5cbmRvY3VtZW50Lm9ua2V5cHJlc3MgPSAoZXZlbnQ6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgdmFyIHNvdW5kID0gbmV3IEhvd2woe1xuICAgIHVybHM6IFsnc291bmRzL3R5cGUud2F2J11cbiAgfSkucGxheSgpO1xuICBrZXlwcmVzc2VkID0gZXZlbnQua2V5Q29kZTtcbiAgaWYgKGV2ZW50LmtleUNvZGUgPT0gMzIpIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG59XG5cbmRvY3VtZW50Lm9ua2V5ZG93biA9IChldmVudDogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICBpZiAoZXZlbnQua2V5Q29kZSA9PSA4IHx8IGV2ZW50LmtleUNvZGUgPT0gMjcpIHtcbiAgICBmdW5jS2V5UHJlc3NlZCA9IGV2ZW50LmtleUNvZGU7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgfVxufVxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIHN0YXJ0IHRoaW5ncyBvZmYgYnkgY2FsbGluZyBpbml0V2ViR0xcbmluaXRXZWJHTCgpO1xuXG5mdW5jdGlvbiBpbml0V2ViR0woKSB7XG4gIC8vIGdldCB0aGUgcmVuZGVyaW5nIGNvbnRleHQgZm9yIHdlYkdMXG4gIHZhciBnbDogV2ViR0xSZW5kZXJpbmdDb250ZXh0ID0gZ2V0V2ViR0xDb250ZXh0KGNhbnZhcyk7XG4gIGlmICghZ2wpIHtcbiAgICByZXR1cm47ICAvLyBubyB3ZWJnbCEgIEJ5ZSBieWVcbiAgfVxuICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgOTA7IGlpKyspIHtcbiAgICB2YXIgbXlpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICBsZXR0ZXJUZXh0dXJlLnB1c2gobXlpbWcpO1xuICB9XG4gIC8vIHR1cm4gb24gYmFja2ZhY2UgY3VsbGluZyBhbmQgemJ1ZmZlcmluZ1xuICAvL2dsLmVuYWJsZShnbC5DVUxMX0ZBQ0UpO1xuICBnbC5lbmFibGUoZ2wuREVQVEhfVEVTVCk7XG4gIC8vIGF0dGVtcHQgdG8gZG93bmxvYWQgYW5kIHNldCB1cCBvdXIgR0xTTCBzaGFkZXJzLiAgV2hlbiB0aGV5IGRvd25sb2FkLCBwcm9jZXNzZWQgdG8gdGhlIG5leHQgc3RlcFxuICAvLyBvZiBvdXIgcHJvZ3JhbSwgdGhlIFwibWFpblwiIHJvdXRpbmdcbiAgLy8gXG4gIC8vIFlPVSBTSE9VTEQgTU9ESUZZIFRISVMgVE8gRE9XTkxPQUQgQUxMIFlPVVIgU0hBREVSUyBhbmQgc2V0IHVwIGFsbCBmb3VyIFNIQURFUiBQUk9HUkFNUyxcbiAgLy8gVEhFTiBQQVNTIEFOIEFSUkFZIE9GIFBST0dSQU1TIFRPIG1haW4oKS4gIFlvdSdsbCBoYXZlIHRvIGRvIG90aGVyIHRoaW5ncyBpbiBtYWluIHRvIGRlYWxcbiAgLy8gd2l0aCBtdWx0aXBsZSBzaGFkZXJzIGFuZCBzd2l0Y2ggYmV0d2VlbiB0aGVtXG4gIGxvYWRlci5sb2FkRmlsZXMoWydzaGFkZXJzL2EzLXNoYWRlci52ZXJ0LmMnLCAnc2hhZGVycy9hMy1zaGFkZXIuZnJhZy5jJyxcbiAgICAgICAgICAgICAgICAgICAgJ3NoYWRlcnMvYTMtc2hhZGVyLWxpbmUudmVydCcsICdzaGFkZXJzL2EzLXNoYWRlci1saW5lLmZyYWcnXSwgZnVuY3Rpb24gKHNoYWRlclRleHQpIHtcbiAgICB2YXIgcHJvZ3JhbSA9IGNyZWF0ZVByb2dyYW1Gcm9tU291cmNlcyhnbCwgW3NoYWRlclRleHRbMF0sIHNoYWRlclRleHRbMV1dKTtcbiAgICB2YXIgbGluZXByb2dyYW0gPSBjcmVhdGVQcm9ncmFtRnJvbVNvdXJjZXMoZ2wsIFtzaGFkZXJUZXh0WzJdLCBzaGFkZXJUZXh0WzNdXSk7XG4gICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IDkwOyBpaSsrKSB7XG4gICAgICB2YXIgdGVtcEltZyA9IG5ldyBJbWFnZSgpO1xuICAgICAgdGVtcEltZy5vbmxvYWQgPSAoZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGxldHRlclRleHR1cmVbdmFsdWVdLnNyYyA9IHRoaXMuc3JjO1xuICAgICAgICB9XG4gICAgICB9KShpaSk7XG4gICAgICB2YXIgZmlsZW5hbWUgPSBcImNoYXJcIiArIChpaSArIDMzKS50b1N0cmluZygpICsgXCIuanBnXCI7XG4gICAgICB0ZW1wSW1nLnNyYyA9IFwibGV0dGVyVGV4dHVyZS9cIiArIGZpbGVuYW1lO1xuICAgIH1cbiAgICBtYWluKGdsLCBwcm9ncmFtLCBsaW5lcHJvZ3JhbSk7XG4gIH0sIGZ1bmN0aW9uICh1cmwpIHtcbiAgICAgIGFsZXJ0KCdTaGFkZXIgZmFpbGVkIHRvIGRvd25sb2FkIFwiJyArIHVybCArICdcIicpO1xuICB9KTsgXG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyB3ZWJHTCBpcyBzZXQgdXAsIGFuZCBvdXIgU2hhZGVyIHByb2dyYW0gaGFzIGJlZW4gY3JlYXRlZC4gIEZpbmlzaCBzZXR0aW5nIHVwIG91ciB3ZWJHTCBhcHBsaWNhdGlvbiAgICAgICBcbmZ1bmN0aW9uIG1haW4oZ2w6IFdlYkdMUmVuZGVyaW5nQ29udGV4dCwgcHJvZ3JhbTogV2ViR0xQcm9ncmFtLCBsaW5lcHJvZ3JhbTogV2ViR0xQcm9ncmFtKSB7XG4gIFxuICAvLyB1c2UgdGhlIHdlYmdsLXV0aWxzIGxpYnJhcnkgdG8gY3JlYXRlIHNldHRlcnMgZm9yIGFsbCB0aGUgdW5pZm9ybXMgYW5kIGF0dHJpYnV0ZXMgaW4gb3VyIHNoYWRlcnMuXG4gIC8vIEl0IGVudW1lcmF0ZXMgYWxsIG9mIHRoZSB1bmlmb3JtcyBhbmQgYXR0cmlidXRlcyBpbiB0aGUgcHJvZ3JhbSwgYW5kIGNyZWF0ZXMgdXRpbGl0eSBmdW5jdGlvbnMgdG8gXG4gIC8vIGFsbG93IFwic2V0VW5pZm9ybXNcIiBhbmQgXCJzZXRBdHRyaWJ1dGVzXCIgKGJlbG93KSB0byBzZXQgdGhlIHNoYWRlciB2YXJpYWJsZXMgZnJvbSBhIGphdmFzY3JpcHQgb2JqZWN0LiBcbiAgLy8gVGhlIG9iamVjdHMgaGF2ZSBhIGtleSBmb3IgZWFjaCB1bmlmb3JtIG9yIGF0dHJpYnV0ZSwgYW5kIGEgdmFsdWUgY29udGFpbmluZyB0aGUgcGFyYW1ldGVycyBmb3IgdGhlXG4gIC8vIHNldHRlciBmdW5jdGlvblxuICB2YXIgdW5pZm9ybVNldHRlcnMgPSBjcmVhdGVVbmlmb3JtU2V0dGVycyhnbCwgcHJvZ3JhbSk7XG4gIHZhciBhdHRyaWJTZXR0ZXJzICA9IGNyZWF0ZUF0dHJpYnV0ZVNldHRlcnMoZ2wsIHByb2dyYW0pO1xuXG4gIHZhciBhcnJheXMgPSBnZW5lcmF0ZUFycmF5cygyKTtcbiAgdmFyIHNjYWxlRmFjdG9yID0gMTA7XG4gIHZhciBjZW50ZXIgPSB2ZWM0LmZyb21WYWx1ZXMoNzAgKiBzY2FsZUZhY3RvciwwLDAsMCk7XG4gIHZhciBsaW5lQXJyYXlzID0ge3Bvc2l0aW9uOiB7IG51bUNvbXBvbmVudHM6IDMsIGRhdGE6IFswLCAxLCAwLCAwLCAtMSwgMF19LFxuICAgICAgICAgICAgICAgIGluZGljZXM6IHtudW1Db21wb25lbnRzOiAxLCBkYXRhOiBbMCwgMV19fTtcbiAgdmFyIGJ1ZmZlckluZm8gPSBjcmVhdGVCdWZmZXJJbmZvRnJvbUFycmF5cyhnbCwgYXJyYXlzKTtcbiAgdmFyIGxpbmVCdWZmZXJJbmZvID0gY3JlYXRlQnVmZmVySW5mb0Zyb21BcnJheXMoZ2wsIGxpbmVBcnJheXMpO1xuICB2YXIgY2FtZXJhQW5nbGVSYWRpYW5zID0gZGVnVG9SYWQoMCk7XG4gIHZhciBmaWVsZE9mVmlld1JhZGlhbnMgPSBkZWdUb1JhZCg2MCk7XG4gIHZhciBjYW1lcmFIZWlnaHQgPSA1MDtcblxuICB2YXIgdW5pZm9ybXNUaGF0QXJlVGhlU2FtZUZvckFsbE9iamVjdHMgPSB7XG4gICAgdV9saWdodFdvcmxkUG9zOiAgICAgICAgIFswLCAwLCAtMjAwXSxcbiAgICB1X3ZpZXdJbnZlcnNlOiAgICAgICAgICAgbWF0NC5jcmVhdGUoKSxcbiAgICB1X2xpZ2h0Q29sb3I6ICAgICAgICAgICAgWzEsIDEsIDEsIDFdLFxuICAgIHVfYW1iaWVudDogICAgICAgICAgICAgICBbMC4xLCAwLjEsIDAuMSwgMC4xXVxuICB9O1xuXG4gIHZhciB1bmlmb3Jtc1RoYXRBcmVDb21wdXRlZEZvckVhY2hPYmplY3QgPSB7XG4gICAgdV93b3JsZFZpZXdQcm9qZWN0aW9uOiAgIG1hdDQuY3JlYXRlKCksXG4gICAgdV93b3JsZDogICAgICAgICAgICAgICAgIG1hdDQuY3JlYXRlKCksXG4gICAgdV93b3JsZEludmVyc2VUcmFuc3Bvc2U6IG1hdDQuY3JlYXRlKCksXG4gIH07XG4gIFxuICB2YXIgdW5pZm9ybXNGb3JMaW5lID0ge1xuICAgIHVfd29ybGRWaWV3UHJvamVjdGlvbjogICBtYXQ0LmNyZWF0ZSgpLFxuICAgIHVfY29sb3JNdWx0OiBbMCwwLDAsMV0sXG4gICAgdV9jZW50ZXJ4OiB2ZWM0LmNyZWF0ZSgpLFxuICAgIHVfaGVpZ2h0Q3V0OiAwLjBcbiAgfVxuXG4gIC8vIHZhciB0ZXh0dXJlID0gLi4uLiBjcmVhdGUgYSB0ZXh0dXJlIG9mIHNvbWUgZm9ybVxuXG4gIHZhciBiYXNlQ29sb3IgPSByYW5kKDI0MCk7XG4gIHZhciBvYmplY3RTdGF0ZSA9IHsgXG4gICAgICBtYXRlcmlhbFVuaWZvcm1zOiB7XG4gICAgICAgIHVfY29sb3JNdWx0OiAgICAgICAgICAgICBjaHJvbWEuaHN2KHJhbmQoYmFzZUNvbG9yLCBiYXNlQ29sb3IgKyAxMjApLCAwLjUsIDEpLmdsKCksXG4gICAgICAgIC8vdV9kaWZmdXNlOiAgICAgICAgICAgICAgIHRleHR1cmUsXG4gICAgICAgIHVfc3BlY3VsYXI6ICAgICAgICAgICAgICBbMCwgMCwgMCwgMV0sXG4gICAgICAgIHVfc2hpbmluZXNzOiAgICAgICAgICAgICAxMDAwMCxcbiAgICAgICAgdV9zcGVjdWxhckZhY3RvcjogICAgICAgIDAuNzUsXG4gICAgICAgIHVfbW92ZVRvQ2VudGVyOiAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIHVfaGVpZ2h0UG9zOiAgICAgICAgICAgICB1bmRlZmluZWRcbiAgICAgIH1cbiAgfTtcblxuICB2YXIgbGV0dGVyUGFyYW1zID0gW107XG4gIC8vIGZvciAodmFyIGlpID0gMDsgaWkgPCBsZXR0ZXJQYXJhbXMubGVuZ3RoOyBpaSsrKSB7XG4gIC8vICAgbGV0dGVyUGFyYW1zW2lpXSA9IHtcbiAgLy8gICAgIC8vY2VudGVyUG9zOiAtNzAgKyBpaSAqICgxNDAgLyAobGV0dGVyUGFyYW1zLmxlbmd0aCAtIDEpKSxcbiAgLy8gICAgIGhlaWdodDogNTAsXG4gIC8vICAgICB1X2NvbG9yTXVsdDogY2hyb21hLmhzdihyYW5kKGJhc2VDb2xvciwgYmFzZUNvbG9yICsgMTIwKSwgMC41LCAxKS5nbCgpLFxuICAvLyAgICAgdGltZTogMC4wLFxuICAvLyAgICAgcm90YXRpb25NYXRyaXg6IG1hdDQuY3JlYXRlKCksXG4gIC8vICAgICBsZXR0ZXJNb2Q6IHVuZGVmaW5lZCxcbiAgLy8gICAgIHJlbmRlck9yTm90OiBmYWxzZVxuICAvLyAgIH07XG4gIC8vIH1cbiAgXG4gIHZhciBjb3VudCA9IDA7XG4gIHZhciBiZWdpbm5pbmcgPSAwO1xuICBcbiAgLy8gc29tZSB2YXJpYWJsZXMgd2UnbGwgcmV1c2UgYmVsb3dcbiAgdmFyIHByb2plY3Rpb25NYXRyaXggPSBtYXQ0LmNyZWF0ZSgpO1xuICB2YXIgdmlld01hdHJpeCA9IG1hdDQuY3JlYXRlKCk7XG4gIHZhciByb3RhdGlvbk1hdHJpeCA9IG1hdDQuY3JlYXRlKCk7XG4gIHZhciBtYXRyaXggPSBtYXQ0LmNyZWF0ZSgpOyAgLy8gYSBzY3JhdGNoIG1hdHJpeFxuICB2YXIgaW52TWF0cml4ID0gbWF0NC5jcmVhdGUoKTtcbiAgdmFyIGF4aXNWZWN0b3IgPSB2ZWMzLmNyZWF0ZSgpO1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZHJhd1NjZW5lKTtcbiAgXG4gIHZhciBsb2FkZWQgPSB0cnVlO1xuICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgOTA7IGlpKyspIHtcbiAgICBpZiAoIWxldHRlclRleHR1cmVbaWldLmNvbXBsZXRlKSB7XG4gICAgICBsb2FkZWQgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvLyBEcmF3IHRoZSBzY2VuZS5cbiAgZnVuY3Rpb24gZHJhd1NjZW5lKHRpbWU6IG51bWJlcikge1xuICAgIC8vIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIpO1xuICAgIC8vIGN0eC5yZWN0KDIwLDIwLDE1MCwxMDApO1xuICAgIC8vIGN0eC5maWxsU3R5bGU9XCJyZWRcIjtcbiAgICAvLyBjdHguZmlsbCgpO1xuICAgIHRpbWUgKj0gMC4wMDE7IFxuICAgXG4gICAgLy8gbWVhc3VyZSB0aW1lIHRha2VuIGZvciB0aGUgbGl0dGxlIHN0YXRzIG1ldGVyXG5cbiAgICAvLyBpZiB0aGUgd2luZG93IGNoYW5nZWQgc2l6ZSwgcmVzZXQgdGhlIFdlYkdMIGNhbnZhcyBzaXplIHRvIG1hdGNoLiAgVGhlIGRpc3BsYXllZCBzaXplIG9mIHRoZSBjYW52YXNcbiAgICAvLyAoZGV0ZXJtaW5lZCBieSB3aW5kb3cgc2l6ZSwgbGF5b3V0LCBhbmQgeW91ciBDU1MpIGlzIHNlcGFyYXRlIGZyb20gdGhlIHNpemUgb2YgdGhlIFdlYkdMIHJlbmRlciBidWZmZXJzLCBcbiAgICAvLyB3aGljaCB5b3UgY2FuIGNvbnRyb2wgYnkgc2V0dGluZyBjYW52YXMud2lkdGggYW5kIGNhbnZhcy5oZWlnaHRcbiAgICByZXNpemVDYW52YXNUb0Rpc3BsYXlTaXplKGNhbnZhcyk7XG5cbiAgICAvLyBTZXQgdGhlIHZpZXdwb3J0IHRvIG1hdGNoIHRoZSBjYW52YXNcbiAgICBnbC52aWV3cG9ydCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgIFxuICAgIC8vIENsZWFyIHRoZSBjYW52YXMgQU5EIHRoZSBkZXB0aCBidWZmZXIuXG4gICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQpO1xuXG4gICAgLy8gQ29tcHV0ZSB0aGUgcHJvamVjdGlvbiBtYXRyaXhcbiAgICB2YXIgYXNwZWN0ID0gY2FudmFzLmNsaWVudFdpZHRoIC8gY2FudmFzLmNsaWVudEhlaWdodDtcbiAgICBtYXQ0LnBlcnNwZWN0aXZlKHByb2plY3Rpb25NYXRyaXgsZmllbGRPZlZpZXdSYWRpYW5zLCBhc3BlY3QsIDEsIDMwMDApO1xuICAgIC8vIHByb2plY3Rpb25NYXRyaXhbMTVdID0gMTtcbiAgICAvLyBjb25zb2xlLmxvZyhhc3BlY3QpO1xuICAgIC8vIG1hdDQub3J0aG8ocHJvamVjdGlvbk1hdHJpeCwgLTExNSwgMTE1LCAtNTcsIDU3LCAxLCAyMDAwKTtcbiAgICAvLyBjb25zb2xlLmxvZyhwcm9qZWN0aW9uTWF0cml4KTtcbiAgICAvLyBDb21wdXRlIHRoZSBjYW1lcmEncyBtYXRyaXggdXNpbmcgbG9vayBhdC5cbiAgICB2YXIgY2FtZXJhUG9zaXRpb24gPSBbMCwgMCwgLTgwMF07XG4gICAgdmFyIHRhcmdldCA9IFswLCAwLCAwXTtcbiAgICB2YXIgdXAgPSBbMCwgMSwgMF07XG4gICAgdmFyIGNhbWVyYU1hdHJpeCA9IG1hdDQubG9va0F0KHVuaWZvcm1zVGhhdEFyZVRoZVNhbWVGb3JBbGxPYmplY3RzLnVfdmlld0ludmVyc2UsIGNhbWVyYVBvc2l0aW9uLCB0YXJnZXQsIHVwKTtcblxuICAgIC8vIE1ha2UgYSB2aWV3IG1hdHJpeCBmcm9tIHRoZSBjYW1lcmEgbWF0cml4LlxuICAgIG1hdDQuaW52ZXJ0KHZpZXdNYXRyaXgsIGNhbWVyYU1hdHJpeCk7XG4gICAgXG4gICAgLy8gdGVsbCBXZWJHTCB0byB1c2Ugb3VyIHNoYWRlciBwcm9ncmFtICh3aWxsIG5lZWQgdG8gY2hhbmdlIHRoaXMpXG4gICAgZ2wudXNlUHJvZ3JhbShwcm9ncmFtKTtcbiAgICB1bmlmb3JtU2V0dGVycyA9IGNyZWF0ZVVuaWZvcm1TZXR0ZXJzKGdsLCBwcm9ncmFtKTtcbiAgICBhdHRyaWJTZXR0ZXJzICA9IGNyZWF0ZUF0dHJpYnV0ZVNldHRlcnMoZ2wsIHByb2dyYW0pO1xuICAgIC8vIFNldHVwIGFsbCB0aGUgbmVlZGVkIGF0dHJpYnV0ZXMgYW5kIGJ1ZmZlcnMuICBcbiAgICBzZXRCdWZmZXJzQW5kQXR0cmlidXRlcyhnbCwgYXR0cmliU2V0dGVycywgYnVmZmVySW5mbyk7XG5cbiAgICAvLyBTZXQgdGhlIHVuaWZvcm1zIHRoYXQgYXJlIHRoZSBzYW1lIGZvciBhbGwgb2JqZWN0cy4gIFVubGlrZSB0aGUgYXR0cmlidXRlcywgZWFjaCB1bmlmb3JtIHNldHRlclxuICAgIC8vIGlzIGRpZmZlcmVudCwgZGVwZW5kaW5nIG9uIHRoZSB0eXBlIG9mIHRoZSB1bmlmb3JtIHZhcmlhYmxlLiAgTG9vayBpbiB3ZWJnbC11dGlsLmpzIGZvciB0aGVcbiAgICAvLyBpbXBsZW1lbnRhdGlvbiBvZiAgc2V0VW5pZm9ybXMgdG8gc2VlIHRoZSBkZXRhaWxzIGZvciBzcGVjaWZpYyB0eXBlcyAgICAgICBcbiAgICBzZXRVbmlmb3Jtcyh1bmlmb3JtU2V0dGVycywgdW5pZm9ybXNUaGF0QXJlVGhlU2FtZUZvckFsbE9iamVjdHMpO1xuICAgXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIC8vIENvbXB1dGUgdGhlIHZpZXcgbWF0cml4IGFuZCBjb3JyZXNwb25kaW5nIG90aGVyIG1hdHJpY2VzIGZvciByZW5kZXJpbmcuXG4gICAgLy8gZmlyc3QgbWFrZSBhIGNvcHkgb2Ygb3VyIHJvdGF0aW9uTWF0cml4XG4gICAgLy8gY29uc29sZS5sb2cobWF0cml4KTtcbiAgICAvLyBjb25zb2xlLmxvZyhyb3RhdGlvbk1hdHJpeCk7XG4gICAgLy9tYXQ0LnRyYW5zbGF0ZShtYXRyaXgsIG1hdHJpeCwgWy1jZW50ZXJbMF0gKiBzY2FsZUZhY3RvciwgLWNlbnRlclsxXSAqIHNjYWxlRmFjdG9yLCAtY2VudGVyWzJdICogc2NhbGVGYWN0b3JdKTtcbiAgICBpZiAoa2V5cHJlc3NlZCkge1xuICAgICAgLy9iZWdpbm5pbmcgPSBiZWdpbm5pbmcgJSBsZXR0ZXJQYXJhbXMubGVuZ3RoO1xuICAgICAgICB2YXIgYWRkZXIgPSB7XG4gICAgICAgICAgaGVpZ2h0OiByYW5kKC0zMDAsMzAwKSxcbiAgICAgICAgICB1X2NvbG9yTXVsdDogY2hyb21hLmhzdihyYW5kKGJhc2VDb2xvciwgYmFzZUNvbG9yICsgMTIwKSwgMC41LCAxKS5nbCgpLFxuICAgICAgICAgIHRpbWU6IDAuMCxcbiAgICAgICAgICByb3RhdGlvbk1hdHJpeFo6IG1hdDQuY3JlYXRlKCksXG4gICAgICAgICAgcm90YXRpb25NYXRyaXhZOiBtYXQ0LmNyZWF0ZSgpLFxuICAgICAgICAgIGxldHRlck1vZDogdW5kZWZpbmVkLFxuICAgICAgICAgIHJlbmRlck9yTm90OiB0cnVlLFxuICAgICAgICAgIHNwaW5uaW5nOiBmYWxzZSxcbiAgICAgICAgICBzcGluU3BlZWQ6IDAuMCxcbiAgICAgICAgICBhY2NlbDogMC4wLFxuICAgICAgICAgIGxldHRlckluZDoga2V5cHJlc3NlZCxcbiAgICAgICAgICBsaW5ldG9wOiB1bmRlZmluZWRcbiAgICAgICAgfVxuICAgICAgICBpZiAoa2V5cHJlc3NlZCA9PSAzMikge1xuICAgICAgICAgIGFkZGVyLnJlbmRlck9yTm90ID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHJvdGF0ZVpBbmcgPSBkZWdUb1JhZChyYW5kKC0xNSwxNSkpO1xuICAgICAgICAgIGFkZGVyLmxpbmV0b3AgPSAoKC0gYWRkZXIuaGVpZ2h0ICogMC40ICsgMzIwKSAtIE1hdGguY29zKHJvdGF0ZVpBbmcpICogMzYpIC8gNjQwO1xuICAgICAgICAgIHZhciB6QXhpcyA9IHZlYzMudHJhbnNmb3JtTWF0NChheGlzVmVjdG9yLCB2ZWMzLmZyb21WYWx1ZXMoMCwwLDEpLCBtYXQ0LmNyZWF0ZSgpKTtcbiAgICAgICAgICBtYXQ0LnJvdGF0ZShhZGRlci5yb3RhdGlvbk1hdHJpeFosIG1hdDQuY3JlYXRlKCksIHJvdGF0ZVpBbmcsIHpBeGlzKTtcbiAgICAgICAgICBcbiAgICAgICAgfVxuICAgICAgICBpZiAobGV0dGVyUGFyYW1zLmxlbmd0aCA+PSBtYXhpbXVtTGV0dGVyKSB7XG4gICAgICAgICAgbGV0dGVyUGFyYW1zLnNoaWZ0KCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0dGVyUGFyYW1zLnB1c2goYWRkZXIpO1xuICAgICAgICBibG9ja3MgPSBNYXRoLm1heCgxMywgbGV0dGVyUGFyYW1zLmxlbmd0aCk7XG4gICAgICAgIGNhbnZhc1NwYWNpbmcgPSAocmlnaHRCb3JkZXIgLSBsZWZ0Qm9yZGVyKSAvIGJsb2NrcztcbiAgICAgICAga2V5cHJlc3NlZCA9IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgaWYgKGZ1bmNLZXlQcmVzc2VkKSB7XG4gICAgICBpZiAoZnVuY0tleVByZXNzZWQgPT0gMjcpIHtcbiAgICAgICAgbGV0dGVyUGFyYW1zID0gW107XG4gICAgICB9IGVsc2UgaWYgKGZ1bmNLZXlQcmVzc2VkID09IDgpIHtcbiAgICAgICAgbGV0dGVyUGFyYW1zLnBvcCgpO1xuICAgICAgfVxuICAgICAgZnVuY0tleVByZXNzZWQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIC8vIC8vIFNldCB0aGUgdW5pZm9ybXMgd2UganVzdCBjb21wdXRlZFxuICAgIHZhciBzcGFjaW5nID0gMTQwIC8gTWF0aC5tYXgoYmxvY2tzLCBsZXR0ZXJQYXJhbXMubGVuZ3RoIC0gMSk7XG4gICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IGxldHRlclBhcmFtcy5sZW5ndGg7IGlpKyspIHtcbiAgICAgIGlmIChsZXR0ZXJQYXJhbXNbaWldLnJlbmRlck9yTm90KSB7XG4gICAgICAgIG1hdDQuY29weShtYXRyaXgsIGxldHRlclBhcmFtc1tpaV0ucm90YXRpb25NYXRyaXhZKTtcbiAgICAgICAgaWYgKGxldHRlclBhcmFtc1tpaV0uc3Bpbm5pbmcpIHtcbiAgICAgICAgICBpZiAobGV0dGVyUGFyYW1zW2lpXS50aW1lIDwgMzQuMCkge1xuICAgICAgICAgICAgbGV0dGVyUGFyYW1zW2lpXS50aW1lICs9IDEuMDtcbiAgICAgICAgICAgIHZhciB5QXhpcyA9IHZlYzMudHJhbnNmb3JtTWF0NChheGlzVmVjdG9yLCB2ZWMzLmZyb21WYWx1ZXMoMCwxLDApLCBtYXQ0LmNyZWF0ZSgpKTtcbiAgICAgICAgICAgIC8vbWF0NC5pbnZlcnQobWF0cml4LCBtYXRyaXgpO1xuICAgICAgICAgICAgbWF0NC5yb3RhdGUobWF0cml4LCBtYXRyaXgsIGRlZ1RvUmFkKGxldHRlclBhcmFtc1tpaV0uc3BpblNwZWVkKSwgeUF4aXMpO1xuICAgICAgICAgICAgbGV0dGVyUGFyYW1zW2lpXS5zcGluU3BlZWQgPSBsZXR0ZXJQYXJhbXNbaWldLnNwaW5TcGVlZCAtIGxldHRlclBhcmFtc1tpaV0uYWNjZWw7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldHRlclBhcmFtc1tpaV0udGltZSA9IDAuMDtcbiAgICAgICAgICAgIGxldHRlclBhcmFtc1tpaV0uc3Bpbm5pbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGxldHRlclBhcmFtc1tpaV0uc3BpblNwZWVkID0gMC4wO1xuICAgICAgICAgICAgbGV0dGVyUGFyYW1zW2lpXS5hY2NlbCA9IDAuMDtcbiAgICAgICAgICAgIGxldHRlclBhcmFtc1tpaV0ucm90YXRpb25NYXRyaXhZID0gbWF0NC5jcmVhdGUoKTtcbiAgICAgICAgICAgIG1hdHJpeCA9IG1hdDQuY3JlYXRlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG1hdDQuY29weShsZXR0ZXJQYXJhbXNbaWldLnJvdGF0aW9uTWF0cml4WSwgbWF0cml4KTtcbiAgICAgICAgLy8gYWRkIGEgdHJhbnNsYXRlIGFuZCBzY2FsZSB0byB0aGUgb2JqZWN0IFdvcmxkIHhmb3JtLCBzbyB3ZSBoYXZlOiAgUiAqIFQgKiBTXG4gICAgICAgIG1hdDQubXVsdGlwbHkobWF0cml4LCBsZXR0ZXJQYXJhbXNbaWldLnJvdGF0aW9uTWF0cml4WSwgbGV0dGVyUGFyYW1zW2lpXS5yb3RhdGlvbk1hdHJpeFopO1xuICAgICAgICAvL21hdDQudHJhbnNsYXRlKG1hdHJpeCwgcm90YXRpb25NYXRyaXgsIFtjZW50ZXJbMF0gKiBzY2FsZUZhY3RvciwgY2VudGVyWzFdICogc2NhbGVGYWN0b3IsIGNlbnRlclsyXSAqIHNjYWxlRmFjdG9yXSk7XG4gICAgICAgIG1hdDQuc2NhbGUobWF0cml4LCBtYXRyaXgsIFtzY2FsZUZhY3Rvciwgc2NhbGVGYWN0b3IsIHNjYWxlRmFjdG9yXSk7XG4gICAgICAgIG1hdDQuY29weSh1bmlmb3Jtc1RoYXRBcmVDb21wdXRlZEZvckVhY2hPYmplY3QudV93b3JsZCwgbWF0cml4KTtcbiAgICAgICAgXG4gICAgICAgIC8vIGdldCBwcm9qICogdmlldyAqIHdvcmxkXG4gICAgICAgIG1hdDQubXVsdGlwbHkobWF0cml4LCB2aWV3TWF0cml4LCB1bmlmb3Jtc1RoYXRBcmVDb21wdXRlZEZvckVhY2hPYmplY3QudV93b3JsZCk7XG4gICAgICAgIG1hdDQubXVsdGlwbHkodW5pZm9ybXNUaGF0QXJlQ29tcHV0ZWRGb3JFYWNoT2JqZWN0LnVfd29ybGRWaWV3UHJvamVjdGlvbiwgcHJvamVjdGlvbk1hdHJpeCwgbWF0cml4KTtcbiAgICAgICAgLy8gZ2V0IHdvcmxkSW52VHJhbnNwb3NlLiAgRm9yIGFuIGV4cGxhaW5hdGlvbiBvZiB3aHkgd2UgbmVlZCB0aGlzLCBmb3IgZml4aW5nIHRoZSBub3JtYWxzLCBzZWVcbiAgICAgICAgLy8gaHR0cDovL3d3dy51bmtub3ducm9hZC5jb20vcnRmbS9ncmFwaGljcy9ydF9ub3JtYWxzLmh0bWxcbiAgICAgICAgbWF0NC50cmFuc3Bvc2UodW5pZm9ybXNUaGF0QXJlQ29tcHV0ZWRGb3JFYWNoT2JqZWN0LnVfd29ybGRJbnZlcnNlVHJhbnNwb3NlLCBcbiAgICAgICAgICAgICAgICAgICAgICBtYXQ0LmludmVydChtYXRyaXgsIHVuaWZvcm1zVGhhdEFyZUNvbXB1dGVkRm9yRWFjaE9iamVjdC51X3dvcmxkKSk7XG4gICAgICAgIHNldFVuaWZvcm1zKHVuaWZvcm1TZXR0ZXJzLCB1bmlmb3Jtc1RoYXRBcmVDb21wdXRlZEZvckVhY2hPYmplY3QpO1xuICAgICAgLy8gU2V0IHRoZSB1bmlmb3JtcyB0aGF0IGFyZSBzcGVjaWZpYyB0byB0aGUgdGhpcyBvYmplY3QuXG4gICAgICAgIG9iamVjdFN0YXRlLm1hdGVyaWFsVW5pZm9ybXMudV9tb3ZlVG9DZW50ZXIgPSB2ZWM0LmZyb21WYWx1ZXMoKCgtMC41ICogc3BhY2luZyAqIChsZXR0ZXJQYXJhbXMubGVuZ3RoIC0gMSkpICsgaWkgKiBzcGFjaW5nKSAqIHNjYWxlRmFjdG9yLCAwLCAwLCAwKTtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhvYmplY3RTdGF0ZS5tYXRlcmlhbFVuaWZvcm1zLnVfbW92ZVRvQ2VudGVyKTtcbiAgICAgICAgb2JqZWN0U3RhdGUubWF0ZXJpYWxVbmlmb3Jtcy51X2hlaWdodFBvcyA9IHZlYzQuZnJvbVZhbHVlcygwLCBsZXR0ZXJQYXJhbXNbaWldLmhlaWdodCwgMCwgMCk7XG4gICAgICAgIG9iamVjdFN0YXRlLm1hdGVyaWFsVW5pZm9ybXMudV9jb2xvck11bHQgPSBsZXR0ZXJQYXJhbXNbaWldLnVfY29sb3JNdWx0O1xuICAgICAgICBzZXRVbmlmb3Jtcyh1bmlmb3JtU2V0dGVycywgb2JqZWN0U3RhdGUubWF0ZXJpYWxVbmlmb3Jtcyk7XG4gICAgICAgIHZhciB0ZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgICAgICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCB0ZXh0dXJlKTtcbiAgICAgIFxuICAgICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5ORUFSRVNUKTtcbiAgICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLk5FQVJFU1QpO1xuICAgICAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIGxldHRlclRleHR1cmVbbGV0dGVyUGFyYW1zW2lpXS5sZXR0ZXJJbmQgLSAzM10pO1xuICAgICAgICAvLyBEcmF3IHRoZSBnZW9tZXRyeS4gICBFdmVyeXRoaW5nIGlzIGtleWVkIHRvIHRoZSBcIlwiXG4gICAgICAgIGdsLmRyYXdFbGVtZW50cyhnbC5UUklBTkdMRVMsIGJ1ZmZlckluZm8ubnVtRWxlbWVudHMsIGdsLlVOU0lHTkVEX1NIT1JULCAwKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1vdXNlY2xpY2tlZCkge1xuICAgICAgaWYgKGNhbnZhcykge1xuICAgICAgICBpZiAoZ2wpIHtcbiAgICAgICAgICB2YXIgY2xpY2tlZFBvaW50ID0gbmV3IFVpbnQ4QXJyYXkoNCk7XG4gICAgICAgICAgZ2wucmVhZFBpeGVscyhtb3VzZWNsaWNrZWRbMF0sZ2wuY2FudmFzLmhlaWdodCAtIG1vdXNlY2xpY2tlZFsxXSwxLDEsZ2wuUkdCQSxnbC5VTlNJR05FRF9CWVRFLGNsaWNrZWRQb2ludCk7XG4gICAgICAgICAgaWYgKGNsaWNrZWRQb2ludFswXSAhPSAwIHx8IGNsaWNrZWRQb2ludFsxXSAhPSAwIHx8IGNsaWNrZWRQb2ludFsyXSAhPSAwIHx8IGNsaWNrZWRQb2ludFszXSAhPSAwKSB7XG4gICAgICAgICAgICB2YXIgY2xpY2tlZGxldHRlcjtcbiAgICAgICAgICAgIHZhciBkaXN0VG9DZW4gPSBJbmZpbml0eTtcbiAgICAgICAgICAgIGZvciAodmFyIGlpID0gMDsgaWkgPCBsZXR0ZXJQYXJhbXMubGVuZ3RoOyBpaSsrKSB7XG4gICAgICAgICAgICAgIHZhciBjZW50ZXJPbkNhbnZhcyA9ICgwLjUgLSAobGV0dGVyUGFyYW1zLmxlbmd0aCAtIDEpICogY2FudmFzU3BhY2luZyAvIDIgKyBpaSAqIGNhbnZhc1NwYWNpbmcpICogZ2wuY2FudmFzLndpZHRoO1xuICAgICAgICAgICAgICBpZiAoTWF0aC5hYnMoY2VudGVyT25DYW52YXMgLSBtb3VzZWNsaWNrZWRbMF0pIDwgZGlzdFRvQ2VuKSB7XG4gICAgICAgICAgICAgICAgZGlzdFRvQ2VuID0gTWF0aC5hYnMoY2VudGVyT25DYW52YXMgLSBtb3VzZWNsaWNrZWRbMF0pO1xuICAgICAgICAgICAgICAgIGNsaWNrZWRsZXR0ZXIgPSBpaTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFsZXR0ZXJQYXJhbXNbY2xpY2tlZGxldHRlcl0uc3Bpbm5pbmcpIHtcbiAgICAgICAgICAgICAgbGV0dGVyUGFyYW1zW2NsaWNrZWRsZXR0ZXJdLnNwaW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgICAgbGV0dGVyUGFyYW1zW2NsaWNrZWRsZXR0ZXJdLnRpbWUgPSAwLjA7XG4gICAgICAgICAgICAgIGxldHRlclBhcmFtc1tjbGlja2VkbGV0dGVyXS5hY2NlbCA9IChNYXRoLmZsb29yKGRpc3RUb0NlbiAvIChjYW52YXNTcGFjaW5nICogMC41ICogY2FudmFzLndpZHRoICogMC4yNSkpICsgMSkgKiAzNjAgKiAyIC8gMzYuMCAvIDM2LjA7XG4gICAgICAgICAgICAgIGxldHRlclBhcmFtc1tjbGlja2VkbGV0dGVyXS5zcGluU3BlZWQgPSBsZXR0ZXJQYXJhbXNbY2xpY2tlZGxldHRlcl0uYWNjZWwgKiAzNi4wO1xuICAgICAgICAgICAgICB2YXIgc291bmQgPSBuZXcgSG93bCh7XG4gICAgICAgICAgICAgICAgdXJsczogWydzb3VuZHMvY29pbnMud2F2J11cbiAgICAgICAgICAgICAgfSkucGxheSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbW91c2VjbGlja2VkID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBcbiAgICBnbC51c2VQcm9ncmFtKGxpbmVwcm9ncmFtKTtcbiAgICB1bmlmb3JtU2V0dGVycyA9IGNyZWF0ZVVuaWZvcm1TZXR0ZXJzKGdsLCBsaW5lcHJvZ3JhbSk7XG4gICAgYXR0cmliU2V0dGVycyAgPSBjcmVhdGVBdHRyaWJ1dGVTZXR0ZXJzKGdsLCBsaW5lcHJvZ3JhbSk7XG4gICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IGxldHRlclBhcmFtcy5sZW5ndGg7IGlpKyspIHtcbiAgICAgIGlmIChsZXR0ZXJQYXJhbXNbaWldLnJlbmRlck9yTm90KSB7XG4gICAgICAgIHZhciBjZW50ZXJ4ID0gLSgobGV0dGVyUGFyYW1zLmxlbmd0aCAtIDEpICogY2FudmFzU3BhY2luZyAqIDIgLyAyKSArIGlpICogY2FudmFzU3BhY2luZyAqIDI7XG4gICAgICAgIHVuaWZvcm1zRm9yTGluZS51X2NlbnRlcnggPSB2ZWM0LmZyb21WYWx1ZXMoY2VudGVyeCwgMCwgMCwgMCk7XG4gICAgICAgIHVuaWZvcm1zRm9yTGluZS51X2hlaWdodEN1dCA9IDEgLSBsZXR0ZXJQYXJhbXNbaWldLmxpbmV0b3AgKiAyO1xuICAgICAgICBzZXRCdWZmZXJzQW5kQXR0cmlidXRlcyhnbCwgYXR0cmliU2V0dGVycywgbGluZUJ1ZmZlckluZm8pO1xuICAgICAgICBzZXRVbmlmb3Jtcyh1bmlmb3JtU2V0dGVycywgdW5pZm9ybXNGb3JMaW5lKTtcbiAgICAgICAgZ2wubGluZVdpZHRoKDEuMCk7XG4gICAgICAgIGdsLmRyYXdFbGVtZW50cyhnbC5MSU5FUywgMiwgZ2wuVU5TSUdORURfU0hPUlQsIDApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShkcmF3U2NlbmUpO1xuICB9XG59XG5cbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
