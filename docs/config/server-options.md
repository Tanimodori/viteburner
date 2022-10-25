# Server Options

## `port`

- **Type:** `number`
- **Default:** `12525`

The port number to use for the WebSocket server. You should use this port in bitburner "Option > Remote API > Port" setting.

You can change this value in the config file or cli `--port` flag. If the port is already in use, viteburner will throw an error and you should change the port number to another one.

## `timeout`

- **Type:** `number`
- **Default:** `10000`

The timeout in milliseconds for the WebSocket server.

## `dts`

- **Type:** `string | boolean`
- **Default:** `'NetScriptDefinition.d.ts'`

The path where to download the NetScript definition file from bitburner. Ignore this option or set it to `true` to use the default value. Set it to `false` to disable the download action.
