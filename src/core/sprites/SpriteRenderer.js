var ObjectRenderer = require('../renderers/webgl/utils/ObjectRenderer'),
    Shader = require('../renderers/webgl/shaders/Shader'),
    SpriteShader = require('../renderers/webgl/shaders/SpriteShader'),
    WebGLRenderer = require('../renderers/webgl/WebGLRenderer');

/**
 * @author Mat Groves
 *
 * Big thanks to the very clever Matt DesLauriers <mattdesl> https://github.com/mattdesl/
 * for creating the original pixi version!
 * Also a thanks to https://github.com/bchevalier for tweaking the tint and alpha so that they now share 4 bytes on the vertex buffer
 *
 * Heavily inspired by LibGDX's SpriteRenderer:
 * https://github.com/libgdx/libgdx/blob/master/gdx/src/com/badlogic/gdx/graphics/g2d/SpriteRenderer.java
 */

/**
 *
 * @class
 * @private
 * @namespace PIXI
 * @param renderer {WebGLRenderer} The renderer this sprite batch works for.
 */
function SpriteRenderer(renderer)
{
    ObjectRenderer.call(this, renderer);

    /**
     *
     *
     * @member {WebGLRenderer}
     */
    this.renderer = renderer;

    /**
     *
     *
     * @member {number}
     */
    this.vertSize = 5;

    /**
     *
     *
     * @member {number}
     */
    this.vertByteSize = this.vertSize * 4;

    /**
     * The number of images in the SpriteBatch before it flushes.
     *
     * @member {number}
     */
    this.size = 2000;//Math.pow(2, 16) /  this.vertSize;

    // the total number of bytes in our batch
    var numVerts = this.size * 4 * this.vertByteSize;
    // the total number of indices in our batch
    var numIndices = this.size * 6;

    /**
     * Holds the vertices
     *
     * @member {ArrayBuffer}
     */
    this.vertices = new ArrayBuffer(numVerts);

    /**
     * View on the vertices as a Float32Array
     *
     * @member {Float32Array}
     */
    this.positions = new Float32Array(this.vertices);

    /**
     * View on the vertices as a Uint32Array
     *
     * @member {Uint32Array}
     */
    this.colors = new Uint32Array(this.vertices);

    /**
     * Holds the indices
     *
     * @member {Uint16Array}
     */
    this.indices = new Uint16Array(numIndices);

    /**
     *
     *
     * @member {number}
     */
    this.lastIndexCount = 0;

    for (var i=0, j=0; i < numIndices; i += 6, j += 4)
    {
        this.indices[i + 0] = j + 0;
        this.indices[i + 1] = j + 1;
        this.indices[i + 2] = j + 2;
        this.indices[i + 3] = j + 0;
        this.indices[i + 4] = j + 2;
        this.indices[i + 5] = j + 3;
    }

    /**
     *
     *
     * @member {boolean}
     */
    this.drawing = false;

    /**
     *
     *
     * @member {number}
     */
    this.currentBatchSize = 0;

    /**
     *
     *
     * @member {BaseTexture}
     */
    this.currentBaseTexture = null;

    /**
     *
     *
     * @member {boolean}
     */
    this.dirty = true;

    /**
     *
     *
     * @member {Array}
     */
    this.textures = [];

    /**
     *
     *
     * @member {Array}
     */
    this.blendModes = [];

    /**
     *
     *
     * @member {Array}
     */
    this.shaders = [];

    /**
     *
     *
     * @member {Array}
     */
    this.sprites = [];

    /**
     * The default shader that is used if a sprite doesn't have a more specific one.
     *
     * @member {Shader}
     */
    this.shader = null;

    // listen for context and update necessary buffers
    var self = this;
    this.renderer.on('context', function ()
    {
        self.setupContext();
    });
}

SpriteRenderer.prototype = Object.create(ObjectRenderer.prototype);
SpriteRenderer.prototype.constructor = SpriteRenderer;
module.exports = SpriteRenderer;

WebGLRenderer.registerObjectRenderer('sprite', SpriteRenderer);

/**
 * Sets up the renderer context and necessary buffers.
 *
 * @private
 * @param gl {WebGLContext} the current WebGL drawing context
 */
SpriteRenderer.prototype.setupContext = function ()
{
    var gl = this.renderer.gl;

    // setup default shader
    this.shader = new SpriteShader(gl);

    // create a couple of buffers
    this.vertexBuffer = gl.createBuffer();
    this.indexBuffer = gl.createBuffer();

    // 65535 is max index, so 65535 / 6 = 10922.

    //upload the index data
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW);

    this.currentBlendMode = 99999;
};

/**
 * Renders the sprite object.
 *
 * @param sprite {Sprite} the sprite to render when using this spritebatch
 */
SpriteRenderer.prototype.render = function (sprite)
{
    var texture = sprite.texture;

    //TODO set blend modes..
    // check texture..
    if (this.currentBatchSize >= this.size)
    {
        this.flush();
        this.currentBaseTexture = texture.baseTexture;
    }

    // get the uvs for the texture
    var uvs = texture._uvs;

    // if the uvs have not updated then no point rendering just yet!
    if (!uvs)
    {
        return;
    }

    // TODO trim??
    var aX = sprite.anchor.x;
    var aY = sprite.anchor.y;

    var w0, w1, h0, h1;

    if (texture.trim)
    {
        // if the sprite is trimmed then we need to add the extra space before transforming the sprite coords..
        var trim = texture.trim;

        w1 = trim.x - aX * trim.width;
        w0 = w1 + texture.crop.width;

        h1 = trim.y - aY * trim.height;
        h0 = h1 + texture.crop.height;

    }
    else
    {
        w0 = (texture.frame.width ) * (1-aX);
        w1 = (texture.frame.width ) * -aX;

        h0 = texture.frame.height * (1-aY);
        h1 = texture.frame.height * -aY;
    }

    var index = this.currentBatchSize * this.vertByteSize;

    var resolution = texture.baseTexture.resolution;

    var worldTransform = sprite.worldTransform;

    var a = worldTransform.a / resolution;
    var b = worldTransform.b / resolution;
    var c = worldTransform.c / resolution;
    var d = worldTransform.d / resolution;
    var tx = worldTransform.tx;
    var ty = worldTransform.ty;

    var colors = this.colors;
    var positions = this.positions;

    if (this.renderer.roundPixels)
    {
        // xy
        positions[index] = a * w1 + c * h1 + tx | 0;
        positions[index+1] = d * h1 + b * w1 + ty | 0;

        // xy
        positions[index+5] = a * w0 + c * h1 + tx | 0;
        positions[index+6] = d * h1 + b * w0 + ty | 0;

         // xy
        positions[index+10] = a * w0 + c * h0 + tx | 0;
        positions[index+11] = d * h0 + b * w0 + ty | 0;

        // xy
        positions[index+15] = a * w1 + c * h0 + tx | 0;
        positions[index+16] = d * h0 + b * w1 + ty | 0;
    }
    else
    {
        // xy
        positions[index] = a * w1 + c * h1 + tx;
        positions[index+1] = d * h1 + b * w1 + ty;

        // xy
        positions[index+5] = a * w0 + c * h1 + tx;
        positions[index+6] = d * h1 + b * w0 + ty;

         // xy
        positions[index+10] = a * w0 + c * h0 + tx;
        positions[index+11] = d * h0 + b * w0 + ty;

        // xy
        positions[index+15] = a * w1 + c * h0 + tx;
        positions[index+16] = d * h0 + b * w1 + ty;
    }

    // uv
    positions[index+2] = uvs.x0;
    positions[index+3] = uvs.y0;

    // uv
    positions[index+7] = uvs.x1;
    positions[index+8] = uvs.y1;

     // uv
    positions[index+12] = uvs.x2;
    positions[index+13] = uvs.y2;

    // uv
    positions[index+17] = uvs.x3;
    positions[index+18] = uvs.y3;

    // color and alpha
    var tint = sprite.tint;
    colors[index+4] = colors[index+9] = colors[index+14] = colors[index+19] = (tint >> 16) + (tint & 0xff00) + ((tint & 0xff) << 16) + (sprite.worldAlpha * 255 << 24);

    // increment the batchsize
    this.sprites[this.currentBatchSize++] = sprite;
};

/**
 * Renders the content and empties the current batch.
 *
 */
SpriteRenderer.prototype.flush = function ()
{
    // If the batch is length 0 then return as there is nothing to draw
    if (this.currentBatchSize === 0)
    {
        return;
    }

    var gl = this.renderer.gl;
    var shader;

    if (this.dirty)
    {
        this.dirty = false;
        // bind the main texture
        gl.activeTexture(gl.TEXTURE0);

        // bind the buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        // this is the same for each shader?
        var stride =  this.vertByteSize;
        gl.vertexAttribPointer(this.shader.attributes.aVertexPosition, 2, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(this.shader.attributes.aTextureCoord, 2, gl.FLOAT, false, stride, 2 * 4);

        // color attributes will be interpreted as unsigned bytes and normalized
        gl.vertexAttribPointer(this.shader.attributes.aColor, 4, gl.UNSIGNED_BYTE, true, stride, 4 * 4);
    }

    // upload the verts to the buffer
    if (this.currentBatchSize > ( this.size * 0.5 ) )
    {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices);
    }
    else
    {
        var view = this.positions.subarray(0, this.currentBatchSize * this.vertByteSize);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, view);
    }

    var nextTexture, nextBlendMode, nextShader;
    var batchSize = 0;
    var start = 0;

    var currentBaseTexture = null;
    var currentBlendMode = this.renderer.blendModeManager.currentBlendMode;
    var currentShader = null;

    var blendSwap = false;
    var shaderSwap = false;
    var sprite;

    for (var i = 0, j = this.currentBatchSize; i < j; i++)
    {

        sprite = this.sprites[i];

        nextTexture = sprite.texture.baseTexture;
        nextBlendMode = sprite.blendMode;
        nextShader = sprite.shader || this.shader;

        blendSwap = currentBlendMode !== nextBlendMode;
        shaderSwap = currentShader !== nextShader; // should I use uuidS???

        if (currentBaseTexture !== nextTexture || blendSwap || shaderSwap)
        {
            this.renderBatch(currentBaseTexture, batchSize, start);

            start = i;
            batchSize = 0;
            currentBaseTexture = nextTexture;

            if (blendSwap)
            {
                currentBlendMode = nextBlendMode;
                this.renderer.blendModeManager.setBlendMode( currentBlendMode );
            }

            if (shaderSwap)
            {
                currentShader = nextShader;

                shader = currentShader.shaders ? currentShader.shaders[gl.id] : currentShader;

                if (!shader)
                {
                    shader = new Shader(gl, null, currentShader.fragmentSrc, currentShader.uniforms);
                    currentShader.shaders[gl.id] = shader;
                }

                // set shader function???
                this.renderer.shaderManager.setShader(shader);

                if (shader.dirty)
                {
                    shader.syncUniforms();
                }

                // both thease only need to be set if they are changing..
                // set the projection
                var projection = this.renderer.projection;
                gl.uniform2f(shader.uniforms.projectionVector._location, projection.x, projection.y);

                // TODO - this is temprorary!
                var offsetVector = this.renderer.offset;
                gl.uniform2f(shader.uniforms.offsetVector._location, offsetVector.x, offsetVector.y);

                // set the pointers
            }
        }

        batchSize++;
    }

    this.renderBatch(currentBaseTexture, batchSize, start);

    // then reset the batch!
    this.currentBatchSize = 0;
};

/**
 * Draws the currently batches sprites.
 *
 * @private
 * @param texture {Texture}
 * @param size {number}
 * @param startIndex {number}
 */
SpriteRenderer.prototype.renderBatch = function (texture, size, startIndex)
{
    if (size === 0)
    {
        return;
    }

    var gl = this.renderer.gl;

    if (!texture._glTextures[gl.id])
    {
        this.renderer.updateTexture(texture);
    }
    else
    {
        // bind the current texture
        gl.bindTexture(gl.TEXTURE_2D, texture._glTextures[gl.id]);
    }

    // now draw those suckas!
    gl.drawElements(gl.TRIANGLES, size * 6, gl.UNSIGNED_SHORT, startIndex * 6 * 2);

    // increment the draw count
    this.renderer.drawCount++;
};

/**
 * Flushes the sprite renderer's current batch.
 *
 */
SpriteRenderer.prototype.stop = function ()
{
    this.flush();
    this.dirty = true;
};

/**
 * Starts a new sprite batch.
 *
 */
SpriteRenderer.prototype.start = function ()
{
    this.dirty = true;
};

/**
 * Destroys the SpriteBatch.
 *
 */
SpriteRenderer.prototype.destroy = function ()
{
    this.renderer.gl.deleteBuffer(this.vertexBuffer);
    this.renderer.gl.deleteBuffer(this.indexBuffer);

    this.renderer = null;

    this.vertices = null;
    this.positions = null;
    this.colors = null;
    this.indices = null;
    this.currentBaseTexture = null;

    this.drawing = false;
    this.dirty = false;

    this.textures = null;
    this.blendModes = null;
    this.shaders = null;
    this.sprites = null;
    this.shader = null;
};
