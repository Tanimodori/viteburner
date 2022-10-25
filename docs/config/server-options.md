# Server Options

## `port`

The port number to use for the WebSocket server. You should use this port in bitburner "Option > Remote API > Port" setting. The default value is `12525`.

You can change this value in the config file or cli `--port` flag. If the port is already in use, viteburner will throw an error and you should change the port number to another one.

## `timeout`

The timeout in milliseconds for the WebSocket server. The default value is `10000`.

## `dts`

The path where to download the NetScript definition file from bitburner. The default value is `NetScriptDefinition.d.ts`. Ignore this option or set it to `true` to use the default value. Set it to `false` to disable the download action.
