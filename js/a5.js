///<reference path='./typings/tsd.d.ts'/>
///<reference path="./localTypings/webglutils.d.ts"/>
define(["require", "exports", './loader'], function (require, exports, loader) {
    var keypressedOrNot = false;
    var keypressed = undefined;
    var mouseclicked = undefined;
    var leftBorder = 0.0625;
    var rightBorder = 0.9383;
    var canvasSpacing = (rightBorder - leftBorder) / 12;
    ////////////////////////////////////////////////////////////////////////////////////////////
    // stats module by mrdoob (https://github.com/mrdoob/stats.js) to show the performance 
    // of your graphics
    var stats = new Stats();
    stats.setMode(1); // 0: fps, 1: ms, 2: mb
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.right = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);
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
    document.onkeydown = function (event) {
        keypressed = event.keyCode;
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
        // turn on backface culling and zbuffering
        //gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
        // attempt to download and set up our GLSL shaders.  When they download, processed to the next step
        // of our program, the "main" routing
        // 
        // YOU SHOULD MODIFY THIS TO DOWNLOAD ALL YOUR SHADERS and set up all four SHADER PROGRAMS,
        // THEN PASS AN ARRAY OF PROGRAMS TO main().  You'll have to do other things in main to deal
        // with multiple shaders and switch between them
        loader.loadFiles(['shaders/a3-shader.vert', 'shaders/a3-shader.frag'], function (shaderText) {
            var program = createProgramFromSources(gl, shaderText);
            main(gl, program);
        }, function (url) {
            alert('Shader failed to download "' + url + '"');
        });
    }
    ////////////////////////////////////////////////////////////////////////////////////////////
    // webGL is set up, and our Shader program has been created.  Finish setting up our webGL application       
    function main(gl, program) {
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
        var bufferInfo = createBufferInfoFromArrays(gl, arrays);
        var cameraAngleRadians = degToRad(0);
        var fieldOfViewRadians = degToRad(60);
        var cameraHeight = 50;
        var uniformsThatAreTheSameForAllObjects = {
            u_lightWorldPos: [50, 30, -100],
            u_viewInverse: mat4.create(),
            u_lightColor: [1, 1, 1, 1],
            u_ambient: [0.1, 0.1, 0.1, 0.1]
        };
        var uniformsThatAreComputedForEachObject = {
            u_worldViewProjection: mat4.create(),
            u_world: mat4.create(),
            u_worldInverseTranspose: mat4.create(),
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
        // Draw the scene.
        function drawScene(time) {
            // var ctx = canvas.getContext("2d");
            // ctx.rect(20,20,150,100);
            // ctx.fillStyle="red";
            // ctx.fill();
            time *= 0.001;
            // measure time taken for the little stats meter
            stats.begin();
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
                if (keypressed == 27) {
                    letterParams = [];
                }
                else {
                    //beginning = beginning % letterParams.length;
                    var adder = {
                        height: rand(-200, 200),
                        u_colorMult: chroma.hsv(rand(baseColor, baseColor + 120), 0.5, 1).gl(),
                        time: 0.0,
                        rotationMatrixZ: mat4.create(),
                        rotationMatrixY: mat4.create(),
                        letterMod: undefined,
                        renderOrNot: true,
                        spinning: false,
                        spinSpeed: 0.0,
                        accel: 0.0
                    };
                    if (keypressed == 32) {
                        adder.renderOrNot = false;
                    }
                    else {
                        var rotateZAng = degToRad(rand(-60, 60));
                        var zAxis = vec3.transformMat4(axisVector, vec3.fromValues(0, 0, 1), mat4.create());
                        mat4.rotate(adder.rotationMatrixZ, mat4.create(), rotateZAng, zAxis);
                    }
                    letterParams.push(adder);
                    keypressed = undefined;
                }
            }
            // // Set the uniforms we just computed
            var spacing = 140 / Math.max(12, letterParams.length - 1);
            for (var ii = 0; ii < letterParams.length; ii++) {
                if (letterParams[ii].renderOrNot) {
                    mat4.copy(matrix, letterParams[ii].rotationMatrixY);
                    if (letterParams[ii].spinning) {
                        if (letterParams[ii].time < 34.0) {
                            letterParams[ii].time += 1.0;
                            var yAxis = vec3.transformMat4(axisVector, vec3.fromValues(0, 1, 0), mat4.create());
                            //mat4.invert(matrix, matrix);
                            mat4.rotate(matrix, matrix, degToRad(letterParams[ii].spinSpeed), yAxis);
                            console.log(letterParams[ii].spinSpeed, letterParams[ii].accel);
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
                                console.log((Math.floor(distToCen / (canvasSpacing * 0.5 * canvas.width * 0.25)) + 1));
                                letterParams[clickedletter].accel = (Math.floor(distToCen / (canvasSpacing * 0.5 * canvas.width * 0.25)) + 1) * 360 * 2 / 36.0 / 36.0;
                                letterParams[clickedletter].spinSpeed = letterParams[clickedletter].accel * 36.0;
                            }
                        }
                        else {
                            console.log("sure");
                        }
                    }
                }
                mouseclicked = undefined;
            }
            // stats meter
            stats.end();
            requestAnimationFrame(drawScene);
        }
    }
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImE1LnRzIl0sIm5hbWVzIjpbIm9mZnNldCIsImluaXRXZWJHTCIsIm1haW4iLCJtYWluLmRyYXdTY2VuZSJdLCJtYXBwaW5ncyI6IkFBQUEseUNBQXlDO0FBQ3pDLHFEQUFxRDs7SUFnQnJELElBQUksZUFBZSxHQUFHLEtBQUssQ0FBQztJQUM1QixJQUFJLFVBQVUsR0FBRyxTQUFTLENBQUM7SUFDM0IsSUFBSSxZQUFZLEdBQUcsU0FBUyxDQUFDO0lBQzdCLElBQUksVUFBVSxHQUFHLE1BQU0sQ0FBQztJQUN4QixJQUFJLFdBQVcsR0FBRyxNQUFNLENBQUM7SUFDekIsSUFBSSxhQUFhLEdBQUcsQ0FBQyxXQUFXLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3BELDRGQUE0RjtJQUM1Rix1RkFBdUY7SUFDdkYsbUJBQW1CO0lBQ25CLElBQUksS0FBSyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7SUFDeEIsS0FBSyxDQUFDLE9BQU8sQ0FBRSxDQUFDLENBQUUsQ0FBQyxDQUFDLHVCQUF1QjtJQUUzQyxLQUFLLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO0lBQzdDLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDckMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQztJQUVuQyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBRSxLQUFLLENBQUMsVUFBVSxDQUFFLENBQUM7SUFFOUMsNEZBQTRGO0lBQzVGLFlBQVk7SUFDWixJQUFJLElBQUksR0FBRyxVQUFTLEdBQVcsRUFBRSxHQUFZO1FBQzNDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDO1lBQ3RCLEdBQUcsR0FBRyxHQUFHLENBQUM7WUFDVixHQUFHLEdBQUcsQ0FBQyxDQUFDO1FBQ1YsQ0FBQztRQUNELE1BQU0sQ0FBQyxHQUFH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LElBQUksYUFBYSxHQUFHLEVBQUUsQ0FBQztRQUN2QixHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLEdBQUcsTUFBTSxDQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDO1lBQzdELElBQUksU0FBUyxHQUFHLE1BQU0sQ0FBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzFDLE1BQU0sQ0FBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBRSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBRSxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDekYsTUFBTSxDQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUM7UUFFM0UsQ0FBQztRQUNELEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsR0FBRyxNQUFNLENBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxJQUFFLENBQUMsRUFBRSxDQUFDO1lBQzFELElBQUksU0FBUyxHQUFHLE1BQU0sQ0FBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzFDLE1BQU0sQ0FBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBRSxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMxRCxNQUFNLENBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDO1FBQzVDLENBQUM7UUFDRCxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2hC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QSxDQUFDQSxDQUFDQSxDQUFDQTtvQkFDckJBLFlBQVlBLEdBQUdBLEVBQUVBLENBQUNBO2dCQUNwQkEsQ0FBQ0E7Z0JBQUNBLElBQUlBLENBQUNBLENBQUNBO29CQUNSQSw4Q0FBOENBO29CQUM1Q0EsSUFBSUEsS0FBS0EsR0FBR0E7d0JBQ1ZBLE1BQU1BLEVBQUVBLElBQUlBLENBQUNBLENBQUNBLEdBQUdBLEVBQUVBLEdBQUdBLENBQUNBO3dCQUN2QkEsV0FBV0EsRUFBRUEsTUFBTUEsQ0FBQ0EsR0FBR0EsQ0FBQ0EsSUFBSUEsQ0FBQ0EsU0FBU0EsRUFBRUEsU0FBU0EsR0FBR0EsR0FBR0EsQ0FBQ0EsRUFBRUEsR0FBR0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsRUFBRUEsRUFBRUE7d0JBQ3RFQSxJQUFJQSxFQUFFQSxHQUFHQTt3QkFDVEEsZUFBZUEsRUFBRUEsSUFBSUEsQ0FBQ0EsTUFBTUEsRUFBRUE7d0JBQzlCQSxlQUFlQSxFQUFFQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQTt3QkFDOUJBLFNBQVNBLEVBQUVBLFNBQVNBO3dCQUNwQkEsV0FBV0EsRUFBRUEsSUFBSUE7d0JBQ2pCQSxRQUFRQSxFQUFFQSxLQUFLQTt3QkFDZkEsU0FBU0EsRUFBRUEsR0FBR0E7d0JBQ2RBLEtBQUtBLEVBQUVBLEdBQUdBO3FCQUNYQSxDQUFBQTtvQkFDREEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsVUFBVUEsSUFBSUEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7d0JBQ3JCQSxLQUFLQSxDQUFDQSxXQUFXQSxHQUFHQSxLQUFLQSxDQUFDQTtvQkFDNUJBLENBQUNBO29CQUFDQSxJQUFJQSxDQUFDQSxDQUFDQTt3QkFDTkEsSUFBSUEsVUFBVUEsR0FBR0EsUUFBUUEsQ0FBQ0EsSUFBSUEsQ0FBQ0EsQ0FBQ0EsRUFBRUEsRUFBRUEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7d0JBQ3pDQSxJQUFJQSxLQUFLQSxHQUFHQSxJQUFJQSxDQUFDQSxhQUFhQSxDQUFDQSxVQUFVQSxFQUFFQSxJQUFJQSxDQUFDQSxVQUFVQSxDQUFDQSxDQUFDQSxFQUFDQSxDQUFDQSxFQUFDQSxDQUFDQSxDQUFDQSxFQUFFQSxJQUFJQSxDQUFDQSxNQUFNQSxFQUFFQSxDQUFDQSxDQUFDQTt3QkFDbEZBLElBQUlBLENBQUNBLE1BQU1BLENBQUNBLEtBQUtBLENBQUNBLGVBQWVBLEVBQUVBLElBQUlBLENBQUNBLE1BQU1BLEVBQUVBLEVBQUVBLFVBQVVBLEVBQUVBLEtBQUtBLENBQUNBLENBQUNBO29CQUN2RUEsQ0FBQ0E7b0JBQ0RBLFlBQVlBLENBQUNBLElBQUlBLENBQUNBLEtBQUtBLENBQUNBLENBQUNBO29CQUN6QkEsVUFBVUEsR0FBR0EsU0FBU0EsQ0FBQ0E7Z0JBQ3pCQSxDQUFDQTtZQUNIQSxDQUFDQTtZQUNEQSx1Q0FBdUNBO1lBQ3ZDQSxJQUFJQSxPQUFPQSxHQUFHQSxHQUFHQSxHQUFHQSxJQUFJQSxDQUFDQSxHQUFHQSxDQUFDQSxFQUFFQSxFQUFFQSxZQUFZQSxDQUFDQSxNQUFNQSxHQUFHQSxDQUFDQSxDQUFDQSxDQUFDQTtZQUMxREEsR0FBR0EsQ0FBQ0EsQ0FBQ0EsR0FBR0EsQ0FBQ0EsRUFBRUEsR0FBR0EsQ0FBQ0EsRUFBRUEsRUFBRUEsR0FBR0EsWUFBWUEsQ0FBQ0EsTUFBTUEsRUFBRUEsRUFBRUEsRUFBRUEsRUFBRUEsQ0FBQ0E7Z0JBQ2hEQSxFQUFFQSxDQUFDQSxDQUFDQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxXQUFXQSxDQUFDQSxDQUFDQSxDQUFDQTtvQkFDakNBLElBQUlBLENBQUNBLElBQUlBLENBQUNBLE1BQU1BLEVBQUVBLFlBQVlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLGVBQWVBLENBQUNBLENBQUNBO29CQUNwREEsRUFBRUEsQ0FBQ0EsQ0FBQ0EsWUFBWUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsUUFBUUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7d0JBQzlCQSxFQUFFQSxDQUFDQSxDQUFDQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxJQUFJQSxHQUFHQSxJQUFJQSxDQUFDQSxDQUFDQSxDQUFDQTs0QkFDakNBLFlBQVlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLElBQUlBLElBQUlBLEdBQUdBLENBQUNBOzRCQUM3QkEsSUFBSUEsS0FBS0EsR0FBR0EsSUFBSUEsQ0FBQ0EsYUFBYUEsQ0FBQ0EsVUFBVUEsRUFBRUEsSUFBSUEsQ0FBQ0EsVUFBVUEsQ0FBQ0EsQ0FBQ0EsRUFBQ0EsQ0FBQ0EsRUFBQ0EsQ0FBQ0EsQ0FBQ0EsRUFBRUEsSUFBSUEsQ0FBQ0EsTUFBTUEsRUFBRUEsQ0FBQ0EsQ0FBQ0E7NEJBQ2xGQSw4QkFBOEJBOzRCQUM5QkEsSUFBSUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsTUFBTUEsRUFBRUEsTUFBTUEsRUFBRUEsUUFBUUEsQ0FBQ0EsWUFBWUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsU0FBU0EsQ0FBQ0EsRUFBRUEsS0FBS0EsQ0FBQ0EsQ0FBQ0E7NEJBQ3pFQSxPQUFPQSxDQUFDQSxHQUFHQSxDQUFDQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxTQUFTQSxFQUFFQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxLQUFLQSxDQUFDQSxDQUFDQTs0QkFDaEVBLFlBQVlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLEdBQUdBLFlBQVlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLFNBQVNBLEdBQUdBLFlBQVlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLEtBQUtBLENBQUNBO3dCQUNuRkEsQ0FBQ0E7d0JBQUNBLElBQUlBLENBQUNBLENBQUNBOzRCQUNOQSxZQUFZQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxJQUFJQSxHQUFHQSxHQUFHQSxDQUFDQTs0QkFDNUJBLFlBQVlBLENBQUNBLEVBQUVBLENBQUNBLENBQUNBLFFBQVFBLEdBQUdBLEtBQUtBLENBQUNBOzRCQUNsQ0EsWUFBWUEsQ0FBQ0EsRUFBRUEsQ0FBQ0EsQ0FBQ0EsU0FBU0EsR0FBR0EsR0FBR0EsQ0FBQ0E7NEJBQ2pDQSxZQUFZQSxDQUFDQSxFQUFFQSxD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QTtZQUNEQSxFQUFFQSxDQUFDQSxDQUFDQSxZQUFZQSxDQUFDQSxDQUFDQSxDQUFDQTtnQkFDakJBLEVBQUVBLENBQUNBLENBQUNBLE1BQU1BLENBQUNBLENBQUNBLENBQUNBO29CQUNYQSxFQUFFQSxDQUFDQSxDQUFDQSxFQUFFQSxDQUFDQSxDQUFDQSxDQUFDQTt3QkFDUEEsSUFBSUEsWUFBWUEsR0FBR0EsSUFBSUEsVUFBVUEsQ0FBQ0EsQ0FBQ0EsQ0FBQ0EsQ0FBQ0E7d0JBQ3JDQSxFQUFFQSxDQUFDQSxVQUFVQSxDQUFDQSxZQUFZQSxDQUFDQSxDQUFDQSxDQUFDQSxFQUFDQSxFQUFFQSxDQUFDQSxNQUFNQSxDQUFDQSxNQUFNQSxHQUFHQSxZQUFZQSxDQUFDQSxDQUFDQSxDQUFDQSxFQUFDQSxDQUFDQSxFQUFDQSxDQUFDQSxFQUFDQSxFQUFFQSxDQUFDQSxJQUFJQSxFQUFDQSxFQUFFQSxDQUFDQSxhQUFhQSxFQUFDQSxZQUFZQSxDQUFDQSxDQUFDQTt3QkFDNUdBLEVBQUVBLENBQUNBLENBQUNBLFlBQVlBLENBQUNBLENBQUNBLENBQUNBLElBQUlBLENBQUNBLElBQUlBLFlBQVlBLENBQUNBLENBQUNBLENBQUNBLElBQUlBLENBQUNBLElBQUlBLFlBQVlBLENBQUNBLENBQUNBLENBQUNBLElBQUlBLENBQUNBLElBQUlBLFlBQVlBLENBQUNBLENBQUNBLENBQUNBLElBQUlBLENBQUNBLENBQUNBLENBQUNBLENBQUNBOzRCQUNqR0EsSUFBSUEsYUFBYUEsQ0FBQ0E7NEJBQ2xCQSxJQUFJQSxTQUFTQSxHQUFHQSxRQUFRQSxDQUFDQTs0QkFDekJBLEdBQUdBLENBQUNBLENBQUNBLEdBQUdBLENBQUNBLEVBQUVBLEdBQUdBLENBQUNBLEVBQUVBLEVBQUVBLEdBQUdBLFlBQVlBLENBQUNBLE1BQU1BLEVBQUVBLEVBQUVBLEVBQUVBLEVBQUVBLENBQUNBO2dDQUNoREEsSUFBSUEsY0FBY0EsR0FBR0EsQ0FBQ0EsR0FBR0EsR0FBR0EsQ0FBQ0EsWUFBWUEsQ0FBQ0EsTUFBTUEsR0FBR0EsQ0FBQ0EsQ0FBQ0EsR0FBR0EsYUFBYUEsR0FBR0EsQ0FBQ0EsR0FBR0EsRUFBRUEsR0FBR0EsYUFBYUEsQ0FBQ0EsR0FBR0EsRUFBRUEsQ0FBQ0EsTUFBTUEsQ0FBQ0EsS0FBS0EsQ0FBQ0E7Z0NBQ2xIQSxFQUFFQSxDQUFDQSxDQUFDQSxJQUFJQSxDQUFDQSxHQUFHQSxDQUFDQSxjQUFjQSxHQUFHQSxZQUFZQSxDQUFDQSxDQUFDQSxDQUFDQSxDQUFDQSxHQUFHQSxTQUFTQSxDQUFDQSxDQUFDQSxDQUFDQTtvQ0FDM0RBLFNBQVNBLEdBQUdBLElBQUlBLENBQUNBLEdBQUdBLENBQUNBLGNBQWNBLEdBQUdBLFlBQVlBLENBQUNBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO29DQUN2REEsYUFBYUEsR0FBR0EsRUFBRUEsQ0FBQ0E7Z0NBQ3JCQSxDQUFDQTs0QkFDSEEsQ0FBQ0E7NEJBQ0RBLEVBQUVBLENBQUNBLENBQUNBLENBQUNBLFlBQVlBLENBQUNBLGFBQWFBLENBQUNBLENBQUNBLFFBQVFBLENBQUNBLENBQUNBLENBQUNBO2dDQUMxQ0EsWUFBWUEsQ0FBQ0EsYUFBYUEsQ0FBQ0EsQ0FBQ0EsUUFBUUEsR0FBR0EsSUFBSUEsQ0FBQ0E7Z0NBQzVDQSxZQUFZQSxDQUFDQSxhQUFhQSxDQUFDQSxDQUFDQSxJQUFJQSxHQUFHQSxHQUFHQSxDQUFDQTtnQ0FDdkNBLE9BQU9BLENBQUNBLEdBQUdBLENBQUNBLENBQUNBLElBQUlBLENBQUNBLEtBQUtBLENBQUNBLFNBQVNBLEdBQUdBLENBQUNBLGFBQWFBLEdBQUdBLEdBQUdBLEdBQUdBLE1BQU1BLENBQUNBLEtBQUtBLEdBQUdBLElBQUlBLENBQUNBLENBQUNBLEdBQUdBLENBQUNBLENBQUNBLENBQUNBLENBQUNBO2dDQUN2RkEsWUFBWUEsQ0FBQ0EsYUFBYUEsQ0FBQ0EsQ0FBQ0EsS0FBS0EsR0FBR0EsQ0FBQ0EsSUFBSUEsQ0FBQ0EsS0FBS0EsQ0FBQ0EsU0FBU0EsR0FBR0EsQ0FBQ0EsYUFBYUEsR0FBR0EsR0FBR0EsR0FBR0EsTUFBTUEsQ0FBQ0EsS0FBS0EsR0FBR0EsSUFBSUEsQ0FBQ0EsQ0FBQ0EsR0FBR0EsQ0FBQ0EsQ0FBQ0EsR0FBR0EsR0FBR0EsR0FBR0EsQ0FBQ0EsR0FBR0EsSUFBSUEsR0FBR0EsSUFBSUEsQ0FBQ0E7Z0NBQ3RJQSxZQUFZQSxDQUFDQSxhQUFhQSxDQUFDQSxDQUFDQSxTQUFTQSxHQUFHQSxZQUFZQSxDQUFDQSxhQUFhQSxDQUFDQSxDQUFDQSxLQUFLQSxHQUFHQSxJQUFJQSxDQUFDQTs0QkFDbkZBLENBQUNBO3dCQUNIQSxDQUFDQTt3QkFBQ0EsSUFBSUEsQ0FBQ0EsQ0FBQ0E7NEJBQ05BLE9BQU9BLENBQUNBLEdBQUdBLENBQUNBLE1BQU1BLENBQUNBLENBQUNBO3dCQUN0QkEsQ0FBQ0E7b0JBQ0hBLENBQUNBO2dCQUNIQSxDQUFDQTtnQkFDREEsWUFBWUEsR0FBR0EsU0FBU0EsQ0FBQ0E7WUFDM0JBLENBQUNBO1lBQ0RBLGNBQWNBO1lBQ2RBLEtBQUtBLENBQUNBLEdBQUdBLEVBQUVBLENBQUNBO1lBRVpBLHFCQUFxQkEsQ0FBQ0EsU0FBU0EsQ0FBQ0EsQ0FBQ0E7UUFDbkNBLENBQUNBO0lBQ0hELENBQUNBIiwiZmlsZSI6ImE1LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8vPHJlZmVyZW5jZSBwYXRoPScuL3R5cGluZ3MvdHNkLmQudHMnLz5cbi8vLzxyZWZlcmVuY2UgcGF0aD1cIi4vbG9jYWxUeXBpbmdzL3dlYmdsdXRpbHMuZC50c1wiLz5cblxuLypcbiAqIFBvcnRpb25zIG9mIHRoaXMgY29kZSBhcmVcbiAqIENvcHlyaWdodCAyMDE1LCBCbGFpciBNYWNJbnR5cmUuXG4gKiBcbiAqIFBvcnRpb25zIG9mIHRoaXMgY29kZSB0YWtlbiBmcm9tIGh0dHA6Ly93ZWJnbGZ1bmRhbWVudGFscy5vcmcsIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9ncmVnZ21hbi93ZWJnbC1mdW5kYW1lbnRhbHNcbiAqIGFuZCBhcmUgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGxpY2Vuc2UuICBJbiBwYXJ0aWN1bGFyLCBmcm9tIFxuICogICAgaHR0cDovL3dlYmdsZnVuZGFtZW50YWxzLm9yZy93ZWJnbC93ZWJnbC1sZXNzLWNvZGUtbW9yZS1mdW4uaHRtbFxuICogICAgaHR0cDovL3dlYmdsZnVuZGFtZW50YWxzLm9yZy93ZWJnbC9yZXNvdXJjZXMvcHJpbWl0aXZlcy5qc1xuICogXG4gKiBUaG9zZSBwb3J0aW9ucyBDb3B5cmlnaHQgMjAxNCwgR3JlZ2cgVGF2YXJlcy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKi9cblxuaW1wb3J0IGxvYWRlciA9IHJlcXVpcmUoJy4vbG9hZGVyJyk7XG52YXIga2V5cHJlc3NlZE9yTm90ID0gZmFsc2U7XG52YXIga2V5cHJlc3NlZCA9IHVuZGVmaW5lZDtcbnZhciBtb3VzZWNsaWNrZWQgPSB1bmRlZmluZWQ7XG52YXIgbGVmdEJvcmRlciA9IDAuMDYyNTtcbnZhciByaWdodEJvcmRlciA9IDAuOTM4MztcbnZhciBjYW52YXNTcGFjaW5nID0gKHJpZ2h0Qm9yZGVyIC0gbGVmdEJvcmRlcikgLyAxMjtcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBzdGF0cyBtb2R1bGUgYnkgbXJkb29iIChodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3N0YXRzLmpzKSB0byBzaG93IHRoZSBwZXJmb3JtYW5jZSBcbi8vIG9mIHlvdXIgZ3JhcGhpY3NcbnZhciBzdGF0cyA9IG5ldyBTdGF0cygpO1xuc3RhdHMuc2V0TW9kZSggMSApOyAvLyAwOiBmcHMsIDE6IG1zLCAyOiBtYlxuXG5zdGF0cy5kb21FbGVtZW50LnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbnN0YXRzLmRvbUVsZW1lbnQuc3R5bGUucmlnaHQgPSAnMHB4JztcbnN0YXRzLmRvbUVsZW1lbnQuc3R5bGUudG9wID0gJzBweCc7XG5cbmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIHN0YXRzLmRvbUVsZW1lbnQgKTtcblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIHV0aWxpdGllc1xudmFyIHJhbmQgPSBmdW5jdGlvbihtaW46IG51bWJlciwgbWF4PzogbnVtYmVyKSB7XG4gIGlmIChtYXggPT09IHVuZGVmaW5lZCkge1xuICAgIG1heCA9IG1pbjtcbiAgICBtaW4gPSAwO1xuICB9XG4gIHJldHVybiBtaW4gKyBNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbik7XG59O1xuXG52YXIgcmFuZEludCA9IGZ1bmN0aW9uKHJhbmdlKSB7XG4gIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiByYW5nZSk7XG59O1xudmFyIGRlZ1RvUmFkID0gZnVuY3Rpb24oZCkge1xuICByZXR1cm4gZCAqIE1hdGguUEkgLyAxODA7XG59XG5cbnZhciBnZW5lcmF0ZUFycmF5cyA9IGZ1bmN0aW9uKG51bXNPZnZlcnRleEluT25lQXhpczogbnVtYmVyKSB7XG4gIHZhciBhcnJheXMgPSB7XG4gICAgcG9zaXRpb246IHsgbnVtQ29tcG9uZW50czogMywgZGF0YTogW119LFxuICAgIHRleGNvb3JkOiB7IG51bUNvbXBvbmVudHM6IDIsIGRhdGE6IFtdfSxcbiAgICBub3JtYWw6ICAgeyBudW1Db21wb25lbnRzOiAzLCBkYXRhOiBbXX0sXG4gICAgaW5kaWNlczogIHsgbnVtQ29tcG9uZW50czogMywgZGF0YTogW119LFxuICB9O1xuICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgbnVtc09mdmVydGV4SW5PbmVBeGlzOyBpaSsrKSB7XG4gICAgZm9yICh2YXIgamogPSAwOyBqaiA8IG51bXNPZnZlcnRleEluT25lQXhpczsgamorKykge1xuICAgICAgYXJyYXlzLnBvc2l0aW9uLmRhdGEucHVzaChqaiAqICgxMC4wIC8gKG51bXNPZnZlcnRleEluT25lQXhpcyAtIDEpKSAtIDUuMCwgaWkgKiAoMTAuMCAvIChudW1zT2Z2ZXJ0ZXhJbk9uZUF4aXMgLSAxKSkgLSA1LjAsIDApO1xuICAgICAgYXJyYXlzLnRleGNvb3JkLmRhdGEucHVzaChqaiAqICgxLjAgLyAobnVtc09mdmVydGV4SW5PbmVBeGlzIC0gMSkpLCBpaSAqICgxLjAgLyAobnVtc09mdmVydGV4SW5PbmVBeGlzIC0gMSkpKTtcbiAgICAgIGFycmF5cy5ub3JtYWwuZGF0YS5wdXNoKDAsIDAsIC0xKTtcbiAgICAgIGlmICgoaWkgIT0gbnVtc09mdmVydGV4SW5PbmVBeGlzIC0gMSkgJiYgKGpqICE9IG51bXNPZnZlcnRleEluT25lQXhpcyAtIDEpKSB7XG4gICAgICAgIGFycmF5cy5pbmRpY2VzLmRhdGEucHVzaChqaiArIGlpICogbnVtc09mdmVydGV4SW5PbmVBeGlzLCBqaiArIGlpICogbnVtc09mdmVydGV4SW5PbmVBeGlzICsgMSwgamogKyAoaWkgKyAxKSAqIG51bXNPZnZlcnRleEluT25lQXhpcyk7XG4gICAgICAgIGFycmF5cy5pbmRpY2VzLmRhdGEucHVzaChqaiArIGlpICogbnVtc09mdmVydGV4SW5PbmVBeGlzICsgMSwgamogKyAoaWkgKyAxKSAqIG51bXNPZnZlcnRleEluT25lQXhpcywgamogKyAoaWkgKyAxKSAqIG51bXNPZnZlcnRleEluT25lQXhpcyArIDEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB2YXIgdHJ1ZVRleHRjb29yZCA9IFtdO1xuICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgYXJyYXlzIC50ZXhjb29yZC5kYXRhLmxlbmd0aCAvIDI7IGlpKyspIHtcbiAgICB2YXIgdGVtcGVudHJ5ID0gYXJyYXlzIC50ZXhjb29yZC5kYXRhW2lpXTtcbiAgICBhcnJheXMgLnRleGNvb3JkLmRhdGFbaWldID0gYXJyYXlzIC50ZXhjb29yZC5kYXRhW2FycmF5cyAudGV4Y29vcmQuZGF0YS5sZW5ndGggLSBpaSAtIDFdO1xuICAgIGFycmF5cyAudGV4Y29vcmQuZGF0YVthcnJheXMgLnRleGNvb3JkLmRhdGEubGVuZ3RoIC0gaWkgLSAxXSA9IHRlbXBlbnRyeTtcbiAgICBcbiAgfVxuICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgYXJyYXlzIC50ZXhjb29yZC5kYXRhLmxlbmd0aDsgaWkrPTIpIHtcbiAgICB2YXIgdGVtcGVudHJ5ID0gYXJyYXlzIC50ZXhjb29yZC5kYXRhW2lpXTtcbiAgICBhcnJheXMgLnRleGNvb3JkLmRhdGFbaWldID0gYXJyYXlzIC50ZXhjb29yZC5kYXRhW2lpICsgMV07XG4gICAgYXJyYXlzIC50ZXhjb29yZC5kYXRhW2lpICsgMV0gPSB0ZW1wZW50cnk7XG4gIH1cbiAgcmV0dXJuIGFycmF5cztcbn1cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBnZXQgc29tZSBvZiBvdXIgY2FudmFzIGVsZW1lbnRzIHRoYXQgd2UgbmVlZFxudmFyIGNhbnZhcyA9IDxIVE1MQ2FudmFzRWxlbWVudD5kb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIndlYmdsXCIpO1xudmFyIGdldFBpeGVsQ2FudmFzID0gPEhUTUxDYW52YXNFbGVtZW50PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiZ2V0UGl4ZWxcIik7XG4vL3ZhciBteWN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiMmRcIik7XG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gc29tZSBzaW1wbGUgaW50ZXJhY3Rpb24gdXNpbmcgdGhlIG1vdXNlLlxuLy8gd2UgYXJlIGdvaW5nIHRvIGdldCBzbWFsbCBtb3Rpb24gb2Zmc2V0cyBvZiB0aGUgbW91c2UsIGFuZCB1c2UgdGhlc2UgdG8gcm90YXRlIHRoZSBvYmplY3Rcbi8vXG4vLyBvdXIgb2Zmc2V0KCkgZnVuY3Rpb24gZnJvbSBhc3NpZ25tZW50IDAsIHRvIGdpdmUgdXMgYSBnb29kIG1vdXNlIHBvc2l0aW9uIGluIHRoZSBjYW52YXMgXG5mdW5jdGlvbiBvZmZzZXQoZTogTW91c2VFdmVudCk6IEdMTS5JQXJyYXkge1xuICAgIGUgPSBlIHx8IDxNb3VzZUV2ZW50PiB3aW5kb3cuZXZlbnQ7XG5cbiAgICB2YXIgdGFyZ2V0ID0gPEVsZW1lbnQ+IGUudGFyZ2V0IHx8IGUuc3JjRWxlbWVudCxcbiAgICAgICAgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgb2Zmc2V0WCA9IGUuY2xpZW50WCAtIHJlY3QubGVmdCxcbiAgICAgICAgb2Zmc2V0WSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuXG4gICAgcmV0dXJuIHZlYzIuZnJvbVZhbHVlcyhvZmZzZXRYLCBvZmZzZXRZKTtcbn1cblxuXG5cbi8vIHN0YXJ0IHRoaW5ncyBvZmYgd2l0aCBhIGRvd24gcHJlc3NcbmNhbnZhcy5vbm1vdXNlZG93biA9IChldjogTW91c2VFdmVudCkgPT4ge1xuICAgIG1vdXNlY2xpY2tlZCA9IG9mZnNldChldik7XG59XG5cblxuZG9jdW1lbnQub25rZXlkb3duID0gKGV2ZW50OiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gIGtleXByZXNzZWQgPSBldmVudC5rZXlDb2RlO1xufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gc3RhcnQgdGhpbmdzIG9mZiBieSBjYWxsaW5nIGluaXRXZWJHTFxuaW5pdFdlYkdMKCk7XG5cbmZ1bmN0aW9uIGluaXRXZWJHTCgpIHtcbiAgLy8gZ2V0IHRoZSByZW5kZXJpbmcgY29udGV4dCBmb3Igd2ViR0xcbiAgdmFyIGdsOiBXZWJHTFJlbmRlcmluZ0NvbnRleHQgPSBnZXRXZWJHTENvbnRleHQoY2FudmFzKTtcbiAgaWYgKCFnbCkge1xuICAgIHJldHVybjsgIC8vIG5vIHdlYmdsISAgQnllIGJ5ZVxuICB9XG5cbiAgLy8gdHVybiBvbiBiYWNrZmFjZSBjdWxsaW5nIGFuZCB6YnVmZmVyaW5nXG4gIC8vZ2wuZW5hYmxlKGdsLkNVTExfRkFDRSk7XG4gIGdsLmVuYWJsZShnbC5ERVBUSF9URVNUKTtcblxuICAvLyBhdHRlbXB0IHRvIGRvd25sb2FkIGFuZCBzZXQgdXAgb3VyIEdMU0wgc2hhZGVycy4gIFdoZW4gdGhleSBkb3dubG9hZCwgcHJvY2Vzc2VkIHRvIHRoZSBuZXh0IHN0ZXBcbiAgLy8gb2Ygb3VyIHByb2dyYW0sIHRoZSBcIm1haW5cIiByb3V0aW5nXG4gIC8vIFxuICAvLyBZT1UgU0hPVUxEIE1PRElGWSBUSElTIFRPIERPV05MT0FEIEFMTCBZT1VSIFNIQURFUlMgYW5kIHNldCB1cCBhbGwgZm91ciBTSEFERVIgUFJPR1JBTVMsXG4gIC8vIFRIRU4gUEFTUyBBTiBBUlJBWSBPRiBQUk9HUkFNUyBUTyBtYWluKCkuICBZb3UnbGwgaGF2ZSB0byBkbyBvdGhlciB0aGluZ3MgaW4gbWFpbiB0byBkZWFsXG4gIC8vIHdpdGggbXVsdGlwbGUgc2hhZGVycyBhbmQgc3dpdGNoIGJldHdlZW4gdGhlbVxuICBsb2FkZXIubG9hZEZpbGVzKFsnc2hhZGVycy9hMy1zaGFkZXIudmVydCcsICdzaGFkZXJzL2EzLXNoYWRlci5mcmFnJ10sIGZ1bmN0aW9uIChzaGFkZXJUZXh0KSB7XG4gICAgdmFyIHByb2dyYW0gPSBjcmVhdGVQcm9ncmFtRnJvbVNvdXJjZXMoZ2wsIHNoYWRlclRleHQpO1xuICAgIG1haW4oZ2wsIHByb2dyYW0pO1xuICB9LCBmdW5jdGlvbiAodXJsKSB7XG4gICAgICBhbGVydCgnU2hhZGVyIGZhaWxlZCB0byBkb3dubG9hZCBcIicgKyB1cmwgKyAnXCInKTtcbiAgfSk7IFxufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gd2ViR0wgaXMgc2V0IHVwLCBhbmQgb3VyIFNoYWRlciBwcm9ncmFtIGhhcyBiZWVuIGNyZWF0ZWQuICBGaW5pc2ggc2V0dGluZyB1cCBvdXIgd2ViR0wgYXBwbGljYXRpb24gICAgICAgXG5mdW5jdGlvbiBtYWluKGdsOiBXZWJHTFJlbmRlcmluZ0NvbnRleHQsIHByb2dyYW06IFdlYkdMUHJvZ3JhbSkge1xuICBcbiAgLy8gdXNlIHRoZSB3ZWJnbC11dGlscyBsaWJyYXJ5IHRvIGNyZWF0ZSBzZXR0ZXJzIGZvciBhbGwgdGhlIHVuaWZvcm1zIGFuZCBhdHRyaWJ1dGVzIGluIG91ciBzaGFkZXJzLlxuICAvLyBJdCBlbnVtZXJhdGVzIGFsbCBvZiB0aGUgdW5pZm9ybXMgYW5kIGF0dHJpYnV0ZXMgaW4gdGhlIHByb2dyYW0sIGFuZCBjcmVhdGVzIHV0aWxpdHkgZnVuY3Rpb25zIHRvIFxuICAvLyBhbGxvdyBcInNldFVuaWZvcm1zXCIgYW5kIFwic2V0QXR0cmlidXRlc1wiIChiZWxvdykgdG8gc2V0IHRoZSBzaGFkZXIgdmFyaWFibGVzIGZyb20gYSBqYXZhc2NyaXB0IG9iamVjdC4gXG4gIC8vIFRoZSBvYmplY3RzIGhhdmUgYSBrZXkgZm9yIGVhY2ggdW5pZm9ybSBvciBhdHRyaWJ1dGUsIGFuZCBhIHZhbHVlIGNvbnRhaW5pbmcgdGhlIHBhcmFtZXRlcnMgZm9yIHRoZVxuICAvLyBzZXR0ZXIgZnVuY3Rpb25cbiAgdmFyIHVuaWZvcm1TZXR0ZXJzID0gY3JlYXRlVW5pZm9ybVNldHRlcnMoZ2wsIHByb2dyYW0pO1xuICB2YXIgYXR0cmliU2V0dGVycyAgPSBjcmVhdGVBdHRyaWJ1dGVTZXR0ZXJzKGdsLCBwcm9ncmFtKTtcblxuICB2YXIgYXJyYXlzID0gZ2VuZXJhdGVBcnJheXMoMik7XG4gIHZhciBzY2FsZUZhY3RvciA9IDEwO1xuICB2YXIgY2VudGVyID0gdmVjNC5mcm9tVmFsdWVzKDcwICogc2NhbGVGYWN0b3IsMCwwLDApO1xuICBcbiAgdmFyIGJ1ZmZlckluZm8gPSBjcmVhdGVCdWZmZXJJbmZvRnJvbUFycmF5cyhnbCwgYXJyYXlzKTtcblxuICB2YXIgY2FtZXJhQW5nbGVSYWRpYW5zID0gZGVnVG9SYWQoMCk7XG4gIHZhciBmaWVsZE9mVmlld1JhZGlhbnMgPSBkZWdUb1JhZCg2MCk7XG4gIHZhciBjYW1lcmFIZWlnaHQgPSA1MDtcblxuICB2YXIgdW5pZm9ybXNUaGF0QXJlVGhlU2FtZUZvckFsbE9iamVjdHMgPSB7XG4gICAgdV9saWdodFdvcmxkUG9zOiAgICAgICAgIFs1MCwgMzAsIC0xMDBdLFxuICAgIHVfdmlld0ludmVyc2U6ICAgICAgICAgICBtYXQ0LmNyZWF0ZSgpLFxuICAgIHVfbGlnaHRDb2xvcjogICAgICAgICAgICBbMSwgMSwgMSwgMV0sXG4gICAgdV9hbWJpZW50OiAgICAgICAgICAgICAgIFswLjEsIDAuMSwgMC4xLCAwLjFdXG4gIH07XG5cbiAgdmFyIHVuaWZvcm1zVGhhdEFyZUNvbXB1dGVkRm9yRWFjaE9iamVjdCA9IHtcbiAgICB1X3dvcmxkVmlld1Byb2plY3Rpb246ICAgbWF0NC5jcmVhdGUoKSxcbiAgICB1X3dvcmxkOiAgICAgICAgICAgICAgICAgbWF0NC5jcmVhdGUoKSxcbiAgICB1X3dvcmxkSW52ZXJzZVRyYW5zcG9zZTogbWF0NC5jcmVhdGUoKSxcbiAgfTtcblxuICAvLyB2YXIgdGV4dHVyZSA9IC4uLi4gY3JlYXRlIGEgdGV4dHVyZSBvZiBzb21lIGZvcm1cblxuICB2YXIgYmFzZUNvbG9yID0gcmFuZCgyNDApO1xuICB2YXIgb2JqZWN0U3RhdGUgPSB7IFxuICAgICAgbWF0ZXJpYWxVbmlmb3Jtczoge1xuICAgICAgICB1X2NvbG9yTXVsdDogICAgICAgICAgICAgY2hyb21hLmhzdihyYW5kKGJhc2VDb2xvciwgYmFzZUNvbG9yICsgMTIwKSwgMC41LCAxKS5nbCgpLFxuICAgICAgICAvL3VfZGlmZnVzZTogICAgICAgICAgICAgICB0ZXh0dXJlLFxuICAgICAgICB1X3NwZWN1bGFyOiAgICAgICAgICAgICAgWzAsIDAsIDAsIDFdLFxuICAgICAgICB1X3NoaW5pbmVzczogICAgICAgICAgICAgMTAwMDAsXG4gICAgICAgIHVfc3BlY3VsYXJGYWN0b3I6ICAgICAgICAwLjc1LFxuICAgICAgICB1X21vdmVUb0NlbnRlcjogICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICB1X2hlaWdodFBvczogICAgICAgICAgICAgdW5kZWZpbmVkXG4gICAgICB9XG4gIH07XG5cbiAgdmFyIGxldHRlclBhcmFtcyA9IFtdO1xuICAvLyBmb3IgKHZhciBpaSA9IDA7IGlpIDwgbGV0dGVyUGFyYW1zLmxlbmd0aDsgaWkrKykge1xuICAvLyAgIGxldHRlclBhcmFtc1tpaV0gPSB7XG4gIC8vICAgICAvL2NlbnRlclBvczogLTcwICsgaWkgKiAoMTQwIC8gKGxldHRlclBhcmFtcy5sZW5ndGggLSAxKSksXG4gIC8vICAgICBoZWlnaHQ6IDUwLFxuICAvLyAgICAgdV9jb2xvck11bHQ6IGNocm9tYS5oc3YocmFuZChiYXNlQ29sb3IsIGJhc2VDb2xvciArIDEyMCksIDAuNSwgMSkuZ2woKSxcbiAgLy8gICAgIHRpbWU6IDAuMCxcbiAgLy8gICAgIHJvdGF0aW9uTWF0cml4OiBtYXQ0LmNyZWF0ZSgpLFxuICAvLyAgICAgbGV0dGVyTW9kOiB1bmRlZmluZWQsXG4gIC8vICAgICByZW5kZXJPck5vdDogZmFsc2VcbiAgLy8gICB9O1xuICAvLyB9XG4gIFxuICB2YXIgY291bnQgPSAwO1xuICB2YXIgYmVnaW5uaW5nID0gMDtcbiAgXG4gIC8vIHNvbWUgdmFyaWFibGVzIHdlJ2xsIHJldXNlIGJlbG93XG4gIHZhciBwcm9qZWN0aW9uTWF0cml4ID0gbWF0NC5jcmVhdGUoKTtcbiAgdmFyIHZpZXdNYXRyaXggPSBtYXQ0LmNyZWF0ZSgpO1xuICB2YXIgcm90YXRpb25NYXRyaXggPSBtYXQ0LmNyZWF0ZSgpO1xuICB2YXIgbWF0cml4ID0gbWF0NC5jcmVhdGUoKTsgIC8vIGEgc2NyYXRjaCBtYXRyaXhcbiAgdmFyIGludk1hdHJpeCA9IG1hdDQuY3JlYXRlKCk7XG4gIHZhciBheGlzVmVjdG9yID0gdmVjMy5jcmVhdGUoKTtcbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGRyYXdTY2VuZSk7XG5cbiAgLy8gRHJhdyB0aGUgc2NlbmUuXG4gIGZ1bmN0aW9uIGRyYXdTY2VuZSh0aW1lOiBudW1iZXIpIHtcbiAgICAvLyB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoXCIyZFwiKTtcbiAgICAvLyBjdHgucmVjdCgyMCwyMCwxNTAsMTAwKTtcbiAgICAvLyBjdHguZmlsbFN0eWxlPVwicmVkXCI7XG4gICAgLy8gY3R4LmZpbGwoKTtcbiAgICB0aW1lICo9IDAuMDAxOyBcbiAgIFxuICAgIC8vIG1lYXN1cmUgdGltZSB0YWtlbiBmb3IgdGhlIGxpdHRsZSBzdGF0cyBtZXRlclxuICAgIHN0YXRzLmJlZ2luKCk7XG5cbiAgICAvLyBpZiB0aGUgd2luZG93IGNoYW5nZWQgc2l6ZSwgcmVzZXQgdGhlIFdlYkdMIGNhbnZhcyBzaXplIHRvIG1hdGNoLiAgVGhlIGRpc3BsYXllZCBzaXplIG9mIHRoZSBjYW52YXNcbiAgICAvLyAoZGV0ZXJtaW5lZCBieSB3aW5kb3cgc2l6ZSwgbGF5b3V0LCBhbmQgeW91ciBDU1MpIGlzIHNlcGFyYXRlIGZyb20gdGhlIHNpemUgb2YgdGhlIFdlYkdMIHJlbmRlciBidWZmZXJzLCBcbiAgICAvLyB3aGljaCB5b3UgY2FuIGNvbnRyb2wgYnkgc2V0dGluZyBjYW52YXMud2lkdGggYW5kIGNhbnZhcy5oZWlnaHRcbiAgICByZXNpemVDYW52YXNUb0Rpc3BsYXlTaXplKGNhbnZhcyk7XG5cbiAgICAvLyBTZXQgdGhlIHZpZXdwb3J0IHRvIG1hdGNoIHRoZSBjYW52YXNcbiAgICBnbC52aWV3cG9ydCgwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgIFxuICAgIC8vIENsZWFyIHRoZSBjYW52YXMgQU5EIHRoZSBkZXB0aCBidWZmZXIuXG4gICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCB8IGdsLkRFUFRIX0JVRkZFUl9CSVQpO1xuXG4gICAgLy8gQ29tcHV0ZSB0aGUgcHJvamVjdGlvbiBtYXRyaXhcbiAgICB2YXIgYXNwZWN0ID0gY2FudmFzLmNsaWVudFdpZHRoIC8gY2FudmFzLmNsaWVudEhlaWdodDtcbiAgICBtYXQ0LnBlcnNwZWN0aXZlKHByb2plY3Rpb25NYXRyaXgsZmllbGRPZlZpZXdSYWRpYW5zLCBhc3BlY3QsIDEsIDMwMDApO1xuICAgIC8vIHByb2plY3Rpb25NYXRyaXhbMTVdID0gMTtcbiAgICAvLyBjb25zb2xlLmxvZyhhc3BlY3QpO1xuICAgIC8vIG1hdDQub3J0aG8ocHJvamVjdGlvbk1hdHJpeCwgLTExNSwgMTE1LCAtNTcsIDU3LCAxLCAyMDAwKTtcbiAgICAvLyBjb25zb2xlLmxvZyhwcm9qZWN0aW9uTWF0cml4KTtcbiAgICAvLyBDb21wdXRlIHRoZSBjYW1lcmEncyBtYXRyaXggdXNpbmcgbG9vayBhdC5cbiAgICB2YXIgY2FtZXJhUG9zaXRpb24gPSBbMCwgMCwgLTgwMF07XG4gICAgdmFyIHRhcmdldCA9IFswLCAwLCAwXTtcbiAgICB2YXIgdXAgPSBbMCwgMSwgMF07XG4gICAgdmFyIGNhbWVyYU1hdHJpeCA9IG1hdDQubG9va0F0KHVuaWZvcm1zVGhhdEFyZVRoZVNhbWVGb3JBbGxPYmplY3RzLnVfdmlld0ludmVyc2UsIGNhbWVyYVBvc2l0aW9uLCB0YXJnZXQsIHVwKTtcblxuICAgIC8vIE1ha2UgYSB2aWV3IG1hdHJpeCBmcm9tIHRoZSBjYW1lcmEgbWF0cml4LlxuICAgIG1hdDQuaW52ZXJ0KHZpZXdNYXRyaXgsIGNhbWVyYU1hdHJpeCk7XG4gICAgXG4gICAgLy8gdGVsbCBXZWJHTCB0byB1c2Ugb3VyIHNoYWRlciBwcm9ncmFtICh3aWxsIG5lZWQgdG8gY2hhbmdlIHRoaXMpXG4gICAgZ2wudXNlUHJvZ3JhbShwcm9ncmFtKTtcbiAgICBcbiAgICAvLyBTZXR1cCBhbGwgdGhlIG5lZWRlZCBhdHRyaWJ1dGVzIGFuZCBidWZmZXJzLiAgXG4gICAgc2V0QnVmZmVyc0FuZEF0dHJpYnV0ZXMoZ2wsIGF0dHJpYlNldHRlcnMsIGJ1ZmZlckluZm8pO1xuXG4gICAgLy8gU2V0IHRoZSB1bmlmb3JtcyB0aGF0IGFyZSB0aGUgc2FtZSBmb3IgYWxsIG9iamVjdHMuICBVbmxpa2UgdGhlIGF0dHJpYnV0ZXMsIGVhY2ggdW5pZm9ybSBzZXR0ZXJcbiAgICAvLyBpcyBkaWZmZXJlbnQsIGRlcGVuZGluZyBvbiB0aGUgdHlwZSBvZiB0aGUgdW5pZm9ybSB2YXJpYWJsZS4gIExvb2sgaW4gd2ViZ2wtdXRpbC5qcyBmb3IgdGhlXG4gICAgLy8gaW1wbGVtZW50YXRpb24gb2YgIHNldFVuaWZvcm1zIHRvIHNlZSB0aGUgZGV0YWlscyBmb3Igc3BlY2lmaWMgdHlwZXMgICAgICAgXG4gICAgc2V0VW5pZm9ybXModW5pZm9ybVNldHRlcnMsIHVuaWZvcm1zVGhhdEFyZVRoZVNhbWVGb3JBbGxPYmplY3RzKTtcbiAgIFxuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyBDb21wdXRlIHRoZSB2aWV3IG1hdHJpeCBhbmQgY29ycmVzcG9uZGluZyBvdGhlciBtYXRyaWNlcyBmb3IgcmVuZGVyaW5nLlxuICAgIC8vIGZpcnN0IG1ha2UgYSBjb3B5IG9mIG91ciByb3RhdGlvbk1hdHJpeFxuICAgIC8vIGNvbnNvbGUubG9nKG1hdHJpeCk7XG4gICAgLy8gY29uc29sZS5sb2cocm90YXRpb25NYXRyaXgpO1xuICAgIC8vbWF0NC50cmFuc2xhdGUobWF0cml4LCBtYXRyaXgsIFstY2VudGVyWzBdICogc2NhbGVGYWN0b3IsIC1jZW50ZXJbMV0gKiBzY2FsZUZhY3RvciwgLWNlbnRlclsyXSAqIHNjYWxlRmFjdG9yXSk7XG4gICAgaWYgKGtleXByZXNzZWQpIHtcbiAgICAgIGlmIChrZXlwcmVzc2VkID09IDI3KSB7XG4gICAgICAgIGxldHRlclBhcmFtcyA9IFtdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgIC8vYmVnaW5uaW5nID0gYmVnaW5uaW5nICUgbGV0dGVyUGFyYW1zLmxlbmd0aDtcbiAgICAgICAgdmFyIGFkZGVyID0ge1xuICAgICAgICAgIGhlaWdodDogcmFuZCgtMjAwLCAyMDApLFxuICAgICAgICAgIHVfY29sb3JNdWx0OiBjaHJvbWEuaHN2KHJhbmQoYmFzZUNvbG9yLCBiYXNlQ29sb3IgKyAxMjApLCAwLjUsIDEpLmdsKCksXG4gICAgICAgICAgdGltZTogMC4wLFxuICAgICAgICAgIHJvdGF0aW9uTWF0cml4WjogbWF0NC5jcmVhdGUoKSxcbiAgICAgICAgICByb3RhdGlvbk1hdHJpeFk6IG1hdDQuY3JlYXRlKCksXG4gICAgICAgICAgbGV0dGVyTW9kOiB1bmRlZmluZWQsXG4gICAgICAgICAgcmVuZGVyT3JOb3Q6IHRydWUsXG4gICAgICAgICAgc3Bpbm5pbmc6IGZhbHNlLFxuICAgICAgICAgIHNwaW5TcGVlZDogMC4wLFxuICAgICAgICAgIGFjY2VsOiAwLjBcbiAgICAgICAgfVxuICAgICAgICBpZiAoa2V5cHJlc3NlZCA9PSAzMikge1xuICAgICAgICAgIGFkZGVyLnJlbmRlck9yTm90ID0gZmFsc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHJvdGF0ZVpBbmcgPSBkZWdUb1JhZChyYW5kKC02MCwgNjApKTtcbiAgICAgICAgICB2YXIgekF4aXMgPSB2ZWMzLnRyYW5zZm9ybU1hdDQoYXhpc1ZlY3RvciwgdmVjMy5mcm9tVmFsdWVzKDAsMCwxKSwgbWF0NC5jcmVhdGUoKSk7XG4gICAgICAgICAgbWF0NC5yb3RhdGUoYWRkZXIucm90YXRpb25NYXRyaXhaLCBtYXQ0LmNyZWF0ZSgpLCByb3RhdGVaQW5nLCB6QXhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0dGVyUGFyYW1zLnB1c2goYWRkZXIpO1xuICAgICAgICBrZXlwcmVzc2VkID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyAvLyBTZXQgdGhlIHVuaWZvcm1zIHdlIGp1c3QgY29tcHV0ZWRcbiAgICB2YXIgc3BhY2luZyA9IDE0MCAvIE1hdGgubWF4KDEyLCBsZXR0ZXJQYXJhbXMubGVuZ3RoIC0gMSk7XG4gICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IGxldHRlclBhcmFtcy5sZW5ndGg7IGlpKyspIHtcbiAgICAgIGlmIChsZXR0ZXJQYXJhbXNbaWldLnJlbmRlck9yTm90KSB7XG4gICAgICAgIG1hdDQuY29weShtYXRyaXgsIGxldHRlclBhcmFtc1tpaV0ucm90YXRpb25NYXRyaXhZKTtcbiAgICAgICAgaWYgKGxldHRlclBhcmFtc1tpaV0uc3Bpbm5pbmcpIHtcbiAgICAgICAgICBpZiAobGV0dGVyUGFyYW1zW2lpXS50aW1lIDwgMzQuMCkge1xuICAgICAgICAgICAgbGV0dGVyUGFyYW1zW2lpXS50aW1lICs9IDEuMDtcbiAgICAgICAgICAgIHZhciB5QXhpcyA9IHZlYzMudHJhbnNmb3JtTWF0NChheGlzVmVjdG9yLCB2ZWMzLmZyb21WYWx1ZXMoMCwxLDApLCBtYXQ0LmNyZWF0ZSgpKTtcbiAgICAgICAgICAgIC8vbWF0NC5pbnZlcnQobWF0cml4LCBtYXRyaXgpO1xuICAgICAgICAgICAgbWF0NC5yb3RhdGUobWF0cml4LCBtYXRyaXgsIGRlZ1RvUmFkKGxldHRlclBhcmFtc1tpaV0uc3BpblNwZWVkKSwgeUF4aXMpO1xuICAgICAgICAgICAgY29uc29sZS5sb2cobGV0dGVyUGFyYW1zW2lpXS5zcGluU3BlZWQsIGxldHRlclBhcmFtc1tpaV0uYWNjZWwpO1xuICAgICAgICAgICAgbGV0dGVyUGFyYW1zW2lpXS5zcGluU3BlZWQgPSBsZXR0ZXJQYXJhbXNbaWldLnNwaW5TcGVlZCAtIGxldHRlclBhcmFtc1tpaV0uYWNjZWw7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldHRlclBhcmFtc1tpaV0udGltZSA9IDAuMDtcbiAgICAgICAgICAgIGxldHRlclBhcmFtc1tpaV0uc3Bpbm5pbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGxldHRlclBhcmFtc1tpaV0uc3BpblNwZWVkID0gMC4wO1xuICAgICAgICAgICAgbGV0dGVyUGFyYW1zW2lpXS5hY2NlbCA9IDAuMDtcbiAgICAgICAgICAgIGxldHRlclBhcmFtc1tpaV0ucm90YXRpb25NYXRyaXhZID0gbWF0NC5jcmVhdGUoKTtcbiAgICAgICAgICAgIG1hdHJpeCA9IG1hdDQuY3JlYXRlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG1hdDQuY29weShsZXR0ZXJQYXJhbXNbaWldLnJvdGF0aW9uTWF0cml4WSwgbWF0cml4KTtcbiAgICAgICAgLy8gYWRkIGEgdHJhbnNsYXRlIGFuZCBzY2FsZSB0byB0aGUgb2JqZWN0IFdvcmxkIHhmb3JtLCBzbyB3ZSBoYXZlOiAgUiAqIFQgKiBTXG4gICAgICAgIG1hdDQubXVsdGlwbHkobWF0cml4LCBsZXR0ZXJQYXJhbXNbaWldLnJvdGF0aW9uTWF0cml4WSwgbGV0dGVyUGFyYW1zW2lpXS5yb3RhdGlvbk1hdHJpeFopO1xuICAgICAgICAvL21hdDQudHJhbnNsYXRlKG1hdHJpeCwgcm90YXRpb25NYXRyaXgsIFtjZW50ZXJbMF0gKiBzY2FsZUZhY3RvciwgY2VudGVyWzFdICogc2NhbGVGYWN0b3IsIGNlbnRlclsyXSAqIHNjYWxlRmFjdG9yXSk7XG4gICAgICAgIG1hdDQuc2NhbGUobWF0cml4LCBtYXRyaXgsIFtzY2FsZUZhY3Rvciwgc2NhbGVGYWN0b3IsIHNjYWxlRmFjdG9yXSk7XG4gICAgICAgIG1hdDQuY29weSh1bmlmb3Jtc1RoYXRBcmVDb21wdXRlZEZvckVhY2hPYmplY3QudV93b3JsZCwgbWF0cml4KTtcbiAgICAgICAgXG4gICAgICAgIC8vIGdldCBwcm9qICogdmlldyAqIHdvcmxkXG4gICAgICAgIG1hdDQubXVsdGlwbHkobWF0cml4LCB2aWV3TWF0cml4LCB1bmlmb3Jtc1RoYXRBcmVDb21wdXRlZEZvckVhY2hPYmplY3QudV93b3JsZCk7XG4gICAgICAgIG1hdDQubXVsdGlwbHkodW5pZm9ybXNUaGF0QXJlQ29tcHV0ZWRGb3JFYWNoT2JqZWN0LnVfd29ybGRWaWV3UHJvamVjdGlvbiwgcHJvamVjdGlvbk1hdHJpeCwgbWF0cml4KTtcbiAgICAgICAgLy8gZ2V0IHdvcmxkSW52VHJhbnNwb3NlLiAgRm9yIGFuIGV4cGxhaW5hdGlvbiBvZiB3aHkgd2UgbmVlZCB0aGlzLCBmb3IgZml4aW5nIHRoZSBub3JtYWxzLCBzZWVcbiAgICAgICAgLy8gaHR0cDovL3d3dy51bmtub3ducm9hZC5jb20vcnRmbS9ncmFwaGljcy9ydF9ub3JtYWxzLmh0bWxcbiAgICAgICAgbWF0NC50cmFuc3Bvc2UodW5pZm9ybXNUaGF0QXJlQ29tcHV0ZWRGb3JFYWNoT2JqZWN0LnVfd29ybGRJbnZlcnNlVHJhbnNwb3NlLCBcbiAgICAgICAgICAgICAgICAgICAgICBtYXQ0LmludmVydChtYXRyaXgsIHVuaWZvcm1zVGhhdEFyZUNvbXB1dGVkRm9yRWFjaE9iamVjdC51X3dvcmxkKSk7XG4gICAgICAgIHNldFVuaWZvcm1zKHVuaWZvcm1TZXR0ZXJzLCB1bmlmb3Jtc1RoYXRBcmVDb21wdXRlZEZvckVhY2hPYmplY3QpO1xuICAgICAgLy8gU2V0IHRoZSB1bmlmb3JtcyB0aGF0IGFyZSBzcGVjaWZpYyB0byB0aGUgdGhpcyBvYmplY3QuXG4gICAgICAgIG9iamVjdFN0YXRlLm1hdGVyaWFsVW5pZm9ybXMudV9tb3ZlVG9DZW50ZXIgPSB2ZWM0LmZyb21WYWx1ZXMoKCgtMC41ICogc3BhY2luZyAqIChsZXR0ZXJQYXJhbXMubGVuZ3RoIC0gMSkpICsgaWkgKiBzcGFjaW5nKSAqIHNjYWxlRmFjdG9yLCAwLCAwLCAwKTtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhvYmplY3RTdGF0ZS5tYXRlcmlhbFVuaWZvcm1zLnVfbW92ZVRvQ2VudGVyKTtcbiAgICAgICAgb2JqZWN0U3RhdGUubWF0ZXJpYWxVbmlmb3Jtcy51X2hlaWdodFBvcyA9IHZlYzQuZnJvbVZhbHVlcygwLCBsZXR0ZXJQYXJhbXNbaWldLmhlaWdodCwgMCwgMCk7XG4gICAgICAgIG9iamVjdFN0YXRlLm1hdGVyaWFsVW5pZm9ybXMudV9jb2xvck11bHQgPSBsZXR0ZXJQYXJhbXNbaWldLnVfY29sb3JNdWx0O1xuICAgICAgICBzZXRVbmlmb3Jtcyh1bmlmb3JtU2V0dGVycywgb2JqZWN0U3RhdGUubWF0ZXJpYWxVbmlmb3Jtcyk7XG4gICAgICAgIC8vIERyYXcgdGhlIGdlb21ldHJ5LiAgIEV2ZXJ5dGhpbmcgaXMga2V5ZWQgdG8gdGhlIFwiXCJcbiAgICAgICAgZ2wuZHJhd0VsZW1lbnRzKGdsLlRSSUFOR0xFUywgYnVmZmVySW5mby5udW1FbGVtZW50cywgZ2wuVU5TSUdORURfU0hPUlQsIDApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobW91c2VjbGlja2VkKSB7XG4gICAgICBpZiAoY2FudmFzKSB7XG4gICAgICAgIGlmIChnbCkge1xuICAgICAgICAgIHZhciBjbGlja2VkUG9pbnQgPSBuZXcgVWludDhBcnJheSg0KTtcbiAgICAgICAgICBnbC5yZWFkUGl4ZWxzKG1vdXNlY2xpY2tlZFswXSxnbC5jYW52YXMuaGVpZ2h0IC0gbW91c2VjbGlja2VkWzFdLDEsMSxnbC5SR0JBLGdsLlVOU0lHTkVEX0JZVEUsY2xpY2tlZFBvaW50KTtcbiAgICAgICAgICBpZiAoY2xpY2tlZFBvaW50WzBdICE9IDAgfHwgY2xpY2tlZFBvaW50WzFdICE9IDAgfHwgY2xpY2tlZFBvaW50WzJdICE9IDAgfHwgY2xpY2tlZFBvaW50WzNdICE9IDApIHtcbiAgICAgICAgICAgIHZhciBjbGlja2VkbGV0dGVyO1xuICAgICAgICAgICAgdmFyIGRpc3RUb0NlbiA9IEluZmluaXR5O1xuICAgICAgICAgICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IGxldHRlclBhcmFtcy5sZW5ndGg7IGlpKyspIHtcbiAgICAgICAgICAgICAgdmFyIGNlbnRlck9uQ2FudmFzID0gKDAuNSAtIChsZXR0ZXJQYXJhbXMubGVuZ3RoIC0gMSkgKiBjYW52YXNTcGFjaW5nIC8gMiArIGlpICogY2FudmFzU3BhY2luZykgKiBnbC5jYW52YXMud2lkdGg7XG4gICAgICAgICAgICAgIGlmIChNYXRoLmFicyhjZW50ZXJPbkNhbnZhcyAtIG1vdXNlY2xpY2tlZFswXSkgPCBkaXN0VG9DZW4pIHtcbiAgICAgICAgICAgICAgICBkaXN0VG9DZW4gPSBNYXRoLmFicyhjZW50ZXJPbkNhbnZhcyAtIG1vdXNlY2xpY2tlZFswXSk7XG4gICAgICAgICAgICAgICAgY2xpY2tlZGxldHRlciA9IGlpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWxldHRlclBhcmFtc1tjbGlja2VkbGV0dGVyXS5zcGlubmluZykge1xuICAgICAgICAgICAgICBsZXR0ZXJQYXJhbXNbY2xpY2tlZGxldHRlcl0uc3Bpbm5pbmcgPSB0cnVlO1xuICAgICAgICAgICAgICBsZXR0ZXJQYXJhbXNbY2xpY2tlZGxldHRlcl0udGltZSA9IDAuMDtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coKE1hdGguZmxvb3IoZGlzdFRvQ2VuIC8gKGNhbnZhc1NwYWNpbmcgKiAwLjUgKiBjYW52YXMud2lkdGggKiAwLjI1KSkgKyAxKSk7XG4gICAgICAgICAgICAgIGxldHRlclBhcmFtc1tjbGlja2VkbGV0dGVyXS5hY2NlbCA9IChNYXRoLmZsb29yKGRpc3RUb0NlbiAvIChjYW52YXNTcGFjaW5nICogMC41ICogY2FudmFzLndpZHRoICogMC4yNSkpICsgMSkgKiAzNjAgKiAyIC8gMzYuMCAvIDM2LjA7XG4gICAgICAgICAgICAgIGxldHRlclBhcmFtc1tjbGlja2VkbGV0dGVyXS5zcGluU3BlZWQgPSBsZXR0ZXJQYXJhbXNbY2xpY2tlZGxldHRlcl0uYWNjZWwgKiAzNi4wO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcInN1cmVcIik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBtb3VzZWNsaWNrZWQgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIC8vIHN0YXRzIG1ldGVyXG4gICAgc3RhdHMuZW5kKCk7XG5cbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZHJhd1NjZW5lKTtcbiAgfVxufVxuXG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
