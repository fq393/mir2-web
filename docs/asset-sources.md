# Crystal resources and full Bichon conversion

The browser uses real Crystal map and sprite resources from the public [MirFiles Crystal patch](https://www.mirfiles.com/resources/mir2/crystal/patch/), downloaded on 2026-09-07. All 700×700 source cells are exported. Artwork is not generated or replaced with placeholder drawings. Public access does not transfer ownership of the original game artwork; the source files remain in ignored `raw-assets/`.

## Source and decoding contract

The code reference is [Suprcode/Crystal](https://github.com/Suprcode/Crystal/tree/0e315fe327192afe52c3d7357ddd1f5b7e26c5b8), commit `0e315fe327192afe52c3d7357ddd1f5b7e26c5b8`:

- `Client/MirObjects/MapCode.cs`, `LoadMapType100`: `01 00 43 23` header, int16 dimensions, x-major 26-byte cells. Source collision comes from back-image `0x20000000` or front-image `0x8000`.
- `Client/MirGraphics/MLibrary.cs`: v2/v3 int32 offset tables; signed int16 dimensions and offsets; one shadow/mask flag byte; gzip-compressed BGRA. Some legacy small images retain four-pixel storage padding: decode the padded extent, then crop to declared dimensions. The frame metadata records `storedWidth/storedHeight` as well as the declared `w/h`.
- `Client/MirObjects/Frames.cs`: fallback standing, walking, attack, cast, struck and death frames. For NPC0, Deer4 and Scarecrow5, the converter reads the authoritative Lib-v3 `frameSeek` tail table first, including count, skip, interval, reverse and blend. These pinned tables match the exported default indices; NPC0 standing uses its correct 450 ms interval. The complete tables remain in each actor’s `sourceFrameSet`. Deer’s extra skeleton action is outside the current exported gameplay actions. `Client/MirObjects/PlayerObject.cs` provides FireBall casting frames 0–9, sixteen-direction projectiles at 10 + direction×10 (six frames), and impact frames 170–179 in Magic.Lib.
- `Client/MirScenes/GameScene.cs`: floor first, then increasing world Y; within a row, draw each X's middle/front terrain before drawing the row's living objects. `DrawUp` ignores ordinary Lib offsets and aligns the image bottom to the cell bottom. The shadow metadata is not a separate shadow bitmap: its high bit indicates a second mask layer.

## Reproducible input pins

`tools/asset-inputs.json` is the authoritative list of exact URLs, local filenames, byte lengths, SHA-256 digests, expected HTTP status and complete Content-Range values. Every downloaded range is individually pinned. `manifest.sources` copies these same records. The fetcher verifies status/range/size/hash before atomically replacing a file, rechecks cached files, and closes its isolated ego-browser task even on failure.

Map `0.map` is the complete 12,740,008-byte file with SHA-256 `ed4783215ffa989658f79892c2dd6720753fb111e1102cb14da8e6182d88d7f6`. Tiles.Lib is 450,359,772 bytes at the source. The original 5,018,241-byte prefix is retained, with individually verified extra ranges covering every valid image requested anywhere in Bichon. Other large libraries similarly use their full index table and required image ranges; their partial downloads are never claimed to be full-library hashes.

Map library IDs follow Crystal exactly: 0 Tiles, 1 SmTiles, 2 Objects; 5/6/7/21/22/24 are WemadeMir2 Objects4/5/6/20/21/23. The map also contains original references to WemadeMir3 Snow libraries 251 Dungeonsc, 253 Furnituresc, 254 Wallsc, 255 SmObjectsc and 257 Object1c. Filename capitalization follows the actual case-sensitive source listing.

## Schema version 2

`client/assets/resources/mir/manifest.json` contains 10,070 frames and 34 atlases. There are 26 map atlases and eight actor/effect atlases. Atlases are grouped by source library, have 1-pixel extruded gutters, and retain untrimmed sprite dimensions and offsets. Atlas width is 2048; unused tail height is cropped to a power of two. A decoded atlas costs `width * height * 4` bytes: the nine chunks around spawn require 13 map atlases / 174 MiB before actor textures. The client must load and evict map atlases using the chunk lists rather than eagerly loading the province.

- `tileWidth:48`, `tileHeight:32`.
- `map`: complete source dimensions `700×700`, `originX:0`, `originY:0`, original spawn `(288,615)`, `chunkSize:32`, `collisionFile:'collision.json'`, and `chunks`.
- `map.chunks`: 484 descriptors `{x,y,width,height,file,atlases}`. `x/y` are the absolute world-cell origin; edge chunks have width/height 28. Chunk filenames are `chunks/{chunkX}-{chunkY}.json`.
- Each chunk contains row-major `cells` with **absolute** world `x/y`, original `blocked`, and optional `back/middle/front` references. Zero-valued animation/light/door fields and redundant raw collision words are omitted. Absent numeric metadata means zero.
- References retain `library,index,key,render,floor,drawX,drawY,blend`; `animationKeys` is present only for animated references. All base references and requested animation frames are included or explicitly listed as empty.
- `collision.json`: `{width:700,height:700,rows:string[]}` with 700 characters per row: `0` passable, `1` blocked. It covers every cell independently of visual streaming.
- `frames[key]`: atlas index and rectangle, original library/image ID, offsets, dimensions, shadow byte, storage dimensions and byte positions.
- `actors.armour0`, `armour1`, `weapon1`, `hair0`, `npc0`, `monster4`, `monster5`: action arrays `stand/walk/attack/cast/hit/die` where supported; each action has eight direction arrays of source frame keys. `actionFrameMs` supplies timing, `atlases` supplies required textures. NPC0 has standing only. Player layers cover the male default animation set. Deer=4 and Scarecrow=5 match the server monster enum.
- `player`: compatibility alias of armour0 plus standing/walking timing and direction names.
- Top-level `spellFireBall`: flat `cast` and `hit` frame arrays, sixteen direction `projectile` arrays, and `atlases`.
- `emptyFrames`, `missingLibraries`, and `missingReferences`: explicit source limitations, including exact cell coordinates.

Map sprite top-left is `(x*48+drawX, y*32+drawY)`. Ordinary floors use zero draw offset; tall terrain uses `drawY=32-height`. Legacy additive torch frames 2723–2732 apply Lib offsets. Character sprites use `(x*48+offsetX,y*32+offsetY)`. Global even/even parity controls back tiles. The exported door state is the source base/closed image; additional open-door state variants are outside this conversion.

## Source limitations and shadow treatment

All 490,000 source cells and 162,595 drawable base references are present. There are 120 nondrawable base references at 99 cells, preserved in `missingReferences`; some are intentional zero-sized source sprites, and some are invalid indices already skipped by Crystal's `CheckImage`. This is complete map data, not a claim that every source reference has valid artwork.

The source patch does **not** contain `Data/Map/WemadeMir3/Snow/Object1c.Lib` (library 257). Its 16 references are confined to the west boundary: x=0, y=10,11,26,27,50,51,68,82,83,98,99,114,115,146,162,163. No alternative library was guessed. Source library 253's requested image 2766 exceeds its count; Tiles also contains out-of-range source references. The reported gate/roof coordinates `(282,622)` and `(298,633)` use available WemadeMir2 library 2 and are not explained by this missing boundary library.

Many original sprites encode shadows as alternating opaque near-black `(0,4,0)` and transparent pixels. Camera resampling of that checker pattern can shimmer. `smooth_shadow` recognizes only opaque RGB channels ≤8 with at least two transparent cardinal neighbours and two opaque near-black diagonal neighbours. For `monster4` and `monster5` only, it additionally recognizes the exact source palette colour `(16,8,8)` with the same transparency conditions and at least two **same-colour** diagonal neighbours. This exception does not expand the global threshold; it preserves that original shadow RGB and reconstructs only alpha. The monsters’ 51,880 checker pixels across their 160 standing/walking frames were entirely missed by the original ≤8 rule. The precise palette exception addresses that confirmed remaining shadow pattern. It applies a half-pixel box blur to that local shadow mask, replacing selected pixels and transparent neighbours with continuous alpha. Other coloured pixels and nonselected opaque dark details remain byte-identical. No sprite dimensions, placement offsets, collision, or geometry are changed. This is a documented display adaptation, not lossless RGBA export: 2,935 frames are affected. Tests compare every exported monster frame with its original decompressed image and require every opaque pixel outside the two detected shadow masks to remain byte-identical, including same-colour non-checker body details. A palette fixture also proves the monster exception never applies to armour1. Remaining isolated edge pixels still require motion QA; binary checks alone do not prove flicker-free display.

## Reproduce and validate

```sh
sh tools/setup-assets.sh
.runtime/assets-venv/bin/python tools/fetch-assets.py
.runtime/assets-venv/bin/python tools/convert-assets.py
.runtime/assets-venv/bin/python tools/test-assets.py
```

The setup creates ignored `.runtime/assets-venv` with pinned Pillow. Use this interpreter rather than assuming macOS Python includes Pillow. The offline test checks every source collision cell, exact nonoverlapping chunk coverage, atlas dependency lists, all rendered references, every packed frame against decompressed source plus the documented shadow transform, extruded edges, actor actions against original Lib-v3 tail metadata, all input pins, synthetic shadow preservation and real monster body-pixel preservation, malformed map rejection and atomic download preservation. It passed on the generated full-map artifact. Live movement, occlusion, equipment, NPC interaction and combat are validated separately in the actual client/server.
