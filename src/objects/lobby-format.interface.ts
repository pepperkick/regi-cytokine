import { FormatRequirement } from "./requirement.interface"

export class LobbyFormat {
    name: string
    type?: string
    game: "tf2"                         // TODO: Add other games (since it's a single game for now, later could be "tf2" | "csgo" | ... )
    requirements: FormatRequirement[]
    maxPlayers: number
    mapTypes: string[]
}