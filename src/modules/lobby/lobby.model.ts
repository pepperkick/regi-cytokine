import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { LobbyPickTracker } from './lobby-pick-tracker.interface';

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

  // The Discord user ID of the user who created the lobby.
  @Prop()
  createdAt: Date;

  // The Message ID attached to this lobby instance (CommandInteraction reply)
  // This is to obtain the message statessly.
  @Prop({ type: String })
  messageId: string;

  // Status of this Lobby
  @Prop({ type: String })
  status: string;

  // The region this lobby belongs to.
  @Prop({ type: String })
  region: string;

  // The tier this lobby was created with.
  @Prop({ type: String })
  tier: string;

  // The format this Lobby is using
  @Prop({ type: String })
  format: string;

  // Access config for this lobby.
  @Prop({ type: String })
  accessConfig: string;

  // Amount of times this lobby has gotten announced.
  @Prop({ type: Number, min: 0 })
  announcements: number;

  // For captain-based lobbies: Did this lobby get adverted when minimum players were in?
  @Prop({ type: Boolean })
  minimumAdverted: boolean;

  // For captain-based lobbies: The pick order for the captains.
  @Prop({ type: Object })
  captainPicks: LobbyPickTracker;

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

      // AFK Checks and Connect strings are sent on this channel.
      // This channel should only be created if a Lobby is full and requirements are met.
      infoChannelId?: string;

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
