import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import {
  AutocompleteInteraction,
  CommandInteraction,
  GuildMember,
} from 'discord.js';
import { LobbyCommand, PreferenceKeys } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';
import { AccessListsCommand } from '../access-lists.command';

@Discord()
@SlashGroup('access-lists', 'lobby')
export class AddPlayerToAccessListCommand {
  @Slash('add-player', {
    description: 'Add a player to access list',
  })
  async exec(
    @SlashOption('name', {
      description: `Type the list name`,
      required: true,
      autocomplete: true,
      type: 'STRING',
    })
    name: string,
    @SlashOption('player', {
      description: `Type the player name`,
    })
    player: GuildMember,
    interaction: CommandInteraction | AutocompleteInteraction,
  ) {
    if (interaction instanceof AutocompleteInteraction) {
      switch (interaction.options.getFocused(true).name) {
        case 'name': {
          return AccessListsCommand.getNameChoices(interaction);
        }
      }

      return interaction.respond([]);
    }

    const id = AccessConfigsCommand.getPrefId(interaction);

    const lobbyLists = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessLists,
    );

    if (!lobbyLists[name]) {
      return await interaction.reply({
        content: `Access list with that the '${name}' does not exist.`,
        ephemeral: true,
      });
    }

    const list = lobbyLists[name];
    if (!list.users) {
      list.users = [];
    }

    list.users.push(player.id);
    lobbyLists[name] = list;

    await LobbyCommand.preferenceService.storeData(
      id,
      PreferenceKeys.lobbyAccessLists,
      lobbyLists,
    );

    return await interaction.reply({
      content: `Player '${player.user.username}' has been added to '${name}' access list.`,
      ephemeral: true,
    });
  }
}
