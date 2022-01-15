import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class DiscordInfo extends Document {
  // The lobby to which store Discord information of.
  @Prop({ type: String })
  lobbyId: string;

  // The Discord user ID of the user who created the lobby.
  @Prop({ type: String })
  creatorId: string;

  // The Message ID attached to this lobby instance (CommandInteraction reply)
  // This is to obtain the message statessly.
  @Prop({ type: String })
  messageId: string;

  // Discord Channels
  @Prop({ type: Object })
  channels: {
    // General TextChannel ID
    // This is where players inside the queue can talk with each-other in a pre-game manner.
    generalChannelId: string;

    // Team A channels
    teamA: {
      // TextChannel ID
      textChannelId?: string;

      // VoiceChannel ID
      voiceChannelId?: string;
    };

    // Team B channels
    teamB: {
      // TextChannel ID
      textChannelId?: string;

      // VoiceChannel ID
      voiceChannelId?: string;
    };
  };

  // Discord Text Channel created by this lobby instance.
  @Prop({ type: String })
  channelId: string;

  // Discord Voice Channel created by this lobby instance (Team A / 1)
  @Prop({ type: String })
  voiceChannelTeamA: string;

  // Discord Voice Channel created by this lobby instance (Team B / 2)
  @Prop({ type: String })
  voiceChannelTeamB: string;
}

export const DiscordInfoSchema = SchemaFactory.createForClass(DiscordInfo);
