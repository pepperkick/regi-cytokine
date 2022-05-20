# Cytokine - Reginald Discord Client

Discord client functionality to implement **Cytokine** communication.

## Commands
``/lobby``
### General
- ``create`` Creates a new Lobby.
    - ``region`` A valid region name where the Lobby is being played at.
    - ``distribution`` The distribution type.
    - ``format`` The format to play the Lobby in that supports said ``distribution``.
    - ``map`` Optional. If set, the map from the selected format's pool to play. If not set the map will be selected at random by the system.
    - ``valve-sdr`` Optional. Overrides the usage of VALVe's SDR system on the server.
    - `afk-check` Optional. Controls wether or not to run an AFK check once the Lobby's requirements are met.
    - `access-config` Optional. An [Access Config](https://github.com/Qixalite/regi-cytokine#regions) to set on the Lobby.
- ``kick`` Kicks a queued player from an owned Lobby.
    - ``player`` The player to kick.
    - ``reason`` Optional. A reason for the kick.
- ``close`` Closes an owned active Lobby.
- `region-status` Shows region availability for supported Cytokine regions.
  - `region` Optional. A specific region name (or filter) to show status for.
- `ringer` Asks for a substitute player on a Lobby.
    - ``player`` The player to substitute.
- `announce` Announces an active Lobby to the public or allowed users. The Lobby must not have been filled yet.
  - `title` Optional. A custom 24 character maximum title to set on the announcement.

### Administration
- ``close`` Close any active Lobby regardless of creator from a Select Menu.
- ``status`` Gets the current status of all Lobbies.
    - ``lobby`` Optional. If passed, lists a specific Lobby's information by its ID.

## Restricting Lobby Access (Access Lists & Configs)
Access Lists are used to keep track of a list of players or specific Discord roles; they are an array of users that consume Cytokine's service. Access Configs define what's done with them (explained later).

The list itself **does not have any functionality** other than keeping track of who is inside it.

Every Access List & Config is defined per-user; one can create an Access List for themselves and only themselves. Others cannot modify or see it.

### ``/lobby access-lists``
As specified above, a list of players or Discord roles for a specific Lobby runner (user).
- `create` Creates a new Access List.
  - `name` The name of the Access List.
- `delete` Deletes an existing Access List.
  - `name` The name of the Access List.
- `view` View an existing Access List.
  - `name` The name of the Access List.
- `add-player` Adds a player to an existing Access List.
  - `name` The name of the Access List.
  - `player` The player to add (Discord Tag)
- `remove-player` Removes a player from an existing Access List.
  - `name` The name of the Access List.
  - `player` The player to remove (Discord Tag)
- `add-role` Adds a role to an existing Access List.
  - `name` The name of the Access List.
  - `role` The Discord role to add (Discord Tag)
- `remove-role` Removes a role from an existing Access List.
  - `name` The name of the Access List.
  - `role` The Discord role to remove (Discord Tag)
- `export` Exports an Access List as a JSON string.
  - `name` The name of the Access List.
- `import` Parses a JSON string and transforms it into a new Access List.
  - `contents` The JSON string to parse.

### ``/lobby access-configs``
Access Configs define the behaivor of an Access List. They do this by declaring whether an existing Access List is a **Whitelist** or a **Blacklist**.

- **Whitelist**: The Access List is a whitelist, meaning that only the players or roles inside it are allowed to play inside the Lobby.
- **Blacklist**: The Access List is a blacklist, meaning that only the players or roles outside it are allowed to play inside the Lobby.

An Access Config can then be set on a Lobby to have this behaivor applied to it. This also modifies announcement and channel permissions for Lobby visibility depending on the type of restrictions set.

- `create` Creates a new Access Config.
  - `name` The name of the Access Config.
- `delete` Deletes an existing Access Config.
  - `name` The name of the Access Config.
- `view` View an existing Access Config.
  - `name` The name of the Access Config.
- `set-access-list` Sets the Access List for an existing Access Config.
  - `name` The name of the Access Config.
  - `type` Wether this Access List is a **blacklist** or a **whitelist**.
  - `action` The ([RequirementName](https://github.com/Qixalite/cytokine/blob/main/src/modules/lobbies/lobby-player-role.enum.ts)) to have this Access List apply to. For example:
    - If I want to block a few players from playing **Scout**, I would set this to ``scout`` and `type` on `Blacklist`.
    - If I want to allow only players inside one of my Access Lists, I would set this to `player` and `type` on `Whitelist`.
  - `access-list` The name of the Access List to add with this configuration.
- `export` Exports an Access Config as a JSON string.
  - `name` The name of the Access Config.
- `import` Parses a JSON string and transforms it into a new Access Config.
  - `contents` The JSON string to parse.

## Configuration [config.json]

| Property | Value | Example |
|-----------|--------|-----------|
| ``mongodbUri`` | MongoDB Connect URI | ``mongodb://admin:123@localhost:27017/regi-cytokine`` |
| ``localhost`` | Where is Regi-Cytokine being hosted to send callback URLs between services (without lead ``/``) | ``http://localhost:3000`` |
| ``kaiend.secret`` | Kaiend secret phrase to communicate with the service (MUST match a valid Kaiend token) | ``123`` |
| ``kaiend.host`` | Where are Kaiend's endpoints | ``http://localhost:4000`` |
| ``cytokine.secret`` | Cytokine secret phrase to allows communication with the service (MUST be from a valid client on Cytokine | ``123`` |
| ``cytokine.host`` | Where are Cytokine's endpoints | ``http://localhost:5000`` |
| ``discord.guild`` | The Guild ID Regi-Cytokine will be working in | ``210591935352537088`` |
| `discord.channels.waiting` | Array of VoiceChannel IDs where players are moved after a Lobby is finished. | `[ '123456789012345678', '123456789012345678' ]` |
| ``discord.channels.create`` | The channel where users are allowed to create new Lobbies | ``800182109213687848`` |
| ``discord.channels.results`` | If set, the results for a finished Lobby will be sent here | ``800182109213287848`` |
| ``discord.channels.admin`` | The channel in which commands will work in administrator mode | ``800182207410470933`` |
| `discord.roles` | Object Map for roles linked to a specific tier. | N/A |
| ``discord.token`` | Discord bot login token | N/A |
| ``lobbies.lobbyTextPrefix`` | The prefix for Lobby text channels (Ex: ``lobby-`` => ``lobby-somename``) | ``lobby-`` |
| ``lobbies.lobbyVoicePrefix`` | The prefix for Lobby voice channels (Ex: ``Lobby `` => ``Lobby somename``) | ``Lobby `` |
| ``lobbies.defaultExpiry`` | The amount of time (in seconds) in which a Lobby will expire if their config type does not have a set override. See [``formats``](https://github.com/Qixalite/regi-cytokine#formats) | ``30`` |
| ``lobbies.afkCheckTimeout`` | The amount of time (in seconds) in which an AFK Check expires if not all players have responded. | ``60`` |
| `lobbies.moveDelay` | Time (in seconds) in which players are moved from Voice Channels to others by Regi. | `1` |
| `lobbies.maxAnnounces` | Limits how many announcements a Lobby runner/creator can perform on a single Lobby | `1` |
| ``lobbies.names`` | Array of names used by Regi-Cytokine to generate an unique name for each Lobby | N/A |
| ``lobbies.teams`` | Names for each team's text & voice channel name | N/A
| ``regions`` | List of supported regions to book servers from | [See ``regions``](https://github.com/Qixalite/regi-cytokine#regions) |
| ``formats`` | List of supported formats for each game | [See ``formats``](https://github.com/Qixalite/regi-cytokine#formats) |

### ``regions``
An object map with the distinct regions supported by Regi-Cytokine.

- ``name``: The name this region is displayed to users.
- ``alias``: Aliases to filter region selection.
- ``continent``: The continent this region is in.
- ``tags``: Tags to filter region selection.
- ``discordVoiceRegion``: Voice region to be used for lobby voice channels closest to the region the server's in.
- ``valveSdr``: If not specified in ``/lobby create``, Valve SDR will be enabled/disabled depending on region.
- `announce`: The TextChannel / NewsChannel ID to announce a Lobby in when hosted in this region.
- `roles.region`: The Role ID to tag users with for this region.
- `roles.format`: Array of role IDs for every format created in this region. Example: Sydney-6vs6, Sydney-Highlander, etc. Format names specified **must** match the format name in the ``formats`` array.
- ``tiers``: The list of supported tiers for this region.

```json
"sydney": {
    "name": "Sydney",
    "alias": [ "sy", "syd" ],
    "continent": "oceania",
    "tags": [ "sydney", "aus", "oceania" ],
    "discordVoiceRegion": "sydney",
    "valveSdr": true,
    "announce": "",
    "roles": {
        "region": "",
        "format": [
            { "name": "6vs6", "role": "956872138487369760" },
            { "name": "9vs9", "role": "955684064336183306" },
            { "name": "Ultiduo", "role": "113301858918920192" }
        ]
    },
    "tiers": {
      "<tierName>": {
        "limit": 6,
        "provider": "",
        "minPlayers": 2,
        "idleTime": 600
      }
    }
},
```

### ``formats``
An object map with the distinct formats supported by Regi-Cytokine and how they are handled.

- ``name``: The name this format is displayed to users.
- ``game``: The game this format is compatible with.
- ``hidden``: If set, the format will be available to be specified, but not listed on the options list when creating a Lobby.
- ``mapTypes``: Array of map types this format supports, along with their respective configuration. Example Map Type object structure:
    - ``name``: The suffix this map type has (example: ``"cp"`` for 5CP maps)
    - ``config``: The config path (relative to ``tf/cfg/``) for this type of map and format.
    - ``expires``: **Optional**. If set this is the time (in seconds) a Lobby with this type of format and map type will expire in, overriding the default setting.
- ``maps``: Array of map names this format has available.
- ``distribution``: Array of Distribution types this format supports (and their corresponding requirements)
- ``maxPlayers``: Required amount of players for this format.
```json
{
    "name": "Ultiduo",
    "game": "tf2",
    "maxPlayers": 4,
    "hidden": false,
    "mapTypes": [
        {
            "name": "ultiduo",
            "config": "etf2l/ud_ultiduo",
            "expires": 900
        }
    ],
    "maps": [
        "ultiduo_baloo_v2"
    ],
    "distribution": [
        {
            "type": "RANDOM",
            "requirements": [
                { "name": "player", "count": 4 }
            ]
        },
        {
            "type": "TEAM_ROLE_BASED",
            "requirements": [
                { "name": "red-soldier", "count": 1 },
                { "name": "red-medic", "count": 1 },
                { "name": "blu-soldier", "count": 1 },
                { "name": "blu-medic", "count": 1 }
            ]
        }
    ]
}
```

## API
### POST /lobbies/callback
Handles status changes for **Lobby** documents. Body consists of an updated [``Lobby``](https://github.com/Qixalite/cytokine#lobby) document that needs handling.

#### Body
```json
{
  "_id": "620ac5f455b7b0479401748e",
  "match": "620ac5f355b7b0479401748c",
  "client": "test123",
  "name": "Mu",
  "status": "CLOSED",
  "distribution": "RANDOM",
  "createdAt": {
    "$date": "2022-02-14T21:13:24.225Z"
  },
  "createdBy": "112720277883895808",
  "requirements": [
    {
      "name": "player",
      "count": 2
    }
  ],
  "queuedPlayers": [
    {
      "name": "puntero",
      "discord": "112720277883895808",
      "steam": "76561198061538510",
      "roles": [
        "creator",
        "player",
        "team_a"
      ]
    },
    {
      "name": "puntero2",
      "discord": "291350950054985730",
      "roles": [
        "player",
        "team_b"
      ]
    }
  ],
  "maxPlayers": 2,
  "callbackUrl": "http://localhost:3010/lobbies/callback",
  "__v": 2
}
```

### POST /matches/callback
Handles status changes for **Match** documents. Body consists of an updated [``Match``](https://github.com/Qixalite/cytokine#match) document that needs handling.

#### Body
```json
{
  "_id": "620ac5f355b7b0479401748c",
  "players": [
    {
      "name": "puntero",
      "discord": "112720277883895808",
      "steam": "76561198061538510",
      "roles": [
        "creator",
        "player",
        "team_a"
      ]
    },
    {
      "name": "puntero2",
      "discord": "291350950054985730",
      "roles": [
        "player",
        "team_b"
      ]
    }
  ],
  "createdAt": {
    "$date": "2022-02-14T21:13:23.899Z"
  },
  "client": "test123",
  "callbackUrl": "http://localhost:3010/matches/callback",
  "region": "sydney",
  "game": "tf2",
  "map": "cp_badlands",
  "status": "FINISHED",
  "preferences": {
    "createLighthouseServer": true
  },
  "__v": 1,
  "server": "620ac610e897bf0d54c12907"
}
```