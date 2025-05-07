// This file contains the command handler for the reminder system of a Discord bot.

import { BOT } from '@root/config';
import { ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@lib/types/Command';
import { showMainMenu } from './menu-handlers';

export default class extends Command {
    description = `Have ${BOT.NAME} give you a reminder.`;
    extendedHelp = 'Create reminders for anything - one-time or recurring job alerts with optional email notifications.';
    options = []; // No options needed as we're using buttons

    async run(
        interaction: ChatInputCommandInteraction
    ): Promise<void> {
        await showMainMenu(interaction);
    }
}