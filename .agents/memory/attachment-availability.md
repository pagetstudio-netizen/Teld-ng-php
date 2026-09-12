---
name: Chat attachment availability
description: Reference images from chat may appear late or under a prefixed filename in attached_assets.
---

Reference images attached in chat are not always immediately readable at the displayed path. In one observed case, a file appeared later in `attached_assets` under a `0_`-prefixed filename.

**Why:** Pixel-accurate visual work cannot safely proceed on an assumed or similarly named image when the requested reference path is unavailable.

**How to apply:** Before concluding an attachment is unavailable, search `attached_assets` for related names and newly prefixed files. If the actual reference still cannot be opened, tell the user that exact visual validation is blocked rather than claiming pixel-perfect parity.