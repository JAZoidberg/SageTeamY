import { DB } from '@root/config';
import { ChatInputCommandInteraction, Embed, EmbedBuilder, InteractionResponse } from 'discord.js';
import { reminderTime } from '@root/src/lib/utils/generalUtils';
import { Command } from '@lib/types/Command';
import jobform from './jobform';
import { JobPreferenceAPI, JobPreferences } from './jobDatabase';

export default class extends Command {

	description = 'See your answers and interests inserted into job form.';
	extendedHelp = 'Don\'t worry, answers and interests will be hidden if you use this command publicly.';

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const jobAnswers = await interaction.client.mongo.collection(DB.USERS)
			.findOne({ owner: interaction.user.id, jobPreferences: { $exists: true } });

		if (!jobAnswers) {
			interaction.reply({ content: 'You don\'t have any submitted anwers to the job form!', ephemeral: true });
		}

		const embeds = new EmbedBuilder()
			.setTitle('Your Job Preferences')
			.setColor('DarkAqua');
		const preferences = jobAnswers.jobPreferences.answers;
		if (preferences) {
			embeds.addFields(
				{ name: 'Preffered City', value: preferences.city },
				{ name: 'Preffered Job Type', value: preferences.jobType },
				{ name: 'Preffered Job Title', value: preferences.jobTitle },
				{ name: 'Preffered Job Description', value: preferences.jobDescription },
			)
		}
	}

}
