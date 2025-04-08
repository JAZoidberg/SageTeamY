import { ApplicationCommandOptionData, ApplicationCommandOptionType, ChatInputCommandInteraction, EmbedBuilder, InteractionResponse } from 'discord.js';
import fetchJobListings from '@root/src/lib/utils/jobUtils/Adzuna_job_search';
import { JobResult } from '@root/src/lib/types/JobResult';
import { Interest } from '@root/src/lib/types/Interest';
import { JobData } from '@root/src/lib/types/JobData';
import { Command } from '@lib/types/Command';
import { DB, BOT } from '@root/config';
import { Job } from '@root/src/lib/types/Job';
import { MongoClient } from 'mongodb';


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
				{ name: 'Alphabetical', value: 'alphabetical' }
			]
		}
	]

	// options: ApplicationCommandOptionData[] = [
	// 	{
	// 		name: 'question',
	// 		description: 'The question you want to ask',
	// 		type: ApplicationCommandOptionType.String,
	// 		required: true
	// 	}
	// ]


	async run(interaction: ChatInputCommandInteraction): Promise<void | InteractionResponse<boolean>> {
		const userID = interaction.user.id;

		const client = await MongoClient.connect(DB.CONNECTION, { useUnifiedTopology: true });
		const db = client.db(BOT.NAME).collection(DB.JOB_FORMS);
		const jobformAnswers:Job[] = await db.find({ owner: userID }).toArray();
		// const jobData:JobData = {
		// 	city: jobformAnswers[0].answers[0],
		// 	preference: jobformAnswers[0].answers[1],
		// 	jobType: jobformAnswers[0].answers[2],
		// 	distance: jobformAnswers[0].answers[3],
		// 	// filterBy: filterBy ?? 'default'
		// 	filterBy: 'default'
		// };

		// const interests:Interest = {
		// 	interest1: jobformAnswers[1].answers[0],
		// 	interest2: jobformAnswers[1].answers[1],
		// 	interest3: jobformAnswers[1].answers[2],
		// 	interest4: jobformAnswers[1].answers[3],
		// 	interest5: jobformAnswers[1].answers[4]
		// };

		const jobData: JobData = {
			city: 'New York',
			preference: 'Software Engineer',
			jobType: 'Full Time',
			distance: '10',
			filterBy: 'date'
		};

		const interests: Interest = {
			interest1: 'Software',
			interest2: 'Engineer',
			interest3: 'Full Time',
			interest4: 'New York',
			interest5: '10'
		};


		const APIResponse:JobResult[] = await fetchJobListings(jobData, interests);
		const results = [jobData, interests, APIResponse];
		const jobFormData: [JobData, Interest, JobResult[]] = [jobData, interests, APIResponse];
		const filterBy = interaction.options.getString('filter') ?? 'default';

		let message = `## Hey <@${userID}>!  
			## Here's your list of job/internship recommendations:  
Based on your interests in **${jobFormData[1].interest1}**, **${jobFormData[1].interest2}**, \
**${jobFormData[1].interest3}**, **${jobFormData[1].interest4}**, and **${jobFormData[1].interest5}**, I've found these jobs you may find interesting. Please note that while you may get\
job/internship recommendations from the same company,\
their positions/details/applications/salary WILL be different and this is not a glitch/bug!
Here's your personalized list:

			${this.listJobs(jobFormData[2], filterBy)}
			
			---  
			### **Disclaimer:**  
			-# Please be aware that the job listings displayed are retrieved from a third-party API. \
			While we strive to provide accurate information, we cannot guarantee the legitimacy or security\
			of all postings. Exercise caution when sharing personal information, submitting resumes, or registering\
			on external sites. Always verify the authenticity of job applications before proceeding. Additionally, \
			some job postings may contain inaccuracies due to API limitations, which are beyond our control. We apologize for any inconvenience this may cause and appreciate your understanding.
			`;

		if (message.length > 2000) {
			message = `${message.substring(0, 1997)}...`;
		}

		const pubChan = interaction.channel;
		if (pubChan) {
			for (let i = 0; i < Math.min(3, jobFormData[2].length); i++) {
				const job = jobFormData[2][i]; 
		
				// calc avg salary for display
				const avgSalary = (Number(job.salaryMax) + Number(job.salaryMin)) / 2;
				const formattedAvgSalary = this.formatCurrency(avgSalary);
		
				// Formating date the job was posted
				const postedDate = new Date(job.created).toDateString();
		
				// Building a rich embed message to display job info
				const embed = new EmbedBuilder()
					.setTitle(`${job.title}`)                    // Set the job title as the embed title
					.setURL(job.link)                            // Make the embed title clickable to the job listing
					.setDescription(`Job opportunity found for you!`) 
					.addFields(                                  // Add relevant fields as name-value pairs
						{ name: 'Average Salary', value: formattedAvgSalary || 'N/A', inline: true },
						{ name: 'Location', value: job.location || 'N/A', inline: true },
						{ name: 'Date Posted', value: postedDate, inline: true },
					)
					.setColor(0x00AE86)                          
					.setFooter({ text: 'Powered by SageBot & Adzuna' }); 
		
				// Send the embed into the same channel the command was triggered in
				await pubChan.send({ embeds: [embed] });
			}
		} else {
			console.error('Channel not found');
		}
	}

	listJobs(jobData: JobResult[], filterBy: string): string {
		// Conditionally sort jobs by salary if sortBy is 'salary'
		if (filterBy === 'salary') {
			jobData.sort((a, b) => {
				const avgA = (Number(a.salaryMax) + Number(a.salaryMin)) / 2;
				const avgB = (Number(b.salaryMax) + Number(b.salaryMin)) / 2;
	
				// Handle cases where salaryMax or salaryMin is "Not listed"
				if (isNaN(avgA)) return 1; // Treat jobs with no salary info as lowest
				if (isNaN(avgB)) return -1;
	
				return avgB - avgA; // Descending order
			});
		} else if (filterBy === 'alphabetical') {
			jobData.sort((a, b) => (a.title > b.title ? 1 : -1));
		}
		else if (filterBy === 'date') {
			jobData.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
		}


		let jobList = '';
		for (let i = 0; i < jobData.length; i++) {
			const avgSalary = (Number(jobData[i].salaryMax) + Number(jobData[i].salaryMin)) / 2;
			const formattedAvgSalary = this.formatCurrency(avgSalary);
			const formattedSalaryMax = this.formatCurrency(Number(jobData[i].salaryMax)) !== 'N/A' ? this.formatCurrency(Number(jobData[i].salaryMax)) : '';
			const formattedSalaryMin = this.formatCurrency(Number(jobData[i].salaryMin)) !== 'N/A' ? this.formatCurrency(Number(jobData[i].salaryMin)) : '';
	
			const salaryDetails = (formattedSalaryMin && formattedSalaryMax)
				? `, Min: ${formattedSalaryMin}, Max: ${formattedSalaryMax}`
				: formattedAvgSalary;
	
			jobList += `${i + 1}. **${jobData[i].title}**  
			  \t\t* **Salary Average:** ${formattedAvgSalary}${salaryDetails}  
			  \t\t* **Location:** ${jobData[i].location}  
			  \t\t* **Date Posted:** ${new Date(jobData[i].created).toDateString()} at ${new Date(jobData[i].created).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
			  \t\t* **Apply here:** [read more about the job and apply here](${jobData[i].link})  
			  ${i !== jobData.length - 1 ? '\n' : ''}`;
		}
	
		return jobList || '### Unfortunately, there were no jobs found based on your interests :(. Consider updating your interests or waiting until something is found.';
	}

	formatCurrency(currency: number): string {
		return isNaN(currency) ? 'N/A' : `${new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(Number(currency))}`;
	}
	

}
