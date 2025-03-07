import { ApplicationCommandOptionData, ApplicationCommandOptionType, ChatInputCommandInteraction, EmbedBuilder, InteractionResponse } from 'discord.js';
import fetchJobListings from '@root/src/lib/utils/jobUtils/Adzuna_job_search';
import { JobResult } from '@root/src/lib/types/JobResult';
import { Interest } from '@root/src/lib/types/Interest';
import { JobData } from '@root/src/lib/types/JobData';
import { Command } from '@lib/types/Command';

const MAGIC8BALL_RESPONSES = [
	'As I see it, yes.',
	'Ask again later.',
	'Better not tell you now.',
	'Cannot predict now.',
	'Concentrate and ask again.',
	'Don’t count on it.',
	'It is certain.',
	'It is decidedly so.',
	'Most likely.',
	'My reply is no.',
	'My sources say no.',
	'Outlook not so good.',
	'Outlook good.',
	'Reply hazy, try again.',
	'Signs point to yes.',
	'Very doubtful.',
	'Without a doubt.',
	'Yes.',
	'Yes – definitely.',
	'You may rely on it.'
];

export default class extends Command {

	description = `Testing for stuff.`;
	extendedHelp = `This command requires you to put a question mark ('?') at the end of your message.`;

	// options: ApplicationCommandOptionData[] = [
	// 	{
	// 		name: 'question',
	// 		description: 'The question you want to ask',
	// 		type: ApplicationCommandOptionType.String,
	// 		required: true
	// 	}
	// ]

	async run(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>> {
		const testJobData: JobData = {
			city: 'New York',
			preference: 'Software Engineer',
			jobType: 'Full Time',
			distance: '10',
			filterBy: 'date'
		};

		const testInterests: Interest = {
			interest1: 'Software',
			interest2: 'Engineer',
			interest3: 'Full Time',
			interest4: 'New York',
			interest5: '10'
		};

		const jobTest : JobResult[] = await fetchJobListings(testJobData, testInterests);
		return interaction.reply({ content: `This is a test command. Here are the job results: ${jobTest.map(job => job.title).join('\n')}` });
		// return interaction.reply({ content: 'This is a new command' });

		// const testEmbed = new EmbedBuilder()
		// 	.setTitle('Test Embed')
		// 	.setDescription('This is a test embed for the new command.')
		// 	.setThumbnail('https://upload.wikimedia.org/wikipedia/en/d/d0/Neurosama_new_model.png')
		// 	.addFields({ name: 'City', value: `${testJobData.city}` })
		// 	.addFields({ name: 'Field 2', value: 'This is the second field.' })
		// 	.setColor('#0099ff');
		// return interaction.reply({ embeds: [testEmbed] });
	}

}
