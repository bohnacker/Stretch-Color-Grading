var GradingShader = {

  uniforms: {
    "tDiffuse": { value: null },
    "anchorCount": { value: 0 },
    "anchors": { value: null },
  },

  vertexShader: `

    varying vec2 vUv;
    
    void main() {
      vUv = uv;

      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }

  `,

  fragmentShader: `

    #define ANCHOR_COUNT 1
    #define FLT_MAX 3.402823466e+38

    struct Anchor
    {
      vec3 orig;
      vec3 dest;
      mat4 matrix;
    };

    uniform sampler2D tDiffuse;
    uniform Anchor anchors[ANCHOR_COUNT];
    
    varying vec2 vUv;



    // when transforming the color, alpha will be ignored
    vec4 transform(vec4 color) {
      // save alpha to restore it later
      float alpha = color.a;
      color.a = 1.0;
      vec3 p = color.rgb;

      // calculate weights --------------------------------------------
      float dists[ANCHOR_COUNT];
      int minI = -1;
      float minDist = FLT_MAX;
      
      // calc distances to all anchors and find minimum
      for (int i = 0; i < ANCHOR_COUNT; i++) {
        dists[i] = distance(p, anchors[i].orig);
        if (dists[i] < minDist) {
          minDist = dists[i];
          minI = i;
        }
      }

      // calc attraction weights (sum of all weights must be 1)
      float weights[ANCHOR_COUNT];

      if (minDist == 0.0) {
        for (int i = 0; i < ANCHOR_COUNT; i++) {
          if (i == minI) {
            weights[i] = 1.0;
          } else {
            weights[i] = 0.0;
          }
        }

      } else {
        float distfacs[ANCHOR_COUNT];
        float sum = 0.0;

        for (int i = 0; i < ANCHOR_COUNT; i++) {
          distfacs[i] = 1.0 / pow(dists[i], 2.0);
          sum += distfacs[i];
        }

        for (int i = 0; i < ANCHOR_COUNT; i++) {
          if (sum == 0.0) {
            weights[i] = 0.0;
          } else {
            weights[i] = distfacs[i] / sum;
          }
        }
      }
      // weights[0] = 0.5;
      // weights[1] = 0.5;

      // apply transformations ----------------------------------------
      vec4 dvecOffsetSum = vec4(0.0); 

      for (int i = 0; i < ANCHOR_COUNT; i++) {
        // delta vector from orig-anchor to the point
        vec4 dvec = color - vec4(anchors[i].orig, 1.0);
        dvec.w = 1.0;
        
        // apply the matrix of this anchor to that delta vector
        vec4 dvecres = dvec * anchors[i].matrix;
        // vec4 dvecres = anchors[i].matrix * dvec;

        // offset between the delta vector and the transformed delta vector
        vec4 dvecOffset = dvecres - dvec;

        // multiply this offset by the weight of this anchor
        dvecOffset *= vec4(weights[i]);
        // dvecOffset *= vec4(0.5);

        // add up all offset
        dvecOffsetSum += dvecOffset;
      }
      color += dvecOffsetSum;
      // color += vec4(0.5, 0.5, 0.5, 0);
      // color.rgb *= anchors[i].matrix;

      // restore alpha
      color.a = alpha;
      return color;
    }

    void main() {
      gl_FragColor = texture2D( tDiffuse, vUv );
      // if (vUv.y > 0.5) {
        gl_FragColor = transform(gl_FragColor);
      // }
    }

  `

};

/*
  StretchTransform.prototype.transformSimple = function(p) {
    if (this.matricesUpToDate == false) {
      this.updateAnchorMatrices();
    }

    var pTransformed = V.clone(p);
    var weights = this.calcWeights(p, ORIGINS, -1, this.weightingExponent2);

    // apply matrix-transforms to the point
    var dvecOffsetSum = V.create();
    for (var i = 0; i < this.anchors.length; i++) {
      // delta vector from orig-anchor to the point
      var dvec = V.create();
      V.sub(dvec, p, this.anchors[i].getOriginPosition());

      // apply the matrix of this anchor to that delta vector
      var dvecres = V.create();
      V.transformMat4(dvecres, dvec, this.anchors[i].getTransformMatrix());

      // offset between the delta vector and the transformed delta vector
      var dvecOffset = V.create();
      V.sub(dvecOffset, dvecres, dvec);

      // multiply this offset by the weight of this anchor
      V.scale(dvecOffset, dvecOffset, weights[i]);

      // add up all offset
      V.add(dvecOffsetSum, dvecOffsetSum, dvecOffset);
    }
    // add the sum of all offsets to the point
    V.add(pTransformed, pTransformed, dvecOffsetSum);

    return pTransformed;
  }
*/


export { GradingShader };