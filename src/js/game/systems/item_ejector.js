import { globalConfig } from "../../core/config";
import { DrawParameters } from "../../core/draw_parameters";
import { enumDirectionToVector, Vector } from "../../core/vector";
import { BaseItem } from "../base_item";
import { ItemEjectorComponent } from "../components/item_ejector";
import { Entity } from "../entity";
import { GameSystemWithFilter } from "../game_system_with_filter";
import { Math_min } from "../../core/builtins";

export class ItemEjectorSystem extends GameSystemWithFilter {
    constructor(root) {
        super(root, [ItemEjectorComponent]);
    }

    update() {
        const effectiveBeltSpeed = this.root.hubGoals.getBeltBaseSpeed();
        const progressGrowth = (effectiveBeltSpeed / 0.5) * globalConfig.physicsDeltaSeconds;

        // Try to find acceptors for every ejector
        for (let i = 0; i < this.allEntities.length; ++i) {
            const entity = this.allEntities[i];
            const ejectorComp = entity.components.ItemEjector;
            const staticComp = entity.components.StaticMapEntity;

            // For every ejector slot, try to find an acceptor
            for (let ejectorSlotIndex = 0; ejectorSlotIndex < ejectorComp.slots.length; ++ejectorSlotIndex) {
                const ejectorSlot = ejectorComp.slots[ejectorSlotIndex];
                const ejectingItem = ejectorSlot.item;
                if (!ejectingItem) {
                    // No item ejected
                    continue;
                }

                ejectorSlot.progress = Math_min(1, ejectorSlot.progress + progressGrowth);
                if (ejectorSlot.progress < 1.0) {
                    // Still ejecting
                    continue;
                }

                // Figure out where and into which direction we eject items
                const ejectSlotWsTile = staticComp.localTileToWorld(ejectorSlot.pos);
                const ejectSlotWsDirection = staticComp.localDirectionToWorld(ejectorSlot.direction);
                const ejectSlotWsDirectionVector = enumDirectionToVector[ejectSlotWsDirection];
                const ejectSlotTargetWsTile = ejectSlotWsTile.add(ejectSlotWsDirectionVector);

                // Try to find the given acceptor component to take the item
                const targetEntity = this.root.map.getTileContent(ejectSlotTargetWsTile);
                if (!targetEntity) {
                    // No consumer for item
                    continue;
                }

                const targetAcceptorComp = targetEntity.components.ItemAcceptor;
                const targetStaticComp = targetEntity.components.StaticMapEntity;
                if (!targetAcceptorComp) {
                    // Entity doesn't accept items
                    continue;
                }

                const matchingSlot = targetAcceptorComp.findMatchingSlot(
                    targetStaticComp.worldToLocalTile(ejectSlotTargetWsTile),
                    targetStaticComp.worldDirectionToLocal(ejectSlotWsDirection)
                );

                if (!matchingSlot) {
                    // No matching slot found
                    continue;
                }

                if (!targetAcceptorComp.canAcceptItem(matchingSlot.index, ejectingItem)) {
                    // Can not accept item
                    continue;
                }

                if (
                    this.tryPassOverItem(
                        ejectingItem,
                        targetEntity,
                        matchingSlot.index,
                        matchingSlot.acceptedDirection
                    )
                ) {
                    ejectorSlot.item = null;
                    continue;
                }
            }
        }
    }

    /**
     *
     * @param {BaseItem} item
     * @param {Entity} receiver
     * @param {number} slotIndex
     * @param {string} localDirection
     */
    tryPassOverItem(item, receiver, slotIndex, localDirection) {
        // Try figuring out how what to do with the item
        // TODO: Kinda hacky. How to solve this properly? Don't want to go through inheritance hell.
        // Also its just a few cases (hope it stays like this .. :x).

        const beltComp = receiver.components.Belt;
        if (beltComp) {
            // Ayy, its a belt!
            if (beltComp.canAcceptNewItem(localDirection)) {
                beltComp.takeNewItem(item, localDirection);
                return true;
            }
        }

        const itemProcessorComp = receiver.components.ItemProcessor;
        if (itemProcessorComp) {
            // Its an item processor ..
            if (itemProcessorComp.tryTakeItem(item, slotIndex, localDirection)) {
                return true;
            }
        }

        const undergroundBeltCmop = receiver.components.UndergroundBelt;
        if (undergroundBeltCmop) {
            // Its an underground belt. yay.
            if (
                undergroundBeltCmop.tryAcceptExternalItem(
                    item,
                    this.root.hubGoals.getUndergroundBeltBaseSpeed()
                )
            ) {
                return true;
            }
        }

        return false;
    }

    draw(parameters) {
        this.forEachMatchingEntityOnScreen(parameters, this.drawSingleEntity.bind(this));
    }

    /**
     * @param {DrawParameters} parameters
     * @param {Entity} entity
     */
    drawSingleEntity(parameters, entity) {
        const ejectorComp = entity.components.ItemEjector;
        const staticComp = entity.components.StaticMapEntity;

        for (let i = 0; i < ejectorComp.slots.length; ++i) {
            const slot = ejectorComp.slots[i];
            const ejectedItem = slot.item;
            if (!ejectedItem) {
                // No item
                continue;
            }

            const realPosition = slot.pos.rotateFastMultipleOf90(staticComp.rotation);
            const realDirection = Vector.transformDirectionFromMultipleOf90(
                slot.direction,
                staticComp.rotation
            );
            const realDirectionVector = enumDirectionToVector[realDirection];

            const tileX =
                staticComp.origin.x + realPosition.x + 0.5 + realDirectionVector.x * 0.5 * slot.progress;
            const tileY =
                staticComp.origin.y + realPosition.y + 0.5 + realDirectionVector.y * 0.5 * slot.progress;

            const worldX = tileX * globalConfig.tileSize;
            const worldY = tileY * globalConfig.tileSize;

            ejectedItem.draw(worldX, worldY, parameters);
        }
    }
}