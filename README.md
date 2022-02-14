# Cytokine - Reginald Discord Client

Discord client functionality to implement **Cytokine** communication.

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
| ``discord.channels.admin`` | The channel in which commands will work in administrator mode | ``800182207410470933`` |
| ``discord.token`` | Discord bot login token | N/A |
| ``lobbies.categoryId`` | If set, Regi-Cytokine will create lobby channels under this category instead of creating new ones for each lobby. | ``518061282633711616`` |
| ``lobbies.lobbyTextPrefix`` | The prefix for Lobby text channels (Ex: ``lobby-`` => ``lobby-somename``) | ``lobby-`` |
| ``lobbies.lobbyVoicePrefix`` | The prefix for Lobby voice channels (Ex: ``Lobby `` => ``Lobby somename``) | ``Lobby `` |
| ``lobbies.names`` | Array of names used by Regi-Cytokine to generate an unique name for each Lobby | N/A |
| ``lobbies.teams`` | Names for each team's text channel name | N/A
| ``regions`` | List of supported regions to book servers from | [See ``regions``](https://github.com/Qixalite/regi-cytokine/edit/main/README.md#regions) |
| ``formats`` | List of supported formats for each game | [See ``formats``](https://github.com/Qixalite/regi-cytokine/edit/main/README.md#formats) |

### ``regions``
- ``name``: The name this region is displayed to users.
- ``alias``
- ``continent``: The continent this region is in.
- ``tags``
- ``discordVoiceRegion``: Voice region to be used for lobby voice channels closest to the region the server's in.
- ``valveSdr``: If not specified in ``/lobby create``, Valve SDR will be enabled/disabled depending on region.
- ``tiers``

```
"sydney": {
    "name": "Sydney",
    "alias": [ "sy", "syd" ],
    "continent": "oceania",
    "tags": [ "sydney", "aus", "oceania" ],
    "discordVoiceRegion": "sydney",
    "valveSdr": true,
    "tiers": {}
},
```

### ``formats``
- ``name``: The name this format is displayed to users.
- ``game``: The game this format is compatible with.
- ``mapTypes``: List of map suffixes this format supports in-game (Ex: For 6vs6 it's ``cp`` and ``koth`` maps)
- ``maps``: Array of map names this format has available.
- ``distribution``: Type of distribution the format has by default.
- ``maxPlayers``: Required amount of players for this format.
- ``requirements``: Array of ``FormatRequirement``s for this specific format.
    - ``requirements.FormatRequirement``: ``{ name: RequirementName, count: number, overfill?: boolean }``
```
{
    "name": "6vs6",
    "game": "tf2",
    "mapTypes": ["cp", "koth"],
    "maps": [
        "cp_badlands", "cp_gullywash_f3", "cp_process_final", "cp_snakewater_final1"
    ],
    "distribution": "RANDOM",
    "maxPlayers": 12,
    "requirements": [
        { "name": "red-scout", "count": 2 },
        { "name": "red-soldier", "count": 2 },
        { "name": "red-demoman", "count": 1 },
        { "name": "red-medic", "count": 1 },
        { "name": "blu-scout", "count": 2 },
        { "name": "blu-soldier", "count": 2 },
        { "name": "blu-demoman", "count": 1 },
        { "name": "blu-medic", "count": 1 }
    ]
}
```

## API
### POST /lobbies/callback
Handles status changes for **Lobby** documents. Body consists of an updated ``Lobby`` document.

#### Body
```
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
Handles status changes for **Match** documents. Body consists of an updated ``Match`` document.

#### Body
```
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
