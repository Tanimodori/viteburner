# RAM Usage

You can press `r` key to query the RAM of your selected scripts. There are several ways to select scripts:

## All local scripts

For each local script, if it is configured in watch options to map to any `.js` / `.script` files in any server, the RAM usage of the script will be displayed.

Viteburner needs to know which remote script to query RAM usage when you select a local script. File not mapped to any `.js` / `.script` files in any server will be ignored.

If multiple destinations are configured, viteburner will display any of them since the RAM usage of a script is the same for all destinations. If any error occurs, viteburner will try the next destination until all destinations are tried.

## Filter local scripts by glob pattern

Same as above, but only scripts matching the glob pattern will be displayed.

## Find a local script

Instead of displaying RAM usage of all local scripts, viteburner will only display the RAM usage of the _local_ script you entered and use filenames of all local scripts as auto-completion.

## Find a remote script

Viteburner will only display the RAM usage of the _remote_ script you entered and use filenames of the remote scripts of given server as auto-completion.
