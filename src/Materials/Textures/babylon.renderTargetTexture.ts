﻿module BABYLON {
    export class RenderTargetTexture extends Texture {
        public static _REFRESHRATE_RENDER_ONCE: number = 0;
        public static _REFRESHRATE_RENDER_ONEVERYFRAME: number = 1;
        public static _REFRESHRATE_RENDER_ONEVERYTWOFRAMES: number = 2;

        public static get REFRESHRATE_RENDER_ONCE(): number {
            return RenderTargetTexture._REFRESHRATE_RENDER_ONCE;
        }

        public static get REFRESHRATE_RENDER_ONEVERYFRAME(): number {
            return RenderTargetTexture._REFRESHRATE_RENDER_ONEVERYFRAME;
        }

        public static get REFRESHRATE_RENDER_ONEVERYTWOFRAMES(): number {
            return RenderTargetTexture._REFRESHRATE_RENDER_ONEVERYTWOFRAMES;
        }

        /**
        * Use this predicate to dynamically define the list of mesh you want to render.
        * If set, the renderList property will be overwritten.
        */
        public renderListPredicate: (AbstractMesh: AbstractMesh) => boolean;

        /**
        * Use this list to define the list of mesh you want to render.
        */
        public renderList: Nullable<Array<AbstractMesh>> = new Array<AbstractMesh>();
        public renderParticles = true;
        public renderSprites = false;
        public coordinatesMode = Texture.PROJECTION_MODE;
        public activeCamera: Nullable<Camera>;
        public customRenderFunction: (opaqueSubMeshes: SmartArray<SubMesh>, alphaTestSubMeshes: SmartArray<SubMesh>, transparentSubMeshes: SmartArray<SubMesh>, depthOnlySubMeshes: SmartArray<SubMesh>, beforeTransparents?: () => void) => void;
        public useCameraPostProcesses: boolean;
        public ignoreCameraViewport: boolean = false;

        private _postProcessManager: Nullable<PostProcessManager>;
        private _postProcesses: PostProcess[];        

        private _resizeObserver: Nullable<Observer<Engine>>;

        // Events

        /**
        * An event triggered when the texture is unbind.
        */
        public onBeforeBindObservable = new Observable<RenderTargetTexture>();

        /**
        * An event triggered when the texture is unbind.
        */
        public onAfterUnbindObservable = new Observable<RenderTargetTexture>();

        private _onAfterUnbindObserver: Nullable<Observer<RenderTargetTexture>>;
        public set onAfterUnbind(callback: () => void) {
            if (this._onAfterUnbindObserver) {
                this.onAfterUnbindObservable.remove(this._onAfterUnbindObserver);
            }
            this._onAfterUnbindObserver = this.onAfterUnbindObservable.add(callback);
        }

        /**
        * An event triggered before rendering the texture
        */
        public onBeforeRenderObservable = new Observable<number>();

        private _onBeforeRenderObserver: Nullable<Observer<number>>;
        public set onBeforeRender(callback: (faceIndex: number) => void) {
            if (this._onBeforeRenderObserver) {
                this.onBeforeRenderObservable.remove(this._onBeforeRenderObserver);
            }
            this._onBeforeRenderObserver = this.onBeforeRenderObservable.add(callback);
        }

        /**
        * An event triggered after rendering the texture
        */
        public onAfterRenderObservable = new Observable<number>();

        private _onAfterRenderObserver: Nullable<Observer<number>>;
        public set onAfterRender(callback: (faceIndex: number) => void) {
            if (this._onAfterRenderObserver) {
                this.onAfterRenderObservable.remove(this._onAfterRenderObserver);
            }
            this._onAfterRenderObserver = this.onAfterRenderObservable.add(callback);
        }

        /**
        * An event triggered after the texture clear
        */
        public onClearObservable = new Observable<Engine>();

        private _onClearObserver: Nullable<Observer<Engine>>;
        public set onClear(callback: (Engine: Engine) => void) {
            if (this._onClearObserver) {
                this.onClearObservable.remove(this._onClearObserver);
            }
            this._onClearObserver = this.onClearObservable.add(callback);
        }

        public clearColor: Color4;
        protected _size: number | {width: number, height: number};
        protected _initialSizeParameter: number | {width: number, height: number} | {ratio: number}
        protected _sizeRatio: Nullable<number>;
        public _generateMipMaps: boolean;
        protected _renderingManager: RenderingManager;
        public _waitingRenderList: string[];
        protected _doNotChangeAspectRatio: boolean;
        protected _currentRefreshId = -1;
        protected _refreshRate = 1;
        protected _textureMatrix: Matrix;
        protected _samples = 1;
        protected _renderTargetOptions: RenderTargetCreationOptions;
        public get renderTargetOptions(): RenderTargetCreationOptions {
            return this._renderTargetOptions;
        }

        protected _engine: Engine;

        protected _onRatioRescale(): void {
            if (this._sizeRatio) {
                this.resize(this._initialSizeParameter);
            }
        }

        /**
         * Gets or sets the center of the bounding box associated with the texture (when in cube mode)
         * It must define where the camera used to render the texture is set
         */
        public boundingBoxPosition = Vector3.Zero();

        private _boundingBoxSize: Vector3;

        /**
         * Gets or sets the size of the bounding box associated with the texture (when in cube mode)
         * When defined, the cubemap will switch to local mode
         * @see https://community.arm.com/graphics/b/blog/posts/reflections-based-on-local-cubemaps-in-unity
         * @example https://www.babylonjs-playground.com/#RNASML
         */        
        public set boundingBoxSize(value: Vector3) {
            if (this._boundingBoxSize && this._boundingBoxSize.equals(value)) {
                return;
            }
            this._boundingBoxSize = value;
            let scene = this.getScene();
            if (scene) {
                scene.markAllMaterialsAsDirty(Material.TextureDirtyFlag);
            }
        }
        public get boundingBoxSize(): Vector3 {
            return this._boundingBoxSize;
        }

        /**
         * In case the RTT has been created with a depth texture, get the associated 
         * depth texture.
         * Otherwise, return null.
         */
        public depthStencilTexture: Nullable<InternalTexture>;

        /**
         * Instantiate a render target texture. This is mainly to render of screen the scene to for instance apply post processse
         * or used a shadow, depth texture...
         * @param name The friendly name of the texture
         * @param size The size of the RTT (number if square, or {with: number, height:number} or {ratio:} to define a ratio from the main scene)
         * @param scene The scene the RTT belongs to. The latest created scene will be used if not precised.
         * @param generateMipMaps True if mip maps need to be generated after render.
         * @param doNotChangeAspectRatio True to not change the aspect ratio of the scene in the RTT
         * @param type The type of the buffer in the RTT (int, half float, float...)
         * @param isCube True if a cube texture needs to be created
         * @param samplingMode The sampling mode to be usedwith the render target (Linear, Nearest...)
         * @param generateDepthBuffer True to generate a depth buffer
         * @param generateStencilBuffer True to generate a stencil buffer
         * @param isMulti True if multiple textures need to be created (Draw Buffers)
         * @param format The internal format of the buffer in the RTT (RED, RG, RGB, RGBA, ALPHA...)
         */
        constructor(name: string, size: number | {width: number, height: number} | {ratio: number}, scene: Nullable<Scene>, generateMipMaps?: boolean, doNotChangeAspectRatio: boolean = true, type: number = Engine.TEXTURETYPE_UNSIGNED_INT, public isCube = false, samplingMode = Texture.TRILINEAR_SAMPLINGMODE, generateDepthBuffer = true, generateStencilBuffer = false, isMulti = false, format = Engine.TEXTUREFORMAT_RGBA) {
            super(null, scene, !generateMipMaps);
            scene = this.getScene();

            if (!scene) {
                return;
            }

            this._engine = scene.getEngine();
            this.name = name;
            this.isRenderTarget = true;
            this._initialSizeParameter = size;

            this._processSizeParameter(size);

            this._resizeObserver = this.getScene()!.getEngine().onResizeObservable.add(() => {
            });            

            this._generateMipMaps = generateMipMaps ? true : false;
            this._doNotChangeAspectRatio = doNotChangeAspectRatio;

            // Rendering groups
            this._renderingManager = new RenderingManager(scene);

            if (isMulti) {
                return;
            }

            this._renderTargetOptions = {
                generateMipMaps: generateMipMaps,
                type: type,
                format: format,
                samplingMode: samplingMode,
                generateDepthBuffer: generateDepthBuffer,
                generateStencilBuffer: generateStencilBuffer
            };

            if (samplingMode === Texture.NEAREST_SAMPLINGMODE) {
                this.wrapU = Texture.CLAMP_ADDRESSMODE;
                this.wrapV = Texture.CLAMP_ADDRESSMODE;
            }

            if (isCube) {
                this._texture = scene.getEngine().createRenderTargetCubeTexture(this.getRenderSize(), this._renderTargetOptions);
                this.coordinatesMode = Texture.INVCUBIC_MODE;
                this._textureMatrix = Matrix.Identity();
            } else {
                this._texture = scene.getEngine().createRenderTargetTexture(this._size, this._renderTargetOptions);
            }

        }

        /**
         * Creates a depth stencil texture.
         * This is only available in WebGL 2 or with the depth texture extension available.
         * @param comparisonFunction Specifies the comparison function to set on the texture. If 0 or undefined, the texture is not in comparison mode
         * @param bilinearFiltering Specifies whether or not bilinear filtering is enable on the texture
         * @param generateStencil Specifies whether or not a stencil should be allocated in the texture
         */
        public createDepthStencilTexture(comparisonFunction: number = 0, bilinearFiltering: boolean = true, generateStencil: boolean = false) : void {
            if (!this.getScene()) {
                return;
            }

            var engine = this.getScene()!.getEngine();
            this.depthStencilTexture = engine.createDepthStencilTexture(this._size, {
                bilinearFiltering,
                comparisonFunction,
                generateStencil,
                isCube: this.isCube
            });
            engine.setFrameBufferDepthStencilTexture(this);
        }

        private _processSizeParameter(size: number | {width: number, height: number} | {ratio: number}): void {
            if ((<{ratio: number}>size).ratio) {
                this._sizeRatio = (<{ratio: number}>size).ratio;
                this._size = {
                    width: this._bestReflectionRenderTargetDimension(this._engine.getRenderWidth(), this._sizeRatio),
                    height: this._bestReflectionRenderTargetDimension(this._engine.getRenderHeight(), this._sizeRatio)
                }
            } else {            
                this._size = <number | {width: number, height: number}>size;
            }
        }

        public get samples(): number {
            return this._samples;
        }

        public set samples(value: number) {
            if (this._samples === value) {
                return;
            }

            let scene = this.getScene();

            if (!scene) {
                return;
            }

            this._samples = scene.getEngine().updateRenderTargetTextureSampleCount(this._texture, value);
        }

        public resetRefreshCounter(): void {
            this._currentRefreshId = -1;
        }

        public get refreshRate(): number {
            return this._refreshRate;
        }

        // Use 0 to render just once, 1 to render on every frame, 2 to render every two frames and so on...
        public set refreshRate(value: number) {
            this._refreshRate = value;
            this.resetRefreshCounter();
        }

        public addPostProcess(postProcess: PostProcess): void {
            if (!this._postProcessManager) {
                let scene = this.getScene();
                
                if (!scene) {
                    return;
                }                
                this._postProcessManager = new PostProcessManager(scene);
                this._postProcesses = new Array<PostProcess>();
            }

            this._postProcesses.push(postProcess);
            this._postProcesses[0].autoClear = false;
        }

        public clearPostProcesses(dispose?: boolean): void {
            if (!this._postProcesses) {
                return;
            }

            if (dispose) {
                for (var postProcess of this._postProcesses) {
                    postProcess.dispose();
                }
            }

            this._postProcesses = [];
        }

        public removePostProcess(postProcess: PostProcess): void {
            if (!this._postProcesses) {
                return;
            }

            var index = this._postProcesses.indexOf(postProcess);

            if (index === -1) {
                return;
            }

            this._postProcesses.splice(index, 1);

            if (this._postProcesses.length > 0) {
                this._postProcesses[0].autoClear = false;
            }
        }

        public _shouldRender(): boolean {
            if (this._currentRefreshId === -1) { // At least render once
                this._currentRefreshId = 1;
                return true;
            }

            if (this.refreshRate === this._currentRefreshId) {
                this._currentRefreshId = 1;
                return true;
            }

            this._currentRefreshId++;
            return false;
        }

        public getRenderSize(): number {
            if ((<{width: number, height: number}>this._size).width) {
                return (<{width: number, height: number}>this._size).width;
            }

            return <number>this._size;
        }

        public getRenderWidth(): number {
            if ((<{width: number, height: number}>this._size).width) {
                return (<{width: number, height: number}>this._size).width;
            }

            return <number>this._size;
        }

        public getRenderHeight(): number {
            if ((<{width: number, height: number}>this._size).width) {
                return (<{width: number, height: number}>this._size).height;
            }

            return <number>this._size;
        }

        public get canRescale(): boolean {
            return true;
        }

        public scale(ratio: number): void {
            var newSize = this.getRenderSize() * ratio;

            this.resize(newSize);
        }

        public getReflectionTextureMatrix(): Matrix {
            if (this.isCube) {
                return this._textureMatrix;
            }

            return super.getReflectionTextureMatrix();
        }

        public resize(size: number | {width: number, height: number} | {ratio: number}) {
            this.releaseInternalTexture();
            let scene = this.getScene();
            
            if (!scene) {
                return;
            }
            
            this._processSizeParameter(size);
            
            if (this.isCube) {
                this._texture = scene.getEngine().createRenderTargetCubeTexture(this.getRenderSize(), this._renderTargetOptions);
            } else {
                this._texture = scene.getEngine().createRenderTargetTexture(this._size, this._renderTargetOptions);
            }
        }

        public render(useCameraPostProcess: boolean = false, dumpForDebug: boolean = false) {
            var scene = this.getScene();

            if (!scene) {
                return;
            }

            var engine = scene.getEngine();

            if (this.useCameraPostProcesses !== undefined) {
                useCameraPostProcess = this.useCameraPostProcesses;
            }

            if (this._waitingRenderList) {
                this.renderList = [];
                for (var index = 0; index < this._waitingRenderList.length; index++) {
                    var id = this._waitingRenderList[index];
                    let mesh = scene.getMeshByID(id);
                    if (mesh) {
                        this.renderList.push(mesh);
                    }
                }

                delete this._waitingRenderList;
            }

            // Is predicate defined?
            if (this.renderListPredicate) {
                if (this.renderList) {
                    this.renderList.splice(0); // Clear previous renderList
                } else {
                    this.renderList = [];
                }

                var scene = this.getScene();
                
                if (!scene) {
                    return;
                }

                var sceneMeshes = scene.meshes;

                for (var index = 0; index < sceneMeshes.length; index++) {
                    var mesh = sceneMeshes[index];
                    if (this.renderListPredicate(mesh)) {
                        this.renderList.push(mesh);
                    }
                }
            }

            this.onBeforeBindObservable.notifyObservers(this);

            // Set custom projection.
            // Needs to be before binding to prevent changing the aspect ratio.
            let camera: Nullable<Camera>;
            if (this.activeCamera) {
                camera = this.activeCamera;
                engine.setViewport(this.activeCamera.viewport, this.getRenderWidth(), this.getRenderHeight());

                if (this.activeCamera !== scene.activeCamera) {
                    scene.setTransformMatrix(this.activeCamera.getViewMatrix(), this.activeCamera.getProjectionMatrix(true));
                }
            }
            else {
                camera = scene.activeCamera;
                if (camera) {
                    engine.setViewport(camera.viewport, this.getRenderWidth(), this.getRenderHeight());
                }
            }

            // Prepare renderingManager
            this._renderingManager.reset();

            var currentRenderList = this.renderList ? this.renderList : scene.getActiveMeshes().data;
            var currentRenderListLength = this.renderList ? this.renderList.length : scene.getActiveMeshes().length;
            var sceneRenderId = scene.getRenderId();
            for (var meshIndex = 0; meshIndex < currentRenderListLength; meshIndex++) {
                var mesh = currentRenderList[meshIndex];

                if (mesh) {
                    if (!mesh.isReady(this.refreshRate === 0)) {
                        this.resetRefreshCounter();
                        continue;
                    }

                    mesh._preActivateForIntermediateRendering(sceneRenderId);

                    let isMasked;
                    if (!this.renderList && camera) {
                        isMasked = ((mesh.layerMask & camera.layerMask) === 0);
                    } else {
                        isMasked = false;
                    }

                    if (mesh.isEnabled() && mesh.isVisible && mesh.subMeshes && !isMasked) {
                        mesh._activate(sceneRenderId);

                        for (var subIndex = 0; subIndex < mesh.subMeshes.length; subIndex++) {
                            var subMesh = mesh.subMeshes[subIndex];
                            scene._activeIndices.addCount(subMesh.indexCount, false);
                            this._renderingManager.dispatch(subMesh, mesh);
                        }
                    }
                }
            }

            for (var particleIndex = 0; particleIndex < scene.particleSystems.length; particleIndex++) {
                var particleSystem = scene.particleSystems[particleIndex];

                let emitter: any = particleSystem.emitter;
                if (!particleSystem.isStarted() || !emitter || !emitter.position || !emitter.isEnabled()) {
                    continue;
                }

                if (currentRenderList.indexOf(emitter) >= 0) {
                    this._renderingManager.dispatchParticles(particleSystem);
                }
            }

            if (this.isCube) {
                for (var face = 0; face < 6; face++) {
                    this.renderToTarget(face, currentRenderList, currentRenderListLength, useCameraPostProcess, dumpForDebug);
                    scene.incrementRenderId();
                    scene.resetCachedMaterial();
                }
            } else {
                this.renderToTarget(0, currentRenderList, currentRenderListLength, useCameraPostProcess, dumpForDebug);
            }

            this.onAfterUnbindObservable.notifyObservers(this);

            if (scene.activeCamera) {
                if (this.activeCamera && this.activeCamera !== scene.activeCamera) {
                    scene.setTransformMatrix(scene.activeCamera.getViewMatrix(), scene.activeCamera.getProjectionMatrix(true));
                }
                engine.setViewport(scene.activeCamera.viewport);
            }

            scene.resetCachedMaterial();
        }

        private _bestReflectionRenderTargetDimension(renderDimension: number, scale: number): number {
            let minimum = 128;
            let x = renderDimension * scale;
            let curved = Tools.NearestPOT(x + (minimum * minimum / (minimum + x)));
            
            // Ensure we don't exceed the render dimension (while staying POT)
            return Math.min(Tools.FloorPOT(renderDimension), curved);
        }

        protected unbindFrameBuffer(engine: Engine, faceIndex: number): void {
            if (!this._texture) {
                return;
            }
            engine.unBindFramebuffer(this._texture, this.isCube, () => {
                this.onAfterRenderObservable.notifyObservers(faceIndex);
            });
        }

        private renderToTarget(faceIndex: number, currentRenderList: AbstractMesh[], currentRenderListLength: number, useCameraPostProcess: boolean, dumpForDebug: boolean): void {
            var scene = this.getScene();
            
            if (!scene) {
                return;
            }

            var engine = scene.getEngine();

            if (!this._texture) {
                return;
            }

            // Bind
            if (this._postProcessManager) {
                this._postProcessManager._prepareFrame(this._texture, this._postProcesses);
            }
            else if (!useCameraPostProcess || !scene.postProcessManager._prepareFrame(this._texture)) {
                if (this._texture) {
                    engine.bindFramebuffer(this._texture, this.isCube ? faceIndex : undefined, undefined, undefined, this.ignoreCameraViewport, this.depthStencilTexture ? this.depthStencilTexture : undefined);
                }
            }

            this.onBeforeRenderObservable.notifyObservers(faceIndex);

            // Clear
            if (this.onClearObservable.hasObservers()) {
                this.onClearObservable.notifyObservers(engine);
            } else {
                engine.clear(this.clearColor || scene.clearColor, true, true, true);
            }

            if (!this._doNotChangeAspectRatio) {
                scene.updateTransformMatrix(true);
            }

            // Render
            this._renderingManager.render(this.customRenderFunction, currentRenderList, this.renderParticles, this.renderSprites);

            if (this._postProcessManager) {
                this._postProcessManager._finalizeFrame(false, this._texture, faceIndex, this._postProcesses, this.ignoreCameraViewport);
            }
            else if (useCameraPostProcess) {
                scene.postProcessManager._finalizeFrame(false, this._texture, faceIndex);
            }

            if (!this._doNotChangeAspectRatio) {
                scene.updateTransformMatrix(true);
            }

            // Dump ?
            if (dumpForDebug) {
                Tools.DumpFramebuffer(this.getRenderWidth(), this.getRenderHeight(), engine);
            }

            // Unbind
            if (!this.isCube || faceIndex === 5) {
                if (this.isCube) {

                    if (faceIndex === 5) {
                        engine.generateMipMapsForCubemap(this._texture);
                    }
                }

            this.unbindFrameBuffer(engine, faceIndex);

            } else {
                this.onAfterRenderObservable.notifyObservers(faceIndex);
            }
        }

        /**
         * Overrides the default sort function applied in the renderging group to prepare the meshes.
         * This allowed control for front to back rendering or reversly depending of the special needs.
         * 
         * @param renderingGroupId The rendering group id corresponding to its index
         * @param opaqueSortCompareFn The opaque queue comparison function use to sort.
         * @param alphaTestSortCompareFn The alpha test queue comparison function use to sort.
         * @param transparentSortCompareFn The transparent queue comparison function use to sort.
         */
        public setRenderingOrder(renderingGroupId: number,
            opaqueSortCompareFn: Nullable<(a: SubMesh, b: SubMesh) => number> = null,
            alphaTestSortCompareFn: Nullable<(a: SubMesh, b: SubMesh) => number> = null,
            transparentSortCompareFn: Nullable<(a: SubMesh, b: SubMesh) => number> = null): void {

            this._renderingManager.setRenderingOrder(renderingGroupId,
                opaqueSortCompareFn,
                alphaTestSortCompareFn,
                transparentSortCompareFn);
        }

        /**
         * Specifies whether or not the stencil and depth buffer are cleared between two rendering groups.
         * 
         * @param renderingGroupId The rendering group id corresponding to its index
         * @param autoClearDepthStencil Automatically clears depth and stencil between groups if true.
         */
        public setRenderingAutoClearDepthStencil(renderingGroupId: number, autoClearDepthStencil: boolean): void {
            this._renderingManager.setRenderingAutoClearDepthStencil(renderingGroupId, autoClearDepthStencil);
        }

        public clone(): RenderTargetTexture {
            var textureSize = this.getSize();
            var newTexture = new RenderTargetTexture(
                this.name,
                textureSize,
                this.getScene(),
                this._renderTargetOptions.generateMipMaps,
                this._doNotChangeAspectRatio,
                this._renderTargetOptions.type,
                this.isCube,
                this._renderTargetOptions.samplingMode,
                this._renderTargetOptions.generateDepthBuffer,
                this._renderTargetOptions.generateStencilBuffer
            );

            // Base texture
            newTexture.hasAlpha = this.hasAlpha;
            newTexture.level = this.level;

            // RenderTarget Texture
            newTexture.coordinatesMode = this.coordinatesMode;
            if (this.renderList) {
                newTexture.renderList = this.renderList.slice(0);
            }

            return newTexture;
        }

        public serialize(): any {
            if (!this.name) {
                return null;
            }

            var serializationObject = super.serialize();

            serializationObject.renderTargetSize = this.getRenderSize();
            serializationObject.renderList = [];

            if (this.renderList) {
                for (var index = 0; index < this.renderList.length; index++) {
                    serializationObject.renderList.push(this.renderList[index].id);
                }
            }

            return serializationObject;
        }

        // This will remove the attached framebuffer objects. The texture will not be able to be used as render target anymore
        public disposeFramebufferObjects(): void {
            let objBuffer = this.getInternalTexture();
            let scene = this.getScene();
            if (objBuffer && scene) {
                scene.getEngine()._releaseFramebufferObjects(objBuffer);
            }
        }

        public dispose(): void {
            if (this._postProcessManager) {
                this._postProcessManager.dispose();
                this._postProcessManager = null;
            }

            this.clearPostProcesses(true);

            if (this._resizeObserver) {
                this.getScene()!.getEngine().onResizeObservable.remove(this._resizeObserver);
                this._resizeObserver = null;
            }

            this.renderList = null;

            // Remove from custom render targets
            var scene = this.getScene();

            if (!scene) {
                return;
            }

            var index = scene.customRenderTargets.indexOf(this);

            if (index >= 0) {
                scene.customRenderTargets.splice(index, 1);
            }

            for (var camera of scene.cameras) {
                index = camera.customRenderTargets.indexOf(this);

                if (index >= 0) {
                    camera.customRenderTargets.splice(index, 1);
                }
            }

            super.dispose();
        }

        public _rebuild(): void {
            if (this.refreshRate === RenderTargetTexture.REFRESHRATE_RENDER_ONCE) {
                this.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
            }

            if (this._postProcessManager) {
                this._postProcessManager._rebuild();
            }
        }

        /**
         * Clear the info related to rendering groups preventing retention point in material dispose.
         */
        public freeRenderingGroups(): void {
            if (this._renderingManager) {
                this._renderingManager.freeRenderingGroups();
            }
        }
    }
}
