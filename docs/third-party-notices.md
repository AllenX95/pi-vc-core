# Third-Party Notices

`pi-vc-core` integrates the following third-party Pi companion packages through `dependencies` and `bundledDependencies`.

The packages are not authored by `pi-vc-core`. Their source code, package metadata, repository history, and license files remain owned and maintained by their respective authors. When bundled, their original package `LICENSE` files must be retained with the dependency package contents.

## pi-web-access

- Package: `pi-web-access`
- Integrated version range: `^0.13.0`
- Repository: <https://github.com/nicobailon/pi-web-access>
- License: MIT
- Copyright notice from package LICENSE: `Copyright (c) 2025 Nico Bailon`
- Purpose in `pi-vc-core`: web search, URL fetching, repository fetching, PDF extraction, and related web access tools.

## pi-mcp-adapter

- Package: `pi-mcp-adapter`
- Integrated version range: `^2.10.0`
- Repository: <https://github.com/nicobailon/pi-mcp-adapter>
- License: MIT
- Copyright notice from package LICENSE: `Copyright (c) 2026 Nico Bailon`
- Purpose in `pi-vc-core`: MCP server discovery and MCP tool call access.

## Boundary

The companion packages provide general Pi capabilities. They do not replace `vc-project-workspace`, `vc-office-core`, or `vc-memory`, and they must not be used to bypass the package rule that project source files are not overwritten in place.
