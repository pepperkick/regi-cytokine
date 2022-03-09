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
- ``kick`` Kicks a queued player from an owned Lobby.
    - ``player`` The player to kick.
    - ``reason`` Optional. A reason for the kick.
- ``close`` Closes an owned active Lobby.

### Administration
- ``close`` Close any active Lobby regardless of creator from a Select Menu.
- ``status`` Gets the current status of all Lobbies.
    - ``lobby`` Optional. If passed, lists a specific Lobby's information by its ID.

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
| ``discord.channels.create`` | The channel where users are allowed to create new Lobbies | ``800182109213687848`` |
| ``discord.channels.results`` | If set, the results for a finished Lobby will be sent here | ``800182109213287848`` |
| ``discord.channels.admin`` | The channel in which commands will work in administrator mode | ``800182207410470933`` |
| ``discord.token`` | Discord bot login token | N/A |
| ``lobbies.categoryId`` | If set, Regi-Cytokine will create lobby channels under this category instead of creating new ones for each lobby. | ``518061282633711616`` |
| ``lobbies.lobbyTextPrefix`` | The prefix for Lobby text channels (Ex: ``lobby-`` => ``lobby-somename``) | ``lobby-`` |
| ``lobbies.lobbyVoicePrefix`` | The prefix for Lobby voice channels (Ex: ``Lobby `` => ``Lobby somename``) | ``Lobby `` |
| ``lobbies.defaultExpiry`` | The amount of time (in seconds) in which a Lobby will expire if their config type does not have a set override. See [``formats``](https://github.com/Qixalite/regi-cytokine#formats) | ``30`` |
| ``lobbies.afkCheckTimeout`` | The amount of time (in seconds) in which an AFK Check expires if not all players have responded. | ``60`` |
| ``lobbies.names`` | Array of names used by Regi-Cytokine to generate an unique name for each Lobby | N/A |
| ``lobbies.teams`` | Names for each team's text & voice channel name | N/A
| ``regions`` | List of supported regions to book servers from | [See ``regions``](https://github.com/Qixalite/regi-cytokine#regions) |
| ``formats`` | List of supported formats for each game | [See ``formats``](https://github.com/Qixalite/regi-cytokine#formats) |

### ``regions``
- ``name``: The name this region is displayed to users.
- ``alias``
- ``continent``: The continent this region is in.
- ``tags``
- ``discordVoiceRegion``: Voice region to be used for lobby voice channels closest to the region the server's in.
- ``valveSdr``: If not specified in ``/lobby create``, Valve SDR will be enabled/disabled depending on region.
- ``tiers``: The list of supported tiers for this region.

```json
"sydney": {
    "name": "Sydney",
    "alias": [ "sy", "syd" ],
    "continent": "oceania",
    "tags": [ "sydney", "aus", "oceania" ],
    "discordVoiceRegion": "sydney",
    "valveSdr": true,
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
- ``name``: The name this format is displayed to users.
- ``game``: The game this format is compatible with.
- ``hidden``: If set, the format will be available to be selected, but not listed on the options list when creating a Lobby.
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

## License

All rights are reserved to Qixalite.

Permission must be granted explicitly by Qixalite to use, copy, modify, and distribute this code and its related documentation for any reason.
