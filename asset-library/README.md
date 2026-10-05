# Asset library

A record of every asset we've considered: what the game uses, what we liked but aren't using, what we retired, and where each came from. [CATALOG.md](CATALOG.md) is the index. Nothing in this folder is served to players; the game only loads from `public/`.

## Rules

- **Every file gets a catalog row** with its status, source link, and license. If the license is unclear, don't add the file.
- **Shipped files live in `public/`.** The catalog points to them rather than keeping a second copy. The exception is a labeled variant from a listening review (such as `audio/dig/variant-2…`), kept here under its review name so the numbers JT picked stay traceable.
- **Keep what matters, link the rest.** Store sources we actually mixed from, liked-but-unused options, retired clips, and review reels. For whole downloaded packs, record the link, not the pack.
- **Retire, don't delete.** When a shipped asset is replaced, move it to `retired/` and record why.
- **Keep files small.** Review reels are mono MP3s at a low bitrate. If this folder grows past roughly 50 MB, move audio and images to Git LFS.

## Statuses

| Status | Meaning |
| --- | --- |
| **In game: approved** | Shipped, and JT listened to it and approved it |
| **In game: not reviewed** | Shipped, but no verdict yet |
| **Liked, not used** | JT liked it; kept for later or as an alternate |
| **Kept, not used** | Made for the game; JT kept it for later without picking it |
| **Source** | Raw recording a shipped or liked file was made from |
| **Retired** | Previously shipped and replaced; notes say why |
| **Review reel** | A labeled listening reel used to make a decision |

## Layout

```
audio/
  dig/            labeled variants from the digging review
  sources/        raw recordings used in shipped mixes
  retired/        clips removed from the game
  review-reels/   dated listening reels and their maps
models/
  pines/          Sol's ten Blender pines (Gold Fever), kept, not used; source/ holds the Blender script and file
images/           (none yet; the game draws everything in code)
```

Screenshots for docs stay in `docs/`. They document features and aren't game assets.
