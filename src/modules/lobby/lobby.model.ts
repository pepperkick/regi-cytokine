import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Lobby extends Document {
  // The lobby to which store Discord information of.
  @Prop({ type: String })
  lobbyId: string;

  // The name of this Lobby
  @Prop({ type: String })
  name: string;

  // The Discord user ID of the user who created the lobby.
  @Prop({ type: String })
  creatorId: string;

  // The Message ID attached to this lobby instance (CommandInteraction reply)
  // This is to obtain the message statessly.
  @Prop({ type: String })
  messageId: string;

  // Expiry Date for the Lobby
  @Prop({ type: Date })
  expiryDate: Date;

  // Status of this Lobby
  @Prop({ type: String })
  status: string;

  // The region this lobby belongs to.
  @Prop({ type: String })
  region: string;

  // Discord Channels
  @Prop({ type: Object })
  channels: {
    // Category ID where these channels belong on
    categoryId: string;

    // General channels
    // This is where players inside the queue can talk with each-other in a pre-game manner.
    general: {
      // General TextChannel
      textChannelId?: string;

      // General VoiceChannel
      voiceChannelId?: string;
    };

    // Team A channels
    teamA?: {
      // TextChannel for Team A
      textChannelId?: string;

      // VoiceChannel for Team A
      voiceChannelId?: string;
    };

    // Team B channels
    teamB?: {
      // TextChannel for Team B
      textChannelId?: string;

      // VoiceChannel for Team B
      voiceChannelId?: string;
    };
  };
}

export const LobbySchema = SchemaFactory.createForClass(Lobby);
