# BETA asset optimization

The readable files in `index/`, `admin/` and `shared/` remain the source of truth. HTML loads their generated `.min.js` and `.min.css` counterparts. Never edit generated files by hand.

After changes to managed sources or HTML, run from the repository root:

```sh
node BETA/tools/build-assets.mjs
node BETA/tools/build-assets.mjs --check
```

Commit source changes, generated files, HTML references and `BETA/sw.js` together. The builder has no dependencies and updates cache versions from file contents. It conservatively strips standalone comments and unnecessary whitespace, retains legal notices, and leaves unsupported multiline JavaScript literals or CSS escapes intact. It does not access Firebase or alter deployment settings. HTML remains readable and editable.
