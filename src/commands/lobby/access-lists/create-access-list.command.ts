import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { CommandInteraction } from 'discord.js';
import { PreferenceKeys, LobbyCommand } from '../../lobby.command';
import { AccessConfigsCommand } from '../access-configs.command';

@Discord()
@SlashGroup('access-lists', 'lobby')
export class CreateAccessListCommand {
  @Slash('create', {
    description: 'Create a new access list',
  })
  async exec(
    @SlashOption('name', {
      description: `Type a name for your list`,
      type: 'STRING',
    })
    name: string,
    interaction: CommandInteraction,
  ) {
    name = name.toLowerCase();
    const id = AccessConfigsCommand.getPrefId(interaction);

    let lobbyLists = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessLists,
    );

    if (!lobbyLists) {
      lobbyLists = {};
    }

    if (lobbyLists[name]) {
      return await interaction.reply({
        content: `Access list with the name '${name}' already exists.`,
        ephemeral: true,
      });
    }

    lobbyLists[name] = {
      name: name,
    };

    await LobbyCommand.preferenceService.storeData(
      id,
      PreferenceKeys.lobbyAccessLists,
      lobbyLists,
    );

    return await interaction.reply({
      content: `Access list '${name}' has been created!`,
      ephemeral: true,
    });
  }
}
