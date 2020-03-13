import * as THREE from '../lib/three/three.module.js';

import { OrbitControls } from '../lib/three/jsm/controls/OrbitControls.js';

import { EffectComposer } from '../lib/three/jsm/postprocessing/EffectComposer.js';
import { ShaderPass } from '../lib/three/jsm/postprocessing/ShaderPass.js';
import { TexturePass } from '../lib/three/jsm/postprocessing/TexturePass.js'
import { GradingShader } from './GradingShader.js';

var myTransform;
var anchors = [];
var actAnchor;

var generalMargin = 10;

var pointsSceneWidth = 250;
var pointsSize = 10;

var pointCount = 50000;

// GradingScene
var camera, renderer, composer;
var texturePass, gradingPass;
var canvasMaxWidth, canvasMaxHeight;
var canvasWidth, canvasHeight;


// PointsScene
var pointsCamera, pointsScene, pointsRenderer;
var positions, colors, points;

var pickr;
var imageDataOrig;

var allInitialized = false;

var resizeId;


// console.log('THREE:')
// console.log(THREE);

// $('#anchorsettings-container').hide();

initTransform();
initGradingScene();


function initUI() {

  $(renderer.domElement).click(function(e) {
    // if (!actAnchor) {
    // console.log(e);
    addAnchor(e.pageX, e.pageY, true);
    // console.log(newDivAndAnchor);
    // }
  })

  $('.remove-anchor').click(removeSelectedAnchor);
  $('.arrow-down').click(resetAnchorColor);

  introJs().setOption("nextLabel", " > ");
  $('#quick-start').click(function() {
    introJs().start();
  });




  pickr = Pickr.create({
    el: '#to-color',
    theme: 'monolith',
    container: '#anchorsettings-container',
    useAsButton: true,
    // inline: false,
    // autoReposition: false,
    lockOpacity: true,
    swatches: null,
    defaultRepresentation: 'RGBA',
    showAlways: true,

    components: {
      // Main components
      preview: false,
      opacity: false,
      hue: true,
      // Input / output Options
      interaction: {
        rgba: true,
        hsva: true,
        hex: true,
        input: true,
        // clear: true,
        // save: true
      }
    }
  });

  pickr.on('show', color => {
    if (actAnchor) {
      let dest = actAnchor.anchor.getTargetPosition();
      let destColString = 'rgb(' + dest.map(x => x * 255).join(',') + ')';
      $('#to-color').css('background', destColString);
      pickr.setColor(destColString);
    }
  }).on('change', color => {
    $('#to-color').css('background', color.toRGBA().toString(0));
    let pixelColorDest = color.toRGBA();
    if (pixelColorDest.length == 4) pixelColorDest.pop();
    pixelColorDest = pixelColorDest.map(x => x / 255);

    myTransform.setAnchorTarget(actAnchor.index, pixelColorDest);
    myTransform.updateAnchorMatrices();

    render();
  })

  // drag and drop of images
  window.addEventListener("dragover", dragOverHandler);
  window.addEventListener("drop", dropHandler);

  $('body').css('width', window.innerWidth + 'px');
  $('body').css('height', window.innerHeight + 'px');
  window.addEventListener("resize", function() {
    clearTimeout(resizeId);
    resizeId = setTimeout(adjustSizes, 250);
  });

  // console.log($('#anchorsettings-inactive'))
  var bbTool = $('#anchorsettings-inactive').parent()[0].getBoundingClientRect();
  $('#anchorsettings-inactive').css('width', bbTool.width);
  $('#anchorsettings-inactive').css('height', bbTool.height-2);
  $('#anchorsettings-inactive').click(function() {
    // block events
  });  

}

function adjustSizes() {
  $('body').css('width', window.innerWidth + 'px');
  $('body').css('height', window.innerHeight + 'px');

  canvasMaxWidth = window.innerWidth - pointsSceneWidth - 4 * generalMargin;
  canvasMaxHeight = window.innerHeight - 2 * generalMargin;

  // var dpr = window.devicePixelRatio;
  // var w = parseFloat($('#image-container').css('width'));
  // var h = parseFloat($('#image-container').css('height'));
  // var pl = parseFloat($('#image-container').css('padding-left'));
  // var pr = parseFloat($('#image-container').css('padding-right'));
  // var pt = parseFloat($('#image-container').css('padding-top'));
  // var pb = parseFloat($('#image-container').css('padding-bottom'));
  // canvasMaxWidth = w - pl - pr;
  // canvasMaxHeight = h - pt - pb;

  if (texturePass.map.image) {
    var imgWidth = texturePass.map.image.width;
    var imgHeight = texturePass.map.image.height;

    var aspectImg = imgWidth / imgHeight;
    var aspectContainer = canvasMaxWidth / canvasMaxHeight;

    var canvasWidth = canvasMaxWidth;
    var canvasHeight = canvasWidth / aspectImg;


    if (aspectImg < aspectContainer) {
      canvasHeight = canvasMaxHeight;
      canvasWidth = canvasHeight * aspectImg;
    }

    canvasWidth = Math.min(canvasWidth, canvasMaxWidth - 2);
    canvasHeight = Math.min(canvasHeight, canvasMaxHeight - 2);

    renderer.setSize(canvasWidth, canvasHeight);
    composer.setSize(canvasWidth, canvasHeight);

    //updateGradingPass();
    render();

    let bbCanvas = $('#image-canvas')[0].getBoundingClientRect();
    for (var i = 0; i < anchors.length; i++) {
      let element = anchors[i].anchorDOMElement;
      let elemX = bbCanvas.x + anchors[i].x * canvasWidth;
      let elemY = bbCanvas.y + anchors[i].y * canvasHeight;
      let bbAnchor = element[0].getBoundingClientRect();
      element.css('left', elemX - bbAnchor.width / 2);
      element.css('top', elemY - bbAnchor.height / 2);
    }

  }



}

function addAnchor(x, y, open) {

  // if (x >= img.width || y >= img.height) return false;

  let bbCanvas = $(renderer.domElement)[0].getBoundingClientRect();
  // console.log(bbCanvas);

  let elemX = x;
  let elemY = y;
  x = (x - bbCanvas.left) / bbCanvas.width;
  y = (y - bbCanvas.top) / bbCanvas.height;
  // console.log(elemX, elemY);

  let pixelColorOrig = getPixelColor(imageDataOrig, x, y);
  pixelColorOrig = Array.from(pixelColorOrig);
  pixelColorOrig = pixelColorOrig.map(x => x / 255);
  pixelColorOrig.pop();
  // console.log(pixelColorOrig);
  let pixelColorDest = myTransform.transform(pixelColorOrig);
  // console.log(pixelColorDest);
  // pixelColorDest.pop();
  let anchorIndex = myTransform.getAnchorCount();
  let anchor = myTransform.addAnchor(pixelColorOrig, pixelColorDest);

  let element = $("<div class='anchor'></div>");
  element.attr('index', anchorIndex);
  $("#image-canvas").append(element);
  let bbAnchor = element[0].getBoundingClientRect();
  element.css('left', elemX - bbAnchor.width / 2);
  element.css('top', elemY - bbAnchor.height / 2);
  anchors.push({ x: x, y: y, anchorDOMElement: element, anchor: anchor, index: anchorIndex });

  selectAnchor(anchorIndex);

  updateGradingPass();

  element.click(e => {
    let anchorIndex = e.target.attributes.index.value;
    if (anchors[anchorIndex] != actAnchor) {
      selectAnchor(anchorIndex);
    } else {
      actAnchor.anchorDOMElement.removeClass('selected');
      actAnchor = null;
      // $('#anchorsettings-container').hide();
      $('#anchorsettings-inactive').show();
      // pickr.hide();
    }
  });

}

function resetAnchorColor() {
  if (actAnchor) {
    let pixelColorOrig = actAnchor.anchor.getOriginPosition();
    actAnchor.anchor.setTargetPosition(pixelColorOrig);
    myTransform.updateAnchorMatrices();
    pickr.hide();
    pickr.show();
    render();
  }
}

function removeAllAnchors() {
  for (var i = 0; i < anchors.length; i++) {
    myTransform.removeAnchor(anchors[i].anchor);
    anchors[i].anchorDOMElement.remove();
  }

  anchors = [];
  // $('#anchorsettings-container').hide();
  $('#anchorsettings-inactive').show();

  updateGradingPass();

  // console.log(myTransform)
}


function removeSelectedAnchor() {
  // console.log('remove Anchor');
  // console.log(actAnchor);

  if (actAnchor) {
    // remove dom element
    actAnchor.anchorDOMElement.remove();

    // remove anchor from stretch transform
    myTransform.removeAnchor(actAnchor.anchor);

    anchors.splice(actAnchor.index, 1);

    // remap indices
    for (var i = 0; i < anchors.length; i++) {
      anchors[i].index = i;
      anchors[i].anchorDOMElement.attr('index', i);
    }

    actAnchor = null;
    // $('#anchorsettings-container').hide();
    $('#anchorsettings-inactive').show();

    // console.log(anchors);

    myTransform.updateAnchorMatrices();
    updateGradingPass();
    render();
  }

}

function selectAnchor(idx) {

  $('.anchor').removeClass('selected');
  actAnchor = anchors[idx];
  anchors[idx].anchorDOMElement.addClass('selected');

  let orig = actAnchor.anchor.getOriginPosition();
  let origColString = 'rgb(' + orig.map(x => x * 255).join(',') + ')';
  $('#from-color').css('background', origColString);

  let dest = actAnchor.anchor.getTargetPosition();
  let destColString = 'rgb(' + dest.map(x => x * 255).join(',') + ')';
  $('#to-color').css('background', destColString);

  // $('#anchorsettings-container').show();
  $('#anchorsettings-inactive').hide();

  pickr.hide();
  pickr.show();

}

function initTransform() {
  // myTransform.addAnchor([0.30, 0.87, 0.54], [0.68, 0.77, 0.85]);
  // myTransform.addAnchor([0.78, 0.46, 0.47], [0.94, 0.33, 0.76]);
  // myTransform.addAnchor([0.20, 0.26, 0.12], [0.07, 0.05, 0.07]);
  // myTransform.addAnchor([0.28, 0.82, 0.09], [0.60, 0.70, 0.34]);
  // myTransform.addAnchor([0.39, 0.59, 0.23], [0.43, 0.38, 0.32]);
  myTransform = new StretchTransform();
  myTransform.updateAnchorMatrices();

  actAnchor = undefined;
  anchors = [];

  $('.anchor').remove();

  // $('#anchorsettings-container').hide();
  // $('#anchorsettings-inactive').show();

  // console.log('myTransform:')
  // console.log(myTransform)
}



function initGradingScene() {
  // Just for a start. Correct size will be set when image is loaded.
  var width = 200 * 4 / 3;
  var height = 200;
  var devicePixelRatio = window.devicePixelRatio || 1;

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  $("#image-canvas").append(renderer.domElement);

  // postprocessing
  composer = new EffectComposer(renderer);

  texturePass = new TexturePass();
  composer.addPass(texturePass);

  loadTexture("../assets/gradient.png", applyTextureMap);

  gradingPass = new ShaderPass(GradingShader);
  gradingPass.uniforms['anchorCount'].value = 0;
  composer.addPass(gradingPass);
  updateGradingPass();

  // // for testing: change one anchor target with mousemove
  // renderer.domElement.addEventListener('mousedown', function() {
  //   renderer.domElement.addEventListener('mousemove', onMouseDrag, false);
  //   window.addEventListener('mouseup', function() {
  //     renderer.domElement.removeEventListener('mousemove', onMouseDrag, false);
  //   }, false);
  // }, false);
}

function loadTexture(filepath) {
  var textureLoader = new THREE.TextureLoader();
  // console.log('trying to load ' + filepath);
  textureLoader.load(filepath, applyTextureMap);

}

function applyTextureMap(map) {
  // console.log('loaded texture');
  texturePass.map = map;
  // console.log('texturePass:')
  // console.log(texturePass)

  // There seems to be some asynchronous preparing of stuff. Let's wait a bit to make sure the image is really there.
  setTimeout(function() {
    var img = map.image;
    var imgCanvas = document.createElement('canvas');
    imgCanvas.width = img.width;
    imgCanvas.height = img.height;
    imgCanvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
    imageDataOrig = imgCanvas.getContext('2d').getImageData(0, 0, imgCanvas.width, imgCanvas.height);
    // console.log('imageDataOrig:');
    // console.log(imageDataOrig);

    adjustSizes();

    if (!allInitialized) {
      allInitialized = true;
      initPointsScene();
      initUI();
      animate();
    }

    initTransform();
    updateGradingPass();

    render();
  }, 250);
}

function updateGradingPass() {
  // remove gradingPass from composer
  if (composer.passes.length > 1) composer.passes.pop();

  if (myTransform.getAnchorCount() > 0) {
    // adjust fragmentShader with new anchor count
    GradingShader.fragmentShader = GradingShader.fragmentShader.replace(/#define ANCHOR_COUNT \d+/g, '#define ANCHOR_COUNT ' + myTransform.getAnchorCount());

    // re-add gradingPass to composer
    gradingPass = new ShaderPass(GradingShader);
    composer.addPass(gradingPass);
  }

  // console.log('gradingPass: ');
  // console.log(gradingPass);
}


function initPointsScene() {
  var width = pointsSceneWidth;
  var height = pointsSceneWidth;

  pointsCamera = new THREE.PerspectiveCamera(27, width / height, 5, 3500);
  pointsCamera.position.z = 900;

  pointsScene = new THREE.Scene();
  pointsScene.background = new THREE.Color(0x000000);
  // pointsScene.fog = new THREE.Fog(0x404040, -200, 3500);

  pointsRenderer = new THREE.WebGLRenderer();
  pointsRenderer.setPixelRatio(window.devicePixelRatio);
  pointsRenderer.setSize(width, height);

  $('#pointcloud-canvas').append(pointsRenderer.domElement);

  // add axis
  var box, boxMaterial, mesh;
  var s = pointsSceneWidth;
  box = new THREE.BoxBufferGeometry(s, 2, 2).translate(0, -s / 2, -s / 2);
  boxMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    opacity: 0.5,
    transparent: true,
  });
  mesh = new THREE.Mesh(box, boxMaterial);
  pointsScene.add(mesh);

  box = new THREE.BoxBufferGeometry(2, s, 2).translate(-s / 2, 0, -s / 2);
  boxMaterial = new THREE.MeshBasicMaterial({
    color: 0x00cc00,
    opacity: 0.5,
    transparent: true,
  });
  mesh = new THREE.Mesh(box, boxMaterial);
  pointsScene.add(mesh);

  box = new THREE.BoxBufferGeometry(2, 2, s).translate(-s / 2, -s / 2, 0);
  boxMaterial = new THREE.MeshBasicMaterial({
    color: 0x3333ff,
    opacity: 0.5,
    transparent: true,
  });
  mesh = new THREE.Mesh(box, boxMaterial);
  pointsScene.add(mesh);

  // init points buffer geometry
  var gl = renderer.domElement.getContext('webgl');
  var w = gl.drawingBufferWidth;
  var h = gl.drawingBufferHeight;

  // positions = new Array(w * h * 3 / pointsStep);
  positions = new Array(pointCount * 3);
  positions.fill(0);
  // colors = new Array(w * h * 3 / pointsStep);
  colors = new Array(pointCount * 3);
  colors.fill(0);
  var cubeW = pointsSceneWidth;

  var geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  var material = new THREE.PointsMaterial({ size: pointsSize, vertexColors: THREE.VertexColors });

  points = new THREE.Points(geometry, material);
  pointsScene.add(points);

  var controls = new OrbitControls(pointsCamera, pointsRenderer.domElement);
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.25;
}

function onMouseDrag(e) {
  var tx = e.clientX / e.target.width * window.devicePixelRatio;
  var ty = e.clientY / e.target.height * window.devicePixelRatio;

  tx = Math.min(Math.max(tx, 0), 1);
  ty = Math.min(Math.max(ty, 0), 1);

  myTransform.setAnchorTarget(0, [tx, 1 - ty, 1 - tx]);

  myTransform.updateAnchorMatrices();

  render();
}

function render() {

  // update and render GradingScene ---------------------------------------------

  // update grading shader uniforms 
  var anchorCount = myTransform.anchors.length;
  gradingPass.uniforms['anchorCount'].value = anchorCount;

  var anchorInfos = [];
  for (var i = 0; i < anchorCount; i++) {
    var a = myTransform.getAnchor(i);
    anchorInfos.push({
      orig: new THREE.Vector3(...a.originPosition),
      dest: new THREE.Vector3(...a.targetPosition),
      matrix: (new THREE.Matrix4()).set(...a.transformMatrix),
    });
  }
  gradingPass.uniforms['anchors'] = new THREE.Uniform(anchorInfos);
  // console.log('anchorInfos: ');
  // console.log(anchorInfos);

  composer.render();

  // update and render PointsScene ---------------------------------------------

  if (positions) {

    var gl = renderer.domElement.getContext('webgl');
    var w = gl.drawingBufferWidth;
    var h = gl.drawingBufferHeight;
    var pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    var cubeW = pointsSceneWidth;
    var fac = (pixels.length / 4) / pointCount;
    for (var j = 0; j < positions.length; j += 3) {
      var i = Math.floor(j / 3 * fac) * 4;

      positions[j] = (pixels[i] / 255 - 0.5 + Math.random() * 0.00) * cubeW;
      positions[j + 1] = (pixels[i + 1] / 255 - 0.5 + Math.random() * 0.00) * cubeW;
      positions[j + 2] = (pixels[i + 2] / 255 - 0.5 + Math.random() * 0.00) * cubeW;

      colors[j] = pixels[i] / 255;
      colors[j + 1] = pixels[i + 1] / 255;
      colors[j + 2] = pixels[i + 2] / 255;
    }

    points.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    pointsRenderer.render(pointsScene, pointsCamera);
  }

}

function animate() {
  requestAnimationFrame(animate);

  // var time = Date.now() * 0.001;

  // points.rotation.x = time * 0.25;
  // points.rotation.y = time * 0.5;

  pointsRenderer.render(pointsScene, pointsCamera);
}



// -------------------------------------------------------------------------------------------------
// Handling drag and drop of images ----------------------------------------------------------------
// -------------------------------------------------------------------------------------------------


function dragOverHandler(ev) {
  // console.log('File(s) in drop zone');

  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();
}

function dropHandler(ev) {
  // Prevent default behavior (Prevent file from being opened)
  ev.preventDefault();

  var file = undefined;

  if (ev.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
    for (var i = 0; i < ev.dataTransfer.items.length; i++) {
      // If dropped items aren't files, reject them
      if (ev.dataTransfer.items[i].kind === 'file') {
        file = ev.dataTransfer.items[i].getAsFile();
        // console.log('1. ... file[' + i + '].name = ' + file.name);
        // console.log(file);
      }
    }
  } else {
    // Use DataTransfer interface to access the file(s)
    for (var i = 0; i < ev.dataTransfer.files.length; i++) {
      // console.log('2. ... file[' + i + '].name = ' + ev.dataTransfer.files[i].name);
      // console.log(ev.dataTransfer.files[i]);
      file = ev.dataTransfer.files[0];
    }
  }

  if (file) {
    var reader = new FileReader();

    reader.onload = function(ev) {
      console.log(ev);

      removeAllAnchors();

      let img = document.createElement('img');
      img.src = reader.result;

      var newTexture = new THREE.Texture(img);
      newTexture.needsUpdate = true;

      applyTextureMap(newTexture);

      render();
    };

    reader.readAsDataURL(file);
  }
}


// -------------------------------------------------------------------------------------------------
// Helpers -----------------------------------------------------------------------------------------
// -------------------------------------------------------------------------------------------------



function map(val, low1, high1, low2, high2) {
  return (val - low1) / (high1 - low1) * (high2 - low2) + low2;
}

function getPixelColor(imageData, x, y) {
  x = Math.floor(x * imageData.width);
  y = Math.floor(y * imageData.height);
  let index = (y * imageData.width + x) * 4;
  return imageData.data.slice(index, index + 4);
}