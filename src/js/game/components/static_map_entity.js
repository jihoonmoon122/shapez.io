import { Math_radians } from "../../core/builtins";
import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { Rectangle } from "../../core/rectangle";
import { AtlasSprite } from "../../core/sprites";
import { enumDirection, Vector } from "../../core/vector";
import { types } from "../../savegame/serialization";
import { Component } from "../component";

export class StaticMapEntityComponent extends Component {
    static getId() {
        return "StaticMapEntity";
    }

    static getSchema() {
        return {};
    }

    /**
     *
     * @param {object} param0
     * @param {Vector=} param0.origin Origin (Top Left corner) of the entity
     * @param {Vector=} param0.tileSize Size of the entity in tiles
     * @param {number=} param0.rotation Rotation in degrees. Must be multiple of 90
     * @param {number=} param0.originalRotation Original Rotation in degrees. Must be multiple of 90
     * @param {string=} param0.spriteKey Optional sprite
     * @param {string=} param0.silhouetteColor Optional silhouette color override
     */
    constructor({
        origin = new Vector(),
        tileSize = new Vector(1, 1),
        rotation = 0,
        originalRotation = 0,
        spriteKey = null,
        silhouetteColor = null,
    }) {
        super();
        assert(
            rotation % 90 === 0,
            "Rotation of static map entity must be multiple of 90 (was " + rotation + ")"
        );

        this.origin = origin;
        this.tileSize = tileSize;
        this.spriteKey = spriteKey;
        this.rotation = rotation;
        this.originalRotation = originalRotation;
        this.silhouetteColor = silhouetteColor;
    }

    /**
     * Returns the effective rectangle of this entity in tile space
     * @returns {Rectangle}
     */
    getTileSpaceBounds() {
        switch (this.rotation) {
            case 0:
                return new Rectangle(this.origin.x, this.origin.y, this.tileSize.x, this.tileSize.y);
            case 90:
                return new Rectangle(
                    this.origin.x - this.tileSize.y + 1,
                    this.origin.y,
                    this.tileSize.y,
                    this.tileSize.x
                );
            case 180:
                return new Rectangle(
                    this.origin.x - this.tileSize.x + 1,
                    this.origin.y - this.tileSize.y + 1,
                    this.tileSize.x,
                    this.tileSize.y
                );
            case 270:
                return new Rectangle(
                    this.origin.x,
                    this.origin.y - this.tileSize.x + 1,
                    this.tileSize.y,
                    this.tileSize.x
                );
            default:
                assert(false, "Invalid rotation");
        }
    }

    /**
     * Transforms the given vector/rotation from local space to world space
     * @param {Vector} vector
     * @returns {Vector}
     */
    applyRotationToVector(vector) {
        return vector.rotateFastMultipleOf90(this.rotation);
    }

    /**
     * Transforms the given vector/rotation from world space to local space
     * @param {Vector} vector
     * @returns {Vector}
     */
    unapplyRotationToVector(vector) {
        return vector.rotateFastMultipleOf90(360 - this.rotation);
    }

    /**
     * Transforms the given direction from local space
     * @param {enumDirection} direction
     * @returns {enumDirection}
     */
    localDirectionToWorld(direction) {
        return Vector.transformDirectionFromMultipleOf90(direction, this.rotation);
    }

    /**
     * Transforms the given direction from world to local space
     * @param {enumDirection} direction
     * @returns {enumDirection}
     */
    worldDirectionToLocal(direction) {
        return Vector.transformDirectionFromMultipleOf90(direction, 360 - this.rotation);
    }

    /**
     * Transforms from local tile space to global tile space
     * @param {Vector} localTile
     * @returns {Vector}
     */
    localTileToWorld(localTile) {
        const result = this.applyRotationToVector(localTile);
        result.addInplace(this.origin);
        return result;
    }

    /**
     * Transforms from world space to local space
     * @param {Vector} worldTile
     */
    worldToLocalTile(worldTile) {
        const localUnrotated = worldTile.sub(this.origin);
        return this.unapplyRotationToVector(localUnrotated);
    }

    /**
     * Draws a sprite over the whole space of the entity
     * @param {DrawParameters} parameters
     * @param {AtlasSprite} sprite
     * @param {number=} extrudePixels How many pixels to extrude the sprite
     * @param {boolean=} clipping Whether to clip
     */
    drawSpriteOnFullEntityBounds(parameters, sprite, extrudePixels = 0, clipping = true) {
        const worldX = this.origin.x * globalConfig.tileSize;
        const worldY = this.origin.y * globalConfig.tileSize;

        if (this.rotation === 0) {
            // Early out, is faster
            sprite.drawCached(
                parameters,
                worldX - extrudePixels * this.tileSize.x,
                worldY - extrudePixels * this.tileSize.y,
                globalConfig.tileSize * this.tileSize.x + 2 * extrudePixels * this.tileSize.x,
                globalConfig.tileSize * this.tileSize.y + 2 * extrudePixels * this.tileSize.y,
                clipping
            );
        } else {
            const rotationCenterX = worldX + globalConfig.halfTileSize;
            const rotationCenterY = worldY + globalConfig.halfTileSize;

            parameters.context.translate(rotationCenterX, rotationCenterY);
            parameters.context.rotate(Math_radians(this.rotation));

            sprite.drawCached(
                parameters,
                -globalConfig.halfTileSize - extrudePixels * this.tileSize.x,
                -globalConfig.halfTileSize - extrudePixels * this.tileSize.y,
                globalConfig.tileSize * this.tileSize.x + 2 * extrudePixels * this.tileSize.x,
                globalConfig.tileSize * this.tileSize.y + 2 * extrudePixels * this.tileSize.y,
                false
            );

            parameters.context.rotate(-Math_radians(this.rotation));
            parameters.context.translate(-rotationCenterX, -rotationCenterY);
        }
    }
}