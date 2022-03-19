import { Discord, Slash, SlashGroup, SlashOption, SlashChoice } from 'discordx';
import {
  ApplicationCommandOptionChoice,
  AutocompleteInteraction,
  CommandInteraction,
} from 'discord.js';
import { PreferenceKeys, LobbyCommand } from '../../lobby.command';
import {
  RequirementName,
  SpecialRequirementNames,
} from '../../../objects/requirement-names.enum';
import { AccessConfigsCommand } from '../access-configs.command';

@Discord()
@SlashGroup('access-configs', 'lobby')
export class SetAccessListOnConfigCommand {
  @Slash('set-access-list', {
    description: 'Set an access list for certain actions.',
  })
  async exec(
    @SlashOption('name', {
      description: `Type a name for your config`,
      required: true,
      autocomplete: true,
      type: 'STRING',
    })
    name: string,
    @SlashChoice('Whitelist', 'whitelist')
    @SlashChoice('Blacklist', 'blacklist')
    @SlashOption('type', {
      description: `Type of access to apply`,
      type: 'STRING',
    })
    type: string,
    @SlashOption('action', {
      description: `Action to set access list for`,
      autocomplete: true,
      required: true,
      type: 'STRING',
    })
    action: string,
    @SlashOption('access-list', {
      description: `Type the name of access list (Leave empty to remove)`,
      autocomplete: true,
      required: false,
      type: 'STRING',
    })
    list: string,
    interaction: CommandInteraction | AutocompleteInteraction,
  ) {
    if (interaction instanceof AutocompleteInteraction) {
      switch (interaction.options.getFocused(true).name) {
        case 'name': {
          return AccessConfigsCommand.getNameChoices(interaction);
        }
        case 'access-list': {
          const guildNames = await LobbyCommand.preferenceService.getData(
            'guild',
            PreferenceKeys.lobbyAccessLists,
          );
          const userNames = await LobbyCommand.preferenceService.getData(
            interaction.user.id,
            PreferenceKeys.lobbyAccessLists,
          );
          const names = Object.keys(userNames).concat(
            Object.keys(guildNames).filter(
              (item) => Object.keys(userNames).indexOf(item) < 0,
            ),
          );

          const choices = [];
          if (names) {
            for (const name of names) {
              choices.push({
                name: name,
                value: name,
              });
            }
          }

          return await interaction.respond(
            choices
              .filter((choice) =>
                choice.name.includes(
                  <string>interaction.options.getFocused(true).value,
                ),
              )
              .slice(0, 24),
          );
        }
        case 'action': {
          const roles = Object.values(RequirementName).filter(
            (key) => !SpecialRequirementNames.includes(key),
          );
          const choices: ApplicationCommandOptionChoice[] = roles.map(
            (role) => ({
              name: role,
              value: role,
            }),
          );
          return await interaction.respond(
            choices
              .filter((choice) =>
                choice.name.includes(
                  <string>interaction.options.getFocused(true).value,
                ),
              )
              .slice(0, 24),
          );
        }
      }

      return;
    }

    const id = AccessConfigsCommand.getPrefId(interaction);

    const lobbyConfigs = await LobbyCommand.preferenceService.getData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
    );

    if (!lobbyConfigs[name]) {
      return await interaction.reply({
        content: `Access config with the name '${name}' does not exist.`,
        ephemeral: true,
      });
    }

    if (!Object.values(RequirementName).includes(action as RequirementName)) {
      return await interaction.reply({
        content: `Action with the name '${action}' does not exist.`,
        ephemeral: true,
      });
    }

    if (list && list != '') {
      const guildlists = await LobbyCommand.preferenceService.getData(
        'guild',
        PreferenceKeys.lobbyAccessLists,
      );
      const userLists = await LobbyCommand.preferenceService.getData(
        interaction.user.id,
        PreferenceKeys.lobbyAccessLists,
      );

      if (!guildlists[list] && !userLists) {
        return await interaction.reply({
          content: `Access list with the name '${list}' does not exist.`,
          ephemeral: true,
        });
      }
    } else {
      list = null;
    }

    const accessConfig = lobbyConfigs[name];
    if (!accessConfig.accessLists) {
      accessConfig.accessLists = {};
    }

    accessConfig.accessLists[action] = {};
    accessConfig.accessLists[action][type] = list;
    lobbyConfigs[name] = accessConfig;

    await LobbyCommand.preferenceService.storeData(
      id,
      PreferenceKeys.lobbyAccessConfigs,
      lobbyConfigs,
    );

    if (list) {
      return await interaction.reply({
        content: `Access list '${list}' has been set for action '${action}' for '${name}' access config.`,
        ephemeral: true,
      });
    } else {
      return await interaction.reply({
        content: `Access list has been removed for action '${action}' for '${name}' access config.`,
        ephemeral: true,
      });
    }
  }
}
