import { ApplicationCommandOptionData, ApplicationCommandOptionType, AttachmentBuilder, ChatInputCommandInteraction, InteractionResponse } from 'discord.js';
import fetchJobListings from '@root/src/lib/utils/jobUtils/Adzuna_job_search';
import { JobResult } from '@root/src/lib/types/JobResult';
import { Interest } from '@root/src/lib/types/Interest';
import { JobData } from '@root/src/lib/types/JobData';
import { Command } from '@lib/types/Command';
import { DB, BOT, MAP_KEY } from '@root/config';
import { MongoClient } from 'mongodb';
import { sendToFile } from '@root/src/lib/utils/generalUtils';
import axios from 'axios';
import { JobPreferences } from '@root/src/lib/types/JobPreferences';
import { jobMessage, stripMarkdown, headerMessage, generateJobPDF } from '@root/src/pieces/tasks';


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
				{ name: 'Date Posted', value: 'date' },
				{ name: 'Salary', value: 'salary' },
				{ name: 'Alphabetical', value: 'alphabetical' },
				{ name: 'Distance', value: 'distance' }
			]
		}
	]

	async run(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>> {
		await interaction.deferReply(); // Defer the reply first

		const filter = interaction.options.getString('filter') ?? 'default';
		const result = await jobMessage(filter, interaction.user.id);
		const { message } = result;
		const { pdfBuffer } = result;
		const attachments: AttachmentBuilder[] = [];
		attachments.push(await sendToFile(stripMarkdown(message.split('---')[0], interaction.user.id), 'txt', 'list-of-jobs-internships', false));
		attachments.push(new AttachmentBuilder(pdfBuffer).setName('jobs.pdf'));
		const pubChan = interaction.channel;
		interaction.followUp({ content: headerMessage(interaction.user.id, 'default'), files: attachments as AttachmentBuilder[] });
	}

}
