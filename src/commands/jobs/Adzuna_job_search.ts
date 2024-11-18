 import { APP_ID, APP_KEY } from '@root/config';
// import { DB, GUILDS, MAINTAINERS, CHANNELS } from '@root/config';
// import { Command } from '@root/src/lib/types/Command';
// import { ApplicationCommandOptionData, ApplicationCommandOptionType, ChatInputCommandInteraction,
// CommandInteraction, EmbedBuilder, InteractionResponse, Message, MessageContextMenuCommandInteraction } from 'discord.js';

 const JOB_TITLE = 'software engineer';
 const LOCATION = 'us';
 const SALARY_MIN = 50000;

 const URL = `https://api.adzuna.com/v1/api/jobs/${LOCATION}/search/1?app_id=${APP_ID}&app_key=${APP_KEY}
 &results_per_page=10&what=${encodeURIComponent(JOB_TITLE)}&where=${encodeURIComponent(LOCATION)}`;



// // interaction.client.mongo.collection(DB.JOB_FORMS).insertOne(responseData);
// // const jobAnswers = questionIDs[qSet].map((question) => interaction.fields.getTextInputValue(`question${question}`));


// export default class extends Command {
// 	description = `Ask the /job command for job listings based on your criteria.`;
// 	extendedHelp = `Provide the job title, location, and minimum salary to get a list of jobs.`;

// 	options: ApplicationCommandOptionData[] = [
// 		{
// 			name: 'JOB_TITLE',
// 			description: 'The job title you are asking for',
// 			type: ApplicationCommandOptionType.String,
// 			required: true,
// 		},
// 		{
// 			name: 'LOCATION',
// 			description: 'The location of the job',
// 			type: ApplicationCommandOptionType.String,
// 			required: true,
// 		},
// 		{
// 			name: 'SALARY_MIN',
// 			description: 'The minimum salary for the job',
// 			type: ApplicationCommandOptionType.Integer,
// 			required: true,
// 		},
// 	];

// 	async run(interaction: CommandInteraction | MessageContextMenuCommandInteraction): Promise<InteractionResponse<boolean> | void | Message<boolean>> {
// 		const jobTitle = interaction.options.getString('JOB_TITLE');
// 		const location = interaction.options.getString('LOCATION');
// 		const salarymin = interaction.options.getInteger('SALARY_MIN');

// 		const URL = `https://api.adzuna.com/v1/api/jobs/${location}/search/1?app_id=${APP_ID}&app_key=${APP_KEY}
// &results_per_page=10&what=${encodeURIComponent(jobTitle)}&where=${encodeURIComponent(location)}`;

fetch(URL)
	.then((response) => {
		if (!response.ok) {
			throw new Error(`HTTP error ${response.status}`);
		}
		return response.json();
	})
	.then((responseData) => {
		// loop through each item in the result array
		for (let i = 0; i < responseData.results.length; i++) {
			console.log(responseData.results[i]); // Access each element
		}
	})
	.catch((error) => {
		console.error('Fetch error:', error);
	});



// import { APP_ID, APP_KEY, DB } from '@root/config';
// import { Command } from '@root/src/lib/types/Command';
// // import { DB, GUILDS, MAINTAINERS, CHANNELS } from '@root/config';
// // import { Command } from '@root/src/lib/types/Command';
// import { ApplicationCommandOptionData, ApplicationCommandOptionType, CommandInteraction, EmbedBuilder, InteractionResponse, Message, MessageContextMenuCommandInteraction } from 'discord.js';
// export default class extends Command {

// 	description = `Ask the /job command for job listings based on your criteria.`;
// 	extendedHelp = `Provide the job title, location, and minimum salary to get a list of jobs.`;

// 	options: ApplicationCommandOptionData[] = [
// 		{
// 			name: 'JOB_TITLE',
// 			description: 'The job title you are asking for',
// 			type: ApplicationCommandOptionType.String,
// 			required: true
// 		},
// 		{
// 			name: 'LOCATION',
// 			description: 'The location of the job',
// 			type: ApplicationCommandOptionType.String,
// 			required: true
// 		},
// 		{
// 			name: 'SALARY_MIN',
// 			description: 'The minimum salary for the job',
// 			type: ApplicationCommandOptionType.Integer,
// 			required: true
// 		}
// 	];

// 	async run(interaction: CommandInteraction | MessageContextMenuCommandInteraction): Promise<InteractionResponse<boolean> | void | Message<boolean>> {
// 		// Retrieve command options
// 		const jobTitle = interaction.options.getString('JOB_TITLE');
// 		const location = interaction.options.getString('LOCATION');
// 		const salaryMin = interaction.options.getInteger('SALARY_MIN');

// 		if (!jobTitle || !location || salaryMin === null) {
// 			return interaction.reply({ content: 'Please provide all required information.', ephemeral: true });
// 		}

// 		// Construct the URL with query parameters
// 		// eslint-disable-next-line max-len
// 		const URL = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(location)}/search/1?app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=10&what=${encodeURIComponent(jobTitle)}&where=${encodeURIComponent(location)}&salary_min=${salaryMin}`;

// 		try {
// 			// Fetch job data
// 			const response = await fetch(URL);
// 			if (!response.ok) throw new Error(`HTTP error ${response.status}`);
// 			const responseData = await response.json();

// 			// Check if results exist and process each job
// 			if (Array.isArray(responseData.results)) {
// 				const jobResults = responseData.results.map((job: any) => ({
// 					title: job.title,
// 					location: job.location.display_name,
// 					salary: job.salary_min,
// 					company: job.company.display_name
// 				}));

// 				// Insert job data into the database
// 				await interaction.client.mongo.collection(DB.CLIENT_DATA).insertMany(jobResults);

// 				// Build and send an embed with the job listings
// 				const embed = new EmbedBuilder()
// 					.setTitle('Job Listings')
// 					.setDescription('Here are some job listings based on your criteria:')
// 					.setColor('#0099ff');

// 				jobResults.forEach((job) => {
// 					embed.addFields({
// 						name: job.title,
// 						value: `Location: ${job.location}\nCompany: ${job.company}\nSalary: ${job.salary || 'N/A'}`,
// 					});
// 				});

// 				await interaction.reply({ embeds: [embed] });
// 			} else {
// 				await interaction.reply({ content: 'No job results found.', ephemeral: true });
// 			}
// 		} catch (error) {
// 			console.error('Fetch error:', error);
// 			await interaction.reply({ content: 'There was an error fetching job listings. Please try again later.', ephemeral: true });
// 		}
// 	}

// }
