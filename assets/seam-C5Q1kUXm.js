import{C as e,M as t,N as n,O as r,a as i,d as a,i as o,l as s,n as c,o as l,r as u,t as d,u as f}from"./index-hGht8tVa.js";import{t as p}from"./ExperienceShell-A0OiSEJa.js";import{D as m,E as h,M as g,O as _,P as v,S as y,_ as ee,a as b,b as te,c as x,d as S,f as C,g as w,h as T,i as E,j as D,k as O,l as ne,n as re,o as k,p as A,r as j,t as ie,u as M,v as ae,w as N,x as oe,y as se}from"./three.module-BUJ2fuxz.js";var P=n(t(),1),ce=[`tanh`,`relu`,`swish`,`sigmoid`],le=e=>[2,...e.hidden,1];function ue(e){let t=le(e),n=0;for(let e=0;e<t.length-1;e++)n+=t[e]*t[e+1]+t[e+1];return n}var de=[{id:`spiral`,label:`Spiral`,note:`Two interleaved arms. Needs depth to unwind.`},{id:`rings`,label:`Rings`,note:`Core and outer band of defects around a sound ring.`},{id:`moons`,label:`Moons`,note:`Two interlocking crescents.`},{id:`xor`,label:`Checker`,note:`XOR quadrants. Not linearly separable.`},{id:`clusters`,label:`Clusters`,note:`Small defect pockets in a sound field.`},{id:`blank`,label:`Blank`,note:`Empty plane. Paint your own samples.`}],F=e=>Math.min(.98,Math.max(-.98,e));function fe(e,t,n){let r=[],i=[],a=[],o=()=>{let e=Math.max(n(),1e-12);return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*n())},s=.012+t*.11,c=(e,t,n)=>{r.push(F(e+o()*s)),i.push(F(t+o()*s)),a.push(n)};switch(e){case`spiral`:for(let e=0;e<2;e++)for(let t=0;t<130;t++){let r=(t+n()*.9)/130,i=.07+.85*r,a=r*1.6*Math.PI*2+e*Math.PI;c(i*Math.cos(a),i*Math.sin(a),e)}break;case`rings`:for(let e=0;e<70;e++){let e=.2*Math.sqrt(n()),t=n()*Math.PI*2;c(e*Math.cos(t),e*Math.sin(t),1)}for(let e=0;e<110;e++){let e=.5+(n()-.5)*.12,t=n()*Math.PI*2;c(e*Math.cos(t),e*Math.sin(t),0)}for(let e=0;e<130;e++){let e=.86+(n()-.5)*.12,t=n()*Math.PI*2;c(e*Math.cos(t),e*Math.sin(t),1)}break;case`moons`:for(let e=0;e<130;e++){let t=Math.PI*((e+n())/130);c(-.28+.62*Math.cos(t),-.12+.62*Math.sin(t)*.95,0),c(.28-.62*Math.cos(t),.2-.62*Math.sin(t)*.95,1)}break;case`xor`:for(let e=0;e<260;e++){let t=(n()*2-1)*.9,r=(n()*2-1)*.9;Math.abs(t)<.07||Math.abs(r)<.07?e--:c(t,r,+(t*r<0))}break;case`clusters`:{let e=[[-.52,.42,.13],[.5,.5,.1],[.18,-.5,.15],[-.55,-.45,.09]];for(let[t,n,r]of e)for(let e=0;e<28;e++)c(t+o()*r*.6,n+o()*r*.6,1);let t=0;for(;t<190;){let r=(n()*2-1)*.94,i=(n()*2-1)*.94,a=!0;for(let[t,n,o]of e)Math.hypot(r-t,i-n)<o*1.9&&(a=!1);a&&(c(r,i,0),t++)}break}}let l=r.length,u=new Float32Array(l*2),d=new Uint8Array(l);for(let e=0;e<l;e++)u[2*e]=r[e],u[2*e+1]=i[e],d[e]=a[e];return{xs:u,ys:d,n:l}}var I={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},L=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},R=new ee(-1,1,1,-1,0,1),pe=new class extends E{constructor(){super(),this.setAttribute(`position`,new M([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new M([0,2,0,0,2,0],2))}},me=class{constructor(e){this._mesh=new T(pe,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,R)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},he=class extends L{constructor(e,t=`tDiffuse`){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof m?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=O.clone(e.uniforms),this.material=new m({name:e.name===void 0?`unspecified`:e.name,defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new me(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},z=class extends L{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),i.buffers.stencil.setClear(o),i.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}},B=class extends L{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},V=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new D);this._width=n.width,this._height=n.height,t=new v(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:S}),t.texture.name=`EffectComposer.rt1`}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name=`EffectComposer.rt2`,this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new he(I),this.copyPass.material.blending=0,this.timer=new _}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let t=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(t.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(t.EQUAL,1,4294967295)}this.swapBuffers()}z!==void 0&&(r instanceof z?n=!0:r instanceof B&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new D);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}},H=class extends L{constructor(e,t,n=null,r=null,i=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new b}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let i,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==1&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}},U={name:`LuminosityHighPassShader`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new b(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`},W=class e extends L{constructor(e,t=1,n,r){super(),this.strength=t,this.radius=n,this.threshold=r,this.resolution=e===void 0?new D(256,256):new D(e.x,e.y),this.clearColor=new b(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new v(i,a,{type:S,depthBuffer:!1}),this.renderTargetBright.texture.name=`UnrealBloomPass.bright`,this.renderTargetBright.texture.generateMipmaps=!1;for(let e=0;e<this.nMips;e++){let t=new v(i,a,{type:S,depthBuffer:!1});t.texture.name=`UnrealBloomPass.h`+e,t.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(t);let n=new v(i,a,{type:S,depthBuffer:!1});n.texture.name=`UnrealBloomPass.v`+e,n.texture.generateMipmaps=!1,this.renderTargetsVertical.push(n),i=Math.round(i/2),a=Math.round(a/2)}let o=U;this.highPassUniforms=O.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new m({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];let s=[6,10,14,18,22];i=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(s[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new D(1/i,1/a),i=Math.round(i/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new g(1,1,1),new g(1,1,1),new g(1,1,1),new g(1,1,1),new g(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=O.clone(I.uniforms),this.blendMaterial=new m({uniforms:this.copyUniforms,vertexShader:I.vertexShader,fragmentShader:I.fragmentShader,premultipliedAlpha:!0,blending:2,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new b,this._oldClearAlpha=1,this._basic=new w,this._fsQuad=new me(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(n,r),this.renderTargetsVertical[e].setSize(n,r),this.separableBlurMaterials[e].uniforms.invSize.value=new D(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(t,n,r,i,a){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();let o=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),a&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let s=this.renderTargetBright;for(let n=0;n<this.nMips;n++)this._fsQuad.material=this.separableBlurMaterials[n],this.separableBlurMaterials[n].uniforms.colorTexture.value=s.texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[n]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[n].uniforms.colorTexture.value=this.renderTargetsHorizontal[n].texture,this.separableBlurMaterials[n].uniforms.direction.value=e.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[n]),t.clear(),this._fsQuad.render(t),s=this.renderTargetsVertical[n];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(r),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(.39894*Math.exp(-.5*r*r/(n*n))/n);let r=[],i=[];for(let n=1;n<e;n+=2){let a=t[n],o=n+1<e?t[n+1]:0,s=a+o;r.push((n*a+(n+1)*o)/s),i.push(s)}return new m({defines:{KERNEL_PAIRS:r.length},uniforms:{colorTexture:{value:null},invSize:{value:new D(.5,.5)},direction:{value:new D(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:r},gaussianWeights:{value:i}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new m({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};W.BlurDirectionX=new D(1,0),W.BlurDirectionY=new D(0,1);var G={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},K=class extends L{constructor(){super(),this.isOutputPass=!0,this.uniforms=O.clone(G.uniforms),this.material=new oe({name:G.name,uniforms:this.uniforms,vertexShader:G.vertexShader,fragmentShader:G.fragmentShader}),this._fsQuad=new me(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},k.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},q=.62,J=140,ge=`
  attribute float aP;
  attribute vec2 aG;
  uniform float uH;
  varying float vP;
  varying vec2 vG;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    vP = aP;
    vG = aG;
    vUv = uv;
    vec3 p = vec3(position.x, aP * uH, position.z);
    vN = normalize(vec3(-aG.x * uH, 1.0, aG.y * uH));
    vW = p;
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`,_e=`
  uniform float uTime;
  uniform vec3 uCam;
  varying float vP;
  varying vec2 vG;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  vec3 heat(float t) {
    vec3 c = mix(vec3(0.07, 0.012, 0.006), vec3(0.62, 0.07, 0.012), smoothstep(0.0, 0.34, t));
    c = mix(c, vec3(1.0, 0.36, 0.07), smoothstep(0.26, 0.62, t));
    c = mix(c, vec3(1.0, 0.78, 0.42), smoothstep(0.58, 0.88, t));
    return mix(c, vec3(1.0, 0.97, 0.9), smoothstep(0.86, 1.0, t));
  }

  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(uCam - vW);
    vec3 L = normalize(vec3(0.45, 0.8, 0.35));
    vec3 Hh = normalize(L + V);

    // Cold side: brushed, blued steel.
    float brush = noise(vec2(vW.x * 260.0, vW.z * 7.0)) * 0.6 + noise(vec2(vW.x * 90.0, vW.z * 3.0)) * 0.4;
    vec3 steel = mix(vec3(0.078, 0.088, 0.108), vec3(0.17, 0.19, 0.225), brush);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, Hh), 0.0), 42.0) * (0.35 + 0.65 * brush);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 cold = steel * (0.5 + 0.9 * diff) + vec3(0.36, 0.44, 0.58) * (spec * 0.55 + fres * 0.18);

    // Hot side: a cooling crust over metal that is still moving, white-hot only near the seam.
    float flow = noise(vW.xz * 5.0 + vec2(uTime * 0.11, -uTime * 0.07)) * 0.6 + noise(vW.xz * 13.0 - uTime * 0.16) * 0.4;
    float hot = smoothstep(0.5, 1.0, vP);
    float veins = pow(flow, 2.5);
    float nearSeam = 1.0 - smoothstep(0.0, 0.42, abs(vP - 0.5));
    vec3 molten = heat(clamp(0.2 + 0.2 * hot + veins * 0.42 + nearSeam * 0.3, 0.0, 1.0));
    molten *= mix(0.5, 1.05, smoothstep(0.25, 0.62, flow));
    molten += vec3(1.0, 0.62, 0.34) * spec * 0.22;

    vec3 col = mix(cold, molten, smoothstep(0.47, 0.6, vP));

    // Iso-lines every 0.1 of probability, constant width on screen.
    float lv = vP * 10.0;
    float iso = 1.0 - clamp(abs(fract(lv - 0.5) - 0.5) / max(fwidth(lv), 1e-5) - 0.2, 0.0, 1.0);
    col = mix(col, mix(vec3(0.3, 0.34, 0.4), vec3(0.16, 0.03, 0.0), step(0.5, vP)), iso * 0.34);

    // Feature-plane graticule on the cold side.
    vec2 gq = vUv * 10.0;
    vec2 gl = abs(fract(gq - 0.5) - 0.5) / max(fwidth(gq), vec2(1e-5));
    float grid = 1.0 - clamp(min(gl.x, gl.y), 0.0, 1.0);
    col += vec3(0.46, 0.52, 0.62) * grid * 0.1 * (1.0 - smoothstep(0.4, 0.55, vP));

    // The seam: p = 0.5, where the model changes its mind.
    float slope = length(vG);
    float ds = abs(vP - 0.5) / max(fwidth(vP), 1e-5);
    float decided = smoothstep(0.04, 0.5, slope);
    float core = exp(-ds * ds * 0.22);
    float halo = exp(-ds * 0.16) * 0.42;
    col += vec3(1.0, 0.74, 0.38) * (core * 1.7 + halo) * decided;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`,Y=`
  attribute float aClass;
  attribute float aWrong;
  uniform float uScale;
  uniform float uSize;
  varying float vClass;
  varying float vWrong;
  void main() {
    vClass = aClass;
    vWrong = aWrong;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uScale * (1.0 + aWrong * 0.9) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`,X=`
  uniform float uTime;
  varying float vClass;
  varying float vWrong;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float s = 1.0 + vWrong * 0.9;
    float r = length(q) * s;
    float aa = fwidth(r) * 1.2;
    // Defect: solid ember. Sound: open ring. Shape, not just colour, carries the class.
    float disc = 1.0 - smoothstep(0.62 - aa, 0.62, r);
    float ring = smoothstep(0.42 - aa, 0.42, r) * (1.0 - smoothstep(0.66 - aa, 0.66, r));
    float shape = mix(ring, disc, vClass);
    vec3 col = mix(vec3(0.80, 0.88, 1.0), mix(vec3(1.0, 0.92, 0.78), vec3(1.0, 0.45, 0.1), smoothstep(0.1, 0.6, r)), vClass);
    float edge = (1.0 - smoothstep(0.72 - aa, 0.72, r)) - shape;
    vec4 outc = vec4(col * 1.25, shape) + vec4(0.02, 0.02, 0.03, max(edge, 0.0) * 0.55 * vClass);
    // Misclassified: a pulsing outer bracket.
    float pulse = 0.55 + 0.45 * sin(uTime * 6.0);
    float halo = smoothstep(1.5 - aa, 1.5, r) * (1.0 - smoothstep(1.78 - aa, 1.78, r)) * vWrong;
    outc = mix(outc, vec4(1.0, 1.0, 1.0, 1.0), halo * pulse);
    outc.a = max(outc.a, halo * pulse);
    if (outc.a < 0.02) discard;
    gl_FragColor = outc;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`,ve=`
  attribute float aLife;
  uniform float uScale;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uScale * 13.0 * (0.4 + aLife * 0.6) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`,Z=`
  varying float vLife;
  void main() {
    float r = length(gl_PointCoord * 2.0 - 1.0);
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * vLife;
    gl_FragColor = vec4(mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.85, 0.6), vLife) * a * 1.8, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`,ye=class{canvas;opts;onPaint=()=>{};onInteract=()=>{};renderer;composer;bloom;scene=new h;camera=new ae(34,1,.1,40);terrain;points;embers;brush;target=new Float32Array(9216).fill(.5);shown=new Float32Array(9216).fill(.5);aP;aG;n=0;xs=new Float32Array;ys=new Uint8Array;probs=new Float32Array(900).fill(.5);ptPos;ptClass;ptWrong;emPos;emLife;emVel=new Float32Array(420);emNext=0;theta=.7;phi=1.02;radius=4.4;gTheta=.7;gPhi=1.02;gRadius=4.4;fit=4.4;top=!1;mode=`orbit`;idle=0;pointers=new Map;pinch=0;pinchAngle=0;painting=!1;frameAvg=16;frames=0;tier=0;bgDirect;bgComposer;pinned=!1;quality=1;size=[1,1,1,1];ray=new y;disposed=!1;constructor(e,t){this.canvas=e,this.opts=t;let n=new URLSearchParams(location.search);n.has(`gl`)&&(this.tier=Number(n.get(`gl`))||0,this.pinned=!0);let r=new ie({canvas:e,antialias:!t.coarse&&n.get(`aa`)!==`0`,powerPreference:`high-performance`});this.renderer=r,this.bgDirect=new b(t.bg),this.bgComposer=new b(t.bgComposer),this.scene.background=this.bgDirect,r.toneMapping=4,r.toneMappingExposure=1.05;let i=new se(2,2,95,95);i.rotateX(-Math.PI/2);let a=i.attributes.position;for(let e=0;e<96;e++)for(let t=0;t<96;t++){let n=e*96+t;a.setXYZ(n,-1+2*t/95,0,1-2*e/95)}this.aP=new j(new Float32Array(9216).fill(.5),1).setUsage(x),this.aG=new j(new Float32Array(18432),2).setUsage(x),i.setAttribute(`aP`,this.aP),i.setAttribute(`aG`,this.aG),i.setIndex(this.gridIndex()),this.terrain=new T(i,new m({vertexShader:ge,fragmentShader:_e,side:2,uniforms:{uH:{value:q},uTime:{value:0},uCam:{value:new g}}})),this.terrain.frustumCulled=!1,this.scene.add(this.terrain);let o=new T(new re(2.3,.05,2.3),new w({color:1382171}));o.position.y=-.031,this.scene.add(o);let s=new A(new ne(new re(2.3,.05,2.3)),new C({color:3817544}));s.position.y=-.031,this.scene.add(s),this.scene.add(this.ticks());let c=new E;this.ptPos=new j(new Float32Array(2700),3).setUsage(x),this.ptClass=new j(new Float32Array(900),1),this.ptWrong=new j(new Float32Array(900),1).setUsage(x),c.setAttribute(`position`,this.ptPos),c.setAttribute(`aClass`,this.ptClass),c.setAttribute(`aWrong`,this.ptWrong),c.setDrawRange(0,0),this.points=new te(c,new m({vertexShader:Y,fragmentShader:X,transparent:!0,depthWrite:!1,uniforms:{uScale:{value:1},uSize:{value:t.coarse?.062:.05},uTime:{value:0}}})),this.points.frustumCulled=!1,this.scene.add(this.points);let l=new E;this.emPos=new j(new Float32Array(420),3).setUsage(x),this.emLife=new j(new Float32Array(J),1).setUsage(x),l.setAttribute(`position`,this.emPos),l.setAttribute(`aLife`,this.emLife),this.embers=new te(l,new m({vertexShader:ve,fragmentShader:Z,transparent:!0,depthWrite:!1,blending:2,uniforms:{uScale:{value:1}}})),this.embers.frustumCulled=!1,this.embers.visible=!t.reduced,this.scene.add(this.embers),this.brush=new T(new N(.055,.064,40),new w({color:16777215,transparent:!0,opacity:.9,depthTest:!1})),this.brush.rotation.x=-Math.PI/2,this.brush.visible=!1,this.brush.renderOrder=10,this.scene.add(this.brush),this.composer=new V(r),this.composer.addPass(new H(this.scene,this.camera)),this.bloom=new W(new D(256,256),t.coarse?.4:.5,.5,.86),this.composer.addPass(this.bloom),this.composer.addPass(new K),e.addEventListener(`pointerdown`,this.onDown),e.addEventListener(`pointermove`,this.onMove),e.addEventListener(`pointerup`,this.onUp),e.addEventListener(`pointercancel`,this.onUp),e.addEventListener(`pointerleave`,this.onLeave),e.addEventListener(`wheel`,this.onWheel,{passive:!1})}gridIndex(){let e=new Uint32Array(54150),t=0;for(let n=0;n<95;n++)for(let r=0;r<95;r++){let i=n*96+r,a=i+1,o=i+96,s=o+1;e[t++]=i,e[t++]=a,e[t++]=o,e[t++]=a,e[t++]=s,e[t++]=o}return new j(e,1)}ticks(){let e=[];for(let t=0;t<=20;t++){let n=-1+t*.1,r=t%5==0?.075:.035;e.push(n,0,1.03,n,0,1.03+r,n,0,-1.03,n,0,-1.03-r),e.push(1.03,0,n,1.03+r,0,n,-1.03,0,n,-1.03-r,0,n)}let t=new E;return t.setAttribute(`position`,new M(e,3)),new A(t,new C({color:6975868}))}setGrid(e){this.target=e}setSamples(e,t,n){this.xs=e,this.ys=t;for(let t=this.n;t<n;t++)this.probs[t]=this.sample(e[2*t],e[2*t+1]);this.n=n;let r=this.ptClass.array;for(let e=0;e<n;e++)r[e]=t[e];this.ptClass.needsUpdate=!0,this.points.geometry.setDrawRange(0,n)}latest=null;setProbs(e){this.latest=e}setTop(e){this.top=e,this.gPhi=e?.0015:1.02,e&&(this.gTheta=Math.round(this.gTheta/(Math.PI*2))*Math.PI*2),this.gRadius=this.fit*(e?1.04:1),this.idle=0}setMode(e){this.mode=e,this.brush.visible=!1,this.canvas.style.cursor=e===`paint`?`crosshair`:`grab`}setBrushColor(e){this.brush.material.color.setHex(e)}resize(e,t,n,r=e/t){if(e<2||t<2)return;this.size=[e,t,n,r],n*=this.quality,this.renderer.setPixelRatio(n),this.renderer.setSize(e,t,!1),this.composer.setPixelRatio(n),this.composer.setSize(e,t),this.bloom.resolution.set(e/2,t/2);let i=e/t;this.camera.aspect=i,this.camera.updateProjectionMatrix();let a=this.fit;this.fit=r>=1.35?4.4:c(1.35/r*4.4*.86,4.4,9),this.gRadius*=this.fit/a,this.radius*=this.fit/a;let o=t*n/(2*Math.tan(this.camera.fov*Math.PI/360));this.points.material.uniforms.uScale.value=o,this.embers.material.uniforms.uScale.value=o*.01}sample(e,t){let n=c((e+1)*.5,0,1)*95,r=c((t+1)*.5,0,1)*95,i=Math.min(94,Math.floor(n)),a=Math.min(94,Math.floor(r)),s=n-i,l=r-a,u=this.shown,d=a*96+i;return o(o(u[d],u[d+1],s),o(u[d+96],u[d+96+1],s),l)}ndc=new D;pick(e,t){let n=this.canvas.getBoundingClientRect();this.ndc.set((e-n.left)/n.width*2-1,-((t-n.top)/n.height)*2+1),this.ray.setFromCamera(this.ndc,this.camera);let{origin:r,direction:i}=this.ray.ray;if(Math.abs(i.y)<1e-4)return null;let a=q*.3,o=0,s=0;for(let e=0;e<4;e++){let e=(a-r.y)/i.y;if(e<0)return null;o=r.x+i.x*e,s=r.z+i.z*e,a=this.sample(c(o,-1,1),c(-s,-1,1))*q}return Math.abs(o)>1.02||Math.abs(s)>1.02?null:{x:c(o,-.98,.98),y:c(-s,-.98,.98),h:a}}onDown=e=>{if(this.canvas.setPointerCapture(e.pointerId),this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.idle=0,this.onInteract(),this.pointers.size===2){this.painting&&(this.painting=!1,this.onPaint({x:0,y:0,phase:`end`}));let[e,t]=[...this.pointers.values()];this.pinch=Math.hypot(e.x-t.x,e.y-t.y),this.pinchAngle=Math.atan2(t.y-e.y,t.x-e.x)}else if(this.mode===`paint`&&e.button===0){let t=this.pick(e.clientX,e.clientY);t&&(this.painting=!0,this.onPaint({x:t.x,y:t.y,phase:`start`}))}else this.mode===`orbit`&&(this.canvas.style.cursor=`grabbing`)};onMove=e=>{let t=this.pointers.get(e.pointerId);if(this.mode===`paint`){let n=this.pick(e.clientX,e.clientY);this.brush.visible=!!n&&e.pointerType!==`touch`,n&&(this.brush.position.set(n.x,n.h+.012,-n.y),this.painting&&t&&this.onPaint({x:n.x,y:n.y,phase:`move`}))}if(!t)return;let n=e.clientX-t.x,r=e.clientY-t.y;if(t.x=e.clientX,t.y=e.clientY,this.idle=0,this.pointers.size===2){let[e,t]=[...this.pointers.values()],n=Math.hypot(e.x-t.x,e.y-t.y),r=Math.atan2(t.y-e.y,t.x-e.x);this.pinch>0&&(this.gRadius=c(this.gRadius*(this.pinch/n),this.fit*.45,this.fit*1.6));let i=r-this.pinchAngle;i>Math.PI&&(i-=Math.PI*2),i<-Math.PI&&(i+=Math.PI*2),this.gTheta-=i,this.pinch=n,this.pinchAngle=r}else(this.mode===`orbit`||this.mode===`paint`&&e.buttons===2)&&(this.gTheta-=n*.006,this.top||(this.gPhi=c(this.gPhi-r*.005,.18,1.45)))};onUp=e=>{this.pointers.delete(e.pointerId),this.pointers.size<2&&(this.pinch=0),this.painting&&this.pointers.size===0&&(this.painting=!1,this.onPaint({x:0,y:0,phase:`end`})),this.mode===`orbit`&&(this.canvas.style.cursor=`grab`)};onLeave=()=>{this.brush.visible=!1};onWheel=e=>{e.preventDefault(),this.idle=0,this.gRadius=c(this.gRadius*Math.exp(e.deltaY*.0012),this.fit*.45,this.fit*1.6)};nudge(e,t){this.idle=0,this.gTheta+=e,this.gRadius=c(this.gRadius*t,this.fit*.45,this.fit*1.6)}frame(e,t){if(this.disposed)return;let{shown:n,target:r}=this,i=this.aP.array,a=this.aG.array,s=1-Math.exp(-(this.opts.reduced?30:7)*e);for(let e=0;e<n.length;e++)n[e]+=(r[e]-n[e])*s;i.set(n);let l=95/4;for(let e=0;e<96;e++){let t=e>0?e-1:e,r=e<95?e+1:e;for(let i=0;i<96;i++){let o=i>0?i-1:i,s=i<95?i+1:i,c=(e*96+i)*2;a[c]=(n[e*96+s]-n[e*96+o])*l,a[c+1]=(n[r*96+i]-n[t*96+i])*l}}this.aP.needsUpdate=!0,this.aG.needsUpdate=!0;let d=this.ptPos.array,f=this.ptWrong.array,p=this.latest;for(let e=0;e<this.n;e++){let t=this.xs[2*e],n=this.xs[2*e+1];d[3*e]=t,d[3*e+1]=this.sample(t,n)*q+.022,d[3*e+2]=-n,p&&e<p.length&&(this.probs[e]=p[e]),f[e]=+(this.probs[e]>.5)===this.ys[e]?0:1}this.ptPos.needsUpdate=!0,this.ptWrong.needsUpdate=!0,this.embers.visible&&this.stepEmbers(e),this.idle+=e,!this.opts.reduced&&!this.top&&this.mode===`orbit`&&this.idle>2.5&&this.pointers.size===0&&(this.gTheta+=e*.07*Math.min(1,(this.idle-2.5)/2));let m=this.opts.reduced?40:6;this.theta=u(this.theta,this.gTheta,m,e),this.phi=u(this.phi,this.gPhi,m*.8,e),this.radius=u(this.radius,this.gRadius,m,e);let h=Math.sin(this.phi),g=o(.02,.2,c(this.phi/1));this.camera.position.set(this.radius*h*Math.sin(this.theta),g+this.radius*Math.cos(this.phi),this.radius*h*Math.cos(this.theta)),this.camera.up.set(0,1,0),this.phi<.05&&this.camera.up.set(-Math.sin(this.theta),0,-Math.cos(this.theta)),this.camera.lookAt(0,g,0);let _=this.terrain.material.uniforms;_.uTime.value=t,_.uCam.value.copy(this.camera.position),this.points.material.uniforms.uTime.value=t,this.frameAvg=o(this.frameAvg,e*1e3,.12),this.frames++,this.pinned||(this.frameAvg>34&&this.frames%30==0&&this.frames>30||e>.09&&this.frames%3==0)&&(this.tier===0?this.tier=1:this.quality>.4&&(this.quality*=.7,this.resize(...this.size)),this.frameAvg=20),this.scene.background=this.tier===0?this.bgComposer:this.bgDirect,this.tier===0?this.composer.render(e):this.renderer.render(this.scene,this.camera)}stepEmbers(e){let t=this.emPos.array,n=this.emLife.array,r=this.emVel,i=this.shown;for(let e=0;e<10;e++){let e=1+Math.floor(Math.random()*94),a=1+Math.floor(Math.random()*94),o=a*96+e;if((i[o]-.5)*(i[o+1]-.5)>=0&&(i[o]-.5)*(i[o+96]-.5)>=0||Math.abs(i[o+1]-i[o])+Math.abs(i[o+96]-i[o])<.02)continue;let s=this.emNext;if(this.emNext=(s+1)%J,t[3*s]=-1+2*e/95,t[3*s+1]=.5*q,t[3*s+2]=-(-1+2*a/95),r[3*s]=(Math.random()-.5)*.12,r[3*s+1]=.16+Math.random()*.3,r[3*s+2]=(Math.random()-.5)*.12,n[s]=1,Math.random()<.6)break}for(let i=0;i<J;i++)n[i]<=0||(n[i]=Math.max(0,n[i]-e*.75),r[3*i+1]-=e*.1,t[3*i]+=r[3*i]*e,t[3*i+1]+=r[3*i+1]*e,t[3*i+2]+=r[3*i+2]*e);this.emPos.needsUpdate=!0,this.emLife.needsUpdate=!0}dispose(){this.disposed=!0;let e=this.canvas;e.removeEventListener(`pointerdown`,this.onDown),e.removeEventListener(`pointermove`,this.onMove),e.removeEventListener(`pointerup`,this.onUp),e.removeEventListener(`pointercancel`,this.onUp),e.removeEventListener(`pointerleave`,this.onLeave),e.removeEventListener(`wheel`,this.onWheel),this.scene.traverse(e=>{let t=e;t.geometry?.dispose();let n=t.material;Array.isArray(n)?n.forEach(e=>e.dispose()):n?.dispose()}),this.composer.dispose(),this.renderer.dispose(),this.renderer.forceContextLoss()}};function be(e){let t=e.clientWidth,n=e.clientHeight;if(t<4||n<4)return null;let r=Math.min(window.devicePixelRatio||1,2);(e.width!==Math.round(t*r)||e.height!==Math.round(n*r))&&(e.width=Math.round(t*r),e.height=Math.round(n*r));let i=e.getContext(`2d`);return i?(i.setTransform(r,0,0,r,0,0),i.clearRect(0,0,t,n),{ctx:i,w:t,h:n}):null}var xe=`500 9px 'Geist Mono Variable', ui-monospace, monospace`;function Se(e,t,n){let r=be(e);if(!r)return;let{ctx:i,w:a,h:o}=r,s=.05,c=1;for(let e of n)e<s&&(s=e),e>c&&(c=e);let l=Math.floor(Math.log10(Math.max(s,1e-5))),u=Math.ceil(Math.log10(c)-1e-9),d=e=>5+(u-Math.log10(Math.max(e,1e-5)))/(u-l)*(o-5-5);i.font=xe,i.textBaseline=`middle`,i.lineWidth=1;for(let e=l;e<=u;e++){let t=Math.round(d(10**e))+.5;i.strokeStyle=`rgba(233,228,220,0.11)`,i.beginPath(),i.moveTo(30,t),i.lineTo(a,t),i.stroke(),i.fillStyle=`rgba(233,228,220,0.5)`;let n=e>=0?String(10**e):e>=-3?(10**e).toFixed(-e).slice(1):`1e${e}`;i.fillText(n,0,Math.min(o-5,Math.max(5,t)))}let f=t.length;if(f<2)return;let p=t[f-1],m=e=>30+e/p*(a-30-3);i.beginPath();for(let e=0;e<f;e++){let r=m(t[e]),a=d(n[e]);e===0?i.moveTo(r,a):i.lineTo(r,a)}i.strokeStyle=`#ff6a1a`,i.lineWidth=1.5,i.lineJoin=`round`,i.stroke(),i.lineTo(m(p),o),i.lineTo(m(t[0]),o),i.closePath();let h=i.createLinearGradient(0,0,0,o);h.addColorStop(0,`rgba(255,106,26,0.26)`),h.addColorStop(1,`rgba(255,106,26,0)`),i.fillStyle=h,i.fill(),i.fillStyle=`#fff3e0`,i.beginPath(),i.arc(m(p),d(n[f-1]),2.5,0,Math.PI*2),i.fill()}function Ce(e,t,n){let r=be(e);if(!r)return;let{ctx:i,w:a,h:o}=r,s=t.length-1,c=e=>16+e/s*(a-32),l=(e,n)=>{let r=t[e],i=Math.min(15,(o-12)/Math.max(1,r));return o/2+(n-(r-1)/2)*i},u=0,d=[],f=[];for(let e=0;e<s;e++)d.push(u),u+=t[e]*t[e+1],f.push(u),u+=t[e+1];if(!(n.length<u)){i.lineCap=`round`;for(let e=0;e<s;e++){let r=t[e],a=t[e+1],o=1e-6;for(let t=0;t<r*a;t++)o=Math.max(o,Math.abs(n[d[e]+t]));let s=c(e),u=c(e+1);for(let t=0;t<a;t++)for(let a=0;a<r;a++){let c=n[d[e]+t*r+a],f=Math.abs(c)/o;f<.07||(i.strokeStyle=c>0?`rgba(255,112,32,${(f*.85).toFixed(3)})`:`rgba(138,170,224,${(f*.85).toFixed(3)})`,i.lineWidth=.4+f*1.5,i.beginPath(),i.moveTo(s,l(e,a)),i.lineTo(u,l(e+1,t)),i.stroke())}}for(let e=0;e<=s;e++){let n=t[e],r=Math.min(3.4,Math.max(1.6,(o-12)/n/2.6));for(let t=0;t<n;t++)i.beginPath(),i.arc(c(e),l(e,t),r,0,Math.PI*2),i.fillStyle=`#0e0f11`,i.fill(),i.strokeStyle=e===s?`#ff6a1a`:`rgba(233,228,220,0.8)`,i.lineWidth=1,i.stroke()}}}var Q=e(),we={slow:20,live:240,max:1/0},Te=[0,1e-4,.001,.01],Ee=[`0`,`10⁻⁴`,`10⁻³`,`10⁻²`],De={defect:16738842,sound:13623551,erase:16777215},Oe=e=>e<.01?e.toFixed(4):e.toFixed(3);function $(e){return(0,Q.jsx)(`div`,{className:`sm-seg ${e.className??``}`,role:`radiogroup`,"aria-label":e.label,children:e.options.map(t=>(0,Q.jsx)(`button`,{type:`button`,role:`radio`,"aria-checked":e.value===t.id,title:t.title,onClick:()=>e.onChange(t.id),children:t.label},t.id))})}function ke(e){let{label:t,value:n,min:r,max:i,step:a=1,onChange:o}=e;return(0,Q.jsxs)(`div`,{className:`sm-row`,children:[(0,Q.jsx)(`span`,{className:`sm-row__k`,children:t}),(0,Q.jsxs)(`div`,{className:`sm-step`,children:[(0,Q.jsx)(`button`,{type:`button`,"aria-label":`Fewer: ${t}`,disabled:n<=r,onClick:()=>o(Math.max(r,n-a)),children:(0,Q.jsx)(`svg`,{width:`10`,height:`10`,viewBox:`0 0 10 10`,"aria-hidden":`true`,children:(0,Q.jsx)(`path`,{d:`M1 5h8`,stroke:`currentColor`,strokeWidth:`1.6`})})}),(0,Q.jsx)(`output`,{"aria-live":`polite`,children:n}),(0,Q.jsx)(`button`,{type:`button`,"aria-label":`More: ${t}`,disabled:n>=i,onClick:()=>o(Math.min(i,n+a)),children:(0,Q.jsx)(`svg`,{width:`10`,height:`10`,viewBox:`0 0 10 10`,"aria-hidden":`true`,children:(0,Q.jsx)(`path`,{d:`M1 5h8M5 1v8`,stroke:`currentColor`,strokeWidth:`1.6`})})})]})]})}function Ae(){let e=f(),t=l(),n=s(`(max-width: 980px), (max-height: 560px)`),[o,c]=(0,P.useState)(`spiral`),[u,m]=(0,P.useState)(.15),[h,g]=(0,P.useState)(11),[_,v]=(0,P.useState)(2),[y,ee]=(0,P.useState)(16),[b,te]=(0,P.useState)(`swish`),[x,S]=(0,P.useState)(5),[C,w]=(0,P.useState)(Math.log10(.02)),[T,E]=(0,P.useState)(0),[D,O]=(0,P.useState)(!0),[ne,re]=(0,P.useState)(`live`),[k,A]=(0,P.useState)(`orbit`),[j,ie]=(0,P.useState)(`defect`),[M,ae]=(0,P.useState)(!1),[N,oe]=(0,P.useState)(`train`),[se,le]=(0,P.useState)(!1),[F,I]=(0,P.useState)(!1),[L,R]=(0,P.useState)(!0),[pe,me]=(0,P.useState)(!1),he=(0,P.useRef)(null),z=(0,P.useRef)(null),B=(0,P.useRef)(null),V=(0,P.useRef)(null),H=(0,P.useRef)(null),U=(0,P.useRef)(null),W=(0,P.useRef)(null),G=(0,P.useRef)({steps:[],loss:[]}),K=(0,P.useRef)({xs:new Float32Array(1800),ys:new Uint8Array(900),n:0}),q=(0,P.useRef)({x:0,y:0}),J=(0,P.useRef)({brush:j,mode:k,top:M,compact:n,running:D});J.current={brush:j,mode:k,top:M,compact:n,running:D};let ge=Array.from({length:_},()=>y),_e=10**C,Y=(0,P.useCallback)(e=>U.current?.postMessage(e),[]),X=(0,P.useCallback)(()=>{let e=he.current;if(!e)return;let t=W.current,n=K.current.n,r=!!t&&n>0&&Number.isFinite(t.loss),i=(t,n)=>{e.querySelectorAll(`[data-ro="${t}"]`).forEach(e=>{e.textContent!==n&&(e.textContent=n)})};i(`loss`,r?t.loss<1e-4?`<.0001`:t.loss.toFixed(4):`—`),i(`acc`,r?`${(t.acc*100).toFixed(t.acc===1?0:1)}%`:`—`),i(`step`,t?t.step.toLocaleString(`en-US`):`0`),i(`sps`,t&&J.current.running&&n>0?Math.round(t.sps).toLocaleString(`en-US`):`0`),i(`n`,String(n)),i(`wrong`,r?String(Math.round((1-t.acc)*n)):`0`),B.current&&Se(B.current,G.current.steps,G.current.loss),V.current&&t&&Ce(V.current,t.sizes,t.params)},[]),ve=(0,P.useCallback)(e=>{let t=G.current,n=W.current;if(n&&e.step<n.step&&(t.steps.length=0,t.loss.length=0),W.current=e,H.current?.setGrid(e.grid),H.current?.setProbs(e.probs),Number.isFinite(e.loss)&&(t.steps.length===0||e.step>t.steps[t.steps.length-1])&&(t.steps.push(e.step),t.loss.push(e.loss),t.steps.length>700)){let e=0;for(let n=0;n<t.steps.length;n+=2)t.steps[e]=t.steps[n],t.loss[e++]=t.loss[n];t.steps.length=e,t.loss.length=e}X()},[X]),Z=(0,P.useCallback)(()=>{let e=K.current;H.current?.setSamples(e.xs,e.ys,e.n),Y({type:`data`,xs:e.xs.slice(0,e.n*2),ys:e.ys.slice(0,e.n),n:e.n}),me(e.n>=900),X()},[Y,X]),be=(0,P.useCallback)((e,t,n)=>{if(n===`end`)return;let r=K.current,i=J.current.brush;if(i===`erase`){let n=0;for(let i=0;i<r.n;i++)Math.hypot(r.xs[2*i]-e,r.xs[2*i+1]-t)<.09||(r.xs[2*n]=r.xs[2*i],r.xs[2*n+1]=r.xs[2*i+1],r.ys[n++]=r.ys[i]);n!==r.n&&(r.n=n,Z());return}let a=q.current;if(n===`move`&&Math.hypot(e-a.x,t-a.y)<.05||r.n>=900)return;a.x=e,a.y=t;let o=n===`move`?.035:0;r.xs[2*r.n]=Math.max(-.98,Math.min(.98,e+(Math.random()-.5)*o)),r.xs[2*r.n+1]=Math.max(-.98,Math.min(.98,t+(Math.random()-.5)*o)),r.ys[r.n]=+(i===`defect`),r.n++,Z()},[Z]);(0,P.useEffect)(()=>{let e=new Worker(new URL(`/assets/trainer.worker-oh1egCJy.js`,``+import.meta.url),{type:`module`});return U.current=e,e.onmessage=e=>ve(e.data),()=>{e.terminate(),U.current=null}},[ve]),(0,P.useEffect)(()=>{let n=z.current;if(!n)return;let i=document.createElement(`canvas`);n.appendChild(i);let a=null,o=()=>{let e=n.clientWidth,r=n.clientHeight,i=J.current.compact?e/r:Math.max(360,e-640)/r;a?.resize(e,r,d(t?1.75:2),i)};try{a=new ye(i,{reduced:e,coarse:t,bg:r.palette.bg,bgComposer:`#1e1f22`}),a.onInteract=()=>R(!1),a.onPaint=e=>be(e.x,e.y,e.phase);let n=K.current;a.setSamples(n.xs,n.ys,n.n),W.current&&a.setGrid(W.current.grid),a.setMode(J.current.mode),a.setBrushColor(De[J.current.brush]),a.setTop(J.current.top),o(),a.frame(.016,0),H.current=a,I(!1)}catch{a=null,i.remove(),I(!0)}le(!0);let s=new ResizeObserver(o);return s.observe(n),()=>{s.disconnect(),a?.dispose(),H.current=null,i.remove()}},[e,t,be]),a((e,t)=>H.current?.frame(e,t)),(0,P.useEffect)(()=>{G.current.steps.length=0,G.current.loss.length=0,Y({type:`reset`,spec:{hidden:Array.from({length:_},()=>y),activation:b},seed:x*7919+13})},[_,y,b,x,Y]),(0,P.useEffect)(()=>{let e=fe(o,u,i(h*101)),t=K.current;t.xs.set(e.xs),t.ys.set(e.ys),t.n=e.n,Z()},[o,u,h,Z]),(0,P.useEffect)(()=>{Y({type:`hyper`,lr:10**C,l2:T,rate:we[ne]})},[C,T,ne,Y]),(0,P.useEffect)(()=>{let e=()=>Y({type:`run`,on:D&&!document.hidden});return e(),document.addEventListener(`visibilitychange`,e),()=>document.removeEventListener(`visibilitychange`,e)},[D,Y]),(0,P.useEffect)(()=>{H.current?.setMode(k)},[k]),(0,P.useEffect)(()=>{H.current?.setBrushColor(De[j])},[j]),(0,P.useEffect)(()=>{H.current?.setTop(M)},[M]),(0,P.useLayoutEffect)(X,[X,N,n,D]);let xe=e=>{c(e),S(e=>e+1),e===`blank`&&(A(`paint`),R(!1))},Ae=(0,P.useCallback)(()=>{O(!1),Y({type:`step`})},[Y]),je=(0,P.useCallback)(()=>S(e=>e+1),[]),Me=()=>{K.current.n=0,Z()};(0,P.useEffect)(()=>{let e=e=>{if(e.metaKey||e.ctrlKey||e.altKey||he.current?.closest(`[inert]`))return;let t=e.target.tagName;if(t===`INPUT`||t===`TEXTAREA`||t===`SELECT`)return;let n=e.key.toLowerCase();if(n===` `){if(t===`BUTTON`)return;e.preventDefault(),O(e=>!e)}else if(n===`s`)Ae();else if(n===`r`)je();else if(n===`t`)ae(e=>!e);else if(n===`p`)A(e=>e===`paint`?`orbit`:`paint`);else if(n===`arrowleft`)H.current?.nudge(-.16,1);else if(n===`arrowright`)H.current?.nudge(.16,1);else if(n===`arrowup`||n===`=`||n===`+`)H.current?.nudge(0,.9);else if(n===`arrowdown`||n===`-`)H.current?.nudge(0,1.1);else return;R(!1)};return window.addEventListener(`keydown`,e),()=>window.removeEventListener(`keydown`,e)},[Ae,je]);let Ne=de.find(e=>e.id===o)?.note,Pe=(0,Q.jsx)(`div`,{className:`sm-presets`,role:`radiogroup`,"aria-label":`Dataset`,children:de.map(e=>(0,Q.jsx)(`button`,{type:`button`,role:`radio`,"aria-checked":o===e.id,onClick:()=>xe(e.id),children:e.label},e.id))}),Fe=(0,Q.jsxs)(`label`,{className:`sm-row sm-row--slider`,children:[(0,Q.jsx)(`span`,{className:`sm-row__k`,children:`Noise`}),(0,Q.jsx)(`input`,{type:`range`,min:0,max:1,step:.01,value:u,disabled:o===`blank`,onChange:e=>m(Number(e.target.value))}),(0,Q.jsx)(`span`,{className:`sm-row__v`,children:u.toFixed(2)})]}),Ie=(0,Q.jsx)($,{label:`Brush`,className:`sm-seg--brush`,value:j,onChange:e=>{ie(e),A(`paint`)},options:[{id:`defect`,label:(0,Q.jsxs)(Q.Fragment,{children:[(0,Q.jsx)(`i`,{className:`sm-dot sm-dot--defect`}),`Defect`]})},{id:`sound`,label:(0,Q.jsxs)(Q.Fragment,{children:[(0,Q.jsx)(`i`,{className:`sm-dot sm-dot--sound`}),`Sound`]})},{id:`erase`,label:`Erase`}]}),Le=(0,Q.jsx)($,{label:`Pointer tool`,value:k,onChange:e=>{A(e),R(!1)},options:[{id:`orbit`,label:`Orbit`,title:`Drag to orbit`},{id:`paint`,label:`Paint`,title:`Draw samples on the surface (P)`}]}),Re=(0,Q.jsxs)(`p`,{className:`sm-counts`,children:[(0,Q.jsxs)(`span`,{children:[(0,Q.jsx)(`b`,{"data-ro":`n`}),` samples`]}),(0,Q.jsxs)(`span`,{children:[(0,Q.jsx)(`b`,{"data-ro":`wrong`}),` misread`]}),pe&&(0,Q.jsxs)(`span`,{className:`sm-counts__full`,children:[`limit `,900]})]}),ze=(0,Q.jsxs)(`div`,{className:`sm-actions`,children:[(0,Q.jsx)(`button`,{type:`button`,className:`sm-btn`,disabled:o===`blank`,onClick:()=>g(e=>e+1),children:`Resample`}),(0,Q.jsx)(`button`,{type:`button`,className:`sm-btn`,onClick:Me,children:`Clear all`})]}),Be=(0,Q.jsxs)(Q.Fragment,{children:[(0,Q.jsx)(ke,{label:`Hidden layers`,value:_,min:1,max:4,onChange:v}),(0,Q.jsx)(ke,{label:`Units per layer`,value:y,min:2,max:24,step:2,onChange:ee}),(0,Q.jsxs)(`div`,{className:`sm-row sm-row--stack`,children:[(0,Q.jsx)(`span`,{className:`sm-row__k`,children:`Activation`}),(0,Q.jsx)($,{label:`Activation`,value:b,onChange:te,options:ce.map(e=>({id:e,label:e}))})]}),(0,Q.jsxs)(`label`,{className:`sm-row sm-row--slider`,children:[(0,Q.jsx)(`span`,{className:`sm-row__k`,children:`Learning rate`}),(0,Q.jsx)(`input`,{type:`range`,min:-3.5,max:-.7,step:.05,value:C,onChange:e=>w(Number(e.target.value))}),(0,Q.jsx)(`span`,{className:`sm-row__v`,children:Oe(_e)})]}),(0,Q.jsxs)(`div`,{className:`sm-row sm-row--stack`,children:[(0,Q.jsx)(`span`,{className:`sm-row__k`,children:`Weight decay`}),(0,Q.jsx)($,{label:`Weight decay`,value:String(T),onChange:e=>E(Number(e)),options:Te.map((e,t)=>({id:String(e),label:Ee[t]}))})]})]}),Ve=(0,Q.jsxs)(`figure`,{className:`sm-net`,children:[(0,Q.jsx)(`canvas`,{ref:V,"aria-hidden":`true`}),(0,Q.jsxs)(`figcaption`,{children:[(0,Q.jsx)(`span`,{children:[2,...ge,1].join(` → `)}),(0,Q.jsxs)(`span`,{children:[ue({hidden:ge,activation:b}).toLocaleString(`en-US`),` weights`]})]})]}),He=(0,Q.jsxs)(`figure`,{className:`sm-loss`,children:[(0,Q.jsx)(`canvas`,{ref:B,role:`img`,"aria-label":`Training loss over optimiser steps, log scale`}),(0,Q.jsxs)(`figcaption`,{children:[(0,Q.jsxs)(`span`,{children:[`step `,(0,Q.jsx)(`b`,{"data-ro":`step`})]}),(0,Q.jsxs)(`span`,{children:[(0,Q.jsx)(`b`,{"data-ro":`sps`}),` steps/s measured`]})]})]}),Ue=(0,Q.jsx)($,{label:`Training speed`,value:ne,onChange:re,options:[{id:`slow`,label:`Slow`,title:`20 steps per second`},{id:`live`,label:`Live`,title:`240 steps per second`},{id:`max`,label:`Max`,title:`As fast as this device allows`}]}),We=(0,Q.jsxs)(`button`,{type:`button`,className:`sm-play`,"aria-pressed":D,"aria-label":D?`Pause training`:`Start training`,onClick:()=>O(e=>!e),children:[(0,Q.jsx)(`svg`,{width:`14`,height:`14`,viewBox:`0 0 14 14`,"aria-hidden":`true`,children:D?(0,Q.jsx)(`path`,{d:`M2 1h3.5v12H2zM8.5 1H12v12H8.5z`,fill:`currentColor`}):(0,Q.jsx)(`path`,{d:`M2.5 1 12.5 7l-10 6z`,fill:`currentColor`})}),(0,Q.jsx)(`span`,{children:D?`Pause`:`Train`})]}),Ge=(0,Q.jsx)(`button`,{type:`button`,className:`sm-btn`,onClick:Ae,title:`One optimiser step (S)`,children:`Step`}),Ke=(0,Q.jsx)(`button`,{type:`button`,className:`sm-btn`,onClick:je,title:`Re-initialise the weights (R)`,children:`Reset`}),qe=(0,Q.jsx)(`button`,{type:`button`,className:`sm-btn sm-btn--toggle`,"aria-pressed":M,onClick:()=>ae(e=>!e),title:`Top-down view (T)`,children:`Plan view`}),Je=(0,Q.jsxs)(`div`,{className:`sm-big`,children:[(0,Q.jsxs)(`div`,{children:[(0,Q.jsx)(`span`,{className:`sm-label`,children:`Loss`}),(0,Q.jsx)(`strong`,{"data-ro":`loss`})]}),(0,Q.jsxs)(`div`,{children:[(0,Q.jsx)(`span`,{className:`sm-label`,children:`Accuracy`}),(0,Q.jsx)(`strong`,{"data-ro":`acc`})]})]});return(0,Q.jsx)(p,{meta:r,ready:se,children:(0,Q.jsxs)(`div`,{className:`sm`,ref:he,"data-compact":n,"data-mode":k,children:[(0,Q.jsxs)(`div`,{className:`sm-view`,children:[(0,Q.jsx)(`div`,{className:`sm-canvas`,ref:z,tabIndex:0,role:`application`,"aria-label":`Three-dimensional surface of the classifier's output. Arrow keys orbit and zoom.`}),F&&(0,Q.jsxs)(`div`,{className:`sm-fail`,children:[(0,Q.jsx)(`strong`,{children:`No WebGL here.`}),(0,Q.jsx)(`p`,{children:`The surface can't be drawn on this device, but the network is still training. The loss curve and weights below are live.`})]}),(0,Q.jsx)(`p`,{className:`sm-hint`,"data-on":L&&!F,"aria-hidden":!L,children:t?`Drag to orbit · pinch to zoom`:`Drag to orbit · scroll to zoom · P to paint`}),n&&(0,Q.jsxs)(`div`,{className:`sm-float`,children:[Le,k===`paint`&&Ie,qe]})]}),!n&&(0,Q.jsxs)(Q.Fragment,{children:[(0,Q.jsxs)(`aside`,{className:`sm-panel sm-panel--l`,"aria-label":`Data`,children:[(0,Q.jsx)(`h1`,{className:`sm-mark`,children:`Seam`}),(0,Q.jsxs)(`p`,{className:`sm-lede`,children:[`A classifier, trained on this page, drawn as terrain. High ground is where it says `,(0,Q.jsx)(`em`,{children:`defect`}),`. The bright line is where it changes its mind.`]}),(0,Q.jsxs)(`section`,{children:[(0,Q.jsx)(`h2`,{className:`sm-label`,children:`Data`}),Pe,(0,Q.jsx)(`p`,{className:`sm-note`,children:Ne}),Fe,ze]}),(0,Q.jsxs)(`section`,{children:[(0,Q.jsx)(`h2`,{className:`sm-label`,children:`Pointer`}),Le,Ie,Re]}),(0,Q.jsx)(`p`,{className:`sm-fine`,children:`Toy data on two abstract features. Not weld scans.`})]}),(0,Q.jsxs)(`aside`,{className:`sm-panel sm-panel--r`,"aria-label":`Model and readout`,children:[(0,Q.jsxs)(`section`,{children:[Je,He]}),(0,Q.jsxs)(`section`,{children:[(0,Q.jsx)(`h2`,{className:`sm-label`,children:`Network`}),Ve,Be]})]}),(0,Q.jsxs)(`div`,{className:`sm-bar`,role:`toolbar`,"aria-label":`Training`,children:[We,Ge,Ke,(0,Q.jsx)(`i`,{className:`sm-bar__rule`}),Ue,(0,Q.jsx)(`i`,{className:`sm-bar__rule`}),qe]})]}),n&&(0,Q.jsxs)(`div`,{className:`sm-drawer`,children:[(0,Q.jsxs)(`div`,{className:`sm-drawer__head`,children:[We,Je,(0,Q.jsxs)(`div`,{className:`sm-drawer__btns`,children:[Ge,Ke]})]}),(0,Q.jsx)(`div`,{className:`sm-tabs`,role:`tablist`,"aria-label":`Controls`,children:[`train`,`data`,`model`].map(e=>(0,Q.jsx)(`button`,{type:`button`,role:`tab`,"aria-selected":N===e,onClick:()=>oe(e),children:e},e))}),(0,Q.jsxs)(`div`,{className:`sm-drawer__body`,role:`tabpanel`,children:[N===`train`&&(0,Q.jsxs)(Q.Fragment,{children:[He,(0,Q.jsxs)(`div`,{className:`sm-row sm-row--stack`,children:[(0,Q.jsx)(`span`,{className:`sm-row__k`,children:`Speed`}),Ue]}),(0,Q.jsx)(`p`,{className:`sm-fine`,children:`High ground is where the model says defect. The bright line is where it changes its mind. Toy data, not weld scans.`})]}),N===`data`&&(0,Q.jsxs)(Q.Fragment,{children:[Pe,(0,Q.jsx)(`p`,{className:`sm-note`,children:Ne}),Fe,ze,Re]}),N===`model`&&(0,Q.jsxs)(Q.Fragment,{children:[Ve,Be]})]})]})]})})}export{Ae as default};