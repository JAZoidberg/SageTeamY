import {
	ApplicationCommandOptionData,
	ApplicationCommandOptionType,
	ChatInputCommandInteraction,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	InteractionResponse,
	AttachmentBuilder
} from 'discord.js';
import fetchJobListings from '@root/src/lib/utils/jobUtils/Adzuna_job_search';
import { JobResult } from '@root/src/lib/types/JobResult';
import { Interest } from '@root/src/lib/types/Interest';
import { JobData } from '@root/src/lib/types/JobData';
import { Command } from '@lib/types/Command';
import { DB, BOT, MAP_KEY } from '@root/config';
import { MongoClient } from 'mongodb';
// import { sendToFile } from '@root/src/lib/utils/generalUtils';
import axios from 'axios';
import { JobPreferences } from '@root/src/lib/types/JobPreferences';
import { jobMessage, stripMarkdown, headerMessage, generateJobPDF, createJobEmbed } from '@root/src/pieces/tasks';
import { sendToFile } from '@root/src/lib/utils/generalUtils';


export default class extends Command {

	description = `Get a listing of jobs based on your interests and preferences.`;
	extendedHelp = `This command will return a listing of jobs based on your interests and preferences.`;

	options: ApplicationCommandOptionData[] = [
		{
			name: 'filter',
			description: 'Filter options for job listings',
			type: ApplicationCommandOptionType.String,
			required: false,
			choices: [
				{ name: 'Date Posted: recent', value: 'date' },
				{ name: 'Salary: high-low average', value: 'salary' },
				{ name: 'Alphabetical: A-Z', value: 'alphabetical' },
				{ name: 'Distance: shortest-longest', value: 'distance' }
			]
		}
	]

	async run(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>> {
		await interaction.deferReply(); // Defer the reply first

		const filter = interaction.options.getString('filter') ?? 'default';
		const result = await jobMessage(filter, interaction.user.id);
		const { pdfBuffer } = result;
		const { embed, row } = result;

		interaction.followUp({ embeds: [embed], components: [row] });
		const userID = interaction.user.id; // Define userID from interaction.user.id
		const userJobData = new Map<string, { jobs: JobResult[]; index: number }>(); // Store user job data in a map
		userJobData.set(userID, { jobs: result.jobResults, index: 0 }); // Initialize user job data
		const collector = interaction.channel?.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60000 // 1 minute timeout
		});

		collector?.on('collect', async (i) => {
			if (i.user.id !== userID) {
				await i.reply({
					content: 'This is not your interaction!',
					ephemeral: true
				});
				return;
			}

			const userData = userJobData.get(userID);
			if (!userData) return;

			const { jobs } = userData;
			let { index } = userData;

			switch (i.customId) {
				case 'previous':
					await i.deferUpdate(); // Acknowledge the button press
					index = index > 0 ? index - 1 : jobs.length - 1;
					break;
				case 'next':
					await i.deferUpdate(); // Acknowledge the button press
					index = index < jobs.length - 1 ? index + 1 : 0;
					break;
				case 'remove':
					jobs.splice(index, 1);
					if (jobs.length === 0) {
						await i.update({
							content: 'No more jobs to display.',
							embeds: [],
							components: []
						});
						userJobData.delete(userID);
						return;
					}
					index = index >= jobs.length ? 0 : index;
					break;
				// ----------------ADDED DOWNLOAD BUTTON--------------------
				case 'download':
					await i.deferReply({ ephemeral: true });
					try {
						const attachment = new AttachmentBuilder(
							pdfBuffer
						).setName('jobs.pdf');
						await i.editReply({
							content:
								'Here is your PDF file with all job listings:',
							files: [attachment]
						});
					} catch (error) {
						console.error('Error generating PDF:', error);
						await i.editReply({
							content:
								'An error occurred while generating the PDF. Please try again later.'
						});
					}
					return; // Exit early so we don't update the embed.
			}

			// Update user data
			userJobData.set(userID, { jobs, index });
			console.log('User job data:', userJobData);


			// Update embed and buttons
			const newEmbed = createJobEmbed(
				jobs[index],
				index,
				jobs.length
			);
			await i.followUp({ embeds: [newEmbed.embed], components: [newEmbed.row] });
		});

		collector?.on('end', () => {
			userJobData.delete(userID);
		});
	}

}
