import { Command } from '@root/src/lib/types/Command';
import { ChatInputCommandInteraction, EmbedBuilder, InteractionResponse } from 'discord.js';

export default class extends Command {

	description = 'Form do get your preferences for jobs to be used with the Job Alert System!';

	run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const responseEmbed = new EmbedBuilder().setTitle('test');
		return interaction.reply({ embeds: [responseEmbed] });
	}

}
