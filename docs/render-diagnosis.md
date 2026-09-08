# Crystal rendering comparison and screenshot diagnosis

Read-only comparison performed on 2026-09-07 against the vendored Crystal client and the two supplied screenshots (coordinates 298:633 and 282:622). No browser reproduction was performed during this diagnosis.

## Confirmed differences

- Crystal `GameScene.DrawObjects` traverses each map row in X order, drawing middle and front imagery per cell, then draws the actors belonging to that row. The original web renderer sorts the entire row as middle, actor, front. This can incorrectly cover an actor with same-row front imagery.
- Crystal registers an actor in its discrete `MapLocation` cell. `PlayerObject` updates this location for the current action; visual position is interpolated separately. Sorting a moving web actor by continuous `visual.y` instead changes its relation to map tiles partway through a step.
- After the terrain/actor passes, Crystal redraws the local player's body/head/wings at 0.4 opacity. The original web renderer omits this visibility pass, so foreground objects can hide the player entirely.
- The exported body frames already contain their shadow. The web renderer adds another ellipse below the player, creating a second shadow.
- The manifest specifies a 500 ms standing frame interval; the original web renderer uses 180 ms.

## Shadow evidence and conversion follow-up

Raw `CArmour/00.Lib` frame 16 contains only alpha 0 and 255. Its dominant shadow color is RGBA `(0,4,0,255)`: 339 of the 346 pixels of this color share the same checkerboard parity. Walking frames 56 and 57 exhibit the same pattern. A moving, fractionally scaled high-frequency checkerboard can shimmer under linear texture sampling. Atlas padding prevents neighboring-frame bleed, but does not remove this pattern inside the frame.

The library `ShadowX`, `ShadowY`, and `Shadow` fields do not describe a separate shadow bitmap to position directly. Crystal's `MImage` interprets the high bit of `Shadow` as `HasMask`; the 374 frames in the inspected export all had `shadow=0`. Body and map shadows are baked into the first BGRA image.

Follow up in the asset conversion work by detecting checkerboard shadow regions and reconstructing continuous partial alpha. Do not replace all dark pixels: a minority of the same color occurs outside the shadow pattern and may belong to outlines. Preserve the original sprite dimensions and anchors, inspect representative actor/map frames, and check moving examples after conversion. If shadows are separated into a ground pass, verify that overlapping shadow strips do not accumulate excessive opacity. Separating baked terrain shadows is a rendering improvement, not evidence that the original library offsets were wrong.

## Limits of the static screenshot diagnosis

**The castle-gate and eaves screenshots cannot yet be attributed to the sorting defect.** In the inspected export there were no non-floor middle sprites, and front sprites already retained X order within each row. Consequently the middle/front sorting difference alone does not explain these particular static seams.

For the currently used Wemade libraries, map-object `drawY = 32 - imageHeight` matches Crystal's bottom-aligned draw operation. Ordinary map sprites do not apply the library X/Y offsets; the supported torch blend special case does. Do not shift the gate, roof or baked shadows using `ShadowX/Y` or globally apply image offsets.

The screenshots show pronounced checkerboard shadows over gate/wall imagery and around the roof edge. Asset de-checkerboarding is the next evidence-backed step. Revisit the exact two coordinates after conversion and row-order fixes, comparing static images and movement, before declaring either screenshot issue fixed.

## Source pointers

- `vendor/Crystal/Client/MirScenes/GameScene.cs`: `DrawFloor`, `DrawObjects`, `AddObject`.
- `vendor/Crystal/Client/MirObjects/PlayerObject.cs`: movement/MapLocation update, `DrawBody`.
- `vendor/Crystal/Client/MirGraphics/MLibrary.cs`: `Draw`, `DrawUp`, `MImage`.
- `tools/convert-assets.py`: `Library.frame`, draw-position metadata and atlas gutters.
- `client/assets/scripts/MirWorld.ts`: map ordering, actor animation/position and texture filtering.

## Full-map pathfinding

The crop-sized breadth-first search was replaced with A* and a binary min-heap, using Chebyshev distance because axial and diagonal steps have equal duration. Numeric cell IDs and per-search occupancy caching avoid repeated string-map allocations. The diagonal no-corner-cutting rule remains unchanged. Tests cover an open 700x700 diagonal route and a distant goal reached through a wall opening. This is a complete synchronous search: pathological blocked layouts can still require visiting much of the map, so this change does not promise an absolute per-click frame-time bound.
